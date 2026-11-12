"use strict";
/* ---------- MODE AFK / IDLE (écran d'accueil par défaut) ---------- */
const AFK_ASSETS={
  BG_IMAGE:"",          // décor de secours si une brute n'a pas d'AFK1
  HERO_SIZE:156,         // taille d'affichage (px) de la brute
  MINION_SPRITES:["inversebrah"] // clés de sprites dans DataEngine.SPRITES (ex: ["inversebrah"])
};
const AFKMode={
  get RATE(){ return GameState.tauxOrAfk(); },               // Or par seconde (source unique : state.js)
  CAP_SEC:4*3600,                                            // plafond de la jauge de butin (4 h hors-ligne = 28 800 Or). Modifiable.
  COLORS:["#c0392b","#e67e22","#8e44ad","#16a085","#2980b9","#f1c40f"],
  run:false,raf:0,last:0,minions:[],dying:[],wave:1,nextWave:0,W:300,hudT:0,_bgKey:"",bgWidth:1376,bgHeight:768,
  attacks:[["punch",5],["thrust",5],["overhead",4],["uppercut",1.5],["pierce",1.5],["meteor",1]],
  KILLS:{punch:1,thrust:1,overhead:2,uppercut:1,pierce:2,meteor:3},   // minions tués par attaque
  lastAttack:"",recoilDistance:40,heroX:0,heroPhase:"idle",heroAnim:"idle",heroFrom:0,heroTo:0,heroPhaseStart:0,heroDuration:0,attackImpactAt:0,attackImpact:false,
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
    return choices[choices.length-1][0];
  },
  beginAttack(){
    const name=this.chooseAttack(), duration=4*1000/CanvasRenderer.ANIMS[name].fps;
    this.lastAttack=name; this.heroPhase="attack"; this.heroAnim=name;
    this.heroPhaseStart=renderer.clock; this.heroDuration=duration/1000;
    this.attackImpactAt=duration*.8; this.attackImpact=false;
  },
  resolveAttack(){
    const c=renderer.clock;
    for(let n=this.KILLS[this.lastAttack]||1;n>0&&this.minions.length;n--){
      const f=this.minions.shift(); f.anim="death"; f.t0=c; f.el.classList.add("die"); this.dying.push(f);
    }
    this.attackImpact=true;
    if(!this.minions.length) this.nextWave=.7;
    this.moveHero("recoil",this.centerX()-this.recoilDistance,260);
  },
  fitStage(){
    const grid=$("#home-grid"); if(!grid||!this.stage||!grid.clientWidth||!grid.clientHeight) return;
    const ratio=this.bgWidth/this.bgHeight;
    const height=Math.min(grid.clientHeight,grid.clientWidth/ratio);
    const width=height*ratio;
    this.stage.style.setProperty("--afk-ratio",this.bgWidth+" / "+this.bgHeight);
    this.stage.style.width=width+"px"; this.stage.style.height=height+"px";
  },
  
  // NOUVELLE FONCTION CORRIGÉE ET HARMONISÉE
  setBg(b=S.cur){
    if(!this.stage||!b) return;
    const raw=b.spriteKey||b.key||b.speciesKey||b.sprite||b.species||"";
    let k=String(raw).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
    const brawler=DataEngine.BRAWLERS.find(name=>k.startsWith(name));
    k=brawler||"general";
    if(k===this._bgKey) return;
    this._bgKey=k;

    const tryExt=(exts)=>{
    if(!exts.length){ this.stage.style.setProperty("--afk-bg-img",AFK_ASSETS.BG_IMAGE?"url('"+new URL(encodeURI(AFK_ASSETS.BG_IMAGE),document.baseURI).href+"')":"none"); this.bgWidth=1376; this.bgHeight=768; this.fitStage(); return; }
      const p = assetPath.afk(k, 1, exts[0]);
      const im=new Image();
      im.onload=()=>{ this.stage.style.setProperty("--afk-bg-img","url('"+im.src+"')"); this.bgWidth=im.naturalWidth; this.bgHeight=im.naturalHeight; this.fitStage(); };
      im.onerror=()=>tryExt(exts.slice(1));
      im.src=p;
    };
    tryExt(["jpg","jpeg","png"]);
  },

  
  init(){
    this.field=$("#afk-field"); this.hero=$("#afk-hero"); this.stage=$("#afk-stage");
    this.setBg();
    this.hero.style.width=this.hero.style.height=AFK_ASSETS.HERO_SIZE+"px";
    $("#btn-harvest").onclick=()=>this.harvest();
    addEventListener("resize",()=>{ this.measure(); this.fitStage(); });
    if("ResizeObserver" in window){ this.resizeObserver=new ResizeObserver(()=>{ this.measure(); this.fitStage(); }); this.resizeObserver.observe($("#home-grid")); }
  },
  initBrute(b){                                              // champs ajoutés aux anciennes sauvegardes
    if(!Number.isFinite(b.afkTs)||b.afkTs>Date.now()) b.afkTs=Date.now();
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
    const g=this.pending(b), max=this.CAP_SEC*this.RATE;
    $("#afk-count").textContent=g.toLocaleString("fr-FR")+" Or";
    $("#afk-bar").style.width=(g>0?Math.max(1.5,g/max*100):0)+"%";
    $("#afk-capacity").textContent="Capacité : "+max.toLocaleString("fr-FR")+" Or ("+(this.CAP_SEC/3600)+" h)";
    $("#afk-rate").textContent="+"+this.RATE.toLocaleString("fr-FR")+" Or / sec";
    $("#afk-power").textContent="⚔️ Puissance : "+calculerPuissance().toLocaleString("fr-FR");
    const bt=$("#btn-harvest"); bt.disabled=g<=0; bt.classList.toggle("ready",g>0);
  },
  measure(){ if(this.field) this.W=this.field.clientWidth||300; },
  // --- scène de combat automatique (purement visuelle) ---
  start(){
    if(!S.cur||this.run) return;
    this.run=true; this.measure(); this.wave=1; this.clearMinions(); this.spawnWave(); this.hud();
    this.lastAttack="";
    this.heroX=Math.min(this.centerX(),Math.max(0,this.W*.1));
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
    $("#afk-wave").textContent="Vague "+this.wave;
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
  rel(el,parent){                                            // rect de el relatif à la padding-box de parent
    const a=el.getBoundingClientRect(), b=parent.getBoundingClientRect();
    const ox=b.left+parent.clientLeft-parent.scrollLeft, oy=b.top+parent.clientTop-parent.scrollTop;
    return {cx:a.left-ox+a.width/2, cy:a.top-oy+a.height/2, y:a.top-oy, b:a.bottom-oy, h:a.height};
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
    void e.offsetWidth;                                      // force le reflow : sans ça la transition peut ne jamais démarrer
    Object.assign(e.style,to);
    setTimeout(()=>e.remove(),ms+30);
  },
  step(dt){
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
    if(!this.minions.length&&this.nextWave>0){ this.nextWave-=dt; if(this.nextWave<=0){ this.wave++; this.spawnWave(); } }
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
