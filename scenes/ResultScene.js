class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  init(data) {
    this.round = data.round;
    this.votes = data.votes;
    this.imposter = data.imposter;
    this.correctGuessers = data.correctGuessers;
    this.scores = data.scores;
    this.playerMap = data.playerMap || {};
    this.isHost = data.isHost || false;
    this.players = data.players || [];
    this.votedOut = data.votedOut; // Store votedOut from init data
  }

  create() {
    const scene = this;
    this.readyBtn = null;
    this.endBtn = null;
    this.cameras.main.setBackgroundColor('var(--background-color)');
    this.cameras.main.fadeIn(300, 0, 0, 0); // Fade-in for ResultScene

    // Log received results for debugging
    console.log(`[ResultScene] Create. Imposter: ${this.imposter}, Voted Out: ${this.votedOut}`);
    console.log(`[ResultScene] Correct Guessers:`, this.correctGuessers);


    // Determine if imposter was correctly voted out
    if (this.votedOut) { // Someone was voted out
        if (this.imposter === this.votedOut) {
             console.log("PLAY_SOUND: correct.mp3");
        } else { // Someone was voted out, but it wasn't the imposter
             console.log("PLAY_SOUND: incorrect.mp3");
        }
    } else { 
        // No one was voted out (e.g. tie after revote and imposter was not one of the tied, or no votes cast)
        // This means the imposter survived.
        console.log("PLAY_SOUND: incorrect.mp3"); // Imposter wins this round essentially
    }

    let y = 50; 

    // Round Result Title
    this.add.text(180, y, `Round ${this.round} Result`, {
      fontFamily: 'Roboto',
      fontSize: '24px',
      color: 'var(--text-color)',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);
    y += 40; 

    // Imposter Name
    const imposterPlayer = this.players.find(p => p.playerSlot === this.imposter);
    const imposterAvatar = imposterPlayer?.avatar || '';
    const imposterNameStr = `${imposterAvatar} ${this.imposter} - ${this.playerMap[this.imposter] || 'Unknown'}`;
    const imposterNameText = this.add.text(180, y, `Imposter: ${imposterNameStr}`, {
      fontFamily: 'Roboto',
      fontSize: '18px',
      color: 'var(--warning-color)',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);
    // Animate Imposter Name
    this.tweens.add({
        targets: imposterNameText,
        scale: { from: 0.8, to: 1 },
        alpha: { from: 0.5, to: 1 },
        ease: 'Elastic.easeOut',
        duration: 600,
        delay: 200
    });
    y += 40; 

    // Votes Display
    let voteTextLines = ['Votes:'];
    if (Object.keys(this.votes).length > 0) {
        Object.entries(this.votes).forEach(([voterSlot, votedSlot]) => {
            const voterPlayer = this.players.find(p => p.playerSlot === voterSlot);
            const votedPlayer = this.players.find(p => p.playerSlot === votedSlot);
            const voterAvatar = voterPlayer?.avatar || '';
            const votedAvatar = votedPlayer?.avatar || '';
            const voterName = `${voterAvatar} ${this.playerMap[voterSlot] || '?'}`;
            const votedName = `${votedAvatar} ${this.playerMap[votedSlot] || '?'}`;
            voteTextLines.push(`${voterName} ➜ ${votedName}`);
        });
    } else {
        voteTextLines.push('No votes were cast.');
    }
    const votesDisplay = this.add.text(180, y, voteTextLines.join('\n'), {
      fontFamily: 'Roboto',
      fontSize: '14px',
      color: 'var(--text-color)',
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5, 0); // Align to top of text block for height calculation
    y += votesDisplay.height + 20; // Space after votes block

    // Correct Guessers Title
    this.add.text(180, y, `Correct Guessers:`, {
      fontFamily: 'Roboto',
      fontSize: '16px',
      color: 'var(--success-color)',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);
    y += 25; // Space after title

    // Correct Guessers List
    const correctNames = this.correctGuessers.map(slot => {
        const player = this.players.find(p => p.playerSlot === slot);
        const avatar = player?.avatar || '';
        return `${avatar} ${this.playerMap[slot] || slot}`;
    });
    const correctGuessersText = this.add.text(180, y, correctNames.join(', ') || 'None', {
        fontFamily: 'Roboto',
        fontSize: '14px',
        color: 'var(--success-color)',
        align: 'center',
        wordWrap: { width: 320 }
    }).setOrigin(0.5, 0); 
    y += correctGuessersText.height + 30; 
    // Animate Correct Guessers Text
    if (this.correctGuessers.length > 0) {
        this.tweens.add({
            targets: correctGuessersText,
            scale: { from: 1.1, to: 1 },
            duration: 400,
            ease: 'Sine.easeInOut',
            delay: 400
        });
    }


    // Ready List Text 
    this.readyListText = this.add.text(180, y, 'Players ready: 0', {
      fontFamily: 'Roboto',
      fontSize: '14px',
      color: 'var(--secondary-accent-color)',
      align: 'center',
      lineSpacing: 4, 
    }).setOrigin(0.5, 0); 
    y += 20 + 20; 

    // Ready Button
    this.readyBtn = this.add.dom(180, y, 'button', null, 'Ready for Next Round').setClassName('button');
    this.readyBtn.setOrigin(0.5); 
    this.readyBtn.node.style.transform = 'scale(0.8)'; // Initial scale for pop-in
    this.tweens.add({
        targets: this.readyBtn.node,
        scale: 1,
        ease: 'Back.easeOut',
        duration: 300,
        delay: 600 // Delay pop-in
    });
    y += this.readyBtn.height + 20; 

    this.readyBtn.addListener('click');
    this.readyBtn.on('click', () => {
      console.log("PLAY_SOUND: click.mp3");
      if (this.readyBtn && this.readyBtn.node) {
        this.readyBtn.node.disabled = true;
        this.readyBtn.node.style.backgroundColor = 'var(--secondary-accent-color)';
      }
      socket.emit('nextRoundReady', { gameId, playerSlot });
    });
    // End Game Button - positioned after Ready button
    if (this.isHost) {
      this.endBtn = this.add.dom(180, y, 'button', null, 'End Game').setClassName('button');
      this.endBtn.setOrigin(0.5); 
      this.endBtn.node.style.backgroundColor = 'var(--warning-color)'; 
      this.endBtn.node.style.transform = 'scale(0.8)'; // Initial scale for pop-in
      this.tweens.add({
          targets: this.endBtn.node,
          scale: 1,
          ease: 'Back.easeOut',
          duration: 300,
          delay: 700 // Delay pop-in
      });

      this.endBtn.addListener('click');
      this.endBtn.on('click', () => {
        console.log("PLAY_SOUND: click.mp3");
        socket.emit('endGame', gameId); // endGame triggers showFinalScores which handles fadeOut
      });
    }

    socket.on('nextRoundStatus', readySlots => {
      const names = readySlots.map(s => {
        const player = this.players.find(p => p.playerSlot === s);
        const avatar = player?.avatar || '';
        const isHostPlayer = player?.isHost;
        const crown = isHostPlayer ? ' 👑' : '';
        return `${avatar} ${s} - ${this.playerMap[s] || ''}${crown}`;
      });
      if (this.readyListText) {
        const oldTextHeight = this.readyListText.height;
        this.readyListText.setText(`Players ready: ${names.length}\n${names.join('\n')}`);
        const newTextHeight = this.readyListText.height;
        // If text height changes, adjust subsequent button positions
        const diffY = newTextHeight - oldTextHeight;
        if (diffY !== 0 && this.readyBtn) {
            this.readyBtn.y += diffY;
            if (this.endBtn) {
                this.endBtn.y += diffY;
            }
        }
      }
    });

    // The 'startRound' event is handled by GameScene, which will fade out and start RoundScene.
    // So, ResultScene doesn't need to listen for 'startRound' to initiate a fade.

    socket.on('showFinalScores', ({ scores, playerMap }) => {
      this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          console.log("PLAY_SOUND: transition.mp3");
          scene.scene.stop();
          scene.scene.start('FinalScoreScene', { scores, playerMap });
        }
      });
    });
  }
}
