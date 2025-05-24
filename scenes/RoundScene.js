class RoundScene extends Phaser.Scene {
  constructor() {
    super('RoundScene');
  }

  init(data) {
    this.word = data.word;
    this.turnOrder = data.turnOrder;
    this.currentClueTurn = data.currentClueTurn;
    this.round = data.round;
  }

  create() {
    this.scene.stop('ResultScene');

    this.add.text(30, 30, `Round ${this.round}`, { font: '18px Arial', fill: '#000' });
    this.add.text(30, 60, `Your Word: ${this.word}`, { font: '16px Arial', fill: '#333' });

    this.clueText = this.add.text(30, 110, `Waiting for your turn...`, {
      font: '16px Arial', fill: '#000'
    });

    const nextBtn = this.add.dom(180, 500, 'button', {
      fontSize: '16px',
      padding: '6px 16px',
      backgroundColor: '#2196F3',
      color: '#fff',
      border: 'none',
      borderRadius: '5px',
      display: 'none'
    }, 'Next');

    nextBtn.addListener('click');
    nextBtn.on('click', () => {
      if (playerSlot !== this.currentClueTurn) {
        alert("It's not your turn yet. Please wait.");
        return;
      }

      socket.emit('nextClue', gameId);
      if (nextBtn && nextBtn.node) nextBtn.node.style.display = 'none';
      this.clueText.setText('Waiting for others...');
    });

    socket.on('nextClueTurn', newTurn => {
      this.currentClueTurn = newTurn;
      if (playerSlot === newTurn) {
        this.clueText.setText(`It's your turn. Give a clue based on your word.`);
        if (nextBtn && nextBtn.node) nextBtn.node.style.display = 'block';
      } else {
        this.clueText.setText(`Waiting for ${newTurn} to give a clue...`);
        if (nextBtn && nextBtn.node) nextBtn.node.style.display = 'none';
      }
    });

    socket.on('beginVoting', ({ players }) => {
      const others = players.filter(p => p.playerSlot !== playerSlot);
      this.scene.start('VotingScene', {
        round: this.round,
        votablePlayers: others
      });
    });

    if (playerSlot === this.currentClueTurn) {
      this.clueText.setText(`It's your turn. Give a clue based on your word.`);
      if (nextBtn && nextBtn.node) nextBtn.node.style.display = 'block';
    }
  }
}
