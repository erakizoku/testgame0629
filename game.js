const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const heartsEl = document.getElementById("hearts");
const scoreEl = document.getElementById("score");
const message = document.getElementById("message");
const startButton = document.getElementById("startButton");

const WORLD = { width: 3600, height: 540 };
const GRAVITY = 0.62;
const FRICTION = 0.82;
const input = { left: false, right: false, jump: false, attack: false };
let running = false;
let cameraX = 0;
let win = false;
let frameTick = 0;

const player = { x: 160, y: 300, w: 44, h: 58, vx: 0, vy: 0, dir: 1, grounded: false, hp: 3, gems: 0, hurtTimer: 0, attackTimer: 0, jumpLock: false };
const platforms = [
  { x: 0, y: 472, w: 720, h: 68, type: "ground" },
  { x: 820, y: 472, w: 640, h: 68, type: "ground" },
  { x: 1550, y: 472, w: 760, h: 68, type: "ground" },
  { x: 2410, y: 472, w: 1120, h: 68, type: "ground" },
  { x: 420, y: 372, w: 160, h: 30, type: "floating" },
  { x: 1010, y: 360, w: 190, h: 30, type: "floating" },
  { x: 1380, y: 300, w: 160, h: 30, type: "floating" },
  { x: 1820, y: 384, w: 190, h: 30, type: "floating" },
  { x: 2160, y: 322, w: 150, h: 30, type: "floating" },
  { x: 2600, y: 360, w: 220, h: 30, type: "floating" },
  { x: 3000, y: 310, w: 170, h: 30, type: "floating" }
];
const gems = [456, 548, 1056, 1160, 1438, 1888, 2680, 3060].map((x, i) => ({ x, y: [330, 330, 318, 318, 258, 342, 318, 268][i], got: false }));
const enemies = [
  { x: 650, y: 422, w: 52, h: 50, vx: 0.75, left: 600, right: 760, alive: true },
  { x: 1300, y: 422, w: 52, h: 50, vx: 0.9, left: 1240, right: 1460, alive: true },
  { x: 2020, y: 422, w: 52, h: 50, vx: 0.85, left: 1920, right: 2140, alive: true },
  { x: 2780, y: 422, w: 52, h: 50, vx: 1, left: 2700, right: 2920, alive: true }
];
const flag = { x: 3370, y: 346, w: 92, h: 126 };

const paths = {
  bg: "assets/raw/background_storybook_meadow.png",
  tiles: "assets/raw/tileset_grassland_raw.png",
  hero: "assets/raw/hero_spritesheet_raw.png",
  enemy: "assets/raw/enemy_spritesheet_raw.png",
  items: "assets/raw/items_goal_sheet_raw.png",
  ui: "assets/raw/ui_sheet_raw.png",
};
const assets = {};

const heroFrames = {
  idle: [[112,70,122,150],[315,70,122,150],[520,70,122,150],[720,70,122,150]],
  walk: [[108,255,138,150],[316,255,138,150],[520,255,138,150],[722,255,138,150],[925,255,138,150],[1130,255,138,150]],
  jump: [[105,438,150,150],[318,438,130,150]],
  attack: [[96,615,150,165],[350,615,250,165],[610,615,250,165],[910,615,250,165]],
  hurt: [[98,795,155,170],[330,795,170,170]],
};
const enemyFrames = {
  idle: [[120,145,170,175],[420,145,170,175],[690,145,170,175],[970,145,170,175]],
  walk: [[110,440,190,180],[410,440,190,180],[680,440,190,180],[950,440,190,180]],
  pop: [[1230,445,210,190],[1510,450,180,180]],
};
const tileSrc = { left:[232,95,250,230], mid:[500,95,250,230], right:[790,95,250,230], dirt:[1110,95,210,230], small:[725,375,330,90], flower:[250,575,160,135], grass:[520,575,150,135], sign:[1125,555,170,165], fence:[585,790,320,135] };
const itemSrc = { heart:[48,75,150,135], sparkle:[55,275,80,80], arch:[42,430,330,310], flag:[620,430,130,290], shard:[75,805,120,145], stars:[860,810,230,110] };

function loadImage(src) { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; }); }
function makeTransparent(img, mode) {
  const off = document.createElement("canvas");
  off.width = img.naturalWidth;
  off.height = img.naturalHeight;
  const octx = off.getContext("2d");
  octx.drawImage(img, 0, 0);
  const data = octx.getImageData(0, 0, off.width, off.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const isGreen = g > 180 && r < 95 && b < 95;
    const isMagenta = r > 190 && b > 175 && g < 80;
    if ((mode === "green" && isGreen) || (mode === "magenta" && isMagenta)) px[i + 3] = 0;
  }
  octx.putImageData(data, 0, 0);
  return off;
}
async function loadAssets() {
  const raw = {};
  await Promise.all(Object.entries(paths).map(async ([key, src]) => { raw[key] = await loadImage(src); }));
  assets.bg = raw.bg;
  assets.tiles = makeTransparent(raw.tiles, "magenta");
  assets.hero = makeTransparent(raw.hero, "green");
  assets.enemy = makeTransparent(raw.enemy, "green");
  assets.items = makeTransparent(raw.items, "green");
  assets.ui = makeTransparent(raw.ui, "green");
}
function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function resetGame() { Object.assign(player, { x: 160, y: 300, w: 44, h: 58, vx: 0, vy: 0, dir: 1, grounded: false, hp: 3, gems: 0, hurtTimer: 0, attackTimer: 0, jumpLock: false }); gems.forEach((gem) => gem.got = false); enemies.forEach((enemy, index) => { enemy.alive = true; enemy.x = [650, 1300, 2020, 2780][index]; }); cameraX = 0; win = false; updateHud(); }
function updateHud() { heartsEl.textContent = "HP " + Math.max(0, player.hp); scoreEl.textContent = "Gems " + player.gems + "/" + gems.length; }
function showMessage(title, text, buttonText = "Restart") { message.querySelector("h1").textContent = title; message.querySelector("p").textContent = text; startButton.textContent = buttonText; message.hidden = false; }
function startGame() { resetGame(); running = true; message.hidden = true; requestAnimationFrame(loop); }
function damagePlayer() { if (player.hurtTimer > 0 || win) return; player.hp -= 1; player.hurtTimer = 90; player.vx = -player.dir * 8; player.vy = -8; updateHud(); if (player.hp <= 0) { running = false; showMessage("Try Again", "闕牙次縺ｮ逶ｸ謇九↓縺ｶ縺､縺九▲縺ｦ縺励∪縺・∪縺励◆縲ゅｂ縺・ｸ蠎ｦ縲∝殴縺ｨ繧ｸ繝｣繝ｳ繝励〒騾ｲ縺ｿ縺ｾ縺励ｇ縺・・); } }
function attackBox() { const reach = 56; return { x: player.dir > 0 ? player.x + player.w - 4 : player.x - reach + 4, y: player.y + 12, w: reach, h: 34 }; }
function updatePlayer() { const accel = player.grounded ? 0.72 : 0.42; if (input.left) { player.vx -= accel; player.dir = -1; } if (input.right) { player.vx += accel; player.dir = 1; } if (!input.left && !input.right && player.grounded) player.vx *= FRICTION; player.vx = Math.max(-5.2, Math.min(5.2, player.vx)); if (input.jump && player.grounded && !player.jumpLock) { player.vy = -13.2; player.grounded = false; player.jumpLock = true; } if (!input.jump) player.jumpLock = false; if (input.attack && player.attackTimer <= 0) player.attackTimer = 22; player.vy += GRAVITY; player.x += player.vx; resolveCollisions("x"); player.y += player.vy; player.grounded = false; resolveCollisions("y"); player.x = Math.max(0, Math.min(WORLD.width - player.w, player.x)); if (player.y > WORLD.height + 80) { player.hp = 0; updateHud(); running = false; showMessage("Try Again", "雜ｳ蝣ｴ縺九ｉ關ｽ縺｡縺ｦ縺励∪縺・∪縺励◆縲ゅず繝｣繝ｳ繝励・繧ｿ繧､繝溘Φ繧ｰ繧貞､峨∴縺ｦ縺ｿ縺ｾ縺励ｇ縺・・); } if (player.hurtTimer > 0) player.hurtTimer -= 1; if (player.attackTimer > 0) player.attackTimer -= 1; }
function resolveCollisions(axis) { for (const platform of platforms) { if (!rectsOverlap(player, platform)) continue; if (axis === "x") { if (player.vx > 0) player.x = platform.x - player.w; if (player.vx < 0) player.x = platform.x + platform.w; player.vx = 0; } else { if (player.vy > 0) { player.y = platform.y - player.h; player.grounded = true; } if (player.vy < 0) player.y = platform.y + platform.h; player.vy = 0; } } }
function updateEnemies() { const sword = player.attackTimer > 8 ? attackBox() : null; for (const enemy of enemies) { if (!enemy.alive) continue; enemy.x += enemy.vx; if (enemy.x < enemy.left || enemy.x + enemy.w > enemy.right) enemy.vx *= -1; if (sword && rectsOverlap(sword, enemy)) { enemy.alive = false; player.vx += player.dir * 1.6; continue; } if (rectsOverlap(player, enemy)) { const stomping = player.vy > 2 && player.y + player.h - enemy.y < 18; if (stomping) { enemy.alive = false; player.vy = -10; } else damagePlayer(); } } }
function updateGems() { for (const gem of gems) { if (gem.got) continue; if (rectsOverlap(player, { x: gem.x, y: gem.y, w: 30, h: 28 })) { gem.got = true; player.gems += 1; updateHud(); } } }
function updateGoal() { if (rectsOverlap(player, flag) && !win) { win = true; running = false; showMessage("Stage Clear", "邏譚舌ｒ邨・∩霎ｼ繧薙□邨ｵ譛ｬ繝峨ャ繝磯｢ｨ繝・Δ縺ｧ縺吶ゅ°縺ｪ繧雁ｮ梧・迚医・髮ｰ蝗ｲ豌励↓霑代▼縺阪∪縺励◆縲・); } }
function updateCamera() { const target = player.x - canvas.width * 0.38; cameraX += (target - cameraX) * 0.08; cameraX = Math.max(0, Math.min(WORLD.width - canvas.width, cameraX)); }
function worldX(x) { return Math.round(x - cameraX); }
function expandFrame(src, padX, padY, img) {
  const [sx, sy, sw, sh] = src;
  const x = Math.max(0, sx - padX);
  const y = Math.max(0, sy - padY);
  const right = Math.min(img.width || img.naturalWidth, sx + sw + padX);
  const bottom = Math.min(img.height || img.naturalHeight, sy + sh + padY);
  return [x, y, right - x, bottom - y];
}
function drawImage(img, src, dx, dy, dw, dh, flip = false) { const [sx, sy, sw, sh] = src; ctx.save(); if (flip) { ctx.scale(-1, 1); ctx.drawImage(img, sx, sy, sw, sh, -dx - dw, dy, dw, dh); } else { ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); } ctx.restore(); }
function drawBackground() { const bg = assets.bg; const scale = Math.max(canvas.width / bg.naturalWidth, canvas.height / bg.naturalHeight); const w = bg.naturalWidth * scale; const h = bg.naturalHeight * scale; const x = (canvas.width - w) / 2 - (cameraX * 0.06 % 160); ctx.drawImage(bg, x, (canvas.height - h) / 2, w, h); ctx.drawImage(bg, x + w, (canvas.height - h) / 2, w, h); }
function drawPlatform(p) {
  if (p.type === "floating") {
    drawImage(assets.tiles, tileSrc.small, worldX(p.x), p.y - 18, p.w, 40);
    return;
  }
  const topY = p.y - 14;
  const tileW = 64;
  for (let x = p.x; x < p.x + p.w; x += tileW) {
    const src = x === p.x ? tileSrc.left : (x + tileW >= p.x + p.w ? tileSrc.right : tileSrc.mid);
    drawImage(assets.tiles, src, worldX(x), topY, tileW + 4, 64);
  }
}
function drawDecorations() { for (let i = 0; i < platforms.length; i += 1) { const p = platforms[i]; if (p.type === "floating") continue; if (i % 2 === 0) drawImage(assets.tiles, tileSrc.flower, worldX(p.x + p.w - 86), p.y - 48, 46, 38); if (i % 3 === 0) drawImage(assets.tiles, tileSrc.grass, worldX(p.x + 24), p.y - 38, 40, 34); } }
function drawGem(gem, index) { if (gem.got) return; const bob = Math.sin(frameTick / 14 + index) * 4; const frame = Math.floor(frameTick / 10 + index) % 5; const sx = 48 + Math.min(frame, 4) * 198; drawImage(assets.items, [sx,75,150,135], worldX(gem.x), gem.y + bob, 30, 28); }
function drawEnemy(enemy, index) {
  const frame = Math.floor(frameTick / 12 + index) % 4;
  const baseSrc = enemy.alive ? enemyFrames.walk[frame] : enemyFrames.pop[0];
  const src = expandFrame(baseSrc, 28, 24, assets.enemy);
  drawImage(assets.enemy, src, worldX(enemy.x - 18), enemy.y - 32, 92, 92, enemy.vx > 0);
}
function drawPlayer() {
  const moving = Math.abs(player.vx) > 0.6;
  let baseSrc;
  let padX = 18;
  let padY = 20;
  let drawW = 76;
  let drawH = 96;
  let offsetX = -18;
  let offsetY = -28;
  let flip = player.dir < 0;

  if (player.hurtTimer > 0) {
    // Use a single hurt pose for now; the raw hurt frames have different centers.
    baseSrc = heroFrames.hurt[0];
    padX = 18;
    padY = 20;
    drawW = 82;
    offsetX = -22;
    offsetY = -30;
  } else if (player.attackTimer > 0) {
    // The last thrust frame has the cleanest forward sword silhouette.
    baseSrc = heroFrames.attack[3];
    padX = 10;
    padY = 16;
    drawW = 146;
    drawH = 94;
    offsetX = player.dir > 0 ? -18 : -86;
    offsetY = -27;
  } else if (!player.grounded) {
    baseSrc = heroFrames.jump[player.vy < 0 ? 0 : 1];
    padX = 20;
    padY = 20;
    drawW = 82;
    offsetX = -20;
    offsetY = -30;
  } else if (moving) {
    baseSrc = heroFrames.walk[Math.floor(frameTick / 7) % heroFrames.walk.length];
    padX = 20;
    padY = 22;
    drawW = 84;
    offsetX = -21;
    offsetY = -30;
  } else {
    // Keep idle visually anchored. The generated idle frames are charming but not center-aligned.
    baseSrc = heroFrames.idle[0];
    padX = 18;
    padY = 20;
    drawW = 76;
    offsetX = -18;
    offsetY = -28;
  }

  const src = expandFrame(baseSrc, padX, padY, assets.hero);
  drawImage(assets.hero, src, worldX(player.x + offsetX), player.y + offsetY, drawW, drawH, flip);
  drawSwordEffect();
}
function drawSwordEffect() {
  if (player.attackTimer <= 0) return;
  const progress = 1 - player.attackTimer / 22;
  const baseX = worldX(player.x + (player.dir > 0 ? 44 : -54));
  const baseY = player.y + 18;
  const reach = 52 + progress * 10;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#fff7c7";
  ctx.fillRect(baseX, baseY + 9, player.dir > 0 ? reach : -reach, 7);
  ctx.fillStyle = "#f8c4db";
  ctx.fillRect(baseX + (player.dir > 0 ? 10 : -reach), baseY + 18, player.dir > 0 ? reach - 12 : -(reach - 12), 5);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(baseX + (player.dir > 0 ? reach - 7 : -reach), baseY + 7, 8, 11);
  ctx.restore();
}
function drawGoal() { drawImage(assets.items, itemSrc.arch, worldX(flag.x - 22), flag.y - 10, 118, 128); drawImage(assets.items, itemSrc.flag, worldX(flag.x + 72), flag.y - 8, 58, 112); }
function draw() { ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground(); platforms.forEach(drawPlatform); drawDecorations(); gems.forEach(drawGem); enemies.forEach(drawEnemy); drawGoal(); drawPlayer(); }
function loop() { if (!running) return; frameTick += 1; updatePlayer(); updateEnemies(); updateGems(); updateGoal(); updateCamera(); draw(); requestAnimationFrame(loop); }
function resizeCanvas() { canvas.width = 960; canvas.height = 540; ctx.imageSmoothingEnabled = false; updateCamera(); draw(); }
function preventGestureDefault(event) {
  event.preventDefault();
}

function installMobileGestureGuards() {
  const guardedTargets = [document, document.documentElement, document.body, canvas, document.querySelector('.game-shell'), document.querySelector('.touch-controls')].filter(Boolean);
  guardedTargets.forEach((target) => {
    target.addEventListener('contextmenu', preventGestureDefault, { passive: false });
    target.addEventListener('touchstart', preventGestureDefault, { passive: false });
    target.addEventListener('touchmove', preventGestureDefault, { passive: false });
    target.addEventListener('touchend', preventGestureDefault, { passive: false });
  });
  document.addEventListener('gesturestart', preventGestureDefault, { passive: false });
  document.addEventListener('gesturechange', preventGestureDefault, { passive: false });
  document.addEventListener('gestureend', preventGestureDefault, { passive: false });
}
function bindKey(event, pressed) { const key = event.key.toLowerCase(); if (["arrowleft", "a"].includes(key)) input.left = pressed; if (["arrowright", "d"].includes(key)) input.right = pressed; if (["arrowup", "w", " "].includes(key)) input.jump = pressed; if (["j", "k", "x"].includes(key)) input.attack = pressed; if (["arrowleft", "arrowright", "arrowup", " ", "a", "d", "w", "j", "k", "x"].includes(key)) event.preventDefault(); }
installMobileGestureGuards();
window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => bindKey(event, true));
window.addEventListener("keyup", (event) => bindKey(event, false));
startButton.addEventListener("click", startGame);
document.querySelectorAll("[data-hold]").forEach((button) => {
  const action = button.dataset.hold;
  const set = (value) => {
    input[action] = value;
    button.classList.toggle("is-active", value);
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    set(true);
  });
  button.addEventListener("pointerup", (event) => {
    event.preventDefault();
    set(false);
  });
  button.addEventListener("pointercancel", (event) => {
    event.preventDefault();
    set(false);
  });
  button.addEventListener("lostpointercapture", () => set(false));
});
document.querySelectorAll("[data-tap='attack']").forEach((button) => {
  const triggerAttack = () => {
    input.attack = true;
    if (player.attackTimer <= 0) player.attackTimer = 22;
    button.classList.add("is-active");
    window.setTimeout(() => {
      input.attack = false;
      button.classList.remove("is-active");
    }, 140);
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    triggerAttack();
  });
  button.addEventListener("pointerup", (event) => {
    event.preventDefault();
  });
  button.addEventListener("pointercancel", (event) => {
    event.preventDefault();
    input.attack = false;
    button.classList.remove("is-active");
  });
});
loadAssets().then(() => { resizeCanvas(); resetGame(); draw(); }).catch(() => { showMessage("Load Error", "邏譚舌・隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲ゅヵ繧｡繧､繝ｫ縺ｮ蝣ｴ謇繧堤｢ｺ隱阪＠縺ｦ縺上□縺輔＞縲・, "Retry"); });

