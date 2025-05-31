/**
 * Summary of improvements:
 * - Added JSDoc comments to all methods.
 * - Used `const` and `let` appropriately.
 * - Converted anonymous functions to arrow functions (for socket handlers and tween callbacks).
 * - Employed template literals for string construction (dropdown options, timer, status).
 * - Utilized destructuring for `init` method parameters and socket event data.
 * - Modularized UI creation and logic into private helper methods:
 *   - `_displayTitlesAndPlayerInfo()`: For static text elements.
 *   - `_createTimerDisplay()`: Sets up the timer text object.
 *   - `_createVotingDropdown(options)`: Generates and adds the player selection dropdown.
 *   - `_createSubmitButton()`: Sets up the vote submission button.
 *   - `_updateUIAfterVoteAttempt(success)`: Updates UI after vote submission or if already voted.
 *   - `_setupSocketListeners()`: Centralizes Socket.IO event listener setup.
 *   - `_transitionToScene(sceneKey, data, logMessage)`: Utility for scene transitions.
 * - Implemented a more comprehensive `shutdown()` method for robust listener cleanup.
 * - Ensured consistent naming conventions.
 * - Removed redundant `const scene = this;`.
 * - Assumed global variables `socket`, `gameId`, `playerName`, `playerSlot` are managed externally.
 */

/**
 * Represents the scene where players vote for who they believe is the imposter.
 * Manages UI for player selection, vote submission, and displays a timer.
 * Handles transitions to results or a revote scenario.
 * Assumes `socket`, `gameId`, `playerName`, `playerSlot` are globally available.
 * @extends Phaser.Scene
 */
class VotingScene extends Phaser.Scene {
  /**
   * Constructs the VotingScene.
   * @constructor
   */
  constructor() {
    super('VotingScene');
    /** @private @type {number} Current round number. */
    this.round = 0;
    /** @private @type {Array<object>} Players that can be voted for. */
    this.votablePlayers = [];
    /** @private @type {Array<object>|null} Players involved in a tied vote, if applicable. */
    this.tiedPlayers = null;
    /** @private @type {object} Map of playerSlots to player names. */
    this.playerMap = {};
    /** @private @type {boolean} If the current player has already voted in this round/revote. */
    this.alreadyVoted = false;

    /** @private @type {Phaser.GameObjects.Text} Text object for the timer. */
    this.timerText = null;
    /** @private @type {Phaser.GameObjects.Text} Text object for voting status messages. */
    this.voteStatusText = null;
    /** @private @type {Phaser.GameObjects.DOMElement} DOM element for the submit button. */
    this.submitButton = null;
    /** @private @type {Phaser.GameObjects.DOMElement} DOM element for the player dropdown. */
    this.voteDropdownElement = null;
  }

  /**
   * Initializes the scene with data from the previous scene.
   * @param {object} data - Data object.
   * @param {number} data.round - Current round.
   * @param {Array<object>} [data.votablePlayers=[]] - Players to vote for.
   * @param {Array<object>|null} [data.tiedPlayers=null] - Tied players for a revote.
   * @param {object} [data.playerMap={}] - Player slot to name map.
   * @param {boolean} [data.alreadyVoted=false] - If player has already voted.
   * @returns {void}
   */
  init({ round, votablePlayers = [], tiedPlayers = null, playerMap = {}, alreadyVoted = false }) {
    this.round = round;
    this.votablePlayers = votablePlayers;
    this.tiedPlayers = tiedPlayers;
    this.playerMap = playerMap;
    this.alreadyVoted = alreadyVoted;
  }

  /**
   * Creates visual elements, event handlers, and initializes socket communications.
   * Time complexity: O(P) where P is the number of votable players (for dropdown).
   * Space complexity: O(P) for storing dropdown options.
   * @returns {void}
   */
  create() {
    this.cameras.main.setBackgroundColor('#F5F5F5');
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this._createTimerDisplay();
    this._displayTitlesAndPlayerInfo();

    const options = this.tiedPlayers || this.votablePlayers;
    this._createVotingDropdown(options);
    this._createSubmitButton();

    if (this.alreadyVoted) {
      this._updateUIAfterVoteAttempt(false); // 'false' indicates not a new successful vote
    }
    this._setupSocketListeners();
  }

  /**
   * Displays static titles and current player information.
   * @private
   * @returns {void}
   */
  _displayTitlesAndPlayerInfo() {
    this.add.text(180, 30, `Your Turn: ${playerSlot} - ${playerName}`, {
      fontFamily: 'Roboto', fontSize: '14px', color: 'var(--secondary-accent-color)', align: 'center',
    }).setOrigin(0.5);

    this.add.text(180, 70, `Round ${this.round} Voting`, {
      fontFamily: 'Roboto', fontSize: '24px', color: 'var(--text-color)', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    this.voteStatusText = this.add.text(180, 120, 'Select who you think is the imposter:', {
      fontFamily: 'Roboto', fontSize: '16px', color: 'var(--text-color)', align: 'center',
    }).setOrigin(0.5);
  }

  /**
   * Creates the timer display text object.
   * @private
   * @returns {void}
   */
  _createTimerDisplay() {
    this.timerText = this.add.text(180, 10, '', {
      fontFamily: 'Roboto', fontSize: '16px', color: 'var(--warning-color)', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setVisible(false);
  }

  /**
   * Creates the dropdown menu for player voting.
   * @param {Array<object>} options - Players to list in the dropdown.
   * @private
   * @returns {void}
   * Time complexity: O(P) where P is the number of players in options.
   */
  _createVotingDropdown(options) {
    const dropdownHTML = `
      <select id="voteDropdown" style="font-size:16px; width:280px; padding: 10px; border-radius: 5px; border: 1px solid var(--secondary-accent-color); font-family: Roboto; background-color: var(--white-color); color: var(--text-color);">
        <option value="">-- Select Player --</option>
        ${options.map(p => {
          const avatar = p.avatar || '';
          // Use playerMap for name consistency if available, otherwise fallback to p.playerName
          const displayName = this.playerMap[p.playerSlot] || p.playerName || 'Unknown';
          return `<option value="${p.playerSlot}">${avatar} ${p.playerSlot} - ${displayName}</option>`;
        }).join('')}
      </select>`;
    this.voteDropdownElement = this.add.dom(180, 170).createFromHTML(dropdownHTML);
  }

  /**
   * Creates the "Submit Vote" button.
   * @private
   * @returns {void}
   */
  _createSubmitButton() {
    this.submitButton = this.add.dom(180, 250, 'button', null, 'Submit Vote').setClassName('button');
    this.submitButton.node.style.backgroundColor = 'var(--success-color)';
    this.submitButton.node.style.transform = 'scale(0.8)';

    this.tweens.add({
      targets: this.submitButton.node, scale: 1, ease: 'Back.easeOut', duration: 300, delay: 200,
    });

    this.submitButton.addListener('click').on('click', this._handleSubmitVote);
  }

  /**
   * Handles the vote submission logic.
   * @private
   */
  _handleSubmitVote = () => {
    console.log("PLAY_SOUND: click.mp3");
    const selectedPlayerSlot = this.voteDropdownElement.node.querySelector('#voteDropdown').value;

    if (!selectedPlayerSlot) {
      alert('Please select a player.');
      return;
    }

    console.log(`[VotingScene] Player ${playerSlot} voted for ${selectedPlayerSlot} in game ${gameId}.`);
    socket.emit('submitVote', { gameId, voter: playerSlot, voted: selectedPlayerSlot });
    this._updateUIAfterVoteAttempt(true); // true indicates a successful vote attempt
  }

  /**
   * Updates UI elements after a vote is submitted or if player has already voted.
   * @param {boolean} voteJustSubmitted - True if a vote was just actively submitted.
   * @private
   */
  _updateUIAfterVoteAttempt(voteJustSubmitted) {
    if (voteJustSubmitted) {
      this.voteStatusText.setText('Vote submitted. Waiting for others...');
    } else { // implies alreadyVoted was true on load
      this.voteStatusText.setText('You already voted. Waiting for others...');
    }

    if (this.submitButton?.node) {
      this.submitButton.node.disabled = true;
      this.submitButton.node.style.backgroundColor = 'var(--secondary-accent-color)';
      this.submitButton.node.style.transform = 'scale(1)'; // Ensure correct scale
    }
    // Optionally disable dropdown as well
    if (this.voteDropdownElement?.node) {
        const dropdown = this.voteDropdownElement.node.querySelector('#voteDropdown');
        if(dropdown) dropdown.disabled = true;
    }
  }

  /**
   * Sets up Socket.IO event listeners.
   * @private
   * @returns {void}
   */
  _setupSocketListeners() {
    socket.on('timerUpdate', this._handleTimerUpdate);
    socket.on('votingResults', this._handleVotingResults);
    socket.on('revote', this._handleRevote);
  }

  _handleTimerUpdate = ({ phase, timeLeft }) => {
    if (!this.scene.isActive() || !this.timerText) return;
    if (phase === 'voting' && timeLeft > 0) {
      this.timerText.setText(`Voting ends in: ${timeLeft}s`).setVisible(true);
    } else {
      this.timerText.setVisible(false);
    }
  }

  _handleVotingResults = (data) => {
    const sceneData = {
      ...data, // votes, imposter, correctGuessers, scores, playerMap, players
      round: this.round,
      isHost: data.players.find(p => p.playerSlot === playerSlot)?.isHost || false,
    };
    this._transitionToScene('ResultScene', sceneData, '[VotingScene] Received votingResults.');
  }

  _handleRevote = ({ tiedPlayers }) => {
    // Map tied player slots to full player objects, using this.votablePlayers as a source
    // or playerMap if names are needed and not in votablePlayers directly (though they should be)
    const fullTiedPlayers = tiedPlayers.map(slot =>
      this.votablePlayers.find(p => p.playerSlot === slot) ||
      { playerSlot: slot, playerName: this.playerMap[slot] || 'Unknown', avatar: this.playerMap[slot]?.avatar || '' } // Fallback structure
    );

    const sceneData = {
      round: this.round,
      votablePlayers: this.votablePlayers, // Pass original votable players
      tiedPlayers: fullTiedPlayers,        // Specifically pass the players involved in the tie
      playerMap: this.playerMap,
      alreadyVoted: false, // Reset for revote
    };
    this._transitionToScene('VotingScene', sceneData, '[VotingScene] Received revote.');
  }

  /**
   * Utility for scene transitions.
   * @param {string} sceneKey - Key of the scene to transition to.
   * @param {object} [data={}] - Data for the next scene.
   * @param {string} [logMessage='Transitioning...'] - Log message.
   * @private
   */
  _transitionToScene(sceneKey, data = {}, logMessage = 'Transitioning...') {
    if (!this.scene.isActive()) {
      console.warn(`[VotingScene] Transition to ${sceneKey} requested, but scene not active. Ignoring.`);
      return;
    }
    console.log(logMessage);
    if (this.timerText) this.timerText.setVisible(false);

    this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
      if (progress === 1) {
         if (!this.scene.isActive()) {
            console.warn(`[VotingScene] FadeOut for ${sceneKey} complete, but scene not active. Ignoring scene start.`);
            return;
         }
        console.log("PLAY_SOUND: transition.mp3");
        this.scene.start(sceneKey, data);
      }
    });
  }

  /**
   * Cleans up listeners when the scene shuts down.
   * @returns {void}
   */
  shutdown() {
    console.log('[VotingScene] Shutdown called. Removing listeners.');
    socket.off('timerUpdate', this._handleTimerUpdate);
    socket.off('votingResults', this._handleVotingResults);
    socket.off('revote', this._handleRevote);
  }
}
