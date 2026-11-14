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
  STYLE:{estoc:"Estoc",overhead:"Frappe haute",throw:"Lancer"},
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
    const w=D.WEAPONS[+id], own=b.weapons.includes(w.id);
    const lv=(typeof GameState!=="undefined"&&GameState.maitriseArmes?.[w.id])||(b.weaponLevels?.[w.id])||0;
    const bonus=lv>0?` +${lv}`:"";
    return own?`<h4>${w.icon} ${E(w.name)}${bonus}</h4><p>${E(w.desc)}</p>${bar("Dégâts",w.dmg)}${bar("Vitesse",w.spd)}${bar("Précision",w.prec)}${bar("Critique",w.crit)}<div class="fxl k">Style : ${FX.STYLE[D.WEAPON_STYLE[w.id]]||"—"}</div>`
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
const WEAPON_RACK_LAYOUT_PREFIX="arene_weapon_rack_dev_layout_v1_";
let weaponRackEditing=false, weaponRackPositions=null, weaponRackDrag=null, weaponRackBrute="general";
const WEAPON_RACK_FROZEN={
  "empereur": [
    { "id": 0, "x": 53.09, "y": 51.45, "size": 31.12, "angle": 2 },
    { "id": 1, "x": 60.64, "y": 17.34, "size": 31.12, "angle": 0 },
    { "id": 2, "x": 77.97, "y": 17.34, "size": 31.12, "angle": 1 },
    { "id": 3, "x": 84.85, "y": 26.68, "size": 31.12, "angle": 3 },
    { "id": 4, "x": 29.92, "y": 47.06, "size": 31.12, "angle": 2 },
    { "id": 5, "x": 34.52, "y": 41.48, "size": 31.12, "angle": 2 },
    { "id": 6, "x": 53.33, "y": 48.38, "size": 31.12, "angle": -2 },
    { "id": 7, "x": 44.92, "y": 41.34, "size": 31.12, "angle": -1 },
    { "id": 8, "x": 82.79, "y": 63.92, "size": 31.12, "angle": 1 },
    { "id": 9, "x": 57.14, "y": 75.94, "size": 31.12, "angle": -3 },
    { "id": 10, "x": 35.06, "y": 62.45, "size": 31.12, "angle": -2 },
    { "id": 11, "x": 23.69, "y": 46.91, "size": 31.12, "angle": 3 },
    { "id": 12, "x": 43.32, "y": 17.34, "size": 31.12, "angle": -1 },
    { "id": 13, "x": 22.18, "y": 62.01, "size": 31.12, "angle": 3 },
    { "id": 14, "x": 77.97, "y": 84.17, "size": 31.12, "angle": 1 },
    { "id": 15, "x": 71.06, "y": 50.13, "size": 31.12, "angle": 1 }
  ]
};
function validRackPositions(p){
  return Array.isArray(p)&&p.length===DataEngine.WEAPONS.length&&p.every((q,i)=>q&&q.id===i&&[q.x,q.y,q.size,q.angle].every(Number.isFinite));
}
function readWeaponRackPositions(brute=weaponRackBrute){
  try{
    const saved=localStorage.getItem(WEAPON_RACK_LAYOUT_PREFIX+brute);
    if(saved){
      const positions=JSON.parse(saved);
      if(validRackPositions(positions)) return positions;
      console.error("La configuration DEV du râtelier est invalide.");
    }
  }catch(error){
    console.error("Impossible de charger la configuration DEV du râtelier.",error);
  }
  const frozen=WEAPON_RACK_FROZEN[brute];
  return validRackPositions(frozen)?frozen.map(p=>({...p})):null;
}
function saveWeaponRackPositions(){
  if(!weaponRackPositions) return;
  try{ localStorage.setItem(WEAPON_RACK_LAYOUT_PREFIX+weaponRackBrute,JSON.stringify(weaponRackPositions)); }
  catch(error){ console.error("Impossible de sauvegarder la configuration DEV du râtelier.",error); }
  console.log(`WEAPON_RACK_LAYOUT["${weaponRackBrute}"] =`,JSON.stringify(weaponRackPositions.map(({id,x,y,size,angle})=>({id,x:+x.toFixed(2),y:+y.toFixed(2),size:+size.toFixed(2),angle:+angle.toFixed(1)}))));
}
function rackPositionText(){
  return JSON.stringify(weaponRackPositions.map(({id,x,y,size,angle})=>({id,x:+x.toFixed(2),y:+y.toFixed(2),size:+size.toFixed(2),angle:+angle.toFixed(1)})),null,2);
}
function updateRackPositionExport(){
  const output=$("#dev-rack-positions");
  if(output&&weaponRackPositions) output.value=rackPositionText();
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
  button.style.setProperty("--rack-angle",position.angle+"deg");
  button.style.position="absolute";
  button.style.margin="0";
  button.style.gridColumn=button.style.gridRow="auto";
  button.style.transform=`translate(-50%,-50%) rotate(${position.angle}deg)`;}
function rackPositionOverlaps(position,grid,id){
  const bounds=rackPositionBounds(position,grid);
  return weaponRackPositions.some(other=>{
    if(other.id===id) return false;
    const box=rackPositionBounds(other,grid);
    return bounds.left<box.right&&bounds.right>box.left&&bounds.top<box.bottom&&bounds.bottom>box.top;
  });
}
function beginWeaponRackEditing(grid){
  const buttons=[...grid.querySelectorAll(".fx-rack-weapon")];
  if(!grid.clientWidth||!grid.clientHeight){ console.error("Râtelier : grille de taille 0",grid.clientWidth,grid.clientHeight); return; }
  if(!weaponRackPositions){
    weaponRackPositions=readWeaponRackPositions();
    if(!weaponRackPositions){
      const gr=grid.getBoundingClientRect(), ox=gr.left+grid.clientLeft, oy=gr.top+grid.clientTop;
      weaponRackPositions=Array.from({length:DataEngine.WEAPONS.length},(_,id)=>{
        const button=buttons.find(item=>+item.dataset.rackWeapon===id), rect=button.getBoundingClientRect();
        return {
          id,
          x:(rect.left+rect.width/2-ox)/grid.clientWidth*100,
          y:(rect.top+rect.height/2-oy)/grid.clientHeight*100,
          size:button.offsetWidth/grid.clientHeight*100,
          angle:parseFloat(button.style.getPropertyValue("--rack-angle"))||0
        };
      });
    }
  }
  weaponRackEditing=true;
  grid.classList.add("is-editing");
  buttons.forEach(button=>applyRackPosition(button,weaponRackPositions[+button.dataset.rackWeapon],grid));
  updateRackPositionExport();
}
function attachWeaponRackEditor(grid){
  grid.addEventListener("pointerdown",event=>{
    if(!weaponRackEditing) return;
    const button=event.target.closest(".fx-rack-weapon");
    if(!button) return;
    event.preventDefault();event.stopPropagation();
    const id=+button.dataset.rackWeapon;
    weaponRackDrag={id,pointerId:event.pointerId,start:{...weaponRackPositions[id]},grid};
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
    const {id,grid,start}=weaponRackDrag,button=grid.querySelector(`[data-rack-weapon="${id}"]`);
    weaponRackDrag=null;
    saveWeaponRackPositions();updateRackPositionExport();
  };
  grid.addEventListener("pointerup",finish);
  grid.addEventListener("pointercancel",finish);
  grid.addEventListener("wheel",event=>{
    if(!weaponRackEditing) return;
    const button=event.target.closest(".fx-rack-weapon");
    if(!button) return;
    event.preventDefault();event.stopPropagation();
    const position=weaponRackPositions[+button.dataset.rackWeapon],start={...position};
    if(event.shiftKey) position.angle+=event.deltaY<0?5:-5;
    else position.size=Math.max(12,Math.min(85,position.size+(event.deltaY<0?3:-3)));
    clampRackPosition(position,grid);
    applyRackPosition(button,weaponRackPositions[position.id],grid);
    saveWeaponRackPositions();updateRackPositionExport();
  },{passive:false});
}
function updateWeaponRackDevUI(){
  const edit=$("#fx-rack-edit"),dev=!!$("#devbox"),panel=$(".fx-panel.fx-weapons");
  if(!edit) return;
  if(panel&&edit.parentElement!==panel) panel.appendChild(edit);
  edit.hidden=!dev;
  edit.textContent=weaponRackEditing?"Terminer le placement":"Éditer le râtelier";
  edit.onclick=()=>{
    const grid=$("#fx-wrack .fx-rack-grid");
    if(!grid) return;
    if(weaponRackEditing){ weaponRackEditing=false;renderFiche(S.cur); }
    else{ beginWeaponRackEditing(grid);edit.textContent="Terminer le placement"; }
  };
}
function fitWeaponRack(rack){
  const grid=rack.querySelector(".fx-rack-grid"), weapons=grid?[...grid.children]:[];
  const count=weapons.length;
  if(!grid||!count) return;
  const width=grid.clientWidth, height=grid.clientHeight;
  if(!width||!height) return;
  let columns=1, rows=count, size=0;
  for(let candidate=1;candidate<=count;candidate++){
    const candidateRows=Math.ceil(count/candidate), candidateSize=Math.min(width/candidate,height/candidateRows);
    if(candidateSize>size){ columns=candidate; rows=candidateRows; size=candidateSize; }
  }
  grid.style.setProperty("--rack-columns",columns);
  grid.style.setProperty("--rack-rows",rows);
  size=Math.floor(size*.94);
  const saved=weaponRackPositions||(weaponRackPositions=readWeaponRackPositions());
  if(saved){
    grid.classList.toggle("is-editing",weaponRackEditing);
    weapons.forEach(button=>{ const p=saved[+button.dataset.rackWeapon]; if(p) applyRackPosition(button,p,grid); });
    return;
  }  let seed=Number(grid.dataset.seed)>>>0;
  const random=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  const slots=Array.from({length:columns*rows},(_,i)=>i);
  for(let i=slots.length-1;i>0;i--){ const j=Math.floor(random()*(i+1)); [slots[i],slots[j]]=[slots[j],slots[i]]; }
  weapons.forEach((button,index)=>{
    const slot=slots[index];
    button.style.gridColumn=String(slot%columns+1);
    button.style.gridRow=String(Math.floor(slot/columns)+1);
    button.style.width=size+"px";
    button.style.height=size+"px";
    button.style.setProperty("--rack-angle",Math.round(random()*6-3)+"deg");
  });
}
const weaponRackObserver=typeof ResizeObserver==="undefined"?null:new ResizeObserver(entries=>entries.forEach(({target})=>fitWeaponRack(target)));
/* --- Placement libre des compagnons (mode DEV) --- */
const COMP_LAYOUT_KEY="arene_companion_dev_layout_v1";
let compEditing=false, compPositions=null, compDrag=null;

const COMP_FROZEN=[
  { "key": "chien", "x": 16.65, "y": 21.02, "size": 10, "angle": 0, "flip": false },
  { "key": "loup", "x": 49.81, "y": 39.25, "size": 13.5, "angle": 0, "flip": false },
  { "key": "ours", "x": 17.67, "y": 41.89, "size": 15, "angle": 0, "flip": false },
  { "key": "serpent", "x": 39.2, "y": 20.68, "size": 13.5, "angle": 0, "flip": false },
  { "key": "oiseau", "x": 60.61, "y": 40.19, "size": 12.5, "angle": 0, "flip": false },
  { "key": "arthropode", "x": 61.69, "y": 19.25, "size": 15, "angle": 0, "flip": false },
  { "key": "felin", "x": 72.24, "y": 21.02, "size": 11, "angle": 0, "flip": false },
  { "key": "taureau", "x": 27.96, "y": 20.13, "size": 16, "angle": 0, "flip": false },
  { "key": "aquatique", "x": 28.4, "y": 39.61, "size": 13.5, "angle": 0, "flip": false },
  { "key": "chimere", "x": 38.95, "y": 39.99, "size": 11, "angle": 0, "flip": false },
  { "key": "lezard", "x": 49.68, "y": 21.42, "size": 12.5, "angle": 0, "flip": false },
  { "key": "spectre", "x": 71.66, "y": 41.01, "size": 13.5, "angle": 0, "flip": false },
  { "key": "tempete", "x": 83.23, "y": 21.35, "size": 11, "angle": 0, "flip": false }
];
function defaultCompPositions(){
  const cols=7;
  const base=CompanionData.FAMILIES.map((f,i)=>({
    key:f.key,
    x:10+(i%cols)*13.2,
    y:i<cols?34:74,
    size:26,
    angle:0,
    flip:false
  }));
  COMP_FROZEN.forEach(s=>{ const t=base.find(d=>d.key===s.key); if(t) Object.assign(t,s); });
  return base;
}
function readCompPositions(){
  try{
    const saved=localStorage.getItem(COMP_LAYOUT_KEY);
    if(!saved) return null;
    const arr=JSON.parse(saved);
    if(!Array.isArray(arr)||arr.length!==CompanionData.FAMILIES.length) return null;
    return arr;
  }catch(e){ return null; }
}
function saveCompPositions(){
  if(!compPositions) return;
  try{ localStorage.setItem(COMP_LAYOUT_KEY,JSON.stringify(compPositions)); }catch(e){}
  console.log("COMP_LAYOUT =",JSON.stringify(compPositions.map(({key,x,y,size,angle,flip})=>({key,x:+x.toFixed(2),y:+y.toFixed(2),size:+size.toFixed(1),angle:+(angle||0).toFixed(1),flip:!!flip}))));
}
/* --- Placement libre des 3 évolutions au sol + 2 flèches (mode DEV) --- */
const HOLO_LAYOUT_KEY="arene_comp_holo_layout_v1";
let holoPositions=null, holoDrag=null;

const HOLO_FROZEN=[
  { "id": "st1", "x": 37.48, "y": 71.69, "size": 9.2, "angle": 0, "flip": false },
  { "id": "ar1", "x": 43.2, "y": 75, "size": 4.5, "angle": 0, "flip": false },
  { "id": "st2", "x": 49.74, "y": 71.59, "size": 12, "angle": 0, "flip": false },
  { "id": "ar2", "x": 56, "y": 73, "size": 4.5, "angle": 0, "flip": false },
  { "id": "st3", "x": 63.32, "y": 68.47, "size": 14.6, "angle": 0, "flip": false }
];
function defaultHoloPositions(){
  const base=[
    { id:"st1", x:37.5, y:75, size:14, angle:0, flip:false },
    { id:"ar1", x:43.2, y:75, size:4.5, angle:0, flip:false },
    { id:"st2", x:49.5, y:73, size:18, angle:0, flip:false },
    { id:"ar2", x:56.0, y:73, size:4.5, angle:0, flip:false },
    { id:"st3", x:63.0, y:70, size:23, angle:0, flip:false }
  ];
  HOLO_FROZEN.forEach(s=>{ const t=base.find(d=>d.id===s.id); if(t) Object.assign(t,s); });
  return base;
}
function readHoloPositions(){
  try{
    const arr=JSON.parse(localStorage.getItem(HOLO_LAYOUT_KEY)||"null");
    return Array.isArray(arr)&&arr.length===5?arr:null;
  }catch(e){ return null; }
}
function saveHoloPositions(){
  if(!holoPositions) return;
  try{ localStorage.setItem(HOLO_LAYOUT_KEY,JSON.stringify(holoPositions)); }catch(e){}
  console.log("HOLO_LAYOUT =",JSON.stringify(holoPositions.map(({id,x,y,size,angle,flip})=>({id,x:+x.toFixed(2),y:+y.toFixed(2),size:+size.toFixed(1),angle:+(angle||0).toFixed(1),flip:!!flip}))));
}
function applyHoloItemPos(el,pos){
  el.style.position="absolute";
  el.style.left=pos.x+"%";
  el.style.top=pos.y+"%";
  el.style.transform=`translate(-50%,-50%) rotate(${pos.angle||0}deg)`;
  const cv=el.querySelector(".comp-cv");
  if(cv){
    cv.style.height=(pos.size||16)+"vh";
    cv.style.width="auto";
    cv.style.aspectRatio="1 / 1";
    cv.style.transform=`scaleX(${pos.flip?-1:1})`;
  } else {
    el.style.fontSize=Math.max(12,(pos.size||4.5)*3.4)+"px";
  }
}

function applyCompPosition(btn,pos,stage){
  const pct=pos.size||26;
  btn.style.position="absolute";
  btn.style.left=pos.x+"%";
  btn.style.top=pos.y+"%";
  btn.style.height=pct+"%";
  btn.style.width="auto";
  btn.style.aspectRatio="1 / 1";
  btn.style.margin="0";
  btn.style.transform=`translate(-50%,-50%) rotate(${pos.angle||0}deg) scaleX(${pos.flip?-1:1})`;
}
function updateCompDevUI(){
  const compPanel=$(".fx-panel.fx-comp");
  if(!compPanel) return;
  let edit=$("#fx-comp-edit");
  if(!edit){
    edit=document.createElement("button");
    edit.id="fx-comp-edit"; edit.type="button"; edit.className="fx-btn";
    compPanel.appendChild(edit);
  }
  const dev=!!$("#devbox");
  edit.hidden=!dev;
  edit.textContent=compEditing?"Terminer le placement":"Éditer les compagnons";
  edit.onclick=()=>{
    compEditing=!compEditing;
    renderFiche(S.cur);
  };
}
function attachCompEditor(stage){
  if(stage.dataset.editorBound) return;
  stage.dataset.editorBound="1";
  stage.addEventListener("pointerdown",ev=>{
    if(!compEditing) return;
    const btn=ev.target.closest("[data-fam]");
    if(!btn) return;
    ev.preventDefault(); ev.stopPropagation();
    const key=btn.dataset.fam, pos=compPositions.find(p=>p.key===key);
    if(!pos) return;
    compDrag={key,pos,pointerId:ev.pointerId,stage};
    btn.setPointerCapture(ev.pointerId);
  });
  stage.addEventListener("pointermove",ev=>{
    if(!compDrag||ev.pointerId!==compDrag.pointerId) return;
    const {key,pos,stage}=compDrag, rect=stage.getBoundingClientRect();
    pos.x=Math.max(2,Math.min(98,(ev.clientX-rect.left)/rect.width*100));
    pos.y=Math.max(6,Math.min(96,(ev.clientY-rect.top)/rect.height*100));
    const btn=stage.querySelector(`[data-fam="${key}"]`);
    if(btn) applyCompPosition(btn,pos,stage);
  });
  const end=ev=>{
    if(!compDrag||ev.pointerId!==compDrag.pointerId) return;
    compDrag=null;
    saveCompPositions();
  };
  stage.addEventListener("pointerup",end);
  stage.addEventListener("pointercancel",end);
  stage.addEventListener("contextmenu",ev=>{
    if(!compEditing) return;
    const btn=ev.target.closest("[data-fam]");
    if(!btn) return;
    ev.preventDefault();
    const pos=compPositions.find(p=>p.key===btn.dataset.fam);
    if(pos){ pos.flip=!pos.flip; applyCompPosition(btn,pos,stage); saveCompPositions(); }
  });
  stage.addEventListener("wheel",ev=>{
    if(!compEditing) return;
    const btn=ev.target.closest("[data-fam]");
    if(!btn) return;
    ev.preventDefault(); ev.stopPropagation();
    const pos=compPositions.find(p=>p.key===btn.dataset.fam);
    if(!pos) return;
    if(ev.shiftKey) pos.angle=(pos.angle||0)+(ev.deltaY<0?5:-5);
    else pos.size=Math.max(10,Math.min(70,(pos.size||26)+(ev.deltaY<0?2.5:-2.5)));
    applyCompPosition(btn,pos,stage);
    saveCompPositions();
  },{passive:false});
}

function renderFiche(b){
  const D=DataEngine, E=FX.esc, bf=fxBuffs();
  // Colonne 1 : armes débloquées sur le râtelier
  const nw=D.WEAPONS.filter(w=>b.weapons.includes(w.id)).length;
  $("#fx-wcount").textContent=nw+"/"+D.WEAPONS.length;
  updateWeaponRackDevUI();
  const rack=$("#fx-wrack"), rackBrute=D.BRAWLERS.includes(b.sprite)?b.sprite:"general";
  if(weaponRackBrute!==rackBrute){ weaponRackBrute=rackBrute; weaponRackPositions=null; }
  rack.style.backgroundImage=`url("${assetPath.starter(rackBrute)}"),url("${assetPath.starter("general")}")`;
  const weapons=$("#devbox")?D.WEAPONS:D.WEAPONS.filter(w=>b.weapons.includes(w.id));
  rack.innerHTML=`<div class="fx-rack-grid">${weapons.map(w=>
    `<button class="fx-rack-weapon" data-rack-weapon="${w.id}" data-tip="w:${w.id}" aria-label="${E(w.name)}" title="${E(w.name)}"><canvas width="128" height="128" aria-hidden="true"></canvas></button>`
  ).join("")}</div>`;
  const weaponGrid=rack.querySelector(".fx-rack-grid");
  rack.style.position="relative";
  weaponGrid.style.position="absolute";
  weaponGrid.style.inset="0";
  weaponGrid.style.width="100%";
  weaponGrid.style.height="100%";
  weaponGrid.dataset.seed=String([...String(b.id||b.name||b.sprite)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7));
  if(weaponRackEditing&&weaponRackPositions) weaponGrid.classList.add("is-editing");
  fitWeaponRack(rack);
  attachWeaponRackEditor(weaponGrid);
  if(weaponRackObserver) weaponRackObserver.observe(rack);
  rack.querySelectorAll("[data-rack-weapon]").forEach(button=>{
    const id=+button.dataset.rackWeapon, ctx=button.querySelector("canvas").getContext("2d");
    ctx.imageSmoothingEnabled=false;
    const skin=renderer.weaponSprite(b,id,()=>{ if(S.cur&&S.cur.id===b.id) renderFiche(b); });
    if(skin){
      const scale=Math.min(128/skin.width,128/skin.height),width=skin.width*scale,height=skin.height*scale;
      ctx.drawImage(skin.sheet,skin.x,skin.y,skin.width,skin.height,(128-width)/2,(128-height)/2,width,height);
    }
    else { ctx.font="76px serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(D.WEAPONS[id].icon,64,68); }
  });
  // Colonne 1 : compagnons — placement libre dans le décor avec animation idle
  const c=b.companion, cf=c?CompanionData.family(c):null;
  const compPanel=$(".fx-panel.fx-comp"), stage=$("#fx-comp");
  if(compPanel){
    compPanel.style.background=`url("${DataEngine.getCompanionBg(b.sprite)}") center/cover no-repeat`;
    let fg=compPanel.querySelector(".comp-fg-layer");
    if(!fg){
      fg=document.createElement("div");
      fg.className="comp-fg-layer";
      compPanel.appendChild(fg);
    }
    fg.style.backgroundImage=`url("${DataEngine.getCompanionFg(b.sprite)}")`;
  }
  $("#fx-ccount").textContent=(cf?1:0)+"/"+CompanionData.FAMILIES.length;
  updateCompDevUI();
  if(!compPositions) compPositions=readCompPositions()||defaultCompPositions();
  stage.classList.toggle("is-editing",compEditing);
  stage.innerHTML=CompanionData.FAMILIES.map(f=>{
    const o=f===cf, form=o?(c.form||1):1, art=DataEngine.getCompanionArt(f.key,form);
    return `<button class="fx-comp-pet ${o?"owned":"locked"}" data-fam="${f.key}" title="${E(f.name)}" aria-label="${o?E(f.name):"Famille inconnue"}"><canvas class="comp-cv" width="64" height="64" data-art="${E(art)}"></canvas></button>`;
  }).join("");
  requestAnimationFrame(()=>{
    stage.querySelectorAll(".fx-comp-pet").forEach(btn=>{
      const pos=compPositions.find(p=>p.key===btn.dataset.fam);
      if(pos) applyCompPosition(btn,pos,stage);
    });
  });
  attachCompEditor(stage);
  // Projecteur holographique d'évolution sur la grille au sol (clic sur une cellule)
  if(!holoPositions) holoPositions=readHoloPositions()||defaultHoloPositions();
  let holo=compPanel&&compPanel.querySelector(".comp-holo-stage");
  const showHolo=key=>{
    const f=CompanionData.FAMILIES.find(x=>x.key===key); if(!f||!holo) return;
    const curComp=S.cur&&S.cur.companion;
    const unlockedForm=(curComp&&CompanionData.family(curComp)===f)?(curComp.form||1):0;
    holo.dataset.fam=key;
    holo.innerHTML=[
      `<div class="holo-step st1 ${unlockedForm>0?"owned":"locked"}" data-holo="st1"><canvas class="comp-cv" width="64" height="64" data-art="${E(DataEngine.getCompanionArt(key,1))}"></canvas><span class="holo-lbl">${E(f.stages[0])}<small>Niv. ${CompanionData.EVO_LEVELS[0]}</small></span></div>`,
      `<span class="holo-arrow" data-holo="ar1">➜</span>`,
      `<div class="holo-step st2 ${unlockedForm>1?"owned":"locked"}" data-holo="st2"><canvas class="comp-cv" width="64" height="64" data-art="${E(DataEngine.getCompanionArt(key,2))}"></canvas><span class="holo-lbl">${E(f.stages[1])}<small>Niv. ${CompanionData.EVO_LEVELS[1]}</small></span></div>`,
      `<span class="holo-arrow" data-holo="ar2">➜</span>`,
      `<div class="holo-step st3 ${unlockedForm>2?"owned":"locked"}" data-holo="st3"><canvas class="comp-cv" width="64" height="64" data-art="${E(DataEngine.getCompanionArt(key,3))}"></canvas><span class="holo-lbl">${E(f.stages[2])}<small>Niv. ${CompanionData.EVO_LEVELS[2]}</small></span></div>`
    ].join("");
    holo.classList.remove("hidden");
    holo.querySelectorAll("[data-holo]").forEach(el=>{
      const pos=holoPositions.find(p=>p.id===el.dataset.holo);
      if(pos) applyHoloItemPos(el,pos);
    });
  };
  if(compPanel&&!holo){
    holo=document.createElement("div");
    holo.className="comp-holo-stage hidden";
    compPanel.appendChild(holo);
    stage.addEventListener("click",ev=>{
      if(compEditing) return;
      const btn=ev.target.closest("[data-fam]");
      if(!btn){ holo.classList.add("hidden"); holo.dataset.fam=""; return; }
      ev.stopPropagation();
      const key=btn.dataset.fam;
      if(holo.dataset.fam===key && !holo.classList.contains("hidden")){
        holo.classList.add("hidden"); holo.dataset.fam=""; return;
      }
      showHolo(key);
    });
    // Contrôles DEV sur les 3 évolutions + 2 flèches au sol
    holo.addEventListener("pointerdown",ev=>{
      if(!compEditing) return;
      const el=ev.target.closest("[data-holo]"); if(!el) return;
      ev.preventDefault(); ev.stopPropagation();
      const pos=holoPositions.find(p=>p.id===el.dataset.holo); if(!pos) return;
      holoDrag={el,pos,pointerId:ev.pointerId};
      el.setPointerCapture(ev.pointerId);
    });
    holo.addEventListener("pointermove",ev=>{
      if(!holoDrag||ev.pointerId!==holoDrag.pointerId) return;
      const rect=compPanel.getBoundingClientRect();
      holoDrag.pos.x=Math.max(4,Math.min(96,(ev.clientX-rect.left)/rect.width*100));
      holoDrag.pos.y=Math.max(20,Math.min(96,(ev.clientY-rect.top)/rect.height*100));
      applyHoloItemPos(holoDrag.el,holoDrag.pos);
    });
    const endHolo=ev=>{
      if(!holoDrag||ev.pointerId!==holoDrag.pointerId) return;
      holoDrag=null; saveHoloPositions();
    };
    holo.addEventListener("pointerup",endHolo);
    holo.addEventListener("pointercancel",endHolo);
    holo.addEventListener("contextmenu",ev=>{
      if(!compEditing) return;
      const el=ev.target.closest("[data-holo]"); if(!el) return;
      ev.preventDefault();
      const pos=holoPositions.find(p=>p.id===el.dataset.holo);
      if(pos){ pos.flip=!pos.flip; applyHoloItemPos(el,pos); saveHoloPositions(); }
    });
    holo.addEventListener("wheel",ev=>{
      if(!compEditing) return;
      const el=ev.target.closest("[data-holo]"); if(!el) return;
      ev.preventDefault(); ev.stopPropagation();
      const pos=holoPositions.find(p=>p.id===el.dataset.holo); if(!pos) return;
      if(ev.shiftKey) pos.angle=(pos.angle||0)+(ev.deltaY<0?5:-5);
      else pos.size=Math.max(2,Math.min(45,(pos.size||16)+(ev.deltaY<0?1.2:-1.2)));
      applyHoloItemPos(el,pos); saveHoloPositions();
    },{passive:false});
  }
  if(holo){
    holo.classList.toggle("is-editing",compEditing);
    if(compEditing){ showHolo(holo.dataset.fam||CompanionData.FAMILIES[0].key); }
    else if(!holo.dataset.fam){ holo.classList.add("hidden"); }
  }
  if(!window._compIdleLoop){
    window._compIdleLoop=true;
    const cache={};
    const tick=now=>{
      const frame=Math.floor(now/180)%4;
      document.querySelectorAll(".fx-panel.fx-comp .comp-cv").forEach(cv=>{
        if(!cv.offsetParent) return;
        const src=cv.dataset.art; if(!src) return;
        let im=cache[src];
        if(!im){ im=cache[src]=new Image(); im.src=src; }
        if(!im.complete||!im.naturalWidth) return;
        const fw=im.naturalWidth/4, fh=im.naturalHeight/4, ctx=cv.getContext("2d");
        ctx.clearRect(0,0,64,64);
        ctx.imageSmoothingEnabled=false;
        ctx.globalCompositeOperation="source-over";
        ctx.drawImage(im,frame*fw,0,fw,fh,0,0,64,64);
        if(cv.closest(".locked")){
          ctx.globalCompositeOperation="source-atop";
          const grd=ctx.createRadialGradient(32,32,4,32,32,30);
          grd.addColorStop(0,"rgba(8, 42, 54, 0.88)");
          grd.addColorStop(1,"rgba(14, 116, 144, 0.94)");
          ctx.fillStyle=grd;
          ctx.fillRect(0,0,64,64);
          ctx.fillStyle="rgba(56, 232, 255, 0.24)";
          for(let y=0;y<64;y+=4) ctx.fillRect(0,y,64,1);
          ctx.globalCompositeOperation="source-over";
        }
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
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
  $("#fx-gear").innerHTML=D.PARTS.map(p=>{ const best=b.gear.filter(g=>g.part===p.id).reduce((m,g)=>Math.max(m,g.rarity),-1);
    return `<button class="fx-gslot ${best<0?"":"on"}" ${best<0?"":`style="--c:${D.RARITIES[best].color}"`} data-tip="g:${p.id}" aria-label="${p.name}">${p.icon}</button>`; }).join("");
  // Colonne 3 : 32 compétences
  const ns=D.SKILLS.filter(s=>b.skills.includes(s.id)).length;
  $("#fx-scount").textContent=ns+"/"+D.SKILLS.length;
  $("#fx-sgrid").innerHTML=D.SKILLS.map(s=>{ const k=b.skills.includes(s.id);
    if(!k&&!FX.REVEAL_SKILLS) return `<button class="fx-s locked" data-tip="s:${s.id}" aria-label="Compétence inconnue"><span>${D.EL_ICON[s.el]}</span></button>`;   // silhouette, comme les armes
    return `<button class="fx-s ${k?"known":""}" style="--c:${D.EL_COL[s.el]}" data-tip="s:${s.id}" aria-label="${E(s.name)}">${D.EL_ICON[s.el]}<i>${s.t}</i></button>`; }).join("");
}
