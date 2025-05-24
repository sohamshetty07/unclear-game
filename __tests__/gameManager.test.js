const gameManager = require('../gameManager'); // Adjust path if needed
const { wordPairs } = require('../wordConfig.json'); // For checking word list length

// Mock 'io' object for testing functions that expect it for emissions
const mockIo = {
  to: jest.fn().mockReturnThis(), 
  emit: jest.fn(),
};

describe('gameManager.js Tests', () => {
  beforeEach(() => {
    if (gameManager.clearGameSessions) {
        gameManager.clearGameSessions();
    } else {
        console.warn("gameManager.clearGameSessions() not found. Tests might interfere if gameSessions is not reset.");
    }
    mockIo.to.mockClear();
    mockIo.emit.mockClear();
  });

  // Test Suite 1: Game Creation
  describe('Game Creation (createGameSession)', () => {
    it('should create a new game session with default values', () => {
      const gameId = 'TEST01';
      const session = gameManager.createGameSession(gameId, mockIo);
      expect(session).toBeDefined();
      expect(session.players).toEqual([]);
      expect(session.currentRound).toBe(1);
      expect(session.phase).toBe('waiting');
      expect(session.scores).toEqual({});
    });

    it('should return the existing session if gameId already exists', () => {
      const gameId = 'TEST02';
      const session1 = gameManager.createGameSession(gameId, mockIo); 
      const session2 = gameManager.createGameSession(gameId, mockIo); 
      expect(session2).toBeDefined();
      expect(session1).toBe(session2); // Check for same instance
    });
  });

  // Test Suite 2: Player Joining (addPlayerToSession)
  describe('Player Joining (addPlayerToSession)', () => {
    let gameId;
    let session;
    beforeEach(() => {
      gameId = "JOIN01";
      session = gameManager.createGameSession(gameId, mockIo);
    });

    it('should add a new player to the session and make them host if first', () => {
      const playerDetails = { playerName: 'Alice', playerSlot: 'Player 1', socketId: 'socket1' };
      const result = gameManager.addPlayerToSession(session, playerDetails);
      expect(result).not.toHaveProperty('error');
      expect(session.players.length).toBe(1);
      expect(session.players[0]).toEqual(expect.objectContaining({ 
        playerName: 'Alice', 
        playerSlot: 'Player 1',
        isHost: true 
      }));
      expect(session.scores['Player 1']).toBe(0);
    });

    it('should not make subsequent players the host', () => {
      const player1Details = { playerName: 'Alice', playerSlot: 'Player 1', socketId: 'socket1' };
      gameManager.addPlayerToSession(session, player1Details);
      const player2Details = { playerName: 'Bob', playerSlot: 'Player 2', socketId: 'socket2' };
      const result = gameManager.addPlayerToSession(session, player2Details);
      expect(result).not.toHaveProperty('error');
      expect(session.players[1].isHost).toBe(false);
    });
    
    it('should return error if playerSlot is taken by a different player', () => {
      const player1Details = { playerName: 'Alice', playerSlot: 'Player 1', socketId: 'socket1' };
      gameManager.addPlayerToSession(session, player1Details);
      const player2Details = { playerName: 'Bob', playerSlot: 'Player 1', socketId: 'socket2' }; // Same slot, different name
      const result = gameManager.addPlayerToSession(session, player2Details);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Slot already taken by another player.");
      expect(session.players.length).toBe(1);
    });

    it('should allow a player to reconnect with matching name and slot, updating socketId', () => {
      const playerDetails = { playerName: 'Charlie', playerSlot: 'Player 3', socketId: 'socket3_old' };
      gameManager.addPlayerToSession(session, playerDetails); // Charlie joins
      
      const reconnectDetails = { playerName: 'Charlie', playerSlot: 'Player 3', socketId: 'socket3_new' };
      const result = gameManager.addPlayerToSession(session, reconnectDetails); 
      expect(result).not.toHaveProperty('error');
      expect(session.players.length).toBe(1);
      expect(session.players[0].socketId).toBe('socket3_new');
      expect(session.players[0].isHost).toBe(true); 
      expect(session.players[0].disconnectedAt).toBeNull();
    });
    
    it('should return error for invalid playerName (empty)', () => {
        const playerDetails = { playerName: ' ', playerSlot: 'Player 1', socketId: 'socket1' };
        const result = gameManager.addPlayerToSession(session, playerDetails);
        expect(result.error).toBeDefined();
        expect(result.error).toContain("Player name must be provided.");
    });

    it('should return error for invalid playerSlot (bad format - no "Player ")', () => {
        const playerDetails = { playerName: 'ValidName', playerSlot: 'InvalidSlot', socketId: 'socket1' };
        const result = gameManager.addPlayerToSession(session, playerDetails);
        expect(result.error).toBeDefined();
        expect(result.error).toContain("Invalid player slot format. Must start with 'Player '.");
    });

    it('should return error for invalid playerSlot (bad number - Player 99)', () => {
        const playerDetails = { playerName: 'ValidName', playerSlot: 'Player 99', socketId: 'socket1' };
        const result = gameManager.addPlayerToSession(session, playerDetails);
        expect(result.error).toBeDefined();
        expect(result.error).toContain("Invalid player slot number.");
    });
  });

  // Test Suite 3: Start New Round (startNewRound)
  describe('Start New Round (startNewRound)', () => {
    let gameId;
    let session;
    beforeEach(() => {
      gameId = "ROUND01";
      session = gameManager.createGameSession(gameId, mockIo);
      gameManager.addPlayerToSession(session, { playerName: 'P1', playerSlot: 'Player 1', socketId: 's1', isReady: true });
      gameManager.addPlayerToSession(session, { playerName: 'P2', playerSlot: 'Player 2', socketId: 's2', isReady: true });
      gameManager.addPlayerToSession(session, { playerName: 'P3', playerSlot: 'Player 3', socketId: 's3', isReady: true });
    });

    it('should set phase to "clue"', () => {
      gameManager.startNewRound(session, mockIo);
      expect(session.phase).toBe('clue');
    });

    it('should assign an imposterSlot from one of the players', () => {
      gameManager.startNewRound(session, mockIo);
      expect(session.imposterSlot).toBeDefined();
      const playerSlots = session.players.map(p => p.playerSlot);
      expect(playerSlots).toContain(session.imposterSlot);
    });

    it('should assign different words to imposter and others if wordPairs available', () => {
      if (wordPairs.length === 0) {
        console.warn("Skipping word assignment test as wordPairs is empty in config.");
        return;
      }
      gameManager.startNewRound(session, mockIo);
      const imposterWord = session.playerWords[session.imposterSlot];
      let nonImposterWord;
      for (const p of session.players) {
        if (p.playerSlot !== session.imposterSlot) {
          nonImposterWord = session.playerWords[p.playerSlot];
          break;
        }
      }
      expect(imposterWord).toBeDefined();
      expect(nonImposterWord).toBeDefined();
      if (session.players.length > 1) {
          expect(imposterWord).not.toBe(nonImposterWord);
      }
    });
    
    it('should ensure imposter is not the first in turnOrder if more than 1 player', () => {
      if (session.players.length <= 1) return;
      for (let i = 0; i < 20; i++) { 
          gameManager.startNewRound(session, mockIo);
          expect(session.turnOrder[0]).not.toBe(session.imposterSlot);
      }
    });

    it('should reset votes and readyNext', () => {
      session.votes = { 'Player 1': 'Player 2' }; 
      session.readyNext = new Set(['Player 1']);   
      gameManager.startNewRound(session, mockIo);
      expect(session.votes).toEqual({});
      expect(session.readyNext).toEqual(new Set());
    });
    
    it('should reset hasVoted for all players', () => {
      session.players.forEach(p => p.hasVoted = true);
      gameManager.startNewRound(session, mockIo);
      session.players.forEach(p => {
        expect(p.hasVoted).toBe(false);
      });
    });
  });

  // Test Suite 4: Voting Logic (handleSubmitVote)
  describe('Voting Logic (handleSubmitVote)', () => {
    let gameId;
    let session;
    const p1Details = { playerName: 'P1', playerSlot: 'Player 1', socketId: 's1' };
    const p2Details = { playerName: 'P2', playerSlot: 'Player 2', socketId: 's2' };
    const p3Details = { playerName: 'P3', playerSlot: 'Player 3', socketId: 's3' };
    const p4ImpDetails = { playerName: 'P4Imp', playerSlot: 'Player 4', socketId: 's4' };


    beforeEach(() => {
      gameId = "VOTE01";
      session = gameManager.createGameSession(gameId, mockIo);
      gameManager.addPlayerToSession(session, p1Details);
      gameManager.addPlayerToSession(session, p2Details);
      gameManager.addPlayerToSession(session, p3Details);
      gameManager.addPlayerToSession(session, p4ImpDetails); // Imposter
      
      gameManager.startNewRound(session, mockIo);
      session.phase = 'voting'; 
      session.players.forEach(p => p.hasVoted = false);
      session.votes = {}; 
      session.imposterSlot = p4ImpDetails.playerSlot; // P4 is imposter
    });

    it('should record a vote for a non-imposter and mark player as hasVoted', () => {
      const voterSlot = p1Details.playerSlot; // P1 is not imposter
      const votedSlot = p2Details.playerSlot; 

      gameManager.handleSubmitVote(session, voterSlot, votedSlot, mockIo);
      expect(session.votes[voterSlot]).toBe(votedSlot);
      const voterPlayer = gameManager.getPlayerFromSession(session, voterSlot);
      expect(voterPlayer.hasVoted).toBe(true);
    });

    it('should not store votes from the imposter', () => {
      const imposterVoterSlot = p4ImpDetails.playerSlot;
      const votedSlot = p1Details.playerSlot;
      
      gameManager.handleSubmitVote(session, imposterVoterSlot, votedSlot, mockIo);
      expect(session.votes[imposterVoterSlot]).toBeUndefined(); 
      const imposterPlayer = gameManager.getPlayerFromSession(session, imposterVoterSlot);
      expect(imposterPlayer.hasVoted).toBe(true); 
    });

    it('should trigger votingResults when all players have "submitted" their vote', () => {
      // P1, P2, P3 are non-imposters. P4 is imposter.
      gameManager.handleSubmitVote(session, p1Details.playerSlot, p4ImpDetails.playerSlot, mockIo); // P1 votes imposter
      gameManager.handleSubmitVote(session, p2Details.playerSlot, p4ImpDetails.playerSlot, mockIo); // P2 votes imposter
      gameManager.handleSubmitVote(session, p3Details.playerSlot, p1Details.playerSlot, mockIo);   // P3 votes P1
      gameManager.handleSubmitVote(session, p4ImpDetails.playerSlot, p1Details.playerSlot, mockIo); // P4 (imposter) votes P1
      
      expect(session.phase).toBe('results'); 
      const votingResultsCall = mockIo.emit.mock.calls.find(call => call[0] === 'votingResults');
      expect(votingResultsCall).toBeDefined();
      if(votingResultsCall) {
        const resultsData = votingResultsCall[1];
        expect(resultsData.imposter).toBe(p4ImpDetails.playerSlot);
        expect(resultsData.correctGuessers).toEqual(expect.arrayContaining([p1Details.playerSlot, p2Details.playerSlot]));
        expect(resultsData.correctGuessers.length).toBe(2);
      }
    });
    
    it('should handle a tie and trigger a revote if not already revoted', () => {
      // Setup: P1, P2, P3 are non-imposters. P4 is imposter.
      // P1 votes P2
      // P2 votes P1
      // P3 votes P1 (P1 gets 2 votes, P2 gets 1 vote - No tie this way)
      // Let's make P1 vote P3, P2 vote P3, P3 vote P1. Imposter (P4) votes P2
      // Stored votes: { P1:P3, P2:P3, P3:P1 }
      // Counts: { P3:2, P1:1 } -> P3 voted out. No tie.

      // Tie Scenario: P1 votes P2, P2 votes P1, P3 votes P2. Imposter P4 votes P1.
      // Stored votes: { P1:P2, P2:P1, P3:P2 }
      // Counts: { P2:2, P1:1 } -> P2 voted out. No tie.

      // Tie Scenario: P1 votes P3, P2 votes P1, P3 votes P2. Imposter P4 votes P3.
      // Stored votes: { P1:P3, P2:P1, P3:P2 }
      // Counts: { P3:1, P1:1, P2:1 } -> 3-way tie. This is what we want.
      
      gameManager.handleSubmitVote(session, p1Details.playerSlot, p3Details.playerSlot, mockIo); // P1 -> P3
      gameManager.handleSubmitVote(session, p2Details.playerSlot, p1Details.playerSlot, mockIo); // P2 -> P1
      gameManager.handleSubmitVote(session, p3Details.playerSlot, p2Details.playerSlot, mockIo); // P3 -> P2
      gameManager.handleSubmitVote(session, p4ImpDetails.playerSlot, p1Details.playerSlot, mockIo); // P4 (imposter) "votes"
      
      expect(session.revoted).toBe(true);
      const revoteCall = mockIo.emit.mock.calls.find(call => call[0] === 'revote');
      expect(revoteCall).toBeDefined();
      if (revoteCall) {
        expect(revoteCall[1].tiedPlayers).toEqual(expect.arrayContaining([p1Details.playerSlot, p2Details.playerSlot, p3Details.playerSlot]));
      }
      expect(session.votes).toEqual({});
    });
  });
  
  // Test Suite 5: Player Removal / Disconnects (removePlayerFromSession)
  describe('Player Removal (removePlayerFromSession)', () => {
    let gameId;
    let session;
    const player1 = { playerName: 'Alice', playerSlot: 'Player 1', socketId: 'socket1' };
    const player2 = { playerName: 'Bob', playerSlot: 'Player 2', socketId: 'socket2' };

    beforeEach(() => {
      gameId = "REMOVE01";
      session = gameManager.createGameSession(gameId, mockIo);
      gameManager.addPlayerToSession(session, player1);
      gameManager.addPlayerToSession(session, player2);
    });

    it('should remove a player from the session and return the removed player object', () => {
      const result = gameManager.removePlayerFromSession(session, 'Player 1');
      expect(result).toBeDefined();
      expect(result.playerSlot).toBe('Player 1');
      expect(session.players.length).toBe(1);
      expect(session.players.find(p => p.playerSlot === 'Player 1')).toBeUndefined();
    });

    it('should return undefined if player to remove is not found', () => {
      const result = gameManager.removePlayerFromSession(session, 'Player 3');
      expect(result).toBeUndefined(); 
      expect(session.players.length).toBe(2);
    });

    it('should reassign host if the host is removed and other players remain', () => {
      expect(session.players.find(p => p.playerSlot === 'Player 1').isHost).toBe(true); 
      gameManager.removePlayerFromSession(session, 'Player 1'); 
      expect(session.players.length).toBe(1);
      expect(session.players[0].isHost).toBe(true); 
    });
    
    it('should not reassign host if removed player is not host', () => {
      expect(session.players.find(p => p.playerSlot === 'Player 1').isHost).toBe(true); 
      gameManager.removePlayerFromSession(session, 'Player 2'); 
      expect(session.players.length).toBe(1);
      expect(session.players.find(p => p.playerSlot === 'Player 1').isHost).toBe(true); 
    });
    
    it('should handle removing the last player', () => {
        gameManager.removePlayerFromSession(session, 'Player 1');
        gameManager.removePlayerFromSession(session, 'Player 2');
        expect(session.players.length).toBe(0);
    });
  });
});
