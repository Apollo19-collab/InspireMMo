// Aldermere server: static files + WebSocket multiplayer (presence, chat, dungeon parties).
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { SKILLS, REGIONS, ITEMS, SLOTS, SLOT_SKILL } = require([path.join(__dirname, 'public', 'data.js'), path.join(__dirname, 'data.js')].find(fs.existsSync));
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const root = fs.existsSync(path.join(__dirname, 'public', 'index.html')) ? path.join(__dirname, 'public') : __dirname;
const hidden = ['server.js', 'package.json', 'package-lock.json', 'db.json'];

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return api(req, res);
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || hidden.includes(path.basename(p)) || p.startsWith(DATA)) { res.writeHead(404); return res.end('Not found'); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
server.listen(process.env.PORT || 3000, () => console.log('Aldermere running, serving', root));

/* ---------- accounts, cloud saves, validation ---------- */
fs.mkdirSync(DATA, { recursive: true });
const DBF = path.join(DATA, 'db.json');
let db = { users: {}, sessions: {} }, dbDirty = false;
try { db = JSON.parse(fs.readFileSync(DBF, 'utf8')); } catch (e) {}
const persist = () => { dbDirty = true; };
function flush() { if (!dbDirty) return; dbDirty = false; try { fs.writeFileSync(DBF + '.tmp', JSON.stringify(db)); fs.renameSync(DBF + '.tmp', DBF); } catch (e) { console.error(e); } }
setInterval(flush, 2000);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { flush(); process.exit(0); });

const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
function newSession(u) { const t = crypto.randomBytes(24).toString('hex'); db.sessions[sha(t)] = { u, at: Date.now() }; persist(); return t; }
function session(t) { const s = db.sessions[sha(String(t || ''))]; return s && Date.now() - s.at < 30 * 864e5 && db.users[s.u] ? s.u : null; }

// Game maths mirrored from the client, driven by the shared data.js.
const need = (r, l) => Math.round(40 * Math.pow(l, 1.7) * r.scale);
const maxXp = r => { let t = 0; for (let l = 1; l < r.max; l++) t += need(r, l); return t; };
const lvl = (r, xp) => { let l = 1; while (l < r.max && xp >= need(r, l)) { xp -= need(r, l); l++; } return l; };
const avg = ([a, b]) => (a + b) / 2;
const dropVal = d => Object.entries(d).reduce((t, [n, r]) => t + avg(r) * ITEMS[n][3], 0);
// Fastest plausible xp/sec per skill (gear bonuses included) and best wealth/sec from any action, with slack.
const RATE = {}; let WRATE = 0;
for (const r of REGIONS) {
  for (const [k] of SKILLS) RATE[r.id + ':' + k] = Math.max(...r[k].map(a => a.xp / a.sec)) * (k === 'combat' ? 2.5 : 1.6);
  for (const a of r.combat) WRATE = Math.max(WRATE, (dropVal(a.drops) + avg(a.gold)) / a.sec);
  for (const a of r.gathering) WRATE = Math.max(WRATE, dropVal(a.drops) / a.sec);
  for (const a of r.crafting) WRATE = Math.max(WRATE, (ITEMS[a.name][3] - Object.entries(a.cost).reduce((t, [n, c]) => t + c * ITEMS[n][3], 0)) / a.sec);
}
WRATE *= 2.2;
const wealth = s => s.gold + Object.entries(s.inv).reduce((t, [n, c]) => t + ITEMS[n][3] * c, 0) + Object.values(s.equip).reduce((t, n) => t + (n ? ITEMS[n][3] : 0), 0);

function sanitize(x) {
  if (!x || typeof x !== 'object') return null;
  const s = { t: Date.now(), xp: {}, inv: {}, gold: 0, active: null, prog: 0, view: 0, log: [], equip: {}, name: clean(x.name, 16), tab: 'world', f: 'all', sel: null, role: 'striker' };
  s.gold = Math.floor(x.gold);
  if (!Number.isFinite(s.gold) || s.gold < 0 || s.gold > 1e12) return null;
  for (const [k, v] of Object.entries(x.xp || {})) {
    const [rid, sk] = k.split(':'), r = REGIONS.find(r => r.id === rid);
    if (!r || !SKILLS.some(a => a[0] === sk) || !Number.isFinite(v) || v < 0 || v > maxXp(r) + r.scale * 2000) return null;
    if (v > 0) s.xp[k] = v;
  }
  for (const [n, c] of Object.entries(x.inv || {})) {
    if (!ITEMS[n] || !Number.isInteger(c) || c < 0 || c > 1e7) return null;
    if (c) s.inv[n] = c;
  }
  for (const [sl, n] of Object.entries(x.equip || {})) {
    if (n == null) continue;
    if (!SLOTS.includes(sl) || !ITEMS[n] || ITEMS[n][0] !== sl) return null;
    s.equip[sl] = n;
  }
  const a = x.active;
  if (a && REGIONS[a.r] && SKILLS.some(z => z[0] === a.k) && REGIONS[a.r][a.k][a.a]) s.active = { r: a.r, k: a.k, a: a.a };
  s.prog = Math.min(1e6, Math.max(0, +x.prog || 0));
  s.view = Math.min(REGIONS.length - 1, Math.max(0, x.view | 0));
  s.log = (Array.isArray(x.log) ? x.log : []).slice(0, 6).map(l => clean(l, 200));
  if (['world', 'inv', 'char', 'social'].includes(x.tab)) s.tab = x.tab;
  if (['all', 'mat', 'gear'].includes(x.f)) s.f = x.f;
  if (ITEMS[x.sel]) s.sel = x.sel;
  if (ROLES.includes(x.role)) s.role = x.role;
  return s;
}
// Returns null if the save is plausible, otherwise a short reason.
function check(acct, s) {
  const base = acct.save || { xp: {}, inv: {}, gold: 0, equip: {} };
  const E = Math.min((Date.now() - acct.savedAt) / 1000, 8 * 3600 + 60);
  for (let i = 1; i < REGIONS.length; i++) {
    const r = REGIONS[i], p = REGIONS[i - 1];
    if (SKILLS.some(([k]) => (s.xp[r.id + ':' + k] || 0) > 0) && !SKILLS.every(([k]) => lvl(p, s.xp[p.id + ':' + k] || 0) >= p.max)) return 'region locked';
  }
  let used = 0;
  for (const k in s.xp) used += Math.max(0, s.xp[k] - (base.xp[k] || 0)) / RATE[k];
  if (used > E + acct.credit.secs + 30) return 'xp gained too fast';
  if (wealth(s) - wealth(base) > E * WRATE + acct.credit.wealth + 100) return 'wealth gained too fast';
  return null;
}
function deriveStats(s) {
  if (!s) return { power: 0, region: 0 };
  let lv = 0, region = 0, might = 0;
  REGIONS.forEach((r, i) => {
    lv += lvl(r, s.xp[r.id + ':combat'] || 0) - 1;
    if (i === 0 || SKILLS.every(([k]) => lvl(REGIONS[i - 1], s.xp[REGIONS[i - 1].id + ':' + k] || 0) >= REGIONS[i - 1].max)) region = i;
  });
  for (const [sl, n] of Object.entries(s.equip)) if (n && (SLOT_SKILL[sl] == null || SLOT_SKILL[sl] === 'combat')) might += (ITEMS[n][4] || {}).might || 0;
  return { power: lv + 2 * might, region };
}
function creditFor(acct, d, res) {
  acct.credit.secs += res.xp / RATE[REGIONS[d.region].id + ':combat'];
  acct.credit.wealth += res.gold + Object.entries(res.items).reduce((t, [n, c]) => t + ITEMS[n][3] * c, 0);
  persist();
}

const ipHits = new Map();
function api(req, res) {
  const json = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const route = req.url.slice(5).split('?')[0];
  let body = '';
  req.on('data', c => { body += c; if (body.length > 300000) req.destroy(); });
  req.on('end', () => {
    let b; try { b = JSON.parse(body); } catch (e) { return json(400, { error: 'Bad request' }); }
    if (route === 'login' || route === 'register') {
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const h = ipHits.get(ip) || { n: 0, t: Date.now() };
      if (Date.now() - h.t > 60000) { h.n = 0; h.t = Date.now(); }
      ipHits.set(ip, h);
      if (++h.n > 10) return json(429, { error: 'Too many attempts. Wait a minute.' });
    }
    if (route === 'register') {
      const u = String(b.user || '').trim(), pw = String(b.pass || '');
      if (!/^[A-Za-z0-9_]{3,16}$/.test(u)) return json(400, { error: 'Username: 3-16 letters, numbers or underscores.' });
      if (pw.length < 6 || pw.length > 72) return json(400, { error: 'Password must be 6-72 characters.' });
      const key = u.toLowerCase();
      if (db.users[key]) return json(409, { error: 'That name is taken.' });
      const salt = crypto.randomBytes(16).toString('hex');
      db.users[key] = { name: u, salt, hash: hashPw(pw, salt), created: Date.now(), save: null, rev: 0, savedAt: Date.now(), credit: { secs: 0, wealth: 0 } };
      return json(200, { token: newSession(key), user: u, save: null, rev: 0 });
    }
    if (route === 'login') {
      const a = db.users[String(b.user || '').trim().toLowerCase()];
      if (!a || !safeEq(hashPw(String(b.pass || ''), a.salt), a.hash)) return json(401, { error: 'Wrong username or password.' });
      return json(200, { token: newSession(a.name.toLowerCase()), user: a.name, save: a.save, rev: a.rev });
    }
    const key = session(b.token);
    if (!key) return json(401, { error: 'Session expired. Log in again.' });
    const a = db.users[key];
    if (route === 'load') return json(200, { user: a.name, save: a.save, rev: a.rev });
    if (route === 'logout') { delete db.sessions[sha(String(b.token))]; persist(); return json(200, { ok: true }); }
    if (route === 'save') {
      if (b.rev !== a.rev) return json(200, { ok: false, stale: true, save: a.save, rev: a.rev });
      const s = sanitize(b.save), why = s ? check(a, s) : 'invalid data';
      if (why) return json(200, { ok: false, reason: why, save: a.save, rev: a.rev });
      a.save = s; a.rev++; a.savedAt = s.t; persist();
      for (const p of players.values()) if (p.key === key) derive(p);
      return json(200, { ok: true, rev: a.rev });
    }
    json(404, { error: 'Unknown route' });
  });
}

/* ---------- multiplayer ---------- */
const DUNGEONS = [
  { id: 'crypt', name: 'Hollow Crypt', region: 0, size: 4, min: 2, difficulty: 70, secs: 45, gold: [40, 70], xp: 80,
    drops: { 'Crypt Token': [1, 2] }, rare: ['Warden Charm', 0.10], blurb: 'Bones, tombs and a sleepless warden.' },
  { id: 'forge', name: 'Cinder Forge', region: 1, size: 4, min: 2, difficulty: 170, secs: 75, gold: [120, 200], xp: 500,
    drops: { 'Forge Heart': [1, 2] }, rare: ['Forgelord Plate', 0.08], blurb: 'A dead foundry that still burns.' },
];
const ROLES = ['tank', 'healer', 'striker'];
const players = new Map(), parties = new Map(), chat = [];
let pseq = 0, qseq = 0;
const clean = (s, n) => String(s || '').replace(/[<>&"`]/g, '').trim().slice(0, n);
const roll = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));
const send = (p, m) => { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(m)); };

function snapshot() {
  return {
    t: 'state', chat,
    online: [...players.values()].map(p => ({ name: p.name, power: p.power })),
    parties: [...parties.values()].map(q => ({
      id: q.id, d: q.d, leader: q.leader, status: q.status, progress: q.progress,
      members: q.members.map(m => ({ id: m.p.id, name: m.p.name, role: m.role, power: m.p.power })),
    })),
  };
}
function broadcast() { const s = JSON.stringify(snapshot()); for (const p of players.values()) if (p.ws.readyState === 1) p.ws.send(s); }
function derive(p) { const d = deriveStats(p.acct.save); p.power = d.power; p.region = d.region; }
function join(q, p, role) { q.members.push({ p, role: ROLES.includes(role) ? role : 'striker' }); p.party = q.id; }
function leave(p) {
  const q = parties.get(p.party); p.party = null;
  if (!q) return;
  q.members = q.members.filter(m => m.p !== p);
  if (!q.members.length) parties.delete(q.id);
  else if (q.leader === p.id) q.leader = q.members[0].p.id;
}
function finish(q, d) {
  const power = q.members.reduce((t, m) => t + m.p.power, 0);
  const distinct = new Set(q.members.map(m => m.role)).size;
  const ratio = power * (1 + 0.1 * (distinct - 1)) / d.difficulty * (0.9 + Math.random() * 0.2);
  const success = Math.random() < Math.min(0.95, Math.max(0.05, (ratio - 0.5) / 0.7));
  for (const m of q.members) {
    const items = {};
    if (success) {
      for (const i in d.drops) items[i] = roll(d.drops[i]);
      if (Math.random() < d.rare[1]) items[d.rare[0]] = 1;
    }
    const res = { t: 'result', name: d.name, region: d.region, success, xp: success ? d.xp : 0, gold: Math.round(roll(d.gold) * (success ? 1 : 0.25)), items };
    creditFor(m.p.acct, d, res); send(m.p, res);
    m.p.party = null;
  }
  parties.delete(q.id);
}
setInterval(() => {
  let any = false; const now = Date.now();
  for (const q of [...parties.values()]) {
    if (q.status !== 'running') continue;
    any = true;
    const d = DUNGEONS.find(x => x.id === q.d);
    q.progress = Math.min(1, (now - q.startAt) / (d.secs * 1000));
    if (q.progress >= 1) finish(q, d);
  }
  if (any) broadcast();
}, 1000);

const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  let p = null;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'hello') {
      const key = session(m.token);
      if (p || !key) return;
      for (const o of players.values()) if (o.key === key) o.ws.close();
      const acct = db.users[key];
      p = { ws, key, acct, id: ++pseq, name: acct.name, power: 0, region: 0, party: null, last: 0 };
      derive(p); players.set(p.id, p);
      send(p, { t: 'init', you: p.id, dungeons: DUNGEONS });
      return broadcast();
    }
    if (!p) return;
    if (m.t === 'chat') {
      if (Date.now() - p.last < 700) return;
      p.last = Date.now();
      const x = clean(m.text, 200); if (!x) return;
      chat.push({ n: p.name, x }); if (chat.length > 30) chat.shift();
    } else if (m.t === 'create') {
      const d = DUNGEONS.find(x => x.id === m.d);
      if (p.party || !d || p.region < d.region) return;
      const q = { id: 'P' + (++qseq), d: d.id, leader: p.id, status: 'lobby', progress: 0, members: [], startAt: 0 };
      parties.set(q.id, q); join(q, p, m.role);
    } else if (m.t === 'join') {
      const q = parties.get(m.party), d = q && DUNGEONS.find(x => x.id === q.d);
      if (p.party || !q || q.status !== 'lobby' || q.members.length >= d.size || p.region < d.region) return;
      join(q, p, m.role);
    } else if (m.t === 'role') {
      const q = parties.get(p.party), mem = q && q.members.find(x => x.p === p);
      if (mem && q.status === 'lobby' && ROLES.includes(m.role)) mem.role = m.role;
    } else if (m.t === 'leave') leave(p);
    else if (m.t === 'start') {
      const q = parties.get(p.party), d = q && DUNGEONS.find(x => x.id === q.d);
      if (q && q.leader === p.id && q.status === 'lobby' && q.members.length >= d.min) { q.status = 'running'; q.startAt = Date.now(); }
    }
    broadcast();
  });
  ws.on('close', () => { if (p && players.get(p.id) === p) { leave(p); players.delete(p.id); broadcast(); } });
});
