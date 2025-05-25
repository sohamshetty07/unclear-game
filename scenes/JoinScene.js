class JoinScene extends Phaser.Scene {
  constructor() {
    super('JoinScene');
  }

  init(data) {
    this.selectedDifficulty = data.difficulty || 'easy'; // Store difficulty from LandingScene
    console.log('JoinScene received difficulty:', this.selectedDifficulty);
  }

  create() {
    const scene = this;
    const storedGameId = sessionStorage.getItem('gameId');
    const storedPlayerName = sessionStorage.getItem('playerName');
    const storedPlayerSlot = sessionStorage.getItem('playerSlot');

    // Handle reconnect flow first
    // If reconnecting, we might skip initial fade-in or handle transitions differently.
    // For now, initial fade-in will apply to both new entries and reconnects.
    this.cameras.main.fadeIn(300, 0, 0, 0); 

    if (storedGameId && storedPlayerName && storedPlayerSlot) {
      gameId = storedGameId;
      playerName = storedPlayerName;
      playerSlot = storedPlayerSlot;

      // 👇 Setup ALL event listeners FIRST
      socket.on('playerJoined', ({ players, yourSocketId: id }) => {
        yourSocketId = id;
        const me = players.find(p =>
          p.playerName === playerName && p.playerSlot === playerSlot
        );
        if (me) {
          updatePlayerBanner();
          // Do not jump scenes here; wait for proper sync events
        }
      });

      socket.on('startRound', ({ word, turnOrder, currentClueTurn, round }) => {
        this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
          if (progress === 1) {
            console.log("PLAY_SOUND: transition.mp3");
            this.scene.stop(); // Stop current scene after fade
            this.scene.start('RoundScene', { word, turnOrder, currentClueTurn, round });
          }
        });
      });

      socket.on('beginVoting', ({ players, alreadyVoted, playerMap }) => {
        const others = players.filter(p => p.playerSlot !== playerSlot);
        this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
          if (progress === 1) {
            console.log("PLAY_SOUND: transition.mp3");
            this.scene.stop();
            this.scene.start('VotingScene', {
              round: 1, // Assuming round 1 for reconnect to voting, may need adjustment
              votablePlayers: others,
              alreadyVoted,
              playerMap
            });
          }
        });
      });

      socket.on('votingResults', (data) => {
        this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
          if (progress === 1) {
            console.log("PLAY_SOUND: transition.mp3");
            this.scene.stop();
            this.scene.start('ResultScene', data);
          }
        });
      });

      socket.on('showFinalScores', (data) => {
        this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
          if (progress === 1) {
            console.log("PLAY_SOUND: transition.mp3");
            this.scene.stop();
            this.scene.start('FinalScoreScene', data);
          }
        });
      });

      socket.on('errorMessage', msg => {
        alert(msg);
      });

      // 👇 Only emit joinGame AFTER all listeners are ready
      socket.emit('joinGame', { gameId, playerName, playerSlot });
      return;
    }

    // UI Setup
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
        console.log(`[JoinScene] Generated new Game ID: ${gameId} with difficulty ${this.selectedDifficulty}`);
        // Pass difficulty when creating a new game
        socket.emit('createGame', { gameId, difficulty: this.selectedDifficulty }); 
        alert(`Game Created! Share this Game ID: ${gameId}`);
      }

      sessionStorage.setItem('gameId', gameId);
      sessionStorage.setItem('playerName', playerName);
      sessionStorage.setItem('playerSlot', playerSlot);

      socket.emit('joinGame', { gameId, playerName, playerSlot });
    });

    // When players join or rejoin
    socket.on('playerJoined', ({ players, yourSocketId: id }) => {
      yourSocketId = id;
      const alreadyInGame = players.some(p =>
        p.playerName === playerName && p.playerSlot === playerSlot
      );
      if (alreadyInGame) {
        updatePlayerBanner();
        socket.emit('syncRequest', { gameId, playerSlot });
        // Transition to GameScene with fade-out
        this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
          if (progress === 1) {
            console.log("PLAY_SOUND: transition.mp3");
            scene.scene.start('GameScene');
          }
        });
      }
    });

    // Handle all sync scenarios (these listeners are for when JoinScene is active *after* initial setup)
    // The reconnect flow above handles transitions if JoinScene itself is being "reconnected" into.
    // These ensure if JoinScene is active (e.g. user just filled details but not yet in GameScene)
    // and a sync event comes, it also fades out.
    socket.on('startRound', ({ word, turnOrder, currentClueTurn, round }) => {
      console.log('[JoinScene] received startRound after player joined, before GameScene');
      this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          console.log("PLAY_SOUND: transition.mp3");
          this.scene.stop();
          this.scene.start('RoundScene', { word, turnOrder, currentClueTurn, round });
        }
      });
    });

    socket.on('beginVoting', ({ players, alreadyVoted, playerMap }) => {
      console.log('[JoinScene] received beginVoting after player joined, before GameScene');
      const others = players.filter(p => p.playerSlot !== playerSlot);
      this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          console.log("PLAY_SOUND: transition.mp3");
          this.scene.stop();
          this.scene.start('VotingScene', {
            round: 1, // Assuming round 1, similar to reconnect logic
            votablePlayers: others,
            alreadyVoted,
            playerMap
          });
        }
      });
    });

    socket.on('votingResults', (data) => {
      console.log('[JoinScene] received votingResults after player joined, before GameScene');
      this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          console.log("PLAY_SOUND: transition.mp3");
          this.scene.stop();
          this.scene.start('ResultScene', data);
        }
      });
    });

    socket.on('showFinalScores', (data) => {
      console.log('[JoinScene] received final scores after player joined, before GameScene');
      this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          console.log("PLAY_SOUND: transition.mp3");
          this.scene.stop();
          this.scene.start('FinalScoreScene', data);
        }
      });
    });

    socket.on('errorMessage', msg => {
      alert(msg);
    });
  }
}
