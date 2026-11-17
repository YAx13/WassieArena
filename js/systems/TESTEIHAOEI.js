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
  compX:0,compAnim:"idle",compT0:0,compNextAtk:0,wpnSelectorEl:null,

  AFK_WPN_PERKS:{
    0:  { label:"Entaille double (+25% double élimination)", bonusKillChance:0.25, atkSpdMult:1.10, vfx:"slash",   color:"#38bdf8" }, // Épée
    1:  { label:"Exécution éclair (Cadence +35%)",          atkSpdMult:1.35, bonusKillChance:0.15, vfx:"crit",    color:"#f472b6" }, // Dague
    2:  { label:"Coupe-jarret (+25% cadence & +Or/coup)",    atkSpdMult:1.25, goldHit:1.5,          vfx:"slash",   color:"#9be15d" }, // Couteau
    3:  { label:"Déchiquetage (+1 élimination / coup)",      flatKills:1,    atkSpdMult:0.95,      vfx:"saw",     color:"#fbbf24" }, // Scie
    4:  { label:"Fendoir brutal (+35% double élimination)",  bonusKillChance:0.35, launchMode:"rocket", vfx:"slam", color:"#ff6b6b" }, // Hache
    5:  { label:"Onde sismique (Étourdit la file)",          stunNext:900,   launchMode:"uppercut", vfx:"slam",  color:"#f59e0b" }, // Marteau
    6:  { label:"Filon d'or (+Or garanti à chaque coup)",    goldHit:3.0,    bonusKillChance:0.20, vfx:"spark",   color:"#ffd166" }, // Pioche
    7:  { label:"Coup de massue (Étourdit & Éjecte)",        stunNext:700,   launchMode:"rocket",  vfx:"slam",    color:"#e2e8f0" }, // Os
    8:  { label:"Rebond (+45% double élimination)",          bonusKillChance:0.45, atkSpdMult:1.15, vfx:"arc",     color:"#4ff0e6" }, // Boomerang
    9:  { label:"Empalement (+1 élimination / coup)",        flatKills:1,    atkSpdMult:1.05,      vfx:"pierce",  color:"#60a5fa" }, // Trident
    10: { label:"Écrasement colossal (+2 éliminations)",     flatKills:2,    atkSpdMult:0.85, launchMode:"uppercut", vfx:"slam", color:"#ffd43b" }, // Pilier
    11: { label:"Rafale ninja (Cadence +40%)",               atkSpdMult:1.40, bonusKillChance:0.20, vfx:"arc",     color:"#a78bfa" }, // Shuriken
    12: { label:"Explosion (+1 élimination & Éjecte)",       flatKills:1,    launchMode:"rocket",  vfx:"boom",    color:"#ff5e5e" }, // Grenade
    13: { label:"Brûlure de zone (+Or & +1 élimination)",    flatKills:1,    goldHit:1.5,          vfx:"fire",    color:"#ff7b00" }  // Molotov
  },
  weaponAfkPerk(wid){
    if(wid===null||wid===undefined) return { label:"Mains nues", atkSpdMult:1 };
    return this.AFK_WPN_PERKS[wid]||{ label:"Bonus d'arme", atkSpdMult:1 };
  },
  weaponPowerMult(wid){
    const w=DataEngine.WEAPONS[wid];
    if(!w) return 1;
    const m=(typeof GameState!=="undefined"&&GameState.maitriseArmes&&GameState.maitriseArmes[wid])||0;
    return 1 + (w.dmg * 0.025) + (m * 0.06);
  },
  triggerWeaponAfkVfx(wid,target){
    if(!this.field||!target) return;
    const perk=this.weaponAfkPerk(wid), r=this.at(target,target.x,target.y||0), col=perk.color||"#fff";
    if(perk.vfx==="fire"){
      for(let k=-1;k<=1;k++) this.fx(this.field,r.cx+k*16,r.cy+12,{width:"10px",height:"18px",background:k===0?"#ffd43b":"#ff6a00",transform:"translate(-50%,-50%)"},{transform:"translate(-50%,-150%) scale(1.4)",opacity:"0"},320);
    } else if(perk.vfx==="boom"){
      this.fx(this.field,r.cx,r.cy,{width:"24px",height:"24px",borderRadius:"50%",border:"4px solid #ff5e5e",background:"rgba(255,220,90,0.6)",transform:"translate(-50%,-50%)"},{transform:"translate(-50%,-50%) scale(2.8)",opacity:"0"},300);
    } else if(perk.vfx==="slam"){
      this.fx(this.field,r.cx,r.cy+r.h*0.35,{width:"44px",height:"10px",borderRadius:"50%",border:"3px solid "+col,transform:"translate(-50%,-50%)"},{transform:"translate(-50%,-50%) scale(2.2,1.4)",opacity:"0"},280);
    } else if(perk.vfx==="arc"||perk.vfx==="pierce"){
      this.fx(this.field,r.cx-24,r.cy,{width:"54px",height:"4px",background:col,boxShadow:"0 0 8px "+col,transform:"translate(-50%,-50%)"},{transform:"translate(40%,-50%) scaleX(1.5)",opacity:"0"},220);
    } else if(perk.vfx==="saw"||perk.vfx==="spark"){
      for(let k=0;k<4;k++){
        const ox=(Math.random()-0.5)*28, oy=(Math.random()-0.5)*24;
        this.fx(this.field,r.cx+ox,r.cy+oy,{width:"6px",height:"6px",background:col,transform:"translate(-50%,-50%)"},{transform:`translate(${ox*2}px,${oy*2-18}px) scale(0.3)`,opacity:"0"},250);
      }
    } else if(perk.vfx==="slash"||perk.vfx==="crit"){
      this.fx(this.field,r.cx,r.cy,{width:"42px",height:"4px",background:col,transform:"translate(-50%,-50%) rotate(-32deg)"},{transform:"translate(-50%,-50%) rotate(-32deg) scale(1.6)",opacity:"0"},210);
    }
  },
  unlockedWeapons(b=S.cur){
    if(!b||!Array.isArray(b.weapons)) return [];
    return [...new Set(b.weapons)].filter(id=>Number.isInteger(id)&&!!DataEngine.WEAPONS[id]);
  },
  selectedWeaponId(b=S.cur){
    const unlocked=this.unlockedWeapons(b);
    if(!unlocked.length){ if(b) b.afkWeaponId=null; return null; }
    if(b.afkWeaponId===null) return null;
    if(Number.isInteger(b.afkWeaponId)&&unlocked.includes(b.afkWeaponId)) return b.afkWeaponId;
    b.afkWeaponId=unlocked[0];
    return b.afkWeaponId;
  },
  cycleWeapon(dir){
    const b=S.cur, unlocked=this.unlockedWeapons(b);
    if(!unlocked.length) return;
    const list=[null,...unlocked];
    const cur=this.selectedWeaponId(b);
    const idx=list.indexOf(cur);
    const next=list[(idx+dir+list.length)%list.length];
    b.afkWeaponId=next;
    this.lastAttack="";
    persist();
    this.hud();
  },
  renderWeaponSelector(){
    if(!this.stage) return;
    const b=S.cur;
    const hasWeapons=this.unlockedWeapons(b).length>0;
    if(!hasWeapons){
      if(this.wpnSelectorEl){ this.wpnSelectorEl.remove(); this.wpnSelectorEl=null; }
      return;
    }
    if(!this.wpnSelectorEl){
      const wrap=document.createElement("div");
      wrap.id="afk-weapon-selector";
      Object.assign(wrap.style,{
        position:"absolute",right:"14px",bottom:"86px",zIndex:"28",
        display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",padding:"5px 8px",
        background:"rgba(12,16,24,0.88)",border:"1px solid #c9953a",
        borderRadius:"6px",boxShadow:"0 4px 14px rgba(0,0,0,0.7)",pointerEvents:"auto"
      });
      wrap.innerHTML=`
        <div style="display:flex;align-items:center;gap:6px">
          <button type="button" id="afk-wpn-prev" aria-label="Arme précédente" style="background:#261a0c;border:1px solid #c9953a;color:#ffd35c;font:bold 13px monospace;padding:4px 7px;border-radius:4px;cursor:pointer">◀</button>
          <div id="afk-wpn-slot" style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);border:1px solid rgba(201,149,58,0.45);border-radius:4px">
            <canvas id="cv-afk-wpn" width="64" height="64" style="width:38px;height:38px;image-rendering:pixelated"></canvas>
          </div>
          <button type="button" id="afk-wpn-next" aria-label="Arme suivante" style="background:#261a0c;border:1px solid #c9953a;color:#ffd35c;font:bold 13px monospace;padding:4px 7px;border-radius:4px;cursor:pointer">▶</button>
        </div>
        <div id="afk-wpn-perk" style="font:bold 9px monospace;color:#ffd35c;text-align:center;max-width:145px;line-height:1.15"></div>
      `;
      this.stage.appendChild(wrap);
      this.wpnSelectorEl=wrap;
      wrap.querySelector("#afk-wpn-prev").onclick=e=>{ e.stopPropagation(); this.cycleWeapon(-1); };
      wrap.querySelector("#afk-wpn-next").onclick=e=>{ e.stopPropagation(); this.cycleWeapon(1); };
    }
    const wid=this.selectedWeaponId(b);
    const slot=this.wpnSelectorEl.querySelector("#afk-wpn-slot");
    const perkEl=this.wpnSelectorEl.querySelector("#afk-wpn-perk");
    const cv=this.wpnSelectorEl.querySelector("#cv-afk-wpn");
    const ctx=cv.getContext("2d");
    ctx.imageSmoothingEnabled=false;
    ctx.clearRect(0,0,64,64);
    if(wid===null){
      slot.title="Mains nues (+0% Puissance)";
      perkEl.textContent="👊 Mains nues";
      perkEl.style.color="#94a3b8";
      ctx.font="28px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("👊",32,34);
    } else {
      const w=DataEngine.WEAPONS[wid], perk=this.weaponAfkPerk(wid);
      const bonusPct=Math.round((this.weaponPowerMult(wid)-1)*100);
      slot.title=`${w?w.name:"Arme"} (+${bonusPct}% Puissance) · ${perk.label}`;
      perkEl.textContent=`+${bonusPct}% ⚔️ · ${perk.label.split("(")[0].trim()}`;
      perkEl.style.color=perk.color||"#ffd35c";
      const skin=renderer.weaponSprite(b,wid,()=>this.renderWeaponSelector());
      if(skin){
        const sc=Math.min(58/skin.width,58/skin.height), dw=skin.width*sc, dh=skin.height*sc;
        ctx.drawImage(skin.sheet,skin.x,skin.y,skin.width,skin.height,(64-dw)/2,(64-dh)/2,dw,dh);
      } else if(w){
        ctx.font="28px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(w.icon,32,34);
      }
    }
  },

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
    const wid = this.selectedWeaponId(b);
    if (wid !== null) p *= this.weaponPowerMult(wid);
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
      this.cloneEl.style.setProperty("--hero-x", Math.max(0, this.heroX - 12).toFixed(2) + "px");
      this.cloneEl.style.transform = `translateX(${Math.max(0, this.heroX - 12).toFixed(2)}px)`;
      const hcv = $("#cv-afk-hero");
      if (this.cloneCtx && hcv) {
        this.cloneCtx.clearRect(0, 0, this.cloneCv.width, this.cloneCv.height);
        this.cloneCtx.drawImage(hcv, 0, 0, this.cloneCv.width, this.cloneCv.height);
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
    const wid=this.selectedWeaponId();
    const anim=this.heroAnim, elapsed=this.heroPhase==="attack"?Math.max(0,t-this.heroPhaseStart):t;
    const hasSheet=wid!==null&&!!renderer.loadImg(DataEngine.spriteBase(S.cur.sprite,wid));
    const WA=hasSheet?CanvasRenderer.WPN_ANIMS?.[anim]:null;
    const A=WA||CanvasRenderer.ANIMS[anim]||CanvasRenderer.ANIMS.idle;
    const maxF=WA?WA.f.length:4;
    const frame=this.heroPhase==="attack"?Math.min(maxF-1,Math.floor(elapsed*A.fps/1000)):null;
    const cw=ctx.canvas.width||84, ch=ctx.canvas.height||84;
    ctx.clearRect(0,0,cw,ch);
    ctx.save();
    if(wid===10){
      const sc=1.34;
      ctx.translate(cw/2,ch);
      ctx.scale(sc,sc);
      ctx.translate(-cw/2,-ch*0.95);
    }
    renderer.drawBrute(ctx,S.cur,elapsed,anim,frame,wid);
    ctx.restore();
  },
  chooseAttack(){
    const wid=this.selectedWeaponId();
    let pool=this.attacks;
    if(wid!==null){
      const w=DataEngine.WEAPONS[wid];
      const style=w?(DataEngine.WEAPON_STYLE?.[wid]||w.type||"light"):"light";
      if(style==="light") pool=[["thrust",5],["pierce",3]];
      else if(style==="heavy") pool=[["overhead",5],["meteor",3]];
      else if(style==="throw") pool=[["throw",5],["salto",3]];
    }
    const choices=pool.filter(([name])=>name!==this.lastAttack);
    const list=choices.length?choices:pool;
    const total=list.reduce((sum,[,weight])=>sum+weight,0);
    let roll=Math.random()*total;
    for(const [name,weight] of list){ roll-=weight; if(roll<0) return name; }
    return list[list.length-1][0];
  },
  beginAttack(){
    const wid=this.selectedWeaponId();
    const perk=this.weaponAfkPerk(wid);
    const name = Date.now() < this.overdriveUntil ? "meteor" : this.chooseAttack();
    const hasSheet=wid!==null&&!!renderer.loadImg(DataEngine.spriteBase(S.cur.sprite,wid));
    const WA=hasSheet?CanvasRenderer.WPN_ANIMS?.[name]:null;
    const A=WA||CanvasRenderer.ANIMS[name]||CanvasRenderer.ANIMS.punch;
    const frames=WA?WA.f.length:4;
    const spdMult=perk.atkSpdMult||1;
    const duration=(frames*1000/(A.fps||10))/spdMult;
    this.lastAttack=name; this.heroPhase="attack"; this.heroAnim=name;
    this.heroPhaseStart=renderer.clock; this.heroDuration=duration/1000;
    this.attackImpactAt=duration*.75; this.attackImpact=false;
  },
  resolveAttack(){
    const c=renderer.clock;
    const wid=this.selectedWeaponId();
    const perk=this.weaponAfkPerk(wid);
    const extraKill=(perk.bonusKillChance&&Math.random()<perk.bonusKillChance)?1:0;
    const kills=(this.KILLS[this.lastAttack]||1)+(this.canisterStatus().s2?1:0)+(perk.flatKills||0)+extraKill;
    const hitList=[];
    for(let n=kills;n>0&&this.minions.length;n--){
      const f=this.minions.shift(); f.anim="death"; f.t0=c; f.el.classList.add("die");
      if(perk.launchMode) f.forceMode=perk.launchMode;
      this.dying.push(f);
      hitList.push(f);
    }
    if(perk.stunNext&&this.minions.length){
      this.minions[0].stunUntil=c+perk.stunNext;
    }
    if(perk.goldHit&&hitList.length){
      const gain=Math.max(1,Math.round(perk.goldHit*hitList.length*(1+this.wave*0.15)));
      GameState.ressources.or+=gain;
      if(Math.random()<0.35) this.spawnFloatingLoot(`+${gain} Or`,perk.color||"#ffd166");
    }
    if(hitList.length) this.triggerWeaponAfkVfx(wid,hitList[0]);
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
  mountField(container){
    if(!container) return null;
    container.classList.add("arena-field");
    return container;
  },
  init(){
    this.field=this.mountField($("#afk-field")); this.hero=$("#afk-hero"); this.stage=$("#afk-stage");
    if (this.hero && !this.cloneEl) {
      const cl = document.createElement("div");
      cl.className = "afk-hero afk-clone";
      cl.hidden = true;
      cl.style.cssText = `width:${AFK_ASSETS.HERO_SIZE}px;height:${AFK_ASSETS.HERO_SIZE}px;opacity:0.55;filter:hue-rotate(175deg) brightness(1.2) drop-shadow(0 0 6px #38bdf8);pointer-events:none;z-index:1`;
      const cv = document.createElement("canvas");
      cv.width = 64; cv.height = 64;
      cv.style.cssText = "width:100%;height:100%;display:block;image-rendering:pixelated";
      cl.appendChild(cv);
      this.hero.style.zIndex = "5";
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
    this.renderWeaponSelector();
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
stop(){ this.run=false; cancelAnimationFrame(this.raf); this.clearMinions(); this.clearDuel(); if(this.wpnSelectorEl){ this.wpnSelectorEl.remove(); this.wpnSelectorEl=null; } },
clearMinions(){
this.minions.forEach(m=>m.el.remove()); this.minions=[];
this.dying.forEach(m=>m.el.remove()); this.dying=[];
},
spawnWave(){
this.hud();
this.nextWave=0;
if(this.isBossWave(this.wave)){ this.startBossDuel(); return; }
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
      const stunned=m.stunUntil&&c<m.stunUntil;
      if(stunned){
        if(m.anim!=="hit"){ m.anim="hit"; m.t0=c; }
      } else if(m.x>tx){
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
    d.mode = d.forceMode || (Math.random() < 0.5 ? "rocket" : "uppercut");
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


    if(this.duel){ this.stepBossDuel(dt); return; }
    this.updateHero(c);
    if(this.heroPhase==="attack"&&!this.attackImpact&&c-this.heroPhaseStart>=this.attackImpactAt) this.resolveAttack();
    const f=this.minions[0];
    if(this.heroPhase==="idle"&&f){
      if(this.heroX<this.centerX()-.5&&f.x<=contact+SP+12) this.moveHero("dash",this.centerX(),320);
      else if(this.heroX>=this.centerX()-.5&&f.x<=contact+2) this.beginAttack();
    }
    if(!this.minions.length&&this.nextWave>0){ this.nextWave-=dt; if(this.nextWave<=0){ this.spawnWave(); } }
  },
  isBossWave(w=this.wave){ return w>0 && w%10===0; },
  createWaveBoss(w){
    const b=S.cur, req=this.wavePower(w), cur=Math.max(1,this.effectivePower(b,w));
    const ratio=req/cur;
    const lv=Math.max(1,Math.round((b?b.level:1)*Math.pow(ratio,0.65)));
    const pool=DataEngine.BRAWLERS.filter(k=>k!=="dummy"&&(!b||k!==b.sprite));
    const spr=pool.length?pool[(Math.floor(w/10)-1)%pool.length]:"general";
    const titles=["Gardien","Exécuteur","Colosse","Seigneur","Titan","Fléau"];
    const name=`${titles[(Math.floor(w/10)-1)%titles.length]} V.${w}`;
    const basePts=Math.max(10,Math.round((20+(b?b.level:1)-1)*ratio));
    const stats=DataEngine.rollStartStats(basePts);
    const allW=DataEngine.WEAPONS.map(x=>x.id);
    const wCount=Math.min(4,1+Math.floor(w/20));
    const weapons=[];
    while(weapons.length<wCount&&allW.length){
      const id=DataEngine.pick(allW);
      if(!weapons.includes(id)) weapons.push(id);
    }
    return {
      id:"afk_boss_"+w,name,species:"Boss",style:"boss",hue:(w*37)%360,sprite:spr,
      stats,level:lv,weapons,gear:[],skills:DataEngine.pickSkills(Math.min(5,2+Math.floor(w/20))),
      companion:null,scale:1.15
    };
  },
  clearDuel(){
    if(this.duel){
      (this.duel.dom||[]).forEach(el=>el.remove());
      this.duel=null;
    }
    if(this.field) this.field.classList.remove("is-duel");
    const fxCv=$("#cv-afk-fx");
    if(fxCv){ const ctx=fxCv.getContext("2d"); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,fxCv.width,fxCv.height); }
  },
  startBossDuel(){
    const b=S.cur; if(!b||!this.field) return;
    this.clearMinions();
    this.clearDuel();
    this.field.classList.add("is-duel");
    const c=renderer.clock;
    const pv=Object.create(b);
    const eq=((typeof GameState!=="undefined"&&GameState.competencesEquipees)||[]).filter(id=>b.skills.includes(id));
    pv.skills=(eq.length?eq:b.skills).slice(0,Math.max(1,b.slotsCompetences||3));
    const boss=this.createWaveBoss(this.wave);
    const eng=new BattleEngine(pv,boss,ProfileManager.getBuffs());
    const q=[];
    ["on_attack","on_hit","on_dot","on_skill","on_dodge","on_death","on_end"].forEach(ev=>eng.on(ev,e=>q.push(e)));
    const mk=(br,i)=>({
      b:br,name:br.name,x:i?305:95,bx:i?305:95,y:188,flip0:!!i,flip:!!i,
      anim:"idle",t0:c,flash0:-1e6,hp:eng.f[i].hp,dh:eng.f[i].hp,lastHp:eng.f[i].hp,
      hit0:-1e6,max:eng.f[i].max,win:false,air:0,wpn:null,scale:br.scale||1,st:{},pet:false
    });
    const V=[pv,boss].map(mk);
    const P=V.map((v,i)=>{
      const cp=v.b.companion; if(!cp) return null;
      const hx=v.bx+(i?54:-54);
      return {pet:true,i,owner:v.b,key:cp.species+":"+(cp.form||1),x:hx,hx,y:v.y+2,flip:v.flip0,flip0:v.flip0,anim:"idle",t0:c,flash0:-1e6,win:false,air:0};
    }).filter(Boolean);
    const dom=[];
    const mountUnit=(f,idx,isPet)=>{
      const el=document.createElement("div");
      el.className="arena-unit"+(isPet?" is-pet":"")+(idx>0?" is-enemy":"");
      const cv=document.createElement("canvas");
      cv.width=64; cv.height=64;
      const ctx=cv.getContext("2d");
      ctx.imageSmoothingEnabled=false;
      el.appendChild(cv);
      if(!isPet){
        const oh=document.createElement("div");
        oh.className="arena-overhead";
        oh.innerHTML=`<div class="arena-badges"></div><div class="arena-tag">${f.name} <small>Niv.${f.b.level||1}</small></div><div class="arena-hpbar"><i class="dh" style="width:100%"></i><i class="hp" style="width:100%"></i></div>`;
        el.appendChild(oh);
        f._domDh=oh.querySelector(".dh");
        f._domHp=oh.querySelector(".hp");
        f._domBadges=oh.querySelector(".arena-badges");
      }
      this.field.appendChild(el);
      dom.push(el);
      f._domEl=el; f._domCv=cv; f._domCtx=ctx;
    };
    V.forEach((f,k)=>mountUnit(f,k,false));
    P.forEach(p=>mountUnit(p,p.i,true));
    this.duel={eng,V,P,q,fl:[],vfx:[],proj:null,ph:{k:"intro",t:c+500},dom};
    this.spawnFloatingLoot(`⚠️ DUEL BOSS VAGUE ${this.wave} !`,"#ff6b6b");
    this.syncBossDuel(c);
  },
  stepBossDuel(dt){
    const D=this.duel; if(!D) return;
    const c=renderer.clock, p=D.ph;
    if(!p){ this.syncBossDuel(c); return; }
    if(p.k==="intro"){
      if(c>=p.t) this.nextDuelTurn(c);
      this.syncBossDuel(c); return;
    }
    if(p.k==="end"){
      if(c>=p.t) this.endBossDuel();
      else this.syncBossDuel(c);
      return;
    }
    const e=c-p.t0, a=D.V[p.i], d=D.V[p.j];
    if(p.kind==="pet"){
      const pt=p.pt;
      if(!pt){ this.afterDuelTurn(c); this.syncBossDuel(c); return; }
      a.anim=e<550?"whistle":"idle";
      if(e<350) pt.anim="idle";
      else if(e<750){ pt.x=pt.hx+(p.tx-pt.hx)*(e-350)/400; pt.flip=pt.flip0; pt.anim="run"; }
      else if(e<1050){
        pt.x=p.tx; pt.anim="bite";
        if(!p.hit){ p.hit=1; this.applyDuelEvents(p,c); }
      } else if(e<1400){ pt.x=p.tx+(pt.hx-p.tx)*(e-1050)/350; pt.flip=!pt.flip0; pt.anim="run"; }
      else { pt.x=pt.hx; pt.flip=pt.flip0; pt.anim="idle"; this.afterDuelTurn(c); }
      this.syncBossDuel(c); return;
    }
    const T=p.T;
    if(!p.hit && e>=p.h){ p.hit=1; this.applyDuelEvents(p,c); }
    if(p.ranged && e>=p.rel && e<p.h){
      a.wpn=null;
      if(!D.proj && p.wicon){
        D.proj={ic:p.wicon,id:p.wid,b:a.b,x0:a.bx+(p.i?-28:28),y0:a.y-48,x1:d.bx,y1:d.y-42,t0:p.t0+p.rel,t1:p.t0+p.h};
      }
    }
    if(e<T[0]){
      const k=T[0]>0?e/T[0]:1;
      a.x=a.bx+(p.tx-a.bx)*(1-Math.pow(1-k,3));
      a.air=p.jump?Math.sin(Math.PI*k)*p.jump:0;
      a.flip=a.flip0; a.anim="dash";
    } else if(e<T[1]){
      a.x=p.tx; a.air=0; a.flip=a.flip0; a.anim=p.anim;
    } else if(e<T[2]){
      const rk=(e-T[1])/Math.max(1,T[2]-T[1]);
      a.x=p.tx+(a.bx-p.tx)*rk;
      a.air=Math.sin(Math.PI*rk)*12;
      a.flip=!a.flip0; a.anim="dash";
    } else {
      const heldId=D.eng.f[p.i].held;
      a.wpn=heldId!==null?{ic:DataEngine.WEAPONS[heldId].icon,id:heldId}:null;
      a.x=a.bx; a.air=0; a.flip=a.flip0; a.anim="idle";
      this.afterDuelTurn(c);
    }
    this.syncBossDuel(c);
  },
  nextDuelTurn(c){
    const D=this.duel; if(!D) return;
    D.q.length=0; D.eng.step(); D.proj=null;
    D.eng.f.forEach((f,k)=>{ if(D.V[k]) D.V[k].st=JSON.parse(JSON.stringify(f.st)); });
    const at=D.q[0], ev=D.q.slice(1), ht=ev.find(e=>e.type==="on_hit"), crit=!!(ht&&ht.crit);
    const A=D.V[at.i], Dd=D.V[at.j], dir=at.i?-1:1;
    let kind="punch";
    if(at.pet) kind="pet";
    else if(at.self) kind=at.skill?"self":"idle";
    else if(at.weapon){
      const wt=at.threwWpn?"throw":((DataEngine.WEAPONS[at.weapon.id]&&DataEngine.WEAPONS[at.weapon.id].type)||"light");
      kind=crit?{light:"pierce",heavy:"meteor",throw:"salto"}[wt]:{light:"estoc",heavy:"overhead",throw:"throw"}[wt];
    } else kind=crit?"uppercut":"punch";
    const map={
      punch:{anim:"punch",T:[170,520,700],h:340},
      estoc:{anim:"thrust",T:[150,480,660],h:300},
      overhead:{anim:"overhead",T:[210,600,790],h:400,jump:22},
      throw:{anim:"throw",T:[0,540,700],h:400,rel:160,ranged:1},
      uppercut:{anim:"uppercut",T:[200,580,760],h:380,jump:26},
      pierce:{anim:"pierce",T:[140,500,680],h:280},
      meteor:{anim:"meteor",T:[240,680,880],h:450,jump:36},
      salto:{anim:"salto",T:[0,640,800],h:460,rel:280,ranged:1},
      self:{anim:"taunt",T:[0,460,460],h:160},
      idle:{anim:"idle",T:[0,360,360],h:100},
      pet:{anim:"whistle",T:[0,1400,1400],h:750}
    }[kind];
    const dist=46, tx=map.ranged||at.self||kind==="pet"?(kind==="pet"?Dd.bx+(at.i?42:-42):A.bx):Dd.bx-dir*dist;
    const heldId=D.eng.f[at.i].held;
    if(at.weapon&&!at.pet) A.wpn={ic:at.weapon.icon,id:at.weapon.id};
    else A.wpn=heldId!==null?{ic:DataEngine.WEAPONS[heldId].icon,id:heldId}:null;
    D.ph=Object.assign({k:"act",kind,t0:c,i:at.i,j:at.j,ev,hit:0,tx,wicon:at.weapon&&at.weapon.icon,wid:at.weapon&&at.weapon.id,pt:kind==="pet"?D.P.find(p=>p.i===at.i):null},map);
  },
  applyDuelEvents(p,c){
    const D=this.duel; if(!D) return;
    const d=D.V[p.j];
    for(const e of p.ev){
      if(e.type==="on_hit"){
        d.hp=e.hp; d.flash0=c; d.sx=1.2; d.sy=0.84; d.knock=(p.i?-1:1)*(e.crit?10:5);
        d.anim="hit"; d.t0=c;
        D.V[p.i].hp=e.hpA;
        D.vfx.push({kind:"slash",x:d.bx,y:d.y-36,dir:p.i?-1:1,crit:!!e.crit,t0:c,dur:240});
        if(e.crit) D.vfx.push({kind:"crit",x:d.bx,y:d.y,t0:c,dur:340});
        D.fl.push({s:e.dmg>0?"-"+e.dmg:"Absorbé",x:d.bx,y:d.y-76,c0:c,col:e.crit?"#ffb000":"#ffffff",big:e.crit});
      }
      if(e.type==="on_dodge"){
        d.knock=(p.i?-1:1)*10; d.air=10; d.anim="dodge"; d.t0=c;
        D.fl.push({s:"Esquive",x:d.bx,y:d.y-76,c0:c,col:"#e8a830"});
      }
      if(e.type==="on_dot"){
        const a=D.V[e.i]; a.hp=e.hpA; a.flash0=c;
        D.fl.push({s:"-"+e.dmg,x:a.bx,y:a.y-76,c0:c,col:"#c58be0"});
      }
      if(e.type==="on_skill"){
        const a=D.V[e.i], t=D.V[e.j];
        if(e.hpA>a.hp) D.fl.push({s:"+"+(e.hpA-a.hp),x:a.bx,y:a.y-76,c0:c,col:"#9be15d"});
        a.hp=e.hpA; t.hp=e.hp;
        if(e.fl) D.fl.push({s:e.fl,x:a.bx,y:a.y-96,c0:c,col:"#ffd27a"});
      }
      if(e.type==="on_death"){
        const dead=D.V[e.dead]; dead.anim="death"; dead.t0=c;
        const pt=D.P.find(q=>q.i===e.dead); if(pt){ pt.anim="death"; pt.t0=c; }
      }
    }
  },
  afterDuelTurn(c){
    const D=this.duel; if(!D) return;
    if(D.eng.over){
      const w=D.V[D.eng.winner]; w.win=true; w.anim="victory"; w.t0=c;
    D.ph={k:"end",t:c+1000};
} else {
this.nextDuelTurn(c);
}
},
  endBossDuel(){
    const D=this.duel, b=S.cur; if(!D||!b) return;
    const won=D.eng.winner===0, w=this.wave;
    this.clearDuel();
    if(won){
      this.rollWaveLoot(w);
      const bonusOr=Math.max(25,w*12);
      GameState.ressources.or+=bonusOr;
      if(w%20===0){
        GameState.ressources.capsules=(GameState.ressources.capsules||0)+1;
        this.spawnFloatingLoot(`🏆 BOSS V.${w} VAINCU : +${bonusOr} Or & +1 🥚 CAPSULE !`,"#5ef2ff");
      } else {
        GameState.ressources.parchemins+=1;
        this.spawnFloatingLoot(`🏆 BOSS V.${w} VAINCU : +${bonusOr} Or & +1 📜 !`,"#ffd166");
      }
      if(w>=(b.afkWaveMax||1)) b.afkWaveMax=w+1;
      if(this.pushMode){ this.wave=w+1; b.afkWave=this.wave; }
    } else {
      this.wallWave=w;
      this.pushMode=false;
      this.wave=Math.max(1,w-1);
      b.afkWave=this.wave;
      this.spawnFloatingLoot(`💀 Défaite Boss V.${w} (Farm V.${this.wave})`,"#ff6b6b");
    }
    GameState.save();
    this.spawnWave();
  },
  syncBossDuel(c){
    const D=this.duel; if(!D||!this.field) return;
    const sw=this.field.clientWidth||800, sh=this.field.clientHeight||450;
    [...D.V,...D.P].forEach(f=>{
      if(!f._domEl||!f._domCtx) return;
      const [an,n]=renderer.animFrame(f,c);
      const wid=!f.pet&&f.wpn&&Number.isInteger(f.wpn.id)?f.wpn.id:null;
      const ctx=f._domCtx;
      if(f.pet) renderer.drawPet(ctx,f,an,n);
      else renderer.drawBrute(ctx,f.b,c,an,n,wid);
      const fl=Math.max(0,1-(c-f.flash0)/180);
      if(fl>0){
        ctx.globalCompositeOperation="source-atop";
        ctx.fillStyle=`rgba(255,255,255,${fl})`;
        ctx.fillRect(0,0,64,64);
        ctx.globalCompositeOperation="source-over";
      }
      f.sx=f.sx===undefined?1:f.sx+(1-f.sx)*0.22;
      f.sy=f.sy===undefined?1:f.sy+(1-f.sy)*0.22;
      f.knock=f.knock===undefined?0:f.knock*0.80;
      if(f.anim==="idle"&&f.air>0) f.air*=0.78;
      const hop=(f.win?Math.abs(Math.sin(c/180))*8:0)+(f.air||0);
      const px=((f.x+f.knock)/400)*sw;
      const py=((188-f.y+hop)/225)*sh;
      const sc=(f.scale||1)*(wid===10?1.34:1);
      f._domEl.style.transform=`translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
      const fp=f.flip&&!f.win;
      f._domCv.style.transform=`scale(${(fp?-1:1)*sc*f.sx},${sc*f.sy})`;
if(!f.pet&&f._domHp){
const dt=Math.min(60,Math.max(0,c-(f.pc===undefined?c:f.pc))); f.pc=c;
if(f.lastHp===undefined) f.lastHp=f.hp;
if(f.hp<f.lastHp) f.hit0=c;
f.lastHp=f.hp;
if(f.dh<f.hp) f.dh=f.hp; else if(c-f.hit0>450) f.dh+=(f.hp-f.dh)*Math.min(1,dt/260);
if(f.dh-f.hp<.05) f.dh=f.hp;
f._domHp.style.width=Math.max(0,Math.min(100,(f.hp/Math.max(1,f.max))*100)).toFixed(1)+"%";
f._domDh.style.width=Math.max(0,Math.min(100,(f.dh/Math.max(1,f.max))*100)).toFixed(1)+"%";
if(f._domBadges&&f.st&&f.hp>0){
const st=f.st, bdg=[];
if(st.stun>0) bdg.push("💫");
if(st.shield>0) bdg.push("🛡️");
if(st.block>0) bdg.push("🧱");
if(st.dr) bdg.push("🔰");
if(st.reflect) bdg.push("🪞");
if(st.dodge) bdg.push("💨");
if(st.spdUp>0) bdg.push("⚡");
if(st.rage>0) bdg.push("💢");
if(st.slow>0) bdg.push("❄️");
if(st.accD) bdg.push("🌫️");
if(st.dot&&st.dot.some(d=>d.n>0)) bdg.push("🩸");
const sig=bdg.join("");
if(f._lastSig!==sig){ f._lastSig=sig; f._domBadges.textContent=sig; }
} else if(f._domBadges&&f._lastSig){ f._lastSig=""; f._domBadges.textContent=""; }
}
});
const fxCv=$("#cv-afk-fx");
if(fxCv){
const ctx=fxCv.getContext("2d");
renderer.drawArena(ctx,{V:D.V,P:[],fl:D.fl,vfx:D.vfx,proj:D.proj,pan:-1,fade:0,shake0:-1e6,preview:true},c);
}
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
