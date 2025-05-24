class LandingScene extends Phaser.Scene {
  constructor() {
    super('LandingScene');
  }
  create() {
    this.cameras.main.setBackgroundColor('var(--background-color)');

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

    // --- Initialize Difficulty Selection ---
    this.selectedDifficulty = 'easy'; // Default difficulty

    // --- Difficulty Selection Title ---
    const difficultyTitleY = 330; // New Y for difficulty title
    this.add.text(180, difficultyTitleY, 'Select Difficulty', {
      fontFamily: 'Roboto',
      fontSize: '20px',
      color: 'var(--text-color)', // Using text-color, could be primary-accent for more emphasis
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    // --- Difficulty Options ---
    const difficultyOptionsY = difficultyTitleY + 40;
    const optionStyle = {
      fontFamily: 'Roboto',
      fontSize: '16px',
      color: 'var(--white-color)', // Text color for buttons
      backgroundColor: 'var(--secondary-accent-color)', // Default background
      padding: { x: 15, y: 8 },
      borderRadius: '5px' // This is a Phaser 3.60 feature for text background
    };
    const selectedOptionStyle = {
      ...optionStyle,
      backgroundColor: 'var(--primary-accent-color)', // Selected background
      // fontStyle: 'bold' // Optionally make selected text bold
    };

    this.easyBtn = this.add.text(90, difficultyOptionsY, 'Easy', optionStyle).setOrigin(0.5).setInteractive();
    this.mediumBtn = this.add.text(180, difficultyOptionsY, 'Medium', optionStyle).setOrigin(0.5).setInteractive();
    this.hardBtn = this.add.text(270, difficultyOptionsY, 'Hard', optionStyle).setOrigin(0.5).setInteractive();

    const updateDifficultySelectionUI = () => {
      this.easyBtn.setStyle(this.selectedDifficulty === 'easy' ? selectedOptionStyle : optionStyle);
      this.mediumBtn.setStyle(this.selectedDifficulty === 'medium' ? selectedOptionStyle : optionStyle);
      this.hardBtn.setStyle(this.selectedDifficulty === 'hard' ? selectedOptionStyle : optionStyle);
      // Apply rounded corners if Text.setBackgroundColor supports it or handle via DOM if not.
      // For Phaser 3.60+, background radius is part of padding object.
      // For older versions, this might need DOM elements or custom graphics for rounded corners.
      // Assuming modern Phaser for 'borderRadius' in style.
    };
    
    this.easyBtn.on('pointerdown', () => {
      console.log("PLAY_SOUND: click.mp3");
      this.selectedDifficulty = 'easy';
      updateDifficultySelectionUI();
      console.log('Selected difficulty:', this.selectedDifficulty);
    });
    this.mediumBtn.on('pointerdown', () => {
      console.log("PLAY_SOUND: click.mp3");
      this.selectedDifficulty = 'medium';
      updateDifficultySelectionUI();
      console.log('Selected difficulty:', this.selectedDifficulty);
    });
    this.hardBtn.on('pointerdown', () => {
      console.log("PLAY_SOUND: click.mp3");
      this.selectedDifficulty = 'hard';
      updateDifficultySelectionUI();
      console.log('Selected difficulty:', this.selectedDifficulty);
    });

    updateDifficultySelectionUI(); // Initialize UI based on default

    // Animate Difficulty Buttons
    const difficultyButtons = [this.easyBtn, this.mediumBtn, this.hardBtn];
    difficultyButtons.forEach((btn, index) => {
      btn.setScale(0.8); // Initial scale for pop-in
      this.tweens.add({
        targets: btn,
        scale: 1,
        ease: 'Back.easeOut',
        duration: 300,
        delay: 100 + index * 100 // Stagger the animation
      });
    });

    // 🔘 Start Button - Adjust Y position
    const startBtnY = difficultyOptionsY + 70; // Position Start button below difficulty options
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
          this.scene.start('JoinScene', { difficulty: this.selectedDifficulty });
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
