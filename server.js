const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = 3000;
const gameSessions = {};

const wordPairs = [
  ['Apple', 'Orange'], ['Cat', 'Dog'], ['Beach', 'Desert'], ['Teacher', 'Professor'],
  ['Plane', 'Helicopter'], ['Milk', 'Yogurt'], ['Table', 'Chair'], ['Pizza', 'Burger'],
  ['Mountain', 'Hill'], ['River', 'Stream'], ['Phone', 'Tablet'], ['Sun', 'Moon'],
  ['Rain', 'Snow'], ['Tea', 'Coffee'], ['Lion', 'Tiger'], ['Pen', 'Pencil'],
  ['Shirt', 'Jacket'], ['School', 'College'], ['Bus', 'Train'], ['Butter', 'Cheese'],
  ['Glass', 'Cup'], ['Laptop', 'Desktop'], ['Mirror', 'Window'], ['Knife', 'Scissors'],
  ['Foot', 'Hand'], ['Book', 'Magazine'], ['Camera', 'Binoculars'], ['Boat', 'Ship'],
  ['Ice', 'Water'], ['Clock', 'Watch']
];

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function startNewRound(session) {
  session.phase = 'clue';
  session.votes = {};
  session.revoted = false;

  // ✅ Reset voting state
  session.players.forEach(p => {
    p.hasVoted = false;
  });

  session.readyNext = new Set();
  session.turnOrder = shuffle(session.players.map(p => p.playerSlot));

  let imposterSlot;
  do {
    imposterSlot = session.turnOrder[Math.floor(Math.random() * session.turnOrder.length)];
  } while (session.turnOrder[0] === imposterSlot);

  const [word, imposterWord] = wordPairs[Math.floor(Math.random() * wordPairs.length)];
  const playerWords = {};
  session.players.forEach(p => {
    playerWords[p.playerSlot] = (p.playerSlot === imposterSlot) ? imposterWord : word;
  });

  session.imposterSlot = imposterSlot;
  session.playerWords = playerWords;
  session.clueIndex = 0;

  session.players.forEach(p => {
    io.to(p.socketId).emit('startRound', {
      word: playerWords[p.playerSlot],
      turnOrder: session.turnOrder,
      currentClueTurn: session.turnOrder[0],
      round: session.currentRound
    });
  });

  console.log(`🌀 Round ${session.currentRound} started | Imposter: ${imposterSlot}`);
}

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('createGame', gameId => {
    gameSessions[gameId] = {
      players: [],
      currentRound: 1,
      phase: 'waiting',
      playerWords: {},
      imposterSlot: '',
      turnOrder: [],
      clueIndex: 0,
      votes: {},
      scores: {},
      roundHistory: []
    };
    socket.join(gameId);
    console.log(`Game created: ${gameId}`);
  });

  socket.on('joinGame', ({ gameId, playerName, playerSlot }) => {
    const session = gameSessions[gameId];
    if (!session) {
      socket.emit('errorMessage', 'Game ID not found');
      return;
    }

    const existing = session.players.find(p => p.playerSlot === playerSlot);
    console.log(`[DEBUG] Looking for ${playerSlot} in session.players`);
    console.log('All players in session:', session.players);

    if (existing) {
      console.log(`[DEBUG] Found existing slot match:`, existing);
    } else {
      console.log(`[DEBUG] No playerSlot match found for`, playerSlot);
    }

    // ✅ Case 1: Reconnect (same name and slot)
    if (existing && existing.playerName === playerName) {
      console.log(`[RECONNECT] ${playerName} (${playerSlot}) rejoining game ${gameId} | Current phase: ${session.phase}`);
      existing.socketId = socket.id;
      socket.data = { gameId, playerSlot, playerName, isHost: existing.isHost };
      socket.join(gameId);

      // Sync phase
      if (session.phase === 'clue') {
        socket.emit('startRound', {
          word: session.playerWords[playerSlot],
          turnOrder: session.turnOrder,
          currentClueTurn: session.turnOrder[session.clueIndex],
          round: session.currentRound
        });
      } else if (session.phase === 'voting') {
        const hasAlreadyVoted = !!session.votes[playerSlot];
        socket.emit('beginVoting', {
          players: session.players,
          alreadyVoted: hasAlreadyVoted,
          playerMap: session.players.reduce((m, p) => {
            m[p.playerSlot] = p.playerName;
            return m;
          }, {})
        });
      } else if (session.phase === 'results') {
        const correctGuessers = Object.entries(session.votes)
          .filter(([_, v]) => v === session.imposterSlot)
          .map(([v]) => v);
        socket.emit('votingResults', {
          votes: session.votes,
          imposter: session.imposterSlot,
          correctGuessers,
          scores: session.scores,
          playerMap: session.players.reduce((m, p) => {
            m[p.playerSlot] = p.playerName;
            return m;
          }, {}),
          players: session.players,
          round: session.currentRound
        });
      } else if (session.phase === 'final') {
        socket.emit('showFinalScores', {
          scores: session.scores,
          playerMap: session.players.reduce((m, p) => {
            m[p.playerSlot] = p.playerName;
            return m;
          }, {})
        });
      } else if (session.phase === 'waiting') {
        // We're in the lobby — just re-send player list so JoinScene can resume
        io.to(gameId).emit('playerJoined', {
          players: session.players,
          yourSocketId: socket.id
        });
      }
    
      return;
    }

    // ❌ Case 2: Someone trying to steal a taken slot
    if (existing) {
      socket.emit('errorMessage', `Slot ${playerSlot} is already taken! Please choose a different one.`);
      return;
    }

    // ✅ Case 3: New player (slot is free)
    const isFirst = session.players.length === 0;
    const newPlayer = {
      playerName,
      playerSlot,
      isHost: isFirst,
      isReady: false,
      socketId: socket.id
    };

    session.players.push(newPlayer);
    session.scores[playerSlot] = 0;
    socket.join(gameId);
    socket.data = { gameId, playerSlot, playerName, isHost: isFirst };

    io.to(gameId).emit('playerJoined', {
      players: session.players,
      yourSocketId: socket.id
    });

    console.log(`${playerName} joined ${gameId} as ${playerSlot}`);
  });

  socket.on('toggleReady', ({ gameId, playerSlot, isReady }) => {
    const session = gameSessions[gameId];
    if (!session) return;

    const player = session.players.find(p => p.playerSlot === playerSlot);
    if (player) {
      player.isReady = isReady;
      io.to(gameId).emit('playerJoined', {
        players: session.players,
        yourSocketId: socket.id
      });
      console.log(`${player.playerName} toggled ready: ${isReady}`);
    }
  });

  socket.on('startGame', gameId => {
    const session = gameSessions[gameId];
    if (!session) return;

    const players = session.players;
    const host = players.find(p => p.isHost);
    const allReady = players.length > 0 && players.every(p => p.isReady);

    if (!host || !allReady || socket.data.playerSlot !== host.playerSlot) {
      socket.emit('errorMessage', 'Only the host can start when all players are ready.');
      return;
    }

    session.currentRound = 1;
    startNewRound(session);
  });

  socket.on('nextClue', gameId => {
    const session = gameSessions[gameId];
    if (!session || session.phase !== 'clue') return;

    session.clueIndex++;
    if (session.clueIndex < session.turnOrder.length) {
      const nextTurn = session.turnOrder[session.clueIndex];
      io.to(gameId).emit('nextClueTurn', nextTurn);
    } else {
      session.phase = 'voting';
      io.to(gameId).emit('beginVoting', {
         players: session.players,
         alreadyVoted: false, // by default; on reconnect this is overridden
         playerMap: session.players.reduce((map, p) => {
          map[p.playerSlot] = p.playerName;
          return map;
        }, {})
      });
      console.log(`🗳️ Voting phase started for ${gameId}`);
    }
  });

  socket.on('requestPlayerList', gameId => {
    const players = gameSessions[gameId]?.players || [];
    socket.emit('playerJoined', {
      players,
      yourSocketId: socket.id
    });
  });
  
  socket.on('submitVote', ({ gameId, voter, voted }) => {
    const session = gameSessions[gameId];
    if (!session || session.phase !== 'voting') return;

    // Only count votes from non-imposters
    if (voter !== session.imposterSlot) {
      session.votes[voter] = voted;
    }

    // ✅ Track that this player clicked "Submit Vote"
    const player = session.players.find(p => p.playerSlot === voter);
    if (player) player.hasVoted = true;

    const nonImposters = session.players.filter(p => p.playerSlot !== session.imposterSlot);
    const allVotesIn = Object.keys(session.votes).length === nonImposters.length;
    const everyoneClicked = session.players.every(p => p.hasVoted);

    if (!(allVotesIn && everyoneClicked)) return;

    // ✅ Clean invalid votes before counting
    const validSlots = session.players.map(p => p.playerSlot);
    Object.keys(session.votes).forEach(voter => {
      const votedFor = session.votes[voter];
      if (!validSlots.includes(votedFor)) {
        delete session.votes[voter]; // remove bad vote
      }
    });

    const voteCounts = {};
    Object.values(session.votes).forEach(votedFor => {
      voteCounts[votedFor] = (voteCounts[votedFor] || 0) + 1;
    });

    const maxVotes = Math.max(...Object.values(voteCounts));
    const topVoted = Object.entries(voteCounts)
      .filter(([_, count]) => count === maxVotes)
      .map(([slot]) => slot);

    const playerMap = session.players.reduce((map, p) => {
      map[p.playerSlot] = p.playerName;
      return map;
    }, {});

    let finalVotedImposter;
    if (topVoted.length === 1) {
      finalVotedImposter = topVoted[0];
    } else if (!session.revoted) {
      session.revoted = true;
      session.votes = {};
      io.to(gameId).emit('revote', { tiedPlayers: topVoted });
      return;
    } else {
      finalVotedImposter = topVoted[Math.floor(Math.random() * topVoted.length)];
    }

    const actualImposter = session.imposterSlot;
    
    // Initialize all scores
    session.players.forEach(p => {
      session.scores[p.playerSlot] = session.scores[p.playerSlot] || 0;
    });

    // Apply scoring logic
    Object.entries(session.votes).forEach(([voter, voted]) => {
      if (voted === actualImposter) {
        session.scores[voter] += 1; // Correct guess
      } else {
        session.scores[actualImposter] += 1; // Wrong guess → Imposter rewarded
      }
    });

    session.phase = 'results';
    session.revoted = false;

    const correctGuessers = Object.entries(session.votes)
      .filter(([_, voted]) => voted === actualImposter)
      .map(([voter]) => voter);

    io.to(gameId).emit('votingResults', {
      votes: session.votes,
      imposter: session.imposterSlot,
      correctGuessers,
      scores: session.scores,
      playerMap,
      players: session.players,
      round: session.currentRound
    });
  });

  socket.on('nextRoundReady', ({ gameId, playerSlot }) => {
    const session = gameSessions[gameId];
    if (!session) return;

    if (!session.readyNext) session.readyNext = new Set();
    session.readyNext.add(playerSlot);

    io.to(gameId).emit('nextRoundStatus', Array.from(session.readyNext));

    const everyoneReady = session.players.every(p =>
      session.readyNext.has(p.playerSlot)
    );

    if (everyoneReady) {
      session.currentRound += 1;
      startNewRound(session);
    }
  });

  socket.on('endGame', gameId => {
    const session = gameSessions[gameId];
    if (!session) return;

    const host = session.players.find(p => p.isHost);
    if (!host || socket.data.playerSlot !== host.playerSlot) {
      socket.emit('errorMessage', 'Only the host can end the game.');
      return;
    }

    session.phase = 'final';

    const playerMap = session.players.reduce((map, p) => {
      map[p.playerSlot] = p.playerName;
      return map;
    }, {});

    io.to(gameId).emit('showFinalScores', {
      scores: session.scores,
      playerMap
    });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Disconnected: ${socket.id}`);

    const { gameId, playerSlot } = socket.data || {};
    if (!gameId || !playerSlot) return;

    const session = gameSessions[gameId];
    if (!session) return;

    const player = session.players.find(p => p.playerSlot === playerSlot);
    if (!player) return;

    // Mark the time of disconnect
    player.disconnectedAt = Date.now();

    // Wait 5 seconds to allow rejoin
    setTimeout(() => {
      const stillDisconnected = Date.now() - (player.disconnectedAt || 0) >= 5000;
      const stillInGame = session.players.find(p => p.playerSlot === playerSlot && p.socketId === socket.id);
 
      if (stillDisconnected && stillInGame) {
        console.log(`⛔ Removing ghost player: ${player.playerName} (${playerSlot})`);
        session.players = session.players.filter(p => p.playerSlot !== playerSlot);

       // Update player list for everyone
        io.to(gameId).emit('playerJoined', {
          players: session.players,
          yourSocketId: null
        });

        // Optional: clean up if session is empty
        if (session.players.length === 0) {
          delete gameSessions[gameId];
          console.log(`🗑️ Deleted empty game session: ${gameId}`);
        }
      }
    }, 5000);
  });
});


http.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}`);
});