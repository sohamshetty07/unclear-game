/**
 * Summary of improvements:
 * - Refactored variable declarations to use let/const.
 * - Converted string concatenations to template literals.
 * - Added JSDoc comments to all functions.
 * - Modularized player row creation and animation into `_createPlayerRow`.
 * - Used arrow functions for callbacks and shorter anonymous functions.
 * - Removed unused variable `playerMap`.
 * - Ensured consistent naming conventions (camelCase for functions/variables, PascalCase for classes).
 * - Optimized score display animation slightly.
 * - Utilized destructuring for player data.
 */

/**
 * Represents the final score scene in the game, displaying a leaderboard of players
 * and their scores with animations.
 * @extends Phaser.Scene
 */
class FinalScoreScene extends Phaser.Scene {
  /**
   * Constructs the FinalScoreScene.
   * @constructor
   */
  constructor() {
    super('FinalScoreScene');
    /**
     * Stores the scores of the players, typically indexed by playerSlot.
     * @type {object}
     */
    this.scores = {};
    /**
     * Array of player objects participating in the game.
     * @type {Array<object>}
     */
    this.players = [];
  }

  /**
   * Initializes the scene with data passed from the previous scene.
   * @param {object} data - The data object containing scores and player information.
   * @param {object} data.scores - An object mapping player slots to scores.
   * @param {Array<object>} [data.players=[]] - An array of player objects.
   * @returns {void}
   */
  init(data) {
    const { scores, players = [] } = data;
    this.scores = scores;
    this.players = players;
  }

  /**
   * Creates the visual elements and animations for the final score scene.
   * This includes the title, scoreboard, player rankings, and a restart button.
   * Time complexity: O(P log P) due to sorting players, then O(P) for iterating and creating elements/animations,
   * where P is the number of players.
   * Space complexity: O(P) for storing player data and Phaser game objects.
   * @returns {void}
   */
  create() {
    this.cameras.main.setBackgroundColor('#F5F5F5');
    this.cameras.main.fadeIn(300, 0, 0, 0);
    console.log("PLAY_SOUND: transition.mp3");

    const titleText = this.add.text(180, 50, '🏆 Final Leaderboard 🏆', {
      fontFamily: 'Roboto',
      fontSize: '32px',
      color: 'var(--primary-accent-color)',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    const scoreboardBgX = 30;
    const scoreboardBgY = titleText.y + titleText.height / 2 + 20;
    const scoreboardBgWidth = 300;
    const scoreboardPadding = 15;

    const graphics = this.add.graphics();
    graphics.fillStyle(0xF8F9FA, 0.9); // Light gray with some transparency

    // Assumes 'playerSlot' is a global or accessible variable indicating the current user's slot.
    // If not, this needs to be passed in or accessed differently, e.g., from a game state manager.
    // For now, let's assume `window.playerSlot` or a similar global for demonstration if not available in `this`.
    const currentPlayerSlot = typeof playerSlot !== 'undefined' ? playerSlot : null;


    const playersWithScores = this.players.map(player => ({
      ...player,
      score: this.scores[player.playerSlot] || 0,
      isPlayer: player.playerSlot === currentPlayerSlot,
    })).sort((a, b) => b.score - a.score);

    let currentY = scoreboardBgY + scoreboardPadding;
    const rowHeight = 40;
    const initialDelay = 300;
    const staggerDelay = 150;

    const columnPositions = {
      rankX: scoreboardBgX + scoreboardPadding + 10,
      avatarX: scoreboardBgX + scoreboardPadding + 35, // Adjusted for avatar
      nameX: scoreboardBgX + scoreboardPadding + 55, // Adjusted for avatar
      scoreX: scoreboardBgX + scoreboardBgWidth - scoreboardPadding - 10, // Adjusted for alignment
    };

    playersWithScores.forEach((playerEntry, index) => {
      this._createPlayerRow(playerEntry, index, currentY, rowHeight, columnPositions, initialDelay, staggerDelay);
      currentY += rowHeight;
    });

    const scoreboardBgHeight = (currentY - scoreboardBgY) + scoreboardPadding / 2 - rowHeight; // Adjust for last row
    graphics.fillRoundedRect(scoreboardBgX, scoreboardBgY, scoreboardBgWidth, scoreboardBgHeight, 10);

    const buttonY = scoreboardBgY + scoreboardBgHeight + 30;
    this._createRestartButton(buttonY, initialDelay + playersWithScores.length * staggerDelay + 300);

    const thankYouY = buttonY + 60; // Adjusted based on typical button height + padding
    this.add.text(180, thankYouY, '🎉 Thank you for playing UnClear! 🎉', {
      fontFamily: 'Roboto',
      fontSize: '16px',
      color: 'var(--primary-accent-color)',
      align: 'center',
    }).setOrigin(0.5);
  }

  /**
   * Creates and animates a single player row in the leaderboard.
   * @param {object} playerEntry - The player data object including score and avatar.
   * @param {string} playerEntry.playerSlot - The slot/ID of the player.
   * @param {string} playerEntry.playerName - The name of the player.
   * @param {number} playerEntry.score - The score of the player.
   * @param {boolean} playerEntry.isPlayer - Whether this entry is the current user.
   * @param {string} [playerEntry.avatar='👤'] - The avatar character for the player.
   * @param {number} index - The rank/index of the player in the sorted list.
   * @param {number} yPosition - The Y coordinate for this row.
   * @param {number} rowHeight - The height of each player row.
   * @param {object} columnPositions - Object containing X coordinates for rank, avatar, name, score.
   * @param {number} initialDelay - The base delay for animations.
   * @param {number} staggerDelay - The delay increment for each subsequent row.
   * Time complexity: O(1) for creating elements and tweens for a single row.
   * Space complexity: O(1) (Phaser objects are managed by the scene).
   * @private
   * @returns {void}
   */
  _createPlayerRow(playerEntry, index, yPosition, rowHeight, columnPositions, initialDelay, staggerDelay) {
    const { playerSlot, playerName, score, isPlayer, avatar = '👤' } = playerEntry;
    const { rankX, avatarX, nameX, scoreX } = columnPositions;

    const medalIcons = ['🥇', '🥈', '🥉'];
    const isTopThree = index < 3;

    const nameColor = isPlayer ? 'var(--success-color)' : 'var(--text-color)';
    const scoreColor = isPlayer ? 'var(--success-color)' : 'var(--text-color)';
    let fontWeight = isPlayer ? 'bold' : 'normal';
    let scoreFontSize = '18px';

    if (isTopThree) {
      fontWeight = 'bold';
      // scoreFontSize = index === 0 ? '22px' : (index === 1 ? '20px' : '19px'); // Slightly larger for top 3
      const topThreeFontSizes = ['22px', '20px', '19px'];
      scoreFontSize = topThreeFontSizes[index];
    }

    const medalLabel = medalIcons[index] || `${index + 1}.`;

    // Rank Text
    const rankText = this.add.text(rankX, yPosition + rowHeight / 2, medalLabel, {
      fontFamily: 'Roboto', fontSize: isTopThree ? '20px' : '16px', color: nameColor, fontStyle: fontWeight,
    }).setOrigin(0.5);

    // Avatar Text
    const avatarText = this.add.text(avatarX, yPosition + rowHeight / 2, avatar, {
      fontFamily: 'Roboto', fontSize: '20px', color: nameColor, // Avatar color same as name
    }).setOrigin(0.5);

    // Name Text
    const nameText = this.add.text(nameX, yPosition + rowHeight / 2, `${playerName}`, { // Removed playerSlot from display for cleaner look
      fontFamily: 'Roboto', fontSize: '16px', color: nameColor, fontStyle: fontWeight,
    }).setOrigin(0, 0.5);

    // Score Text (initially 0 for animation)
    const scoreText = this.add.text(scoreX, yPosition + rowHeight / 2, `0 pts`, {
      fontFamily: 'Roboto', fontSize: scoreFontSize, color: scoreColor, fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    const rowElements = [rankText, avatarText, nameText, scoreText];
    rowElements.forEach(el => {
      el.setAlpha(0);
      el.y += 10; // Initial offset for animation
    });

    this.tweens.add({
      targets: rowElements,
      alpha: 1,
      y: '-=10', // Animate to final position
      ease: 'Power1',
      duration: 400,
      delay: initialDelay + index * staggerDelay,
    });

    this.tweens.addCounter({
      from: 0,
      to: score,
      duration: 600 + index * 50, // Slightly faster count-up for subsequent players
      delay: initialDelay + index * staggerDelay + 200,
      ease: 'Power1',
      onUpdate: (tween) => {
        scoreText.setText(`${Math.floor(tween.getValue())} pts`);
      },
    });
  }

  /**
   * Creates the "Play Again" button with animation and event listeners.
   * @param {number} yPosition - The Y coordinate for the button.
   * @param {number} animationDelay - The delay before the button animates in.
   * Time complexity: O(1).
   * Space complexity: O(1).
   * @private
   * @returns {void}
   */
  _createRestartButton(yPosition, animationDelay) {
    const restartBtn = this.add.dom(180, yPosition, 'button', null, 'Play Again').setClassName('button');
    restartBtn.setOrigin(0.5);
    restartBtn.node.style.backgroundColor = 'var(--success-color)';
    restartBtn.node.style.transform = 'scale(0.8)';

    this.tweens.add({
      targets: restartBtn.node,
      scale: 1,
      ease: 'Back.easeOut',
      duration: 300,
      delay: animationDelay,
    });

    restartBtn.addListener('click');
    restartBtn.on('click', () => {
      console.log("PLAY_SOUND: click.mp3");
      this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          console.log("PLAY_SOUND: transition.mp3");
          // Assumes clearStoredPlayerData is a globally available function.
          // If it's part of a class or module, it should be accessed accordingly.
          if (typeof clearStoredPlayerData === 'function') {
            clearStoredPlayerData();
          } else {
            console.warn('clearStoredPlayerData function not found.');
          }
          location.reload();
        }
      });
    });
  }
}
