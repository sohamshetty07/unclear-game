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

    this.add.text(180, 10, `${playerSlot} - ${playerName}`, {
      font: '14px Arial',
      fill: '#000'
    }).setOrigin(0.5, 0);

    this.add.text(30, 40, `Round ${this.round} Voting`, {
      font: '20px Arial',
      fill: '#000'
    });

    this.voteStatus = this.add.text(30, 80, 'Select who you think is the imposter:', {
      font: '14px Arial',
      fill: '#333'
    });

    const options = this.tiedPlayers || this.votablePlayers;
    const dropdownHTML = `
      <select id="voteDropdown" style="font-size:16px; width:200px;">
        <option value="">-- Select Player --</option>
        ${options.map(p =>
          `<option value="${p.playerSlot}">${p.playerSlot} - ${p.playerName}</option>`
        ).join('')}
      </select>`;
    this.add.dom(180, 130).createFromHTML(dropdownHTML);

    const submitBtn = this.add.dom(180, 200, 'button', {
      fontSize: '16px',
      padding: '6px 14px',
      backgroundColor: '#4CAF50',
      color: '#fff',
      border: 'none',
      borderRadius: '5px',
      position: 'absolute',
      transform: 'translateX(-50%)'
    }, 'Submit Vote');

    if (this.alreadyVoted) {
      this.voteStatus.setText('You already voted. Waiting for others...');
      if (submitBtn && submitBtn.node) submitBtn.node.disabled = true;
    }

    submitBtn.addListener('click');
    submitBtn.on('click', () => {
      const selected = document.getElementById('voteDropdown').value;
      if (!selected) {
        alert('Please select a player.');
        return;
      }

      console.log('[DEBUG] Submit vote clicked:', selected);

      socket.emit('submitVote', {
        gameId,
        voter: playerSlot,
        voted: selected
      });

      if (submitBtn && submitBtn.node) submitBtn.node.disabled = true;
      this.voteStatus.setText('Vote submitted. Waiting for others...');
    });

    socket.on('votingResults', ({ votes, imposter, correctGuessers, scores, playerMap, players }) => {
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
    });

    socket.on('revote', ({ tiedPlayers }) => {
      const fullTied = tiedPlayers.map(slot =>
        this.votablePlayers.find(p => p.playerSlot === slot) || { playerSlot: slot, playerName: 'Unknown' }
      );

      scene.scene.start('VotingScene', {
        round: this.round,
        votablePlayers: this.votablePlayers,
        tiedPlayers: fullTied,
        playerMap: this.playerMap
      });
    });
  }
}
