let socket = io();
let playerName = '';
let playerSlot = '';
let gameId = '';
let yourSocketId = '';

// Persistent banner for reconnect debugging
const topBanner = document.createElement('div');
topBanner.style.position = 'absolute';
topBanner.style.top = '10px';
topBanner.style.left = '50%';
topBanner.style.transform = 'translateX(-50%)';
topBanner.style.fontSize = '14px';
topBanner.style.fontFamily = 'Arial, sans-serif';
topBanner.style.color = '#222';
topBanner.style.fontWeight = 'bold';
topBanner.style.zIndex = '999';
topBanner.innerText = 'Not joined yet';
document.body.appendChild(topBanner);

function updatePlayerBanner() {
  if (playerName && playerSlot) {
    topBanner.innerText = `${playerSlot} - ${playerName}`;
  }
}

class JoinScene extends Phaser.Scene {
  constructor() {
    super('JoinScene');
  }

  create() {
    const scene = this;
    const storedGameId = sessionStorage.getItem('gameId');
    const storedPlayerName = sessionStorage.getItem('playerName');
    const storedPlayerSlot = sessionStorage.getItem('playerSlot');

    // Handle reconnect flow first
    if (storedGameId && storedPlayerName && storedPlayerSlot) {
      gameId = storedGameId;
      playerName = storedPlayerName;
      playerSlot = storedPlayerSlot;

      // 👇 Setup ALL event listeners FIRST
      socket.on('playerJoined', ({ players, yourSocketId: id }) => {
        yourSocketId = id;
        const me = players.find(p =>
          p.playerName === playerName && p.playerSlot === playerSlot
        );
        if (me) {
          updatePlayerBanner();
          // Do not jump scenes here; wait for proper sync events
        }
      });

      socket.on('startRound', ({ word, turnOrder, currentClueTurn, round }) => {
        this.scene.stop();
        this.scene.start('RoundScene', { word, turnOrder, currentClueTurn, round });
      });

      socket.on('beginVoting', ({ players, alreadyVoted, playerMap }) => {
        const others = players.filter(p => p.playerSlot !== playerSlot);
        this.scene.stop();
        this.scene.start('VotingScene', {
          round: 1,
          votablePlayers: others,
          alreadyVoted,
          playerMap
        });
      });

      socket.on('votingResults', (data) => {
        this.scene.stop();
        this.scene.start('ResultScene', data);
      });

      socket.on('showFinalScores', (data) => {
        this.scene.stop();
        this.scene.start('FinalScoreScene', data);
      });

      socket.on('errorMessage', msg => {
        alert(msg);
      });

      // 👇 Only emit joinGame AFTER all listeners are ready
      socket.emit('joinGame', { gameId, playerName, playerSlot });
      return;
    }

    // UI Setup
    this.add.text(180, 50, 'UnClear MVP', {
      font: '700 32px -apple-system, BlinkMacSystemFont, sans-serif',
      fill: '#111'
    }).setOrigin(0.5);

    // Game ID Input
    const gameIdInput = this.add.dom(180, 120, 'input', {
      type: 'text',
      fontSize: '15px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      width: '220px',
      padding: '10px 12px',
      border: '1px solid #ccc',
      borderRadius: '8px',
      outline: 'none'
    });
    gameIdInput.node.placeholder = 'Game ID (leave blank to host)';

    // Name Input
    const nameInput = this.add.dom(180, 180, 'input', {
      type: 'text',
      fontSize: '15px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      width: '220px',
      padding: '10px 12px',
      border: '1px solid #ccc',
      borderRadius: '8px',
      outline: 'none'
    });
    nameInput.node.placeholder = 'Your Name';

    // Dropdown
    const dropdownHTML = `
      <select id="playerSlot" style="
        font-size: 15px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        width: 220px;
        padding: 10px 12px;
        border: 1px solid #ccc;
        border-radius: 8px;
        outline: none;
        appearance: none;
        background-color: #fff;
      ">
      <option value="">Select Player Slot</option>
      ${[...Array(12).keys()].map(i => `<option value="Player ${i + 1}">Player ${i + 1}</option>`).join('')}
    </select>`;
  this.add.dom(180, 240).createFromHTML(dropdownHTML);

    // Join Button
    const joinBtn = this.add.dom(180, 310, 'button', {
      fontSize: '16px',
      fontWeight: '500',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      padding: '12px 22px',
      backgroundColor: '#007aff',
      color: '#fff',
      border: 'none',
      borderRadius: '12px',
      cursor: 'pointer',
      boxShadow: '0 3px 6px rgba(0,0,0,0.08)',
      transition: 'all 0.2s ease-in-out'
    }, 'Join Game');

    joinBtn.addListener('click');
    joinBtn.on('click', () => {
      playerName = nameInput.node.value;
      playerSlot = document.getElementById('playerSlot').value;
      gameId = gameIdInput.node.value.trim();

      if (!playerName || !playerSlot) {
        alert('Enter your name and select a player slot.');
        return;
      }

      if (!gameId) {
        gameId = generateGameId();
        socket.emit('createGame', gameId);
        alert(`Game Created! Share this Game ID: ${gameId}`);
      }

      sessionStorage.setItem('gameId', gameId);
      sessionStorage.setItem('playerName', playerName);
      sessionStorage.setItem('playerSlot', playerSlot);

      socket.emit('joinGame', { gameId, playerName, playerSlot });
    });

    // When players join or rejoin
    socket.on('playerJoined', ({ players, yourSocketId: id }) => {
      yourSocketId = id;
      const alreadyInGame = players.some(p =>
        p.playerName === playerName && p.playerSlot === playerSlot
      );
      if (alreadyInGame) {
        updatePlayerBanner();
        socket.emit('syncRequest', { gameId, playerSlot });
        scene.scene.start('GameScene');
      }
    });

    // Handle all sync scenarios
    socket.on('startRound', ({ word, turnOrder, currentClueTurn, round }) => {
      console.log('[JoinScene] received startRound after reconnect');
      this.scene.stop();
      this.scene.start('RoundScene', { word, turnOrder, currentClueTurn, round });
    });

    socket.on('beginVoting', ({ players, alreadyVoted, playerMap }) => {
      console.log('[JoinScene] received beginVoting after reconnect');
      const others = players.filter(p => p.playerSlot !== playerSlot);
      this.scene.stop();
      this.scene.start('VotingScene', {
        round: 1,
        votablePlayers: others,
        alreadyVoted,
        playerMap
      });
    });

    socket.on('votingResults', (data) => {
      console.log('[JoinScene] received votingResults after reconnect');
      this.scene.stop();
      this.scene.start('ResultScene', data);
    });

    socket.on('showFinalScores', (data) => {
      console.log('[JoinScene] received final scores after reconnect');
      this.scene.stop();
      this.scene.start('FinalScoreScene', data);
    });

    socket.on('errorMessage', msg => {
      alert(msg);
    });
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const scene = this;

    this.add.text(30, 40, `Welcome ${playerName} (${playerSlot})`, {
      font: '18px Arial',
      fill: '#000'
    });

    this.add.text(30, 70, `Game ID: ${gameId}`, {
      font: '14px Arial',
      fill: '#444'
    });

    let isReady = false;
    let isHost = false;

    const readyBtn = this.add.dom(180, 300, 'button', {
      fontSize: '16px',
      padding: '6px 16px',
      backgroundColor: '#2196F3',
      color: '#fff',
      border: 'none',
      borderRadius: '5px'
    }, "I'm Ready");

    readyBtn.addListener('click');
    readyBtn.on('click', () => {
      isReady = !isReady;
      readyBtn.node.innerText = isReady ? 'Not Ready' : "I'm Ready";
      socket.emit('toggleReady', { gameId, playerSlot, isReady });
    });

    // ✅ Declare playerListContainer text block
    this.playerListContainer = this.add.text(30, 360, 'Players loading...', {
      font: '14px Courier',
      fill: '#000',
      lineSpacing: 4
    });

    // ✅ Start button (host only, visible when all ready)
    const startBtn = this.add.dom(180, 580, 'button', {
      fontSize: '16px',
      padding: '8px 18px',
      backgroundColor: '#4CAF50',
      color: '#fff',
      border: 'none',
      borderRadius: '5px',
      display: 'none'
    }, 'Start Game');
    this.startBtn = startBtn;

    startBtn.addListener('click');
    startBtn.on('click', () => {
      socket.emit('startGame', gameId);
    });

    socket.removeAllListeners('playerJoined');

    socket.on('playerJoined', ({ players, yourSocketId: id }) => {
      yourSocketId = id;

      let playerText = 'Players:\n';
      const everyoneReady = players.length > 0 && players.every(p => p.isReady);

      const me = players.find(p => p.playerSlot === playerSlot && p.playerName === playerName);
      isHost = me?.isHost || false;

      players.forEach(p => {
        const hostMark = p.isHost ? ' 👑' : '';
        const readyMark = p.isReady ? '✅' : '❌';
        playerText += `${p.playerSlot} - ${p.playerName}${hostMark} [${readyMark}]\n`;
      });

      this.playerListContainer.setText(playerText);

      if (this.startBtn && this.startBtn.node) {
        this.startBtn.node.style.display = (isHost && everyoneReady) ? 'block' : 'none';
      }
    });

    socket.on('startRound', ({ word, turnOrder, currentClueTurn, round }) => {
      this.scene.stop();
      this.scene.start('RoundScene', {
        word, turnOrder, currentClueTurn, round
      });
    });

    socket.emit('requestPlayerList', gameId);
  }
}

class RoundScene extends Phaser.Scene {
  constructor() {
    super('RoundScene');
  }

  init(data) {
    this.word = data.word;
    this.turnOrder = data.turnOrder;
    this.currentClueTurn = data.currentClueTurn;
    this.round = data.round;
  }

  create() {
    this.scene.stop('ResultScene');

    this.add.text(30, 30, `Round ${this.round}`, { font: '18px Arial', fill: '#000' });
    this.add.text(30, 60, `Your Word: ${this.word}`, { font: '16px Arial', fill: '#333' });

    this.clueText = this.add.text(30, 110, `Waiting for your turn...`, {
      font: '16px Arial', fill: '#000'
    });

    const nextBtn = this.add.dom(180, 500, 'button', {
      fontSize: '16px',
      padding: '6px 16px',
      backgroundColor: '#2196F3',
      color: '#fff',
      border: 'none',
      borderRadius: '5px',
      display: 'none'
    }, 'Next');

    nextBtn.addListener('click');
    nextBtn.on('click', () => {
      if (playerSlot !== this.currentClueTurn) {
        alert("It's not your turn yet. Please wait.");
        return;
      }

      socket.emit('nextClue', gameId);
      if (nextBtn && nextBtn.node) nextBtn.node.style.display = 'none';
      this.clueText.setText('Waiting for others...');
    });

    socket.on('nextClueTurn', newTurn => {
      this.currentClueTurn = newTurn;
      if (playerSlot === newTurn) {
        this.clueText.setText(`It's your turn. Give a clue based on your word.`);
        if (nextBtn && nextBtn.node) nextBtn.node.style.display = 'block';
      } else {
        this.clueText.setText(`Waiting for ${newTurn} to give a clue...`);
        if (nextBtn && nextBtn.node) nextBtn.node.style.display = 'none';
      }
    });

    socket.on('beginVoting', ({ players }) => {
      const others = players.filter(p => p.playerSlot !== playerSlot);
      this.scene.start('VotingScene', {
        round: this.round,
        votablePlayers: others
      });
    });

    if (playerSlot === this.currentClueTurn) {
      this.clueText.setText(`It's your turn. Give a clue based on your word.`);
      if (nextBtn && nextBtn.node) nextBtn.node.style.display = 'block';
    }
  }
}

class VotingScene extends Phaser.Scene {
  constructor() {
    super('VotingScene');
  }

  init(data) {
    this.round = data.round;
    this.votablePlayers = data.votablePlayers || [];
    this.tiedPlayers = data.tiedPlayers || null;
    this.playerMap = data.playerMap || {};
    this.alreadyVoted = data.alreadyVoted || false;
  }

  create() {
    const scene = this;

    this.add.text(180, 10, `${playerSlot} - ${playerName}`, {
      font: '14px Arial',
      fill: '#000'
    }).setOrigin(0.5, 0);

    this.add.text(30, 40, `Round ${this.round} Voting`, {
      font: '20px Arial',
      fill: '#000'
    });

    this.voteStatus = this.add.text(30, 80, 'Select who you think is the imposter:', {
      font: '14px Arial',
      fill: '#333'
    });

    const options = this.tiedPlayers || this.votablePlayers;
    const dropdownHTML = `
      <select id="voteDropdown" style="font-size:16px; width:200px;">
        <option value="">-- Select Player --</option>
        ${options.map(p =>
          `<option value="${p.playerSlot}">${p.playerSlot} - ${p.playerName}</option>`
        ).join('')}
      </select>`;
    this.add.dom(180, 130).createFromHTML(dropdownHTML);

    const submitBtn = this.add.dom(180, 200, 'button', {
      fontSize: '16px',
      padding: '6px 14px',
      backgroundColor: '#4CAF50',
      color: '#fff',
      border: 'none',
      borderRadius: '5px',
      position: 'absolute',
      transform: 'translateX(-50%)'
    }, 'Submit Vote');

    if (this.alreadyVoted) {
      this.voteStatus.setText('You already voted. Waiting for others...');
      if (submitBtn && submitBtn.node) submitBtn.node.disabled = true;
    }

    submitBtn.addListener('click');
    submitBtn.on('click', () => {
      const selected = document.getElementById('voteDropdown').value;
      if (!selected) {
        alert('Please select a player.');
        return;
      }

      console.log('[DEBUG] Submit vote clicked:', selected);

      socket.emit('submitVote', {
        gameId,
        voter: playerSlot,
        voted: selected
      });

      if (submitBtn && submitBtn.node) submitBtn.node.disabled = true;
      this.voteStatus.setText('Vote submitted. Waiting for others...');
    });

    socket.on('votingResults', ({ votes, imposter, correctGuessers, scores, playerMap, players }) => {
      scene.scene.start('ResultScene', {
        votes,
        imposter,
        correctGuessers,
        scores,
        playerMap,
        players,
        round: this.round,
        isHost: players.find(p => p.playerSlot === playerSlot)?.isHost || false
      });
    });

    socket.on('revote', ({ tiedPlayers }) => {
      const fullTied = tiedPlayers.map(slot =>
        this.votablePlayers.find(p => p.playerSlot === slot) || { playerSlot: slot, playerName: 'Unknown' }
      );

      scene.scene.start('VotingScene', {
        round: this.round,
        votablePlayers: this.votablePlayers,
        tiedPlayers: fullTied,
        playerMap: this.playerMap
      });
    });
  }
}

class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  init(data) {
    this.round = data.round;
    this.votes = data.votes;
    this.imposter = data.imposter;
    this.correctGuessers = data.correctGuessers;
    this.scores = data.scores;
    this.playerMap = data.playerMap || {};
    this.isHost = data.isHost || false;
    this.players = data.players || [];
  }

  create() {
    const scene = this;
    this.readyBtn = null;
    this.endBtn = null;
    this.contentGroup = this.add.group();

    let y = 30;

    this.contentGroup.add(this.add.text(30, y, `Round ${this.round} Result`, {
      font: '20px Arial', fill: '#000'
    }));
    y += 40;

    const imposterName = `${this.imposter} - ${this.playerMap[this.imposter] || 'Unknown'}`;
    this.contentGroup.add(this.add.text(30, y, `Imposter: ${imposterName}`, {
      font: '16px Arial', fill: '#555'
    }));
    y += 40;

    Object.entries(this.votes).forEach(([voter, voted]) => {
      const voterName = this.playerMap[voter] || '?';
      const votedName = this.playerMap[voted] || '?';
      this.contentGroup.add(this.add.text(30, y, `${voter} ➜ ${voted}`, {
        font: '14px Arial', fill: '#000'
      }));
      y += 24;
    });

    y += 10;
    this.contentGroup.add(this.add.text(30, y, `Correct Guessers:`, {
      font: '14px Arial', fill: 'green'
    }));
    y += 20;

    const correctNames = this.correctGuessers.map(slot => `${slot} - ${this.playerMap[slot] || ''}`);
    for (let i = 0; i < correctNames.length; i += 3) {
      const chunk = correctNames.slice(i, i + 3).join(', ');
      this.contentGroup.add(this.add.text(30, y, chunk, {
        font: '14px Arial', fill: 'green'
      }));
      y += 20;
    }

    this.readyListText = this.add.text(30, y + 10, 'Players ready: 0', {
      font: '14px Arial', fill: '#333'
    });
    this.contentGroup.add(this.readyListText);

    // Ready Button
    this.readyBtn = this.add.dom(180, y + 60, 'button', {
      fontSize: '16px',
      padding: '6px 18px',
      backgroundColor: '#4CAF50',
      color: '#fff',
      border: 'none',
      borderRadius: '5px'
    }, 'Ready for Next Round');

    this.readyBtn.addListener('click');
    this.readyBtn.on('click', () => {
      if (this.readyBtn && this.readyBtn.node) this.readyBtn.node.disabled = true;
      socket.emit('nextRoundReady', { gameId, playerSlot });
    });

    // End Game Button
    if (this.isHost) {
      this.endBtn = this.add.dom(180, y + 120, 'button', {
        fontSize: '16px',
        padding: '6px 18px',
        backgroundColor: '#f44336',
        color: '#fff',
        border: 'none',
        borderRadius: '5px'
      }, 'End Game');

      this.endBtn.addListener('click');
      this.endBtn.on('click', () => {
        socket.emit('endGame', gameId);
      });
    }

    socket.on('nextRoundStatus', readySlots => {
      const names = readySlots.map(s => {
        const isHostPlayer = this.players.find(p => p.playerSlot === s)?.isHost;
        const crown = isHostPlayer ? ' 👑' : '';
        return `${s} - ${this.playerMap[s] || ''}${crown}`;
      });
      if (this.readyListText) {
        this.readyListText.setText(`Players ready: ${names.length}\n${names.join('\n')}`);
      }
    });

    socket.on('showFinalScores', ({ scores, playerMap }) => {
      scene.scene.start('FinalScoreScene', { scores, playerMap });
    });
  }
}

class FinalScoreScene extends Phaser.Scene {
  constructor() {
    super('FinalScoreScene');
  }

  init(data) {
    this.scores = data.scores;
    this.playerMap = data.playerMap;
  }

  create() {
    this.cameras.main.setBackgroundColor('#f8f8f8');

    this.add.text(80, 30, '🏆 Final Leaderboard', {
      font: '22px Arial', fill: '#000', fontStyle: 'bold'
    });

    const medalIcons = ['🥇', '🥈', '🥉'];

    const sorted = Object.entries(this.scores)
      .sort(([, a], [, b]) => b - a)
      .map(([slot, score], index) => {
        const name = this.playerMap[slot] || 'Unknown';
        const label = medalIcons[index] || `${index + 1}.`;
        return `${label} ${slot} - ${name} ➜ ${score} pts`;
      });

    let y = 80;
    sorted.forEach(entry => {
      this.add.text(30, y, entry, { font: '16px Arial', fill: '#333' });
      y += 28;
    });

    const restartBtn = this.add.dom(180, y + 40, 'button', {
      fontSize: '16px',
      padding: '6px 16px',
      backgroundColor: '#4CAF50',
      color: '#fff',
      border: 'none',
      borderRadius: '5px'
    }, 'Play Again');

    restartBtn.addListener('click');
    restartBtn.on('click', () => {
      clearStoredPlayerData();
      location.reload();
    });

    this.add.text(30, y + 80, '🎉 Thank you for playing UnClear!', {
      font: '14px Arial',
      fill: '#00796B'
    });
  }
}

// Global fallback listeners
socket.on('votingResults', resultData => {
  game.scene.start('ResultScene', resultData);
});

socket.on('finalScores', ({ scores, players }) => {
  const playerMap = {};
  players.forEach(p => {
    playerMap[p.playerSlot] = p.playerName;
  });
  game.scene.start('FinalScoreScene', { scores, playerMap });
});

// Reconnect attempt on refresh
window.addEventListener('load', () => {
  const savedName = sessionStorage.getItem('playerName');
  const savedSlot = sessionStorage.getItem('playerSlot');
  const savedGameId = sessionStorage.getItem('gameId');

  if (savedName && savedSlot && savedGameId) {
    playerName = savedName;
    playerSlot = savedSlot;
    gameId = savedGameId;

    console.log(`🔄 Attempting reconnect for ${playerSlot} - ${playerName}`);
    socket.emit('joinGame', { gameId, playerName, playerSlot });
  }
});

// Utility
function clearStoredPlayerData() {
  sessionStorage.removeItem('playerName');
  sessionStorage.removeItem('playerSlot');
  sessionStorage.removeItem('gameId');
}

function generateGameId() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += letters[Math.floor(Math.random() * letters.length)];
  }
  return id;
}

// Phaser Game Config
let config = {
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  backgroundColor: '#ffffff',
  parent: 'game-container',
  dom: { createContainer: true },
  scene: [
    JoinScene,
    GameScene,
    RoundScene,
    VotingScene,
    ResultScene,
    FinalScoreScene
  ]
};

let game = new Phaser.Game(config);
