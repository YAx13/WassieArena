"use strict";
/* ---------- MODE AFK : ASCENSION 1v1 INFINIE & FARM OR / XP ---------- */
const AFK_ASSETS = {
  BG_IMAGE: "",
  HERO_SIZE: 156
};

const AFKMode = {
  CAP_SEC: 4 * 3600,
  run: false,
  raf: 0,
  last: 0,
  wave: 1,
  pushMode: true,
  wallWave: 0,
  bgWidth: 1376,
  bgHeight: 768,
  _bgKey: "",
  duel: null,
  quickBarEl: null,

  /* ---- Taux passifs basés sur l'étage record (afkWaveMax) ---- */
  maxFloor(b = S.cur) {
    return Math.max(1, (b && (b.afkWaveMax || b.afkWave)) || 1);
  },
  get RATE() {
    const mult = 1 + (this.maxFloor() - 1) * 0.08;
    return Math.max(1, Math.round(GameState.tauxOrAfk() * mult));
  },
  get XP_RATE() {
    const fl = this.maxFloor();
    const vipMult = GameState.vip ? 1.5 : 1;
    return Math.max(1, Math.round((2 + fl * 1.4) * vipMult));
  },

  /* ---- Calcul du butin en attente (Or + XP exclusif AFK) ---- */
  pending(b = S.cur, now = Date.now()) {
    if (!b) return 0;
    const sec = Math.min(this.CAP_SEC, Math.max(0, (now - b.afkTs) / 1000));
    return Math.floor(sec * this.RATE);
  },
  pendingXp(b = S.cur, now = Date.now()) {
    if (!b) return 0;
    const sec = Math.min(this.CAP_SEC, Math.max(0, (now - b.afkTs) / 1000));
    return Math.floor(sec * this.XP_RATE);
  },
  harvest() {
    const b = S.cur;
    if (!b) return;
    const g = this.pending(b);
    const xp = this.pendingXp(b);
    if (g <= 0 && xp <= 0) {
      toast("Rien à récolter pour l'instant.");
      return;
    }
    b.gold += g;
    b.afkTs = Date.now();
    if (xp > 0) GameState.gagnerXp(xp);
    else {
      persist();
      this.hud();
    }
    toast(`+${g.toLocaleString("fr-FR")} Or & +${xp.toLocaleString("fr-FR")} XP récoltés !`);
  },

  /* ---- Initialisation & Cycle de vie ---- */
  init() {
    this.field = $("#afk-field");
    this.stage = $("#afk-stage");
    this.hero = $("#afk-hero");
    if (this.field) this.field.classList.add("arena-field");
    if (this.hero) this.hero.style.display = "none"; // Le héros est rendu dans le duel 1v1
    const comp = $("#afk-companion");
    if (comp) comp.style.display = "none";

    this.setBg();
    const btnHarvest = $("#btn-harvest");
    if (btnHarvest) btnHarvest.onclick = () => this.harvest();
    const waveEl = $("#afk-wave");
    if (waveEl) waveEl.style.pointerEvents = "auto";
    document.addEventListener("click", e => {
      if (e.target && e.target.closest("#btn-afk-retry")) {
        e.stopPropagation();
        this.retryWall();
      }
    }, true);

    addEventListener("resize", () => this.fitStage());
    if ("ResizeObserver" in window && $("#home-grid")) {
      this.resizeObserver = new ResizeObserver(() => this.fitStage());
      this.resizeObserver.observe($("#home-grid"));
    }
  },
  initBrute(b) {
    if (!Number.isFinite(b.afkTs) || b.afkTs > Date.now()) b.afkTs = Date.now();
    if (!Number.isFinite(b.afkWave) || b.afkWave < 1) b.afkWave = 1;
    if (!Number.isFinite(b.afkWaveMax) || b.afkWaveMax < b.afkWave) b.afkWaveMax = b.afkWave;
  },
  start() {
    if (!S.cur || this.run) return;
    this.initBrute(S.cur);
    this.run = true;
    this.wave = S.cur.afkWave || 1;
    this.pushMode = this.wave >= (S.cur.afkWaveMax || 1);
    this.startDuel();
    this.hud();
    this.last = performance.now();
    this.raf = requestAnimationFrame(t => this.loop(t));
  },
  stop() {
    this.run = false;
    cancelAnimationFrame(this.raf);
    this.clearDuel();
    if (this.quickBarEl) {
      this.quickBarEl.remove();
      this.quickBarEl = null;
    }
  },

  /* ---- Décor & Mise à l'échelle ---- */
  fitStage() {
    const grid = $("#home-grid");
    if (!grid || !this.stage || !grid.clientWidth || !grid.clientHeight) return;
    const ratio = this.bgWidth / this.bgHeight;
    const height = Math.min(grid.clientHeight, grid.clientWidth / ratio);
    this.stage.style.setProperty("--afk-ratio", `${this.bgWidth} / ${this.bgHeight}`);
    this.stage.style.width = `${height * ratio}px`;
    this.stage.style.height = `${height}px`;
  },
  setBg(b = S.cur) {
    if (!this.stage || !b) return;
    const raw = String(b.sprite || b.species || "").toLowerCase();
    const found = DataEngine.BRAWLERS.find(n => raw.startsWith(n));
    const k = !found || found === "dummy" ? "general" : found;
    if (k === this._bgKey) return;
    this._bgKey = k;

    const tryExt = exts => {
      if (this._bgKey !== k) return;
      if (!exts.length) {
        this.bgWidth = 1376;
        this.bgHeight = 768;
        this.fitStage();
        return;
      }
      const im = new Image();
      im.onload = () => {
        if (this._bgKey !== k) return;
        this.stage.style.setProperty("--afk-bg-img", `url('${im.src}')`);
        this.bgWidth = im.naturalWidth;
        this.bgHeight = im.naturalHeight;
        this.fitStage();
      };
      im.onerror = () => tryExt(exts.slice(1));
      im.src = assetPath.afk(k, 1, exts[0]);
    };
    tryExt(["jpeg", "jpg", "png"]);
  },

  /* ---- Génération d'adversaires 1v1 (Brutes & Boss tous les 10 étages) ---- */
  isBossWave(w = this.wave) {
    return w > 0 && w % 10 === 0;
  },
  createOpponent(w) {
    const b = S.cur;
    const isBoss = this.isBossWave(w);
    const pool = DataEngine.BRAWLERS.filter(k => k !== "dummy" && (!b || k !== b.sprite));
    const spr = pool.length ? pool[(w - 1) % pool.length] : "general";

    // Courbe d'équilibrage : points de stats proportionnels à l'étage
    const statBudget = Math.round(14 + w * 3.2 + (isBoss ? w * 1.5 : 0));
    const stats = DataEngine.rollStartStats(statBudget);
    const lv = Math.max(1, Math.round(1 + w * 0.65));

    // Armes & Équipements pour activer le système Pierre-Feuille-Ciseaux
    const allW = DataEngine.WEAPONS.map(x => x.id);
    const wCount = isBoss ? Math.min(4, 2 + Math.floor(w / 20)) : Math.min(3, 1 + Math.floor(w / 15));
    const weapons = [];
    while (weapons.length < wCount && allW.length) {
      const id = DataEngine.pick(allW);
      if (!weapons.includes(id)) weapons.push(id);
    }

    const gearRarity = Math.min(5, Math.floor(w / 12));
    const sets = ["carnage", "cyber", "mutant"];
    const enemySet = sets[(Math.floor((w - 1) / 5)) % sets.length];
    const gear = w >= 3 ? [
      { part: "helmet", rarity: gearRarity, set: enemySet },
      { part: "chest", rarity: gearRarity, set: enemySet }
    ] : [];

    const titles = ["Gardien", "Exécuteur", "Colosse", "Seigneur", "Titan", "Fléau"];
    const label = isBoss
      ? `👑 ${titles[(Math.floor(w / 10) - 1) % titles.length]} (Étage ${w})`
      : `${spr.charAt(0).toUpperCase() + spr.slice(1)} (Étage ${w})`;

    return {
      id: "afk_opp_" + w,
      name: label,
      species: isBoss ? "Boss" : "Brute",
      style: isBoss ? "boss" : "brute",
      hue: (w * 37) % 360,
      sprite: spr,
      stats,
      level: lv,
      weapons,
      gear,
      skills: DataEngine.pickSkills(Math.min(4, 1 + Math.floor(w / 10))),
      companion: null,
      scale: isBoss ? 1.15 : 1,
      _enemySet: enemySet
    };
  },

  /* ---- Moteur de duel 1v1 en direct (BattleEngine) ---- */
  clearDuel() {
    if (this.duel) {
      (this.duel.dom || []).forEach(el => el.remove());
      this.duel = null;
    }
    if (this.field) this.field.classList.remove("is-duel");
    const fxCv = $("#cv-afk-fx");
    if (fxCv) {
      const ctx = fxCv.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, fxCv.width, fxCv.height);
    }
  },
  startDuel() {
    const b = S.cur;
    if (!b || !this.field) return;
    this.clearDuel();
    this.field.classList.add("is-duel");

    const c = renderer.clock;
    const pv = Object.create(b);
    const eq = (GameState.competencesEquipees || []).filter(id => b.skills.includes(id));
    pv.skills = (eq.length ? eq : b.skills).slice(0, Math.max(1, b.slotsCompetences || 3));

    const opp = this.createOpponent(this.wave);
    const eng = new BattleEngine(pv, opp, ProfileManager.getBuffs());
    const q = [];
    ["on_attack", "on_hit", "on_dot", "on_skill", "on_dodge", "on_death", "on_end"].forEach(ev =>
      eng.on(ev, e => q.push(e))
    );

    const mk = (br, i) => ({
      b: br, name: br.name, x: i ? 305 : 95, bx: i ? 305 : 95, y: 188,
      flip0: !!i, flip: !!i, anim: "idle", t0: c, flash0: -1e6,
      hp: eng.f[i].hp, dh: eng.f[i].hp, lastHp: eng.f[i].hp, hit0: -1e6,
      max: eng.f[i].max, win: false, air: 0, wpn: null, scale: br.scale || 1, st: {}, pet: false
    });
    const V = [pv, opp].map(mk);
    const P = V.map((v, i) => {
      const cp = v.b.companion;
      if (!cp) return null;
      const hx = v.bx + (i ? 54 : -54);
      return {
        pet: true, i, owner: v.b, key: cp.species + ":" + (cp.form || 1),
        x: hx, hx, y: v.y + 2, flip: v.flip0, flip0: v.flip0, anim: "idle", t0: c, flash0: -1e6, win: false, air: 0
      };
    }).filter(Boolean);

    const dom = [];
    const mountUnit = (f, idx, isPet) => {
      const el = document.createElement("div");
      el.className = "arena-unit" + (isPet ? " is-pet" : "") + (idx > 0 ? " is-enemy" : "");
      const cv = document.createElement("canvas");
      cv.width = 64;
      cv.height = 64;
      const ctx = cv.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      el.appendChild(cv);

      if (!isPet) {
        const oh = document.createElement("div");
        oh.className = "arena-overhead";
        oh.innerHTML = `<div class="arena-badges"></div><div class="arena-tag">${f.name} <small>Niv.${f.b.level || 1}</small></div><div class="arena-hpbar"><i class="dh" style="width:100%"></i><i class="hp" style="width:100%"></i></div>`;
        el.appendChild(oh);
        f._domDh = oh.querySelector(".dh");
        f._domHp = oh.querySelector(".hp");
        f._domBadges = oh.querySelector(".arena-badges");
      }
      this.field.appendChild(el);
      dom.push(el);
      f._domEl = el;
      f._domCv = cv;
      f._domCtx = ctx;
    };

    V.forEach((f, k) => mountUnit(f, k, false));
    P.forEach(p => mountUnit(p, p.i, true));
    this.duel = { eng, opp, V, P, q, fl: [], vfx: [], proj: null, ph: { k: "intro", t: c + 350 }, dom };
    this.syncDuel(c);
  },

  loop(t) {
    if (!this.run) return;
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
if (!OV.stack.length && !document.hidden) {
this.stepDuel(dt);
}
this.raf = requestAnimationFrame(x => this.loop(x));
},
stepDuel() {
const D = this.duel;
if (!D) return;
const c = renderer.clock, p = D.ph;
if (!p) return;
if (p.k === "intro") {
if (c >= p.t) this.nextDuelTurn(c);
this.syncDuel(c);
return;
}
if (p.k === "end") {
if (c >= p.t) this.onDuelEnd();
else this.syncDuel(c);
return;
}
const e = c - p.t0, a = D.V[p.i], d = D.V[p.j];
if (p.kind === "pet") {
const pt = p.pt;
if (!pt) { this.afterDuelTurn(c); this.syncDuel(c); return; }
a.anim = e < 500 ? "whistle" : "idle";
if (e < 300) pt.anim = "idle";
else if (e < 650) { pt.x = pt.hx + (p.tx - pt.hx) * (e - 300) / 350; pt.flip = pt.flip0; pt.anim = "run"; }
else if (e < 900) {
pt.x = p.tx; pt.anim = "bite";
if (!p.hit) { p.hit = 1; this.applyDuelEvents(p, c); }
} else if (e < 1200) { pt.x = p.tx + (pt.hx - p.tx) * (e - 900) / 300; pt.flip = !pt.flip0; pt.anim = "run"; }
else { pt.x = pt.hx; pt.flip = pt.flip0; pt.anim = "idle"; this.afterDuelTurn(c); }
this.syncDuel(c);
return;
}
const T = p.T;
if (!p.hit && e >= p.h) { p.hit = 1; this.applyDuelEvents(p, c); }
if (p.ranged && e >= p.rel && e < p.h) {
a.wpn = null;
if (!D.proj && p.wicon) {
D.proj = { ic: p.wicon, id: p.wid, b: a.b, x0: a.bx + (p.i ? -28 : 28), y0: a.y - 48, x1: d.bx, y1: d.y - 42, t0: p.t0 + p.rel, t1: p.t0 + p.h };
}
}
if (e < T[0]) {
const k = T[0] > 0 ? e / T[0] : 1;
a.x = a.bx + (p.tx - a.bx) * (1 - Math.pow(1 - k, 3));
a.air = p.jump ? Math.sin(Math.PI * k) * p.jump : 0;
a.flip = a.flip0;
a.anim = "dash";
} else if (e < T[1]) {
a.x = p.tx; a.air = 0; a.flip = a.flip0; a.anim = p.anim;
} else if (e < T[2]) {
const rk = (e - T[1]) / Math.max(1, T[2] - T[1]);
a.x = p.tx + (a.bx - p.tx) * rk;
a.air = Math.sin(Math.PI * rk) * 12;
a.flip = !a.flip0;
a.anim = "dash";
} else {
const heldId = D.eng.f[p.i].held;
a.wpn = heldId !== null ? { ic: DataEngine.WEAPONS[heldId].icon, id: heldId } : null;
a.x = a.bx; a.air = 0; a.flip = a.flip0; a.anim = "idle";
this.afterDuelTurn(c);
}
this.syncDuel(c);
},
nextDuelTurn(c) {
const D = this.duel;
if (!D) return;
D.q.length = 0;
D.eng.step();
D.proj = null;
D.eng.f.forEach((f, k) => { if (D.V[k]) D.V[k].st = JSON.parse(JSON.stringify(f.st)); });
const at = D.q[0], ev = D.q.slice(1), ht = ev.find(e => e.type === "on_hit"), crit = !!(ht && ht.crit);
const A = D.V[at.i], Dd = D.V[at.j], dir = at.i ? -1 : 1;
let kind = "punch";
if (at.pet) kind = "pet";
else if (at.self) kind = at.skill ? "self" : "idle";
else if (at.weapon) {
const wt = at.threwWpn ? "throw" : ((DataEngine.WEAPONS[at.weapon.id] && DataEngine.WEAPONS[at.weapon.id].type) || "light");
kind = crit ? { light: "pierce", heavy: "meteor", throw: "salto" }[wt] : { light: "estoc", heavy: "overhead", throw: "throw" }[wt];
} else kind = crit ? "uppercut" : "punch";
const map = {
punch:    { anim: "punch",    T: new Array(260, 760, 1020), h: 480 },
estoc:    { anim: "thrust",   T: new Array(230, 700, 950),  h: 440 },
overhead: { anim: "overhead", T: new Array(300, 880, 1150), h: 580, jump: 22 },
throw:    { anim: "throw",    T: new Array(0, 780, 1020),   h: 580, rel: 240, ranged: 1 },
uppercut: { anim: "uppercut", T: new Array(290, 850, 1120), h: 550, jump: 26 },
pierce:   { anim: "pierce",   T: new Array(210, 720, 980),  h: 410 },
meteor:   { anim: "meteor",   T: new Array(340, 980, 1280), h: 650, jump: 34 },
salto:    { anim: "salto",    T: new Array(0, 920, 1150),   h: 650, rel: 400, ranged: 1 },
self:     { anim: "taunt",    T: new Array(0, 650, 650),    h: 240 },
idle:     { anim: "idle",     T: new Array(0, 520, 520),    h: 180 },
pet:      { anim: "whistle",  T: new Array(0, 1700, 1700),  h: 950 }
}[kind];
const tx = map.ranged || at.self || kind === "pet"
? (kind === "pet" ? Dd.bx + (at.i ? 42 : -42) : A.bx)
: Dd.bx - dir * 46;
const heldId = D.eng.f[at.i].held;
A.wpn = at.weapon && !at.pet
? { ic: at.weapon.icon, id: at.weapon.id }
: (heldId !== null ? { ic: DataEngine.WEAPONS[heldId].icon, id: heldId } : null);
D.ph = Object.assign({
k: "act", kind, t0: c, i: at.i, j: at.j, ev, hit: 0, tx,
wicon: at.weapon && at.weapon.icon, wid: at.weapon && at.weapon.id,
pt: kind === "pet" ? D.P.find(p => p.i === at.i) : null
}, map);
},
applyDuelEvents(p, c) {
const D = this.duel;
if (!D) return;
const d = D.V[p.j];
for (const e of p.ev) {
if (e.type === "on_hit") {
d.hp = e.hp; d.flash0 = c; d.sx = 1.2; d.sy = 0.84; d.knock = (p.i ? -1 : 1) * (e.crit ? 10 : 5);
d.anim = "hit"; d.t0 = c;
D.V[p.i].hp = e.hpA;
D.vfx.push({ kind: "slash", x: d.bx, y: d.y - 36, dir: p.i ? -1 : 1, crit: !!e.crit, t0: c, dur: 240 });
if (e.crit) D.vfx.push({ kind: "crit", x: d.bx, y: d.y, t0: c, dur: 340 });
D.fl.push({ s: e.dmg > 0 ? "-" + e.dmg : "Absorbé", x: d.bx, y: d.y - 76, c0: c, col: e.crit ? "#ffb000" : "#ffffff", big: e.crit });
}
if (e.type === "on_dodge") {
d.knock = (p.i ? -1 : 1) * 10; d.air = 10; d.anim = "dodge"; d.t0 = c;
D.fl.push({ s: "Esquive", x: d.bx, y: d.y - 76, c0: c, col: "#e8a830" });
}
if (e.type === "on_dot") {
const a = D.V[e.i]; a.hp = e.hpA; a.flash0 = c;
D.fl.push({ s: "-" + e.dmg, x: a.bx, y: a.y - 76, c0: c, col: "#c58be0" });
}
if (e.type === "on_skill") {
const a = D.V[e.i], t = D.V[e.j];
if (e.hpA > a.hp) D.fl.push({ s: "+" + (e.hpA - a.hp), x: a.bx, y: a.y - 76, c0: c, col: "#9be15d" });
a.hp = e.hpA; t.hp = e.hp;
if (e.fl) D.fl.push({ s: e.fl, x: a.bx, y: a.y - 96, c0: c, col: "#ffd27a" });
}
if (e.type === "on_death") {
const dead = D.V[e.dead]; dead.anim = "death"; dead.t0 = c;
const pt = D.P.find(q => q.i === e.dead);
if (pt) { pt.anim = "death"; pt.t0 = c; }
}
}
},
afterDuelTurn(c) {
const D = this.duel;
if (!D) return;
    if (D.eng.over) {
      const w = D.V[D.eng.winner];
      w.win = true; w.anim = "victory"; w.t0 = c;
      D.ph = { k: "end", t: c + 1400 };
    } else {
this.nextDuelTurn(c);
}
},
/* ---- Résolution du duel : Ascension vs Farm (Or/XP uniquement en Farm) ---- */
onDuelEnd() {
const D = this.duel, b = S.cur;
if (!D || !b) return;
const won = D.eng.winner === 0;
const w = this.wave;
const isFirstClear = won && w >= (b.afkWaveMax || 1);
if (won) {
// Gain direct de combat (Or + XP exclusif AFK)
const goldGain = Math.max(5, Math.round(8 + w * 4.5));
const xpGain = Math.max(4, Math.round(6 + w * 3.2));
GameState.ressources.or += goldGain;
if (isFirstClear) {
b.afkWaveMax = w + 1;
// Récompense d'ascension unique (pas de drop en mode Farm)
if (w % 10 === 0) {
GameState.ressources.caisses = (GameState.ressources.caisses || 0) + 1;
GameState.ressources.parchemins = (GameState.ressources.parchemins || 0) + 1;
toast("👑 Boss Étage " + w + " vaincu ! +1 📦 Caisse & +1 📜 Parchemin");
} else if (w % 5 === 0) {
GameState.ressources.caisses = (GameState.ressources.caisses || 0) + 1;
toast("🎉 Palier Étage " + w + " atteint ! +1 📦 Caisse");
}
}
if (this.pushMode) {
this.wave = w + 1;
b.afkWave = this.wave;
}
GameState.gagnerXp(xpGain);
} else {
this.wallWave = w;
this.pushMode = false;
this.wave = Math.max(1, w - 1);
b.afkWave = this.wave;
GameState.save();
toast("🧱 Bloqué à l'étage " + w + " → Auto-Farm Étage " + this.wave + " (Or & XP)");
}
this.hud();
this.startDuel();
},
retryWall() {
const b = S.cur;
if (!b) return;
this.pushMode = true;
this.wave = Math.max(this.wallWave || 1, b.afkWaveMax || 1);
b.afkWave = this.wave;
this.wallWave = 0;
this.hud();
this.startDuel();
},
/* ---- Rendu Canvas du duel 1v1 ---- */
syncDuel(c) {
const D = this.duel;
if (!D || !this.field) return;
const sw = this.field.clientWidth || 800, sh = this.field.clientHeight || 450;
[...D.V, ...D.P].forEach(f => {
if (!f._domEl || !f._domCtx) return;
const [an, n] = renderer.animFrame(f, c);
const wid = !f.pet && f.wpn && Number.isInteger(f.wpn.id) ? f.wpn.id : null;
const ctx = f._domCtx;
if (f.pet) renderer.drawPet(ctx, f, an, n);
else renderer.drawBrute(ctx, f.b, c, an, n, wid);
const fl = Math.max(0, 1 - (c - f.flash0) / 180);
if (fl > 0) {
ctx.globalCompositeOperation = "source-atop";
ctx.fillStyle = "rgba(255,255,255," + fl + ")";
ctx.fillRect(0, 0, 64, 64);
ctx.globalCompositeOperation = "source-over";
}
f.sx = f.sx === undefined ? 1 : f.sx + (1 - f.sx) * 0.22;
f.sy = f.sy === undefined ? 1 : f.sy + (1 - f.sy) * 0.22;
f.knock = f.knock === undefined ? 0 : f.knock * 0.8;
if (f.anim === "idle" && f.air > 0) f.air *= 0.78;
const hop = (f.win ? Math.abs(Math.sin(c / 180)) * 8 : 0) + (f.air || 0);
const px = ((f.x + f.knock) / 400) * sw;
const py = ((188 - f.y + hop) / 225) * sh;
const sc = (f.scale || 1) * (wid === 10 ? 1.34 : 1);
f._domEl.style.transform = "translate(" + px.toFixed(1) + "px," + py.toFixed(1) + "px)";
const fp = f.flip && !f.win;
f._domCv.style.transform = "scale(" + ((fp ? -1 : 1) * sc * f.sx) + "," + (sc * f.sy) + ")";
if (!f.pet && f._domHp) {
const dt = Math.min(60, Math.max(0, c - (f.pc === undefined ? c : f.pc)));
f.pc = c;
if (f.lastHp === undefined) f.lastHp = f.hp;
if (f.hp < f.lastHp) f.hit0 = c;
f.lastHp = f.hp;
if (f.dh < f.hp) f.dh = f.hp;
else if (c - f.hit0 > 450) f.dh += (f.hp - f.dh) * Math.min(1, dt / 260);
if (f.dh - f.hp < 0.05) f.dh = f.hp;
f._domHp.style.width = Math.max(0, Math.min(100, (f.hp / Math.max(1, f.max)) * 100)).toFixed(1) + "%";
f._domDh.style.width = Math.max(0, Math.min(100, (f.dh / Math.max(1, f.max)) * 100)).toFixed(1) + "%";
}
});
const fxCv = $("#cv-afk-fx");
if (fxCv) {
const ctx = fxCv.getContext("2d");
renderer.drawArena(ctx, { V: D.V, P: [], fl: D.fl, vfx: D.vfx, proj: D.proj, pan: -1, fade: 0, shake0: -1e6, preview: true }, c);
}
},
/* ---- HUD & Barre rapide (Presets + Aperçu adversaire) ---- */
renderQuickBar() {
if (!this.stage) return;
if (!this.quickBarEl) {
const bar = document.createElement("div");
bar.id = "afk-quickbar";
Object.assign(bar.style, {
position: "absolute", right: "12px", top: "52px", zIndex: "25",
display: "flex", flexDirection: "column", gap: "4px", padding: "6px 8px",
background: "rgba(10,14,22,0.84)", border: "1px solid rgba(201,149,58,0.5)",
borderRadius: "6px", font: "11px monospace", color: "#e2e8f0"
});
this.stage.appendChild(bar);
this.quickBarEl = bar;
}
const opp = this.duel && this.duel.opp;
const setInfo = opp && opp._enemySet && DataEngine.GEAR_SETS[opp._enemySet];
    const scoutHtml = opp
      ? '<div style="color:#ffd35c">👁️ ' + opp.name + (setInfo ? ' · ' + setInfo.icon + ' ' + setInfo.name : '') + '</div>'
      : "";
const act = (GameState.presets && GameState.presets.actif) || 1;
const btns = [1, 2, 3].map(n => {
const has = !!(GameState.presets && GameState.presets[n]);
const active = act === n;
return '<button type="button" data-preset="' + n + '" ' + (has ? '' : 'disabled') +
  ' style="padding:2px 6px;border-radius:4px;border:1px solid ' + (active ? '#ffd35c' : '#475569') +
  ';background:' + (active ? '#3b280e' : '#0f172a') + ';color:' + (has ? '#fff' : '#64748b') +
  ';font:bold 11px monospace;cursor:' + (has ? 'pointer' : 'default') + '">P' + n + '</button>';
}).join("");
this.quickBarEl.innerHTML = scoutHtml + '<div style="display:flex;align-items:center;gap:4px"><span>Presets :</span>' + btns + '</div>';
this.quickBarEl.querySelectorAll("[data-preset]").forEach(btn => {
btn.onclick = e => {
e.stopPropagation();
const n = +btn.dataset.preset;
if (GameState.chargerPreset(n)) toast("Preset " + n + " équipé !");
};
});
},
hud() {
const b = S.cur;
if (!b) return;
this.setBg(b);
this.renderQuickBar();
const w = this.wave || b.afkWave || 1;
const modeTag = this.pushMode
? '<span style="color:#4ade80;font-size:11px">⚔️ Ascension</span>'
: '<span style="color:#fbbf24;font-size:11px">🌾 Farm (Or & XP)</span> <button type="button" id="btn-afk-retry" class="fx-mini" style="margin-left:6px;padding:1px 6px;font-size:10px;cursor:pointer">⚔️ Retenter Étage ' + Math.max(this.wallWave, b.afkWaveMax || w + 1) + '</button>';
const waveEl = $("#afk-wave");
if (waveEl) waveEl.innerHTML = 'Étage ' + w + ' <small style="opacity:.75">(Record : ' + this.maxFloor(b) + ')</small> · ' + modeTag;
const retryBtn = $("#btn-afk-retry");
if (retryBtn) retryBtn.onclick = e => { e.stopPropagation(); this.retryWall(); };
const g = this.pending(b);
const xp = this.pendingXp(b);
const maxG = this.CAP_SEC * this.RATE;
const countEl = $("#afk-count");
if (countEl) countEl.textContent = g.toLocaleString("fr-FR") + " Or · " + xp.toLocaleString("fr-FR") + " XP";
const barEl = $("#afk-bar");
if (barEl) barEl.style.width = (g > 0 ? Math.max(1.5, (g / maxG) * 100) : 0) + "%";
const capEl = $("#afk-capacity");
if (capEl) capEl.textContent = "Capacité : " + (this.CAP_SEC / 3600) + " h";
const rateEl = $("#afk-rate");
if (rateEl) rateEl.textContent = "+" + this.RATE.toLocaleString("fr-FR") + " Or/s · +" + this.XP_RATE.toLocaleString("fr-FR") + " XP/s";
const pwEl = $("#afk-power");
if (pwEl) pwEl.textContent = "⚔️ Puissance : " + calculerPuissance(b).toLocaleString("fr-FR");
const bt = $("#btn-harvest");
if (bt) {
bt.disabled = g <= 0 && xp <= 0;
bt.classList.toggle("ready", g > 0 || xp > 0);
}
}
};
/* ---------- Configuration des panneaux boss ---------- */
const BOSS_MODES = {
armes:      { label: "Boss des Armes",      cls: "mode-armes",      bgImage: "", sprite: "", name: "Boss des Armes",      energyCost: 1 },
parchemins: { label: "Boss des Parchemins", cls: "mode-parchemins", bgImage: "", sprite: "", name: "Boss des Parchemins", energyCost: 1 },
familier:   { label: "Boss du Familier",    cls: "mode-familier",   bgImage: "", sprite: "", name: "Boss du Familier",    energyCost: 1 },
mondial:    { label: "Boss Mondial",        cls: "mode-mondial",    bgImage: "", sprite: "", name: "Boss Mondial",        energyCost: 1 }
};
const BossModes = {
cur: null,
previewBrute: null,
previewBound: false,
prepare(k) {
const c = BOSS_MODES[k];
if (!c) return;
this.cur = k;
const el = $("#g-boss");
el.className = "pane ov " + c.cls;
el.style.setProperty("--ov-img", c.bgImage ? "url('" + new URL(encodeURI(c.bgImage), document.baseURI).href + "')" : "none");
$("#boss-title").textContent = c.label;
const sp = $("#boss-sprite");
if (!this.previewBound) {
renderer.bind(sp, () => this.previewBrute);
this.previewBound = true;
}
this.showBoss(k, Raids.sel[k] || 1);
},
showBoss(k, level = 1) {
const def = k === "mondial" ? Raids.bossMondial() : Raids.bossPalier(k, level);
const key = "ennemi_" + def.id;
if (!DataEngine.SPRITES[key]) {
DataEngine.SPRITES[key] = { portrait: def.portrait || "", sprite: def.png || "", planches: def.planches || [] };
}
this.previewBrute = {
id: key, name: def.nom, species: "Mutant", hue: def.hue, sprite: key,
stats: { hp: 1, str: 1, agi: 1, spd: 1 }, level, weapons: [], gear: [], skills: [],
companion: null, placeholder: "boss", scale: def.scale || 1,
animationSet: def.animationSet || "bossPreview", portraitBounds: def.portraitBounds, previewAnimations: def.previewAnimations
};
$("#boss-name").textContent = def.nom;
},
start() {},
stop() {}
};
OV.reg.bossArmes.onClose = OV.reg.bossParchemins.onClose = OV.reg.bossFamilier.onClose = OV.reg.bossMondial.onClose = () => BossModes.stop();
OV.reg.bossArmes.onOpen = () => Raids.ouvrir("armes");
OV.reg.bossParchemins.onOpen = () => Raids.ouvrir("parchemins");
OV.reg.bossFamilier.onOpen = () => Raids.ouvrir("familier");
OV.reg.bossMondial.onOpen = () => Raids.ouvrir("mondial");