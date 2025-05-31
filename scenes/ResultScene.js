/**
 * Summary of improvements:
 * - Added JSDoc comments to all methods.
 * - Used `const` and `let` appropriately.
 * - Converted anonymous functions to arrow functions.
 * - Employed template literals for string construction.
 * - Utilized destructuring for `init` method parameters and socket event data.
 * - Modularized UI creation and logic into private helper methods:
 *   - `_playOutcomeSound()`: Determines and plays sound based on voting result.
 *   - `_displayTitle(yPosition)`: Displays the main "Round X Result" title.
 *   - `_displayImposter(yPosition)`: Displays imposter information.
 *   - `_displayVotes(yPosition)`: Displays the vote breakdown.
 *   - `_displayCorrectGuessers(yPosition)`: Displays who guessed correctly.
 *   - `_createControls(yPosition)`: Creates "Ready" button, "End Game" button (for host), and ready player list.
 *   - `_setupSocketListeners()`: Centralizes Socket.IO event listener setup.
 *   - `_transitionToScene(sceneKey, data, logMessage)`: Utility for scene transitions.
 * - Implemented a `shutdown()` method for robust listener cleanup.
 * - Ensured consistent naming conventions (e.g., `readyBtn` to `readyButton`).
 * - Removed redundant `const scene = this;`.
 * - Clarified Y-positioning logic by having helper functions return the next Y position or consumed height.
 * - Assumed global variables `socket`, `gameId`, `playerSlot` are managed externally.
 */

/**
 * Represents the scene that displays the results of a voting round.
 * Shows who was voted out, the imposter, correct guessers, and current scores.
 * Allows players to ready up for the next round or the host to end the game.
 * Assumes `socket`, `gameId`, `playerSlot` are globally available or managed by a higher-level state.
 * @extends Phaser.Scene
 */
class ResultScene extends Phaser.Scene {
  /**
   * Constructs the ResultScene.
   * @constructor
   */
  constructor() {
    super('ResultScene');
    /** @private @type {number} The current round number. */
    this.round = 0;
    /** @private @type {object} Object detailing votes cast. */
    this.votes = {};
    /** @private @type {string} The playerSlot of the imposter. */
    this.imposter = '';
    /** @private @type {Array<string>} List of playerSlots who correctly guessed the imposter. */
    this.correctGuessers = [];
    /** @private @type {object} Current game scores. */
    this.scores = {};
    /** @private @type {object} Map of playerSlots to player names. */
    this.playerMap = {};
    /** @private @type {boolean} Whether the current player is the host. */
    this.isHost = false;
    /** @private @type {Array<object>} List of all player objects. */
    this.players = [];
    /** @private @type {string|null} The playerSlot of the player voted out, if any. */
    this.votedOut = null;

    /** @private @type {Phaser.GameObjects.Text} Text object for the ready player list. */
    this.readyListText = null;
    /** @private @type {Phaser.GameObjects.DOMElement} DOM element for the "Ready" button. */
    this.readyButton = null;
    /** @private @type {Phaser.GameObjects.DOMElement} DOM element for the "End Game" button. */
    this.endGameButton = null;
  }

  /**
   * Initializes the scene with data passed from the previous scene.
   * @param {object} data - The data object from the previous scene.
   * @param {number} data.round - Current round number.
   * @param {object} data.votes - Votes cast in the round.
   * @param {string} data.imposter - The imposter's playerSlot.
   * @param {Array<string>} data.correctGuessers - Players who guessed correctly.
   * @param {object} data.scores - Current scores.
   * @param {object} [data.playerMap={}] - Mapping of playerSlots to names.
   * @param {boolean} [data.isHost=false] - If the current player is the host.
   * @param {Array<object>} [data.players=[]] - Array of player objects.
   * @param {string|null} data.votedOut - The playerSlot of the player voted out.
   * @returns {void}
   */
  init(data) {
    const {
      round, votes, imposter, correctGuessers, scores,
      playerMap = {}, isHost = false, players = [], votedOut,
    } = data;
    this.round = round;
    this.votes = votes;
    this.imposter = imposter;
    this.correctGuessers = correctGuessers;
    this.scores = scores;
    this.playerMap = playerMap;
    this.isHost = isHost;
    this.players = players;
    this.votedOut = votedOut;
  }

  /**
   * Creates the visual elements, event handlers, and initializes socket communications.
   * Time complexity: O(N) where N is the number of players/votes for display generation.
   * Space complexity: O(N) for storing text elements related to players/votes.
   * @returns {void}
   */
  create() {
    this.cameras.main.setBackgroundColor('#F5F5F5');
    this.cameras.main.fadeIn(300, 0, 0, 0);

    console.log(`[ResultScene] Create. Imposter: ${this.imposter}, Voted Out: ${this.votedOut}`);
    console.log(`[ResultScene] Correct Guessers:`, this.correctGuessers);

    this._playOutcomeSound();

    let currentYPosition = 50;
    currentYPosition = this._displayTitle(currentYPosition);
    currentYPosition = this._displayImposterInfo(currentYPosition);
    currentYPosition = this._displayVotes(currentYPosition);
    currentYPosition = this._displayCorrectGuessers(currentYPosition);
    this._createControls(currentYPosition); // Controls manage their own final Y adjustments

    this._setupSocketListeners();
  }

  /**
   * Plays a sound based on whether the imposter was correctly identified.
   * @private
   * @returns {void}
   */
  _playOutcomeSound() {
    if (this.votedOut) {
      const soundKey = (this.imposter === this.votedOut) ? 'correct.mp3' : 'incorrect.mp3';
      console.log(`PLAY_SOUND: ${soundKey}`);
    } else {
      console.log("PLAY_SOUND: incorrect.mp3"); // Imposter survived
    }
  }

  /**
   * Displays the round result title.
   * @param {number} yPosition - The current Y position for layout.
   * @returns {number} The Y position after adding the title.
   * @private
   */
  _displayTitle(yPosition) {
    this.add.text(180, yPosition, `Round ${this.round} Result`, {
      fontFamily: 'Roboto', fontSize: '24px', color: 'var(--text-color)', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);
    return yPosition + 40;
  }

  /**
   * Displays information about the imposter.
   * @param {number} yPosition - The current Y position for layout.
   * @returns {number} The Y position after adding the imposter info.
   * @private
   */
  _displayImposterInfo(yPosition) {
    const imposterPlayer = this.players.find(p => p.playerSlot === this.imposter);
    const imposterAvatar = imposterPlayer?.avatar || '';
    const imposterNameStr = `${imposterAvatar} ${this.imposter} - ${this.playerMap[this.imposter] || 'Unknown'}`;
    const imposterNameText = this.add.text(180, yPosition, `Imposter: ${imposterNameStr}`, {
      fontFamily: 'Roboto', fontSize: '18px', color: 'var(--primary-accent-color)', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: imposterNameText,
      scale: { from: 0.8, to: 1 },
      alpha: { from: 0.5, to: 1 },
      ease: 'Elastic.easeOut',
      duration: 600,
      delay: 200,
    });
    return yPosition + 40;
  }

  /**
   * Displays the votes cast in the round.
   * @param {number} yPosition - The current Y position for layout.
   * @returns {number} The Y position after adding the votes display.
   * @private
   * Time complexity: O(V) where V is the number of votes.
   */
  _displayVotes(yPosition) {
    const voteTextLines = ['Votes:'];
    if (Object.keys(this.votes).length > 0) {
      Object.entries(this.votes).forEach(([voterSlot, votedSlot]) => {
        const voterPlayer = this.players.find(p => p.playerSlot === voterSlot);
        const votedPlayer = this.players.find(p => p.playerSlot === votedSlot);
        const voterAvatar = voterPlayer?.avatar || '';
        const votedAvatar = votedPlayer?.avatar || '';
        const voterName = `${voterAvatar} ${this.playerMap[voterSlot] || '?'}`;
        const votedName = `${votedAvatar} ${this.playerMap[votedSlot] || '?'}`;
        voteTextLines.push(`${voterName} ➜ ${votedName}`);
      });
    } else {
      voteTextLines.push('No votes were cast.');
    }
    const votesDisplay = this.add.text(180, yPosition, voteTextLines.join('\n'), {
      fontFamily: 'Roboto', fontSize: '14px', color: 'var(--text-color)', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);
    return yPosition + votesDisplay.height + 20;
  }

  /**
   * Displays the list of players who correctly guessed the imposter.
   * @param {number} yPosition - The current Y position for layout.
   * @returns {number} The Y position after adding the correct guessers display.
   * @private
   * Time complexity: O(C) where C is the number of correct guessers.
   */
  _displayCorrectGuessers(yPosition) {
    this.add.text(180, yPosition, `Correct Guessers:`, {
      fontFamily: 'Roboto', fontSize: '16px', color: 'var(--success-color)', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);
    yPosition += 25;

    const correctNames = this.correctGuessers.map(slot => {
      const player = this.players.find(p => p.playerSlot === slot);
      const avatar = player?.avatar || '';
      return `${avatar} ${this.playerMap[slot] || slot}`;
    });
    const correctGuessersText = this.add.text(180, yPosition, correctNames.join(', ') || 'None', {
      fontFamily: 'Roboto', fontSize: '14px', color: 'var(--success-color)', align: 'center', wordWrap: { width: 320 },
    }).setOrigin(0.5, 0);

    if (this.correctGuessers.length > 0) {
      this.tweens.add({
        targets: correctGuessersText,
        scale: { from: 1.1, to: 1 },
        duration: 400,
        ease: 'Sine.easeInOut',
        delay: 400,
      });
    }
    return yPosition + correctGuessersText.height + 30;
  }

  /**
   * Creates the "Ready" button, "End Game" button (for host), and the ready player list.
   * @param {number} yPosition - The current Y position for layout.
   * @private
   * @returns {void}
   */
  _createControls(yPosition) {
    let currentButtonY = yPosition;
    this.readyListText = this.add.text(180, currentButtonY, 'Players ready: 0', {
      fontFamily: 'Roboto', fontSize: '14px', color: 'var(--secondary-accent-color)', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);
    currentButtonY += this.readyListText.height + 20;

    this.readyButton = this.add.dom(180, currentButtonY, 'button', null, 'Ready for Next Round').setClassName('button');
    this.readyButton.setOrigin(0.5);
    this.readyButton.node.style.transform = 'scale(0.8)';
    this.tweens.add({
      targets: this.readyButton.node, scale: 1, ease: 'Back.easeOut', duration: 300, delay: 600,
    });
    this.readyButton.addListener('click').on('click', () => {
      console.log("PLAY_SOUND: click.mp3");
      if (this.readyButton?.node) {
        this.readyButton.node.disabled = true;
        this.readyButton.node.style.backgroundColor = 'var(--secondary-accent-color)';
      }
      socket.emit('nextRoundReady', { gameId, playerSlot });
    });
    currentButtonY += this.readyButton.height + 20;

    if (this.isHost) {
      this.endGameButton = this.add.dom(180, currentButtonY, 'button', null, 'End Game').setClassName('button');
      this.endGameButton.setOrigin(0.5);
      this.endGameButton.node.style.backgroundColor = 'var(--warning-color)';
      this.endGameButton.node.style.transform = 'scale(0.8)';
      this.tweens.add({
        targets: this.endGameButton.node, scale: 1, ease: 'Back.easeOut', duration: 300, delay: 700,
      });
      this.endGameButton.addListener('click').on('click', () => {
        console.log("PLAY_SOUND: click.mp3");
        socket.emit('endGame', gameId);
      });
    }
  }

  /**
   * Sets up Socket.IO event listeners for the scene.
   * @private
   * @returns {void}
   */
  _setupSocketListeners() {
    socket.on('nextRoundStatus', this._handleNextRoundStatus);
    socket.on('showFinalScores', this._handleShowFinalScores);
    socket.on('startRound', this._handleStartRound);
  }

  /**
   * Handles the 'nextRoundStatus' event from the server, updating the ready player list.
   * @param {Array<string>} readySlots - Array of playerSlots that are ready.
   * @private
   */
  _handleNextRoundStatus = (readySlots) => {
    if (!this.scene.isActive() || !this.readyListText) return;

    const names = readySlots.map(slot => {
      const player = this.players.find(p => p.playerSlot === slot);
      const avatar = player?.avatar || '';
      const isHostPlayer = player?.isHost;
      const crown = isHostPlayer ? ' 👑' : '';
      return `${avatar} ${slot} - ${this.playerMap[slot] || ''}${crown}`;
    });

    const oldTextHeight = this.readyListText.height;
    this.readyListText.setText(`Players ready: ${names.length}\n${names.join('\n')}`);
    const newTextHeight = this.readyListText.height;
    const diffY = newTextHeight - oldTextHeight;

    if (diffY !== 0) { // Adjust button positions if text height changed
      if (this.readyButton) this.readyButton.y += diffY;
      if (this.endGameButton) this.endGameButton.y += diffY;
    }
  }

  /**
   * Handles the 'showFinalScores' event, transitioning to the FinalScoreScene.
   * @param {object} data - Data for the final scores.
   * @param {object} data.scores - Final scores.
   * @private
   */
  _handleShowFinalScores = (data) => {
    this._transitionToScene('FinalScoreScene', { scores: data.scores, players: this.players }, '[ResultScene] Received showFinalScores.');
  }

  /**
   * Handles the 'startRound' event, transitioning to the RoundScene.
   * @param {object} data - Data for starting the new round.
   * @private
   */
  _handleStartRound = (data) => {
    this._transitionToScene('RoundScene', data, `[ResultScene] Received startRound for round ${data.round}.`);
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
      console.warn(`[ResultScene] Transition to ${sceneKey} requested, but scene not active. Ignoring.`);
      return;
    }
    console.log(logMessage);
    this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
      if (progress === 1) {
        if (!this.scene.isActive()) { // Double check after fade
          console.warn(`[ResultScene] FadeOut for ${sceneKey} complete, but scene not active. Ignoring scene start.`);
          return;
        }
        console.log("PLAY_SOUND: transition.mp3");
        this.scene.start(sceneKey, data); // scene.start handles stopping current scene & its listeners
      }
    });
  }

  /**
   * Cleans up listeners when the scene is shut down.
   * @returns {void}
   */
  shutdown() {
    console.log('[ResultScene] Shutdown called. Removing listeners.');
    socket.off('nextRoundStatus', this._handleNextRoundStatus);
    socket.off('showFinalScores', this._handleShowFinalScores);
    socket.off('startRound', this._handleStartRound);
    // Add any other listeners specific to this scene if they were added directly to `socket`
  }
}
