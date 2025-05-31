/**
 * Summary of improvements:
 * - Added JSDoc comments to all methods.
 * - Used `const` and `let` appropriately.
 * - Converted anonymous functions to arrow functions (for socket handlers and tween callbacks).
 * - Employed template literals for string construction.
 * - Utilized destructuring for `init` method parameters and socket event data.
 * - Modularized UI creation and logic into private helper methods:
 *   - `_displayStaticInfo()`: For round number and player's word.
 *   - `_createTimerDisplay()`: Sets up the timer text object.
 *   - `_createClueInteractionArea()`: Sets up clue text and the "Next" button.
 *   - `_animateClueTextUpdate(newText)`: Handles smooth text transitions for clue display.
 *   - `_updateTurnDisplay()`: Centralizes logic for updating UI based on whose turn it is.
 *   - `_setupSocketListeners()`: Centralizes Socket.IO event listener setup.
 *   - `_transitionToScene(sceneKey, data, logMessage)`: Utility for scene transitions.
 * - Implemented a `shutdown()` method for robust listener cleanup.
 * - Ensured consistent naming conventions.
 * - Removed redundant initial animation call for clue text; integrated into `_updateTurnDisplay`.
 * - Assumed global variables `socket`, `gameId`, `playerSlot` are managed externally.
 */

/**
 * Represents the core gameplay scene where players see their word and take turns giving clues.
 * Manages UI updates based on game state received via Socket.IO events.
 * Assumes `socket`, `gameId`, `playerSlot` are globally available or managed by a higher-level state.
 * @extends Phaser.Scene
 */
class RoundScene extends Phaser.Scene {
  /**
   * Constructs the RoundScene.
   * @constructor
   */
  constructor() {
    super('RoundScene');
    /** @private @type {string} The word assigned to the player for this round. */
    this.word = '';
    /** @private @type {Array<string>} The order of players for giving clues. */
    this.turnOrder = [];
    /** @private @type {string} The playerSlot of the player whose turn it is to give a clue. */
    this.currentClueTurn = '';
    /** @private @type {number} The current round number. */
    this.round = 0;

    /** @private @type {Phaser.GameObjects.Text} Text object for displaying the timer. */
    this.timerText = null;
    /** @private @type {Phaser.GameObjects.Text} Text object for displaying clue instructions/status. */
    this.clueText = null;
    /** @private @type {Phaser.GameObjects.DOMElement} DOM element for the "Next" button. */
    this.nextButton = null;
  }

  /**
   * Initializes the scene with data passed from the previous scene.
   * @param {object} data - Data object from the previous scene.
   * @param {string} data.word - The player's word.
   * @param {Array<string>} data.turnOrder - Order of turns.
   * @param {string} data.currentClueTurn - Whose turn it is.
   * @param {number} data.round - Current round number.
   * @returns {void}
   */
  init({ word, turnOrder, currentClueTurn, round }) {
    this.word = word;
    this.turnOrder = turnOrder;
    this.currentClueTurn = currentClueTurn;
    this.round = round;
    console.log(`[RoundScene] Initialized. Round: ${this.round}, Word: ${this.word}, Turn: ${this.currentClueTurn}, Turn Order: ${this.turnOrder.join(', ')}`);
  }

  /**
   * Creates the visual elements, event handlers, and initializes socket communications for the round.
   * Time complexity: O(1) for most operations.
   * Space complexity: O(1) for scene elements.
   * @returns {void}
   */
  create() {
    this.scene.stop('ResultScene'); // Ensure ResultScene is stopped if it was active
    this.cameras.main.setBackgroundColor('#F5F5F5');
    this.cameras.main.fadeIn(300, 0, 0, 0);
    console.log("PLAY_SOUND: transition.mp3");

    this._displayStaticInfo();
    this._createTimerDisplay();
    this._createClueInteractionArea();
    this._setupSocketListeners();
    this._updateTurnDisplay(); // Initial UI setup based on whose turn it is
  }

  /**
   * Displays static information like round number and the player's word.
   * @private
   * @returns {void}
   */
  _displayStaticInfo() {
    this.add.text(180, 50, `Round ${this.round}`, {
      fontFamily: 'Roboto', fontSize: '24px', color: 'var(--text-color)', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    this.add.text(180, 90, `Your Word: ${this.word}`, {
      fontFamily: 'Roboto', fontSize: '20px', color: 'var(--primary-accent-color)', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);
  }

  /**
   * Creates the timer display text object.
   * @private
   * @returns {void}
   */
  _createTimerDisplay() {
    this.timerText = this.add.text(180, 20, '', {
      fontFamily: 'Roboto', fontSize: '16px', color: 'var(--primary-accent-color)', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setVisible(false); // Initially hidden
  }

  /**
   * Creates the clue text display and the "Next" button.
   * @private
   * @returns {void}
   */
  _createClueInteractionArea() {
    this.clueText = this.add.text(180, 250, '', { // Initial text set by _updateTurnDisplay
      fontFamily: 'Roboto', fontSize: '16px', color: 'var(--secondary-accent-color)', align: 'center', wordWrap: { width: 320 },
    }).setOrigin(0.5).setAlpha(0); // Start transparent for fade-in

    this.nextButton = this.add.dom(180, 550, 'button', null, 'Next').setClassName('button');
    this.nextButton.node.style.display = 'none'; // Initially hidden
    this.nextButton.node.style.transform = 'scale(0.8)';

    this.nextButton.addListener('click').on('click', () => {
      if (playerSlot !== this.currentClueTurn) {
        alert("It's not your turn yet. Please wait.");
        return;
      }
      console.log("PLAY_SOUND: click.mp3");
      socket.emit('nextClue', gameId);
      this._showOrHideNextButton(false);
      this._animateClueTextUpdate('Waiting for others...');
    });
  }

  /**
   * Animates the update of the clue text.
   * @param {string} newText - The new text to display.
   * @private
   * @returns {void}
   */
  _animateClueTextUpdate(newText) {
    if (!this.clueText) return;
    this.tweens.add({
      targets: this.clueText,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        this.clueText.setText(newText);
        this.tweens.add({
          targets: this.clueText,
          alpha: 1,
          duration: 150,
          ease: 'Power2',
        });
      },
    });
  }

  /**
   * Shows or hides the "Next" button with an animation.
   * @param {boolean} show - True to show, false to hide.
   * @private
   * @returns {void}
   */
  _showOrHideNextButton(show) {
    if (!this.nextButton?.node) return;

    if (show) {
      this.nextButton.node.style.display = 'block';
      this.tweens.add({
        targets: this.nextButton.node, scale: 1, ease: 'Back.easeOut', duration: 300,
      });
    } else {
      this.tweens.add({
        targets: this.nextButton.node,
        scale: 0.8,
        ease: 'Back.easeIn',
        duration: 200,
        onComplete: () => {
          if (this.nextButton?.node) this.nextButton.node.style.display = 'none';
        },
      });
    }
  }

  /**
   * Updates the clue text and "Next" button visibility based on the current turn.
   * @private
   * @returns {void}
   */
  _updateTurnDisplay() {
    const isMyTurn = playerSlot === this.currentClueTurn;
    if (isMyTurn) {
      this._animateClueTextUpdate(`It's your turn. Give a clue based on your word.`);
      this._showOrHideNextButton(true);
      console.log(`[RoundScene] It's MY turn.`);
    } else {
      this._animateClueTextUpdate(`Waiting for ${this.currentClueTurn} to give a clue...`);
      this._showOrHideNextButton(false);
    }
  }

  /**
   * Sets up Socket.IO event listeners for the scene.
   * @private
   * @returns {void}
   */
  _setupSocketListeners() {
    socket.on('nextClueTurn', this._handleNextClueTurn);
    socket.on('timerUpdate', this._handleTimerUpdate);
    socket.on('beginVoting', this._handleBeginVoting);
  }

  /**
   * Handles the 'nextClueTurn' event from the server.
   * @param {string} newTurnPlayerSlot - The playerSlot of the player whose turn it is now.
   * @private
   */
  _handleNextClueTurn = (newTurnPlayerSlot) => {
    this.currentClueTurn = newTurnPlayerSlot;
    console.log(`[RoundScene] Next clue turn: ${this.currentClueTurn}. My slot: ${playerSlot}`);
    this._updateTurnDisplay();
  }

  /**
   * Handles the 'timerUpdate' event from the server.
   * @param {object} data - Timer update data.
   * @param {string} data.phase - Current game phase (e.g., 'clue').
   * @param {number} data.timeLeft - Time remaining in seconds.
   * @private
   */
  _handleTimerUpdate = ({ phase, timeLeft }) => {
    if (phase === 'clue' && timeLeft > 0) {
      this.timerText.setText(`Time: ${timeLeft}s`).setVisible(true);
    } else {
      this.timerText.setVisible(false);
    }
  }

  /**
   * Handles the 'beginVoting' event, transitioning to the VotingScene.
   * @param {object} data - Data for beginning voting.
   * @param {Array<object>} data.players - All players in the game.
   * @private
   */
  _handleBeginVoting = ({ players }) => {
    const others = players.filter(p => p.playerSlot !== playerSlot);
    this._transitionToScene('VotingScene', { round: this.round, votablePlayers: others }, '[RoundScene] Received beginVoting.');
  }

  /**
   * Utility function to handle scene transitions with a fade-out effect.
   * @param {string} sceneKey - The key of the scene to transition to.
   * @param {object} [data={}] - Optional data to pass to the next scene's init method.
   * @param {string} [logMessage='Transitioning scenes.'] - Optional message for logging.
   * @private
   */
  _transitionToScene(sceneKey, data = {}, logMessage = 'Transitioning scenes.') {
    if (!this.scene.isActive()) {
      console.warn(`[RoundScene] Transition to ${sceneKey} requested, but scene not active. Ignoring.`);
      return;
    }
    console.log(logMessage);
    if (this.timerText) this.timerText.setVisible(false); // Hide timer before scene change

    this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
      if (progress === 1) {
        if (!this.scene.isActive()) { // Double check after fade
           console.warn(`[RoundScene] FadeOut for ${sceneKey} complete, but scene not active. Ignoring scene start.`);
          return;
        }
        console.log("PLAY_SOUND: transition.mp3");
        this.scene.start(sceneKey, data); // scene.start also stops current scene and its listeners
      }
    });
  }

  /**
   * Cleans up listeners when the scene is shut down.
   * @returns {void}
   */
  shutdown() {
    console.log('[RoundScene] Shutdown called. Removing listeners.');
    socket.off('nextClueTurn', this._handleNextClueTurn);
    socket.off('timerUpdate', this._handleTimerUpdate);
    socket.off('beginVoting', this._handleBeginVoting);
  }
}
