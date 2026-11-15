"use strict";
/* ---------- Jeu : entrée / sortie ---------- */
function enterGame(b){
  S.cur=b; CharacterSelect.hide(); $("#screen-game").classList.remove("hidden");
  try{ localStorage.setItem("arene_brutes_last",b.id); }catch(e){}
  Energy.init(b); AFKMode.initBrute(b);
  OV.closeAll(); renderGame(); if(afkMenuPositions) applyAfkMenuPositions(); AFKMode.start(); AFKMode.hud(); window.scrollTo(0,0);
}
// Ticker 1 s : recharge d'énergie + compteur AFK en direct ; resynchronisation immédiate au retour dans l'onglet
setInterval(()=>{ if(!S.cur||$("#screen-game").classList.contains("hidden")) return; Energy.sync(S.cur); AFKMode.hud(); },1000);
document.addEventListener("visibilitychange",()=>{ if(!document.hidden&&S.cur){ Energy.sync(S.cur); AFKMode.hud(); AFKMode.measure(); } });
AFKMode.init(); Caserne.init();
function persist(){ GameState.save(); renderGame(); GameState.majRate(); }
function renderGame(){
  const b=S.cur; if(!b) return;
  renderFiche(b);
  renderForge();
}


/* ================= Armurerie 16:9 (fiche paysage) ================= */
const FX={
  STATS:[["hp","Vie","❤️"],["str","Force","💪"],["agi","Agilité","🌀"],["spd","Rapidité","⚡"]],
  STAT_TIP:{
    hp:"Chaque point donne +10 PV max et réduit un peu les dégâts reçus.",
    str:"Augmente les dégâts de tous vos coups et la solidité des boucliers.",
    agi:"Améliore la précision et les chances de coup critique.",
    spd:"Réduit le délai entre deux actions : vous jouez plus souvent."
  },
  STYLE:{light:"Arme légère",heavy:"Arme lourde",throw:"Arme de jet"},
  TYPE:{A:"Attaque",C:"Contrôle",S:"Soutien"},
  STAGE:["Base","Milieu","Légende"],
  REVEAL_SKILLS:false,   // false = comme les armes : les compétences non apprises restent mystérieuses
  fmt:n=>String(Math.round(n*100)/100).replace(".",","),
  esc:s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])),
  // Traduit l'objet "fx" d'une compétence en lignes lisibles
  effects(fx){
    const p=v=>Math.round(v*100)+" %", T=n=>n+" tour"+(n>1?"s":""), o=[];
    for(const [k,v] of Object.entries(fx||{})){
      switch(k){
        case "acc": o.push("Précision "+(v>0?"+":"−")+Math.abs(v)+" %"); break;
        case "crit": o.push("Critique +"+p(v)); break;
        case "pierce": o.push("Ignore l’armure adverse"); break;
        case "stun": o.push(v>=1?"Étourdit à coup sûr":"Étourdissement : "+p(v)); break;
        case "dr": o.push("Dégâts reçus −"+p(v[0])+" · "+T(v[1])); break;
        case "rage": o.push("Rage : dégâts accrus quand les PV baissent"); break;
        case "dodge": o.push("Esquive +"+v[0]+" % · "+T(v[1])); break;
        case "dot": o.push(v[2][0].toUpperCase()+v[2].slice(1)+" · "+T(v[1])); break;
        case "recoil": o.push("Recul subi : "+p(v)); break;
        case "accD": o.push("Précision adverse −"+v[0]+" % · "+T(v[1])); break;
        case "slow": o.push("Ralentit l’adversaire · "+T(v)); break;
        case "shield": o.push("Bouclier : 8 + "+FX.fmt(v)+" × Force"); break;
        case "delay": o.push("Retarde l’initiative adverse"); break;
        case "sure": o.push("Touche toujours"); break;
        case "heal": o.push("Soigne "+p(v)); break;
        case "cleanse": o.push("Purge les altérations"); break;
        case "spdUp": o.push("Rapidité accrue · "+T(v)); break;
        case "dispel": o.push("Annule les bonus adverses"); break;
        case "selfDelay": o.push("Préparation lente"); break;
        case "block": o.push("Bloque le prochain coup"); break;
        case "reflect": o.push("Renvoie "+p(v[0])+" des dégâts · "+T(v[1])); break;
        case "push": o.push("Propulse l’adversaire"); break;
      }
    }
    return o;
  }
};
function fxFam(c){ return CompanionData.family(c)||{key:"?",icon:"🐾",name:c.name,stages:[c.name,c.name,c.name],spec:"Compagnon polyvalent"}; }
function fxBuffs(){ try{ return ProfileManager.getBuffs(); }catch(e){ return null; } }

/* --- Contenu des info-bulles : data-tip="<type>:<id>" --- */
function tipHTML(code){
  const b=S.cur, D=DataEngine, [k,id]=code.split(":"), E=FX.esc;
  const bar=(l,v)=>`<div class="tb"><span>${l}</span><em><b style="width:${v*10}%"></b></em><u>${v}</u></div>`;
  if(!b) return "";
  if(k==="w"){
    const w=D.WEAPONS[+id]; if(!w) return "";
    const own=b.weapons.includes(w.id);
    const lv=(typeof GameState!=="undefined"&&GameState.maitriseArmes?.[w.id])||(b.weaponLevels?.[w.id])||0;
    const bonus=lv>0?` +${lv}`:"";
    return own?`<h4>${w.icon} ${E(w.name)}${bonus}</h4><p>${E(w.desc)}</p>${bar("Dégâts",w.dmg)}${bar("Vitesse",w.spd)}${bar("Précision",w.prec)}${bar("Critique",w.crit)}<div class="fxl k">Catégorie : ${FX.STYLE[w.type]||"—"}</div>`
      :`<h4>? Arme inconnue</h4><p>Piratez une caisse de sécurité Wass-E pour la découvrir.</p>`;
  }
  if(k==="s"){
    const s=D.SKILLS[+id], own=b.skills.includes(s.id), col=D.EL_COL[s.el];
    if(!own&&!FX.REVEAL_SKILLS) return `<h4>? Compétence inconnue</h4><p>Elle se révélera en combat ou à l’Éveil divin.</p>`;
    const fx=FX.effects(s.fx);
    return `<h4 style="color:${col}">${D.EL_ICON[s.el]} ${E(s.name)}</h4>
      <p>${D.ELEMENTS[s.el]} · ${FX.TYPE[s.t]}</p>
      <div class="fxl">${E(s.desc)}</div>
      ${s.pw>0?`<div class="fxl k">Puissance ×${FX.fmt(s.pw)}</div>`:""}
      ${fx.map(x=>`<div class="fxl k">• ${E(x)}</div>`).join("")}
      <div class="fxl ${own?"":"lock"}">${own?"✔ Compétence apprise":"🔒 Non apprise"}</div>`;
  }
  if(k==="c"){
    const c=b.companion; if(!c) return "";
    const fam=fxFam(c), i=+id, form=c.form||1, lv=CompanionData.EVO_LEVELS[i], cur=form===i+1, reached=form>i+1;
    const pw=.7+(cur?c.level:lv)*.05;
    return `<h4>${fam.icon} ${E(fam.stages[i])}</h4>
      <p>${E(fam.name)} · <span class="st${i+1}" style="color:var(--c)">${FX.STAGE[i]}</span></p>
      <div class="fxl ${cur||reached?"":"lock"}">${cur?"✔ Forme actuelle · niv. "+c.level+"/"+CompanionData.LEVEL_CAP:reached?"Forme dépassée":"🔒 Évolution au niveau "+lv}</div>
      <div class="fxl k">Spécialité : ${E(fam.spec)}</div>
      <div class="fxl k">Intervient ~${Math.round(BattleEngine.PET_CHANCE*100)} % des tours</div>
      <div class="fxl k">Puissance ×${FX.fmt(pw)} ${cur?"":"(dès niv. "+lv+")"}</div>
      ${i===2&&fam.legend?`<div class="fxl k">${E(fam.legend)}</div>`:""}`;
  }
  if(k==="f"){
    const f=CompanionData.FAMILIES.find(x=>x.key===id), mine=b.companion&&CompanionData.family(b.companion)===f;
    return `<h4>${f.icon} ${E(f.name)}</h4><p>${E(f.spec)}</p>
      ${f.stages.map((n,i)=>`<div class="fxl"><span class="pill st${i+1}" style="color:var(--c)">${FX.STAGE[i]}</span>${E(n)} <span style="color:var(--dim)">niv. ${CompanionData.EVO_LEVELS[i]}</span></div>`).join("")}
      ${mine?`<div class="fxl k">★ Votre compagnon</div>`:""}`;
  }
  if(k==="st"){
    const lab=FX.STATS.find(s=>s[0]===id), bn=D.gearBonus(b,id), bf=fxBuffs(), m=(bf&&bf[id])||1, eff=BattleEngine.eff(b,id,bf);
    return `<h4>${lab[2]} ${lab[1]}</h4><p>${FX.STAT_TIP[id]}</p>
      <div class="fxl">Base : ${b.stats[id]}${bn?` · Équipement : +${bn}`:""}${m!==1?` · Ascension : ×${FX.fmt(m)}`:""}</div>
      <div class="fxl k">Valeur effective : ${eff}${id==="hp"?" → "+BattleEngine.maxHp(b,bf)+" PV":""}</div>`;
  }
  if(k==="g"){
    const p=D.PARTS.find(x=>x.id===id), best=b.gear.filter(g=>g.part===id).reduce((m,g)=>Math.max(m,g.rarity),-1), st=FX.STATS.find(s=>s[0]===D.PART_STAT[id]);
    return best<0?`<h4>${p.icon} ${p.name}</h4><p>Aucune pièce équipée.</p><div class="fxl k">Bonus : ${st[1]}</div><div class="fxl lock">Volez des caisses pour en trouver.</div>`
      :`<h4 style="color:${D.RARITIES[best].color}">${p.icon} ${p.name}</h4><p>${D.RARITIES[best].name}</p><div class="fxl k">+${D.GEAR_BONUS[best]} ${st[1]}</div>`;
  }
  return "";
}
function hideTip(){ $("#wtip").classList.add("hidden"); }
function showTip(el){
  const t=$("#wtip"), h=tipHTML(el.dataset.tip||""); if(!h){ hideTip(); return; }
  t.innerHTML=h; t.classList.remove("hidden"); t.style.left="0px"; t.style.top="0px";
  const r=el.getBoundingClientRect(), tw=t.offsetWidth, th=t.offsetHeight;
  t.style.left=Math.max(6,Math.min(innerWidth-tw-6,r.left+r.width/2-tw/2))+"px";
  t.style.top=(r.top-th-8<6?Math.min(innerHeight-th-6,r.bottom+8):r.top-th-8)+"px";
}
document.addEventListener("click",hideTip); addEventListener("scroll",hideTip,true);
(()=>{   // survol (souris), focus (clavier) et toucher : une seule délégation pour tout l'écran
  const fx=$("#fx"), T=e=>e.target.closest&&e.target.closest("[data-tip]");
  let tt=0; const touchy=()=>Date.now()-tt<1200;   // après un toucher, on ignore les mouseover/mouseout simulés par le navigateur
  fx.addEventListener("pointerdown",e=>{ if(e.pointerType!=="mouse") tt=Date.now(); },true);
  fx.addEventListener("mouseover",e=>{ if(touchy()) return; const el=T(e); if(el) showTip(el); });
  fx.addEventListener("mouseout",e=>{ if(touchy()) return; const el=T(e); if(el&&!el.contains(e.relatedTarget)) hideTip(); });
  fx.addEventListener("focusin",e=>{ const el=T(e); if(el) showTip(el); });
  fx.addEventListener("focusout",hideTip);
  fx.addEventListener("click",e=>{ const el=T(e); if(el){ e.stopPropagation(); showTip(el); } });
})();

/* --- Rendu de la fiche --- */
const WEAPON_RACK_LAYOUT_KEY="arene_armory_layout_global_v2";
let weaponRackEditing=false, weaponRackPositions=null, weaponRackDrag=null;
function validRackPositions(p){
  return Array.isArray(p)&&p.length===DataEngine.WEAPONS.length&&p.every((q,i)=>q&&q.id===i&&[q.x,q.y,q.size,q.angle].every(Number.isFinite));
}
function readWeaponRackPositions(){
  try{
    const saved=localStorage.getItem(WEAPON_RACK_LAYOUT_KEY);
    if(saved){
      const positions=JSON.parse(saved);
      if(validRackPositions(positions)) return positions;
    }
  }catch(error){}
  return null;
}
function saveWeaponRackPositions(){
  if(!weaponRackPositions) return;
  try{ localStorage.setItem(WEAPON_RACK_LAYOUT_KEY,JSON.stringify(weaponRackPositions)); }catch(error){}
  console.log("ARMORY_DEFAULT_LAYOUT =",JSON.stringify(weaponRackPositions.map(({id,x,y,size,angle,flip})=>({id,x:+x.toFixed(2),y:+y.toFixed(2),size:+size.toFixed(2),angle:+angle.toFixed(1),flip:!!flip}))));
}
function rackPositionBounds(position,grid){
  const angle=position.angle*Math.PI/180, size=position.size/100;
  const halfX=size*grid.clientHeight*(Math.abs(Math.cos(angle))+Math.abs(Math.sin(angle)))/2/grid.clientWidth*100;
  const halfY=size*(Math.abs(Math.cos(angle))+Math.abs(Math.sin(angle)))/2*100;
  return {left:position.x-halfX,right:position.x+halfX,top:position.y-halfY,bottom:position.y+halfY};
}
function clampRackPosition(position,grid){
  const bounds=rackPositionBounds(position,grid);
  const halfX=(bounds.right-bounds.left)/2,halfY=(bounds.bottom-bounds.top)/2;
  position.x=Math.max(halfX,Math.min(100-halfX,position.x));
  position.y=Math.max(halfY,Math.min(100-halfY,position.y));
  return position;
}
function applyRackPosition(button,position,grid){
  clampRackPosition(position,grid);
  const size=Math.max(0,grid.clientHeight*position.size/100);
  button.style.left=position.x+"%";
  button.style.top=position.y+"%";
  button.style.width=size+"px";
  button.style.height=size+"px";
  button.style.position="absolute";
  button.style.margin="0";
  button.style.transform=`translate(-50%,-50%) rotate(${position.angle}deg) scaleX(${position.flip?-1:1})`;
}
function beginWeaponRackEditing(grid){
  const buttons=[...grid.querySelectorAll(".fx-rack-weapon")];
  if(!grid.clientWidth||!grid.clientHeight) return;
  if(!weaponRackPositions){
    weaponRackPositions=readWeaponRackPositions()||ARMORY_DEFAULT_LAYOUT.map(p=>({...p}));
  }
  weaponRackEditing=true;
  grid.classList.add("is-editing");
  buttons.forEach(button=>applyRackPosition(button,weaponRackPositions[+button.dataset.rackWeapon],grid));
}
function attachWeaponRackEditor(grid){
  grid.addEventListener("pointerdown",event=>{
    if(!weaponRackEditing) return;
    const button=event.target.closest(".fx-rack-weapon");
    if(!button) return;
    event.preventDefault();event.stopPropagation();
    const id=+button.dataset.rackWeapon;
    weaponRackDrag={id,pointerId:event.pointerId,grid};
    button.setPointerCapture(event.pointerId);
  });
  grid.addEventListener("pointermove",event=>{
    if(!weaponRackDrag||event.pointerId!==weaponRackDrag.pointerId) return;
    const {id,grid}=weaponRackDrag,rect=grid.getBoundingClientRect(),position=weaponRackPositions[id];
    position.x=(event.clientX-rect.left)/rect.width*100;
    position.y=(event.clientY-rect.top)/rect.height*100;
    applyRackPosition(grid.querySelector(`[data-rack-weapon="${id}"]`),position,grid);
  });
  const finish=event=>{
    if(!weaponRackDrag||event.pointerId!==weaponRackDrag.pointerId) return;
    weaponRackDrag=null;
    saveWeaponRackPositions();
  };
  grid.addEventListener("pointerup",finish);
  grid.addEventListener("pointercancel",finish);
  grid.addEventListener("contextmenu",event=>{
    if(!weaponRackEditing) return;
    const button=event.target.closest(".fx-rack-weapon");
    if(!button) return;
    event.preventDefault();
    const pos=weaponRackPositions[+button.dataset.rackWeapon];
    if(pos){ pos.flip=!pos.flip; applyRackPosition(button,pos,grid); saveWeaponRackPositions(); }
  });
  grid.addEventListener("wheel",event=>{
    if(!weaponRackEditing) return;
    const button=event.target.closest(".fx-rack-weapon");
    if(!button) return;
    event.preventDefault();event.stopPropagation();
    const position=weaponRackPositions[+button.dataset.rackWeapon];
    if(event.shiftKey) position.angle+=event.deltaY<0?5:-5;
    else position.size=Math.max(8,Math.min(55,position.size+(event.deltaY<0?2:-2)));
    clampRackPosition(position,grid);
    applyRackPosition(button,position,grid);
    saveWeaponRackPositions();
  },{passive:false});
}
function updateWeaponRackDevUI(){
  const edit=$("#fx-rack-edit"),dev=!!$("#devbox"),panel=$(".fx-panel.fx-weapons");
  if(!edit||!panel) return;
  let bar=$("#fx-rack-devbar");
  if(!bar){
    bar=document.createElement("div");
    bar.id="fx-rack-devbar";
    bar.style.cssText="position:absolute;right:12px;bottom:12px;z-index:25;display:flex;gap:6px;align-items:center;background:rgba(10,8,6,.88);border:1px solid #c9953a;padding:4px 8px;border-radius:3px;font:11px monospace;color:#ffd77a";
    bar.innerHTML=`<button type="button" id="fx-rack-reset" class="fx-btn" style="width:auto!important;height:auto!important;min-height:0!important;padding:4px 8px!important;font-size:11px!important">↺ Reset</button>`;
    panel.appendChild(bar);
    bar.appendChild(edit);
    edit.style.cssText="position:static!important;width:auto!important;height:auto!important;min-height:0!important;padding:4px 8px!important;font-size:11px!important";
    bar.querySelector("#fx-rack-reset").onclick=()=>{
      try{ localStorage.removeItem(WEAPON_RACK_LAYOUT_KEY); localStorage.removeItem(ARMORY_HERO_KEY); }catch(e){}
      weaponRackPositions=ARMORY_DEFAULT_LAYOUT.map(p=>({...p}));
      armoryHeroPos={...ARMORY_HERO_DEFAULT};
      applyArmoryHeroStage($("#fx-armory-stage"));
      const grid=$("#fx-wrack .fx-rack-grid");
      if(grid) fitWeaponRack(grid.parentElement);
    };
  }
  bar.style.display=dev?"flex":"none";
  edit.hidden=!dev;
  edit.textContent=weaponRackEditing?"Terminer":"Éditer";
  edit.onclick=()=>{
    const grid=$("#fx-wrack .fx-rack-grid");
    if(!grid) return;
    if(weaponRackEditing){ weaponRackEditing=false;renderFiche(S.cur); }
    else{
      beginWeaponRackEditing(grid);
      $("#fx-armory-stage")?.classList.add("is-editing");
      edit.textContent="Terminer";
    }
  };
}
function fitWeaponRack(rack){
  const grid=rack.querySelector(".fx-rack-grid"), weapons=grid?[...grid.children]:[];
  if(!grid||!weapons.length||!grid.clientWidth||!grid.clientHeight) return;
  const saved=weaponRackPositions||(weaponRackPositions=readWeaponRackPositions())||ARMORY_DEFAULT_LAYOUT.map(p=>({...p}));
  grid.classList.toggle("is-editing",weaponRackEditing);
  weapons.forEach(button=>{ const p=saved[+button.dataset.rackWeapon]; if(p) applyRackPosition(button,p,grid); });
}
const weaponRackObserver=typeof ResizeObserver==="undefined"?null:new ResizeObserver(entries=>entries.forEach(({target})=>fitWeaponRack(target)));
const ARMORY_DEFAULT_LAYOUT=[{"id":0,"x":89.76,"y":50.13,"size":18,"angle":325,"flip":true},{"id":1,"x":10.12,"y":48.85,"size":15.5,"angle":35,"flip":false},{"id":2,"x":17.37,"y":38.34,"size":15.5,"angle":40,"flip":false},{"id":3,"x":25.96,"y":24.58,"size":20.5,"angle":65,"flip":true},{"id":4,"x":93.64,"y":34.3,"size":18.5,"angle":75,"flip":true},{"id":5,"x":82.95,"y":26.66,"size":16.5,"angle":-20,"flip":false},{"id":6,"x":82.89,"y":39.92,"size":16.5,"angle":75,"flip":false},{"id":7,"x":7,"y":35.58,"size":18.5,"angle":-72,"flip":false},{"id":8,"x":22.14,"y":78.19,"size":16,"angle":68,"flip":true},{"id":9,"x":81.49,"y":71.96,"size":21.5,"angle":297,"flip":true},{"id":10,"x":74.11,"y":22.56,"size":29,"angle":-10,"flip":false},{"id":11,"x":17.75,"y":94.21,"size":10,"angle":10,"flip":false},{"id":12,"x":23.28,"y":94.5,"size":10,"angle":-6,"flip":false},{"id":13,"x":28.37,"y":89.2,"size":12.5,"angle":11,"flip":true}];

const ARMORY_HERO_KEY="arene_armory_hero_pos_v2";
const ARMORY_HERO_DEFAULT={x:54.00,y:32.65,size:22.5,flip:false};
let armoryHeroPos=null, armoryHeroDrag=null;

function readArmoryHeroPos(){
  try{
    const raw=JSON.parse(localStorage.getItem(ARMORY_HERO_KEY)||"null");
    if(raw&&[raw.x,raw.y,raw.size].every(Number.isFinite)) return {...ARMORY_HERO_DEFAULT,...raw};
  }catch(e){}
  return {...ARMORY_HERO_DEFAULT};
}
function saveArmoryHeroPos(){
  if(!armoryHeroPos) return;
  try{ localStorage.setItem(ARMORY_HERO_KEY,JSON.stringify(armoryHeroPos)); }catch(e){}
  console.log("ARMORY_HERO_DEFAULT =",JSON.stringify({x:+armoryHeroPos.x.toFixed(2),y:+armoryHeroPos.y.toFixed(2),size:+armoryHeroPos.size.toFixed(1),flip:!!armoryHeroPos.flip}));
}
function applyArmoryHeroStage(stage){
  if(!stage) return;
  if(!armoryHeroPos) armoryHeroPos=readArmoryHeroPos();
  stage.style.left=armoryHeroPos.x+"%";
  stage.style.top=armoryHeroPos.y+"%";
  stage.style.width=armoryHeroPos.size+"%";
  stage.style.transform=`translate(-50%,-50%) scaleX(${armoryHeroPos.flip?-1:1})`;
}
function attachArmoryHeroEditor(stage,rack){
  if(!stage||stage.dataset.bound) return;
  stage.dataset.bound="1";
  stage.addEventListener("pointerdown",ev=>{
    if(!weaponRackEditing) return;
    ev.preventDefault(); ev.stopPropagation();
    armoryHeroDrag={pointerId:ev.pointerId};
    stage.setPointerCapture(ev.pointerId);
  });
  stage.addEventListener("pointermove",ev=>{
    if(!armoryHeroDrag||ev.pointerId!==armoryHeroDrag.pointerId) return;
    const rect=rack.getBoundingClientRect();
    armoryHeroPos.x=Math.max(10,Math.min(90,(ev.clientX-rect.left)/rect.width*100));
    armoryHeroPos.y=Math.max(15,Math.min(90,(ev.clientY-rect.top)/rect.height*100));
    applyArmoryHeroStage(stage);
  });
  const end=ev=>{
    if(!armoryHeroDrag||ev.pointerId!==armoryHeroDrag.pointerId) return;
    armoryHeroDrag=null; saveArmoryHeroPos();
  };
  stage.addEventListener("pointerup",end);
  stage.addEventListener("pointercancel",end);
  stage.addEventListener("contextmenu",ev=>{
    if(!weaponRackEditing) return;
    ev.preventDefault(); ev.stopPropagation();
    armoryHeroPos.flip=!armoryHeroPos.flip;
    applyArmoryHeroStage(stage); saveArmoryHeroPos();
  });
  stage.addEventListener("wheel",ev=>{
    if(!weaponRackEditing) return;
    ev.preventDefault(); ev.stopPropagation();
    armoryHeroPos.size=Math.max(20,Math.min(85,armoryHeroPos.size+(ev.deltaY<0?2.5:-2.5)));
    applyArmoryHeroStage(stage); saveArmoryHeroPos();
  },{passive:false});
}

const armoryShowcase={bruteId:null,wid:null,anim:"idle",animStart:0,duration:900,loopRunning:false,lastToggle:false};

function getArmoryWeaponAnim(w){
  if(!w){ armoryShowcase.lastToggle=!armoryShowcase.lastToggle; return armoryShowcase.lastToggle?"punch":"uppercut"; }
  const kind=w.id===10?"heavy":(DataEngine.WEAPON_STYLE?.[w.id]||w.type||"light");
  const pair={
    light:["thrust","pierce"],
    heavy:["overhead","meteor"],
    throw:["throw","salto"]
  }[kind]||["punch","uppercut"];
  armoryShowcase.lastToggle=!armoryShowcase.lastToggle;
  return armoryShowcase.lastToggle?pair[0]:pair[1];
}

function triggerArmoryWeaponPreview(b,wid){
  const w=(wid!==null&&wid!==undefined)?DataEngine.WEAPONS[wid]:null;
  const nextAnim=getArmoryWeaponAnim(w);
  if(armoryShowcase.wid===wid&&armoryShowcase.anim!=="idle"&&performance.now()-armoryShowcase.animStart<260) return;
  armoryShowcase.bruteId=b.id;
  armoryShowcase.wid=w?w.id:null;
  armoryShowcase.anim=nextAnim;
  armoryShowcase.animStart=performance.now();
  const hasSheet=w&&Number.isInteger(w.id)&&w.id>=0&&w.id<=13&&renderer.loadImg(DataEngine.spriteBase(b.sprite,w.id));
  const A=(hasSheet&&CanvasRenderer.WPN_ANIMS?.[nextAnim])||CanvasRenderer.ANIMS[nextAnim]||CanvasRenderer.ANIMS.idle;
  const frames=(A.f?A.f.length:4);
  armoryShowcase.duration=Math.max(540,(frames/(A.fps||10))*1000+160);
}

function startArmoryHeroLoop(){
  if(armoryShowcase.loopRunning) return;
  armoryShowcase.loopRunning=true;
  const tick=now=>{
    const cv=$("#fx-armory-hero");
    if(cv&&cv.offsetParent&&S.cur){
      const b=S.cur;
      if(armoryShowcase.anim!=="idle"&&now-armoryShowcase.animStart>=armoryShowcase.duration){
        armoryShowcase.anim="idle";
      }
      const animT=armoryShowcase.anim==="idle"?now:Math.max(0,now-armoryShowcase.animStart);
      const ctx=cv.getContext("2d");
      ctx.clearRect(0,0,96,96);
      ctx.imageSmoothingEnabled=false;
      ctx.save();
      const wid=armoryShowcase.wid;
      if(wid===10){ ctx.translate(10,36); ctx.scale(0.82,0.82); }
      else { ctx.translate(16,28); }
      renderer.drawBrute(ctx,b,animT,armoryShowcase.anim,null,wid);
      ctx.restore();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderFiche(b){
  const D=DataEngine, E=FX.esc, bf=fxBuffs();
  // Colonne 1 : armes autour du kiosque central (greybox verrouillée / vrai sprite débloqué)
  const nw=D.WEAPONS.filter(w=>b.weapons.includes(w.id)).length;
  $("#fx-wcount").textContent=nw+"/"+D.WEAPONS.length;
  updateWeaponRackDevUI();
  const rack=$("#fx-wrack"), rackBrute=D.BRAWLERS.includes(b.sprite)?b.sprite:"general";
  rack.style.backgroundImage=`url("assets/backgrounds/arsenal/${rackBrute}/background.jpg"),url("assets/backgrounds/arsenal/background-greybox.jpg")`;
  rack.style.backgroundSize="cover";
  rack.style.backgroundPosition="center";

  if(armoryShowcase.bruteId!==b.id){
    armoryShowcase.bruteId=b.id;
    armoryShowcase.wid=b.weapons.length?b.weapons[0]:null;
    armoryShowcase.anim="idle";
    armoryShowcase.animStart=0;
  }

  rack.innerHTML=`
    <div class="fx-armory-stage ${weaponRackEditing?"is-editing":""}" id="fx-armory-stage">
      <canvas id="fx-armory-hero" width="96" height="96"></canvas>
    </div>
    <div class="fx-rack-grid">${D.WEAPONS.map(w=>{
      const own=b.weapons.includes(w.id), sel=armoryShowcase.wid===w.id;
      return `<button class="fx-rack-weapon ${own?"owned":"locked"} ${sel?"equipped":""}" data-rack-weapon="${w.id}" data-tip="w:${w.id}" aria-label="${E(w.name)}" title="${E(w.name)}"><canvas width="128" height="128" aria-hidden="true"></canvas></button>`;
    }).join("")}</div>`;

  const armoryStage=rack.querySelector("#fx-armory-stage");
  applyArmoryHeroStage(armoryStage);
  attachArmoryHeroEditor(armoryStage,rack);
  if(armoryStage){
    armoryStage.onclick=ev=>{
      if(weaponRackEditing) return;
      ev.stopPropagation();
      triggerArmoryWeaponPreview(b,armoryShowcase.wid);
    };
  }

  const weaponGrid=rack.querySelector(".fx-rack-grid");
  rack.style.position="relative";
  weaponGrid.style.position="absolute";
  weaponGrid.style.inset="0";
  weaponGrid.style.width="100%";
  weaponGrid.style.height="100%";
  weaponGrid.style.zIndex="4";
  if(weaponRackEditing&&weaponRackPositions) weaponGrid.classList.add("is-editing");
  fitWeaponRack(rack);
  attachWeaponRackEditor(weaponGrid);
  if(weaponRackObserver) weaponRackObserver.observe(rack);

  // Rendu de chaque arme : greybox si verrouillée, sprite personnalisé si débloquée
  const greySheet=renderer.loadImg(DataEngine.GREYBOX_WEAPONS);
  rack.querySelectorAll("[data-rack-weapon]").forEach(button=>{
    const id=+button.dataset.rackWeapon, own=b.weapons.includes(id), ctx=button.querySelector("canvas").getContext("2d");
    ctx.imageSmoothingEnabled=false;
    ctx.clearRect(0,0,128,128);
    if(own){
      const skin=renderer.weaponSprite(b,id,()=>{ if(S.cur&&S.cur.id===b.id) renderFiche(b); });
      if(skin){
        const scale=Math.min(128/skin.width,128/skin.height),width=skin.width*scale,height=skin.height*scale;
        ctx.drawImage(skin.sheet,skin.x,skin.y,skin.width,skin.height,(128-width)/2,(128-height)/2,width,height);
      } else {
        ctx.font="76px serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(D.WEAPONS[id].icon,64,68);
      }
    } else if(greySheet&&greySheet.complete&&greySheet.naturalWidth){
      const cell=DataEngine.WEAPON_CELLS[id]??id;
      const tw=Math.floor(greySheet.naturalWidth/4), th=Math.floor(greySheet.naturalHeight/4);
      const sx=(cell%4)*tw, sy=Math.floor(cell/4)*th, sh=id===10?th*2:th;
      const scale=Math.min(128/tw,128/sh), width=tw*scale, height=sh*scale;
      ctx.save();
      ctx.filter="brightness(0.45) contrast(1.15)";
      ctx.globalAlpha=0.78;
      ctx.drawImage(greySheet,sx,sy,tw,sh,(128-width)/2,(128-height)/2,width,height);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha=0.32;
      ctx.filter="grayscale(1) brightness(0.4)";
      ctx.font="72px serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(D.WEAPONS[id].icon,64,68);
      ctx.restore();
    }

    const previewWeapon=()=>{
      if(weaponRackEditing||!b.weapons.includes(id)) return;
      triggerArmoryWeaponPreview(b,id);
      rack.querySelectorAll(".fx-rack-weapon").forEach(el=>el.classList.toggle("equipped",+el.dataset.rackWeapon===id));
    };

    button.addEventListener("pointerenter",ev=>{
      if(ev.pointerType!=="mouse") return;
      previewWeapon();
    });

    button.onclick=ev=>{
      if(weaponRackEditing) return;
      ev.stopPropagation();
      showTip(button);
      previewWeapon();
    };
  });
  startArmoryHeroLoop();
  if (typeof renderCompanionsPanel === "function") renderCompanionsPanel(b);
  // Colonne 2 : identité
  $("#fx-name").textContent=b.name;
  $("#fx-rename").hidden=b.hasBeenRenamed;
  $("#fx-tag").textContent=(b.species||"Mutant")+" "+(b.style||"rebelle");
  $("#fx-lv").textContent="Niveau "+b.level;
  $("#fx-xpbar").style.width=Math.min(100,b.xp/b.xpMax*100)+"%";
  $("#fx-xptxt").textContent="XP "+b.xp+" / "+b.xpMax;
  $("#fx-pv").innerHTML=`<b>${BattleEngine.maxHp(b,bf)}</b> points de vie`;
  $("#fx-stats").innerHTML=FX.STATS.map(([k,l,ic])=>{ const bn=D.gearBonus(b,k);
    return `<button class="fx-stat" data-tip="st:${k}"><span class="fx-sl"><span>${ic} ${l}</span><span class="fx-sv">${b.stats[k]}${bn?`<i>+${bn}</i>`:""}</span></span>${seg(b.stats[k],28,k)}</button>`; }).join("");
  if($("#fx-gear")) $("#fx-gear").innerHTML=D.PARTS.map(p=>{ const best=b.gear.filter(g=>g.part===p.id).reduce((m,g)=>Math.max(m,g.rarity),-1);
    return `<button class="fx-gslot ${best<0?"":"on"}" ${best<0?"":`style="--c:${D.RARITIES[best].color}"`} data-tip="g:${p.id}" aria-label="${p.name}">${p.icon}</button>`; }).join("");
  // Colonne 3 : 32 compétences
  const ns=D.SKILLS.filter(s=>b.skills.includes(s.id)).length;
  $("#fx-scount").textContent=ns+"/"+D.SKILLS.length;
  $("#fx-sgrid").innerHTML=D.SKILLS.map(s=>{ const k=b.skills.includes(s.id);
    if(!k&&!FX.REVEAL_SKILLS) return `<button class="fx-s locked" data-tip="s:${s.id}" aria-label="Compétence inconnue"><span>${D.EL_ICON[s.el]}</span></button>`;   // silhouette, comme les armes
    return `<button class="fx-s ${k?"known":""}" style="--c:${D.EL_COL[s.el]}" data-tip="s:${s.id}" aria-label="${E(s.name)}">${D.EL_ICON[s.el]}<i>${s.t}</i></button>`; }).join("");
}
