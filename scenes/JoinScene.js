class JoinScene extends Phaser.Scene {
  constructor() {
    super('JoinScene');
  }

  init() {
    // this.selectedDifficulty = data.difficulty || 'easy'; // Store difficulty from LandingScene
    // console.log('JoinScene received difficulty:', this.selectedDifficulty);
  }

  create() {
    const scene = this;
    const storedGameId = sessionStorage.getItem('gameId');
    const storedPlayerName = sessionStorage.getItem('playerName');
    const storedPlayerSlot = sessionStorage.getItem('playerSlot');

    // Define event handlers as arrow function properties for correct `this` binding
    // and easy removal in shutdown(). `scene` variable is used for clarity in callbacks.
    const scene = this;

    this.handlePlayerJoined = ({ players, yourSocketId: id }) => {
      if (!scene.scene.isActive()) {
        console.log('[JoinScene] playerJoined event received, but scene is not active. Ignoring.');
        return;
      }
      yourSocketId = id; // Update global `yourSocketId`
      
      // Check if the current player (defined by playerName and playerSlot) is in the list
      const me = players.find(p => p.playerName === playerName && p.playerSlot === playerSlot);

      if (me) {
        updatePlayerBanner(); // Update the banner with player info
        
        // If NOT in reconnect flow (i.e., fresh join), then transition to GameScene.
        // The reconnect flow relies on other specific sync events (startRound, beginVoting etc.)
        // to determine the correct scene to transition to.
        if (!(storedGameId && storedPlayerName && storedPlayerSlot)) {
          console.log('[JoinScene] playerJoined (new join flow) - transitioning to GameScene.');
          socket.emit('syncRequest', { gameId, playerSlot }); // Request full game state
          scene.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
            if (progress === 1) {
              if (!scene.scene.isActive()) {
                console.log('[JoinScene] playerJoined fadeOut complete, but scene is not active. Ignoring scene start.');
                return;
              }
              console.log("PLAY_SOUND: transition.mp3");
              scene.scene.start('GameScene');
            }
          });
        } else {
          // In reconnect flow, playerJoined just confirms the player is part of the game.
          // Banner is updated. Scene transition will be handled by startRound, beginVoting etc.
          console.log('[JoinScene] playerJoined (reconnect flow) - banner updated. Waiting for specific sync event for scene transition.');
        }
      } else {
        // This case should ideally not happen if server logic is correct
        console.warn('[JoinScene] playerJoined event received, but current player not in the list.');
      }
    };

    this.handleStartRound = ({ word, turnOrder, currentClueTurn, round }) => {
      if (!scene.scene.isActive()) {
        console.log('[JoinScene] startRound event received, but scene is not active. Ignoring.');
        return;
      }
      console.log('[JoinScene] received startRound. Transitioning to RoundScene.');
      scene.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          if (!scene.scene.isActive()) {
            console.log('[JoinScene] startRound fadeOut complete, but scene is not active. Ignoring scene start.');
            return;
          }
          console.log("PLAY_SOUND: transition.mp3");
          scene.scene.stop();
          scene.scene.start('RoundScene', { word, turnOrder, currentClueTurn, round });
        }
      });
    };

    this.handleBeginVoting = ({ players, alreadyVoted, playerMap }) => {
      if (!scene.scene.isActive()) {
        console.log('[JoinScene] beginVoting event received, but scene is not active. Ignoring.');
        return;
      }
      console.log('[JoinScene] received beginVoting. Transitioning to VotingScene.');
      const others = players.filter(p => p.playerSlot !== playerSlot); // Ensure playerSlot is accessible
      scene.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          if (!scene.scene.isActive()) {
            console.log('[JoinScene] beginVoting fadeOut complete, but scene is not active. Ignoring scene start.');
            return;
          }
          console.log("PLAY_SOUND: transition.mp3");
          scene.scene.stop();
          scene.scene.start('VotingScene', {
            round: 1, // Assuming round 1, may need adjustment based on game state (e.g. pass actual round)
            votablePlayers: others,
            alreadyVoted,
            playerMap
          });
        }
      });
    };

    this.handleVotingResults = (data) => {
      if (!scene.scene.isActive()) {
        console.log('[JoinScene] votingResults event received, but scene is not active. Ignoring.');
        return;
      }
      console.log('[JoinScene] received votingResults. Transitioning to ResultScene.');
      scene.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          if (!scene.scene.isActive()) {
            console.log('[JoinScene] votingResults fadeOut complete, but scene is not active. Ignoring scene start.');
            return;
          }
          console.log("PLAY_SOUND: transition.mp3");
          scene.scene.stop();
          scene.scene.start('ResultScene', data);
        }
      });
    };

    this.handleShowFinalScores = (data) => {
      if (!scene.scene.isActive()) {
        console.log('[JoinScene] showFinalScores event received, but scene is not active. Ignoring.');
        return;
      }
      console.log('[JoinScene] received showFinalScores. Transitioning to FinalScoreScene.');
      scene.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          if (!scene.scene.isActive()) {
            console.log('[JoinScene] showFinalScores fadeOut complete, but scene is not active. Ignoring scene start.');
            return;
          }
          console.log("PLAY_SOUND: transition.mp3");
          scene.scene.stop();
          scene.scene.start('FinalScoreScene', data);
        }
      });
    };

    this.handleErrorMessage = (msg) => {
      // Error messages might be important even if the scene is transitioning.
      // No direct scene manipulation here, so isActive check is less critical for this specific handler's core action.
      console.log(`[JoinScene] errorMessage: ${msg}`);
      alert(msg); // Consider a more robust in-game notification system for later.
    };
    
    // Attach ALL listeners regardless of reconnect or new join.
    // The logic within handlers (especially handlePlayerJoined) will differentiate behavior.
    socket.on('playerJoined', this.handlePlayerJoined);
    socket.on('startRound', this.handleStartRound);
    socket.on('beginVoting', this.handleBeginVoting);
    socket.on('votingResults', this.handleVotingResults);
    socket.on('showFinalScores', this.handleShowFinalScores);
    socket.on('errorMessage', this.handleErrorMessage);
    
    this.cameras.main.fadeIn(300, 0, 0, 0); 

    if (storedGameId && storedPlayerName && storedPlayerSlot) {
      console.log('[JoinScene] Reconnect flow: Attempting to rejoin game.');
      gameId = storedGameId;
      playerName = storedPlayerName;
      playerSlot = storedPlayerSlot;
      // Emit joinGame for reconnect. Server will send appropriate sync events.
      socket.emit('joinGame', { gameId, playerName, playerSlot });
      // Note: No 'return' here. UI for joining/hosting will be set up,
      // but it will be quickly overlaid or replaced if reconnect is successful and a sync event arrives.
      // This is acceptable as the main purpose of reconnect is to get back into the game state.
    } else {
      console.log('[JoinScene] New join/host flow.');
    }

    // UI Setup for new join/host (will also be visible briefly during reconnect before sync)
    this.cameras.main.setBackgroundColor('#F5F5F5');
    this.add.text(180, 50, 'Join or Host Game', { // Adjusted Y
      fontFamily: 'Roboto',
      fontSize: '24px',
      color: 'var(--text-color)',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    const gameIdInput = this.add.dom(180, 120, 'input', { // Adjusted Y
      type: 'text',
      fontSize: '16px',
      fontFamily: 'Roboto',
      width: '280px', // Adjusted width
      padding: '10px',
      border: '1px solid var(--secondary-accent-color)',
      borderRadius: '5px'
    });
    gameIdInput.node.placeholder = 'Game ID (leave blank to host)';

    const nameInput = this.add.dom(180, 180, 'input', { // Adjusted Y
      type: 'text',
      fontSize: '16px',
      fontFamily: 'Roboto',
      width: '280px', // Adjusted width
      padding: '10px',
      border: '1px solid var(--secondary-accent-color)',
      borderRadius: '5px'
    });
    nameInput.node.placeholder = 'Your Name';

    const dropdownHTML = `
      <select id="playerSlot" style="font-size:16px; width:280px; padding: 10px; border-radius: 5px; border: 1px solid var(--secondary-accent-color); font-family: Roboto;">
        <option value="">Select Player Slot</option>
        ${[...Array(12).keys()].map(i =>
          `<option value="Player ${i + 1}">Player ${i + 1}</option>`
        ).join('')}
      </select>`;
    this.add.dom(180, 240).createFromHTML(dropdownHTML); // Adjusted Y

    const joinBtn = this.add.dom(180, 320, 'button', null, 'Join Game').setClassName('button'); // Adjusted Y
    joinBtn.node.style.transform = 'scale(0.8)'; // Initial scale for pop-in

    this.tweens.add({
      targets: joinBtn.node,
      scale: 1,
      ease: 'Back.easeOut',
      duration: 300,
      delay: 200 // Delay slightly after scene fades in
    });

    joinBtn.addListener('click');
    joinBtn.on('click', () => {
      console.log("PLAY_SOUND: click.mp3");
      playerName = nameInput.node.value;
      playerSlot = document.getElementById('playerSlot').value;
      gameId = gameIdInput.node.value.trim();

      if (!playerName || !playerSlot) {
        alert('Enter your name and select a player slot.');
        return;
      }

      if (!gameId) {
        gameId = generateGameId();
        console.log(`[JoinScene] Generated new Game ID: ${gameId}`);
        // Pass difficulty when creating a new game
        socket.emit('createGame', { gameId }); 
        alert(`Game Created! Share this Game ID: ${gameId}`);
      }

      sessionStorage.setItem('gameId', gameId);
      sessionStorage.setItem('playerName', playerName);
      sessionStorage.setItem('playerSlot', playerSlot);

      socket.emit('joinGame', { gameId, playerName, playerSlot });
    });

    // When players join or rejoin (This is for the main flow where user fills details and clicks "Join Game")
    // The reconnect flow above has its own 'playerJoined' listener.
    // The logic for playerJoined in the main flow is now part of this.handlePlayerJoined
    socket.on('playerJoined', this.handlePlayerJoined);

    // Attach other handlers for the main flow
    // These ensure that if the game state progresses (e.g., host starts round)
    // while the user is still on JoinScene (e.g., just after clicking "Join Game"
    // but before GameScene loads), the JoinScene can correctly transition.
    socket.on('startRound', this.handleStartRound);
    socket.on('beginVoting', this.handleBeginVoting);
    socket.on('votingResults', this.handleVotingResults);
    socket.on('showFinalScores', this.handleShowFinalScores);
    socket.on('errorMessage', this.handleErrorMessage);
  }

  shutdown() {
    console.log('[JoinScene] shutting down and removing listeners.');
    // Remove all listeners using the stored handler references
    if (this.handlePlayerJoined) {
      socket.off('playerJoined', this.handlePlayerJoined);
    }
    if (this.handleStartRound) {
      socket.off('startRound', this.handleStartRound);
    }
    if (this.handleBeginVoting) {
      socket.off('beginVoting', this.handleBeginVoting);
    }
    if (this.handleVotingResults) {
      socket.off('votingResults', this.handleVotingResults);
    }
    if (this.handleShowFinalScores) {
      socket.off('showFinalScores', this.handleShowFinalScores);
    }
    if (this.handleErrorMessage) {
      socket.off('errorMessage', this.handleErrorMessage);
    }
  }
}
