"use strict";
/* ================= UI ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const renderer=new CanvasRenderer();
renderer.ar=DataEngine.ARENAS.map(src=>{const i=new Image();i.src=encodeURI(src);return i});
const S={cur:null,forgeKey:null};

function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove("show"),2200)}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function seg(v,max,cls){let h=`<div class="seg ${cls}">`;const n=14,f=Math.ceil(v/max*n);for(let i=0;i<n;i++)h+=`<i class="${i<f?"on":""}"></i>`;return h+"</div>"}
/* =====================================================================
   ÉTAPE 1 — ARCHITECTURE MOBILE : routeur d'overlays, énergie, AFK, Caserne, Boss
   ===================================================================== */

/* ---------- Routeur de pop-ups (pile d'overlays au-dessus de l'accueil) ---------- */

const OV={
  stack:[],
  reg:{
    caserne:{pane:"g-fiche",onOpen(){ renderFiche(S.cur); Caserne.snap(0); }},
    pvp:{pane:"g-combat",onOpen(){ if(!Combat.act) lancerCombat({mode:"triptyque"}); },onClose(){ Combat.stop(); }},
    cargos:{pane:"g-shop"},
    sim:{pane:"g-train",onOpen(){ TRAIN.open(); }},
    forge:{pane:"g-forge",onOpen(){ renderForge(); }},
    evo:{pane:"g-evo"},
    expe:{pane:"g-expe"},
    bossArmes:{pane:"g-boss",boss:"armes"},
    bossParchemins:{pane:"g-boss",boss:"parchemins"},
    bossFamilier:{pane:"g-boss",boss:"familier"},
    bossMondial:{pane:"g-boss",boss:"mondial"}
  },
  open(key){
    const m=this.reg[key]; if(!m||!S.cur||this.stack.includes(key)) return;
    hideTip();
    if(m.boss&&this.stack.includes("expe")) this.close("expe");   // le choix d'expédition se referme quand un boss est lancé
    if(m.boss) BossModes.prepare(m.boss);
    this.stack.push(key);
    const el=$("#"+m.pane); el.style.zIndex=50+this.stack.length*2; el.classList.add("active");
    document.body.classList.add("fx-open");
    if(m.onOpen) m.onOpen();
  },
  close(key){
    if($("#g-combat").classList.contains("world-boss-screen")&&(Combat.act||Combat.ready)) return;
    const i=this.stack.indexOf(key); if(i<0) return;
    this.stack.splice(i,1);
    const m=this.reg[key], el=$("#"+m.pane); el.classList.remove("active"); el.style.zIndex="";
    if(m.onClose) m.onClose();
    if(!this.stack.length) document.body.classList.remove("fx-open");
    hideTip();
  },
  closeTop(){ const k=this.stack[this.stack.length-1]; if(k) this.close(k); },
  closeAll(){ while(this.stack.length) this.closeTop(); }
};
// Délégation : bulles [data-open], boutons [data-close], clic sur le fond d'une sous-pop-up
const AFK_MENU_LAYOUT_KEY="arene_brutes_afk_menu_layout_v1";
const afkLayoutButtons=()=>Array.from($("#afk-menu").querySelectorAll(":scope > button")).concat($("#btn-harvest"));
function loadAfkMenuPositions(){
  try{
    const raw=localStorage.getItem(AFK_MENU_LAYOUT_KEY);
    if(!raw) return null;
    const saved=JSON.parse(raw), buttons=afkLayoutButtons();
    if(!saved||typeof saved!=="object"||Array.isArray(saved)||!buttons.every(button=>
      saved[button.id]&&Number.isFinite(saved[button.id].x)&&Number.isFinite(saved[button.id].y)&&
      saved[button.id].x>=0&&saved[button.id].x<=1&&saved[button.id].y>=0&&saved[button.id].y<=1)){
      console.warn("Disposition AFK sauvegardée invalide; les positions par défaut seront utilisées.");
      return null;
    }
    return saved;
  }catch(error){ console.error("Impossible de charger la disposition des boutons AFK.",error); return null; }
}
let afkMenuPositions=loadAfkMenuPositions(), afkButtonDrag=null, afkClickToSuppress=null, afkLastOpenTs=0, devMenuWasOpen=false;
function setAfkMenuOpen(open){
  const menu=$("#afk-menu"), toggle=$("#afk-menu-toggle");
  menu.classList.toggle("open",open);
  toggle.setAttribute("aria-expanded",String(open)); toggle.setAttribute("aria-label",open?"Fermer le menu":"Ouvrir le menu");
  toggle.textContent=open?"×":"☰";
}
function applyAfkButtonPosition(button,position){
  if(button.id==="btn-harvest"){
    const stage=$("#afk-stage"), loot=button.closest(".afk-loot");
    button.classList.add("afk-positioned");
    button.style.left=(position.x*stage.offsetWidth-loot.offsetLeft)+"px";
    button.style.top=(position.y*stage.offsetHeight-loot.offsetTop)+"px";
  }else{
    button.style.left=(position.x*100)+"%"; button.style.top=(position.y*100)+"%"; button.style.right="auto"; button.style.transform="none";
  }
}
function applyAfkMenuPositions(){
  $("#afk-menu").classList.add("is-positioned");
  afkLayoutButtons().forEach(button=>{
    const position=afkMenuPositions[button.id];
    if(!position) return;
    applyAfkButtonPosition(button,position);
  });
}
function saveAfkMenuPositions(){
  try{ localStorage.setItem(AFK_MENU_LAYOUT_KEY,JSON.stringify(afkMenuPositions)); }
  catch(error){ console.error("Impossible de sauvegarder la disposition des boutons AFK.",error); }
}
if(afkMenuPositions) applyAfkMenuPositions();
document.addEventListener("pointerdown",e=>{
  if(!$("#devbox")||!e.isPrimary||(e.button!==0&&e.pointerType!=="touch")) return;
  const button=e.target.closest&&e.target.closest("#btn-harvest, .afk-menu.is-editing>button");
  if(!button||!$("#afk-menu").classList.contains("is-editing")) return;
  const rect=button.getBoundingClientRect();
  afkButtonDrag={button,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,moved:false};
},true);
document.addEventListener("pointermove",e=>{
  if(!afkButtonDrag||e.pointerId!==afkButtonDrag.pointerId) return;
  const drag=afkButtonDrag, stage=$("#afk-stage"), rect=stage.getBoundingClientRect();
  if(!drag.moved&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<3) return;
  drag.moved=true; drag.button.classList.add("is-dragging"); e.preventDefault();
  const buttonRect=drag.button.getBoundingClientRect();
  const left=Math.max(0,Math.min(rect.width-buttonRect.width,e.clientX-rect.left-drag.offsetX));
  const top=Math.max(0,Math.min(rect.height-buttonRect.height,e.clientY-rect.top-drag.offsetY));
  const x=left/rect.width,y=top/rect.height;
  applyAfkButtonPosition(drag.button,{x,y});
  afkMenuPositions[drag.button.id]={x,y};
},true);
document.addEventListener("pointerup",e=>{
  if(!afkButtonDrag||e.pointerId!==afkButtonDrag.pointerId) return;
  if(afkButtonDrag.moved){
    afkClickToSuppress=afkButtonDrag.button;
    saveAfkMenuPositions();
    const draggedButton=afkClickToSuppress;
    window.setTimeout(()=>{ if(afkClickToSuppress===draggedButton) afkClickToSuppress=null; },500);
  }
  afkButtonDrag.button.classList.remove("is-dragging"); afkButtonDrag=null;
},true);
document.addEventListener("pointercancel",()=>{
  if(!afkButtonDrag) return;
  if(afkButtonDrag.moved) saveAfkMenuPositions();
  afkButtonDrag.button.classList.remove("is-dragging"); afkButtonDrag=null;
},true);
document.addEventListener("click",e=>{
  if(!afkClickToSuppress||!e.target.closest||e.target.closest("button")!==afkClickToSuppress) return;
  e.preventDefault(); e.stopImmediatePropagation(); afkClickToSuppress=null;
},true);
document.addEventListener("click",e=>{
  const devToggle=e.target.closest&&e.target.closest("#afk-dev-toggle");
  if(devToggle){ toggleDevMode(); return; }
  const toggle=e.target.closest&&e.target.closest("#afk-menu-toggle");
  if(toggle){
    setAfkMenuOpen(!$("#afk-menu").classList.contains("open")); return;
  }
  const o=e.target.closest&&e.target.closest("[data-open]"); if(o){ e.preventDefault(); e.stopPropagation(); afkLastOpenTs=e.timeStamp; OV.open(o.dataset.open); const menu=o.closest("#afk-menu"); if(menu) setAfkMenuOpen(false); return; }
  if(e.target.closest&&e.target.closest("[data-close]")){ OV.closeTop(); return; }
  if(e.target.classList&&e.target.classList.contains("ov-sub")){ if(e.timeStamp-afkLastOpenTs<100) return; OV.closeTop(); }
});
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape"||!OV.stack.length) return;
  const fb=$("#fx-best"); if(fb&&!fb.classList.contains("hidden")){ fb.classList.add("hidden"); return; }
  OV.closeTop();
});
/* ---------- Frise d'évolution d'un compagnon (clic sur une case allumée) ---------- */
const EVO_SPRITES={};   // ← VOS SPRITES : EVO_SPRITES["chien:0"]="sprites/cyber-chauve.png" (clé = famille:index 0-2). Vide = emoji de la famille.
function openEvo(key){
  const f=CompanionData.FAMILIES.find(x=>x.key===key), c=S.cur&&S.cur.companion, E=FX.esc; if(!f) return;
  const form=(c&&CompanionData.family(c)===f)?(c.form||1):0;       // 0 = famille non débloquée
  const bgUrl=DataEngine.getCompanionBg(S.cur&&S.cur.sprite);
  const evoPane=$("#g-evo");
  if(evoPane) evoPane.style.background=`linear-gradient(rgba(10,8,6,.55),rgba(10,8,6,.75)),url("${bgUrl}") center/cover no-repeat`;
  $("#evo-title").textContent=f.name+" · évolutions";
  $("#evo-body").innerHTML='<div class="evo-line">'+f.stages.map((n,i)=>{
    const un=form>i, im=EVO_SPRITES[key+":"+i]||DataEngine.getCompanionArt(key,i+1);
    return (i?'<span class="evo-arrow">➜</span>':"")+`<div class="evo-card st${i+1} ${un?"on":"off"} ${form===i+1?"cur":""}"><div class="evo-spr"><img src="${E(im)}" alt="${E(n)}"></div><b>${E(n)}</b><small>${FX.STAGE[i]} · niv. ${CompanionData.EVO_LEVELS[i]}</small>${un?"":"<em>🔒</em>"}</div>`; }).join("")
    +`</div><p class="evo-spec">${E(f.spec)}${f.legend?" · "+E(f.legend):""}</p>`;
  OV.open("evo");
}
// Compatibilité avec les anciens appels gameTab("combat"|"fiche"|"forge"|"shop"|"train")
function gameTab(n){ const k={combat:"pvp",fiche:"caserne",forge:"forge",shop:"cargos",train:"sim"}[n]; if(k) OV.open(k); else OV.closeAll(); }

/* ---------- Caserne : carrousel 2D plat en boucle infinie (PORTRAIT) ---------- */
/* En PAYSAGE, le CSS garde les 3 colonnes côte à côte : ce code ne fait alors rien (aucune transformation CSS n'est appliquée). */
const Caserne={
  idx:0,N:5,prev:[],mode:"",sx:0,sy:0,st:0,dx:0,swiped:0,
  portrait(){ return matchMedia("(orientation:portrait)").matches; },
  init(){
    this.body=$("#fx .fx-body"); this.cols=[...this.body.children]; this.pager=$$("#fx-pager button[data-p]");
    this.pager.forEach(b=>b.onclick=()=>this.snap(+b.dataset.p));
    const bd=this.body;
    bd.addEventListener("touchstart",e=>{
      if(!this.portrait()||e.touches.length!==1){ this.mode="x"; return; }
      const t=e.touches[0]; this.sx=t.clientX; this.sy=t.clientY; this.st=e.timeStamp; this.dx=0; this.mode="";
    },{passive:true});
    bd.addEventListener("touchmove",e=>{
      if(this.mode==="x"||this.mode==="v"||!e.touches.length) return;
      const t=e.touches[0], dx=t.clientX-this.sx, dy=t.clientY-this.sy;
      if(!this.mode){                                   // verrouillage d'axe : horizontal = swipe, vertical = défilement natif
        if(Math.abs(dx)<8&&Math.abs(dy)<8) return;
        this.mode=Math.abs(dx)>Math.abs(dy)*1.2?"h":"v";
        if(this.mode==="h"){ bd.classList.add("drag"); hideTip(); }
      }
      if(this.mode==="h"){ this.dx=dx; bd.style.setProperty("--drag",dx+"px"); }
    },{passive:true});
    const end=e=>{
      if(this.mode!=="h"){ this.mode=""; return; }
      const dx=this.dx, dt=Math.max(1,e.timeStamp-this.st), w=bd.clientWidth||1;
      this.mode=""; this.swiped=Date.now();
      bd.classList.remove("drag"); bd.style.setProperty("--drag","0px");
      if(e.type==="touchend"&&(Math.abs(dx)>w*.22||(Math.abs(dx)>28&&Math.abs(dx)/dt>.45))) this.go(dx<0?1:-1);   // distance OU vitesse (flick)
    };
    bd.addEventListener("touchend",end,{passive:true}); bd.addEventListener("touchcancel",end,{passive:true});
    bd.addEventListener("click",e=>{ if(Date.now()-this.swiped<350){ e.stopPropagation(); e.preventDefault(); } },true);   // un swipe ne déclenche pas d'info-bulle
    this.layout();
  },
  layout(){
    setTab(this.idx);
  },
  go(d){ this.idx=(this.idx+d+this.N)%this.N; hideTip(); this.layout(); },
  snap(i){ this.idx=Math.max(0,Math.min(this.N-1,+i||0)); hideTip(); this.layout(); }
};
/* ---------- Onglets de la Caserne ---------- */
function setTab(i){
  const cols=[...document.querySelectorAll("#fx .fx-body > .fx-col")];
  const btns=[...document.querySelectorAll("#fx-pager button[data-p]")];
  i=Math.max(0,Math.min(cols.length-1,+i||0));
  cols.forEach((c,k)=>c.classList.toggle("tab-active",k===i));
  btns.forEach((b,k)=>b.classList.toggle("on",k===i));
  Caserne.idx=i;
  hideTip();
}
/* ---------- ÉNERGIE : +1 toutes les 15 min (max = energyMax), même app fermée ---------- */
/* La variable existante b.energy / b.energyMax est réutilisée (aucun doublon). On ajoute seulement b.energyTs = début du cycle de recharge (Date.now()). */
const Energy={
  INTERVAL:15*60*1000,
  init(b){
    if(!Number.isFinite(b.energyMax)||b.energyMax<=0) b.energyMax=15;
    if(!Number.isFinite(b.energy)) b.energy=b.energyMax;
    b.energy=Math.max(0,Math.min(b.energyMax,Math.floor(b.energy)));
    if(!Number.isFinite(b.energyTs)) b.energyTs=Date.now();
    return this.sync(b);
  },
  sync(b,now=Date.now()){
    if(!b) return false;
    if(b.energy>=b.energyMax){ b.energyTs=now; return false; }      // jauge pleine : le cycle redémarrera à la 1re dépense
    let changed=false;
    if(now<b.energyTs){ b.energyTs=now; changed=true; }             // horloge reculée : on ne bloque pas la recharge
    const n=Math.floor((now-b.energyTs)/this.INTERVAL);
    if(n>0){ b.energy=Math.min(b.energyMax,b.energy+n); b.energyTs=b.energy>=b.energyMax?now:b.energyTs+n*this.INTERVAL; changed=true; }
    if(changed&&S.cur===b) persist();                                // sauvegarde localStorage + rafraîchit les jauges ⚡ existantes
    return changed;
  },
  left(b,now=Date.now()){ return b.energy>=b.energyMax?0:Math.max(0,this.INTERVAL-(now-b.energyTs)); },
  fmt(ms){ const t=Math.ceil(ms/1000), m=Math.floor(t/60), s=t%60; return m+":"+String(s).padStart(2,"0"); },
  // Pour les futurs modes (PvP, Boss…) : if(Energy.spend(S.cur,1)){ …lancer le combat… }
  spend(b,n=1){
    this.sync(b); if(b.energy<n) return false;
    if(b.energy>=b.energyMax) b.energyTs=Date.now();                 // le cycle démarre au moment de la dépense
    b.energy-=n; if(S.cur===b) persist(); return true;
  }
};