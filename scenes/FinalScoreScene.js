class FinalScoreScene extends Phaser.Scene {
  constructor() {
    super('FinalScoreScene');
  }

  init(data) {
    this.scores = data.scores;
    // this.playerMap = data.playerMap; // Old way
    this.players = data.players || []; // New: Get full player objects
  }

  create() {
    this.cameras.main.setBackgroundColor('#F5F5F5');
    this.cameras.main.fadeIn(300, 0, 0, 0); 
    console.log("PLAY_SOUND: transition.mp3"); 

    const titleText = this.add.text(180, 50, '🏆 Final Leaderboard 🏆', { 
      fontFamily: 'Roboto',
      fontSize: '32px', // Slightly larger title
      color: 'var(--primary-accent-color)',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    // Scoreboard Background
    const scoreboardBgX = 30;
    const scoreboardBgY = titleText.y + titleText.height / 2 + 20;
    const scoreboardBgWidth = 300;
    // Height will be dynamic based on player count, calculate later
    const scoreboardPadding = 15;

    const graphics = this.add.graphics();
    // graphics.fillStyle(Phaser.Display.Color.HexStringToColor('var(--light-gray-color)').color, 0.8); // Placeholder, CSS vars not direct in JS
    // Using a Phaser color, assuming --light-gray-color is like #F8F9FA
    graphics.fillStyle(0xF8F9FA, 0.9); // Light gray with some transparency
    // Actual height will be set after calculating player row positions

    const medalIcons = ['🥇', '🥈', '🥉'];
    const playersWithScores = this.players.map(player => ({
        ...player,
        score: this.scores[player.playerSlot] || 0,
        isPlayer: (player.playerSlot === playerSlot) 
    })).sort((a, b) => b.score - a.score);

    let currentY = scoreboardBgY + scoreboardPadding;
    const rowHeight = 40; // Height for each player row
    const initialDelay = 300; // Initial delay for first row animation
    const staggerDelay = 150; // Delay between each row animation

    // Define column X positions
    const rankX = scoreboardBgX + scoreboardPadding + 10;
    const avatarX = rankX + 25;
    const nameX = avatarX + 20;
    const scoreX = scoreboardBgX + scoreboardBgWidth - scoreboardPadding - 30; // For right aligning score

    playersWithScores.forEach((playerEntry, index) => {
      const isTopThree = index < 3;
      let nameColor = playerEntry.isPlayer ? 'var(--success-color)' : 'var(--text-color)';
      let scoreColor = playerEntry.isPlayer ? 'var(--success-color)' : 'var(--text-color)';
      let fontWeight = playerEntry.isPlayer ? 'bold' : 'normal';
      let scoreFontSize = '18px';

      if (isTopThree) {
        fontWeight = 'bold';
        scoreFontSize = index === 0 ? '22px' : (index === 1 ? '20px' : '19px'); // Larger for top 3
      }
      
      const medalLabel = medalIcons[index] ? medalIcons[index] : `${index + 1}.`;
      const avatar = playerEntry.avatar || '👤'; // Default avatar if none

      // Rank Text
      const rankText = this.add.text(rankX, currentY + rowHeight / 2, medalLabel, {
          fontFamily: 'Roboto', fontSize: isTopThree ? '20px' : '16px', color: nameColor, fontStyle: fontWeight 
      }).setOrigin(0.5);

      // Avatar Text
      const avatarText = this.add.text(avatarX, currentY + rowHeight / 2, avatar, {
          fontFamily: 'Roboto', fontSize: '20px', color: nameColor
      }).setOrigin(0.5);
      
      // Name Text
      const nameText = this.add.text(nameX, currentY + rowHeight / 2, `${playerEntry.playerSlot} - ${playerEntry.playerName}`, {
          fontFamily: 'Roboto', fontSize: '16px', color: nameColor, fontStyle: fontWeight
      }).setOrigin(0, 0.5); // Align left, vertically center

      // Score Text (initially 0 for animation)
      const scoreText = this.add.text(scoreX, currentY + rowHeight / 2, `0 pts`, {
          fontFamily: 'Roboto', fontSize: scoreFontSize, color: scoreColor, fontStyle: 'bold'
      }).setOrigin(1, 0.5); // Align right, vertically center

      // Staggered Row Animation
      const rowElements = [rankText, avatarText, nameText, scoreText];
      rowElements.forEach(el => { el.setAlpha(0); el.y += 10; }); // Initial state for animation

      this.tweens.add({
          targets: rowElements,
          alpha: 1,
          y: '-=10', // Move up to final position
          ease: 'Power1',
          duration: 400,
          delay: initialDelay + index * staggerDelay
      });

      // Score Count-Up Animation
      this.tweens.addCounter({
          from: 0,
          to: playerEntry.score,
          duration: 600 + index * 100, 
          delay: initialDelay + index * staggerDelay + 200, // Start after row slides in
          ease: 'Power1',
          onUpdate: tween => {
              scoreText.setText(`${Math.floor(tween.getValue())} pts`);
          }
      });
      currentY += rowHeight; 
    });
    
    const scoreboardBgHeight = (currentY - scoreboardBgY) + scoreboardPadding / 2; // Calculate actual height
    graphics.fillRoundedRect(scoreboardBgX, scoreboardBgY, scoreboardBgWidth, scoreboardBgHeight, 10);


    // Position button below the list
    const buttonY = scoreboardBgY + scoreboardBgHeight + 30; 
    const restartBtn = this.add.dom(180, buttonY, 'button', null, 'Play Again').setClassName('button');
    restartBtn.setOrigin(0.5); 
    restartBtn.node.style.backgroundColor = 'var(--success-color)';
    restartBtn.node.style.transform = 'scale(0.8)'; 
    this.tweens.add({
        targets: restartBtn.node,
        scale: 1,
        ease: 'Back.easeOut',
        duration: 300,
        delay: initialDelay + playersWithScores.length * staggerDelay + 300 
    });

    restartBtn.addListener('click');
    restartBtn.on('click', () => {
      console.log("PLAY_SOUND: click.mp3");
      this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
        if (progress === 1) {
          console.log("PLAY_SOUND: transition.mp3");
          clearStoredPlayerData(); 
          location.reload();
        }
      });
    });

    // Position thank you message below the button
    const thankYouY = buttonY + (restartBtn.node.offsetHeight || 40) + 30; // Use offsetHeight or estimate
    this.add.text(180, thankYouY, '🎉 Thank you for playing UnClear! 🎉', {
      fontFamily: 'Roboto',
      fontSize: '16px',
      color: 'var(--primary-accent-color)',
      align: 'center'
    }).setOrigin(0.5);
  }
}
