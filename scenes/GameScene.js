class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const scene = this;
    this.cameras.main.setBackgroundColor('var(--background-color)');
    this.cameras.main.fadeIn(300, 0, 0, 0); // Fade-in for GameScene
    this.previousPlayerCount = 0; // Initialize for player join sound

    this.add.text(180, 50, `Lobby: ${gameId}`, { // Adjusted Y
      fontFamily: 'Roboto',
      fontSize: '24px',
      color: 'var(--text-color)',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    this.add.text(180, 85, `Welcome ${playerName} (${playerSlot})`, { // Adjusted Y
      fontFamily: 'Roboto',
      fontSize: '18px',
      color: 'var(--secondary-accent-color)',
      align: 'center'
    }).setOrigin(0.5);

    let isReady = false;
    let isHost = false;

    const readyBtn = this.add.dom(180, 200, 'button', null, "I'm Ready").setClassName('button'); 
    readyBtn.node.style.backgroundColor = 'var(--secondary-accent-color)';
    readyBtn.node.style.transform = 'scale(0.8)'; // Initial scale for pop-in
    this.tweens.add({
        targets: readyBtn.node,
        scale: 1,
        ease: 'Back.easeOut',
        duration: 300,
        delay: 200 // Delay after scene fade in
    });

    readyBtn.addListener('click');
    readyBtn.on('click', () => {
      console.log("PLAY_SOUND: click.mp3");
      isReady = !isReady;
      readyBtn.node.innerText = isReady ? 'Not Ready' : "I'm Ready";
      readyBtn.node.style.backgroundColor = isReady ? 'var(--success-color)' : 'var(--secondary-accent-color)';
      socket.emit('toggleReady', { gameId, playerSlot, isReady });
    });

    // ✅ Declare playerListContainer text block
    this.playerListContainer = this.add.text(180, 350, 'Players loading...', { 
      fontFamily: 'Roboto',
      fontSize: '14px',
      color: 'var(--text-color)',
      lineSpacing: 6,
      align: 'center', 
      wordWrap: { width: 320 } 
    }).setOrigin(0.5); 

    // ✅ Start button (host only, visible when all ready)
    const startBtn = this.add.dom(180, 560, 'button', null, 'Start Game').setClassName('button'); 
    startBtn.node.style.backgroundColor = 'var(--success-color)'; 
    startBtn.node.style.display = 'none'; 
    // Initial scale for pop-in, will be applied when button becomes visible
    startBtn.node.style.transform = 'scale(0.8)';
    this.startBtn = startBtn;


    startBtn.addListener('click');
    startBtn.on('click', () => {
      console.log("PLAY_SOUND: click.mp3");
      socket.emit('startGame', gameId); // startGame will trigger startRound which handles fadeOut
    });

    socket.removeAllListeners('playerJoined');

    socket.on('playerJoined', ({ players, yourSocketId: id }) => {
      yourSocketId = id;

      if (players.length > this.previousPlayerCount) {
        console.log("PLAY_SOUND: player_join.mp3");
      }
      this.previousPlayerCount = players.length;
      console.log(`[GameScene] Player list updated. Current players: ${players.length}`);

      let playerText = 'Players:\n';
      const everyoneReady = players.length > 0 && players.every(p => p.isReady);

      const me = players.find(p => p.playerSlot === playerSlot && p.playerName === playerName);
      isHost = me?.isHost || false;

      players.forEach(p => {
        const avatar = p.avatar || ''; // Get avatar, default to empty string if not present
        const hostMark = p.isHost ? ' 👑' : '';
        const readyMark = p.isReady ? '✅' : '❌';
        playerText += `${avatar} ${p.playerSlot} - ${p.playerName}${hostMark} [${readyMark}]\n`;
      });

      this.playerListContainer.setText(playerText);
      // Animate player list container on update
      this.tweens.add({
          targets: this.playerListContainer,
          scaleX: 1.03,
          scaleY: 1.03,
          duration: 100,
          yoyo: true,
          ease: 'Sine.easeInOut'
      });

      if (this.startBtn && this.startBtn.node) {
        const shouldBeVisible = isHost && everyoneReady;
        if (shouldBeVisible && this.startBtn.node.style.display === 'none') {
          this.startBtn.node.style.display = 'block';
          // Pop-in animation for Start Game button when it appears
          this.tweens.add({
            targets: this.startBtn.node,
            scale: 1,
            ease: 'Back.easeOut',
            duration: 300
          });
        } else if (!shouldBeVisible) {
          this.startBtn.node.style.display = 'none';
          this.startBtn.node.style.transform = 'scale(0.8)'; // Reset scale if hidden again
        }
      }
    });

    socket.on('startRound', ({ word, turnOrder, currentClueTurn, round }) => {
      this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          console.log("PLAY_SOUND: transition.mp3"); // Or "round_start.mp3"
          this.scene.stop();
          this.scene.start('RoundScene', {
            word, turnOrder, currentClueTurn, round
          });
        }
      });
    });

    socket.emit('requestPlayerList', gameId);
  }
}
