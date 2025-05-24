const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const gameManager = require('./gameManager');

const PORT = 3000;

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('createGame', gameId => {
    gameManager.createGameSession(gameId, io);
    socket.join(gameId);
    // console.log(`Game created: ${gameId}`); // Log is in gameManager
  });

  socket.on('joinGame', ({ gameId, playerName, playerSlot }) => {
    // Validate gameId
    if (typeof gameId !== 'string' || gameId.trim().length === 0) {
      socket.emit('errorMessage', 'Game ID must be provided.');
      return;
    }
    if (gameId.length !== 6) {
      socket.emit('errorMessage', 'Game ID must be 6 characters long.');
      return;
    }
    if (!/^[A-Z]+$/.test(gameId)) {
      socket.emit('errorMessage', 'Game ID must be uppercase letters only.');
      return;
    }

    const session = gameManager.getGameSession(gameId);
    if (!session) {
      socket.emit('errorMessage', 'Game ID not found.');
      return;
    }
    
    session.gameId = gameId; // Ensure session has a gameId property for later use if needed

    const existingPlayer = gameManager.getPlayerFromSession(session, playerSlot);

    if (existingPlayer && existingPlayer.playerName === playerName) {
      console.log(`[RECONNECT] ${playerName} (${playerSlot}) rejoining game ${gameId} | Current phase: ${session.phase}`);
      gameManager.updatePlayerInSession(session, playerSlot, { socketId: socket.id, disconnectedAt: null });
      socket.data = { gameId, playerSlot, playerName, isHost: existingPlayer.isHost };
      socket.join(gameId);

      // Sync phase logic (remains largely the same but uses session from gameManager)
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
          votedOut: session.votedOut, // Assuming votedOut is set in session after voting
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
        io.to(gameId).emit('playerJoined', {
          players: session.players,
          yourSocketId: socket.id
        });
      }
      return;
    }

    if (existingPlayer) {
      socket.emit('errorMessage', `Slot ${playerSlot} is already taken! Please choose a different one.`);
      return;
    }

    const isFirst = session.players.length === 0;
    const newPlayerDetails = {
      playerName,
      playerSlot,
      isHost: isFirst,
      isReady: false,
      socketId: socket.id,
      hasVoted: false, // Initialize hasVoted status
    };

    const addedPlayerResult = gameManager.addPlayerToSession(session, newPlayerDetails);
    if (addedPlayerResult && addedPlayerResult.error) {
        socket.emit('errorMessage', addedPlayerResult.error);
        return;
    }
    // Assuming success if no error, addedPlayerResult is the player object
    const addedPlayer = addedPlayerResult; 
    
    socket.join(gameId);
    socket.data = { gameId, playerSlot, playerName, isHost: newPlayerDetails.isHost };

    io.to(gameId).emit('playerJoined', {
      players: session.players,
      yourSocketId: socket.id
    });
    console.log(`${playerName} joined ${gameId} as ${playerSlot}`);
  });

  socket.on('toggleReady', ({ gameId, playerSlot, isReady }) => {
    const session = gameManager.getGameSession(gameId);
    if (!session) return;

    gameManager.updatePlayerInSession(session, playerSlot, { isReady });
    io.to(gameId).emit('playerJoined', { // Send updated player list
      players: session.players,
      yourSocketId: socket.id // Not strictly necessary here but good for consistency
    });
    // console.log(`${playerName} toggled ready: ${isReady}`); // playerName not available here
  });

  socket.on('startGame', gameId => {
    const session = gameManager.getGameSession(gameId);
    if (!session) return;

    const host = session.players.find(p => p.isHost);
    const allReady = session.players.length > 0 && session.players.every(p => p.isReady);

    if (!host || !allReady || socket.data.playerSlot !== host.playerSlot) {
      socket.emit('errorMessage', 'Only the host can start when all players are ready.');
      return;
    }
    session.currentRound = 1; // Initialize round number
    gameManager.startNewRound(session, io);
  });

  socket.on('nextClue', gameId => {
    const session = gameManager.getGameSession(gameId);
    gameManager.nextClueOrVoting(session, io);
  });

  socket.on('requestPlayerList', gameId => {
    const session = gameManager.getGameSession(gameId);
    socket.emit('playerJoined', {
      players: session ? session.players : [],
      yourSocketId: socket.id
    });
  });
  
  socket.on('submitVote', ({ gameId, voter, voted }) => {
    const session = gameManager.getGameSession(gameId);
    gameManager.handleSubmitVote(session, voter, voted, io);
  });

  socket.on('nextRoundReady', ({ gameId, playerSlot }) => {
    const session = gameManager.getGameSession(gameId);
    gameManager.handleNextRoundReady(session, playerSlot, io);
  });

  socket.on('endGame', gameId => {
    const session = gameManager.getGameSession(gameId);
    if(gameManager.handleEndGame(session, socket.data.playerSlot, io)) {
        // Successfully ended
    } else {
        socket.emit('errorMessage', 'Only the host can end the game, or game not found.');
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Disconnected: ${socket.id}`);
    const { gameId, playerSlot } = socket.data || {};
    if (!gameId || !playerSlot) return;

    const session = gameManager.getGameSession(gameId);
    if (!session) return;

    const player = gameManager.getPlayerFromSession(session, playerSlot);
    if (!player) return;
    
    // Mark player as disconnected immediately for visual feedback or quick rejoin logic
    gameManager.updatePlayerInSession(session, playerSlot, { disconnectedAt: Date.now() });
    console.log(`Player ${player.playerName} marked as disconnected.`);
    io.to(gameId).emit('playerDisconnectedUpdate', { playerSlot, disconnected: true });


    setTimeout(() => {
      const currentSessionState = gameManager.getGameSession(gameId);
      if (!currentSessionState) return; // Session might have been cleaned up
      
      const playerStillInSession = gameManager.getPlayerFromSession(currentSessionState, playerSlot);
      
      // Check if player has reconnected (disconnectedAt is null) or if the socket ID is different
      // and if enough time has passed.
      if (playerStillInSession && playerStillInSession.disconnectedAt && 
          (Date.now() - playerStillInSession.disconnectedAt >= 5000)) {
          
          // Check if the player object is still associated with the disconnected socket
          if (playerStillInSession.socketId === socket.id) {
            console.log(`⛔ Removing player due to timeout: ${playerStillInSession.playerName} (${playerSlot})`);
            gameManager.removePlayerFromSession(currentSessionState, playerSlot);

            io.to(gameId).emit('playerJoined', { // Use 'playerJoined' to refresh the list
              players: currentSessionState.players,
              yourSocketId: null 
            });

            if (currentSessionState.players.length === 0) {
              // delete gameSessions[gameId]; // This was the old way
              // Game manager should handle session deletion if needed, or maybe sessions persist empty.
              // For now, let's assume gameManager handles this internally or has a separate cleanup.
              console.log(`🗑️ Game session ${gameId} is now empty.`);
              // Consider deleting the session from gameSessions if gameManager doesn't do it.
              // delete gameManager.gameSessions[gameId]; // Direct modification - avoid if possible
            }
          } else {
            console.log(`Player ${playerStillInSession.playerName} reconnected with new socket. No removal needed for old socket ${socket.id}.`);
          }
      }
    }, 5100); // Slightly more than 5s to avoid race conditions
  });
});

http.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}`);
});