const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const gameManager = require('./gameManager');

const PORT = 3000;

app.use(express.static(__dirname));
app.use('/scenes', express.static(path.join(__dirname, 'scenes')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

io.on('connection', socket => {
  console.log(`[Server] [SocketID: ${socket.id}] New user connected.`);

  socket.on('createGame', ({ gameId }) => { 
    console.log(`[Server] [SocketID: ${socket.id}] Received 'createGame' for GameID: ${gameId}.`);
    gameManager.createGameSession(gameId, io); 
    socket.join(gameId);
    // GameManager logs successful creation
  });

  socket.on('joinGame', ({ gameId, playerName, playerSlot }) => {
    console.log(`[Server] [SocketID: ${socket.id}] Received 'joinGame' for GameID: ${gameId} by Player: ${playerName} for Slot: ${playerSlot}.`);
    // Validate gameId
    if (typeof gameId !== 'string' || gameId.trim().length === 0) {
      console.warn(`[Server] [SocketID: ${socket.id}] JoinGame failed for ${playerName}: Game ID must be provided.`);
      socket.emit('errorMessage', 'Game ID must be provided.');
      return;
    }
    if (gameId.length !== 6) {
      console.warn(`[Server] [SocketID: ${socket.id}] JoinGame failed for ${playerName}: Game ID must be 6 characters long. Received: ${gameId}`);
      socket.emit('errorMessage', 'Game ID must be 6 characters long.');
      return;
    }
    if (!/^[A-Z]+$/.test(gameId)) {
      console.warn(`[Server] [SocketID: ${socket.id}] JoinGame failed for ${playerName}: Game ID must be uppercase letters only. Received: ${gameId}`);
      socket.emit('errorMessage', 'Game ID must be uppercase letters only.');
      return;
    }

    const session = gameManager.getGameSession(gameId);
    if (!session) {
      console.warn(`[Server] [SocketID: ${socket.id}] JoinGame failed for ${playerName}: Game ID ${gameId} not found.`);
      socket.emit('errorMessage', 'Game ID not found.');
      return;
    }
    
    // session.gameId = gameId; // This is already set when session is created

    const existingPlayer = gameManager.getPlayerFromSession(session, playerSlot);

    if (existingPlayer && existingPlayer.playerName === playerName) {
      // GameManager will log the reconnect details.
      // console.log(`[Server] [SocketID: ${socket.id}] Player ${playerName} (${playerSlot}) rejoining game ${gameId}. Current phase: ${session.phase}`);
      gameManager.updatePlayerInSession(session, playerSlot, { socketId: socket.id, disconnectedAt: null }); // GameManager logs this
      socket.data = { gameId, playerSlot, playerName, isHost: existingPlayer.isHost };
      socket.join(gameId);
      console.log(`[Server] [SocketID: ${socket.id}] Player ${playerName} (${playerSlot}) re-joined room ${gameId}.`);

      // Sync phase logic
      // Simplified sync logic, actual emit details depend on game state which gameManager knows best.
      // Consider a general 'syncGameState' event handled by gameManager if this gets too complex.
      console.log(`[Server] [SocketID: ${socket.id}] Syncing reconnected player ${playerName} to phase ${session.phase} in game ${gameId}.`);
      if (session.phase === 'clue') {
        socket.emit('startRound', {
          word: session.playerWords[playerSlot],
          turnOrder: session.turnOrder,
          currentClueTurn: session.turnOrder[session.clueIndex],
          round: session.currentRound
        });
      } else if (session.phase === 'voting') {
        const hasAlreadyVoted = !!session.votes[playerSlot]; // This might not be accurate if votes are cleared on phase start
        socket.emit('beginVoting', {
          players: session.players, // gameManager sends full player objects
          alreadyVoted: session.players.find(p=>p.playerSlot === playerSlot)?.hasVoted || false,
          playerMap: session.players.reduce((m, p) => { m[p.playerSlot] = p.playerName; return m; }, {})
        });
      } else if (session.phase === 'results') {
        const correctGuessers = Object.entries(session.votes).filter(([_, v]) => v === session.imposterSlot).map(([v_1]) => v_1);
        socket.emit('votingResults', {
          votes: session.votes,
          imposter: session.imposterSlot,
          votedOut: session.votedOut, 
          correctGuessers,
          scores: session.scores,
          playerMap: session.players.reduce((m, p) => { m[p.playerSlot] = p.playerName; return m; }, {}),
          players: session.players,
          round: session.currentRound
        });
      } else if (session.phase === 'final') {
        socket.emit('showFinalScores', { scores: session.scores, players: session.players });
      } else if (session.phase === 'waiting') {
        io.to(gameId).emit('playerJoined', { players: session.players, yourSocketId: socket.id });
      }
      return;
    }

    if (existingPlayer) {
      console.warn(`[Server] [SocketID: ${socket.id}] JoinGame failed for ${playerName}: Slot ${playerSlot} is already taken by ${existingPlayer.playerName}.`);
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
    const addedPlayer = addedPlayerResult; 
    
    socket.join(gameId);
    socket.data = { gameId, playerSlot, playerName, isHost: newPlayerDetails.isHost };
    console.log(`[Server] [SocketID: ${socket.id}] Player ${playerName} successfully joined room ${gameId} as ${playerSlot}.`);

    io.to(gameId).emit('playerJoined', {
      players: session.players,
      yourSocketId: socket.id
    });
    // GameManager logs successful addition
  });

  socket.on('rejoinGameCheck', ({ gameId, playerName, playerSlot }) => {
    console.log(`[Server] [SocketID: ${socket.id}] Received 'rejoinGameCheck' for GameID: ${gameId}, Player: ${playerName}, Slot: ${playerSlot}.`);
    const session = gameManager.getGameSession(gameId);

    if (!session) {
      console.warn(`[Server] [SocketID: ${socket.id}] rejoinGameCheck failed for ${playerName}: Game session ${gameId} not found.`);
      socket.emit('errorMessage', 'Game session not found. It might have ended.');
      // Optionally, instruct client to clear stored data
      socket.emit('clearPlayerState'); // Client should listen for this
      return;
    }

    const player = gameManager.getPlayerFromSession(session, playerSlot);
    if (!player || player.playerName !== playerName) {
      console.warn(`[Server] [SocketID: ${socket.id}] rejoinGameCheck failed for ${playerName}: Player not found in game ${gameId} or name mismatch.`);
      socket.emit('errorMessage', 'Player not found in this game or name mismatch.');
      socket.emit('clearPlayerState');
      return;
    }

    // Update Player's Socket ID and status
    gameManager.updatePlayerInSession(session, playerSlot, { socketId: socket.id, disconnectedAt: null });
    socket.data = { gameId, playerSlot, playerName, isHost: player.isHost };
    socket.join(gameId);
    console.log(`[Server] [SocketID: ${socket.id}] Player ${playerName} (${playerSlot}) reconnected to game ${gameId}. Syncing to phase: ${session.phase}.`);
    io.to(gameId).emit('playerReconnectedUpdate', { playerSlot, disconnected: false, playerName: player.playerName });


    let sceneName;
    let sceneData = {};

    switch (session.phase) {
      case 'waiting':
        sceneName = 'GameScene'; // Or JoinScene if GameScene is for active games
        sceneData = { players: session.players, yourSocketId: socket.id, gameId, playerSlot, playerName, isHost: player.isHost };
        // Also, emit playerJoined to the room as usual to update everyone
        io.to(gameId).emit('playerJoined', { players: session.players, yourSocketId: socket.id });
        break;
      case 'clue':
        sceneName = 'RoundScene';
        sceneData = {
          word: session.playerWords[playerSlot],
          turnOrder: session.turnOrder,
          currentClueTurn: session.turnOrder[session.clueIndex],
          round: session.currentRound,
          playerSlot,
          playerName,
          gameId,
          isHost: player.isHost,
          clues: session.clues,
          imposterName: (playerSlot === session.imposterSlot) ? "You are the Imposter!" : session.players.find(p => p.playerSlot === session.imposterSlot)?.playerName || "Unknown"
        };
        break;
      case 'voting':
        sceneName = 'VotingScene';
        const playerMapVoting = session.players.reduce((m, p) => { m[p.playerSlot] = p.playerName; return m; }, {});
        sceneData = {
          round: session.currentRound,
          votablePlayers: session.players.filter(p => p.playerSlot !== playerSlot), // Player cannot vote for themselves
          tiedPlayers: null, // This is for re-vote scenarios, usually null on initial load
          playerMap: playerMapVoting,
          alreadyVoted: session.players.find(p => p.playerSlot === playerSlot)?.hasVoted || false,
          gameId,
          playerSlot,
          playerName,
          isHost: player.isHost,
          clues: session.clues,
          imposterName: (playerSlot === session.imposterSlot) ? "You are the Imposter!" : session.players.find(p => p.playerSlot === session.imposterSlot)?.playerName || "Unknown"
        };
        break;
      case 'results':
        sceneName = 'ResultScene';
        const playerMapResults = session.players.reduce((m, p) => { m[p.playerSlot] = p.playerName; return m; }, {});
        const correctGuessers = Object.entries(session.votes).filter(([_, v]) => v === session.imposterSlot).map(([v_1]) => v_1);
        sceneData = {
          round: session.currentRound,
          votes: session.votes,
          imposter: session.imposterSlot,
          correctGuessers,
          scores: session.scores,
          playerMap: playerMapResults,
          players: session.players,
          votedOut: session.votedOut,
          isHost: player.isHost,
          gameId,
          playerSlot,
          playerName,
          imposterName: session.players.find(p => p.playerSlot === session.imposterSlot)?.playerName || "Unknown",
          playerWord: session.playerWords[playerSlot]
        };
        break;
      case 'final':
        sceneName = 'FinalScoreScene';
        sceneData = {
          scores: session.scores,
          players: session.players,
          gameId,
          playerSlot,
          playerName,
          isHost: player.isHost
        };
        break;
      default:
        // e.g. game not started, or an unknown phase
        sceneName = 'JoinScene'; // Or LandingScene if preferred
        sceneData = { gameId }; // Or minimal data
        console.warn(`[Server] [SocketID: ${socket.id}] Player ${playerName} in game ${gameId} is in unexpected phase '${session.phase}', sending to JoinScene.`);
        break;
    }

    socket.emit('syncToScene', { sceneName, sceneData });
  });

  socket.on('toggleReady', ({ gameId, playerSlot, isReady }) => {
    console.log(`[Server] [SocketID: ${socket.id}] Received 'toggleReady' for GameID: ${gameId}, Player: ${playerSlot}, Ready: ${isReady}.`);
    const session = gameManager.getGameSession(gameId);
    if (!session) {
      console.warn(`[Server] [SocketID: ${socket.id}] 'toggleReady' failed: Session ${gameId} not found.`);
      return;
    }
    gameManager.updatePlayerInSession(session, playerSlot, { isReady });
    io.to(gameId).emit('playerJoined', { players: session.players, yourSocketId: socket.id });
  });

  socket.on('startGame', gameId => {
    console.log(`[Server] [SocketID: ${socket.id}] Received 'startGame' for GameID: ${gameId}. Attempting by ${socket.data.playerSlot}.`);
    const session = gameManager.getGameSession(gameId);
    if (!session) {
      console.warn(`[Server] [SocketID: ${socket.id}] 'startGame' failed: Session ${gameId} not found.`);
      return;
    }
    const host = session.players.find(p => p.isHost);
    const allReady = session.players.length > 0 && session.players.every(p => p.isReady);

    if (!host || !allReady || socket.data.playerSlot !== host.playerSlot) {
      console.warn(`[Server] [SocketID: ${socket.id}] 'startGame' for GameID: ${gameId} denied. Host: ${host?.playerSlot}, AllReady: ${allReady}, Requester: ${socket.data.playerSlot}.`);
      socket.emit('errorMessage', 'Only the host can start when all players are ready.');
      return;
    }
    session.currentRound = 1; 
    gameManager.startNewRound(session, io); // GameManager logs round start
  });

  socket.on('nextClue', gameId => {
    console.log(`[Server] [SocketID: ${socket.id}] Received 'nextClue' for GameID: ${gameId}. Player: ${socket.data.playerSlot}.`);
    const session = gameManager.getGameSession(gameId);
    if (!session) {
      console.warn(`[Server] [SocketID: ${socket.id}] 'nextClue' failed: Session ${gameId} not found.`);
      return;
    }
    // Add check: only current turn player can advance
    if (session.turnOrder && session.turnOrder[session.clueIndex] !== socket.data.playerSlot) {
        console.warn(`[Server] [SocketID: ${socket.id}] 'nextClue' for GameID: ${gameId} denied. Not ${socket.data.playerSlot}'s turn.`);
        socket.emit('errorMessage', "It's not your turn to advance.");
        return;
    }
    gameManager.nextClueOrVoting(session, io);
  });

  socket.on('requestPlayerList', gameId => {
    console.log(`[Server] [SocketID: ${socket.id}] Received 'requestPlayerList' for GameID: ${gameId}.`);
    const session = gameManager.getGameSession(gameId);
    socket.emit('playerJoined', {
      players: session ? session.players : [],
      yourSocketId: socket.id
    });
  });
  
  socket.on('submitVote', ({ gameId, voter, voted }) => {
    console.log(`[Server] [SocketID: ${socket.id}] Received 'submitVote' for GameID: ${gameId}. Voter: ${voter}, Voted for: ${voted}.`);
    const session = gameManager.getGameSession(gameId);
    if (!session) {
      console.warn(`[Server] [SocketID: ${socket.id}] 'submitVote' failed: Session ${gameId} not found.`);
      return;
    }
    gameManager.handleSubmitVote(session, voter, voted, io);
  });

  socket.on('nextRoundReady', ({ gameId, playerSlot }) => {
    console.log(`[Server] [SocketID: ${socket.id}] Received 'nextRoundReady' for GameID: ${gameId}, Player: ${playerSlot}.`);
    const session = gameManager.getGameSession(gameId);
    if (!session) {
      console.warn(`[Server] [SocketID: ${socket.id}] 'nextRoundReady' failed: Session ${gameId} not found.`);
      return;
    }
    gameManager.handleNextRoundReady(session, playerSlot, io);
  });

  socket.on('endGame', gameId => {
    console.log(`[Server] [SocketID: ${socket.id}] Received 'endGame' for GameID: ${gameId}. Attempting by ${socket.data.playerSlot}.`);
    const session = gameManager.getGameSession(gameId);
    if (!session) {
      console.warn(`[Server] [SocketID: ${socket.id}] 'endGame' failed: Session ${gameId} not found.`);
      socket.emit('errorMessage', 'Game not found.'); // Send error to client
      return;
    }
    if(!gameManager.handleEndGame(session, socket.data.playerSlot, io)) {
        console.warn(`[Server] [SocketID: ${socket.id}] 'endGame' for GameID: ${gameId} denied by gameManager logic (e.g. not host).`);
        socket.emit('errorMessage', 'Only the host can end the game, or game not found.');
    }
    // GameManager logs successful end
  });

  socket.on('disconnect', () => {
    console.log(`[Server] [SocketID: ${socket.id}] User disconnected.`);
    const { gameId, playerSlot } = socket.data || {};
    if (!gameId || !playerSlot) {
        console.log(`[Server] [SocketID: ${socket.id}] Disconnected user was not in a game session.`);
        return;
    }

    const session = gameManager.getGameSession(gameId);
    if (!session) {
        console.warn(`[Server] [SocketID: ${socket.id}] Session ${gameId} not found for disconnected player ${playerSlot}.`);
        return;
    }

    const player = gameManager.getPlayerFromSession(session, playerSlot);
    if (!player) {
        console.warn(`[Server] [SocketID: ${socket.id}] Player ${playerSlot} not found in session ${gameId} for disconnection handling.`);
        return;
    }
    
    console.log(`[Server] [SocketID: ${socket.id}] Player ${player.playerName} (${playerSlot}) from game ${gameId} disconnected. Marking for potential removal.`);
    gameManager.updatePlayerInSession(session, playerSlot, { disconnectedAt: Date.now() });
    io.to(gameId).emit('playerDisconnectedUpdate', { playerSlot, disconnected: true });

    setTimeout(() => {
      const currentSessionState = gameManager.getGameSession(gameId);
      if (!currentSessionState) {
        console.log(`[Server] [GameID: ${gameId}] Session no longer exists after disconnect timeout for player ${playerSlot}.`);
        return; 
      }
      
      const playerStillInSession = gameManager.getPlayerFromSession(currentSessionState, playerSlot);
      
      if (playerStillInSession && playerStillInSession.disconnectedAt && 
          (Date.now() - playerStillInSession.disconnectedAt >= 5000)) {
          
          if (playerStillInSession.socketId === socket.id) {
            console.log(`[Server] [GameID: ${gameId}] Removing player ${playerStillInSession.playerName} (${playerSlot}) due to disconnect timeout.`);
            gameManager.removePlayerFromSession(currentSessionState, playerSlot); // GameManager logs removal

            io.to(gameId).emit('playerJoined', { 
              players: currentSessionState.players,
              yourSocketId: null 
            });

            if (currentSessionState.players.length === 0) {
              console.log(`[Server] [GameID: ${gameId}] Session is now empty after player removal.`);
              // GameManager might handle deletion of empty sessions if configured.
            }
          } else {
            console.log(`[Server] [GameID: ${gameId}] Player ${playerStillInSession.playerName} reconnected with new socket. No removal for old socket ${socket.id}.`);
          }
      }
    }, 5100); 
  });
});

http.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}`);
});