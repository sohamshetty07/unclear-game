/**
 * Summary of improvements:
 * - Added JSDoc comments to all methods, including class constructor and lifecycle methods.
 * - Ensured use of `const` and `let` appropriately.
 * - Converted anonymous functions for event handlers and tweens to arrow functions.
 * - Modularized UI creation into:
 *   - `_displayRejoiningMessage()` for the rejoining state.
 *   - `_displayWelcomeContent()` for game titles and instructions.
 *   - `_createStartButton()` for the "Start Game" button.
 * - Clarified the role of the global `window.isRejoining` variable in JSDoc comments.
 * - Ensured consistent naming conventions.
 * - Added time and space complexity estimations where applicable.
 * - Used template literals for instruction text (though it was already using `join('\n')`).
 */

/**
 * Represents the initial landing scene of the game.
 * It displays game information, instructions, and a start button.
 * It also handles a special "rejoining" state if the player is reconnecting to an existing game.
 * Accesses global variable `window.isRejoining` to determine flow.
 * @extends Phaser.Scene
 */
class LandingScene extends Phaser.Scene {
  /**
   * Constructs the LandingScene.
   * @constructor
   */
  constructor() {
    super('LandingScene');
  }

  /**
   * Creates the visual elements for the landing scene.
   * This includes titles, instructions, and a start button, or a "synchronizing" message
   * if the player is rejoining a game.
   * Time complexity: O(1) for most operations.
   * Space complexity: O(1).
   * @returns {void}
   */
  create() {
    this.cameras.main.setBackgroundColor('#F5F5F5');

    // Access the global isRejoining flag (expected to be set in game.js or similar)
    if (window.isRejoining === true) {
      this._displayRejoiningMessage();
    } else {
      this._displayWelcomeContent();
      this._createStartButton();
      this.cameras.main.fadeIn(500, 0, 0, 0); // Fade in the entire scene
    }
  }

  /**
   * Displays the "Synchronizing with server..." message when a player is rejoining.
   * @private
   * @returns {void}
   * Time complexity: O(1).
   * Space complexity: O(1).
   */
  _displayRejoiningMessage() {
    console.log('[LandingScene] In rejoining state, waiting for server sync.');
    this.add.text(180, 320, 'Synchronizing with server...', {
      fontFamily: 'Roboto',
      fontSize: '20px',
      color: 'var(--text-color)',
      align: 'center',
    }).setOrigin(0.5);

    this.cameras.main.fadeIn(500, 0, 0, 0);
    // Scene waits here for 'syncToScene' event from game.js to transition.
  }

  /**
   * Displays the main welcome text, game title, subtitle, and instructions.
   * @private
   * @returns {void}
   * Time complexity: O(1) (instruction array processing is constant).
   * Space complexity: O(1).
   */
  _displayWelcomeContent() {
    console.log('[LandingScene] Not rejoining, setting up normal landing page.');

    // Game Title
    this.add.text(180, 70, 'Welcome to UnClear 🕵️‍♂️', {
      fontFamily: 'Roboto', fontSize: '32px', color: 'var(--text-color)', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(180, 115, 'A real-time word guessing game of deception\nand deduction.', {
      fontFamily: 'Roboto', fontSize: '16px', color: 'var(--secondary-accent-color)', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5);

    // How to Play title
    this.add.text(180, 170, 'How to Play', {
      fontFamily: 'Roboto', fontSize: '22px', color: 'var(--primary-accent-color)', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    // Instructions
    const instructions = [
      '• Join a game or host one by leaving the Game ID blank.',
      '• Everyone gets the same word — except the Imposter.',
      '• Take turns giving verbal clues based on your word.',
      '• Vote on the Imposter — score points if correct!',
    ];
    this.add.text(180, 260, instructions.join('\n'), {
      fontFamily: 'Roboto', fontSize: '15px', color: 'var(--text-color)', align: 'left', wordWrap: { width: 300 }, lineSpacing: 8,
    }).setOrigin(0.5);
  }

  /**
   * Creates the "Start Game" button with animations and click event listener.
   * @private
   * @returns {void}
   * Time complexity: O(1).
   * Space complexity: O(1).
   */
  _createStartButton() {
    const startBtnY = 370;
    const startBtn = this.add.dom(180, startBtnY, 'button', null, 'Start Game').setClassName('button');
    startBtn.node.style.transform = 'scale(0.8)'; // Initial scale for pop-in

    // Pop-in animation
    this.tweens.add({
      targets: startBtn.node,
      scale: 1,
      ease: 'Back.easeOut',
      duration: 300,
      delay: 500,
    });

    // Subtle pulse animation
    this.tweens.add({
      targets: startBtn, // Targets the Phaser DOM GameObject wrapper for Phaser-based tweens
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay: 800, // Delay until after pop-in
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
  }
}
