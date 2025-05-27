// gameManager.js
const fs = require('fs');
const path = require('path');

// Global wordPairs loading is removed. Word loading will be dynamic within startNewRound.

const PLAYER_AVATARS = ['😀', '😎', '👽', '🤖', '🧑‍🚀', '🌟', '🎉', '🎈', '🎯', '🚀', '💡', '🦊'];
const CLUE_GIVING_DURATION_SECONDS = 60;
const VOTING_DURATION_SECONDS = 60;

const gameSessions = {};

function clearSessionTimers(session) {
    if (session.currentTimer) {
        clearTimeout(session.currentTimer);
        session.currentTimer = null;
        console.log(`[GameManager] [GameID: ${session.gameId}] Cleared currentTimer.`);
    }
    if (session.countdownInterval) {
        clearInterval(session.countdownInterval);
        session.countdownInterval = null;
        console.log(`[GameManager] [GameID: ${session.gameId}] Cleared countdownInterval.`);
    }
}

function startTimer(session, io, phase, durationSeconds, timeoutCallback) {
    console.log(`[GameManager] [GameID: ${session.gameId}] Starting timer for phase: ${phase}, duration: ${durationSeconds}s.`);
    clearSessionTimers(session); // Clear any existing timers first

    let timeLeft = durationSeconds;
    session.timerPhase = phase; // Store current phase for timer updates

    // Emit initial time
    io.to(session.gameId).emit('timerUpdate', { phase: session.timerPhase, timeLeft });

    session.countdownInterval = setInterval(() => {
        timeLeft--;
        io.to(session.gameId).emit('timerUpdate', { phase: session.timerPhase, timeLeft });
        if (timeLeft <= 0) {
            clearInterval(session.countdownInterval);
            session.countdownInterval = null; 
            // Timer will be cleared by timeoutCallback or next phase change
        }
    }, 1000);

    session.currentTimer = setTimeout(() => {
        console.log(`[GameManager] ${phase} timer expired for game ${session.gameId}`);
        clearInterval(session.countdownInterval); // Ensure interval is cleared
        session.countdownInterval = null;
        session.currentTimer = null;
        session.timerPhase = null;
        timeoutCallback();
    }, durationSeconds * 1000);
}


function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getGameSession(gameId) {
  return gameSessions[gameId];
}

function createGameSession(gameId, io) { 
  if (gameSessions[gameId]) {
    // If session exists, should we update its difficulty?
    // For now, let's assume existing session's difficulty should not be overwritten by a new create call.
    // Or, if it's a rejoin/recreate attempt, this logic might need refinement.
    // However, typically createGame is for new games.
    return gameSessions[gameId]; 
  }
  gameSessions[gameId] = {
    gameId: gameId,
    players: [],
    currentRound: 1,
    phase: 'waiting',
    // difficulty: difficulty || 'easy', // Removed
    playerWords: {},
    imposterSlot: '',
    turnOrder: [],
    clueIndex: 0,
    votes: {},
    scores: {},
    roundHistory: [],
    readyNext: new Set(),
    revoted: false,
    currentTimer: null,       // To store setTimeout ID
    countdownInterval: null,  // To store setInterval ID
    timerPhase: null          // To store the phase ('clue' or 'voting') the timer is for
  };
  // console.log(`[GameManager] Game created: ${gameId}`); // Removed difficulty from log
  return gameSessions[gameId];
}

function addPlayerToSession(session, playerDetails) {
  if (!session || !session.players) {
    console.error("[GameManager] addPlayerToSession: Session not found or invalid.");
    return { error: "Session not found or invalid." };
  }

  const { playerName, playerSlot, socketId } = playerDetails;

  // Validate playerName
  if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
    return { error: "Player name must be provided." };
  }
  if (playerName.trim().length > 30) {
    return { error: "Player name is too long (max 30 characters)." };
  }
  const trimmedPlayerName = playerName.trim();

  // Validate playerSlot
  if (!playerSlot || typeof playerSlot !== 'string' || playerSlot.trim().length === 0) {
    return { error: "Player slot must be provided." };
  }
  if (playerSlot.trim().length >= 15) { // Max length for "Player XX" is "Player 12" (9) + some buffer
    return { error: "Player slot identifier is too long (max 15 characters)." };
  }
  if (!playerSlot.startsWith("Player ")) {
    return { error: "Invalid player slot format. Must start with 'Player '." };
  }
  // Basic check for "Player X" or "Player XX"
  const slotNumberPart = playerSlot.substring("Player ".length);
  if (!/^\d{1,2}$/.test(slotNumberPart) || parseInt(slotNumberPart, 10) < 1 || parseInt(slotNumberPart, 10) > 12) {
    return { error: "Invalid player slot number. Must be 'Player X' or 'Player XX' (1-12)." };
  }
  const trimmedPlayerSlot = playerSlot.trim();

  const existingPlayer = session.players.find(p => p.playerSlot === trimmedPlayerSlot);

  if (existingPlayer) {
    if (existingPlayer.playerName === trimmedPlayerName) { // Reconnect
      console.log(`[GameManager] [GameID: ${session.gameId}] Player ${trimmedPlayerName} (${trimmedPlayerSlot}) reconnected with new socketId: ${socketId}.`);
      existingPlayer.socketId = socketId; 
      existingPlayer.disconnectedAt = null;
      return existingPlayer; 
    } else {
      console.warn(`[GameManager] [GameID: ${session.gameId}] Slot ${trimmedPlayerSlot} attempt by ${trimmedPlayerName} denied. Already taken by ${existingPlayer.playerName}.`);
      return { error: "Slot already taken by another player." };
    }
  }

  // New player
  const isHost = session.players.length === 0;
  const slotNumber = parseInt(slotNumberPart, 10);
  const avatar = PLAYER_AVATARS[(slotNumber - 1) % PLAYER_AVATARS.length];

  const newPlayer = {
    ...playerDetails, // includes socketId
    playerName: trimmedPlayerName,
    playerSlot: trimmedPlayerSlot,
    avatar: avatar, // Assign avatar
    isHost: isHost,
    isReady: false, // Default for new player
    hasVoted: false, // Default for new player
    disconnectedAt: null
  };

  session.players.push(newPlayer);
  if (!session.scores) session.scores = {};
  session.scores[trimmedPlayerSlot] = 0;
  console.log(`[GameManager] [GameID: ${session.gameId}] Player ${newPlayer.playerName} (${newPlayer.playerSlot}) added with avatar ${newPlayer.avatar}. Total players: ${session.players.length}.`);
  return newPlayer;
}

function removePlayerFromSession(session, playerSlot) {
  if (!session || !session.players) {
    console.error("[GameManager] removePlayerFromSession: Session not found or invalid.");
    return undefined;
  }
  const playerIndex = session.players.findIndex(p => p.playerSlot === playerSlot);

  if (playerIndex === -1) {
    console.warn(`[GameManager] [GameID: ${session.gameId}] Player ${playerSlot} not found for removal.`);
    return undefined; 
  }

  const removedPlayer = session.players.splice(playerIndex, 1)[0]; 
  console.log(`[GameManager] [GameID: ${session.gameId}] Player ${removedPlayer.playerName} (${removedPlayer.playerSlot}) removed. Remaining players: ${session.players.length}.`);

  // Host reassignment logic
  if (removedPlayer.isHost && session.players.length > 0) {
    session.players[0].isHost = true; 
    console.log(`[GameManager] [GameID: ${session.gameId}] Host reassigned to ${session.players[0].playerName} (${session.players[0].playerSlot}).`);
  }
  
  return removedPlayer; 
}

function getPlayerFromSession(session, playerSlot) {
  if (!session || !session.players) return null;
  return session.players.find(p => p.playerSlot === playerSlot);
}

function updatePlayerInSession(session, playerSlot, updates) {
  const player = getPlayerFromSession(session, playerSlot);
  if (player) {
    for (const key in updates) {
      player[key] = updates[key];
    }
    return player;
  }
  return null;
}

function startNewRound(session, io) {
  if (!session) {
    console.error("[GameManager] startNewRound: Session not found.");
    return;
  }
  clearSessionTimers(session); 
  session.phase = 'clue';
  console.log(`[GameManager] [GameID: ${session.gameId}] Starting new round. Phase set to 'clue'.`);
  session.votes = {};
  session.revoted = false;

  session.players.forEach(p => {
    p.hasVoted = false; // Reset voting state for all players
  });

  session.readyNext = new Set();
  session.turnOrder = shuffle(session.players.map(p => p.playerSlot));

  let imposterSlot;
  // Ensure the first player in turn order is not the imposter (simple way to avoid immediate self-clue)
  do {
    imposterSlot = session.turnOrder[Math.floor(Math.random() * session.turnOrder.length)];
  } while (session.turnOrder.length > 1 && session.turnOrder[0] === imposterSlot);
  
  // Handle case for single player (though game logic might not make sense)
  if (session.turnOrder.length === 1) imposterSlot = session.turnOrder[0];

  // Dynamically load word pairs
  let currentWordPairs = loadWordPairs();

  if (currentWordPairs.length === 0) {
    console.error(`CRITICAL: No word pairs loaded (or fallback failed). Cannot start round properly.`);
    // Emit an error to the room or handle this state more gracefully.
    // Using a hardcoded emergency fallback to prevent crash.
    currentWordPairs = [["Emergency", "Fallback"], ["Default", "Words"]];
  }

  const [word, imposterWord] = currentWordPairs[Math.floor(Math.random() * currentWordPairs.length)];
  const playerWords = {};
  session.players.forEach(p => {
    playerWords[p.playerSlot] = (p.playerSlot === imposterSlot) ? imposterWord : word;
  });

  session.imposterSlot = imposterSlot;
  session.playerWords = playerWords;
  session.clueIndex = 0; // Reset clue index for the new round

  session.players.forEach(p => {
    if (io && p.socketId) { // Check if io and socketId are valid
      io.to(p.socketId).emit('startRound', {
        word: playerWords[p.playerSlot],
        turnOrder: session.turnOrder,
        currentClueTurn: session.turnOrder[0],
        round: session.currentRound
      });
    }
  });

  console.log(`[GameManager] [GameID: ${session.gameId}] Round ${session.currentRound} started. Imposter: ${imposterSlot}. Normal word: ${word}.`);
}

// Function to advance to the next clue giver or to voting phase
function nextClueOrVoting(session, io) {
    if (!session) {
      console.error("[GameManager] nextClueOrVoting: Session not found.");
      return;
    }
    if (session.phase !== 'clue') {
        if (session.phase === 'voting' || session.phase === 'results') {
            console.log(`[GameManager] [GameID: ${session.gameId}] nextClueOrVoting called but phase is already ${session.phase}. No action.`);
            return;
        }
    }
    clearSessionTimers(session); 

    session.clueIndex++;
    if (session.clueIndex < session.turnOrder.length) {
        const nextTurn = session.turnOrder[session.clueIndex];
        console.log(`[GameManager] [GameID: ${session.gameId}] Advancing to next clue giver: ${nextTurn}.`);
        io.to(session.gameId).emit('nextClueTurn', nextTurn);
        startTimer(session, io, 'clue', CLUE_GIVING_DURATION_SECONDS, () => {
            console.log(`[GameManager] [GameID: ${session.gameId}] Clue timer expired for ${nextTurn}. Auto-advancing.`);
            nextClueOrVoting(session, io); 
        });
    } else {
        session.phase = 'voting';
        console.log(`[GameManager] [GameID: ${session.gameId}] All clues given. Transitioning to voting phase.`);
        const playerMap = session.players.reduce((map, p) => {
            map[p.playerSlot] = p.playerName;
            return map;
        }, {});
        io.to(session.gameId).emit('beginVoting', {
            players: session.players,
            alreadyVoted: false, 
            playerMap
        });
        startTimer(session, io, 'voting', VOTING_DURATION_SECONDS, () => {
            console.log(`[GameManager] [GameID: ${session.gameId}] Voting timer expired. Forcing vote tally.`);
            handleSubmitVote(session, null, null, io, true); 
        });
    }
}

// Function to handle vote submission and tallying
function handleSubmitVote(session, voterSlot, votedSlot, io, timerExpired = false) {
    if (!session || session.phase !== 'voting') {
        console.warn(`[GameManager] [GameID: ${session?.gameId}] handleSubmitVote called in incorrect phase: ${session?.phase}.`);
        return;
    }

    if (voterSlot) { 
        const player = getPlayerFromSession(session, voterSlot);
        if (player) {
            player.hasVoted = true;
            console.log(`[GameManager] [GameID: ${session.gameId}] Player ${voterSlot} voted for ${votedSlot}.`);
        }
        if (voterSlot !== session.imposterSlot) {
            session.votes[voterSlot] = votedSlot;
        }
    }
    
    const allPlayersMarkedAsVoted = session.players.every(p => p.hasVoted);

    if (!allPlayersMarkedAsVoted && !timerExpired) {
        console.log(`[GameManager] [GameID: ${session.gameId}] Waiting for more votes. ${session.players.filter(p=>!p.hasVoted).length} remaining.`);
        return; 
    }
    
    console.log(`[GameManager] [GameID: ${session.gameId}] Tallying votes. All voted or timer expired: ${timerExpired}.`);
    clearSessionTimers(session); 

    const voteCounts = {};
    Object.values(session.votes).forEach(votedFor => {
        voteCounts[votedFor] = (voteCounts[votedFor] || 0) + 1;
    });

    // The erroneous redeclaration of voteCounts and related lines were removed here.
    // The first voteCounts object is used directly.
    
    const maxVotes = Math.max(0, ...Object.values(voteCounts));
    const topVoted = Object.keys(voteCounts).filter(slot => voteCounts[slot] === maxVotes);

    const playerMap = session.players.reduce((map, p) => {
        map[p.playerSlot] = p.playerName;
        return map;
    }, {});

    let finalVotedOut; // Renamed from finalVotedImposter for clarity
    if (topVoted.length === 0) { // No valid votes cast
        finalVotedOut = null; 
    } else if (topVoted.length === 1) {
        finalVotedOut = topVoted[0];
    } else if (!session.revoted) { // Tie and no revote yet
        session.revoted = true;
        session.votes = {}; // Clear actual stored votes (which are non-imposter votes)
        session.players.forEach(p => p.hasVoted = false); // Reset hasVoted status for all
        io.to(session.gameId).emit('revote', { tiedPlayers: topVoted });
        return;
    } else { // Tie after a revote, pick randomly from tied players
        finalVotedOut = topVoted[Math.floor(Math.random() * topVoted.length)];
    }

    const actualImposter = session.imposterSlot;
    
    session.players.forEach(p => {
      session.scores[p.playerSlot] = session.scores[p.playerSlot] || 0;
    });

    // Scoring Logic based on valid (non-imposter) votes
    if (finalVotedOut === actualImposter) { // Imposter correctly identified by group
        session.players.forEach(p => {
            // Check their actual vote (which is in session.votes if they are not imposter)
            if (p.playerSlot !== actualImposter && session.votes[p.playerSlot] === actualImposter) {
                session.scores[p.playerSlot] += 1; // Correct guessers get a point
            }
        });
    } else { // Imposter not identified or wrong person identified
        if (actualImposter) { // Ensure imposter exists
             session.scores[actualImposter] = (session.scores[actualImposter] || 0) + 2; // Imposter gets points
        }
    }
    
    session.phase = 'results';
    session.revoted = false; // Reset revote flag for the next round's voting if any

    const correctGuessers = Object.entries(session.votes) 
        .filter(([voter, voted]) => voter !== actualImposter && voted === actualImposter)
        .map(([voter]) => voter);
    
    console.log(`[GameManager] [GameID: ${session.gameId}] Vote tally complete. Votes: ${JSON.stringify(session.votes)}. Voted out: ${finalVotedOut}. Imposter: ${actualImposter}. Correct guessers: ${correctGuessers.join(', ')}.`);

    io.to(session.gameId).emit('votingResults', {
        votes: session.votes, // These are the valid, non-imposter votes
        imposter: actualImposter,
        votedOut: finalVotedOut, 
        correctGuessers,
        scores: session.scores,
        playerMap,
        players: session.players,
        round: session.currentRound
    });
}

function handleNextRoundReady(session, playerSlot, io) {
    if (!session) {
      console.error("[GameManager] handleNextRoundReady: Session not found.");
      return;
    }
    if (!session.readyNext) session.readyNext = new Set();
    session.readyNext.add(playerSlot);
    
    const activePlayers = session.players.filter(p => !p.disconnectedAt);
    
    console.log(`[GameManager] [GameID: ${session.gameId}] Player ${playerSlot} is ready for the next round. Total ready: ${session.readyNext.size}. Active players: ${activePlayers.length}. Total players in session: ${session.players.length}.`);

    io.to(session.gameId).emit('nextRoundStatus', Array.from(session.readyNext));

    if (activePlayers.length === 0 && session.players.length > 0) {
        console.log(`[GameManager] [GameID: ${session.gameId}] No active players to start next round. All players disconnected. Waiting or game might end.`);
        return;
    }
    
    // Check if all *active* players are ready
    const everyoneReady = activePlayers.length > 0 && activePlayers.every(p => session.readyNext.has(p.playerSlot));

    if (everyoneReady) { 
        console.log(`[GameManager] [GameID: ${session.gameId}] All active players ready. Starting next round.`);
        session.currentRound++;
        startNewRound(session, io); 
    } else {
        const notReadyActivePlayers = activePlayers.filter(p => !session.readyNext.has(p.playerSlot)).map(p => p.playerSlot);
        if (activePlayers.length > 0) { // Only log if there are active players who could become ready
            console.log(`[GameManager] [GameID: ${session.gameId}] Waiting for more active players to be ready. Pending: ${notReadyActivePlayers.join(', ')}. Total active: ${activePlayers.length}. Ready count for next round (incl. disconnected): ${session.readyNext.size}.`);
        }
        // If activePlayers.length is 0 and session.players.length is 0 (empty game), it will also fall here, which is fine.
        // If all players are disconnected (covered by the check above), it won't reach here.
    }
}

function handleEndGame(session, playerSlot, io) {
    if (!session) {
      console.error("[GameManager] handleEndGame: Session not found.");
      return false;
    }
    const host = session.players.find(p => p.isHost);
    if (!host || playerSlot !== host.playerSlot) {
        console.warn(`[GameManager] [GameID: ${session.gameId}] End game attempt by non-host ${playerSlot} or host not found.`);
        return false;
    }
    session.phase = 'final';
    console.log(`[GameManager] [GameID: ${session.gameId}] Host ${playerSlot} ended the game. Transitioning to final scores.`);
    io.to(session.gameId).emit('finalScores', {
        scores: session.scores,
        players: session.players 
    });
    return true;
}


module.exports = {
    getGameSession,
    createGameSession,
    addPlayerToSession,
    removePlayerFromSession,
    getPlayerFromSession,
    updatePlayerInSession,
    startNewRound,
    nextClueOrVoting,
    handleSubmitVote,
    handleNextRoundReady,
    handleEndGame,
    // wordPairs, // Not typically exported if only used internally
    // shuffle // Not typically exported if only used internally

    // For testing purposes
    clearGameSessions: () => {
      for (const key in gameSessions) {
        delete gameSessions[key];
      }
    }
};

// Helper function to load word pairs
function loadWordPairs() {
  const wordFile = 'allWords.json';
  let filePath = path.join(__dirname, wordFile);
  let wordPairsToReturn = [];

  try {
    const rawData = fs.readFileSync(filePath);
    const config = JSON.parse(rawData);
    if (config && config.wordPairs && Array.isArray(config.wordPairs)) {
      wordPairsToReturn = config.wordPairs;
      console.log(`[GameManager] Successfully loaded ${wordPairsToReturn.length} word pairs from ${wordFile}`);
    } else {
      console.error(`Error: ${wordFile} is missing 'wordPairs' key, is not an array, or is malformed.`);
      // No specific fallback file, will use hardcoded emergency fallback in startNewRound if this fails.
    }
  } catch (error) {
    console.error(`Error reading or parsing ${wordFile}:`, error.message);
    // No specific fallback file, will use hardcoded emergency fallback in startNewRound if this fails.
  }
  
  // If no words loaded, return empty (will be handled by emergency fallback in startNewRound)
  if (wordPairsToReturn.length === 0) {
      console.error(`[GameManager] CRITICAL: Word loading from ${wordFile} failed. Returning empty list.`);
  }
  return wordPairsToReturn;
}
