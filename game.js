let socket = io();
let isRejoining = false;
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
  // playerMap is no longer needed here as FinalScoreScene now uses the players array directly.
  console.log('[GameJS] Received finalScores event with scores:', scores, 'and players:', players);
  game.scene.start('FinalScoreScene', { scores, players });
});

// Reconnect attempt on refresh
window.addEventListener('load', () => {
  const savedName = sessionStorage.getItem('playerName');
  const savedSlot = sessionStorage.getItem('playerSlot');
  const savedGameId = sessionStorage.getItem('gameId');

  if (savedName && savedSlot && savedGameId) {
    isRejoining = true;
    playerName = savedName;
    playerSlot = savedSlot;
    gameId = savedGameId;

    console.log(`🔄 Attempting reconnect for ${playerSlot} - ${playerName} in game ${gameId}`);
    // Ensure socket is connected (it's initialized globally)
    // If socket.connected is false, might need to handle reconnection explicitly here or rely on io()'s auto-reconnect
    socket.emit('rejoinGameCheck', { gameId, playerName, playerSlot });
  } else {
    isRejoining = false; // Explicitly set for clarity
  }
  // Phaser game initialization will proceed, LandingScene will handle the isRejoining flag
});

socket.on('syncToScene', ({ sceneName, sceneData }) => {
  console.log(`SYNC_TO_SCENE: Received scene: ${sceneName} with data:`, sceneData);
  if (game && game.scene) { // Ensure game and scene manager are available
    game.scene.start(sceneName, sceneData);
  } else {
    console.error('SYNC_TO_SCENE: Phaser game instance or scene manager not available.');
    // Potentially queue this and try again once Phaser is ready, or handle error
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
