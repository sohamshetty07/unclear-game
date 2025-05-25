class VotingScene extends Phaser.Scene {
  constructor() {
    super('VotingScene');
  }

  init(data) {
    this.round = data.round;
    this.votablePlayers = data.votablePlayers || [];
    this.tiedPlayers = data.tiedPlayers || null;
    this.playerMap = data.playerMap || {};
    this.alreadyVoted = data.alreadyVoted || false;
  }

  create() {
    const scene = this;
    this.cameras.main.setBackgroundColor('#F5F5F5');
    this.cameras.main.fadeIn(300, 0, 0, 0); // Fade-in for VotingScene

    // Timer Display
    this.timerText = this.add.text(180, 10, '', { // Positioned at the top
        fontFamily: 'Roboto', 
        fontSize: '16px', 
        color: 'var(--warning-color)', 
        fontStyle: 'bold',
        align: 'center' 
    }).setOrigin(0.5);
    this.timerText.setVisible(false); // Initially hidden

    this.add.text(180, 30, `Your Turn: ${playerSlot} - ${playerName}`, { // Adjusted Y
      fontFamily: 'Roboto',
      fontSize: '14px',
      color: 'var(--secondary-accent-color)',
      align: 'center'
    }).setOrigin(0.5);

    this.add.text(180, 70, `Round ${this.round} Voting`, { // Adjusted Y
      fontFamily: 'Roboto',
      fontSize: '24px',
      color: 'var(--text-color)',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    this.voteStatus = this.add.text(180, 120, 'Select who you think is the imposter:', { // Adjusted Y
      fontFamily: 'Roboto',
      fontSize: '16px',
      color: 'var(--text-color)',
      align: 'center'
    }).setOrigin(0.5);

    const options = this.tiedPlayers || this.votablePlayers;
    const dropdownHTML = `
      <select id="voteDropdown" style="font-size:16px; width:280px; padding: 10px; border-radius: 5px; border: 1px solid var(--secondary-accent-color); font-family: Roboto; background-color: var(--white-color); color: var(--text-color);">
        <option value="">-- Select Player --</option>
        ${options.map(p => {
          const avatar = p.avatar || ''; // Get avatar, default to empty string
          return `<option value="${p.playerSlot}">${avatar} ${p.playerSlot} - ${p.playerName}</option>`;
        }).join('')}
      </select>`;
    this.add.dom(180, 170).createFromHTML(dropdownHTML); // Adjusted Y

    const submitBtn = this.add.dom(180, 250, 'button', null, 'Submit Vote').setClassName('button'); // Adjusted Y
    submitBtn.node.style.backgroundColor = 'var(--success-color)';
    submitBtn.node.style.transform = 'scale(0.8)'; // Initial scale for pop-in

    this.tweens.add({
        targets: submitBtn.node,
        scale: 1,
        ease: 'Back.easeOut',
        duration: 300,
        delay: 200 // Delay after scene fade-in
    });

    if (this.alreadyVoted) {
      this.voteStatus.setText('You already voted. Waiting for others...');
      if (submitBtn && submitBtn.node) {
        submitBtn.node.disabled = true;
        submitBtn.node.style.backgroundColor = 'var(--secondary-accent-color)'; // Disabled look
        submitBtn.node.style.transform = 'scale(1)'; // Ensure it's not stuck at 0.8
      }
    }

    submitBtn.addListener('click');
    submitBtn.on('click', () => {
      console.log("PLAY_SOUND: click.mp3");
      const selected = document.getElementById('voteDropdown').value;
      if (!selected) {
        alert('Please select a player.');
        return;
      }

      // console.log('[DEBUG] Submit vote clicked:', selected); // Original debug log
      console.log(`[VotingScene] Player ${playerSlot} voted for ${selected} in game ${gameId}.`);


      socket.emit('submitVote', {
        gameId,
        voter: playerSlot,
        voted: selected
      });

      if (submitBtn && submitBtn.node) submitBtn.node.disabled = true;
      this.voteStatus.setText('Vote submitted. Waiting for others...');
    });

    // Define timerUpdateCallback to be able to remove it later
    this.timerUpdateCallback = (data) => {
        if (this.scene.isActive()) { // Check if scene is still active
            if (data.phase === 'voting' && data.timeLeft > 0) {
                this.timerText.setText(`Voting ends in: ${data.timeLeft}s`);
                this.timerText.setVisible(true);
            } else {
                this.timerText.setVisible(false);
            }
        }
    };
    socket.on('timerUpdate', this.timerUpdateCallback);


    socket.on('votingResults', ({ votes, imposter, correctGuessers, scores, playerMap, players }) => {
      this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          console.log("PLAY_SOUND: transition.mp3");
          this.timerText.setVisible(false); // Hide timer before scene change
          scene.scene.stop();
          scene.scene.start('ResultScene', {
            votes,
            imposter,
            correctGuessers,
            scores,
            playerMap,
            players,
            round: this.round,
            isHost: players.find(p => p.playerSlot === playerSlot)?.isHost || false
          });
        }
      });
    });

    socket.on('revote', ({ tiedPlayers }) => {
      const fullTied = tiedPlayers.map(slot =>
        this.votablePlayers.find(p => p.playerSlot === slot) || { playerSlot: slot, playerName: 'Unknown' }
      );
      this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          console.log("PLAY_SOUND: transition.mp3");
          this.timerText.setVisible(false); // Hide timer before scene change
          scene.scene.stop();
          scene.scene.start('VotingScene', { // Restarting VotingScene for revote
            round: this.round,
            votablePlayers: this.votablePlayers,
            tiedPlayers: fullTied,
            playerMap: this.playerMap,
            alreadyVoted: false // Reset alreadyVoted for revote
          });
        }
      });
    });
  }

  shutdown() {
    // Remove the specific listener when the scene shuts down
    if (this.timerUpdateCallback) {
        socket.off('timerUpdate', this.timerUpdateCallback);
    }
  }
}
