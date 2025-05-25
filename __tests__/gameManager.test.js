const gameManager = require('../gameManager');
const fs = require('fs');

// Mock the 'fs' module
jest.mock('fs');

// Mock socket.io globally for all tests in this file
const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

// Helper to create a basic player
const createPlayerDetails = (slot, name, socketId = `socket_${slot}`) => ({
  playerSlot: `Player ${slot}`,
  playerName: name,
  socketId: socketId,
});

describe('GameManager', () => {
  beforeEach(() => {
    gameManager.clearGameSessions(); // Ensure clean state for each test
    mockIo.to.mockClear();
    mockIo.emit.mockClear();
    fs.readFileSync.mockReset(); // Reset fs mock for each test
    // Clear all Jest timers (fake or real) before each test
    jest.clearAllTimers();
    // Ensure we use fake timers for tests that need them, but reset for others
    jest.useRealTimers(); 
  });

  describe('Word Loading (via startNewRound)', () => {
    beforeEach(() => {
        // Mock for addPlayerToSession to avoid its internal console logs during these tests
        jest.spyOn(gameManager, 'addPlayerToSession').mockImplementation((session, playerDetails) => {
            session.players.push({
                ...playerDetails,
                isHost: session.players.length === 0,
                avatar: '😀', // Default mock avatar
                isReady: true, // Assume ready for round start
                hasVoted: false,
                disconnectedAt: null,
                score: 0,
            });
            if(!session.scores) session.scores = {};
            session.scores[playerDetails.playerSlot] = 0;
            return session.players[session.players.length -1];
        });
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restore mocks after these tests
    });

    test('should load easy words by default when difficulty is "easy"', () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({ wordPairs: [['sun', 'moon']] }));
      const session = gameManager.createGameSession('GAME_EASY', mockIo, 'easy');
      gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
      gameManager.addPlayerToSession(session, createPlayerDetails(2, 'Bob'));
      gameManager.startNewRound(session, mockIo);

      expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('easyWords.json'), 'utf8');
      expect(session.playerWords).toBeDefined();
      const player1Word = session.playerWords['Player 1'];
      const player2Word = session.playerWords['Player 2'];
      expect([player1Word, player2Word]).toEqual(expect.arrayContaining(['sun', 'moon']));
    });

    test('should load medium words when difficulty is "medium"', () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({ wordPairs: [['day', 'night']] }));
      const session = gameManager.createGameSession('GAME_MED', mockIo, 'medium');
      gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
      gameManager.startNewRound(session, mockIo);

      expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('mediumWords.json'), 'utf8');
      expect(['day', 'night']).toContain(session.playerWords['Player 1']);
    });

    test('should load hard words when difficulty is "hard"', () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({ wordPairs: [['code', 'debug']] }));
      const session = gameManager.createGameSession('GAME_HARD', mockIo, 'hard');
      gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
      gameManager.startNewRound(session, mockIo);

      expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('hardWords.json'), 'utf8');
      expect(['code', 'debug']).toContain(session.playerWords['Player 1']);
    });

    test('should fallback to easy words if specific difficulty file is missing', () => {
      fs.readFileSync
        .mockImplementationOnce((filePath) => {
          if (filePath.includes('mediumWords.json')) throw new Error('File not found');
          return ''; 
        })
        .mockImplementationOnce(() => JSON.stringify({ wordPairs: [['easy_fallback', 'word']] }));
      
      const session = gameManager.createGameSession('GAME_FALLBACK', mockIo, 'medium');
      gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
      gameManager.startNewRound(session, mockIo);

      expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('mediumWords.json'), 'utf8');
      expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('easyWords.json'), 'utf8');
      expect(['easy_fallback', 'word']).toContain(session.playerWords['Player 1']);
    });
    
    test('should use emergency fallback if all word files fail', () => {
        fs.readFileSync.mockImplementation(() => { throw new Error('File system error'); });
        const session = gameManager.createGameSession('GAME_EMERGENCY', mockIo, 'hard');
        gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
        gameManager.startNewRound(session, mockIo);

        expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('hardWords.json'), 'utf8');
        expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('easyWords.json'), 'utf8');
        expect(["Emergency", "Fallback", "Default", "Words"]).toContain(session.playerWords['Player 1']);
    });
  });

  describe('Timer Logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('clue timer should start on nextClueTurn and emit timerUpdate', () => {
      const session = gameManager.createGameSession('TIMER_CLUE', mockIo, 'easy');
      gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
      gameManager.addPlayerToSession(session, createPlayerDetails(2, 'Bob'));
      session.turnOrder = ['Player 1', 'Player 2']; 
      session.clueIndex = -1; 

      gameManager.nextClueOrVoting(session, mockIo); 

      expect(session.currentTimer).toBeDefined();
      expect(session.timerPhase).toBe('clue');
      expect(mockIo.to).toHaveBeenCalledWith('TIMER_CLUE');
      expect(mockIo.emit).toHaveBeenCalledWith('timerUpdate', { phase: 'clue', timeLeft: 30 });

      jest.advanceTimersByTime(1000);
      expect(mockIo.emit).toHaveBeenCalledWith('timerUpdate', { phase: 'clue', timeLeft: 29 });
    });

    test('clue timer expiration should call nextClueOrVoting', () => {
      const session = gameManager.createGameSession('TIMER_CLUE_EXP', mockIo, 'easy');
      gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
      gameManager.addPlayerToSession(session, createPlayerDetails(2, 'Bob'));
      session.turnOrder = ['Player 1', 'Player 2'];
      session.clueIndex = -1;

      gameManager.nextClueOrVoting(session, mockIo); // Player 1's turn

      jest.advanceTimersByTime(30 * 1000); 

      expect(session.clueIndex).toBe(1); 
      expect(session.timerPhase).toBe('clue'); 
      expect(mockIo.emit).toHaveBeenCalledWith('nextClueTurn', 'Player 2');
    });

    test('voting timer should start when voting phase begins and emit timerUpdate', () => {
      const session = gameManager.createGameSession('TIMER_VOTE', mockIo, 'easy');
      gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
      session.turnOrder = ['Player 1'];
      session.clueIndex = 0; 

      gameManager.nextClueOrVoting(session, mockIo); 

      expect(session.phase).toBe('voting');
      expect(session.currentTimer).toBeDefined();
      expect(session.timerPhase).toBe('voting');
      expect(mockIo.emit).toHaveBeenCalledWith('beginVoting', expect.any(Object));
      expect(mockIo.emit).toHaveBeenCalledWith('timerUpdate', { phase: 'voting', timeLeft: 20 });

      jest.advanceTimersByTime(1000);
      expect(mockIo.emit).toHaveBeenCalledWith('timerUpdate', { phase: 'voting', timeLeft: 19 });
    });

    test('voting timer expiration should call handleSubmitVote with timerExpired true', () => {
        const session = gameManager.createGameSession('TIMER_VOTE_EXP', mockIo, 'easy');
        gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
        gameManager.addPlayerToSession(session, createPlayerDetails(2, 'Bob'));
        session.imposterSlot = 'Player 2'; 
        session.turnOrder = ['Player 1', 'Player 2'];
        session.clueIndex = 1; 
    
        gameManager.nextClueOrVoting(session, mockIo); 
    
        jest.advanceTimersByTime(20 * 1000); 
    
        expect(session.phase).toBe('results');
        expect(mockIo.emit).toHaveBeenCalledWith('votingResults', expect.any(Object));
    });

    test('timers should be cleared by clearSessionTimers', () => {
        const session = gameManager.createGameSession('TIMER_CLEAR', mockIo, 'easy');
        gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
        session.turnOrder = ['Player 1'];
        session.clueIndex = -1;
        gameManager.nextClueOrVoting(session, mockIo); 
        
        expect(session.currentTimer).toBeDefined();
        expect(session.countdownInterval).toBeDefined();

        gameManager.clearSessionTimers(session);
        expect(session.currentTimer).toBeNull();
        expect(session.countdownInterval).toBeNull();
    });

    test('timers are cleared when a new round starts', () => {
        const session = gameManager.createGameSession('TIMER_NEW_ROUND', mockIo, 'easy');
        gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
        session.turnOrder = ['Player 1'];
        session.clueIndex = -1;
        gameManager.nextClueOrVoting(session, mockIo); // Starts clue timer
        
        jest.spyOn(global, 'clearTimeout');
        jest.spyOn(global, 'clearInterval');
        
        fs.readFileSync.mockReturnValue(JSON.stringify({ wordPairs: [['new', 'round']] }));
        gameManager.startNewRound(session, mockIo); // Should clear timers
        
        expect(clearTimeout).toHaveBeenCalled();
        expect(clearInterval).toHaveBeenCalled();
        expect(session.currentTimer).toBeNull();
        expect(session.countdownInterval).toBeNull();
    });
  });

  describe('Player Management', () => {
    test('addPlayerToSession successfully adds a new player and assigns avatar', () => {
      const session = gameManager.createGameSession('PLAYER_ADD', mockIo);
      const player = gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
      
      expect(session.players.length).toBe(1);
      expect(player.playerName).toBe('Alice');
      expect(player.playerSlot).toBe('Player 1');
      expect(player.isHost).toBe(true);
      expect(player.avatar).toBe('😀'); 
      expect(session.scores['Player 1']).toBe(0);
    });

    test('addPlayerToSession assigns different avatar for second player', () => {
        const session = gameManager.createGameSession('PLAYER_ADD2', mockIo);
        gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
        const player2 = gameManager.addPlayerToSession(session, createPlayerDetails(2, 'Bob'));
        expect(player2.avatar).toBe('😎'); 
        expect(player2.isHost).toBe(false);
      });

    test('addPlayerToSession allows reconnection of existing player', () => {
      const session = gameManager.createGameSession('PLAYER_RECONNECT', mockIo);
      gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice', 'socket_old'));
      expect(session.players[0].socketId).toBe('socket_old');

      const playerReconnected = gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice', 'socket_new'));
      expect(session.players.length).toBe(1); 
      expect(playerReconnected.socketId).toBe('socket_new');
    });

    test('addPlayerToSession denies player if slot is taken by different name', () => {
      const session = gameManager.createGameSession('PLAYER_SLOT_TAKEN', mockIo);
      gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
      const result = gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Charlie')); 
      
      expect(result.error).toBeDefined();
      expect(session.players.length).toBe(1);
    });

    test('addPlayerToSession input validation for player name and slot', () => {
        const session = gameManager.createGameSession('PLAYER_VALIDATE', mockIo);
        expect(gameManager.addPlayerToSession(session, createPlayerDetails(1, '')).error).toBeDefined();
        expect(gameManager.addPlayerToSession(session, {playerName: 'Dave', playerSlot: 'InvalidSlot', socketId: 's1'}).error).toBeDefined();
        expect(gameManager.addPlayerToSession(session, {playerName: 'Eve', playerSlot: 'Player 13', socketId: 's2'}).error).toBeDefined();
    });
    
    test('removePlayerFromSession successfully removes a player', () => {
        const session = gameManager.createGameSession('PLAYER_REMOVE', mockIo);
        gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice'));
        gameManager.removePlayerFromSession(session, 'Player 1');
        expect(session.players.length).toBe(0);
    });

    test('removePlayerFromSession reassigns host if host leaves', () => {
        const session = gameManager.createGameSession('PLAYER_HOST_LEAVE', mockIo);
        gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice')); 
        gameManager.addPlayerToSession(session, createPlayerDetails(2, 'Bob'));
        
        gameManager.removePlayerFromSession(session, 'Player 1');
        expect(session.players.length).toBe(1);
        expect(session.players[0].isHost).toBe(true);
        expect(session.players[0].playerName).toBe('Bob');
    });
  });

  describe('Game Flow & Scoring', () => {
    let session;
    beforeEach(() => {
        fs.readFileSync.mockReturnValue(JSON.stringify({ wordPairs: [['apple', 'orange']] }));
        session = gameManager.createGameSession('GAME_FLOW', mockIo, 'easy');
        gameManager.addPlayerToSession(session, createPlayerDetails(1, 'Alice', 's1'));
        gameManager.addPlayerToSession(session, createPlayerDetails(2, 'Bob', 's2'));
        gameManager.addPlayerToSession(session, createPlayerDetails(3, 'Charlie', 's3'));
    });

    test('startNewRound assigns imposter and different words', () => {
        gameManager.startNewRound(session, mockIo);
        expect(session.imposterSlot).toBeDefined();
        const imposter = session.players.find(p => p.playerSlot === session.imposterSlot);
        const nonImposters = session.players.filter(p => p.playerSlot !== session.imposterSlot);

        expect(imposter).toBeDefined();
        expect(nonImposters.length).toBeGreaterThan(0);
        
        const imposterWord = session.playerWords[imposter.playerSlot];
        const normalWord = session.playerWords[nonImposters[0].playerSlot];

        expect(imposterWord).not.toBe(normalWord);
        expect([imposterWord, normalWord]).toEqual(expect.arrayContaining(['apple', 'orange']));
        nonImposters.forEach(p => {
            expect(session.playerWords[p.playerSlot]).toBe(normalWord);
        });
    });

    test('handleSubmitVote correctly tallies votes and calculates scores (imposter caught)', () => {
        session.imposterSlot = 'Player 3'; 
        session.playerWords = { 'Player 1': 'apple', 'Player 2': 'apple', 'Player 3': 'orange' };
        session.phase = 'voting'; 
        
        gameManager.handleSubmitVote(session, 'Player 1', 'Player 3', mockIo); 
        gameManager.getPlayerFromSession(session, 'Player 3').hasVoted = true; 
        gameManager.handleSubmitVote(session, 'Player 2', 'Player 3', mockIo); 
        
        expect(session.phase).toBe('results');
        expect(session.scores['Player 1']).toBe(1); 
        expect(session.scores['Player 2']).toBe(1); 
        expect(session.scores['Player 3']).toBe(0); 
        expect(mockIo.emit).toHaveBeenCalledWith('votingResults', expect.objectContaining({
            votedOut: 'Player 3',
            imposter: 'Player 3',
            correctGuessers: expect.arrayContaining(['Player 1', 'Player 2'])
        }));
    });

    test('handleSubmitVote calculates scores correctly (imposter survives)', () => {
        session.imposterSlot = 'Player 3'; 
        session.playerWords = { 'Player 1': 'apple', 'Player 2': 'apple', 'Player 3': 'orange' };
        session.phase = 'voting';
        
        gameManager.handleSubmitVote(session, 'Player 1', 'Player 2', mockIo); 
        gameManager.getPlayerFromSession(session, 'Player 3').hasVoted = true; 
        gameManager.handleSubmitVote(session, 'Player 2', 'Player 1', mockIo); 
        
        expect(session.phase).toBe('results');
        expect(session.scores['Player 1']).toBe(0);
        expect(session.scores['Player 2']).toBe(0);
        expect(session.scores['Player 3']).toBe(2); 
        expect(mockIo.emit).toHaveBeenCalledWith('votingResults', expect.objectContaining({
            imposter: 'Player 3',
            correctGuessers: [] 
        }));
    });
    
    test('handleSubmitVote handles ties (first round, leads to revote)', () => {
        session.imposterSlot = 'Player 3';
        session.playerWords = { 'Player 1': 'apple', 'Player 2': 'apple', 'Player 3': 'orange', 'Player 4': 'apple' };
        session.phase = 'voting';
        session.revoted = false; 

        gameManager.addPlayerToSession(session, createPlayerDetails(4, 'Dave', 's4')); 
        
        gameManager.handleSubmitVote(session, 'Player 1', 'Player 2', mockIo); 
        gameManager.handleSubmitVote(session, 'Player 4', 'Player 1', mockIo); 
        gameManager.getPlayerFromSession(session, 'Player 3').hasVoted = true; 
        gameManager.getPlayerFromSession(session, 'Player 2').hasVoted = true; // Bob also "votes" to trigger tally

        // At this point, Alice voted Bob, Dave voted Alice. Bob and Charlie effectively haven't cast deciding votes.
        // To make a clear tie for revote: Alice (1 vote from Dave), Bob (1 vote from Alice).
        // Let's assume Charlie (imposter) and Bob mark themselves as voted but their votes don't count for this.
        // Or, simpler, we just need to ensure all have `hasVoted = true` before tally.
        
        // To ensure tally happens, all players must have hasVoted = true
        session.players.forEach(p => p.hasVoted = true); 
        // Manually trigger the final part of handleSubmitVote by calling it one more time (as if last player just voted)
        // or directly call the tallying part if possible (not exposed).
        // For this test, let's ensure the conditions for revote are met.
        // Votes: P1 -> P2, P4 -> P1. (P2 and P3 no "real" vote against non-imposter)
        // This creates a tie between P1 and P2.
        
        // We need to call handleSubmitVote for the last player to trigger the tally logic fully
        // Let's assume Player 2 is the last one to "submit" their vote (even if it's just marking hasVoted).
        gameManager.handleSubmitVote(session, 'Player 2', 'Player 4', mockIo); // Bob votes for Dave
                                                                              // Votes: P1->P2, P4->P1, P2->P4
                                                                              // Counts: P1:1, P2:1, P4:1 -> Tie
        
        expect(session.revoted).toBe(true);
        expect(mockIo.emit).toHaveBeenCalledWith('revote', { tiedPlayers: expect.arrayContaining(['Player 1', 'Player 2', 'Player 4']) });
        expect(session.phase).toBe('voting'); 
    });
  });
});
