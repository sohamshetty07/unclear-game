class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const scene = this;

    this.add.text(30, 40, `Welcome ${playerName} (${playerSlot})`, {
      font: '18px Arial',
      fill: '#000'
    });

    this.add.text(30, 70, `Game ID: ${gameId}`, {
      font: '14px Arial',
      fill: '#444'
    });

    let isReady = false;
    let isHost = false;

    const readyBtn = this.add.dom(180, 300, 'button', {
      fontSize: '16px',
      padding: '6px 16px',
      backgroundColor: '#2196F3',
      color: '#fff',
      border: 'none',
      borderRadius: '5px'
    }, "I'm Ready");

    readyBtn.addListener('click');
    readyBtn.on('click', () => {
      isReady = !isReady;
      readyBtn.node.innerText = isReady ? 'Not Ready' : "I'm Ready";
      socket.emit('toggleReady', { gameId, playerSlot, isReady });
    });

    // ✅ Declare playerListContainer text block
    this.playerListContainer = this.add.text(30, 360, 'Players loading...', {
      font: '14px Courier',
      fill: '#000',
      lineSpacing: 4
    });

    // ✅ Start button (host only, visible when all ready)
    const startBtn = this.add.dom(180, 580, 'button', {
      fontSize: '16px',
      padding: '8px 18px',
      backgroundColor: '#4CAF50',
      color: '#fff',
      border: 'none',
      borderRadius: '5px',
      display: 'none'
    }, 'Start Game');
    this.startBtn = startBtn;

    startBtn.addListener('click');
    startBtn.on('click', () => {
      socket.emit('startGame', gameId);
    });

    socket.removeAllListeners('playerJoined');

    socket.on('playerJoined', ({ players, yourSocketId: id }) => {
      yourSocketId = id;

      let playerText = 'Players:\n';
      const everyoneReady = players.length > 0 && players.every(p => p.isReady);

      const me = players.find(p => p.playerSlot === playerSlot && p.playerName === playerName);
      isHost = me?.isHost || false;

      players.forEach(p => {
        const hostMark = p.isHost ? ' 👑' : '';
        const readyMark = p.isReady ? '✅' : '❌';
        playerText += `${p.playerSlot} - ${p.playerName}${hostMark} [${readyMark}]\n`;
      });

      this.playerListContainer.setText(playerText);

      if (this.startBtn && this.startBtn.node) {
        this.startBtn.node.style.display = (isHost && everyoneReady) ? 'block' : 'none';
      }
    });

    socket.on('startRound', ({ word, turnOrder, currentClueTurn, round }) => {
      this.scene.stop();
      this.scene.start('RoundScene', {
        word, turnOrder, currentClueTurn, round
      });
    });

    socket.emit('requestPlayerList', gameId);
  }
}
