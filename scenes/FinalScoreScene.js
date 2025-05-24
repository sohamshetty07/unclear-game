class FinalScoreScene extends Phaser.Scene {
  constructor() {
    super('FinalScoreScene');
  }

  init(data) {
    this.scores = data.scores;
    this.playerMap = data.playerMap;
  }

  create() {
    this.cameras.main.setBackgroundColor('#f8f8f8');

    this.add.text(80, 30, '🏆 Final Leaderboard', {
      font: '22px Arial', fill: '#000', fontStyle: 'bold'
    });

    const medalIcons = ['🥇', '🥈', '🥉'];

    const sorted = Object.entries(this.scores)
      .sort(([, a], [, b]) => b - a)
      .map(([slot, score], index) => {
        const name = this.playerMap[slot] || 'Unknown';
        const label = medalIcons[index] || `${index + 1}.`;
        return `${label} ${slot} - ${name} ➜ ${score} pts`;
      });

    let y = 80;
    sorted.forEach(entry => {
      this.add.text(30, y, entry, { font: '16px Arial', fill: '#333' });
      y += 28;
    });

    const restartBtn = this.add.dom(180, y + 40, 'button', {
      fontSize: '16px',
      padding: '6px 16px',
      backgroundColor: '#4CAF50',
      color: '#fff',
      border: 'none',
      borderRadius: '5px'
    }, 'Play Again');

    restartBtn.addListener('click');
    restartBtn.on('click', () => {
      clearStoredPlayerData();
      location.reload();
    });

    this.add.text(30, y + 80, '🎉 Thank you for playing UnClear!', {
      font: '14px Arial',
      fill: '#00796B'
    });
  }
}
