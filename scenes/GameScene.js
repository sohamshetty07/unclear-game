/**
 * Summary of improvements:
 * - Added JSDoc comments to all functions, including class constructor and lifecycle methods.
 * - Refactored variable declarations to use `let` and `const` appropriately.
 * - Converted anonymous functions for event handlers and tweens to arrow functions.
 * - Used template literals for all string concatenations.
 * - Modularized UI update logic:
 *   - `_updatePlayerListDisplay` for refreshing the player list.
 *   - `_updateStartButtonVisibility` for managing the start button's state.
 *   - `_createReadyButton` for setting up the ready button.
 *   - `_createStartButton` for setting up the start game button.
 * - Removed redundant `const scene = this;` as arrow functions preserve `this` context.
 * - Ensured consistent naming conventions (camelCase for functions/variables, PascalCase for classes).
 * - Added time and space complexity estimations for relevant functions.
 * - Assumed `gameId`, `playerName`, `playerSlot`, `socket`, and `yourSocketId` are globally available or managed by a higher-level state mechanism.
 * - Cleaned up socket event listener setup by moving `removeAllListeners` to the start of the listener registration for `playerJoined`.
 */

/**
 * Represents the game lobby scene where players can ready up before starting the game.
 * It displays player information, readiness status, and allows the host to start the game.
 * @extends Phaser.Scene
 */
class GameScene extends Phaser.Scene {
  /**
   * Constructs the GameScene.
   * @constructor
   */
  constructor() {
    super('GameScene');
    /**
     * Stores the count of players from the previous update to detect new joins.
     * @type {number}
     * @private
     */
    this.previousPlayerCount = 0;
    /**
     * Reference to the player list text object in the scene.
     * @type {Phaser.GameObjects.Text}
     * @private
     */
    this.playerListContainer = null;
    /**
     * Reference to the start game button DOM element.
     * @type {Phaser.GameObjects.DOMElement}
     * @private
     */
    this.startBtn = null;
    /**
     * Flag indicating if the current player is the host.
     * @type {boolean}
     * @private
     */
    this.isHost = false;
    /**
     * Flag indicating if the current player is ready.
     * @type {boolean}
     * @private
     */
    this.isPlayerReady = false; // Renamed from isReady for clarity within scene context
  }

  /**
   * Creates the visual elements, event handlers, and initializes socket communications for the game lobby.
   * Time complexity: O(1) for initial setup. Socket event handlers have their own complexities
   * (e.g., `_updatePlayerListDisplay` is O(P) where P is the number of players).
   * Space complexity: O(1) for scene elements, player list text can grow with P.
   * @returns {void}
   */
  create() {
    this.cameras.main.setBackgroundColor('#F5F5F5');
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.previousPlayerCount = 0;

    // Display Lobby and Player Info
    this.add.text(180, 50, `Lobby: ${gameId}`, {
      fontFamily: 'Roboto',
      fontSize: '24px',
      color: 'var(--text-color)',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(180, 85, `Welcome ${playerName} (${playerSlot})`, {
      fontFamily: 'Roboto',
      fontSize: '18px',
      color: 'var(--secondary-accent-color)',
      align: 'center',
    }).setOrigin(0.5);

    this._createReadyButton();
    this._createStartButton();
    this._createPlayerListContainer();
    this._setupSocketListeners();

    socket.emit('requestPlayerList', gameId);
  }

  /**
   * Creates the "I'm Ready" / "Not Ready" button and its associated event listener.
   * @private
   * @returns {void}
   * Time complexity: O(1).
   * Space complexity: O(1).
   */
  _createReadyButton() {
    const readyBtn = this.add.dom(180, 200, 'button', null, "I'm Ready").setClassName('button');
    readyBtn.node.style.backgroundColor = 'var(--secondary-accent-color)';
    readyBtn.node.style.transform = 'scale(0.8)';
    this.tweens.add({
      targets: readyBtn.node,
      scale: 1,
      ease: 'Back.easeOut',
      duration: 300,
      delay: 200,
    });

    readyBtn.addListener('click');
    readyBtn.on('click', () => {
      console.log("PLAY_SOUND: click.mp3");
      this.isPlayerReady = !this.isPlayerReady;
      readyBtn.node.innerText = this.isPlayerReady ? 'Not Ready' : "I'm Ready";
      readyBtn.node.style.backgroundColor = this.isPlayerReady ? 'var(--success-color)' : 'var(--secondary-accent-color)';
      socket.emit('toggleReady', { gameId, playerSlot, isReady: this.isPlayerReady });
    });
  }

  /**
   * Creates the "Start Game" button, initially hidden, for the host.
   * @private
   * @returns {void}
   * Time complexity: O(1).
   * Space complexity: O(1).
   */
  _createStartButton() {
    this.startBtn = this.add.dom(180, 560, 'button', null, 'Start Game').setClassName('button');
    this.startBtn.node.style.backgroundColor = 'var(--success-color)';
    this.startBtn.node.style.display = 'none';
    this.startBtn.node.style.transform = 'scale(0.8)';

    this.startBtn.addListener('click');
    this.startBtn.on('click', () => {
      console.log("PLAY_SOUND: click.mp3");
      socket.emit('startGame', gameId);
    });
  }

  /**
   * Creates the text container for displaying the list of players.
   * @private
   * @returns {void}
   * Time complexity: O(1).
   * Space complexity: O(1).
   */
  _createPlayerListContainer() {
    this.playerListContainer = this.add.text(180, 350, 'Players loading...', {
      fontFamily: 'Roboto',
      fontSize: '14px',
      color: 'var(--text-color)',
      lineSpacing: 6,
      align: 'center',
      wordWrap: { width: 320 },
    }).setOrigin(0.5);
  }

  /**
   * Sets up Socket.IO event listeners for player joins and game start.
   * @private
   * @returns {void}
   * Time complexity: O(1) for setup.
   * Space complexity: O(1).
   */
  _setupSocketListeners() {
    socket.removeAllListeners('playerJoined'); // Clear existing before adding new
    socket.on('playerJoined', ({ players, yourSocketId: id }) => {
      // It's generally not recommended to re-assign global variables like yourSocketId here.
      // This should ideally be managed by a dedicated service or state manager.
      // For now, maintaining original behavior:
      if (typeof yourSocketId !== 'undefined') { // Check if global yourSocketId exists
          yourSocketId = id;
      } else {
          console.warn('Global `yourSocketId` not found, player ID might not be set correctly.');
      }


      if (players.length > this.previousPlayerCount) {
        console.log("PLAY_SOUND: player_join.mp3");
      }
      this.previousPlayerCount = players.length;
      console.log(`[GameScene] Player list updated. Current players: ${players.length}`);

      const me = players.find(p => p.playerSlot === playerSlot && p.playerName === playerName);
      this.isHost = me?.isHost || false;

      this._updatePlayerListDisplay(players);
      this._updateStartButtonVisibility(players);
    });

    socket.removeAllListeners('startRound'); // Clear existing before adding new
    socket.on('startRound', ({ word, turnOrder, currentClueTurn, round }) => {
      if (!this.scene.isActive()) {
        console.warn('[GameScene] startRound received but scene not active. Ignoring.');
        return;
      }
      this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          console.log("PLAY_SOUND: transition.mp3");
          // No need to removeAllListeners here again as they are cleared at the start of new scene or on specific conditions.
          // Specifically, playerJoined should remain for other players if this client is already in RoundScene.
          // However, for this client, transitioning away means they should be cleared for this scene.
          // The initial removeAllListeners for 'playerJoined' and 'startRound' at the top of _setupSocketListeners or create is better.
          this.scene.stop();
          this.scene.start('RoundScene', {
            word, turnOrder, currentClueTurn, round,
          });
        }
      });
    });
  }

  /**
   * Updates the text display of the player list.
   * @param {Array<object>} players - Array of player objects.
   * @private
   * @returns {void}
   * Time complexity: O(P) where P is the number of players, due to iteration.
   * Space complexity: O(P) for the generated playerText string.
   */
  _updatePlayerListDisplay(players) {
    let playerText = 'Players:\n';
    players.forEach(p => {
      const avatar = p.avatar || '';
      const hostMark = p.isHost ? ' 👑' : '';
      const readyMark = p.isReady ? '✅' : '❌';
      playerText += `${avatar} ${p.playerSlot} - ${p.playerName}${hostMark} [${readyMark}]\n`;
    });
    this.playerListContainer.setText(playerText);

    this.tweens.add({
      targets: this.playerListContainer,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 100,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Shows or hides the "Start Game" button based on player readiness and host status.
   * @param {Array<object>} players - Array of player objects.
   * @private
   * @returns {void}
   * Time complexity: O(P) for `players.every()`.
   * Space complexity: O(1).
   */
  _updateStartButtonVisibility(players) {
    if (this.startBtn && this.startBtn.node) {
      const everyoneReady = players.length > 0 && players.every(p => p.isReady);
      const shouldBeVisible = this.isHost && everyoneReady;

      if (shouldBeVisible && this.startBtn.node.style.display === 'none') {
        this.startBtn.node.style.display = 'block';
        this.tweens.add({
          targets: this.startBtn.node,
          scale: 1,
          ease: 'Back.easeOut',
          duration: 300,
        });
      } else if (!shouldBeVisible && this.startBtn.node.style.display === 'block') {
        // Only apply fade/scale out if it was previously visible
        this.tweens.add({
            targets: this.startBtn.node,
            scale: 0.8,
            alpha: 0,
            ease: 'Power1',
            duration: 200,
            onComplete: () => {
                this.startBtn.node.style.display = 'none';
                this.startBtn.node.style.alpha = 1; // Reset alpha for next appearance
                this.startBtn.node.style.transform = 'scale(0.8)'; // Reset scale
            }
        });
      } else if (!shouldBeVisible) {
        // If it's already hidden, ensure scale is reset for its next pop-in.
        this.startBtn.node.style.transform = 'scale(0.8)';
        this.startBtn.node.style.display = 'none'; // Ensure it's hidden
      }
    }
  }
}
