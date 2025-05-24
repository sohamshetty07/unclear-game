class LandingScene extends Phaser.Scene {
  constructor() {
    super('LandingScene');
  }
  create() {
    this.cameras.main.setBackgroundColor('#f9f9f9');

    // 🎮 Game Title
    this.add.text(180, 80, 'Welcome to UnClear 🕵️‍♂️', {
      font: 'bold 24px Arial',
      fill: '#111',
      align: 'center'
    }).setOrigin(0.5);

    // ✨ Subtitle
    this.add.text(180, 120, 'A real-time word guessing game of deception\nand deduction.', {
      font: '16px Arial',
      fill: '#555',
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5);

    // 📘 How to Play title
    this.add.text(180, 180, 'How to Play', {
      font: 'bold 18px Arial',
      fill: '#0066ff',
      align: 'center'
    }).setOrigin(0.5);

    // 📜 Instructions
    this.add.text(180, 230,
      '✅ Join a game or host one by leaving the Game ID blank.\n' +
      '🧠 Everyone gets the same word — except the Imposter.\n' +
      '💬 Take turns giving verbal clues based on your word.\n' +
      '🎯 Vote on the Imposter — score points if correct!',
      {
        font: '14px Arial',
        fill: '#333',
        align: 'left',
        wordWrap: { width: 280 },
        lineSpacing: 6
      }
    ).setOrigin(0.5, 0);

    // 🔘 Start Button
    const startBtn = this.add.dom(180, 460, 'button', {
      fontSize: '18px',
      padding: '12px 30px',
      backgroundColor: '#0066ff',
      color: '#fff',
      border: 'none',
      borderRadius: '12px',
      fontWeight: 'bold',
      boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
      cursor: 'pointer'
    }, 'Start Game');

    startBtn.addListener('click');
    startBtn.on('click', () => {
      this.scene.start('JoinScene');
    });

    // 🔁 Subtle Animation
    this.tweens.add({
      targets: startBtn,
      scale: 1.04,
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // 🧼 Optional fade-in for the whole screen
    this.cameras.main.fadeIn(500, 255, 255, 255);
  }
}
