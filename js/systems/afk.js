"use strict";
/* ---------- MODE AFK / IDLE (écran d'accueil par défaut) ---------- */
const AFK_ASSETS={
  BG_IMAGE:"",          // décor de secours si une brute n'a pas d'AFK1
  HERO_SIZE:156,         // taille d'affichage (px) de la brute
  MINION_SPRITES:["inversebrah"] // clés de sprites dans DataEngine.SPRITES (ex: ["inversebrah"])
};
const AFKMode={
  ZONE_ARCHETYPES:[
    { id:"tank",    label:"🛡️ Blindage Lourd", counters:["taureau","ours"] },
    { id:"swarm",   label:"⚡ Essaim Rapide",  counters:["chien","loup","tempete"] },
    { id:"toxic",   label:"☣️ Cuve Toxique",   counters:["aquatique","lezard"] },
    { id:"control", label:"🔮 Contrôle & Ruse", counters:["chimere","spectre","oiseau","felin","serpent","arthropode"] }
  ],
  MILESTONES:[15, 35, 65, 105, 160, 230, 320, 430],
  get RATE(){
    const waveMult = S.cur ? 1 + Math.max(0, (S.cur.afkWaveMax || 1) - 1) * 0.03 : 1;
    const canFull = this.canisterStatus().full ? 1.5 : 1;
    return Math.max(1, Math.round(GameState.tauxOrAfk() * waveMult * canFull));
  },
  CAP_SEC:4*3600,
  COLORS:["#c0392b","#e67e22","#8e44ad","#16a085","#2980b9","#f1c40f"],
  run:false,raf:0,last:0,minions:[],dying:[],wave:1,nextWave:0,W:300,_bgKey:"",bgWidth:1376,bgHeight:768,
  pushMode:true,wallWave:0,riftUntil:0,overdriveUntil:0,overdriveCdUntil:0,_uiTimer:0,
  attacks:[["punch",5],["thrust",5],["overhead",4],["uppercut",1.5],["pierce",1.5],["meteor",1]],
  KILLS:{punch:1,thrust:1,overhead:2,uppercut:1,pierce:2,meteor:3},
  lastAttack:"",recoilDistance:40,heroX:0,heroPhase:"idle",heroAnim:"idle",heroFrom:0,heroTo:0,heroPhaseStart:0,heroDuration:0,attackImpactAt:0,attackImpact:false,
  compX:0,compAnim:"idle",compT0:0,compNextAtk:0,

  canisterStatus(){
    GameState.syncCanister();
    const c = GameState.canister || {};
    const s1 = (c.pvpWins || 0) >= 3;      // Skill actif 200% Puissance 30s
    const s2 = (c.wbKeys || 0) >= 2;       // Clone holographique (+35% Puissance)
    const s3 = (c.expeClears || 0) >= 3;   // Jackpot toutes les 10 vagues
    const s4 = (c.caserneActs || 0) >= 1;  // Arsenal déchaîné (+3% par arme)
    const count = [s1, s2, s3, s4].filter(Boolean).length;
    return { s1, s2, s3, s4, count, full: count === 4, raw: c };
  },
  zoneForWave(w){
    if (w <= 10) return null;
    return this.ZONE_ARCHETYPES[Math.floor((w - 11) / 10) % this.ZONE_ARCHETYPES.length];
  },
  wavePower(w){ return Math.round(1200 * Math.pow(1.075, Math.max(0, w - 1))); },
  effectivePower(b=S.cur, w=this.wave){
    let p = calculerPuissance(b);
    if (!b) return p;
    const now = Date.now(), can = this.canisterStatus();
    const sets = DataEngine.getActiveSetBonuses(b);
    if (sets.some(s => s.set.id === "carnage")) p *= 1.15;
    if (sets.some(s => s.set.id === "cyber")) p *= 1.10;
    const zone = this.zoneForWave(w);
    if (zone && b.companion) {
      const fam = CompanionData.family(b.companion);
      const fk = fam ? fam.key : b.companion.species;
      p *= zone.counters.includes(fk) ? 1.25 : 0.90;
    }
    if (can.s2) p *= 1.35;
    if (can.s4) p *= 1 + (b.weapons ? b.weapons.length : 0) * 0.03;
    if (now < this.riftUntil) p *= 1.25;
    if (now < this.overdriveUntil) p *= 2.0;
    return Math.round(p);
  },
  winChance(w, b=S.cur){
    const req = this.wavePower(w), cur = this.effectivePower(b, w);
    if (!req) return 1;
    const ratio = cur / req;
    if (ratio >= 1.15) return 1;
    if (ratio < 0.72) return 0;
    return Math.max(0.08, Math.min(0.95, (ratio - 0.72) / (1.15 - 0.72)));
  },
  triggerOverdrive(){
    const now = Date.now();
    if (!this.canisterStatus().s1) { toast("Remplissez le segment PvP (3 victoires) du Canister !"); return; }
    if (now < this.overdriveCdUntil) return;
    this.overdriveUntil = now + 30000;
    this.overdriveCdUntil = now + 180000;
    this.spawnFloatingLoot("⚡ SURCHARGE WASS-E : 200% PUISSANCE (30s) !", "#38bdf8");
    toast("⚡ Surcharge Wass-E activée pendant 30 secondes !");
    this.hud();
  },
  centerX(){ return Math.max(0,(this.W-AFK_ASSETS.HERO_SIZE)/2); },
  moveHero(phase,to,speed){
    this.heroFrom=this.heroX;
    this.heroTo=Math.max(0,Math.min(this.W-AFK_ASSETS.HERO_SIZE,to));
    this.heroPhase=phase;
    this.heroAnim=phase==="dash"?"dash":"hit";
    this.heroPhaseStart=renderer.clock;
    this.heroDuration=Math.max(.12,Math.abs(this.heroTo-this.heroFrom)/speed);
  },
  updateHero(c){
    if(this.heroPhase==="recoil") this.heroTo=Math.max(0,this.centerX()-this.recoilDistance);
    if(this.heroPhase==="dash"||this.heroPhase==="recoil"){
      const p=Math.min(1,Math.max(0,(c-this.heroPhaseStart)/(this.heroDuration*1000)));
      const eased=this.heroPhase==="dash"?1-Math.pow(1-p,3):p*p*(3-2*p);
      this.heroX=this.heroFrom+(this.heroTo-this.heroFrom)*eased;
      if(p>=1){ this.heroX=this.heroTo; this.heroPhase="idle"; this.heroAnim="idle"; }
    }
    this.hero.style.setProperty("--hero-x",this.heroX.toFixed(2)+"px");
    this.updateCompanion(c);
    if (this.cloneEl && !this.cloneEl.hidden) {
      this.cloneEl.style.transform = `translateX(${Math.max(0, this.heroX - 38).toFixed(1)}px)`;
      if (this.cloneCtx && S.cur) {
        this.cloneCtx.clearRect(0, 0, this.cloneCv.width, this.cloneCv.height);
        this.drawHero(this.cloneCtx, c);
      }
    }
  },
  updateCompanion(c){
    const box = $("#afk-companion"), comp = S.cur && S.cur.companion;
    if (!box || !comp) return;
    const base = Math.max(0, this.heroX - 58);
    const front = this.minions[0];
    if (!this.compNextAtk) this.compNextAtk = c + 1600;

    if (this.compAnim === "bite") {
      const elapsed = c - this.compT0;
      const p = Math.min(1, elapsed / 480);
      const lunge = Math.sin(p * Math.PI) * 76;
      this.compX = base + lunge;
      if (p >= 1) { this.compAnim = "idle"; this.compT0 = c; this.compNextAtk = c + 1800 + Math.random() * 1400; }
    } else if (this.heroPhase === "dash" || Math.abs(this.compX - base) > 4) {
      if (this.compAnim !== "run") { this.compAnim = "run"; this.compT0 = c; }
      this.compX += (base - this.compX) * 0.22;
      if (Math.abs(this.compX - base) <= 4) { this.compX = base; this.compAnim = "idle"; this.compT0 = c; }
    } else {
      this.compX = base;
      if (this.compAnim !== "idle") { this.compAnim = "idle"; this.compT0 = c; }
      if (front && front.x <= this.centerX() + AFK_ASSETS.HERO_SIZE * 0.65 && c >= this.compNextAtk) {
        this.compAnim = "bite";
        this.compT0 = c;
      }
    }

    box.style.transform = `translateX(${this.compX.toFixed(1)}px)`;
    if (this.compCtx && typeof renderer !== "undefined" && renderer.drawPet) {
      const petDef = { key: comp.species + ":" + (comp.form || 1) };
      const fps = (CanvasRenderer.PET[this.compAnim] || CanvasRenderer.PET.idle).fps || 6;
      const frame = Math.floor((c - this.compT0) * fps / 1000);
      renderer.drawPet(this.compCtx, petDef, this.compAnim, frame);
    }
  },
  syncCompanionAndClone(b=S.cur){
    const box = $("#afk-companion"), img = $("#img-afk-companion");
    const c = b && b.companion;
    if (box) {
      if (!c) { box.hidden = true; box.style.display = "none"; if (img) img.hidden = true; }
      else {
        box.hidden = false;
        Object.assign(box.style, {
          display: "block", position: "absolute", left: "0px", bottom: "18%", top: "auto",
          width: "96px", height: "96px", pointerEvents: "none", zIndex: "6"
        });
        if (img) img.hidden = true;
        if (!this.compCv) {
          const cv = document.createElement("canvas");
          cv.id = "cv-afk-companion";
          cv.width = 64; cv.height = 64;
          cv.style.cssText = "width:100%;height:100%;display:block;image-rendering:pixelated";
          box.appendChild(cv);
          this.compCv = cv;
          this.compCtx = cv.getContext("2d");
          this.compCtx.imageSmoothingEnabled = false;
        }
        if (this.compCtx && typeof renderer !== "undefined" && renderer.drawPet) {
          renderer.drawPet(this.compCtx, { key: c.species + ":" + (c.form || 1) }, this.compAnim || "idle", 0);
        }
      }
    }
    if (this.cloneEl) this.cloneEl.hidden = !this.canisterStatus().s2;
  },
  drawHero(ctx,t){
    const anim=this.heroAnim, elapsed=this.heroPhase==="attack"?Math.max(0,renderer.clock-this.heroPhaseStart):t;
    const A=CanvasRenderer.ANIMS[anim]||CanvasRenderer.ANIMS.idle;
    const frame=this.heroPhase==="attack"?Math.min(3,Math.floor(elapsed*A.fps/1000)):null;
    renderer.drawBrute(ctx,S.cur,elapsed,anim,frame);
  },
  chooseAttack(){
    const choices=this.attacks.filter(([name])=>name!==this.lastAttack);
    const total=choices.reduce((sum,[,weight])=>sum+weight,0);
    let roll=Math.random()*total;
    for(const [name,weight] of choices){ roll-=weight; if(roll<0) return name; }
    return choices[choices.length-1];
  },
  beginAttack(){
    const name = Date.now() < this.overdriveUntil ? "meteor" : this.chooseAttack();
    const duration=4*1000/CanvasRenderer.ANIMS[name].fps;
    this.lastAttack=name; this.heroPhase="attack"; this.heroAnim=name;
    this.heroPhaseStart=renderer.clock; this.heroDuration=duration/1000;
    this.attackImpactAt=duration*.8; this.attackImpact=false;
  },
  resolveAttack(){
    const c=renderer.clock;
    const kills = (this.KILLS[this.lastAttack]||1) + (this.canisterStatus().s2 ? 1 : 0);
    for(let n=kills;n>0&&this.minions.length;n--){
      const f=this.minions.shift(); f.anim="death"; f.t0=c; f.el.classList.add("die"); this.dying.push(f);
    }
    this.attackImpact=true;
    if(!this.minions.length) {
      this.onWaveCleared();
      this.nextWave = Date.now() < this.riftUntil ? 0.35 : 0.7;
    }
    this.moveHero("recoil",this.centerX()-this.recoilDistance,260);
  },
  spawnFloatingLoot(text, color="#ffe66d"){
    if (!this.field) return;
    const x = this.centerX() + AFK_ASSETS.HERO_SIZE * 0.5;
    const y = (this.field.clientHeight || 220) * 0.38;
    const el = document.createElement("div");
    el.textContent = text;
    Object.assign(el.style, {
      position: "absolute", left: x + "px", top: y + "px", transform: "translate(-50%,0)",
      color, font: "bold 12px monospace", textShadow: "0 2px 0 #000", pointerEvents: "none",
      zIndex: "9999", transition: "transform 1.15s ease-out, opacity 1.15s ease-out", opacity: "1", whiteSpace: "nowrap"
    });
    this.field.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transform = "translate(-50%,-46px)";
      el.style.opacity = "0";
    }));
    setTimeout(() => el.remove(), 1200);
  },
  rollWaveLoot(w){
    const b = S.cur; if (!b) return;
    const sets = DataEngine.getActiveSetBonuses(b);
    const lootMult = sets.some(s => s.set.id === "mutant") ? 1.35 : 1;
    const goldGain = Math.max(2, Math.round((4 + w * 2.5) * lootMult));
    GameState.ressources.or += goldGain;

    // Paliers exponentiels garantis pour les Capsules (15, 35, 65, 105, 160...)
    if (this.MILESTONES.includes(w) && (b.afkLastMilestone || 0) < w) {
      b.afkLastMilestone = w;
      GameState.ressources.capsules = (GameState.ressources.capsules || 0) + 1;
      this.spawnFloatingLoot(`+${goldGain} Or · 🥚 CAPSULE PALIER ${w} !`, "#5ef2ff");
      toast(`🎉 Palier Vague ${w} : +1 🥚 Capsule de Stase obtenue !`);
      return;
    }

    // Bonus Jackpot toutes les 10 vagues si le segment Expéditions du Canister est actif
    if (w % 10 === 0 && this.canisterStatus().s3) {
      const jr = Math.random();
      if (jr < 0.05) {
        GameState.ressources.capsules = (GameState.ressources.capsules || 0) + 1;
        this.spawnFloatingLoot(`🎰 JACKPOT V.${w} : +1 🥚 CAPSULE !`, "#5ef2ff");
        toast("🎰 Jackpot Canister : +1 🥚 Capsule de Stase !");
      } else if (jr < 0.20) {
        GameState.ressources.parchemins += 1;
        this.spawnFloatingLoot(`🎰 JACKPOT V.${w} : +1 📜 Parchemin !`, "#c792ea");
      } else if (jr < 0.50) {
        GameState.ressources.nourriture += 2;
        this.spawnFloatingLoot(`🎰 JACKPOT V.${w} : +2 🍖 Nourriture !`, "#9be15d");
      } else {
        const bonusOr = goldGain * 4;
        GameState.ressources.or += bonusOr;
        this.spawnFloatingLoot(`🎰 JACKPOT V.${w} : +${bonusOr + goldGain} Or !`, "#ffd166");
      }
      return;
    }

    // Micro-drop non linéaire (0.4% par vague) + Nourriture / Parchemins
    const r = Math.random();
    if (r < 0.004 * lootMult) {
      GameState.ressources.capsules = (GameState.ressources.capsules || 0) + 1;
 this.spawnFloatingLoot(`+${goldGain} Or · ✨ +1 🥚 CAPSULE RARE !`, "#5ef2ff");
      toast("✨ Coup de chance : +1 🥚 Capsule de Stase trouvée !");
    } else if (r < 0.12 * lootMult) {
      GameState.ressources.nourriture += 1;
      this.spawnFloatingLoot(`+${goldGain} Or · +1 🍖`, "#9be15d");
    } else if (w >= 15 && r < 0.15 * lootMult) {
      GameState.ressources.parchemins += 1;
      this.spawnFloatingLoot(`+${goldGain} Or · +1 📜`, "#c792ea");
    } else {
      this.spawnFloatingLoot(`+${goldGain} Or`, "#ffd166");
    }
  },
  onWaveCleared(){
    const b = S.cur; if (!b) return;
    const w = this.wave;
    const chance = this.winChance(w, b);
    const won = Math.random() < chance;
    if (won) {
      if (chance < 1) this.spawnFloatingLoot("⚡ PERCÉE CHANCEUSE !", "#ff9f1c");
      this.rollWaveLoot(w);
      if (w >= (b.afkWaveMax || 1)) b.afkWaveMax = w + 1;
      if (this.pushMode) {
        this.wave = w + 1;
        b.afkWave = this.wave;
      }
    } else {
      this.wallWave = w;
      this.pushMode = false;
      this.wave = Math.max(1, w - 1);
      b.afkWave = this.wave;
      this.spawnFloatingLoot(`🧱 Mur Vague ${w} (Farm V.${this.wave})`, "#ff6b6b");
    }
    GameState.save();
    this.hud();
  },
  retryWall(){
    const b = S.cur; if (!b) return;
    this.pushMode = true;
    this.wave = Math.max(this.wallWave || 1, b.afkWaveMax || 1);
    b.afkWave = this.wave;
    this.wallWave = 0;
    this.clearMinions();
    this.spawnWave();
    this.hud();
  },

  /* ---- Événements interactifs : Drone Cargo (🛸) & Faille Spatio-Temporelle (🌀) ---- */
  syncAnomaly(b=S.cur, isLogin=false){
    if (!b) return;
    const now = Date.now();
    if (!b.afkAnomaly || typeof b.afkAnomaly !== "object") {
      b.afkAnomaly = { active: null, nextAt: now + (15 + Math.random() * 10) * 60000 };
    }
    const a = b.afkAnomaly;
    if (a.active && now >= a.active.expiresAt) {
      a.active = null;
      a.nextAt = now + (15 + Math.random() * 10) * 60000;
    }
    const offlineMs = now - (b.afkTs || now);
    if (!a.active && (now >= a.nextAt || (isLogin && offlineMs >= 2 * 3600000))) {
      const kind = Math.random() < 0.65 ? "drone" : "rift";
      const ttl = isLogin ? 5 * 60000 : 60 * 60000;
      a.active = {
        kind,
        expiresAt: now + ttl,
        x: 20 + Math.random() * 60,
        y: kind === "drone" ? 18 + Math.random() * 16 : 52 + Math.random() * 16
      };
      a.nextAt = now + ttl + (15 + Math.random() * 10) * 60000;
      GameState.save();
    }
    this.renderAnomalyVisual(a.active);
  },
  renderAnomalyVisual(ev){
    if (!this.stage) return;
    if (!ev) { if (this.anomalyBtn) this.anomalyBtn.remove(); this.anomalyBtn = null; return; }
    if (!this.anomalyBtn) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "afk-anomaly-btn";
      Object.assign(btn.style, {
        position: "absolute", zIndex: "30", transform: "translate(-50%,-50%)",
        padding: "6px 10px", borderRadius: "999px", cursor: "pointer", font: "bold 12px monospace",
        border: "2px solid #38bdf8", background: "rgba(10,16,28,0.88)", color: "#fff",
        boxShadow: "0 0 14px rgba(56,189,248,0.75)"
      });
      btn.onclick = e => { e.stopPropagation(); this.pokeAnomaly(); };
      this.stage.appendChild(btn);
      this.anomalyBtn = btn;
    }
    const leftSec = Math.max(0, Math.ceil((ev.expiresAt - Date.now()) / 1000));
    const mm = String(Math.floor(leftSec / 60)).padStart(2, "0"), ss = String(leftSec % 60).padStart(2, "0");
    const isDrone = ev.kind === "drone";
    this.anomalyBtn.style.left = ev.x + "%";
    this.anomalyBtn.style.top = ev.y + "%";
    this.anomalyBtn.style.borderColor = isDrone ? "#fbbf24" : "#c084fc";
    this.anomalyBtn.innerHTML = `${isDrone ? "🛸 Drone Cargo" : "🌀 Faille Temporelle"} <small style="opacity:.85">(${mm}:${ss})</small>`;
  },
  pokeAnomaly(){
    const b = S.cur; if (!b || !b.afkAnomaly || !b.afkAnomaly.active) return;
    const ev = b.afkAnomaly.active;
    b.afkAnomaly.active = null;
    if (ev.kind === "drone") {
      const goldBurst = Math.max(50, this.RATE * 900);
      GameState.ressources.caisses = (GameState.ressources.caisses || 0) + 1;
      GameState.ressources.or += goldBurst;
      this.spawnFloatingLoot(`🛸 +1 📦 Caisse & +${goldBurst.toLocaleString("fr-FR")} Or !`, "#fbbf24");
      toast(`🛸 Drone intercepté : +1 📦 Caisse gratuite & +${goldBurst.toLocaleString("fr-FR")} Or !`);
    } else {
      this.riftUntil = Date.now() + 10 * 60000;
      this.spawnFloatingLoot("🌀 DISTORSION TEMPORELLE (10 min : ×2 Vitesse & +25% Puissance) !", "#d8b4fe");
      toast("🌀 Faille activée : Distorsion Temporelle pendant 10 minutes !");
    }
    GameState.save();
    this.renderAnomalyVisual(null);
    this.hud();
  },

  /* ---- Widget Canister Quotidien (🧪 0/4 jusqu'à 01:00 UTC) + Skill Actif AFK ---- */
  renderCanisterWidget(){
    if (!this.stage) return;
    if (!this.canisterBox) {
      const box = document.createElement("div");
      box.id = "afk-canister-box";
      Object.assign(box.style, {
        position: "absolute", left: "12px", top: "54px", zIndex: "25",
        background: "rgba(10,14,22,0.84)", border: "1px solid rgba(56,189,248,0.45)",
        borderRadius: "8px", padding: "6px 9px", color: "#e2e8f0", font: "11px monospace",
        maxWidth: "235px", backdropFilter: "blur(3px)"
      });
      this.stage.appendChild(box);
      this.canisterBox = box;
    }
    const st = this.canisterStatus(), now = Date.now();
    const seg = (ok, lbl) => `<div style="color:${ok ? "#4ade80" : "#94a3b8"}">${ok ? "🧪" : "⬜"} ${lbl}</div>`;
    let skillHtml = "";
    if (st.s1) {
      const activeLeft = Math.max(0, Math.ceil((this.overdriveUntil - now) / 1000));
      const cdLeft = Math.max(0, Math.ceil((this.overdriveCdUntil - now) / 1000));
      const lbl = activeLeft > 0 ? `⚡ ACTIF (${activeLeft}s)` : cdLeft > 0 ? `⏳ Recharge (${cdLeft}s)` : "⚡ SURCHARGE 200% (30s)";
      skillHtml = `<button type="button" id="btn-afk-overdrive" ${activeLeft > 0 || cdLeft > 0 ? "disabled" : ""} style="margin-top:5px;width:100%;padding:4px 6px;border-radius:5px;border:1px solid #38bdf8;background:${activeLeft > 0 ? "#0284c7" : "#0f172a"};color:#fff;font:bold 11px monospace;cursor:pointer">${lbl}</button>`;
    }
    this.canisterBox.innerHTML = `<div style="font-weight:bold;color:${st.full ? "#fbbf24" : "#38bdf8"};margin-bottom:3px">🧪 CANISTER (${st.count}/4) · Reset 01:00 UTC</div>`
      + seg(st.s1, `PvP (${Math.min(3, st.raw.pvpWins || 0)}/3) → Skill 200%`)
      + seg(st.s2, `Boss Mondial (${Math.min(2, st.raw.wbKeys || 0)}/2) → Clone`)
      + seg(st.s3, `Expéditions (${Math.min(3, st.raw.expeClears || 0)}/3) → Jackpot V.10`)
      + seg(st.s4, `Caserne (${Math.min(1, st.raw.caserneActs || 0)}/1) → +3%/arme`)
      + (st.full ? `<div style="color:#fbbf24;margin-top:2px">✨ Bonus 4/4 : +50% Or/sec actif !</div>` : "")
      + skillHtml;
    const btn = $("#btn-afk-overdrive");
    if (btn) btn.onclick = e => { e.stopPropagation(); this.triggerOverdrive(); };
  },

  fitStage(){
    const grid=$("#home-grid"); if(!grid||!this.stage||!grid.clientWidth||!grid.clientHeight) return;
    const ratio=this.bgWidth/this.bgHeight;
    const height=Math.min(grid.clientHeight,grid.clientWidth/ratio);
    const width=height*ratio;
    this.stage.style.setProperty("--afk-ratio",this.bgWidth+" / "+this.bgHeight);
    this.stage.style.width=width+"px"; this.stage.style.height=height+"px";
  },
  setBg(b=S.cur){
    if(!this.stage||!b) return;
    const raw=b.spriteKey||b.key||b.speciesKey||b.sprite||b.species||"";
    let k=String(raw).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
    const brawler=DataEngine.BRAWLERS.find(name=>k.startsWith(name));
    k=(!brawler||brawler==="dummy")?"general":brawler;
    if(k===this._bgKey) return;
    this._bgKey=k;
    const tryExt=(exts)=>{
      if(this._bgKey!==k) return;
      if(!exts.length){ this.stage.style.setProperty("--afk-bg-img",AFK_ASSETS.BG_IMAGE?"url('"+new URL(encodeURI(AFK_ASSETS.BG_IMAGE),document.baseURI).href+"')":"none"); this.bgWidth=1376; this.bgHeight=768; this.fitStage(); return; }
      const p = assetPath.afk(k, 1, exts[0]);
      const im=new Image();
      im.onload=()=>{ if(this._bgKey!==k) return; this.stage.style.setProperty("--afk-bg-img","url('"+im.src+"')"); this.bgWidth=im.naturalWidth; this.bgHeight=im.naturalHeight; this.fitStage(); };
      im.onerror=()=>tryExt(exts.slice(1));
      im.src=p;
    };
    tryExt(["jpeg","jpg","png"]);
  },
  init(){
    this.field=$("#afk-field"); this.hero=$("#afk-hero"); this.stage=$("#afk-stage");
    if (this.hero && !this.cloneEl) {
      const cl = document.createElement("div");
      cl.className = "afk-hero afk-clone";
      cl.hidden = true;
      cl.style.cssText = `position:absolute;bottom:0;left:0;width:${AFK_ASSETS.HERO_SIZE}px;height:${AFK_ASSETS.HERO_SIZE}px;opacity:0.52;filter:hue-rotate(155deg) brightness(1.35);pointer-events:none`;
      const cv = document.createElement("canvas");
      cv.width = 64; cv.height = 64;
      cv.style.cssText = "width:100%;height:100%;display:block;image-rendering:pixelated";
      cl.appendChild(cv);
      this.hero.before(cl);
      this.cloneEl = cl; this.cloneCv = cv; this.cloneCtx = cv.getContext("2d");
    }
    this.setBg();
    this.hero.style.width=this.hero.style.height=AFK_ASSETS.HERO_SIZE+"px";
    $("#btn-harvest").onclick=()=>this.harvest();
    addEventListener("resize",()=>{ this.measure(); this.fitStage(); });
    if("ResizeObserver" in window){ this.resizeObserver=new ResizeObserver(()=>{ this.measure(); this.fitStage(); }); this.resizeObserver.observe($("#home-grid")); }
  },
  initBrute(b){
    if(!Number.isFinite(b.afkTs)||b.afkTs>Date.now()) b.afkTs=Date.now();
    if(!Number.isFinite(b.afkWave)||b.afkWave<1) b.afkWave=1;
if(!Number.isFinite(b.afkWaveMax)||b.afkWaveMax<b.afkWave) b.afkWaveMax=b.afkWave;
},
  pending(b=S.cur,now=Date.now()){ if(!b) return 0; return Math.floor(Math.min(this.CAP_SEC,Math.max(0,(now-b.afkTs)/1000))*this.RATE); },
  harvest(){
    const b=S.cur; if(!b) return;
    const g=this.pending(b); if(g<=0){ toast("Rien à récolter pour l'instant."); return; }
    b.gold+=g; b.afkTs=Date.now(); persist(); this.hud(); toast("+"+g.toLocaleString("fr-FR")+" Or récoltés !");
  },
  hud(){
    const b=S.cur; if(!b) return;
    this.setBg(b);
    this.syncCompanionAndClone(b);
    this.renderCanisterWidget();
    const w = this.wave || b.afkWave || 1;
    const req = this.wavePower(w), cur = this.effectivePower(b, w), pct = Math.round(this.winChance(w, b) * 100);
    const zone = this.zoneForWave(w);
    const zoneBadge = zone ? ` <span style="margin-left:6px;padding:1px 6px;border-radius:4px;background:rgba(15,23,42,0.85);border:1px solid #475569;font-size:10px">${zone.label}</span>` : "";
    const riftBadge = Date.now() < this.riftUntil ? ` <span style="color:#d8b4fe;font-size:10px">🌀 ×2</span>` : "";
    const waveEl = $("#afk-wave");
    if (waveEl) {
      waveEl.innerHTML = `Vague ${w} <small style="opacity:.85">(⚔️ ${req.toLocaleString("fr-FR")} · ${pct}%)</small>${zoneBadge}${riftBadge}`
        + (!this.pushMode ? ` <button type="button" id="btn-afk-retry" class="fx-mini" style="margin-left:6px;padding:1px 6px;font-size:10px;cursor:pointer">⚔️ Push V.${Math.max(this.wallWave, b.afkWaveMax || w + 1)}</button>` : "");
      const retryBtn = $("#btn-afk-retry");
      if (retryBtn) retryBtn.onclick = e => { e.stopPropagation(); this.retryWall(); };
    }
    const g=this.pending(b), max=this.CAP_SEC*this.RATE;
    $("#afk-count").textContent=g.toLocaleString("fr-FR")+" Or";
    $("#afk-bar").style.width=(g>0?Math.max(1.5,g/max*100):0)+"%";
    $("#afk-capacity").textContent="Capacité : "+max.toLocaleString("fr-FR")+" Or ("+(this.CAP_SEC/3600)+" h)";
    const basePw = calculerPuissance(b);
    const diffPct = basePw > 0 ? Math.round((cur / basePw - 1) * 100) : 0;
    const bonusTxt = diffPct !== 0 ? ` (AFK : ${cur.toLocaleString("fr-FR")} · ${diffPct > 0 ? "+" : ""}${diffPct}%)` : "";
    $("#afk-rate").textContent="+"+this.RATE.toLocaleString("fr-FR")+" Or / sec";
    $("#afk-power").textContent="⚔️ Puissance : "+basePw.toLocaleString("fr-FR")+bonusTxt;
    const bt=$("#btn-harvest"); bt.disabled=g<=0; bt.classList.toggle("ready",g>0);
  },
  measure(){ if(this.field) this.W=this.field.clientWidth||300; },
  start(){
    if(!S.cur||this.run) return;
    this.initBrute(S.cur);
    this.syncAnomaly(S.cur, true);
    this.run=true; this.measure(); this.wave=S.cur.afkWave||1; this.pushMode=true; this.clearMinions(); this.spawnWave(); this.hud();
    this.lastAttack="";
    this.heroX=Math.min(this.centerX(),Math.max(0,this.W*0.1));
    this.hero.style.setProperty("--hero-x",this.heroX+"px");
    this.moveHero("dash",this.centerX(),320);
    this.last=performance.now(); this.raf=requestAnimationFrame(t=>this.loop(t));
  },
stop(){ this.run=false; cancelAnimationFrame(this.raf); this.clearMinions(); },
clearMinions(){
this.minions.forEach(m=>m.el.remove()); this.minions=[];
this.dying.forEach(m=>m.el.remove()); this.dying=[];
},
spawnWave(){
this.hud();
this.nextWave=0;
const n=Math.min(3+Math.floor(this.wave/2),6), col=this.COLORS[(this.wave-1)%this.COLORS.length];
const keys=AFK_ASSETS.MINION_SPRITES, hcv=$("#cv-afk-hero"), cw=(hcv&&hcv.width)||84, ch=(hcv&&hcv.height)||84;
for(let i=0;i<n;i++){
const el=document.createElement("div"); el.className="minion";
const k=keys.length?keys[(this.wave+i)%keys.length]:"";
let cv=null, ctx=null, brute=null;
if(k&&DataEngine.SPRITES[k]){
cv=document.createElement("canvas"); cv.width=cw; cv.height=ch;
cv.style.cssText="width:100%;height:100%;display:block;image-rendering:pixelated;transform:scaleX(-1)";
ctx=cv.getContext("2d");
brute={sprite:k,species:k,hue:0,weapons:[],gear:[],companion:null};
el.appendChild(cv);
}else{
const sp=document.createElement("i"); sp.style.setProperty("--mc",col);
el.appendChild(sp);
}
this.field.appendChild(el);
const m={el,cv,ctx,brute,x:this.W+40+i*52,anim:"dash",t0:renderer.clock};
el.style.transform="translateX("+m.x+"px)";
this.minions.push(m);
}
},    
  drawMinion(m,c){
    if(!m.ctx||!m.brute) return;
    m.ctx.clearRect(0,0,m.cv.width,m.cv.height);
    renderer.drawBrute(m.ctx,m.brute,c-m.t0,m.anim);
  },
  loop(t){
    if(!this.run) return;
    const dt=Math.min(.05,(t-this.last)/1000); this.last=t;
    if(!OV.stack.length&&!document.hidden) this.step(dt);     // pause quand une pop-up est ouverte
    this.raf=requestAnimationFrame(x=>this.loop(x));
  },
  at(d,x,y){                                                 // centre de d (layout) + translate x/y, dans le repère de son offsetParent
    const e=d.el;
    return {cx:e.offsetLeft+e.offsetWidth/2+x, cy:e.offsetTop+e.offsetHeight/2+y, h:e.offsetHeight};
  },
  fx(parent,x,y,css,to,ms){                                  // particule pixel : état initial css -> état final to
    const e=document.createElement("div");
    Object.assign(e.style,{position:"absolute",left:x+"px",top:y+"px",pointerEvents:"none",zIndex:"9999",
      transition:"all "+(ms/1000)+"s steps(4)"},css);
    parent.appendChild(e);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(e.isConnected) Object.assign(e.style,to); }));
    setTimeout(()=>e.remove(),ms+30);
  },
 step(dt){
    const now = Date.now(), speedMult = (now < this.riftUntil ? 2 : 1) * (now < this.overdriveUntil ? 1.5 : 1);
    dt *= speedMult;
    this._uiTimer += dt;
    if (this._uiTimer >= 1) {
      this._uiTimer = 0;
      this.syncAnomaly(S.cur, false);
      this.renderCanisterWidget();
    }
    const c=renderer.clock, contact=this.centerX()+AFK_ASSETS.HERO_SIZE*.58, SP=72, SPEED=100;
    this.minions.forEach((m,i)=>{
      const tx=contact+i*SP;
      if(m.x>tx){
        m.x=Math.max(tx,m.x-SPEED*dt);
        m.el.style.transform="translateX("+m.x.toFixed(1)+"px)";
        if(m.anim!=="dash"){ m.anim="dash"; m.t0=c; }
      }else if(m.anim!=="idle"){
        m.anim="idle"; m.t0=c;
      }
      this.drawMinion(m,c);
    });
for (let i = this.dying.length - 1; i >= 0; i--) {
  const d = this.dying[i];
  const parent = d.el.offsetParent || d.el.parentElement;

  // 1. INITIALISATION À LA MORT
  if (!d.initialized) {
    d.initialized = true;
    d.y = d.y || 0;
    d.dir = Math.random() < 0.5 ? -1 : 1;
    d.mode = Math.random() < 0.5 ? "rocket" : "uppercut";
    d.vx = 450 + Math.random() * 350;
    d.vy = 280 + Math.random() * 180;
    d.lastTrailTime = 0;

    // NUAGE DE POUSSIÈRE PIXELISÉ (directement sur la position de l'ennemi)
    if (parent) {
      const r = this.at(d, d.x, d.y);
      [-18, 0, 18].forEach(ox => this.fx(parent, r.cx + ox, r.cy + r.h * 0.3,
        { width: "16px", height: "16px", background: "#fff",
          boxShadow: "-6px 4px 0 #ddd, 6px 4px 0 #ddd, 0 -6px 0 #fff", transform: "translate(-50%,0)" },
        { transform: "translate(-50%,-25px) scale(1.6)", opacity: "0" }, 350));
    }
  }

  const elapsed = c - d.t0;

  // 2. PETIT BLOCAGE D'IMPACT (Hit-stop)
  const freeze = d.mode === "uppercut" ? 75 : 50;
  if (elapsed < freeze) {
    const shake = d.mode === "uppercut" ? 16 : 10;
    d.el.style.transform = `translate(${(d.x + (Math.random() - 0.5) * shake).toFixed(1)}px, ${(d.y + (Math.random() - 0.5) * shake).toFixed(1)}px) scale(1.18)`;
    this.drawMinion(d, c);
    continue;
  }

  const p = Math.min(1, (elapsed - freeze) / (d.mode === "rocket" ? 1050 : 750));

  if (p >= 1) {
    d.el.remove();
    this.dying.splice(i, 1);
    continue;
  }

  let flyX, flyY, spin, scaleX, scaleY, opacity;

  if (d.mode === "rocket") {
    // MODE A : TEAM ROCKET
    flyX = d.x + p * d.vx * d.dir;
    flyY = d.y - Math.sin(p * Math.PI * 0.85) * d.vy;
    spin = p * 1440 * d.dir;
    const s = Math.max(0, 1 - Math.pow(p, 1.4));
    scaleX = s;
    scaleY = s;
    opacity = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;

    // ÉTOILE SCINTILLANTE À LA FIN ("Ding!")
    if (p >= 0.88 && !d.twinkled && parent) {
      d.twinkled = true;
      const r = this.at(d, flyX, flyY);
      const sx = Math.max(14, Math.min(parent.clientWidth - 14, r.cx));
      const sy = Math.max(14, Math.min(parent.clientHeight - 14, r.cy));
      this.fx(parent, sx, sy,
        { width: "6px", height: "6px", background: "#fff", transform: "translate(-50%,-50%)",
          boxShadow: "0 -6px 0 #fff, 0 6px 0 #fff, -6px 0 0 #fff, 6px 0 0 #fff, 0 -12px 0 #ffe600, 0 12px 0 #ffe600, -12px 0 0 #ffe600, 12px 0 0 #ffe600" },
        { transform: "translate(-50%,-50%) scale(1.8) rotate(45deg)", opacity: "0" }, 280);
    }

  } else {
    // MODE B : UPPERCUT D'OBÉLIX
    flyX = d.x + p * 40 * d.dir;
    flyY = d.y - Math.pow(p, 1.5) * 950;
    spin = p * 1080 * d.dir;
    const baseScale = Math.max(0.25, 1 - p * 0.45);
    scaleX = baseScale * 0.85;
    scaleY = baseScale * 1.25;
    opacity = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;

    // TRAÎNÉES DE VITESSE VERTICALES
    if (parent && p < 0.8 && c - d.lastTrailTime > 40) {
      d.lastTrailTime = c;
      const r = this.at(d, flyX, flyY), by = r.cy + r.h * 0.5 * scaleY;
      [-14, 0, 14].forEach((ox, k) => this.fx(parent, r.cx + ox + (Math.random() - 0.5) * 6, by + (k % 2) * 10,
        { width: "4px", height: (40 + Math.random() * 30).toFixed(0) + "px", background: k === 1 ? "#fff" : "#cfe8ff", transform: "translate(-50%,0)" },
        { transform: "translate(-50%,30px) scaleY(0.2)", opacity: "0" }, 220));
    }  }

  d.el.style.transform = `translate(${flyX.toFixed(1)}px, ${flyY.toFixed(1)}px) rotate(${spin.toFixed(0)}deg) scale(${scaleX.toFixed(2)}, ${scaleY.toFixed(2)})`;
  d.el.style.opacity = opacity.toFixed(2);

  this.drawMinion(d, c);
}


    this.updateHero(c);
    if(this.heroPhase==="attack"&&!this.attackImpact&&c-this.heroPhaseStart>=this.attackImpactAt) this.resolveAttack();
    const f=this.minions[0];
    if(this.heroPhase==="idle"&&f){
      if(this.heroX<this.centerX()-.5&&f.x<=contact+SP+12) this.moveHero("dash",this.centerX(),320);
      else if(this.heroX>=this.centerX()-.5&&f.x<=contact+2) this.beginAttack();
    }
 if(!this.minions.length&&this.nextWave>0){ this.nextWave-=dt; if(this.nextWave<=0){ this.spawnWave(); } }
  }
};

/* ---------- Configuration des panneaux boss ---------- */
/* Les fonds des panneaux sont configurés ici ; les planches de sprites restent sur chaque définition de boss. */
const BOSS_MODES={
  armes:     {label:"Boss des Armes",      cls:"mode-armes",      bgImage:"", sprite:"", name:"Boss des Armes",      energyCost:1},  // fond #0f172a
  parchemins:{label:"Boss des Parchemins", cls:"mode-parchemins", bgImage:"", sprite:"", name:"Boss des Parchemins", energyCost:1},  // fond #0f3af8
  familier:  {label:"Boss du Familier",    cls:"mode-familier",   bgImage:"", sprite:"", name:"Boss du Familier",    energyCost:1},  // fond #064e3b
  mondial:   {label:"Boss Mondial",        cls:"mode-mondial",    bgImage:"", sprite:"", name:"Boss Mondial",        energyCost:1}   // fond #450a0a
  // bgImage : décor du panneau ; vide = fond uni de la classe .mode-xxx
  // sprite  : réservé aux futurs boss définis directement dans cette table
  // energyCost : réservé pour les étapes suivantes (non appliqué à l'étape 1)
};

const BossModes={
  cur:null,previewBrute:null,previewBound:false,
  prepare(k){                                   // applique fond + textes du mode, appelée à l'ouverture
    const c=BOSS_MODES[k]; if(!c) return; this.cur=k;
    const el=$("#g-boss"); el.className="pane ov "+c.cls;
    el.style.setProperty("--ov-img",c.bgImage?"url('"+new URL(encodeURI(c.bgImage),document.baseURI).href+"')":"none");
    $("#boss-title").textContent=c.label;
    const sp=$("#boss-sprite");
    if(!this.previewBound){ renderer.bind(sp,()=>this.previewBrute); this.previewBound=true; }
    this.showBoss(k,Raids.sel[k]||1);
  },
  showBoss(k,level=1){
    const def=k==="mondial"?Raids.bossMondial():Raids.bossPalier(k,level);
    const key="ennemi_"+def.id;
    if(!DataEngine.SPRITES[key]) DataEngine.SPRITES[key]={portrait:def.portrait||"",sprite:def.png||"",planches:def.planches||[]};
    this.previewBrute={id:key,name:def.nom,species:"Mutant",hue:def.hue,sprite:key,stats:{hp:1,str:1,agi:1,spd:1},
      level:level,weapons:[],gear:[],skills:[],companion:null,placeholder:"boss",scale:def.scale||1,
      animationSet:def.animationSet||"bossPreview",portraitBounds:def.portraitBounds,previewAnimations:def.previewAnimations};
    $("#boss-name").textContent=def.nom;
  },
  start(k){ /* TODO étapes suivantes : lancer le combat de boss k (Energy.spend(S.cur,BOSS_MODES[k].energyCost)) */ },
  stop(){ /* TODO : nettoyer le combat de boss en cours */ }
};
OV.reg.bossArmes.onClose=OV.reg.bossParchemins.onClose=OV.reg.bossFamilier.onClose=OV.reg.bossMondial.onClose=()=>BossModes.stop();
OV.reg.bossArmes.onOpen=()=>Raids.ouvrir("armes");
OV.reg.bossParchemins.onOpen=()=>Raids.ouvrir("parchemins");
OV.reg.bossFamilier.onOpen=()=>Raids.ouvrir("familier");
OV.reg.bossMondial.onOpen=()=>Raids.ouvrir("mondial");
