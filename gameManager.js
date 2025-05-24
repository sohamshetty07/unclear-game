// gameManager.js
const fs = require('fs');
const path = require('path');

let wordPairs = [];
try {
  const rawData = fs.readFileSync(path.join(__dirname, 'wordConfig.json'));
  const config = JSON.parse(rawData);
  if (config && config.wordPairs) {
    wordPairs = config.wordPairs;
  } else {
    console.error("Error: wordConfig.json is missing 'wordPairs' key or is malformed. Using default empty list.");
  }
} catch (error) {
  console.error("Error reading or parsing wordConfig.json:", error);
  // Fallback to an empty list or a minimal default if reading fails
  wordPairs = []; 
}

const gameSessions = {};

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
    return gameSessions[gameId]; // Return existing session
  }
  gameSessions[gameId] = {
    gameId: gameId, // Store gameId on the session object
    players: [],
    currentRound: 1,
    phase: 'waiting', // Initial phase
    playerWords: {},
    imposterSlot: '',
    turnOrder: [],
    clueIndex: 0,
    votes: {},
    scores: {},
    roundHistory: [],
    readyNext: new Set(), // Keep track of players ready for the next round
    revoted: false, // Track if a revote has occurred in the current voting phase
  };
  console.log(`[GameManager] Game created: ${gameId}`);
  return gameSessions[gameId];
}

function addPlayerToSession(session, playerDetails) {
  if (!session || !session.players) return { error: "Session not found or invalid." };

  const { playerName, playerSlot, socketId } = playerDetails; // Ensure socketId is destructured

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
      existingPlayer.socketId = socketId; // Update socketId from playerDetails
      existingPlayer.disconnectedAt = null;
      return existingPlayer; // Return updated existing player
    } else {
      // Slot is taken by a different player
      return { error: "Slot already taken by another player." };
    }
  }

  // New player
  const isHost = session.players.length === 0;
  const newPlayer = {
    ...playerDetails, // includes socketId
    playerName: trimmedPlayerName,
    playerSlot: trimmedPlayerSlot,
    isHost: isHost,
    isReady: false, // Default for new player
    hasVoted: false, // Default for new player
    disconnectedAt: null
  };

  session.players.push(newPlayer);
  if (!session.scores) session.scores = {};
  session.scores[trimmedPlayerSlot] = 0;
  return newPlayer;
}

function removePlayerFromSession(session, playerSlot) {
  if (!session || !session.players) return undefined; // Or null, as per test needs
  const playerIndex = session.players.findIndex(p => p.playerSlot === playerSlot);

  if (playerIndex === -1) {
    return undefined; // Player not found
  }

  const removedPlayer = session.players.splice(playerIndex, 1)[0]; // Remove and get the player

  // Host reassignment logic
  if (removedPlayer.isHost && session.players.length > 0) {
    session.players[0].isHost = true; // Assign host to the next player (now at index 0)
  }
  
  // Optionally, clean up scores if player is permanently removed
  // delete session.scores[playerSlot]; 

  return removedPlayer; // Return the removed player object
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
  if (!session) return;
  session.phase = 'clue';
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
  
  if (wordPairs.length === 0) {
    console.error("CRITICAL: No word pairs loaded. Cannot start round properly.");
    // Optionally, emit an error to the room or handle this state more gracefully
    // For now, we'll let it potentially pick undefined, which will show up in logs/client.
  }

  const [word, imposterWord] = wordPairs.length > 0 ? wordPairs[Math.floor(Math.random() * wordPairs.length)] : ["Error", "NoWords"];
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

  console.log(`[GameManager] Round ${session.currentRound} started for game ${session.gameId} | Imposter: ${imposterSlot}`);
}

// Function to advance to the next clue giver or to voting phase
function nextClueOrVoting(session, io) {
    if (!session || session.phase !== 'clue') return;

    session.clueIndex++;
    if (session.clueIndex < session.turnOrder.length) {
        const nextTurn = session.turnOrder[session.clueIndex];
        io.to(session.gameId).emit('nextClueTurn', nextTurn);
    } else {
        session.phase = 'voting';
        const playerMap = session.players.reduce((map, p) => {
            map[p.playerSlot] = p.playerName;
            return map;
        }, {});
        io.to(session.gameId).emit('beginVoting', {
            players: session.players,
            alreadyVoted: false, // Default, will be checked on client/reconnect
            playerMap
        });
        console.log(`[GameManager] Voting phase started for ${session.gameId}`);
    }
}

// Function to handle vote submission and tallying
function handleSubmitVote(session, voterSlot, votedSlot, io) {
    if (!session || session.phase !== 'voting') return;

    const player = getPlayerFromSession(session, voterSlot);
    if (player) player.hasVoted = true;

    // Imposter votes are not stored
    if (voterSlot !== session.imposterSlot) {
      session.votes[voterSlot] = votedSlot;
    }
    
    // Check if all players (including imposter for 'hasVoted' flag) have marked themselves as voted
    const allPlayersMarkedAsVoted = session.players.every(p => p.hasVoted);

    if (!allPlayersMarkedAsVoted) return; // Wait for all players to "submit"

    // Tally votes from non-imposters
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
    session.revoted = false;

    // Correct guessers are those non-imposters who voted for the actual imposter
    const correctGuessers = Object.entries(session.votes) 
        .filter(([voter, voted]) => voter !== actualImposter && voted === actualImposter)
        .map(([voter]) => voter);

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
    if (!session) return;
    if (!session.readyNext) session.readyNext = new Set();
    session.readyNext.add(playerSlot);

    io.to(session.gameId).emit('nextRoundStatus', Array.from(session.readyNext));

    const everyoneReady = session.players.every(p => session.readyNext.has(p.playerSlot));

    if (everyoneReady && session.players.length > 0) { // ensure players exist
        session.currentRound++;
        startNewRound(session, io); // Pass io here
    }
}

function handleEndGame(session, playerSlot, io) {
    if (!session) return false;
    const host = session.players.find(p => p.isHost);
    if (!host || playerSlot !== host.playerSlot) {
        // Optionally emit error to socket that tried to end game
        // socket.emit('errorMessage', 'Only the host can end the game.');
        return false;
    }
    session.phase = 'final';
    const playerMap = session.players.reduce((map, p) => {
        map[p.playerSlot] = p.playerName;
        return map;
    }, {});
    io.to(session.gameId).emit('showFinalScores', {
        scores: session.scores,
        playerMap
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
