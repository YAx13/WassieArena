"use strict";
/* Boîte de dialogue intégrée (les confirm()/prompt() natifs sont bloqués dans les iframes sandbox) */
function uiDialog(title,body,buttons,escVal){
  return new Promise(res=>{
    const ov=document.createElement("div");
    ov.style.cssText="position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:12px";
    const bx=document.createElement("div");
    bx.style.cssText="background:#0a0a0a;border:1px solid var(--rust,#e65c00);box-shadow:0 0 24px rgba(230,92,0,.5);color:#ddd;font:14px monospace;padding:16px;max-width:420px;width:100%;text-align:center";
    const h=document.createElement("div"); h.style.cssText="color:var(--rust-l,#ff9d2e);font-weight:700;font-size:1.05rem;margin-bottom:10px"; h.textContent=title;
    const m=document.createElement("div"); m.style.cssText="white-space:pre-line;line-height:1.5;margin-bottom:14px"; m.textContent=body;
    const row=document.createElement("div"); row.style.cssText="display:flex;flex-wrap:wrap;gap:8px;justify-content:center";
    const done=v=>{ document.removeEventListener("keydown",kd,true); ov.remove(); res(v); };
    const kd=e=>{ if(e.key==="Escape"){ e.stopPropagation(); done(escVal); } };
    buttons.forEach(([label,val])=>{ const b=document.createElement("button"); b.className="btn"; b.textContent=label; b.onclick=e=>{e.stopPropagation(); done(val)}; row.appendChild(b); });
    bx.append(h,m,row); ov.appendChild(bx); GameFrame.mount(ov); document.addEventListener("keydown",kd,true);
    const f=row.querySelector("button"); if(f) f.focus();
  });
}
async function divineAwakening(b){   // révélation d'une compétence divine aléatoire, 3 rerolls à 1 or
  let k=DataEngine.rnd(0,31), left=3;
  for(;;){ const s=DataEngine.SKILLS[k], can=left>0&&b.gold>=1;
    const btns=[["Accepter",true]]; if(can) btns.push(["Reroll (1 or · "+left+" essai"+(left>1?"s":"")+")",false]);
    const ok=await uiDialog("✨ ÉVEIL DIVIN ✨",s.name+" ("+DataEngine.ELEMENTS[s.el]+")\n"+s.desc,btns,true);
    if(ok||!can) break;
    b.gold-=1; left--; k=DataEngine.rnd(0,31); }
  if(!b.skills.includes(k)) b.skills.push(k); toast("Compétence divine : "+DataEngine.SKILLS[k].name);
}
{ const ab=document.createElement("button"); ab.className=$("#btn-fuse").className; ab.id="btn-auto"; ab.textContent="⚡ Auto-Forge"; $("#btn-fuse").after(ab);
  ab.onclick=async()=>{ const r=ForgeSystem.autoFuse(S.cur); if(!r.n){ toast("Aucun trio à fusionner."); return; } S.forgeKey=null; toast(r.n+" fusion(s) automatique(s)."); for(let i=0;i<r.div;i++) await divineAwakening(S.cur); persist(); }; }
/* --- Ascension --- */
$("#fx-rename").onclick=e=>{ e.stopPropagation(); beginCharacterRename(); };
function beginCharacterRename(){
  const b=S.cur, row=$("#fx-name-row"), name=$("#fx-name"), rename=$("#fx-rename");
  if(!b||b.hasBeenRenamed||!row||!name||!rename) return;
  const form=document.createElement("form"), input=document.createElement("input"), submit=document.createElement("button"), cancel=document.createElement("button");
  form.className="fx-rename-form";
  input.className="fx-rename-input"; input.type="text"; input.maxLength=24; input.value=b.name; input.setAttribute("aria-label","Nouveau nom du personnage");
  submit.type="submit"; submit.textContent="✓"; submit.title="Valider le nouveau nom"; submit.setAttribute("aria-label","Valider le nouveau nom");
  cancel.type="button"; cancel.textContent="✕"; cancel.title="Annuler"; cancel.setAttribute("aria-label","Annuler le renommage");
  form.append(input,submit,cancel); name.hidden=true; rename.hidden=true; row.append(form); input.focus(); input.select();
  const restore=()=>{ row.replaceChildren(name,rename); name.hidden=false; rename.hidden=b.hasBeenRenamed; };
  cancel.onclick=restore;
  form.onkeydown=e=>{ if(e.key==="Escape"){ e.preventDefault(); restore(); } };
  form.onsubmit=e=>{
    e.preventDefault();
    const newName=input.value.trim().replace(/\s+/g," "), length=Array.from(newName).length;
    if(!length){ toast("Le nom ne peut pas être vide."); input.focus(); return; }
    if(length>24){ toast("Le nom ne peut pas dépasser 24 caractères."); input.focus(); return; }
    b.name=newName; b.hasBeenRenamed=true; persist(); restore(); toast("Personnage renommé en "+newName+".");
    if(Combat.cfg&&Combat.pv){
      Combat.pv.name=newName;
      if(Array.isArray(Combat.V)) Combat.V.forEach(v=>{ if(v.b===b||v.b===Combat.pv) v.name=newName; });
      if(Combat.eng) Combat.eng.f.forEach(f=>{ if(f.br===b||f.br===Combat.pv) f.name=newName; });
      if(Combat.file&&Combat.file.length) Combat.majTitre();
    }
  };
}
/* --- Mode développeur --- */
function startAfkButtonEditing(){
  const menu=$("#afk-menu");
  if(!afkMenuPositions){
    const stageRect=$("#afk-stage").getBoundingClientRect();
    afkMenuPositions={};
    afkLayoutButtons().forEach(button=>{
      const rect=button.getBoundingClientRect();
      afkMenuPositions[button.id]={x:Math.max(0,rect.left-stageRect.left)/stageRect.width,y:Math.max(0,rect.top-stageRect.top)/stageRect.height};
    });
  }
  applyAfkMenuPositions(); menu.classList.add("is-editing"); saveAfkMenuPositions();
}
function toggleDevMode(){
  let p=$("#devbox");
  if(p){
    p.remove(); document.getElementById("dev-combat-group")?.remove(); weaponRackEditing=false; $("#afk-menu").classList.remove("is-editing"); setAfkMenuOpen(devMenuWasOpen);
    const button=$("#afk-dev-toggle");
    if(button){ button.classList.remove("active"); button.setAttribute("aria-pressed","false"); button.setAttribute("aria-label","Activer le mode développeur"); button.title="Activer le mode développeur"; }
    if(S.cur) renderFiche(S.cur);
    Combat.majMonetisation();
    return;
  }
  devMenuWasOpen=$("#afk-menu").classList.contains("open"); setAfkMenuOpen(true);
  p=document.createElement("div"); p.id="devbox";
  p.style.cssText="position:fixed;left:8px;top:8px;z-index:99;background:rgba(235,240,235,.70);backdrop-filter:blur(2px);color:#000;padding:8px;font:11px monospace;border:1px solid #000;max-width:290px;pointer-events:none";
  const R=DataEngine.RARITIES, tw=R.reduce((s,r)=>s+r.w,0);
  p.innerHTML='<style>#devbox,#devbox *{color:#000 !important}</style><b>DEV</b> <button data-a="g">+1000 or</button> <button data-a="l">+1 niv</button> <button data-a="a">Ascension</button> <button data-a="s">+10 âmes</button> <button data-a="all" style="font-weight:bold">🔓 Tout débloquer</button><small style="display:block;margin-top:5px">Glissez les boutons du menu pour les déplacer. Positions sauvegardées automatiquement.</small>'+
   '<label style="display:grid;grid-template-columns:1fr auto;gap:4px;margin-top:8px">Recul AFK <output id="dev-afk-recoil-value">40 px</output><input id="dev-afk-recoil" type="range" min="0" max="150" step="1" value="40" style="grid-column:1 / -1;width:100%"></label><small style="display:block;margin-top:8px">Râtelier : activez « Éditer le râtelier » dans la Caserne. Glissez les armes, molette = taille, Maj + molette = rotation.</small><textarea id="dev-rack-positions" readonly aria-label="Coordonnées des armes du râtelier" style="box-sizing:border-box;width:100%;height:100px;margin-top:4px;background:rgba(255,255,255,.85);color:#000;border:1px solid #333;font:10px monospace;pointer-events:auto"></textarea><div id="dev-dedicated-panels" style="display:flex;flex-direction:column;gap:6px;margin-top:6px;pointer-events:auto"></div><pre style="white-space:pre-wrap;margin:6px 0 0">'+
   "Recrutement : 35% rien / 65% arme\nDrop victoire : 25% (arme/compétence)\nArme/tour : "+BattleEngine.WEAPON_CHANCE*100+"% · Familier/tour : "+BattleEngine.PET_CHANCE*100+"%\nCaisses : "+R.map(r=>r.name+" "+(r.w/tw*100).toFixed(1)+"%").join(", ")+"</pre>";
  const recoil=p.querySelector("#dev-afk-recoil"), recoilValue=p.querySelector("#dev-afk-recoil-value");
  p.querySelectorAll("button,input").forEach(control=>control.style.pointerEvents="auto");
  p.querySelector("#dev-rack-positions").addEventListener("focus",event=>event.target.select());
  recoil.value=AFKMode.recoilDistance; recoilValue.textContent=AFKMode.recoilDistance+" px";
  recoil.oninput=()=>{ AFKMode.recoilDistance=Number(recoil.value); recoilValue.textContent=AFKMode.recoilDistance+" px"; };
  p.onclick=ev=>{
    const a=ev.target.dataset.a, b=S.cur; if(!a||!b) return;
    if(a==="g") b.gold+=1000;
    if(a==="l") b.level++;
    if(a==="s") ProfileManager.addSouls(10);
    if(a==="a"){ ascend(b,true); return; }
    if(a==="all"){
      b.gold+=999999; b.level=Math.max(b.level,50);
      b.weapons=DataEngine.WEAPONS.map(w=>w.id);
      b.skills=DataEngine.SKILLS.map(s=>s.id);
      DataEngine.WEAPONS.forEach(w=>{ GameState.maitriseArmes[w.id]=GameState.MAITRISE_MAX; });
      Object.assign(GameState.ressources,{or:999999,parchemins:999,nourriture:999,pierres:999,caisses:99});
      if(b.companion){ b.companion.level=CompanionData.LEVEL_CAP; b.companion.form=3; }
      ["helmet","chest","boots","necklace"].forEach(part=>["carnage","cyber","mutant"].forEach(set=>b.gear.push({part,rarity:5,set})));
      for(let el=0;el<7;el++) b.gear.push({part:"ring",rarity:5,kind:"el",el});
      ["hp","str","agi","spd"].forEach(stat=>b.gear.push({part:"ring",rarity:5,kind:"stat",stat}));
      if(typeof toast==="function") toast("🔓 Tout débloqué (armes, compétences, sets Divins, ressources) !");
    }
    persist();
  };
  GameFrame.mount(p);
  if(typeof DevLayoutManager!=="undefined") DevLayoutManager.mountAll(p);
  updateRackPositionExport();
  const button=$("#afk-dev-toggle");
  if(button){ button.classList.add("active"); button.setAttribute("aria-pressed","true"); button.setAttribute("aria-label","Désactiver le mode développeur"); button.title="Désactiver le mode développeur"; }
  if(S.cur) renderFiche(S.cur);
  Combat.majMonetisation();
  window.setTimeout(()=>{ if($("#devbox")) startAfkButtonEditing(); },220);
}
/* --- Raccourci du mode développeur (Ctrl+Maj+D) --- */
document.addEventListener("keydown",e=>{ if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==="d") toggleDevMode(); });



Combat.init();




// (l'ouverture du Simulateur est gérée par OV.reg.sim → TRAIN.open())

/* --- Canvas liés --- */
renderer.bind($("#cv-fiche"),()=>S.cur);
renderer.bind($("#cv-afk-hero"),()=>S.cur);   // brute active de l'écran AFK

/* --- Démarrage --- */
(() => { 
  const urls = []; 
  Object.keys(DataEngine.SPRITES).forEach(k => { 
    const S_ = DataEngine.SPRITES[k]; 
    if (S_) {
      // Sécurité : On s'assure que les propriétés existent avant de les lire
      if (S_.portrait) urls.push(S_.portrait);
      if (S_.sprite) urls.push(S_.sprite);
      if (S_.planches && Array.isArray(S_.planches)) {
        S_.planches.forEach(u => { if (u) urls.push(u); });
      }
    }
  });
  
  // Le i.onload = i.onerror = r permet de résoudre la promesse même si l'image est introuvable
  return Promise.all(urls.map(u => new Promise(r => { 
    const i = new Image(); 
    i.onload = () => { renderer.imgs["u|"+u] = i; r(); };
    i.onerror = () => { r(); }; // Si le .png n'existe pas, on ignore l'erreur sans bloquer le moteur
    i.src = encodeURI(u); 
  })));
})().then(() => {
  CharacterSelect.redrawAvatars();
  // On force le rafraîchissement de l'arène AFK une fois le démarrage nettoyé
  if (typeof AFKMode !== "undefined" && AFKMode.stage) AFKMode.setBg();
});
CharacterSelect.init({ onRecruit: cand => GameState.recruter(cand) });
GameState.boot();
