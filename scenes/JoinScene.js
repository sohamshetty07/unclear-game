/**
 * Summary of improvements:
 * - Added JSDoc comments to all methods, including class constructor, lifecycle methods, and event handlers.
 * - Ensured use of `const` and `let` appropriately.
 * - Maintained arrow functions for event handlers, ensuring correct `this` context and facilitating listener removal.
 * - Used template literals for generating player slot dropdown HTML.
 * - Removed redundant `const scene = this;` as arrow functions correctly scope `this`.
 * - Removed commented-out `init()` method.
 * - Modularized UI creation into `_createUiElements()` and scene transition logic into `_transitionToScene()`.
 * - Centralized Socket.IO event listener setup in `_setupSocketListeners()` and ensured listeners are attached only once.
 * - Clarified the role of global variables (e.g., `gameId`, `playerName`, `socket`) in JSDoc comments.
 * - Ensured consistent naming conventions.
 * - Added time and space complexity estimations where applicable.
 * - Streamlined the reconnect flow logic within `create()` and event handlers.
 * - Ensured `shutdown()` method correctly removes all registered listeners.
 */

/**
 * Represents the scene where players can join an existing game or host a new one.
 * It handles player input for game ID, name, and player slot, and manages
 * Socket.IO events for game state changes and transitions to other scenes.
 * Assumes several global variables are available:
 * - `socket`: The global Socket.IO client instance.
 * - `gameId`: Stores the current game's ID.
 * - `playerName`: Stores the current player's name.
 * - `playerSlot`: Stores the current player's selected slot.
 * - `yourSocketId`: Stores the client's socket ID assigned by the server.
 * - `updatePlayerBanner()`: A global function to refresh player information display.
 * - `generateGameId()`: A global function to create a new unique game ID.
 * @extends Phaser.Scene
 */
class JoinScene extends Phaser.Scene {
  /**
   * Constructs the JoinScene.
   * @constructor
   */
  constructor() {
    super('JoinScene');
    // Initialize properties for storing DOM elements for easier access if needed later
    /** @private @type {Phaser.GameObjects.DOMElement} */
    this.gameIdInput = null;
    /** @private @type {Phaser.GameObjects.DOMElement} */
    this.nameInput = null;
    /** @private @type {Phaser.GameObjects.DOMElement} */
    this.playerSlotSelect = null;
  }

  /**
   * Creates the visual elements, input fields, buttons, and sets up Socket.IO event handlers.
   * It also handles the logic for reconnecting players if session data exists.
   * Time complexity: O(1) for most operations; player slot generation is O(N) where N is number of slots (constant).
   * Space complexity: O(1) for storing references to DOM elements and scene objects.
   * @returns {void}
   */
  create() {
    this.cameras.main.setBackgroundColor('#F5F5F5');
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this._defineEventHandlers();
    this._setupSocketListeners();
    this._createUiElements();
    this._handleReconnectFlow();
  }

  /**
   * Defines event handlers as arrow function properties for correct `this` binding
   * and to facilitate their removal in the `shutdown` method.
   * @private
   * @returns {void}
   */
  _defineEventHandlers() {
    /**
     * Handles the 'playerJoined' event from the server.
     * Updates global `yourSocketId`, player banner, and transitions to GameScene for new joins.
     * For reconnects, it confirms player presence but defers scene transition to other sync events.
     * @param {object} data - Data from the server.
     * @param {Array<object>} data.players - List of current players.
     * @param {string} data.yourSocketId - The client's unique socket ID.
     * @returns {void}
     * Time complexity: O(P) where P is the number of players (due to `players.find`).
     * Space complexity: O(1).
     */
    this.handlePlayerJoined = ({ players, yourSocketId: id }) => {
      if (!this.scene.isActive()) {
        console.log('[JoinScene] playerJoined event received, but scene is not active. Ignoring.');
        return;
      }
      yourSocketId = id; // Update global `yourSocketId`

      const me = players.find(p => p.playerName === playerName && p.playerSlot === playerSlot);
      const isReconnecting = sessionStorage.getItem('gameId') && sessionStorage.getItem('playerName') && sessionStorage.getItem('playerSlot');

      if (me) {
        if (typeof updatePlayerBanner === 'function') {
          updatePlayerBanner();
        } else {
          console.warn('Global function updatePlayerBanner() not found.');
        }

        if (!isReconnecting) {
          console.log('[JoinScene] playerJoined (new join flow) - transitioning to GameScene.');
          socket.emit('syncRequest', { gameId, playerSlot });
          this._transitionToScene('GameScene');
        } else {
          console.log('[JoinScene] playerJoined (reconnect flow) - banner updated. Waiting for sync event for scene transition.');
        }
      } else {
        console.warn('[JoinScene] playerJoined event received, but current player not in the list.');
      }
    };

    /**
     * Handles the 'startRound' event, transitioning to RoundScene.
     * @param {object} data - Data for starting the round.
     * @returns {void}
     * Time complexity: O(1). Space complexity: O(1).
     */
    this.handleStartRound = (data) => this._transitionToScene('RoundScene', data, '[JoinScene] received startRound.');

    /**
     * Handles the 'beginVoting' event, transitioning to VotingScene.
     * @param {object} data - Data for beginning voting.
     * @param {Array<object>} data.players - All players in the game.
     * @param {Array<string>} data.alreadyVoted - List of playerSlots that have already voted.
     * @param {object} data.playerMap - Mapping of playerSlots to player details.
     * @returns {void}
     * Time complexity: O(P) where P is players.length for filter. Space complexity: O(P) for 'others'.
     */
    this.handleBeginVoting = ({ players, alreadyVoted, playerMap }) => {
      const others = players.filter(p => p.playerSlot !== playerSlot);
      // TODO: The round number seems to be hardcoded as 1. This should be dynamic based on game state.
      // This implies that the 'beginVoting' event from the server should perhaps include the current round number.
      // For now, retaining existing logic but acknowledging this potential issue.
      this._transitionToScene('VotingScene', { round: 1, votablePlayers: others, alreadyVoted, playerMap }, '[JoinScene] received beginVoting.');
    };

    /**
     * Handles the 'votingResults' event, transitioning to ResultScene.
     * @param {object} data - Voting results data.
     * @returns {void}
     * Time complexity: O(1). Space complexity: O(1).
     */
    this.handleVotingResults = (data) => this._transitionToScene('ResultScene', data, '[JoinScene] received votingResults.');

    /**
     * Handles the 'showFinalScores' event, transitioning to FinalScoreScene.
     * @param {object} data - Final scores data.
     * @returns {void}
     * Time complexity: O(1). Space complexity: O(1).
     */
    this.handleShowFinalScores = (data) => this._transitionToScene('FinalScoreScene', data, '[JoinScene] received showFinalScores.');

    /**
     * Handles error messages from the server.
     * @param {string} msg - The error message.
     * @returns {void}
     * Time complexity: O(1). Space complexity: O(1).
     */
    this.handleErrorMessage = (msg) => {
      console.error(`[JoinScene] errorMessage: ${msg}`);
      // Using alert for now, but a more integrated UI notification is preferable.
      alert(msg);
    };
  }

  /**
   * Attaches all necessary Socket.IO event listeners.
   * @private
   * @returns {void}
   */
  _setupSocketListeners() {
    // Clear existing listeners first to prevent duplicates if this method is ever called multiple times.
    socket.off('playerJoined', this.handlePlayerJoined);
    socket.off('startRound', this.handleStartRound);
    socket.off('beginVoting', this.handleBeginVoting);
    socket.off('votingResults', this.handleVotingResults);
    socket.off('showFinalScores', this.handleShowFinalScores);
    socket.off('errorMessage', this.handleErrorMessage);

    // Attach listeners
    socket.on('playerJoined', this.handlePlayerJoined);
    socket.on('startRound', this.handleStartRound);
    socket.on('beginVoting', this.handleBeginVoting);
    socket.on('votingResults', this.handleVotingResults);
    socket.on('showFinalScores', this.handleShowFinalScores);
    socket.on('errorMessage', this.handleErrorMessage);
  }

  /**
   * Creates and positions the UI elements (title, input fields, dropdown, button).
   * @private
   * @returns {void}
   * Time complexity: O(N) for player slot dropdown where N is number of slots (constant). Others O(1).
   * Space complexity: O(1).
   */
  _createUiElements() {
    this.add.text(180, 50, 'Join or Host Game', {
      fontFamily: 'Roboto', fontSize: '24px', color: 'var(--text-color)', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    this.gameIdInput = this.add.dom(180, 120, 'input', {
      type: 'text', fontSize: '16px', fontFamily: 'Roboto', width: '280px', padding: '10px', border: '1px solid var(--secondary-accent-color)', borderRadius: '5px',
    });
    this.gameIdInput.node.placeholder = 'Game ID (leave blank to host)';

    this.nameInput = this.add.dom(180, 180, 'input', {
      type: 'text', fontSize: '16px', fontFamily: 'Roboto', width: '280px', padding: '10px', border: '1px solid var(--secondary-accent-color)', borderRadius: '5px',
    });
    this.nameInput.node.placeholder = 'Your Name';

    const playerSlots = 12; // Define the number of player slots
    const dropdownHTML = `
      <select id="playerSlot" style="font-size:16px; width:280px; padding: 10px; border-radius: 5px; border: 1px solid var(--secondary-accent-color); font-family: Roboto;">
        <option value="">Select Player Slot</option>
        ${Array.from({ length: playerSlots }, (_, i) => `<option value="Player ${i + 1}">Player ${i + 1}</option>`).join('')}
      </select>`;
    this.playerSlotSelect = this.add.dom(180, 240).createFromHTML(dropdownHTML);

    const joinBtn = this.add.dom(180, 320, 'button', null, 'Join Game').setClassName('button');
    joinBtn.node.style.transform = 'scale(0.8)';
    this.tweens.add({
      targets: joinBtn.node, scale: 1, ease: 'Back.easeOut', duration: 300, delay: 200,
    });

    joinBtn.addListener('click');
    joinBtn.on('click', this._handleJoinButtonClick);
  }

  /**
   * Handles the click event for the "Join Game" button.
   * Validates input, generates a game ID if hosting, stores session data, and emits 'joinGame'.
   * This is bound to `this` context of the scene.
   * @private
   * @returns {void}
   * Time complexity: O(1).
   * Space complexity: O(1).
   */
  _handleJoinButtonClick = () => {
    console.log("PLAY_SOUND: click.mp3");
    // These assignments update the global variables.
    playerName = this.nameInput.node.value;
    playerSlot = this.playerSlotSelect.node.querySelector('#playerSlot').value;
    let currentEnteredGameId = this.gameIdInput.node.value.trim();

    if (!playerName || !playerSlot) {
      alert('Enter your name and select a player slot.');
      return;
    }

    if (!currentEnteredGameId) {
      if (typeof generateGameId === 'function') {
        gameId = generateGameId(); // Updates global gameId
      } else {
        console.error('generateGameId function is not defined. Cannot host game.');
        alert('Error: Cannot generate Game ID to host.');
        return;
      }
      console.log(`[JoinScene] Generated new Game ID: ${gameId}`);
      socket.emit('createGame', { gameId });
      alert(`Game Created! Share this Game ID: ${gameId}`);
    } else {
      gameId = currentEnteredGameId; // Updates global gameId
    }

    sessionStorage.setItem('gameId', gameId);
    sessionStorage.setItem('playerName', playerName);
    sessionStorage.setItem('playerSlot', playerSlot);

    socket.emit('joinGame', { gameId, playerName, playerSlot });
  }


  /**
   * Checks for stored session data and attempts to rejoin a game if data is found.
   * @private
   * @returns {void}
   * Time complexity: O(1).
   * Space complexity: O(1).
   */
  _handleReconnectFlow() {
    const storedGameId = sessionStorage.getItem('gameId');
    const storedPlayerName = sessionStorage.getItem('playerName');
    const storedPlayerSlot = sessionStorage.getItem('playerSlot');

    if (storedGameId && storedPlayerName && storedPlayerSlot) {
      console.log('[JoinScene] Reconnect flow: Attempting to rejoin game.');
      // Update global variables with stored data
      gameId = storedGameId;
      playerName = storedPlayerName;
      playerSlot = storedPlayerSlot;
      socket.emit('joinGame', { gameId, playerName, playerSlot });
      // UI remains, sync events will trigger transitions.
    } else {
      console.log('[JoinScene] New join/host flow.');
    }
  }

  /**
   * Utility function to handle scene transitions with a fade-out effect.
   * @param {string} sceneKey - The key of the scene to transition to.
   * @param {object} [data={}] - Optional data to pass to the next scene's init method.
   * @param {string} [logMessage='Transitioning scenes.'] - Optional message for logging.
   * @private
   * @returns {void}
   * Time complexity: O(1).
   * Space complexity: O(1).
   */
  _transitionToScene(sceneKey, data = {}, logMessage = 'Transitioning scenes.') {
    if (!this.scene.isActive()) {
      console.log(`[JoinScene] Transition to ${sceneKey} requested, but scene is not active. Ignoring.`);
      return;
    }
    console.log(`[JoinScene] ${logMessage} Transitioning to ${sceneKey}.`);
    this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
      if (progress === 1) {
        if (!this.scene.isActive()) {
          console.log(`[JoinScene] FadeOut for ${sceneKey} complete, but scene is not active. Ignoring scene start.`);
          return;
        }
        console.log("PLAY_SOUND: transition.mp3");
        // No need to call scene.stop() explicitly, scene.start() handles shutdown of current scene.
        this.scene.start(sceneKey, data);
      }
    });
  }

  /**
   * Cleans up by removing all Socket.IO listeners when the scene is shut down.
   * Time complexity: O(N) where N is the number of listeners to remove (constant in this case).
   * Space complexity: O(1).
   * @returns {void}
   */
  shutdown() {
    console.log('[JoinScene] shutting down and removing listeners.');
    // Remove all listeners using the stored handler references
    // This ensures that if handlers were not defined (e.g. error during create), it doesn't crash.
    if (this.handlePlayerJoined) socket.off('playerJoined', this.handlePlayerJoined);
    if (this.handleStartRound) socket.off('startRound', this.handleStartRound);
    if (this.handleBeginVoting) socket.off('beginVoting', this.handleBeginVoting);
    if (this.handleVotingResults) socket.off('votingResults', this.handleVotingResults);
    if (this.handleShowFinalScores) socket.off('showFinalScores', this.handleShowFinalScores);
    if (this.handleErrorMessage) socket.off('errorMessage', this.handleErrorMessage);
  }
}
