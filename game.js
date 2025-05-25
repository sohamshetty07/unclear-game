let socket = io();
let playerName = '';
let playerSlot = '';
let gameId = '';
let yourSocketId = '';
let topBanner = null; // Declare topBanner here

// Check for debug mode
const currentUrl = new URL(window.location.href);
const isDebugMode = currentUrl.searchParams.get("debug") === "true";

if (isDebugMode) {
  topBanner = document.createElement('div');
  topBanner.style.position = 'absolute';
  topBanner.style.top = '10px';
  topBanner.style.left = '50%';
  topBanner.style.transform = 'translateX(-50%)';
  topBanner.style.fontSize = '12px'; // Slightly smaller for a debug banner
  topBanner.style.fontFamily = 'Roboto, sans-serif';
  topBanner.style.color = 'var(--text-color)';
  topBanner.style.backgroundColor = 'var(--light-gray-color)'; // Light background for the banner
  topBanner.style.padding = '4px 8px';
  topBanner.style.borderRadius = '4px';
  topBanner.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  topBanner.style.fontWeight = 'normal'; // Normal weight for less emphasis
  topBanner.style.zIndex = '999';
  topBanner.innerText = 'Not joined yet'; // Initial text
  document.body.appendChild(topBanner);
}

function updatePlayerBanner() {
  // Check if topBanner was created (i.e., isDebugMode was true)
  if (topBanner && playerName && playerSlot) { 
    topBanner.innerText = `${playerSlot} - ${playerName}`;
  } else if (topBanner) {
    // Optional: still update with generic message if in debug mode but not fully joined
    // topBanner.innerText = 'Not fully joined yet (debug)'; 
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
    LandingScene,
    JoinScene,
    GameScene,
    RoundScene,
    VotingScene,
    ResultScene,
    FinalScoreScene
  ]
};

let game = new Phaser.Game(config);
