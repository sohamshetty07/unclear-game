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
  }

  create() {
    const scene = this;
    this.readyBtn = null;
    this.endBtn = null;
    this.contentGroup = this.add.group();

    let y = 30;

    this.contentGroup.add(this.add.text(30, y, `Round ${this.round} Result`, {
      font: '20px Arial', fill: '#000'
    }));
    y += 40;

    const imposterName = `${this.imposter} - ${this.playerMap[this.imposter] || 'Unknown'}`;
    this.contentGroup.add(this.add.text(30, y, `Imposter: ${imposterName}`, {
      font: '16px Arial', fill: '#555'
    }));
    y += 40;

    Object.entries(this.votes).forEach(([voter, voted]) => {
      const voterName = this.playerMap[voter] || '?';
      const votedName = this.playerMap[voted] || '?';
      this.contentGroup.add(this.add.text(30, y, `${voter} ➜ ${voted}`, {
        font: '14px Arial', fill: '#000'
      }));
      y += 24;
    });

    y += 10;
    this.contentGroup.add(this.add.text(30, y, `Correct Guessers:`, {
      font: '14px Arial', fill: 'green'
    }));
    y += 20;

    const correctNames = this.correctGuessers.map(slot => `${slot} - ${this.playerMap[slot] || ''}`);
    for (let i = 0; i < correctNames.length; i += 3) {
      const chunk = correctNames.slice(i, i + 3).join(', ');
      this.contentGroup.add(this.add.text(30, y, chunk, {
        font: '14px Arial', fill: 'green'
      }));
      y += 20;
    }

    this.readyListText = this.add.text(30, y + 10, 'Players ready: 0', {
      font: '14px Arial', fill: '#333'
    });
    this.contentGroup.add(this.readyListText);

    // Ready Button
    this.readyBtn = this.add.dom(180, y + 60, 'button', {
      fontSize: '16px',
      padding: '6px 18px',
      backgroundColor: '#4CAF50',
      color: '#fff',
      border: 'none',
      borderRadius: '5px'
    }, 'Ready for Next Round');

    this.readyBtn.addListener('click');
    this.readyBtn.on('click', () => {
      if (this.readyBtn && this.readyBtn.node) this.readyBtn.node.disabled = true;
      socket.emit('nextRoundReady', { gameId, playerSlot });
    });

    // End Game Button
    if (this.isHost) {
      this.endBtn = this.add.dom(180, y + 120, 'button', {
        fontSize: '16px',
        padding: '6px 18px',
        backgroundColor: '#f44336',
        color: '#fff',
        border: 'none',
        borderRadius: '5px'
      }, 'End Game');

      this.endBtn.addListener('click');
      this.endBtn.on('click', () => {
        socket.emit('endGame', gameId);
      });
    }

    socket.on('nextRoundStatus', readySlots => {
      const names = readySlots.map(s => {
        const isHostPlayer = this.players.find(p => p.playerSlot === s)?.isHost;
        const crown = isHostPlayer ? ' 👑' : '';
        return `${s} - ${this.playerMap[s] || ''}${crown}`;
      });
      if (this.readyListText) {
        this.readyListText.setText(`Players ready: ${names.length}\n${names.join('\n')}`);
      }
    });

    socket.on('showFinalScores', ({ scores, playerMap }) => {
      scene.scene.start('FinalScoreScene', { scores, playerMap });
    });
  }
}
