"use strict";
/* =====================================================================
   character-select.js : MODULE AUTONOME « Cuves de clonage » (recrutement)
   Contient : HTML, CSS, génération des candidats, loot caché, affichage.
   Dépend (à l'exécution seulement) de : DataEngine, CompanionData, renderer.
   API : CharacterSelect.init({ onRecruit: brute => ... })
         .show() / .hide() / .reroll() / .redrawAvatars() / .genBrute() / .rollLoot(b)
   genBrute() reste aussi disponible en global (PvP et combats l'utilisent).
   ===================================================================== */
const CharacterSelect = (() => {
  const Q = s => document.querySelector(s);
  const QA = s => [...document.querySelectorAll(s)];
  const NB_CANDIDATS = 3;
  const st = { cands: [], sel: 0, onRecruit: null, pret: false };
  // Replace a character's background gradient with its PNG path when artwork is ready.
  const FRAME_THEMES = {
    general: { glow: "rgba(143,155,114,.45)", png: "", gradient: "radial-gradient(circle at 76% 17%,#d7e2a8 0 5%,rgba(143,155,114,.55) 14%,transparent 32%),repeating-linear-gradient(90deg,rgba(143,155,114,.08) 0 1px,transparent 1px 16px),linear-gradient(180deg,#455044,#252d27 52%,#172019)" },
    empereur: { glow: "rgba(216,177,92,.45)", png: "", gradient: "radial-gradient(circle at 76% 17%,#fff0b0 0 5%,rgba(216,177,92,.5) 14%,transparent 32%),repeating-linear-gradient(90deg,rgba(216,177,92,.08) 0 1px,transparent 1px 16px),linear-gradient(180deg,#563b68,#30233f 52%,#1b1729)" },
    frankenstein: { glow: "rgba(121,214,111,.45)", png: "", gradient: "radial-gradient(circle at 76% 17%,#d7ff9f 0 5%,rgba(121,214,111,.5) 14%,transparent 32%),repeating-linear-gradient(90deg,rgba(121,214,111,.08) 0 1px,transparent 1px 16px),linear-gradient(180deg,#416a4b,#263d31 52%,#16251f)" },
    hazmat: { glow: "rgba(229,217,75,.45)", png: "", gradient: "radial-gradient(circle at 76% 17%,#fffba5 0 5%,rgba(229,217,75,.5) 14%,transparent 32%),repeating-linear-gradient(90deg,rgba(229,217,75,.08) 0 1px,transparent 1px 16px),linear-gradient(180deg,#656333,#3c3b25 52%,#222418)" },
    human: { glow: "rgba(107,183,232,.45)", png: "", gradient: "radial-gradient(circle at 76% 17%,#d3f0ff 0 5%,rgba(107,183,232,.5) 14%,transparent 32%),repeating-linear-gradient(90deg,rgba(107,183,232,.08) 0 1px,transparent 1px 16px),linear-gradient(180deg,#3b596c,#293744 52%,#17232d)" },
    inversebrah: { glow: "rgba(229,107,216,.45)", png: "", gradient: "radial-gradient(circle at 76% 17%,#ffd1f4 0 5%,rgba(229,107,216,.5) 14%,transparent 32%),repeating-linear-gradient(90deg,rgba(229,107,216,.08) 0 1px,transparent 1px 16px),linear-gradient(180deg,#68445e,#3e2a43 52%,#211b31)" },
    momie: { glow: "rgba(213,185,131,.45)", png: "", gradient: "radial-gradient(circle at 76% 17%,#fff1c8 0 5%,rgba(213,185,131,.5) 14%,transparent 32%),repeating-linear-gradient(90deg,rgba(213,185,131,.08) 0 1px,transparent 1px 16px),linear-gradient(180deg,#70614b,#453d32 52%,#27231e)" },
    samourai: { glow: "rgba(230,106,85,.45)", png: "", gradient: "radial-gradient(circle at 76% 17%,#ffd1a8 0 5%,rgba(230,106,85,.5) 14%,transparent 32%),repeating-linear-gradient(90deg,rgba(230,106,85,.08) 0 1px,transparent 1px 16px),linear-gradient(180deg,#713c3c,#462b31 52%,#251c26)" },
    zeus: { glow: "rgba(121,200,255,.45)", png: "", gradient: "radial-gradient(circle at 76% 17%,#e0f6ff 0 5%,rgba(121,200,255,.55) 14%,transparent 32%),repeating-linear-gradient(90deg,rgba(121,200,255,.08) 0 1px,transparent 1px 16px),linear-gradient(180deg,#3e6480,#293b55 52%,#171f35)" }
  };

  const CSS = `
#screen-select .avatars{display:flex;gap:10px;justify-content:center;overflow:hidden;padding:8px 6px 14px;scrollbar-width:thin}
#screen-select .avatar{flex:0 0 auto;width:68px;height:68px;border-radius:50%;border:2px solid var(--line);background:radial-gradient(circle at 50% 70%,#5a4020,#050805);padding:0;overflow:hidden;box-shadow:0 0 8px rgba(232,168,48,.25);transition:transform .15s}
#screen-select .avatar canvas{width:100%;height:100%;image-rendering:pixelated;display:block}
#screen-select .avatar:hover{border-color:var(--neon)}
#screen-select .avatar.sel{border-color:var(--plasma-l);transform:scale(1.14);box-shadow:0 0 0 2px rgba(182,32,224,.45),0 0 18px var(--plasma)}
#screen-select .recruit-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:6px}
#screen-select .stage{--frame-glow:#e8a830;display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;max-height:420px;width:100%;
  background-image:var(--frame-bg);background-size:cover;background-position:center;
  border:1px solid var(--frame-glow);border-radius:2px;box-shadow:inset 0 0 40px rgba(0,0,0,.7),0 0 14px var(--frame-glow)}
#screen-select .stage canvas{width:85%;height:85%;image-rendering:pixelated;filter:drop-shadow(0 0 6px rgba(232,168,48,.55))}
#screen-select .sheet h2{font-size:2.1rem;color:var(--neon);text-shadow:0 0 10px rgba(232,168,48,.7),2px 0 rgba(182,32,224,.6);margin-bottom:10px;word-break:break-word}
#screen-select .tag{color:var(--rust-l);font-size:.85rem;font-weight:700;margin:-4px 0 8px}
#screen-select .stat{margin:10px 0}
#screen-select .stat .row{display:flex;align-items:center;gap:10px}
#screen-select .stat .lbl{width:78px;font-weight:700;font-size:.9rem}
#screen-select .stat .val{margin-left:88px;font-size:.85rem;color:var(--neon)}
#screen-select .seg{display:flex;gap:3px;flex:1}
#screen-select .seg i{flex:1;height:16px;background:#070907;border:1px solid #3a2f18;border-radius:1px}
#screen-select .seg i.on{background:var(--neon);box-shadow:0 0 6px rgba(232,168,48,.8)}
#screen-select .seg.str i.on{background:var(--plasma);box-shadow:0 0 6px rgba(182,32,224,.9)}
#screen-select .seg.agi i.on{background:#b6ff00;box-shadow:0 0 6px rgba(182,255,0,.7)}
#screen-select .seg.spd i.on{background:var(--plasma-l);box-shadow:0 0 6px rgba(255,75,255,.8)}
#screen-select .flavor{margin-top:14px;padding:12px;background:rgba(182,32,224,.08);border-left:3px solid var(--plasma);color:#cfd6cc;font-style:italic}
#screen-select .actions{display:flex;flex-direction:column;gap:12px;align-items:center;margin-top:16px}
#screen-select .actions .btn{width:min(100%,460px)}
#screen-select .skills{display:grid;gap:5px;margin:10px 0}
#screen-select .sk{display:block;border:1px solid var(--c);border-left-width:5px;background:#14110d;padding:4px 8px;font-size:.82rem;color:var(--txt)}
#screen-select .sk i{font-style:normal;margin-right:6px}
#screen-select .sk small{display:block;color:var(--dim);font-size:.7rem;margin-top:1px}
#screen-select-root:has(#screen-select:not(.hidden)){min-height:100%;display:flex;align-items:center}
#screen-select{width:100%;height:100%;display:flex;flex-direction:column}
#screen-select .title{flex:none;font-size:2.5rem;margin:2px 0}
#screen-select .sub{flex:none;font-size:.85rem;margin:0 0 6px}
#screen-select #sel-recruit{display:flex;flex:1;min-height:0;flex-direction:column;padding:16px}
#screen-select #sel-recruit::before{display:none}
#screen-select #sel-recruit>.termbar{flex:none;margin-bottom:10px}
#screen-select .avatars{--avatar-gap:8px;--avatar-size:68px;display:flex;flex:none;align-items:center;justify-content:center;gap:var(--avatar-gap);overflow:hidden;padding:10px 0 8px}
#screen-select #avatar-list{display:flex;gap:var(--avatar-gap)}
#screen-select .avatar{flex:0 0 var(--avatar-size);width:var(--avatar-size);height:var(--avatar-size)}
#screen-select #btn-reroll{flex:none;width:var(--avatar-size);height:var(--avatar-size);padding:0;margin-left:calc(var(--avatar-gap)*3);border-radius:50%;font-size:1.8rem;line-height:1}
#screen-select .recruit-grid{display:grid;flex:1;min-height:0;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);grid-template-rows:auto;align-items:stretch;gap:14px}
#screen-select .stage{aspect-ratio:auto;max-height:none;width:100%;height:380px;justify-self:center;overflow:hidden}
#screen-select .sheet{display:flex;flex-direction:column;min-width:0;overflow:visible;font-size:.82rem;line-height:1.2}
#screen-select .sheet h2{flex:none;font-size:2.1rem;margin-bottom:8px}
#screen-select .stat{margin:6px 0}
#screen-select .stat .row{gap:6px}
#screen-select .stat .lbl{width:78px}
#screen-select .seg i{height:16px}
#screen-select .flavor{margin-top:10px;padding:10px}
#screen-select .skills{gap:5px;margin:10px 0}
#screen-select .sk{border-left-width:4px;padding:4px 8px;font-size:.9em}
#screen-select .sk small{font-size:.78em;line-height:1.1}
#screen-select #btn-recruit{flex:none;width:100%;margin-top:auto;padding:12px;font-size:1rem}`;

  const HTML = `
  <section id="screen-select">
    <div class="pane active plank panel" id="sel-recruit">
      <div class="avatars" id="avatars">
        <div id="avatar-list"></div>
        <button class="btn" id="btn-reroll" type="button" title="Changer les choix" aria-label="Changer les choix">↻</button>
      </div>
      <div class="recruit-grid">
        <div class="stage"><canvas id="cv-preview" width="64" height="64"></canvas></div>
        <div class="sheet" id="sheet"></div>
      </div>
    </div>
  </section>`;

  /* ---------- Outils privés (le module n'emprunte rien au HTML) ---------- */
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function seg(v, max, cls){
    const n = 14, f = Math.ceil(v / max * n); let h = `<div class="seg ${cls}">`;
    for (let i = 0; i < n; i++) h += `<i class="${i < f ? "on" : ""}"></i>`;
    return h + "</div>";
  }
  function skillBlock(b){
    const D = DataEngine;
    return `<div class="skills">` + b.skills.slice(0, 1).map(id => {
      const k = D.SKILLS[id], c = D.EL_COL[k.el];
      return `<span class="sk" style="--c:${c}" title="${k.desc}"><i>${D.EL_ICON[k.el]}</i>${k.name}<small>${D.ELEMENTS[k.el]} · ${{ A: "Attaque", C: "Contrôle", S: "Soutien" }[k.t]} — ${k.desc}</small></span>`;
    }).join("") + `</div>`;
  }
  function statBlock(stats, b){
    return [["HP", "hp"], ["Force", "str"], ["Agilité", "agi"], ["Vitesse", "spd"]].map(([l, k]) => {
      const bn = b ? DataEngine.gearBonus(b, k) : 0;
      return `<div class="stat"><div class="row"><span class="lbl">${l}</span>${seg(stats[k], 28, k)}</div><div class="val">${stats[k]}/28${bn ? ` <b style="color:#39ff14">(+${bn})</b>` : ""}</div></div>`;
    }).join("");
  }
  /* ---------- Génération ---------- */
  function genBrute(){
    const D = DataEngine;
    return {
      id: newId(), species: D.pick(["Canard", "Ornithorynque"]), style: D.pick(["punk", "cyborg", "survie"]),
      name: D.pick(D.SYL_A) + D.pick(D.SYL_B), hue: D.rnd(0, 359), sprite: D.pick(D.readyKeys()),
      stats: D.rollStartStats(), flavor: D.pick(D.FLAVORS),
      level: 1, xp: 0, xpMax: 100, energy: 15, energyMax: 15, gold: 300,
      weapons: [], gear: [], skills: D.pickSkills(1), companion: null
    };
  }
  // Loot caché à la création (jamais annoncé) : 65 % rien, 25 % 1 arme, 10 % 1 compagnon
  function rollLoot(b){
    const r = Math.random();
    if (r < .65) return;
    if (r < .90){ const w = DataEngine.pick(DataEngine.WEAPONS); if (!b.weapons.includes(w.id)) b.weapons.push(w.id); return; }
    b.companion = CompanionData.create(DataEngine.pick(Object.keys(CompanionData.SPECIES)));
  }

  /* ---------- Affichage ---------- */
  function redrawAvatars(){
    QA("#avatars canvas").forEach((cv, i) => { if (st.cands[i]) renderer.drawBrute(cv.getContext("2d"), st.cands[i], 0); });
  }
  function showCand(){
    const b = st.cands[st.sel]; if (!b) return;
    QA("#avatars .avatar").forEach((a, i) => a.classList.toggle("sel", i === st.sel));
    const theme = FRAME_THEMES[b.sprite] || FRAME_THEMES.general;
    const stage = Q(".stage");
    stage.style.setProperty("--frame-bg", theme.png ? `url("${theme.png}")` : theme.gradient);
    stage.style.setProperty("--frame-glow", theme.glow);
    Q("#sheet").innerHTML = `<h2>${b.name}</h2>${statBlock(b.stats, b)}${skillBlock(b)}<div class="flavor">${b.flavor}</div><button class="btn big gold" id="btn-recruit">RECRUTER CE REBELLE</button>`;
    Q("#btn-recruit").onclick = () => { if (st.onRecruit) st.onRecruit(b); };
  }
  function reroll(){
    st.cands = Array.from({ length: NB_CANDIDATS }, genBrute); st.sel = 0;
    const box = Q("#avatar-list"); box.innerHTML = "";
    st.cands.forEach((b, i) => {
      const btn = document.createElement("button"); btn.className = "avatar"; btn.title = b.name;
      const cv = document.createElement("canvas"); cv.width = cv.height = 64; btn.appendChild(cv);
      renderer.drawBrute(cv.getContext("2d"), b, 0);
      btn.onclick = () => { st.sel = i; showCand(); };
      box.appendChild(btn);
    });
    showCand();
  }

  /* ---------- Cycle de vie ---------- */
  function init(opts = {}){
    if (st.pret) return; st.pret = true;
    st.onRecruit = typeof opts.onRecruit === "function" ? opts.onRecruit : null;
    const root = Q("#screen-select-root");
    if (!root){ console.error("CharacterSelect : #screen-select-root introuvable."); return; }
    const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
    root.innerHTML = HTML;
    Q("#btn-reroll").onclick = reroll;
    renderer.bind(Q("#cv-preview"), () => st.cands[st.sel]);
    reroll();
  }
  const show = () => { const s = Q("#screen-select"); if (s) s.classList.remove("hidden"); reroll(); };
  const hide = () => { const s = Q("#screen-select"); if (s) s.classList.add("hidden"); };

  return { init, show, hide, reroll, redrawAvatars, genBrute, rollLoot };
})();

function genBrute(){ return CharacterSelect.genBrute(); }   // compat : combat.js et pvp.js l'appellent en global