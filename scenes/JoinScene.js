class JoinScene extends Phaser.Scene {
  constructor() {
    super('JoinScene');
  }

  create() {
    const scene = this;
    const storedGameId = sessionStorage.getItem('gameId');
    const storedPlayerName = sessionStorage.getItem('playerName');
    const storedPlayerSlot = sessionStorage.getItem('playerSlot');

    // Handle reconnect flow first
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
        this.scene.stop();
        this.scene.start('RoundScene', { word, turnOrder, currentClueTurn, round });
      });

      socket.on('beginVoting', ({ players, alreadyVoted, playerMap }) => {
        const others = players.filter(p => p.playerSlot !== playerSlot);
        this.scene.stop();
        this.scene.start('VotingScene', {
          round: 1,
          votablePlayers: others,
          alreadyVoted,
          playerMap
        });
      });

      socket.on('votingResults', (data) => {
        this.scene.stop();
        this.scene.start('ResultScene', data);
      });

      socket.on('showFinalScores', (data) => {
        this.scene.stop();
        this.scene.start('FinalScoreScene', data);
      });

      socket.on('errorMessage', msg => {
        alert(msg);
      });

      // 👇 Only emit joinGame AFTER all listeners are ready
      socket.emit('joinGame', { gameId, playerName, playerSlot });
      return;
    }

    // UI Setup
    this.add.text(90, 40, 'UnClear MVP', {
      font: '24px Arial',
      fill: '#000'
    });

    const gameIdInput = this.add.dom(180, 100, 'input', {
      type: 'text',
      fontSize: '16px',
      width: '200px',
      padding: '5px'
    });
    gameIdInput.node.placeholder = 'Game ID (leave blank to host)';

    const nameInput = this.add.dom(180, 160, 'input', {
      type: 'text',
      fontSize: '16px',
      width: '200px',
      padding: '5px'
    });
    nameInput.node.placeholder = 'Your Name';

    const dropdownHTML = `
      <select id="playerSlot" style="font-size:16px; width:200px;">
        <option value="">Select Player Slot</option>
        ${[...Array(12).keys()].map(i =>
          `<option value="Player ${i + 1}">Player ${i + 1}</option>`
        ).join('')}
      </select>`;
    this.add.dom(180, 220).createFromHTML(dropdownHTML);

    const joinBtn = this.add.dom(180, 290, 'button', {
      fontSize: '18px',
      padding: '10px 20px',
      backgroundColor: '#4CAF50',
      color: '#fff',
      border: 'none',
      borderRadius: '5px'
    }, 'Join Game');

    joinBtn.addListener('click');
    joinBtn.on('click', () => {
      playerName = nameInput.node.value;
      playerSlot = document.getElementById('playerSlot').value;
      gameId = gameIdInput.node.value.trim();

      if (!playerName || !playerSlot) {
        alert('Enter your name and select a player slot.');
        return;
      }

      if (!gameId) {
        gameId = generateGameId();
        socket.emit('createGame', gameId);
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
        scene.scene.start('GameScene');
      }
    });

    // Handle all sync scenarios
    socket.on('startRound', ({ word, turnOrder, currentClueTurn, round }) => {
      console.log('[JoinScene] received startRound after reconnect');
      this.scene.stop();
      this.scene.start('RoundScene', { word, turnOrder, currentClueTurn, round });
    });

    socket.on('beginVoting', ({ players, alreadyVoted, playerMap }) => {
      console.log('[JoinScene] received beginVoting after reconnect');
      const others = players.filter(p => p.playerSlot !== playerSlot);
      this.scene.stop();
      this.scene.start('VotingScene', {
        round: 1,
        votablePlayers: others,
        alreadyVoted,
        playerMap
      });
    });

    socket.on('votingResults', (data) => {
      console.log('[JoinScene] received votingResults after reconnect');
      this.scene.stop();
      this.scene.start('ResultScene', data);
    });

    socket.on('showFinalScores', (data) => {
      console.log('[JoinScene] received final scores after reconnect');
      this.scene.stop();
      this.scene.start('FinalScoreScene', data);
    });

    socket.on('errorMessage', msg => {
      alert(msg);
    });
  }
}
