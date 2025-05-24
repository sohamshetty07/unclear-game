class RoundScene extends Phaser.Scene {
  constructor() {
    super('RoundScene');
  }

  init(data) {
    this.word = data.word;
    this.turnOrder = data.turnOrder;
    this.currentClueTurn = data.currentClueTurn;
    this.round = data.round;
    console.log(`[RoundScene] Initialized. Round: ${this.round}, Word: ${this.word}, Turn: ${this.currentClueTurn}, Turn Order: ${this.turnOrder.join(', ')}`);
  }

  create() {
    this.scene.stop('ResultScene'); // Ensure any previous ResultScene is stopped
    this.cameras.main.setBackgroundColor('var(--background-color)');
    this.cameras.main.fadeIn(300, 0, 0, 0); // Fade-in for RoundScene
    console.log("PLAY_SOUND: transition.mp3"); // Sound for round start

    this.add.text(180, 50, `Round ${this.round}`, { // Adjusted Y
      fontFamily: 'Roboto',
      fontSize: '24px',
      color: 'var(--text-color)',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    // Timer Display
    this.timerText = this.add.text(180, 20, '', { 
        fontFamily: 'Roboto', 
        fontSize: '16px', 
        color: 'var(--warning-color)', 
        fontStyle: 'bold',
        align: 'center' 
    }).setOrigin(0.5);
    this.timerText.setVisible(false); // Initially hidden

    this.add.text(180, 90, `Your Word: ${this.word}`, { // Adjusted Y
      fontFamily: 'Roboto',
      fontSize: '20px',
      color: 'var(--primary-accent-color)',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    this.clueText = this.add.text(180, 250, `Waiting for your turn...`, { // Adjusted Y
      fontFamily: 'Roboto',
      fontSize: '16px',
      color: 'var(--secondary-accent-color)',
      align: 'center',
      wordWrap: { width: 320 }
    }).setOrigin(0.5);
    this.clueText.alpha = 0; // Start transparent for fade-in animation

    const nextBtn = this.add.dom(180, 550, 'button', null, 'Next').setClassName('button'); // Adjusted Y
    nextBtn.node.style.display = 'none'; // Initially hidden
    nextBtn.node.style.transform = 'scale(0.8)'; // For pop-in

    const animateClueText = (newText) => {
        this.tweens.add({
            targets: this.clueText,
            alpha: 0,
            duration: 150,
            ease: 'Power2',
            onComplete: () => {
                this.clueText.setText(newText);
                this.tweens.add({
                    targets: this.clueText,
                    alpha: 1,
                    duration: 150,
                    ease: 'Power2'
                });
            }
        });
    };
    
    const showNextButton = () => {
        if (nextBtn && nextBtn.node) {
            nextBtn.node.style.display = 'block';
            this.tweens.add({
                targets: nextBtn.node,
                scale: 1,
                ease: 'Back.easeOut',
                duration: 300
            });
        }
    };

    const hideNextButton = () => {
        if (nextBtn && nextBtn.node) {
            // Optionally animate out, or just hide
            this.tweens.add({
                targets: nextBtn.node,
                scale: 0.8,
                ease: 'Back.easeIn',
                duration: 200,
                onComplete: () => {
                     if(nextBtn.node) nextBtn.node.style.display = 'none';
                }
            });
        }
    };

    nextBtn.addListener('click');
    nextBtn.on('click', () => {
      if (playerSlot !== this.currentClueTurn) {
        alert("It's not your turn yet. Please wait.");
        return;
      }
      console.log("PLAY_SOUND: click.mp3");
      socket.emit('nextClue', gameId);
      hideNextButton();
      animateClueText('Waiting for others...');
    });

    socket.on('nextClueTurn', newTurn => {
      this.currentClueTurn = newTurn;
      console.log(`[RoundScene] Next clue turn: ${newTurn}. My slot: ${playerSlot}`);
      if (playerSlot === newTurn) {
        animateClueText(`It's your turn. Give a clue based on your word.`);
        showNextButton();
        console.log(`[RoundScene] It's MY turn.`);
      } else {
        animateClueText(`Waiting for ${newTurn} to give a clue...`);
        hideNextButton();
      }
    });

    socket.on('timerUpdate', (data) => {
        if (data.phase === 'clue' && data.timeLeft > 0) {
            this.timerText.setText(`Time: ${data.timeLeft}s`);
            this.timerText.setVisible(true);
        } else {
            this.timerText.setVisible(false);
        }
    });

    socket.on('beginVoting', ({ players }) => {
      const others = players.filter(p => p.playerSlot !== playerSlot);
      this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          console.log("PLAY_SOUND: transition.mp3");
          this.timerText.setVisible(false); // Hide timer before scene change
          this.scene.stop(); // Stop current scene after fade
          this.scene.start('VotingScene', {
            round: this.round,
            votablePlayers: others
          });
        }
      });
    });
    
    // Initial clue text animation
    animateClueText(this.clueText.text); // Animate the initial text

    if (playerSlot === this.currentClueTurn) {
      animateClueText(`It's your turn. Give a clue based on your word.`);
      showNextButton();
    }
  }
}
