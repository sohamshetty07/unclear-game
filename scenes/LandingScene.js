class LandingScene extends Phaser.Scene {
  constructor() {
    super('LandingScene');
  }
  create() {
    this.cameras.main.setBackgroundColor('#F5F5F5');

    // Access the global isRejoining flag (set in game.js)
    if (window.isRejoining === true) {
      // Display synchronizing message
      this.add.text(180, 320, 'Synchronizing with server...', {
        fontFamily: 'Roboto', // Match style
        fontSize: '20px',
        color: 'var(--text-color)', // Use CSS variable
        align: 'center'
      }).setOrigin(0.5);
      
      // Optional: fade in the "Synchronizing" message
      this.cameras.main.fadeIn(500, 0, 0, 0);

      // The scene will wait here until 'syncToScene' event (handled in game.js)
      // transitions it to the correct game scene.
      console.log('[LandingScene] In rejoining state, waiting for server sync.');

    } else {
      // Proceed with normal landing page setup
      console.log('[LandingScene] Not rejoining, setting up normal landing page.');

      // 🎮 Game Title
      this.add.text(180, 70, 'Welcome to UnClear 🕵️‍♂️', { // Adjusted Y
        fontFamily: 'Roboto',
        fontSize: '32px', // Increased font size
        color: 'var(--text-color)',
        fontStyle: 'bold',
        align: 'center'
      }).setOrigin(0.5);

      // ✨ Subtitle
      this.add.text(180, 115, 'A real-time word guessing game of deception\nand deduction.', { // Adjusted Y
        fontFamily: 'Roboto',
        fontSize: '16px',
        color: 'var(--secondary-accent-color)',
        align: 'center',
        lineSpacing: 4
      }).setOrigin(0.5);

      // 📘 How to Play title
      this.add.text(180, 170, 'How to Play', { // Adjusted Y
        fontFamily: 'Roboto',
        fontSize: '22px', // Increased font size
        color: 'var(--primary-accent-color)',
        fontStyle: 'bold',
        align: 'center'
      }).setOrigin(0.5);

      // 📜 Instructions
      const instructions = [
        '• Join a game or host one by leaving the Game ID blank.',
        '• Everyone gets the same word — except the Imposter.',
        '• Take turns giving verbal clues based on your word.',
        '• Vote on the Imposter — score points if correct!'
      ];
      this.add.text(180, 260, instructions.join('\n'), { // Adjusted Y and content
          fontFamily: 'Roboto',
          fontSize: '15px', // Slightly increased font size
          color: 'var(--text-color)',
          align: 'left',
          wordWrap: { width: 300 }, // Adjusted width for bullets
          lineSpacing: 8 // Increased line spacing
        }
      ).setOrigin(0.5); // Centered the block of text

      // 🔘 Start Button - Adjust Y position
      const startBtnY = 370; // Position Start button 
      const startBtn = this.add.dom(180, startBtnY, 'button', null, 'Start Game').setClassName('button');
      startBtn.node.style.transform = 'scale(0.8)'; // Initial scale for pop-in via CSS

      this.tweens.add({
        targets: startBtn.node, // Target the actual HTML element for DOM tweens
        scale: 1,
        ease: 'Back.easeOut',
        duration: 300,
        delay: 500 // Delay after difficulty buttons
      });
      
      startBtn.addListener('click');
      startBtn.on('click', () => {
        console.log("PLAY_SOUND: click.mp3");
        this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
          if (progress === 1) {
            console.log("PLAY_SOUND: transition.mp3");
            this.scene.start('JoinScene');
          }
        });
      });

      // 🔁 Subtle Animation (existing hover/pulse for start button)
      // Keep this if desired, or remove if pop-in is enough entry animation
      this.tweens.add({
        targets: startBtn, // This targets the Phaser DOM GameObject wrapper
        scaleX: 1.04, // Phaser DOM GameObjects are scaled with scaleX, scaleY
        scaleY: 1.04,
        duration: 1000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: 800 // Delay until after pop-in
      });

      // 🧼 Optional fade-in for the whole screen
      this.cameras.main.fadeIn(500, 0, 0, 0); // Fade from black
    }
  }
}
