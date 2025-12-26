/* global __CONFIG__ */

const qs = (id) => document.getElementById(id);

const screenLogin = qs("screenLogin");
const screenLobby = qs("screenLobby");
const screenRoom = qs("screenRoom");
const screenGame = qs("screenGame");

const netStatus = qs("netStatus");
const userPill = qs("userPill");

const nameInput = qs("nameInput");
const loginBtn = qs("loginBtn");

const roomNameInput = qs("roomNameInput");
const createRoomBtn = qs("createRoomBtn");
const refreshRoomsBtn = qs("refreshRoomsBtn");
const roomsList = qs("roomsList");
const profileAvatar = qs("profileAvatar");
const profileName = qs("profileName");
const profileId = qs("profileId");
const copyMeBtn = qs("copyMeBtn");
const joinRoomIdInput = qs("joinRoomIdInput");
const joinRoomBtn = qs("joinRoomBtn");

const roomTitle = qs("roomTitle");
const roomMeta = qs("roomMeta");
const playersList = qs("playersList");
const readyCount = qs("readyCount");
const readyBtn = qs("readyBtn");
const startBtn = qs("startBtn");
const leaveRoomBtn = qs("leaveRoomBtn");
const copyRoomIdBtn = qs("copyRoomIdBtn");
const copyInviteBtn = qs("copyInviteBtn");
const winScoreInput = qs("winScoreInput");
const showEnemiesOnMapToggle = qs("showEnemiesOnMapToggle");
const wallTextInput = qs("wallTextInput");

const gameCanvas = qs("gameCanvas");
const hudName = qs("hudName");
const hudHP = qs("hudHP");
const hudScore = qs("hudScore");
const hudPing = qs("hudPing");
const hudBoardMini = qs("hudBoardMini");
const hudBoard = qs("hudBoard");
const hudRoom = qs("hudRoom");
const hudCompass = qs("hudCompass");
const killFeed = qs("killFeed");
const toast = qs("toast");
const damageVignette = qs("damageVignette");
const crosshairEl = document.querySelector(".crosshair");
const chatPanel = qs("chatPanel");
const chatLog = qs("chatLog");
const chatInput = qs("chatInput");
const chatSendBtn = qs("chatSendBtn");
const gameMenu = qs("gameMenu");
const menuResumeBtn = qs("menuResumeBtn");
const menuLeaveBtn = qs("menuLeaveBtn");
const menuCopyInviteBtn = qs("menuCopyInviteBtn");
const sfxToggle = qs("sfxToggle");
const sensRange = qs("sensRange");
const gameOver = qs("gameOver");
const gameOverTitle = qs("gameOverTitle");
const gameOverSub = qs("gameOverSub");
const gameOverBless = qs("gameOverBless");
const gameOverRank = qs("gameOverRank");
const gameOverLeaveBtn = qs("gameOverLeaveBtn");
const gameOverCloseBtn = qs("gameOverCloseBtn");

const app = {
  // @BE: WebSocket connection state (frontend <-> backend)
  ws: null,
  wsUrl: (__CONFIG__ && __CONFIG__.wsUrl) || "ws://localhost:8080/ws",

  userId: "",
  name: "",

  rooms: [],
  room: null,

  map: null,
  tickMs: 50,
  gameState: null,

  input: {
    forward: false,
    back: false,
    left: false,
    right: false,
    turnAccum: 0,
    shootEdge: false,
  },

  sendTimer: null,
  raf: 0,
  showBoard: false,
  pendingRoomJoin: "",
  fx: {
    lastShotAt: 0,
    fireT: 0,
    hitT: 0,
    dmgT: 0,
    toastT: 0,
    shake: 0,
  },
  feed: [],
  prevFrameByID: new Map(),
  chat: [],
  particles: [],
  settings: {
    sfx: true,
    sens: 10,
  },
  net: {
    pingMs: 0,
    pingTimer: null,
  },
  match: {
    winScore: 10,
    showEnemiesOnMap: true,
    over: false,
    overPayload: null,
    wallText: "",
    wallDecal: null,
    wallDecalColor: { r: 255, g: 245, b: 180 },
  },
  roomDraft: {
    winScore: 10,
    showEnemiesOnMap: true,
    wallText: "",
    dirty: false,
    timer: null,
  },
};

function showScreen(el) {
  [screenLogin, screenLobby, screenRoom, screenGame].forEach((s) => s.classList.add("hidden"));
  el.classList.remove("hidden");
  if (el === screenGame) {
    requestAnimationFrame(() => {
      resizeCanvas();
    });
  }
}

function setNetStatus(s) {
  netStatus.textContent = s;
}

function send(type, payload) {
  // @BE: send message to backend (Envelope {type,payload})
  if (!app.ws || app.ws.readyState !== WebSocket.OPEN) return;
  app.ws.send(JSON.stringify({ type, payload }));
}

function parseParams() {
  const p = new URLSearchParams(location.search);
  return {
    room: (p.get("room") || "").trim(),
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem("fps_settings");
    if (!raw) return;
    const v = JSON.parse(raw);
    if (typeof v.sfx === "boolean") app.settings.sfx = v.sfx;
    if (typeof v.sens === "number") app.settings.sens = Math.max(1, Math.min(20, v.sens));
  } catch (_) {}
}

function saveSettings() {
  try {
    localStorage.setItem("fps_settings", JSON.stringify(app.settings));
  } catch (_) {}
}

function applySettingsToUI() {
  if (sfxToggle) sfxToggle.checked = !!app.settings.sfx;
  if (sensRange) sensRange.value = String(app.settings.sens);
}

function setAvatarTheme(el, seed) {
  const a = hashSeed(seed);
  const b = hashSeed(seed + "_b");
  const c1 = `hsl(${a % 360} 85% 62%)`;
  const c2 = `hsl(${b % 360} 85% 62%)`;
  el.style.background = `linear-gradient(180deg, color-mix(in oklab, ${c1} 30%, rgba(255,255,255,0.08)), color-mix(in oklab, ${c2} 26%, rgba(0,0,0,0.18)))`;
}

function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function copyText(text) {
  const t = String(text);
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch (_) {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.left = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch (_) {
      return false;
    }
  }
}

function connectAndHello(name) {
  // @BE: establish WS and login by sending `hello`
  if (app.ws) {
    try {
      app.ws.close();
    } catch (_) {}
  }

  if (app.net.pingTimer) clearInterval(app.net.pingTimer);
  app.net.pingTimer = null;
  app.net.pingMs = 0;

  setNetStatus("连接中…");
  app.ws = new WebSocket(app.wsUrl); // @BE: connect to backend /ws
  app.ws.onopen = () => {
    setNetStatus("已连接");
    send("hello", { name }); // @BE
    send("rooms_list", {}); // @BE

    app.net.pingTimer = setInterval(() => {
      send("ping", { t: Date.now() }); // @BE: app-level ping/pong RTT
    }, 1000);
  };
  app.ws.onclose = () => {
    setNetStatus("已断开");
    stopGameLoops();
    if (app.net.pingTimer) clearInterval(app.net.pingTimer);
    app.net.pingTimer = null;
    if (app.room) {
      app.room = null;
      showScreen(screenLobby);
    }
  };
  app.ws.onerror = () => {
    setNetStatus("连接错误");
  };
  app.ws.onmessage = (ev) => {
    const msg = safeJSON(ev.data);
    if (!msg) return;
    onMessage(msg); // @BE: dispatch backend messages
  };
}

function safeJSON(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

function onMessage(env) {
  // @BE: receive message from backend, switch by `env.type`
  switch (env.type) {
    case "hello_ack":
      app.userId = env.payload.userId;
      app.name = env.payload.name;
      userPill.textContent = `${app.name} · ${app.userId}`;
      userPill.classList.remove("hidden");
      profileName.textContent = app.name;
      profileId.textContent = `ID: ${app.userId}`;
      setAvatarTheme(profileAvatar, app.userId);
      showScreen(screenLobby);
      if (app.pendingRoomJoin) {
        send("room_join", { roomId: app.pendingRoomJoin }); // @BE
        app.pendingRoomJoin = "";
      }
      break;
    case "rooms":
      app.rooms = env.payload.rooms || [];
      renderRooms();
      break;
    case "room_state":
      app.room = env.payload;
      if (app.room && app.room.started) {
        showScreen(screenGame);
      } else {
        showScreen(screenRoom);
      }
      renderRoom();
      break;
    case "game_start":
      app.map = env.payload.map;
      app.tickMs = env.payload.tickMs || 50;
      app.match.winScore = env.payload.winScore || 10;
      app.match.showEnemiesOnMap = env.payload.showEnemiesOnMap !== false;
      app.match.wallText = String(env.payload.wallText || "");
      app.match.wallDecal = buildWallDecal(app.match.wallText);
      app.match.wallDecalColor = decalColor(app.match.wallText);
      app.match.over = false;
      app.match.overPayload = null;
      if (gameOver) gameOver.classList.add("hidden");
      requestAnimationFrame(() => resizeCanvas());
      app.feed = [];
      app.prevFrameByID = new Map();
      app.fx = {
        lastShotAt: 0,
        fireT: 0,
        hitT: 0,
        dmgT: 0,
        toastT: 0,
        shake: 0,
      };
      startGameLoops();
      showScreen(screenGame);
      break;
    case "game_state":
      app.gameState = env.payload;
      updateFxFromState();
      break;
    case "chat":
      addChatLine(env.payload);
      break;
    case "pong":
      onPong(env.payload);
      break;
    case "game_over":
      onGameOver(env.payload);
      break;
    case "error":
      alert(env.payload.message || "error");
      break;
    default:
      break;
  }
}

function onPong(payload) {
  // @BE: handle pong and compute RTT ping
  const t = payload && payload.t;
  if (!t) return;
  const rtt = Math.max(0, Date.now() - t);
  app.net.pingMs = app.net.pingMs ? Math.round(app.net.pingMs * 0.8 + rtt * 0.2) : rtt;
}

function onGameOver(payload) {
  // @BE: backend sent match result
  app.match.over = true;
  app.match.overPayload = payload || null;
  openGameOver();
}

function renderRooms() {
  roomsList.innerHTML = "";
  if (!app.rooms.length) {
    const div = document.createElement("div");
    div.className = "muted";
    div.textContent = "暂无房间，你可以创建一个。";
    roomsList.appendChild(div);
    return;
  }

  app.rooms
    .slice()
    .sort((a, b) => (a.started === b.started ? b.players - a.players : a.started ? 1 : -1))
    .forEach((r) => {
      const item = document.createElement("div");
      item.className = "roomItem";
      const left = document.createElement("div");
      left.innerHTML = `<div>${escapeHTML(r.name)} ${r.started ? "（进行中）" : ""}</div>
        <div class="meta">ID: ${escapeHTML(r.id)} ｜人数: ${r.players}</div>`;
      const btn = document.createElement("button");
      btn.className = "btn primary";
      btn.textContent = r.started ? "不可加入" : "加入";
      btn.disabled = !!r.started;
      btn.onclick = () => send("room_join", { roomId: r.id }); // @BE
      item.appendChild(left);
      item.appendChild(btn);
      roomsList.appendChild(item);
    });
}

function renderRoom() {
  if (!app.room) return;
  roomTitle.textContent = `房间：${app.room.name}`;
  roomMeta.textContent = `房间ID: ${app.room.id} ｜ 房主: ${app.room.hostId === app.userId ? "你" : app.room.hostId}`;
  playersList.innerHTML = "";

  const players = app.room.players || [];
  const readyN = players.filter((p) => p.ready).length;
  readyCount.textContent = `准备：${readyN}/${players.length}`;
  players.forEach((p) => {
    const row = document.createElement("div");
    row.className = "playerRow";
    const left = document.createElement("div");
    left.className = "left";
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    const name = document.createElement("div");
    name.textContent = p.name + (p.id === app.userId ? "（你）" : "");
    left.appendChild(avatar);
    left.appendChild(name);

    const badge = document.createElement("div");
    badge.className = "badge " + (p.ready ? "ready" : "");
    badge.textContent = p.ready ? "已准备" : "未准备";

    row.appendChild(left);
    row.appendChild(badge);
    playersList.appendChild(row);
  });

  const me = players.find((p) => p.id === app.userId);
  const ready = !!(me && me.ready);
  readyBtn.textContent = ready ? "取消准备" : "准备";
  startBtn.disabled = app.room.hostId !== app.userId;

  const isHost = app.room.hostId === app.userId;

  const ws = clampInt(Number(app.room.winScore || 10), 1, 50);
  const showEnemies = app.room.showEnemiesOnMap !== false;
  const wallText = String(app.room.wallText || "");

  // keep local draft in sync when not actively editing
  if (!app.roomDraft.dirty) {
    app.roomDraft.winScore = ws;
    app.roomDraft.showEnemiesOnMap = showEnemies;
    app.roomDraft.wallText = wallText;
  }

  const active = document.activeElement;
  const editing =
    active === winScoreInput || active === wallTextInput || active === showEnemiesOnMapToggle;

  if (winScoreInput) {
    if (!editing || !isHost) winScoreInput.value = String(app.roomDraft.winScore);
    winScoreInput.disabled = !isHost;
  }
  if (showEnemiesOnMapToggle) {
    if (!editing || !isHost) showEnemiesOnMapToggle.checked = !!app.roomDraft.showEnemiesOnMap;
    showEnemiesOnMapToggle.disabled = !isHost;
  }
  if (wallTextInput) {
    if (!editing || !isHost) wallTextInput.value = app.roomDraft.wallText;
    wallTextInput.disabled = !isHost;
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

loginBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) {
    alert("请输入名字");
    return;
  }
  connectAndHello(name);
};

createRoomBtn.onclick = () => {
  send("room_create", { name: roomNameInput.value.trim() }); // @BE
};

refreshRoomsBtn.onclick = () => {
  send("rooms_list", {}); // @BE
};

copyMeBtn.onclick = async () => {
  if (!app.userId) return;
  const ok = await copyText(`name=${app.name}\nuserId=${app.userId}`);
  if (!ok) alert("复制失败，请手动复制");
};

joinRoomBtn.onclick = () => {
  const id = (joinRoomIdInput.value || "").trim();
  if (!id) return;
  send("room_join", { roomId: id }); // @BE
};

leaveRoomBtn.onclick = () => {
  leaveToLobby();
};

copyRoomIdBtn.onclick = async () => {
  if (!app.room) return;
  const ok = await copyText(app.room.id);
  if (!ok) alert("复制失败，请手动复制");
};

copyInviteBtn.onclick = async () => {
  if (!app.room) return;
  const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(app.room.id)}`;
  const ok = await copyText(url);
  if (!ok) alert("复制失败，请手动复制");
};

readyBtn.onclick = () => {
  if (!app.room) return;
  const me = (app.room.players || []).find((p) => p.id === app.userId);
  send("room_ready", { ready: !(me && me.ready) }); // @BE
};

function leaveToLobby() {
  stopGameLoops();
  closeMenu();
  send("room_leave", {}); // @BE
  app.room = null;
  app.map = null;
  app.gameState = null;
  app.chat = [];
  app.feed = [];
  app.particles = [];
  showScreen(screenLobby);
  send("rooms_list", {}); // @BE
}

startBtn.onclick = () => {
  const isHost = app.room && app.room.hostId === app.userId;
  if (!isHost) return;
  const winScore = clampInt(Number(winScoreInput ? winScoreInput.value : 10), 1, 50);
  const showEnemiesOnMap = !!(showEnemiesOnMapToggle ? showEnemiesOnMapToggle.checked : true);
  const wallText = (wallTextInput ? wallTextInput.value : "").trim();
  send("room_start", { winScore, showEnemiesOnMap, wallText }); // @BE
};

function scheduleRoomConfigUpdate() {
  const isHost = app.room && app.room.hostId === app.userId;
  if (!isHost) return;
  app.roomDraft.dirty = true;
  if (app.roomDraft.timer) clearTimeout(app.roomDraft.timer);
  app.roomDraft.timer = setTimeout(() => {
    app.roomDraft.timer = null;
    const payload = {
      winScore: clampInt(app.roomDraft.winScore, 1, 50),
      showEnemiesOnMap: !!app.roomDraft.showEnemiesOnMap,
      wallText: String(app.roomDraft.wallText || "").trim(),
    };
    send("room_config", payload); // @BE
    app.roomDraft.dirty = false;
  }, 250);
}

if (winScoreInput) {
  winScoreInput.addEventListener("input", () => {
    app.roomDraft.winScore = clampInt(Number(winScoreInput.value || 10), 1, 50);
    scheduleRoomConfigUpdate();
  });
}
if (showEnemiesOnMapToggle) {
  showEnemiesOnMapToggle.addEventListener("change", () => {
    app.roomDraft.showEnemiesOnMap = !!showEnemiesOnMapToggle.checked;
    scheduleRoomConfigUpdate();
  });
}
if (wallTextInput) {
  wallTextInput.addEventListener("input", () => {
    app.roomDraft.wallText = String(wallTextInput.value || "").slice(0, 24);
    scheduleRoomConfigUpdate();
  });
}

// ---- Game rendering (pixel raycaster) ----

const buf = document.createElement("canvas");
const bufCtx = buf.getContext("2d");
buf.width = 640;
buf.height = 360;
bufCtx.imageSmoothingEnabled = true;

let zBuffer = new Float32Array(buf.width);

const wallTexA = makeWallTexture("concrete");
const wallTexB = makeWallTexture("brick");

function makeWallTexture(kind) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  if (kind === "concrete") {
    ctx.fillStyle = "#8c93a3";
    ctx.fillRect(0, 0, c.width, c.height);
    // speckle + subtle stains
    for (let i = 0; i < 5000; i++) {
      const x = (Math.random() * c.width) | 0;
      const y = (Math.random() * c.height) | 0;
      const a = 0.03 + Math.random() * 0.08;
      const v = 120 + (Math.random() * 80) | 0;
      ctx.fillStyle = `rgba(${v},${v},${v + 10},${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 0.10;
    for (let i = 0; i < 24; i++) {
      const x = Math.random() * c.width;
      const y = Math.random() * c.height;
      const r = 20 + Math.random() * 80;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(40,50,70,0.55)");
      g.addColorStop(1, "rgba(40,50,70,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // panel seams
    ctx.strokeStyle = "rgba(0,0,0,0.20)";
    ctx.lineWidth = 2;
    for (let x = 0; x < c.width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, c.height);
      ctx.stroke();
    }
    for (let y = 0; y < c.height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(c.width, y + 0.5);
      ctx.stroke();
    }
    return c;
  }

  // brick
  ctx.fillStyle = "#7f5b52";
  ctx.fillRect(0, 0, c.width, c.height);
  const mortar = "rgba(30,25,22,0.55)";
  const brickA = "#8a5f54";
  const brickB = "#7a534a";
  const bw = 44;
  const bh = 22;
  for (let y = 0; y < c.height + bh; y += bh) {
    const off = ((y / bh) | 0) % 2 ? bw / 2 : 0;
    for (let x = -bw; x < c.width + bw; x += bw) {
      ctx.fillStyle = ((x / bw) | 0) % 2 ? brickA : brickB;
      ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
      ctx.strokeStyle = mortar;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + off + 1, y + 1, bw - 2, bh - 2);
    }
  }
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 800; i++) {
    const x = (Math.random() * c.width) | 0;
    const y = (Math.random() * c.height) | 0;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
  return c;
}

const noise = document.createElement("canvas");
noise.width = 64;
noise.height = 64;
const noiseCtx = noise.getContext("2d");
noiseCtx.imageSmoothingEnabled = false;
seedNoise();

function buildWallDecal(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  const c = document.createElement("canvas");
  c.width = 280;
  c.height = 88;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, c.width, c.height);

  // banner background (soft paint + border)
  const pad = 10;
  const bw = c.width - pad * 2;
  const bh = c.height - pad * 2;
  const x0 = pad;
  const y0 = pad;

  const bg = ctx.createLinearGradient(x0, y0, x0 + bw, y0 + bh);
  bg.addColorStop(0, "rgba(255,255,255,0.10)");
  bg.addColorStop(1, "rgba(255,255,255,0.03)");
  ctx.fillStyle = bg;
  roundRect(ctx, x0, y0, bw, bh, 14);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  roundRect(ctx, x0 + 1, y0 + 1, bw - 2, bh - 2, 13);
  ctx.stroke();

  // subtle diagonal texture
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  roundRect(ctx, x0, y0, bw, bh, 14);
  ctx.clip();
  for (let i = -c.height; i < c.width + c.height; i += 10) {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(i, y0, 2, bh);
  }
  ctx.restore();

  // text (centered, big)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 26px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  const cx = Math.floor(c.width / 2);
  const cy = Math.floor(c.height / 2);

  // glow + stroke + fill
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillText(t, cx + 2, cy + 3);
  ctx.restore();

  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.strokeText(t, cx, cy);

  const fill = ctx.createLinearGradient(cx - 120, cy - 20, cx + 120, cy + 20);
  fill.addColorStop(0, "rgba(255,245,180,0.98)");
  fill.addColorStop(0.5, "rgba(125,255,179,0.98)");
  fill.addColorStop(1, "rgba(124,92,255,0.98)");
  ctx.fillStyle = fill;
  ctx.fillText(t, cx, cy);

  const img = ctx.getImageData(0, 0, c.width, c.height);
  // punch alpha a bit so it reads as a wall sign at distance
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3] / 255;
    img.data[i + 3] = Math.round(255 * Math.min(1, a * 1.2));
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function decalColor(text) {
  const h = hashSeed(String(text || "")) % 360;
  // pick a vivid "event" color
  const rgb = hslToRgb(h / 360, 0.85, 0.58);
  return { r: rgb[0], g: rgb[1], b: rgb[2] };
}

function hslToRgb(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function seedNoise() {
  const img = noiseCtx.createImageData(noise.width, noise.height);
  let seed = 1337;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const v = 30 + (seed % 180);
    img.data[i + 0] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  noiseCtx.putImageData(img, 0, 0);
}

function resizeCanvas() {
  const rect = gameCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  gameCanvas.width = Math.floor(rect.width * dpr);
  gameCanvas.height = Math.floor(rect.height * dpr);
  const ctx = gameCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function startGameLoops() {
  stopGameLoops();
  resizeCanvas();

  app.sendTimer = setInterval(() => {
    const turn = app.input.turnAccum;
    app.input.turnAccum = 0;
    const shoot = app.input.shootEdge;
    app.input.shootEdge = false;
    if (shoot) {
      app.fx.lastShotAt = performance.now();
      app.fx.fireT = 1.0;
      app.fx.shake = Math.max(app.fx.shake, 0.55);
      spawnParticles("shot");
      playSfx("shot");
    }
    send("input", { // @BE: per-tick input upload
      forward: app.input.forward,
      back: app.input.back,
      left: app.input.left,
      right: app.input.right,
      turn,
      shoot,
    });
  }, app.tickMs);

  app.raf = requestAnimationFrame(renderFrame);
}

function stopGameLoops() {
  if (app.sendTimer) clearInterval(app.sendTimer);
  app.sendTimer = null;
  if (app.raf) cancelAnimationFrame(app.raf);
  app.raf = 0;
}

function renderFrame() {
  app.raf = requestAnimationFrame(renderFrame);
  const ctx = gameCanvas.getContext("2d");
  if (!app.map || !app.gameState) {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    return;
  }

  const me = (app.gameState.players || []).find((p) => p.id === app.userId);
  if (!me) return;

  hudName.textContent = `玩家：${me.name}`;
  hudHP.textContent = `HP：${me.hp}`;
  hudScore.textContent = `击杀：${me.score}`;
  if (hudPing) hudPing.textContent = app.net.pingMs ? `Ping：${app.net.pingMs}ms` : "Ping：-";
  renderScoreboards(me);
  renderTopHud(me);
  renderKillFeed();
  renderFxDom();

  tickParticles();
  drawScene(me);

  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  const shakePx = Math.max(0, app.fx.shake) * (window.devicePixelRatio || 1) * 6;
  const ox = (Math.random() * 2 - 1) * shakePx;
  const oy = (Math.random() * 2 - 1) * shakePx;
  if (shakePx > 0.01) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.drawImage(buf, 0, 0, gameCanvas.width, gameCanvas.height);
    ctx.restore();
  } else {
    ctx.drawImage(buf, 0, 0, gameCanvas.width, gameCanvas.height);
  }

  app.fx.shake *= 0.90;
  app.fx.fireT *= 0.82;
  app.fx.hitT *= 0.84;
  app.fx.dmgT *= 0.90;
  app.fx.toastT *= 0.92;
}

function drawScene(me) {
  const w = buf.width;
  const h = buf.height;
  const map = app.map.rows;

  // ceiling / floor
  const sky = bufCtx.createLinearGradient(0, 0, 0, h / 2);
  sky.addColorStop(0, "#2a335f");
  sky.addColorStop(1, "#0b1020");
  bufCtx.fillStyle = sky;
  bufCtx.fillRect(0, 0, w, h / 2);
  const floor = bufCtx.createLinearGradient(0, h / 2, 0, h);
  floor.addColorStop(0, "#0a0e1e");
  floor.addColorStop(1, "#03040a");
  bufCtx.fillStyle = floor;
  bufCtx.fillRect(0, h / 2, w, h / 2);

  // grain / haze
  bufCtx.save();
  bufCtx.globalAlpha = 0.08;
  bufCtx.drawImage(noise, 0, 0, w, h);
  bufCtx.globalAlpha = 0.18;
  bufCtx.fillStyle = "rgba(0,0,0,0.16)";
  bufCtx.fillRect(0, Math.floor(h * 0.58), w, Math.floor(h * 0.42));
  bufCtx.restore();

  drawFloorTexture();

  const fov = Math.PI / 3;
  for (let x = 0; x < w; x++) {
    const cameraX = (2 * x) / w - 1;
    const angle = me.dir + cameraX * (fov / 2);
    const rayDirX = Math.cos(angle);
    const rayDirY = Math.sin(angle);

    let mapX = Math.floor(me.x);
    let mapY = Math.floor(me.y);

    const deltaDistX = Math.abs(1 / (rayDirX || 1e-9));
    const deltaDistY = Math.abs(1 / (rayDirY || 1e-9));
    let sideDistX;
    let sideDistY;

    let stepX;
    let stepY;

    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (me.x - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1.0 - me.x) * deltaDistX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (me.y - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1.0 - me.y) * deltaDistY;
    }

    let hit = 0;
    let side = 0;
    let hitStepX = 0;
    let hitStepY = 0;
    for (let i = 0; i < 64; i++) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      if (isWall(map, mapX, mapY)) {
        hit = 1;
        hitStepX = stepX;
        hitStepY = stepY;
        break;
      }
    }
    if (!hit) {
      zBuffer[x] = 1e9;
      continue;
    }

    let perpWallDist;
    if (side === 0) {
      perpWallDist = (mapX - me.x + (1 - stepX) / 2) / (rayDirX || 1e-9);
    } else {
      perpWallDist = (mapY - me.y + (1 - stepY) / 2) / (rayDirY || 1e-9);
    }
    perpWallDist = Math.max(0.0001, Math.abs(perpWallDist));
    zBuffer[x] = perpWallDist;

    const lineHeight = Math.floor(h / perpWallDist);
    let drawStart = Math.floor(-lineHeight / 2 + h / 2);
    let drawEnd = Math.floor(lineHeight / 2 + h / 2);
    drawStart = Math.max(0, drawStart);
    drawEnd = Math.min(h - 1, drawEnd);

    const shade = side === 1 ? 0.72 : 1.0;
    const cellVar = (Math.abs(mapX + mapY) % 2) * 14;
    const distBoost = Math.min(90, 170 / perpWallDist);
    const c = Math.floor((112 + cellVar) * shade + distBoost);

    let wallX;
    if (side === 0) {
      wallX = me.y + perpWallDist * rayDirY;
    } else {
      wallX = me.x + perpWallDist * rayDirX;
    }
    wallX -= Math.floor(wallX);

    const tex = ((mapX + mapY) & 1) === 0 ? wallTexA : wallTexB;
    const texX = clampInt(Math.floor(wallX * tex.width), 0, tex.width - 1);
    bufCtx.drawImage(tex, texX, 0, 1, tex.height, x, drawStart, 1, drawEnd - drawStart + 1);

    // overlay banner only on fixed big wall segment
    const decal = app.match.wallDecal;
    if (decal && side === 1 && hitStepY === -1 && mapY === 0 && mapX >= 3 && mapX <= 12) {
      const segLen = 10;
      const u = ((mapX - 3) + wallX) / segLen;
      const dx = clampInt(Math.floor(u * decal.width), 0, decal.width - 1);
      const wallH = drawEnd - drawStart + 1;
      const dstTop = Math.floor(drawStart + wallH * 0.32);
      const dstH = Math.max(1, Math.floor(wallH * 0.36));
      bufCtx.save();
      bufCtx.globalAlpha = 0.92;
      bufCtx.drawImage(decal, dx, 0, 1, decal.height, x, dstTop, 1, dstH);
      bufCtx.restore();
    }

    // lighting + fog
    const sideDark = side === 1 ? 0.20 : 0.08;
    const fog = Math.min(0.65, Math.max(0, (perpWallDist - 2) / 12) * 0.65);
    bufCtx.fillStyle = `rgba(0,0,0,${sideDark + fog})`;
    bufCtx.fillRect(x, drawStart, 1, drawEnd - drawStart + 1);
    const tint = Math.min(0.18, perpWallDist / 26);
    if (tint > 0.01) {
      bufCtx.fillStyle = `rgba(10,16,32,${tint})`;
      bufCtx.fillRect(x, drawStart, 1, drawEnd - drawStart + 1);
    }
  }

  drawSprites(me);
  drawMiniMap(me);
  drawWeapon();
  drawMuzzleFlash();
  drawHitmarker();
  drawParticles();
}

function drawFloorTexture() {
  const w = buf.width;
  const h = buf.height;
  const horizon = Math.floor(h / 2);
  bufCtx.save();
  // subtle "material" noise
  bufCtx.globalAlpha = 0.14;
  bufCtx.drawImage(noise, 0, horizon, w, h - horizon);
  // light falloff
  const g = bufCtx.createRadialGradient(w * 0.5, h * 0.75, 20, w * 0.5, h * 0.85, h * 0.75);
  g.addColorStop(0, "rgba(255,255,255,0.06)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  bufCtx.globalAlpha = 1;
  bufCtx.fillStyle = g;
  bufCtx.fillRect(0, horizon, w, h - horizon);
  bufCtx.restore();
}

function drawSprites(me) {
  const w = buf.width;
  const h = buf.height;
  const fov = Math.PI / 3;

  const others = (app.gameState.players || []).filter((p) => p.id !== me.id);
  others.sort((a, b) => dist2(b, me) - dist2(a, me));

  for (const p of others) {
    const dx = p.x - me.x;
    const dy = p.y - me.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.2) continue;
    const angTo = Math.atan2(dy, dx);
    let diff = normalizeAngle(angTo - me.dir);
    if (Math.abs(diff) > fov / 2) continue;

    const spriteX = Math.floor(((diff + fov / 2) / fov) * w);
    const spriteH = Math.floor(h / dist);
    const spriteW = Math.floor(spriteH * 0.6);
    const top = Math.floor(h / 2 - spriteH / 2);

    const left = spriteX - Math.floor(spriteW / 2);
    let anyVisible = false;
    let minVisibleX = 1e9;
    let maxVisibleX = -1e9;
    for (let x = 0; x < spriteW; x++) {
      const sx = left + x;
      if (sx < 0 || sx >= w) continue;
      if (dist > zBuffer[sx]) continue;
      drawPixelDudeSilhouette(sx, top, spriteH, dist, p.hp, x, spriteW);
      anyVisible = true;
      minVisibleX = Math.min(minVisibleX, sx);
      maxVisibleX = Math.max(maxVisibleX, sx);
    }

    if (anyVisible) {
      drawEnemyTag(p, minVisibleX, maxVisibleX, top, spriteH, dist);
    }
  }
}

function drawEnemyTag(p, minX, maxX, top, spriteH, dist) {
  const w = buf.width;
  const spriteW = Math.max(1, maxX - minX + 1);
  if (spriteW < 6 || spriteH < 10) return;
  const cx = (minX + maxX) / 2;
  const nameY = Math.floor(top - 6);
  const barY = Math.floor(top - 4);
  if (barY < 0) return;

  const bw = clampInt(spriteW + 10, 16, 46);
  const x0 = clampInt(cx - bw / 2, 1, w - bw - 1);
  const hp = clampInt(p.hp, 0, 100);
  const fill = Math.floor((bw - 2) * (hp / 100));

  bufCtx.save();
  const a = Math.max(0.28, Math.min(0.92, 1.15 - dist / 9));
  bufCtx.globalAlpha = a;
  // name
  bufCtx.font = "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  bufCtx.textAlign = "center";
  bufCtx.textBaseline = "bottom";
  const label = p.name || "enemy";
  const ny = Math.max(8, nameY);
  bufCtx.fillStyle = "rgba(0,0,0,0.55)";
  bufCtx.fillText(label, Math.floor(cx) + 1, ny + 1);
  bufCtx.fillStyle = "rgba(231,236,255,0.95)";
  bufCtx.fillText(label, Math.floor(cx), ny);

  // hp bar
  bufCtx.fillStyle = "rgba(0,0,0,0.55)";
  bufCtx.fillRect(x0, barY, bw, 3);
  bufCtx.fillStyle = "rgba(255,255,255,0.10)";
  bufCtx.fillRect(x0 + 1, barY + 1, bw - 2, 1);
  bufCtx.fillStyle = hp > 60 ? "rgba(125,255,179,0.95)" : hp > 30 ? "rgba(255,245,180,0.95)" : "rgba(255,77,109,0.95)";
  bufCtx.fillRect(x0 + 1, barY + 1, fill, 1);
  bufCtx.restore();
}

function drawPixelDudeColumn(x, top, h, dist, hp) {
  // legacy path kept for compatibility (calls are upgraded to silhouette version)
  drawPixelDudeSilhouette(x, top, h, dist, hp, 0, 1);
}

function drawPixelDudeSilhouette(screenX, top, h, dist, hp, colIndex, colCount) {
  const shade = Math.max(0.22, 1.18 - dist / 7.8);
  const bodyR = clamp8(Math.floor(225 * shade));
  const bodyG = clamp8(Math.floor(120 * shade));
  const bodyB = clamp8(Math.floor(165 * shade));
  const headR = clamp8(Math.floor(250 * shade));
  const headG = clamp8(Math.floor(210 * shade));
  const headB = clamp8(Math.floor(190 * shade));
  const hatR = clamp8(Math.floor(60 * shade));
  const hatG = clamp8(Math.floor(230 * shade));
  const hatB = clamp8(Math.floor(120 * shade));
  const hatDarkR = clamp8(hatR - 25);
  const hatDarkG = clamp8(hatG - 45);
  const hatDarkB = clamp8(hatB - 35);
  const gunR = clamp8(Math.floor(210 * shade));
  const gunG = clamp8(Math.floor(220 * shade));
  const gunB = clamp8(Math.floor(245 * shade));
  const gunDarkR = clamp8(gunR - 55);
  const gunDarkG = clamp8(gunG - 70);
  const gunDarkB = clamp8(gunB - 80);
  const outline = "rgba(0,0,0,0.38)";

  const u = (colIndex + 0.5) / Math.max(1, colCount); // 0..1 in sprite
  const y0 = Math.floor(top);
  const y1 = Math.floor(top + h);

  for (let y = y0; y < y1; y++) {
    const v = (y - y0) / Math.max(1, y1 - y0); // 0..1
    let inShape = false;
    let r = bodyR,
      g = bodyG,
      b = bodyB;

    if (v < 0.22) {
      // head
      inShape = Math.abs(u - 0.5) < 0.20;
      r = headR;
      g = headG;
      b = headB;

      // green hat (top + brim)
      const hatTop = v < 0.075 && Math.abs(u - 0.5) < 0.24;
      const hatBrim = v >= 0.075 && v < 0.105 && Math.abs(u - 0.5) < 0.30;
      if (hatTop || hatBrim) {
        inShape = true;
        r = hatTop ? hatR : hatDarkR;
        g = hatTop ? hatG : hatDarkG;
        b = hatTop ? hatB : hatDarkB;
      }

      // simple eyes band
      if (inShape && v > 0.10 && v < 0.15 && (Math.abs(u - 0.42) < 0.03 || Math.abs(u - 0.58) < 0.03)) {
        r = 12;
        g = 14;
        b = 18;
      }
    } else if (v < 0.70) {
      // torso + arms
      const torso = Math.abs(u - 0.5) < 0.22;
      const arms = v > 0.34 && v < 0.56 && Math.abs(u - 0.5) < 0.30;
      inShape = torso || arms;
      if (arms && !torso) {
        r = clamp8(bodyR + 10);
        g = clamp8(bodyG + 10);
        b = clamp8(bodyB + 10);
      }

      // exaggerated long rifle (very big)
      const gunBody = v > 0.36 && v < 0.60 && u > 0.38 && u < 0.99;
      const gunBarrel = v > 0.33 && v < 0.36 && u > 0.42 && u < 0.995;
      const gunStock = v > 0.40 && v < 0.58 && u > 0.28 && u <= 0.38;
      const gunScope = v > 0.30 && v < 0.33 && u > 0.55 && u < 0.72;
      const gunGrip = v > 0.56 && v < 0.72 && u > 0.46 && u < 0.55;
      const gunMuzzle = v > 0.40 && v < 0.52 && u > 0.985 && u < 0.999;
      const gun = gunBody || gunBarrel || gunStock || gunScope || gunGrip || gunMuzzle;
      if (gun) {
        inShape = true;
        const hi = gunBarrel || gunScope || (gunBody && ((Math.floor(v * 120) + Math.floor(u * 80)) % 9 === 0));
        r = hi ? gunR : gunDarkR;
        g = hi ? gunG : gunDarkG;
        b = hi ? gunB : gunDarkB;
        if (gunMuzzle) {
          r = clamp8(gunR + 10);
          g = clamp8(gunG + 10);
          b = clamp8(gunB + 10);
        }
      }
    } else {
      // legs (two columns)
      const l1 = Math.abs(u - 0.42) < 0.08;
      const l2 = Math.abs(u - 0.58) < 0.08;
      inShape = l1 || l2;
      r = clamp8(bodyR - 28);
      g = clamp8(bodyG - 20);
      b = clamp8(bodyB - 18);
    }

    if (!inShape) continue;

    // edge outline
    const gunEdge =
      v >= 0.22 &&
      v < 0.70 &&
      ((v > 0.36 && v < 0.60 && (Math.abs(u - 0.38) < 0.018 || Math.abs(u - 0.99) < 0.018)) ||
        (v > 0.33 && v < 0.36 && (Math.abs(u - 0.42) < 0.018 || Math.abs(u - 0.995) < 0.018)) ||
        (v > 0.40 && v < 0.58 && (Math.abs(u - 0.28) < 0.018 || Math.abs(u - 0.38) < 0.018)) ||
        (v > 0.56 && v < 0.72 && (Math.abs(u - 0.46) < 0.018 || Math.abs(u - 0.55) < 0.018)));
    const edge =
      (v < 0.22 && Math.abs(Math.abs(u-0.5)-0.20) < 0.018) ||
      (v >= 0.22 && v < 0.70 && Math.abs(Math.abs(u-0.5)-0.30) < 0.016) ||
      (v >= 0.70 && (Math.abs(Math.abs(u-0.42)-0.08) < 0.016 || Math.abs(Math.abs(u-0.58)-0.08) < 0.016)) ||
      gunEdge;
    if (edge) {
      bufCtx.fillStyle = outline;
    } else {
      bufCtx.fillStyle = `rgb(${r},${g},${b})`;
    }
    bufCtx.fillRect(screenX, y, 1, 1);
  }

  if (hp < 40) {
    bufCtx.fillStyle = "rgba(255,77,109,0.95)";
    bufCtx.fillRect(screenX, y0 - 2, 1, 2);
  }
}

function drawMiniMap(me) {
  const map = app.map.rows;
  const scale = 4;
  const pad = 6;
  const mw = map[0].length * scale;
  const mh = map.length * scale;
  const x0 = pad;
  const y0 = pad;

  bufCtx.fillStyle = "rgba(0,0,0,0.35)";
  bufCtx.fillRect(x0 - 2, y0 - 2, mw + 4, mh + 4);

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      bufCtx.fillStyle = map[y][x] === "#" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0)";
      if (map[y][x] === "#") bufCtx.fillRect(x0 + x * scale, y0 + y * scale, scale, scale);
    }
  }

  for (const p of app.gameState.players || []) {
    if (!app.match.showEnemiesOnMap && p.id !== me.id) continue;
    const px = x0 + p.x * scale;
    const py = y0 + p.y * scale;
    bufCtx.fillStyle = p.id === me.id ? "#7dffb3" : "#ff4d6d";
    bufCtx.fillRect(px - 1, py - 1, 3, 3);
  }

  const lx = x0 + me.x * scale + Math.cos(me.dir) * 4;
  const ly = y0 + me.y * scale + Math.sin(me.dir) * 4;
  bufCtx.strokeStyle = "rgba(125,255,179,0.8)";
  bufCtx.beginPath();
  bufCtx.moveTo(x0 + me.x * scale, y0 + me.y * scale);
  bufCtx.lineTo(lx, ly);
  bufCtx.stroke();
}

function drawWeapon() {
  const w = buf.width;
  const h = buf.height;
  const t = (app.gameState && app.gameState.tick) || 0;
  const bob = Math.sin(t * 0.12) * 1.5;
  const baseY = h - 24 + bob;
  const baseX = Math.floor(w / 2);

  // shadow
  bufCtx.fillStyle = "rgba(0,0,0,0.35)";
  bufCtx.fillRect(baseX - 26, baseY + 6, 52, 16);

  // gun body
  bufCtx.fillStyle = "rgba(255,255,255,0.10)";
  bufCtx.fillRect(baseX - 24, baseY, 48, 14);
  bufCtx.fillStyle = "rgba(255,255,255,0.16)";
  bufCtx.fillRect(baseX - 24, baseY, 48, 3);
  bufCtx.fillStyle = "rgba(124,92,255,0.22)";
  bufCtx.fillRect(baseX + 6, baseY + 3, 16, 6);

  // barrel
  bufCtx.fillStyle = "rgba(255,255,255,0.14)";
  bufCtx.fillRect(baseX + 18, baseY + 5, 16, 4);
  bufCtx.fillStyle = "rgba(0,0,0,0.35)";
  bufCtx.fillRect(baseX + 32, baseY + 5, 2, 4);
}

function drawMuzzleFlash() {
  if (app.fx.fireT <= 0.02) return;
  const w = buf.width;
  const h = buf.height;
  const a = Math.min(0.85, app.fx.fireT);
  const x = Math.floor(w / 2);
  const y = Math.floor(h / 2) + 2;
  bufCtx.save();
  bufCtx.globalAlpha = a;
  bufCtx.fillStyle = "rgba(255,245,180,0.92)";
  bufCtx.fillRect(x - 2, y - 2, 4, 4);
  bufCtx.fillStyle = "rgba(255,245,180,0.35)";
  bufCtx.fillRect(x - 7, y - 1, 14, 2);
  bufCtx.fillRect(x - 1, y - 7, 2, 14);
  bufCtx.restore();
}

function drawHitmarker() {
  if (app.fx.hitT <= 0.03) return;
  const w = buf.width;
  const h = buf.height;
  const x = Math.floor(w / 2);
  const y = Math.floor(h / 2);
  const t = Math.min(1, app.fx.hitT);
  const s = 4 + Math.floor((1 - t) * 2);
  bufCtx.save();
  bufCtx.globalAlpha = Math.min(0.9, 0.35 + t * 0.6);
  bufCtx.fillStyle = "rgba(125,255,179,0.95)";
  // four ticks
  bufCtx.fillRect(x - s - 2, y - s - 2, 2, 2);
  bufCtx.fillRect(x + s, y - s - 2, 2, 2);
  bufCtx.fillRect(x - s - 2, y + s, 2, 2);
  bufCtx.fillRect(x + s, y + s, 2, 2);
  bufCtx.restore();
}

function tickParticles() {
  const dt = 1;
  for (const p of app.particles) {
    p.life -= dt;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.92;
    p.vy *= 0.92;
  }
  app.particles = app.particles.filter((p) => p.life > 0);
}

function spawnParticles(kind) {
  const w = buf.width;
  const h = buf.height;
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const n = kind === "hit" ? 14 : 8;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (kind === "hit" ? 1.6 : 1.1) + Math.random() * 1.2;
    const col = kind === "hit" ? "rgba(125,255,179,0.9)" : "rgba(255,245,180,0.8)";
    app.particles.push({
      x: cx + (Math.random() * 2 - 1) * 2,
      y: cy + (Math.random() * 2 - 1) * 2,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 14 + Math.floor(Math.random() * 10),
      c: col,
    });
  }
}

function drawParticles() {
  if (!app.particles.length) return;
  bufCtx.save();
  for (const p of app.particles) {
    bufCtx.fillStyle = p.c;
    bufCtx.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
  }
  bufCtx.restore();
}

function renderScoreboards(me) {
  const players = (app.gameState && app.gameState.players) || [];
  const sorted = players.slice().sort((a, b) => b.score - a.score || b.hp - a.hp);

  // mini board (top 4)
  hudBoardMini.innerHTML = "";
  sorted.slice(0, 4).forEach((p) => {
    const line = document.createElement("div");
    line.textContent = `${p.id === me.id ? "你" : p.name} · ${p.score}`;
    line.style.opacity = p.id === me.id ? "1" : "0.85";
    hudBoardMini.appendChild(line);
  });

  // full board (Tab)
  if (!app.showBoard) {
    hudBoard.classList.add("hidden");
    return;
  }
  hudBoard.classList.remove("hidden");
  hudBoard.innerHTML = "";
  const title = document.createElement("h3");
  title.textContent = "计分板（Tab）";
  hudBoard.appendChild(title);
  sorted.forEach((p) => {
    const row = document.createElement("div");
    row.className = "boardRow" + (p.id === me.id ? " me" : "");
    const name = document.createElement("div");
    name.textContent = p.id === me.id ? `${p.name}（你）` : p.name;
    const score = document.createElement("div");
    score.className = "muted";
    score.textContent = `K ${p.score}`;
    const hpWrap = document.createElement("div");
    const hpBar = document.createElement("div");
    hpBar.className = "hpBar";
    const hpFill = document.createElement("div");
    hpFill.className = "hpFill";
    hpFill.style.width = `${Math.max(0, Math.min(100, p.hp))}%`;
    hpBar.appendChild(hpFill);
    hpWrap.appendChild(hpBar);
    row.appendChild(name);
    row.appendChild(score);
    row.appendChild(hpWrap);
    hudBoard.appendChild(row);
  });
}

function renderTopHud(me) {
  const roomName = app.room ? app.room.name : "对局";
  const players = (app.gameState && app.gameState.players) || [];
  hudRoom.textContent = `房间：${roomName} · ${players.length}人 · 目标：${app.match.winScore}击杀 · Tick ${app.gameState.tick}`;
  hudCompass.textContent = `朝向：${compassName(me.dir)} (${Math.round((me.dir * 180) / Math.PI)}°)`;
}

function compassName(dir) {
  const deg = ((dir * 180) / Math.PI + 360) % 360;
  if (deg >= 337.5 || deg < 22.5) return "东";
  if (deg < 67.5) return "东北";
  if (deg < 112.5) return "北";
  if (deg < 157.5) return "西北";
  if (deg < 202.5) return "西";
  if (deg < 247.5) return "西南";
  if (deg < 292.5) return "南";
  return "东南";
}

function renderFxDom() {
  if (crosshairEl) {
    crosshairEl.classList.toggle("fire", app.fx.fireT > 0.15);
    crosshairEl.classList.toggle("hit", app.fx.hitT > 0.15);
  }
  if (damageVignette) {
    damageVignette.style.opacity = String(Math.min(0.85, app.fx.dmgT));
  }
  if (toast) {
    if (app.fx.toastT > 0.05) {
      toast.classList.remove("hidden");
      toast.style.opacity = String(Math.min(1, app.fx.toastT));
    } else {
      toast.classList.add("hidden");
    }
  }
}

function toastMsg(text) {
  if (!toast) return;
  toast.textContent = text;
  app.fx.toastT = 1.0;
}

function renderKillFeed() {
  if (!killFeed) return;
  const now = performance.now();
  app.feed = app.feed.filter((e) => now - e.t < 3600);
  killFeed.innerHTML = "";
  app.feed.slice(0, 4).forEach((e) => {
    const div = document.createElement("div");
    div.className = "killLine";
    const who = document.createElement("span");
    who.textContent = e.who;
    const muted = document.createElement("span");
    muted.className = "muted";
    muted.textContent = ` +${e.delta} 击杀`;
    div.appendChild(who);
    div.appendChild(muted);
    killFeed.appendChild(div);
  });
}

function pushFeed(who, delta) {
  app.feed.unshift({ t: performance.now(), who, delta });
}

function addChatLine(payload) {
  if (!payload) return;
  const line = {
    userId: payload.userId || "",
    name: payload.name || "unknown",
    text: payload.text || "",
    ts: payload.ts || Date.now(),
  };
  if (!line.text) return;
  app.chat.push(line);
  if (app.chat.length > 80) app.chat.splice(0, app.chat.length - 80);
  renderChat();
}

function renderChat() {
  if (!chatLog) return;
  chatLog.innerHTML = "";
  const last = app.chat.slice(-30);
  last.forEach((m) => {
    const div = document.createElement("div");
    div.className = "chatLine" + (m.userId === app.userId ? " me" : "");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = m.userId === app.userId ? "你" : m.name;
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = fmtTime(m.ts);
    const text = document.createElement("span");
    text.textContent = `：${m.text}`;
    div.appendChild(name);
    div.appendChild(time);
    div.appendChild(text);
    chatLog.appendChild(div);
  });
  chatLog.scrollTop = chatLog.scrollHeight;
}

function fmtTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function sendChat() {
  if (!chatInput) return;
  const text = (chatInput.value || "").trim();
  if (!text) return;
  send("chat_send", { text }); // @BE
  chatInput.value = "";
}

let audioCtx = null;

function getAudio() {
  if (!app.settings.sfx) return null;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  } catch (_) {
    return null;
  }
}

function playSfx(kind) {
  const a = getAudio();
  if (!a) return;
  const now = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.connect(g);
  g.connect(a.destination);

  const base = kind === "shot" ? 220 : kind === "hit" ? 740 : kind === "kill" ? 520 : 160;
  o.type = kind === "hurt" ? "sawtooth" : "square";
  o.frequency.setValueAtTime(base, now);
  o.frequency.exponentialRampToValueAtTime(base * 1.6, now + 0.04);

  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(kind === "hurt" ? 0.08 : 0.05, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "kill" ? 0.12 : 0.08));

  o.start(now);
  o.stop(now + (kind === "kill" ? 0.13 : 0.09));
}

function updateFxFromState() {
  if (!app.gameState) return;
  const players = app.gameState.players || [];
  const prev = app.prevFrameByID;
  const now = performance.now();
  const shotRecent = now - app.fx.lastShotAt < 520;

  for (const p of players) {
    const pp = prev.get(p.id);
    if (!pp) continue;

    if (p.id === app.userId && p.hp < pp.hp) {
      app.fx.dmgT = Math.max(app.fx.dmgT, 0.68);
      toastMsg(`受伤 -${pp.hp - p.hp}`);
      playSfx("hurt");
    }
    if (shotRecent && p.id !== app.userId && p.hp < pp.hp) {
      app.fx.hitT = Math.max(app.fx.hitT, 0.78);
      spawnParticles("hit");
      playSfx("hit");
    }
    if (p.score > pp.score) {
      const d = p.score - pp.score;
      const who = p.id === app.userId ? "你" : p.name;
      pushFeed(who, d);
      if (p.id === app.userId) toastMsg(`+${d} 击杀`);
      if (p.id === app.userId) playSfx("kill");
    }
  }

  app.prevFrameByID = new Map(players.map((p) => [p.id, { ...p }]));
}

function isWall(mapRows, x, y) {
  if (y < 0 || y >= mapRows.length) return true;
  if (x < 0 || x >= mapRows[0].length) return true;
  return mapRows[y][x] === "#";
}

function normalizeAngle(a) {
  while (a < -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function clamp8(n) {
  return Math.max(0, Math.min(255, n | 0));
}

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? Math.floor(n) : min;
  return Math.max(min, Math.min(max, x));
}

// ---- Controls ----

document.addEventListener("keydown", (e) => {
  if (isTyping()) {
    return;
  }
  if (e.code === "Escape") {
    if (screenGame.classList.contains("hidden")) return;
    e.preventDefault();
    if (gameOver && !gameOver.classList.contains("hidden")) {
      closeGameOver();
      return;
    }
    toggleMenu();
    return;
  }
  if (isMenuOpen()) {
    return;
  }
  if (e.code === "Tab") {
    if (screenGame.classList.contains("hidden")) return;
    e.preventDefault();
    app.showBoard = true;
  }
  if (e.code === "Enter") {
    if (screenGame.classList.contains("hidden")) return;
    e.preventDefault();
    openChat();
    return;
  }
  if (e.code === "KeyW") app.input.forward = true;
  if (e.code === "KeyS") app.input.back = true;
  if (e.code === "KeyA") app.input.left = true;
  if (e.code === "KeyD") app.input.right = true;
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Tab") {
    if (screenGame.classList.contains("hidden")) return;
    e.preventDefault();
    app.showBoard = false;
  }
  if (e.code === "KeyW") app.input.forward = false;
  if (e.code === "KeyS") app.input.back = false;
  if (e.code === "KeyA") app.input.left = false;
  if (e.code === "KeyD") app.input.right = false;
});

function lockPointer() {
  if (isMenuOpen()) return;
  if (isTyping()) return;
  if (document.pointerLockElement === gameCanvas) return;
  gameCanvas.requestPointerLock();
}

gameCanvas.addEventListener("click", () => {
  lockPointer();
});

document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== gameCanvas) return;
  const sens = (app.settings && app.settings.sens) || 10;
  app.input.turnAccum += e.movementX * (0.0012 + sens * 0.00022);
});

document.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  if (document.pointerLockElement !== gameCanvas) return;
  app.input.shootEdge = true;
});

function isTyping() {
  return document.activeElement === chatInput;
}

function openChat() {
  if (!chatInput) return;
  app.input.forward = false;
  app.input.back = false;
  app.input.left = false;
  app.input.right = false;
  app.input.turnAccum = 0;
  try {
    document.exitPointerLock();
  } catch (_) {}
  chatInput.focus();
  chatInput.select();
}

function isMenuOpen() {
  return gameMenu && !gameMenu.classList.contains("hidden");
}

function openMenu() {
  if (!gameMenu) return;
  if (gameOver && !gameOver.classList.contains("hidden")) return;
  gameMenu.classList.remove("hidden");
  app.input.forward = false;
  app.input.back = false;
  app.input.left = false;
  app.input.right = false;
  app.input.turnAccum = 0;
  try {
    document.exitPointerLock();
  } catch (_) {}
}

function closeMenu() {
  if (!gameMenu) return;
  gameMenu.classList.add("hidden");
}

function toggleMenu() {
  if (isMenuOpen()) closeMenu();
  else openMenu();
}

function openGameOver() {
  if (!gameOver) return;
  closeMenu();
  try {
    document.exitPointerLock();
  } catch (_) {}
  gameOver.classList.remove("hidden");
  renderGameOver();
}

function closeGameOver() {
  if (!gameOver) return;
  gameOver.classList.add("hidden");
}

function renderGameOver() {
  const p = app.match.overPayload || {};
  const rankings = p.rankings || [];
  const winnerId = p.winnerId || "";
  const winScore = p.winScore || app.match.winScore || 10;
  const roomName = p.roomName || (app.room && app.room.name) || "对局";

  if (gameOverTitle) gameOverTitle.textContent = "对局结束";
  if (gameOverSub) gameOverSub.textContent = `胜利条件：先到 ${winScore} 击杀 ｜ 房间：${roomName}`;

  const winner = rankings.find((x) => x.id === winnerId) || rankings[0];
  const winnerName = winner ? winner.name : "某位神秘玩家";
  if (gameOverBless) {
    gameOverBless.textContent = pickBlessing(winnerName);
  }

  if (gameOverRank) {
    gameOverRank.innerHTML = "";
    rankings.forEach((r, idx) => {
      const row = document.createElement("div");
      row.className = "rankRow" + (idx === 0 ? " first" : "");
      const badge = document.createElement("div");
      badge.className = "rankBadge" + (idx === 0 ? " crown" : "");
      badge.textContent = idx === 0 ? "👑" : `#${idx + 1}`;
      const name = document.createElement("div");
      name.textContent = `${r.name}${r.id === app.userId ? "（你）" : ""}`;
      const score = document.createElement("div");
      score.className = "rankScore";
      score.textContent = `击杀 ${r.score}`;
      row.appendChild(badge);
      row.appendChild(name);
      row.appendChild(score);
      gameOverRank.appendChild(row);
    });
  }
}

function pickBlessing(name) {
  const list = [
    `恭喜 ${name} 登顶王座！愿你的枪声在像素宇宙里刻下永恒的回响，连墙角的阴影都开始为你鼓掌。`,
    `胜利者 ${name}：愿你每一次扣扳机都像在给命运盖章，子弹写诗，回声签名，世界自动让路。`,
    `${name} 已成为本局的“不可解释现象”。愿你的准星永远比现实更诚实，命中率高到让物理学羞愧。`,
    `向 ${name} 致以最抽象的祝福：愿你在下一局里继续把对手的迷茫，收编为你的战绩。`,
    `${name} 夺冠！愿你的皇冠自带光污染，照亮每一条走廊；愿你的好运像弹壳一样叮当落地，停不下来。`,
  ];
  return list[Math.floor(Math.random() * list.length)];
}

if (chatInput) {
  chatInput.addEventListener("keydown", (e) => {
    if (e.code === "Enter") {
      e.preventDefault();
      sendChat();
      gameCanvas.focus();
      return;
    }
    if (e.code === "Escape") {
      e.preventDefault();
      chatInput.blur();
      return;
    }
  });
}

if (chatSendBtn) {
  chatSendBtn.onclick = () => sendChat();
}

if (menuResumeBtn) {
  menuResumeBtn.onclick = () => {
    closeMenu();
    lockPointer();
  };
}
if (menuLeaveBtn) {
  menuLeaveBtn.onclick = () => leaveToLobby();
}
if (menuCopyInviteBtn) {
  menuCopyInviteBtn.onclick = async () => {
    if (!app.room) return;
    const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(app.room.id)}`;
    const ok = await copyText(url);
    if (!ok) alert("复制失败，请手动复制");
  };
}

if (sfxToggle) {
  sfxToggle.onchange = () => {
    app.settings.sfx = !!sfxToggle.checked;
    saveSettings();
  };
}
if (sensRange) {
  sensRange.oninput = () => {
    app.settings.sens = Number(sensRange.value) || 10;
    saveSettings();
  };
}

if (gameMenu) {
  gameMenu.addEventListener("click", (e) => {
    if (e.target === gameMenu) {
      closeMenu();
      lockPointer();
    }
  });
}

if (gameOverLeaveBtn) {
  gameOverLeaveBtn.onclick = () => leaveToLobby();
}
if (gameOverCloseBtn) {
  gameOverCloseBtn.onclick = () => {
    closeGameOver();
  };
}

// initial screen
showScreen(screenLogin);
setNetStatus("未连接");

loadSettings();
applySettingsToUI();

// invite link quick-join (requires hello first)
const params = parseParams();
if (params.room) {
  app.pendingRoomJoin = params.room;
}
