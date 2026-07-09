// --- 1. AUDIO SYNTHESIS ENGINE ---
const AudioEngine = {
  ctx: null,
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },
  playTone(freq, type, duration) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  jump() { this.playTone(400, 'sine', 0.15); },
  coin() { this.playTone(800, 'triangle', 0.1); },
  shield() { this.playTone(600, 'square', 0.2); },
  crash() { this.playTone(100, 'sawtooth', 0.3); }
};

// --- 2. GAME SETUP & STATE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const lanes = [90, 200, 310];
let currentLane = 1;
let score = 0;
let coinsCollected = 0;
let gameSpeed = 6;
let isGameOver = false;
let isPlaying = false;
let animFrame;

// Environment & Animations
let gridOffset = 0;
let particles = [];
let gameObjects = []; 
let spawnTimer = 0;

// Characters Config
const charConfigs = {
  neon: { color: '#00f2fe', trail: '#00f2fe44' },
  blaze: { color: '#ff007f', trail: '#ff007f44' },
  viper: { color: '#00ff88', trail: '#00ff8844' }
};
let selectedChar = 'neon';

// Player Object
const player = {
  x: lanes[currentLane],
  y: 480,
  zY: 0,
  jumpVelocity: 0,
  isJumping: false,
  width: 36,
  height: 48,
  targetX: lanes[currentLane],
  hasShield: false,
  shieldTimer: 0
};

// --- 3. INPUT & SELECTION HANDLERS ---
function handleInput(e) {
  if (!isPlaying || isGameOver) return;

  if ((e.key === 'ArrowLeft' || e.key === 'a') && currentLane > 0) {
    currentLane--;
    spawnParticles(player.x, player.y, charConfigs[selectedChar].color, 5);
  } 
  else if ((e.key === 'ArrowRight' || e.key === 'd') && currentLane < 2) {
    currentLane++;
    spawnParticles(player.x, player.y, charConfigs[selectedChar].color, 5);
  } 
  else if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') && !player.isJumping) {
    player.isJumping = true;
    player.jumpVelocity = 12;
    AudioEngine.jump();
  }

  player.targetX = lanes[currentLane];
}

window.addEventListener('keydown', handleInput);

// Character Card Click Handler
document.querySelectorAll('.char-card').forEach(card => {
  card.addEventListener('click', () => {
    selectedChar = card.dataset.char;
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
  });
});

// --- 4. PARTICLE ENGINE ---
function spawnParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      size: Math.random() * 4 + 2,
      color: color,
      life: 1
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  });
}

// --- 5. GAME OBJECTS & SPAWNING ---
function spawnObject() {
  const laneIndex = Math.floor(Math.random() * 3);
  const rand = Math.random();

  let type = 'obstacle';
  if (rand > 0.7) type = 'coin';
  else if (rand > 0.65) type = 'shield';

  gameObjects.push({
    type: type,
    x: lanes[laneIndex],
    y: -50,
    width: type === 'coin' ? 20 : 40,
    height: type === 'coin' ? 20 : 40,
    rotation: 0
  });
}

// --- 6. UPDATE LOOP ---
function update() {
  if (isGameOver || !isPlaying) return;

  gridOffset = (gridOffset + gameSpeed) % 40;
  player.x += (player.targetX - player.x) * 0.25;

  if (player.isJumping) {
    player.zY += player.jumpVelocity;
    player.jumpVelocity -= 0.7;

    if (player.zY <= 0) {
      player.zY = 0;
      player.isJumping = false;
    }
  }

  if (player.hasShield) {
    player.shieldTimer--;
    if (player.shieldTimer <= 0) player.hasShield = false;
  }

  if (Math.random() > 0.3) {
    spawnParticles(player.x, player.y - player.zY + 20, charConfigs[selectedChar].color, 1);
  }

  spawnTimer++;
  if (spawnTimer % Math.max(18, Math.floor(50 - gameSpeed)) === 0) {
    spawnObject();
  }

  for (let i = gameObjects.length - 1; i >= 0; i--) {
    let obj = gameObjects[i];
    obj.y += gameSpeed;
    obj.rotation += 0.05;

    const playerActualY = player.y - player.zY;
    const isColliding = 
      Math.abs(player.x - obj.x) < (player.width + obj.width) / 2 &&
      Math.abs(playerActualY - obj.y) < (player.height + obj.height) / 2;

    if (isColliding) {
      if (obj.type === 'coin') {
        coinsCollected++;
        score += 25;
        AudioEngine.coin();
        spawnParticles(obj.x, obj.y, '#ffd700', 10);
        gameObjects.splice(i, 1);
        continue;
      } 
      else if (obj.type === 'shield') {
        player.hasShield = true;
        player.shieldTimer = 300;
        AudioEngine.shield();
        spawnParticles(obj.x, obj.y, '#00f2fe', 12);
        gameObjects.splice(i, 1);
        continue;
      } 
      else if (obj.type === 'obstacle') {
        if (player.zY < 25) {
          if (player.hasShield) {
            player.hasShield = false;
            spawnParticles(player.x, player.y, '#00f2fe', 20);
            gameObjects.splice(i, 1);
            AudioEngine.crash();
            continue;
          } else {
            gameOver();
            return;
          }
        }
      }
    }

    if (obj.y > canvas.height + 50) {
      gameObjects.splice(i, 1);
      score += 10;
      gameSpeed += 0.02;
    }
  }

  updateParticles();

  document.getElementById('score').innerText = `SCORE: ${score}`;
  document.getElementById('coins').innerText = `🪙 ${coinsCollected}`;
}

// --- 7. RENDERING ENGINE ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background Grid
  ctx.strokeStyle = '#1f1a3a';
  ctx.lineWidth = 2;
  for (let y = gridOffset; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Lane Dividers
  ctx.strokeStyle = 'rgba(0, 242, 254, 0.2)';
  ctx.lineWidth = 3;
  [145, 255].forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  });

  // Game Objects
  gameObjects.forEach(obj => {
    ctx.save();
    ctx.translate(obj.x, obj.y);

    if (obj.type === 'obstacle') {
      ctx.fillStyle = '#ff0055';
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 12;
      ctx.fillRect(-obj.width/2, -obj.height/2, obj.width, obj.height);
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-obj.width/2, 0); ctx.lineTo(obj.width/2, 0);
      ctx.stroke();
    } 
    else if (obj.type === 'coin') {
      ctx.rotate(obj.rotation);
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, obj.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } 
    else if (obj.type === 'shield') {
      ctx.rotate(-obj.rotation);
      ctx.fillStyle = '#00f2fe';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 15;
      ctx.fillRect(-12, -12, 24, 24);
    }
    ctx.restore();
  });

  drawParticles();

  // Player
  const playerRenderY = player.y - player.zY;

  const shadowScale = Math.max(0.2, 1 - player.zY / 100);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 20, 20 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (player.hasShield) {
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(player.x, playerRenderY, 32, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = charConfigs[selectedChar].color;
  ctx.shadowColor = charConfigs[selectedChar].color;
  ctx.shadowBlur = 15;
  
  ctx.beginPath();
  ctx.roundRect(
    player.x - player.width / 2,
    playerRenderY - player.height / 2,
    player.width,
    player.height,
    8
  );
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(player.x - 10, playerRenderY - 14, 20, 6);
}

// --- 8. LOOP & GAME OVER ---
function gameLoop() {
  update();
  draw();
  if (!isGameOver && isPlaying) {
    animFrame = requestAnimationFrame(gameLoop);
  }
}

function gameOver() {
  isGameOver = true;
  isPlaying = false;
  AudioEngine.crash();
  spawnParticles(player.x, player.y, '#ff0055', 30);
  
  document.getElementById('final-score').innerText = `Final Score: ${score}`;
  document.getElementById('final-coins').innerText = `Coins Collected: 🪙 ${coinsCollected}`;
  document.getElementById('game-over-screen').classList.remove('hidden');
  cancelAnimationFrame(animFrame);
}

function startGame() {
  AudioEngine.init();
  score = 0;
  coinsCollected = 0;
  gameSpeed = 6;
  currentLane = 1;
  player.x = lanes[currentLane];
  player.targetX = lanes[currentLane];
  player.zY = 0;
  player.isJumping = false;
  player.hasShield = false;
  gameObjects = [];
  particles = [];
  isGameOver = false;
  isPlaying = true;

  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');

  gameLoop();
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);