"use strict";
const StatsUI = {
  STAT_CAP: 250,
  MAX_ACHATS_STATS: 100,
  STATS_LAYOUT_KEY: "arene_stats_quad_layout_v1",
  _ok: false,
  _statsEditing: false,
  _statsStore: null,
  STATS_PRESETS: {
    global: {
      plate:  { quad: [[13.24, 13.28], [30.09, 16.69], [29.25, 36.67], [12.2, 34.96]], baseW: 250, baseH: 88 },
      crt:    { quad: [[72.0, 9.68], [95.36, 6.88], [95.62, 42.09], [71.87, 42.46]], baseW: 340, baseH: 230 },
      power:  { quad: [[41.02, 73.53], [59.11, 73.28], [63.99, 88.51], [36.27, 88.15]], baseW: 260, baseH: 68 },
      train:  { quad: [[68.42, 64.2], [95.09, 72.85], [95.29, 89.06], [68.29, 75.66]], baseW: 360, baseH: 108 },
      totem:  { quad: [[17.37, 53.67], [27.59, 53.91], [27.45, 77.91], [17.43, 77.79]], baseW: 160, baseH: 260 },
      avatar: { x: 50.11, y: 52.77, size: 17.5 }
    },
    samourai: {
      plate:  { quad: [[13.63, 15.29], [29.5, 17.97], [28.85, 34.78], [13.04, 33.2]], baseW: 250, baseH: 88 },
      crt:    { quad: [[73.04, 12.97], [95.42, 9.2], [95.42, 42.09], [73.3, 41.48]], baseW: 340, baseH: 230 },
      power:  { quad: [[43.43, 76.32], [57.81, 76.32], [60.02, 88.26], [41.41, 87.77]], baseW: 260, baseH: 68 },
      train:  { quad: [[69.26, 64.75], [96.2, 73.4], [95.81, 88.63], [69.39, 76.2]], baseW: 360, baseH: 108 },
      totem:  { quad: [[17.73, 53.79], [27.88, 54.03], [27.81, 78.52], [17.53, 78.15]], baseW: 160, baseH: 260 },
      avatar: { x: 50.44, y: 53.26, size: 15.97 }
    },
    human: {
      plate:  { quad: [[14.21, 15.78], [29.05, 18.21], [28.01, 34.54], [13.17, 33.08]], baseW: 250, baseH: 88 },
      crt:    { quad: [[71.99, 10.05], [95.42, 7.13], [95.68, 42.46], [71.86, 42.21]], baseW: 340, baseH: 230 },
      power:  { quad: [[40.4, 74.64], [59.87, 75.24], [63.18, 85.81], [37.49, 85.46]], baseW: 260, baseH: 68 },
      train:  { quad: [[68.61, 64.27], [94.83, 72.67], [94.9, 89.0], [68.42, 75.84]], baseW: 360, baseH: 108 },
      totem:  { quad: [[17.47, 55.25], [27.88, 55.62], [27.81, 78.4], [17.47, 78.03]], baseW: 160, baseH: 260 },
      avatar: { x: 50.11, y: 53.26, size: 15.97 }
    }
  },
  Q(s){ return document.querySelector(s); },

  /* ---------- ENTRAÎNEMENT MUTAGÈNE ---------- */
  coutEntrainement(){ return Math.floor(40 * Math.pow(1.08, GameState.achatsStats)); },
  entrainementMax(){ return GameState.achatsStats >= this.MAX_ACHATS_STATS; },
  entrainer(){
    const b = S.cur; if (!b) return;
    if (this.entrainementMax()) { toast("Entraînement maximum atteint (" + this.MAX_ACHATS_STATS + " achats)."); return; }
    const ouvertes = ["hp", "str", "agi", "spd"].filter(k => b.stats[k] < this.STAT_CAP);
    if (!ouvertes.length) { toast("Toutes les stats sont au maximum (" + this.STAT_CAP + ")."); return; }
    const cout = this.coutEntrainement();
    if (!depenserRessource("or", cout)) { toast("Or insuffisant (" + cout + " requis)."); return; }
    const k = DataEngine.pick(ouvertes), nom = { hp: "Vie", str: "Force", agi: "Agilité", spd: "Rapidité" }[k];
    b.stats[k]++; GameState.achatsStats++;
    this.lancerAnimTrain(k);
    persist(); toast("Entraînement : +1 " + nom + " !");
  },
  initTrainRoom(t, b){
    if (!t.dataset.ready) {
      t.dataset.ready = "1";
      t.innerHTML = `<div class="train-hud"><button type="button" id="cs-train-buy" class="train-sign" title="Entraînement mutagène (+1 stat aléatoire)"></button><span id="cs-stats-gold" class="train-gold"></span></div><canvas id="cv-stats-train" width="520" height="140"></canvas>`;
      t.querySelector("#cs-train-buy").onclick = e => { e.stopPropagation(); if (!this._statsEditing) this.entrainer(); };
      this._trainQ = []; this._trainRun = null; this._trainHit = null;
      const loop = now => {
        const cv = this.Q("#cv-stats-train");
        if (cv && cv.offsetParent && S.cur) this.drawTrainRoom(cv.getContext("2d"), S.cur, now);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  },
  lancerAnimTrain(stat){
    if (!this._trainQ) this._trainQ = [];
    this._trainQ.push(stat);
  },
  drawTrainRoom(ctx, b, now){
    const W = 520, H = 140, FLOOR_Y = 134;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    const STATIONS = [
      { key: "str", x: 195, icon: "💪", col: "#ff6b6b" },
      { key: "hp",  x: 280, icon: "❤️", col: "#ff922b" },
      { key: "agi", x: 365, icon: "🌀", col: "#4ff0e6" },
      { key: "spd", x: 450, icon: "⚡", col: "#ffe066" }
    ];
    const DUMMY_X = { str: 195, hp: 280, agi: 365, spd: 450 }, HOME_X = 68, REACH = 38;

    STATIONS.forEach(st => {
      const hitNow = this._trainHit && this._trainHit.st === st.key && (now - this._trainHit.t0 < 320);
      const wobble = hitNow ? Math.sin((now - this._trainHit.t0) * 0.06) * 5 : 0;
      ctx.save();
      ctx.translate(st.x + wobble, FLOOR_Y);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(-16, -4, 32, 6);
      ctx.fillStyle = "#3a4552";
      ctx.fillRect(-3, -44, 6, 40);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.strokeStyle = hitNow ? "#fff" : st.col;
      ctx.lineWidth = 2;
      ctx.fillRect(-14, -68, 28, 26);
      ctx.strokeRect(-14, -68, 28, 26);
      ctx.font = "15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(st.icon, 0, -55);
      ctx.restore();
    });

    let r = this._trainRun;
    if (!r && this._trainQ && this._trainQ.length) {
      const st = this._trainQ.shift();
      r = this._trainRun = { st, phase: "to", x: HOME_X, tx: DUMMY_X[st] || 280, t0: now };
    }
    let px = HOME_X, flip = false, anim = "idle";
    if (r) {
      const dt = Math.min(50, now - (r.last || now)); r.last = now;
      if (r.phase === "to") {
        anim = "run"; flip = false; r.x += dt * 0.34;
        if (r.x >= r.tx - REACH) { r.x = r.tx - REACH; r.phase = "hit"; r.t0 = now; this._trainHit = { st: r.st, x: r.tx, t0: now }; }
      } else if (r.phase === "hit") {
        anim = "atk"; flip = false;
        if (now - r.t0 > 260) {
          if (this._trainQ.length) {
            const st = this._trainQ.shift();
            r.st = st; r.tx = DUMMY_X[st] || 280; r.phase = r.x <= r.tx - REACH ? "to" : "back";
          } else { r.phase = "back"; }
        }
      } else if (r.phase === "back") {
        anim = "run"; flip = true; r.x -= dt * 0.34;
        if (r.x <= HOME_X) { this._trainRun = null; r = null; }
      }
      if (r) px = r.x;
    }

    if (typeof renderer !== "undefined" && renderer.drawBrute) {
      const off = this._trainOff || (this._trainOff = Object.assign(document.createElement("canvas"), { width: 64, height: 64 }));
      renderer.drawBrute(off.getContext("2d"), b, now, anim);
      ctx.save();
      ctx.translate(Math.round(px - 36), FLOOR_Y - 70);
      if (flip) { ctx.translate(72, 0); ctx.scale(-1, 1); }
      ctx.drawImage(off, 0, 0, 64, 64, 0, 0, 72, 72);
      ctx.restore();
    }

    if (this._trainHit && now - this._trainHit.t0 < 750) {
      const p = (now - this._trainHit.t0) / 750;
      const nom = { str: "+1 FORCE", hp: "+1 VIE", agi: "+1 AGILITÉ", spd: "+1 RAPIDITÉ" }[this._trainHit.st] || "+1";
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
      ctx.strokeText(nom, this._trainHit.x, 42 - p * 22);
      ctx.fillStyle = "#7ffcf4";
      ctx.fillText(nom, this._trainHit.x, 42 - p * 22);
      ctx.restore();
    }
  },

  /* ---------- RENDU ---------- */
  render(){
    const b = S.cur; if (!b || !this.Q("#cs-train")) return;
    const stStage = this.Q("#cs-stats-stage");
    if (stStage) {
      const k = DataEngine.BRAWLERS.find(n => String(b.sprite || "").toLowerCase().startsWith(n)) || "general";
      stStage.style.backgroundImage = `url("${encodeURI(assetPath.statsBg(k))}")`;
    }
    const GS = GameState, R = GS.ressources;
    const cout = this.coutEntrainement(), t = this.Q("#cs-train"), maxA = this.entrainementMax();
    this.initTrainRoom(t, b);
    const sign = this.Q("#cs-train-buy");
    if (sign) {
      sign.innerHTML = maxA
        ? `MAX (${GS.achatsStats}/${this.MAX_ACHATS_STATS})`
        : `💰 ${cout.toLocaleString("fr-FR")} · ${GS.achatsStats}/${this.MAX_ACHATS_STATS}`;
      sign.classList.toggle("disabled", maxA || R.or < cout);
    }
    const statsGold = this.Q("#cs-stats-gold");
    if (statsGold) statsGold.textContent = "🪙 " + R.or.toLocaleString("fr-FR") + " Or";

    const pw = this.Q("#cs-power");
    if (pw) {
      const valStr = (typeof calculerPuissance === "function" ? calculerPuissance() : 0).toLocaleString("fr-FR");
      const fs = valStr.length >= 9 ? 24 : valStr.length >= 7 ? 27 : 31;
      pw.innerHTML = `<svg viewBox="0 0 260 68" aria-label="${valStr}"><defs><path id="cs-ped-arc" d="M 16,44 Q 130,55 244,44"/></defs><text font-size="${fs}"><textPath href="#cs-ped-arc" startOffset="50%" text-anchor="middle">${valStr}</textPath></text></svg>`;
    }

    const TIER_COLS = ["#ffffff", "#ffe066", "#ff922b", "#ff5a36", "#ff2442"];
    this.Q("#cs-stats-crt")?.querySelectorAll(".fx-stat").forEach(row => {
      const val = parseInt(row.querySelector(".fx-sl span:last-child")?.textContent || "0", 10) || 0;
      const segBox = row.querySelector(".seg");
      if (!segBox) return;
      const tier = Math.floor(Math.max(0, val - 1) / 10);
      const rem = val === 0 ? 0 : ((val - 1) % 10) + 1;
      const topCol = TIER_COLS[Math.min(tier, TIER_COLS.length - 1)];
      const baseCol = tier > 0 ? TIER_COLS[Math.min(tier - 1, TIER_COLS.length - 1)] : null;
      segBox.innerHTML = Array.from({ length: 10 }, (_, idx) => {
        const col = idx < rem ? topCol : baseCol;
        return col
          ? `<i class="on" style="background:${col} !important;border-color:${col} !important;box-shadow:0 0 6px ${col}"></i>`
          : `<i></i>`;
      }).join("");
    });
    this.applyStatsLayout();
    if (this._syncStatsDev) this._syncStatsDev();
  },

/* ---------- DÉMARRAGE ---------- */
init(){
if (this._ok) return; this._ok = true;
const rf = window.renderFiche;
if (typeof rf === "function") {
window.renderFiche = b => { rf(b); StatsUI.render(); };
}
const st = document.createElement("style");
st.textContent = ".fx-panel.fx-hero{position:relative;flex:1;min-height:0;padding:0 !important;overflow:hidden;background:transparent !important;border:none !important;display:flex;align-items:center;justify-content:center}"
+ "#cs-stats-stage{position:relative;height:100%;width:auto;max-width:100%;aspect-ratio:1408/752;background-size:100% 100%;background-repeat:no-repeat;margin:0 auto;overflow:hidden;user-select:none}"
+ "#cs-stats-stage.is-editing [data-st-item]{outline:1.5px dashed #f2b21c !important;background:rgba(242,178,28,.12) !important;cursor:grab !important;z-index:25;touch-action:none}"
+ "#cs-stats-stage.is-editing [data-st-item]:active{cursor:grabbing !important}"
+ "#cs-stats-stage.is-editing [data-st-item]>*{pointer-events:none}"
+ ".cs-quad-dot{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#4ff0e6;border:2px solid #041014;box-shadow:0 0 8px #4ff0e6;cursor:move;z-index:40;touch-action:none}"
+ ".cs-quad-dot.origin{background:#ffb000;box-shadow:0 0 8px #ffb000}"
+ ".cs-quad-dot:hover{transform:scale(1.35);background:#fff}"
+ "#cs-stats-stage .fx-avatar{width:auto;height:auto;background:transparent !important;border:none !important;box-shadow:none !important;display:flex !important;align-items:center;justify-content:center}"
+ "#cs-stats-stage .fx-avatar canvas{width:100% !important;height:100% !important;image-rendering:pixelated;filter:contrast(1.06) saturate(.94) drop-shadow(0 8px 6px rgba(0,0,0,.9)) drop-shadow(0 0 10px rgba(79,240,230,.45))}"
+ "#cs-hero-plate{display:flex !important;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:6px 10px;box-sizing:border-box;background:transparent !important;border:none !important;box-shadow:none !important;text-align:center;z-index:12}"
+ "#cs-hero-plate #fx-name-row{display:inline-flex !important;align-items:center;justify-content:center;gap:6px;width:auto !important;max-width:100%;margin:0 auto !important;padding:0 !important}"
+ "#cs-hero-plate #fx-name{display:inline-block !important;width:auto !important;flex:0 0 auto !important;margin:0 !important;padding:0 !important;font:bold 26px/1 monospace !important;color:#e6fbff !important;text-shadow:0 0 8px rgba(79,240,230,.85),0 0 2px #4ff0e6;letter-spacing:1.8px;white-space:nowrap;text-align:center !important}"
+ "#cs-hero-plate #fx-rename{position:static !important;display:inline-flex !important;align-items:center;justify-content:center;flex:0 0 auto !important;width:auto !important;height:auto !important;min-width:0 !important;min-height:0 !important;margin:0 !important;padding:2px 5px !important;font-size:12px !important;line-height:1 !important;background:rgba(79,240,230,.12) !important;border:1px solid rgba(79,240,230,.45) !important;border-radius:2px;color:#7ffcf4 !important;opacity:.85}"
+ "#cs-hero-plate #fx-rename:hover{opacity:1;background:rgba(79,240,230,.28) !important}"
+ "#cs-hero-plate #fx-tag{display:block !important;width:auto !important;margin:0 auto !important;padding:4px 0 0 0 !important;border-top:1px solid rgba(79,240,230,.35);font:bold 12px/1.1 monospace !important;color:#7ffcf4 !important;text-shadow:0 0 6px rgba(79,240,230,.75);letter-spacing:1.3px;text-transform:uppercase;white-space:nowrap;text-align:center !important}"
+ ".cs-pedestal-power{display:flex !important;align-items:center;justify-content:center;background:transparent !important;pointer-events:none;z-index:14;overflow:visible}"
+ "#cs-stats-stage.is-editing .cs-pedestal-power{pointer-events:auto !important}"
+ ".cs-pedestal-power svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 8px rgba(89,255,106,.85)) drop-shadow(0 2px 2px #000)}"
+ ".cs-pedestal-power text{fill:#9dff9e;font-family:monospace;font-weight:bold;letter-spacing:2px}"
+ "@keyframes csTotemSpark{0%{opacity:0;transform:translateY(8px) scale(.6)}35%{opacity:1}100%{opacity:0;transform:translateY(-26px) scale(1.15)}}"
+ "#cs-totem{display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:22;background:transparent;border-radius:6px;transition:box-shadow .2s,background .2s}"
+ "#cs-totem .cs-totem-sparks{position:absolute;inset:0;pointer-events:none;overflow:visible}"
+ "#cs-totem .cs-totem-sparks i{position:absolute;width:4px;height:4px;border-radius:50%;background:#ff6b6b;box-shadow:0 0 8px #ff3b3b,0 0 14px #ffb000;opacity:0}"
+ "#cs-totem .cs-totem-sparks i:nth-child(1){left:24%;top:32%;animation-delay:0s}"
+ "#cs-totem .cs-totem-sparks i:nth-child(2){left:72%;top:44%;animation-delay:.35s}"
+ "#cs-totem .cs-totem-sparks i:nth-child(3){left:38%;top:62%;animation-delay:.7s}"
+ "#cs-totem .cs-totem-sparks i:nth-child(4){left:64%;top:24%;animation-delay:1.05s}"
+ "#cs-stats-stage:not(.is-editing) #cs-totem:hover{background:radial-gradient(ellipse at center,rgba(255,80,70,.16) 0%,transparent 72%);box-shadow:inset 0 0 18px rgba(255,90,70,.28),0 0 14px rgba(255,140,60,.22)}"
+ "#cs-stats-stage:not(.is-editing) #cs-totem:hover .cs-totem-sparks i{animation:csTotemSpark 1.4s ease-out infinite}"
+ "#cs-stats-stage:not(.is-editing) #cs-totem.sparking{background:radial-gradient(ellipse at center,rgba(255,180,90,.38) 0%,transparent 75%);box-shadow:0 0 24px rgba(255,90,70,.65)}"
+ "#cs-stats-stage:not(.is-editing) #cs-totem.sparking .cs-totem-sparks i{animation:csTotemSpark .55s ease-out 1}"
+ "#cs-stats-stage.is-editing #cs-totem::after{content:'🗑️ TOTEM';font:bold 14px monospace;color:#ffd24d;text-shadow:0 1px 3px #000;pointer-events:none}"
+ "#cs-stats-crt{display:flex !important;flex-direction:column;justify-content:space-between;gap:8px;padding:10px 14px;box-sizing:border-box;background:transparent !important;border:none !important;box-shadow:none !important;color:#e6fbff;font:12px/1.2 monospace !important;overflow:hidden;z-index:10}"
+ "#cs-stats-crt .fx-vitals{display:flex !important;align-items:center;justify-content:space-between;gap:10px;margin:0 !important;padding:0 0 6px 0;background:transparent !important;border:none !important;border-bottom:1px solid rgba(79,240,230,.32) !important}"
+ "#cs-stats-crt .fx-lv{flex:1;display:flex !important;flex-direction:row-reverse;align-items:center;gap:10px;margin:0 !important}"
+ "#cs-stats-crt .fx-lvt{font:bold 13px/1.1 monospace !important;color:#7ffcf4 !important;text-shadow:0 0 6px rgba(79,240,230,.85);white-space:nowrap}"
+ "#cs-stats-crt .fx-xp{position:relative;flex:1;height:12px !important;background:transparent !important;border:1px solid rgba(79,240,230,.4);border-radius:1px}"
+ "#cs-stats-crt .fx-xp i{display:block;height:100%;background:linear-gradient(90deg,#25b8c4,#7ffcf4);box-shadow:0 0 6px #4ff0e6}"
+ "#cs-stats-crt .fx-xp span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9.5px !important;color:#fff;text-shadow:0 1px 2px #000}"
+ "#cs-stats-crt .fx-pv{display:none !important}"
+ "#cs-stats-crt .fx-stats{display:flex !important;flex-direction:column;justify-content:space-between;gap:8px;margin:0 !important;flex:1;min-height:0}"
+ "#cs-stats-crt .fx-stat{display:grid !important;grid-template-columns:82px 1fr 54px;align-items:center;gap:8px;padding:0 !important;min-height:0 !important;background:transparent !important;border:none !important;box-shadow:none !important}"
+ "#cs-stats-crt .fx-sl{display:contents !important;font:bold 12px/1.1 monospace !important;color:#ffffff;text-shadow:0 1px 2px #000}"
+ "#cs-stats-crt .fx-sl span:first-child{grid-column:1;white-space:nowrap;text-align:left;color:#ffffff}"
+ "#cs-stats-crt .fx-sl span:last-child{grid-column:3;white-space:nowrap;text-align:right;color:#ffffff}"
+ "#cs-stats-crt .seg{grid-column:2;grid-row:1;display:grid !important;grid-template-columns:repeat(10,1fr);gap:3px;height:10px !important;width:100%}"
+ "#cs-stats-crt .seg i{display:block;width:100%;height:100%;box-sizing:border-box;background:transparent !important;border:1px solid rgba(79,240,230,.35);border-radius:1px}"
+ ".cs-train-track{position:relative;display:flex;flex-direction:column;justify-content:flex-end;cursor:pointer;overflow:hidden;background:transparent !important;border:none !important;box-shadow:none !important}"
+ ".cs-train-track canvas{width:100% !important;height:100% !important;display:block;background:transparent !important;border:none !important;box-shadow:none !important;image-rendering:pixelated}"
+ ".train-hud{position:absolute;top:3px;left:6px;right:6px;display:flex;align-items:center;justify-content:flex-end;gap:6px;z-index:6;pointer-events:none}"
+ "#cs-train-buy{pointer-events:auto;width:auto !important;height:auto !important;min-height:0 !important;padding:2px 7px !important;background:rgba(4,16,20,.88);border:1px solid rgba(79,240,230,.65);border-radius:2px;color:#7ffcf4;font:bold clamp(7.5px,0.72vw,9.5px)/1.1 monospace !important;letter-spacing:.4px;cursor:pointer;box-shadow:0 0 8px rgba(79,240,230,.35);white-space:nowrap}"
+ "#cs-train-buy:hover:not(.disabled){background:rgba(16,48,56,.95);color:#fff;border-color:#fff;box-shadow:0 0 12px rgba(79,240,230,.8)}"
+ "#cs-train-buy.disabled{opacity:.55;cursor:not-allowed;box-shadow:none}"
+ ".train-gold{font:bold clamp(7.5px,0.72vw,9.5px)/1.1 monospace !important;color:#ffd77a;text-shadow:0 1px 2px #000;white-space:nowrap}"
+ ".fx-panel.fx-hero .csd-corner-bar{position:absolute;right:12px;bottom:12px;z-index:30;display:flex;gap:5px;align-items:center}"
+ ".fx-panel.fx-hero .csd-corner-btn{width:auto !important;height:auto !important;min-height:0 !important;padding:5px 10px !important;font-size:11px !important;line-height:1.2 !important}"
+ ".fx-panel.fx-hero .csd-corner-mini{width:auto !important;height:auto !important;min-height:0 !important;padding:5px 8px !important;font-size:11px !important;line-height:1.2 !important}";
    document.head.appendChild(st);

    const hero = this.Q(".fx-panel.fx-hero");
    if (hero) {
      const k0 = (S.cur && DataEngine.BRAWLERS.find(n => String(S.cur.sprite || "").toLowerCase().startsWith(n))) || "general";
      const stStage = document.createElement("div");
      stStage.id = "cs-stats-stage";
      stStage.style.backgroundImage = `url("${encodeURI(assetPath.statsBg(k0))}")`;

      const av = hero.querySelector(".fx-avatar");
      if (av) { av.dataset.stItem = "avatar"; stStage.appendChild(av); }

      const oldActs = hero.querySelector(".fx-hero-actions"), delBtn = oldActs && oldActs.querySelector("#btn-reset-save");
      const totem = document.createElement("div");
      totem.id = "cs-totem";
      totem.dataset.stItem = "totem";
      totem.title = "Supprimer cette brute";
      totem.innerHTML = '<span class="cs-totem-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
      if (delBtn) {
        delBtn.style.display = "none";
        stStage.appendChild(delBtn);
        totem.onclick = e => {
          e.stopPropagation();
          if (this._statsEditing) return;
          totem.classList.remove("sparking");
          void totem.offsetWidth;
          totem.classList.add("sparking");
          delBtn.click();
        };
      }
      if (oldActs) oldActs.remove();
      stStage.appendChild(totem);

      const nameRow = hero.querySelector("#fx-name-row"), tagEl = hero.querySelector("#fx-tag");
      const plate = document.createElement("div");
      plate.id = "cs-hero-plate";
      plate.dataset.stItem = "plate";
      if (nameRow) plate.appendChild(nameRow);
      if (tagEl) plate.appendChild(tagEl);
      stStage.appendChild(plate);

      const crt = document.createElement("div");
      crt.id = "cs-stats-crt";
      crt.dataset.stItem = "crt";
      const vitals = hero.querySelector(".fx-vitals"), statsBox = this.Q("#fx-stats");
      if (vitals) crt.appendChild(vitals);
      if (statsBox) crt.appendChild(statsBox);
      stStage.appendChild(crt);

      const pw = document.createElement("div");
      pw.id = "cs-power";
      pw.className = "cs-pedestal-power";
      pw.dataset.stItem = "power";
      stStage.appendChild(pw);

      const tb = document.createElement("div");
      tb.id = "cs-train";
      tb.className = "cs-train-track";
      tb.dataset.stItem = "train";
      tb.onclick = e => { e.stopPropagation(); if (!this._statsEditing) this.entrainer(); };
      stStage.appendChild(tb);

      hero.innerHTML = "";
      hero.appendChild(stStage);
      this.applyStatsLayout();
      this.initStatsDevUI();
    }
    this.render();
  },

  /* ---------- MATRICES 3D & ÉDITEUR DEV ---------- */
  getStatsCharKey(){
    const b = S.cur;
    return (b && DataEngine.BRAWLERS.find(n => String(b.sprite || "").toLowerCase().startsWith(n))) || "general";
  },
  loadStatsStore(){
    if (this._statsStore) return this._statsStore;
    const base = JSON.parse(JSON.stringify(this.STATS_PRESETS));
    try {
      const saved = JSON.parse(localStorage.getItem(this.STATS_LAYOUT_KEY) || "null");
      if (saved && typeof saved === "object") {
        Object.keys(saved).forEach(k => {
          base[k] = Object.assign(base[k] || {}, saved[k]);
        });
      }
    } catch (_) {}
    this._statsStore = base;
    return base;
  },
  getStatsLayoutFor(charKey){
    const store = this.loadStatsStore();
    const g = JSON.parse(JSON.stringify(store.global));
    const ov = store[charKey];
    if (ov) {
      Object.keys(ov).forEach(id => {
        if (!g[id] || !ov[id]) return;
        if (g[id].quad && !ov[id].quad) return;
        g[id] = JSON.parse(JSON.stringify(ov[id]));
      });
    }
    return g;
  },
  saveStatsOverride(charKey, id, data){
    const store = this.loadStatsStore();
    if (!store[charKey]) store[charKey] = {};
    store[charKey][id] = JSON.parse(JSON.stringify(data));
    try { localStorage.setItem(this.STATS_LAYOUT_KEY, JSON.stringify(store)); } catch (_) {}
  },
  computeMatrix3d(w, h, pts){
    const src = [[0, 0], [w, 0], [w, h], [0, h]];
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [X, Y] = pts[i];
      A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
      A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
    }
    const n = 8, M = A.map((r, i) => r.concat(b[i]));
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      [M[c], M[piv]] = [M[piv], M[c]];
      const div = M[c][c] || 1e-9;
      for (let j = c; j <= n; j++) M[c][j] /= div;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c];
        for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
      }
    }
    const H = M.map(r => r[n]);
    return `matrix3d(${H[0]},${H[3]},0,${H[6]}, ${H[1]},${H[4]},0,${H[7]}, 0,0,1,0, ${H[2]},${H[5]},0,1)`;
  },
  applyStatsItemPos(el, id, cfg, stage){
    const sw = (stage && stage.clientWidth) || 800;
    const sh = (stage && stage.clientHeight) || 427;
    el.style.position = "absolute";
    if (cfg.quad) {
      const bw = cfg.baseW || 300, bh = cfg.baseH || 150;
      const pts = cfg.quad.map(([px, py]) => [(px / 100) * sw, (py / 100) * sh]);
      el.style.setProperty("left", "0px", "important");
      el.style.setProperty("top", "0px", "important");
      el.style.setProperty("right", "auto", "important");
      el.style.setProperty("bottom", "auto", "important");
      el.style.setProperty("width", bw + "px", "important");
      el.style.setProperty("height", bh + "px", "important");
      el.style.setProperty("transform-origin", "0 0", "important");
      el.style.setProperty("transform", this.computeMatrix3d(bw, bh, pts), "important");
    } else {
      el.style.left = cfg.x + "%";
      el.style.top = cfg.y + "%";
      el.style.transformOrigin = "50% 50%";
      if (id === "avatar") {
        el.style.transform = "translate(-50%,-50%)";
        el.style.width = cfg.size + "%";
        el.style.aspectRatio = "1 / 1";
        el.style.height = "auto";
      } else {
        const sc = Math.max(0.5, (cfg.size || 10) / 10);
        el.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(2)})`;
        el.style.width = "auto";
        el.style.height = "auto";
      }
    }
  },
  renderStatsHandles(){
    const stage = this.Q("#cs-stats-stage"); if (!stage) return;
    stage.querySelectorAll(".cs-quad-dot").forEach(d => d.remove());
    if (!this._statsEditing) return;
    const charKey = this.getStatsCharKey();
    const layout = this.getStatsLayoutFor(charKey);
    Object.entries(layout).forEach(([id, cfg]) => {
      if (!cfg.quad) return;
      cfg.quad.forEach(([px, py], idx) => {
        const dot = document.createElement("div");
        dot.className = "cs-quad-dot" + (idx === 0 ? " origin" : "");
        dot.dataset.qid = id;
        dot.dataset.qidx = String(idx);
        dot.title = `${id} · coin ${idx + 1} (${px.toFixed(1)}%, ${py.toFixed(1)}%)`;
        dot.style.left = px + "%";
        dot.style.top = py + "%";
        stage.appendChild(dot);
      });
    });
  },
  applyStatsLayout(){
    const stage = this.Q("#cs-stats-stage"); if (!stage) return;
    const layout = this.getStatsLayoutFor(this.getStatsCharKey());
    stage.querySelectorAll("[data-st-item]").forEach(el => {
      const id = el.dataset.stItem;
      if (layout[id]) this.applyStatsItemPos(el, id, layout[id], stage);
    });
    if (this._statsEditing) this.renderStatsHandles();
  },
  initStatsDevUI(){
    const stage = this.Q("#cs-stats-stage"); if (!stage) return;
    const host = stage.closest(".fx-panel.fx-hero") || stage;
    const isDev = () => !!document.getElementById("devbox") || !!GameState.illimite || /[?&]dev\b/.test(location.search);
    const setEdit = on => {
      this._statsEditing = on;
      stage.classList.toggle("is-editing", on);
      const btn = host.querySelector("#std-edit");
      if (btn) btn.textContent = on ? "Terminer le placement" : "ÉDITER LES STATS";
      this.renderStatsHandles();
    };

    if (!host.querySelector("#std-corner-bar")) {
      const bar = document.createElement("div");
      bar.id = "std-corner-bar";
      bar.className = "csd-corner-bar";
      bar.innerHTML = `<button type="button" id="std-copy" class="fx-btn csd-corner-mini" title="Copier JSON (global + personnages)">📋</button>`
        + `<button type="button" id="std-reset" class="fx-btn csd-corner-mini" title="Réinitialiser ce personnage">↺</button>`
        + `<button type="button" id="std-edit" class="fx-btn csd-corner-btn">ÉDITER LES STATS</button>`;
      host.appendChild(bar);

      const syncVis = () => {
        const on = isDev();
        bar.style.display = on ? "flex" : "none";
        if (!on && this._statsEditing) setEdit(false);
      };
      syncVis();
      this._syncStatsDev = syncVis;
      new MutationObserver(syncVis).observe(document.body, { childList: true, subtree: true });

      bar.querySelector("#std-edit").onclick = e => {
        e.stopPropagation();
        setEdit(!this._statsEditing);
        if (!this._statsEditing && typeof toast === "function") toast(`Perspective enregistrée (${this.getStatsCharKey()}) !`);
      };
      bar.querySelector("#std-copy").onclick = e => {
        e.stopPropagation();
        const clean = JSON.stringify(this.loadStatsStore());
        if (navigator.clipboard) navigator.clipboard.writeText(clean);
        console.log("STATS_PRESETS =", clean);
        if (typeof toast === "function") toast("Matrices 3D copiées dans le presse-papiers !");
      };
      bar.querySelector("#std-reset").onclick = e => {
        e.stopPropagation();
        const ck = this.getStatsCharKey();
        const store = this.loadStatsStore();
        delete store[ck];
        if (ck === "general") store.global = JSON.parse(JSON.stringify(this.STATS_PRESETS.global));
        try { localStorage.setItem(this.STATS_LAYOUT_KEY, JSON.stringify(store)); } catch (_) {}
        this.applyStatsLayout();
        if (typeof toast === "function") toast(`Perspective réinitialisée (${ck}).`);
      };
    }

    if (stage.dataset.devBound) return;
    stage.dataset.devBound = "1";
    let drag = null;

    stage.addEventListener("pointerdown", ev => {
      if (!this._statsEditing) return;
      const dot = ev.target.closest(".cs-quad-dot");
      if (dot) {
        ev.preventDefault(); ev.stopPropagation();
        const ck = this.getStatsCharKey(), id = dot.dataset.qid, idx = +dot.dataset.qidx;
        const layout = this.getStatsLayoutFor(ck);
        drag = { kind: "dot", dot, ck, id, idx, cfg: layout[id], pointerId: ev.pointerId };
        try { dot.setPointerCapture(ev.pointerId); } catch (_) {}
        return;
      }
      const el = ev.target.closest("[data-st-item]"); if (!el) return;
      ev.preventDefault(); ev.stopPropagation();
      const ck = this.getStatsCharKey(), id = el.dataset.stItem;
      const layout = this.getStatsLayoutFor(ck), cfg = layout[id];
      if (!cfg) return;
      const rect = stage.getBoundingClientRect();
      const sx = ((ev.clientX - rect.left) / rect.width) * 100;
      const sy = ((ev.clientY - rect.top) / rect.height) * 100;
      drag = { kind: "item", el, ck, id, cfg, sx, sy, orig: JSON.parse(JSON.stringify(cfg)), pointerId: ev.pointerId };
      try { el.setPointerCapture(ev.pointerId); } catch (_) {}
    }, true);

    stage.addEventListener("pointermove", ev => {
      if (!drag || ev.pointerId !== drag.pointerId) return;
      const rect = stage.getBoundingClientRect();
      const px = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      const py = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
      if (drag.kind === "dot") {
        drag.cfg.quad[drag.idx] = [+px.toFixed(2), +py.toFixed(2)];
        drag.dot.style.left = px + "%";
        drag.dot.style.top = py + "%";
        const target = stage.querySelector(`[data-st-item="${drag.id}"]`);
        if (target) this.applyStatsItemPos(target, drag.id, drag.cfg, stage);
      } else {
        const dx = px - drag.sx, dy = py - drag.sy;
        if (drag.cfg.quad) {
          drag.cfg.quad = drag.orig.quad.map(([ox, oy]) => [+(ox + dx).toFixed(2), +(oy + dy).toFixed(2)]);
        } else {
          drag.cfg.x = +(drag.orig.x + dx).toFixed(2);
          drag.cfg.y = +(drag.orig.y + dy).toFixed(2);
        }
        this.applyStatsItemPos(drag.el, drag.id, drag.cfg, stage);
        this.renderStatsHandles();
      }
    }, true);


const endDrag = ev => {
if (!drag || ev.pointerId !== drag.pointerId) return;
this.saveStatsOverride(drag.ck, drag.id, drag.cfg);
drag = null;
};
stage.addEventListener("pointerup", endDrag, true);
stage.addEventListener("pointercancel", endDrag, true);
stage.addEventListener("click", ev => {
if (!this._statsEditing) return;
if (ev.target.closest("[data-st-item]") || ev.target.closest(".cs-quad-dot")) {
ev.preventDefault(); ev.stopImmediatePropagation();
}
}, true);
stage.addEventListener("wheel", ev => {
if (!this._statsEditing) return;
const el = ev.target.closest("[data-st-item]"); if (!el) return;
ev.preventDefault(); ev.stopPropagation();
const ck = this.getStatsCharKey(), id = el.dataset.stItem;
const cfg = this.getStatsLayoutFor(ck)[id]; if (!cfg) return;
const d = (ev.deltaY || ev.deltaX) < 0 ? 1.03 : 0.97;
if (cfg.quad) {
const cx = cfg.quad.reduce((s, p) => s + p[0], 0) / 4;
const cy = cfg.quad.reduce((s, p) => s + p[1], 0) / 4;
cfg.quad = cfg.quad.map(([qx, qy]) => [+(cx + (qx - cx) * d).toFixed(2), +(cy + (qy - cy) * d).toFixed(2)]);
} else {
cfg.size = Math.max(6, Math.min(95, +(cfg.size * d).toFixed(2)));
}
this.applyStatsItemPos(el, id, cfg, stage);
this.renderStatsHandles();
this.saveStatsOverride(ck, id, cfg);
}, { passive: false, capture: true });
if (typeof ResizeObserver !== "undefined") {
new ResizeObserver(() => this.applyStatsLayout()).observe(stage);
}
}
};
