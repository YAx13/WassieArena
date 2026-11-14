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

  const SELECT_BG = typeof assetPath !== "undefined" && assetPath.characterSelectBg ? assetPath.characterSelectBg() : "assets/backgrounds/character-select/background.jpeg";

  const CSS = `
@keyframes neonFlicker{0%{opacity:.25;filter:brightness(1.8)}35%{opacity:1}55%{opacity:.55}100%{opacity:1;filter:brightness(1)}}
#screen-select-root:has(#screen-select:not(.hidden)){min-height:100%;display:flex;align-items:center;justify-content:center;background:#090807}
#screen-select{width:100%;aspect-ratio:1376/768;max-height:100%;max-width:100%;margin:auto;background-color:#1a1510;background-size:100% 100%;background-position:center;background-repeat:no-repeat;position:relative;overflow:hidden;box-shadow:0 0 40px rgba(0,0,0,.95)}
#screen-select #sel-recruit{position:absolute;inset:0;padding:0;background:transparent;border:none;box-shadow:none}
#screen-select #sel-recruit::before{display:none}
#screen-select .city-stage{position:relative;width:100%;height:100%}

/* --- Base holographique CRT --- */
#screen-select .neon-sign{font-family:monospace;transition:transform .16s ease,box-shadow .16s ease}
#screen-select .neon-sign.flicker{animation:neonFlicker .28s ease-out}

/* 1. Grand écran cyan de gauche (inpaint) : Stats LED + Compétence (statique, sans survol) */
#screen-select .sign-hud{position:absolute;top:8.2%;left:11.8%;width:24.2%;height:22.4%;padding:8px 12px;display:flex;flex-direction:column;justify-content:space-between;background:transparent;border:none;box-shadow:none;pointer-events:none}
#screen-select .sheet{display:flex;flex-direction:column;gap:5px}
#screen-select .stat{margin:0}
#screen-select .stat .row{display:grid;grid-template-columns:56px 1fr;align-items:center;gap:8px}
#screen-select .stat .lbl{width:auto;font-weight:700;font-size:clamp(.58rem,.85vw,.74rem);color:#e6fbff;text-shadow:0 1px 2px #000;white-space:nowrap}
#screen-select .seg{display:grid;grid-template-columns:repeat(10,1fr);gap:3px;width:100%}
#screen-select .seg i{display:block;width:100%;height:9px;box-sizing:border-box;background:rgba(5,12,16,.78);border:1px solid rgba(79,240,230,.35);border-radius:1px}
#screen-select .seg i.on{background:#ffb000;box-shadow:0 0 6px #ffb000}
#screen-select .seg.str i.on{background:#ff5ed2;box-shadow:0 0 6px #ff5ed2}
#screen-select .seg.agi i.on{background:#9be15d;box-shadow:0 0 6px #9be15d}
#screen-select .seg.spd i.on{background:#4ff0e6;box-shadow:0 0 6px #4ff0e6}

/* Bloc compétence intégré dans le bas de l'écran cyan */
#screen-select .sign-skill{--sk-col:#ffb000;margin-top:4px;padding-top:4px;border-top:1px solid rgba(79,240,230,.35);color:#eef6ff}
#screen-select .sign-skill .sk-head{display:flex;align-items:center;gap:5px;font-size:clamp(.64rem,.98vw,.84rem);color:#fff;text-shadow:0 0 6px var(--sk-col)}
#screen-select .sign-skill .sk-type{font-size:clamp(.48rem,.72vw,.62rem);color:var(--sk-col);margin-top:1px;text-transform:uppercase}
#screen-select .sign-skill .sk-desc{font-size:clamp(.5rem,.76vw,.66rem);color:#d7e7f5;margin-top:2px;line-height:1.15;text-shadow:0 1px 2px #000}

/* --- Escouade posée sur la route (100% dégagée) --- */
#screen-select .road-squad{position:absolute;bottom:14.5%;left:50%;transform:translateX(-50%);width:54%;display:flex;align-items:flex-end;justify-content:space-between;pointer-events:none}
#screen-select .center-podium{position:relative;display:flex;flex-direction:column;align-items:center;z-index:3}
#screen-select .stage{width:clamp(130px,15.5vw,215px);height:clamp(130px,15.5vw,215px);display:flex;align-items:center;justify-content:center;background:transparent;border:none;box-shadow:none}
#screen-select .stage canvas{width:100%;height:100%;image-rendering:pixelated;filter:drop-shadow(0 6px 8px rgba(0,0,0,.9))}
#screen-select .side-cand{position:relative;width:clamp(84px,10vw,138px);height:clamp(84px,10vw,138px);padding:0;margin-bottom:14px;background:transparent;border:none;cursor:pointer;pointer-events:auto;opacity:.88;transition:transform .16s ease,opacity .16s ease,filter .16s ease}
#screen-select .side-cand:hover{opacity:1;transform:translateY(-6px) scale(1.08);filter:drop-shadow(0 0 12px rgba(79,240,230,.8))}
#screen-select .side-cand canvas{width:100%;height:100%;image-rendering:pixelated;display:block;filter:drop-shadow(0 5px 6px rgba(0,0,0,.85))}
#screen-select .ground-shadow{position:absolute;bottom:4px;width:62%;height:10px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.78) 0%,transparent 75%);pointer-events:none}
#screen-select .ground-shadow.main{bottom:6px;width:68%;height:13px}

/* --- Barre d'action en bas sur le bitume (Recruter + icône Reroll carrée) --- */
#screen-select .bottom-actions{position:absolute;bottom:3.5%;left:50%;transform:translateX(-42%);display:flex;align-items:stretch;gap:10px;z-index:5}
#screen-select .sign-recruit{position:relative;width:clamp(180px,20vw,250px);height:clamp(42px,5vw,52px);padding:0 16px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(8,16,20,.92);background-image:repeating-linear-gradient(0deg,rgba(79,240,230,.05) 0 1px,transparent 1px 3px);border:1px solid #4ff0e6;border-radius:2px;color:#7ffcf4;box-shadow:0 6px 20px rgba(0,0,0,.92),0 0 14px rgba(79,240,230,.38),inset 0 0 12px rgba(79,240,230,.14)}
#screen-select .sign-recruit::before,#screen-select .sign-recruit::after{content:"";position:absolute;width:6px;height:6px;border-color:#ffb000;border-style:solid;pointer-events:none}
#screen-select .sign-recruit::before{top:-1px;left:-1px;border-width:2px 0 0 2px}
#screen-select .sign-recruit::after{bottom:-1px;right:-1px;border-width:0 2px 2px 0}
#screen-select .sign-recruit:hover{transform:scale(1.04);background:rgba(10,24,30,.96);border-color:#7ffcf4;color:#fff;box-shadow:0 6px 22px rgba(0,0,0,.95),0 0 22px rgba(79,240,230,.8),inset 0 0 16px rgba(79,240,230,.28)}
#screen-select .sign-recruit .recruit-main{font-size:clamp(.86rem,1.15vw,1.05rem);font-weight:700;letter-spacing:2px;text-shadow:0 0 8px rgba(79,240,230,.85)}
#screen-select .sign-reroll{width:clamp(42px,5vw,52px);height:clamp(42px,5vw,52px);padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(14,10,16,.92);background-image:repeating-linear-gradient(0deg,rgba(255,94,210,.05) 0 1px,transparent 1px 3px);border:1px solid #ff5ed2;border-radius:2px;color:#ff9ce6;box-shadow:0 6px 18px rgba(0,0,0,.9),0 0 12px rgba(255,94,210,.4)}
#screen-select .sign-reroll:hover{transform:scale(1.06);box-shadow:0 0 20px rgba(255,94,210,.85);color:#fff}
#screen-select .sign-reroll .reroll-ico{font-size:clamp(1.2rem,1.8vw,1.55rem);line-height:1;text-shadow:0 0 8px #ff5ed2}`;

  const HTML = `
  <section id="screen-select">
    <div class="pane active" id="sel-recruit">
      <div class="city-stage">
        <!-- Grand écran cyan gauche : Stats LED + Compétence de départ -->
        <div class="neon-sign sign-hud" id="sign-stats">
          <div class="sheet" id="sheet"></div>
          <div class="sign-skill" id="sign-skill"></div>
        </div>

        <!-- Escouade posée sur le bitume de la route -->
        <div class="road-squad" id="avatars">
          <button class="side-cand left" id="cand-left" type="button" aria-label="Candidat précédent">
            <canvas width="64" height="64"></canvas>
            <i class="ground-shadow"></i>
          </button>

          <div class="center-podium">
            <div class="stage"><canvas id="cv-preview" width="64" height="64"></canvas></div>
            <i class="ground-shadow main"></i>
          </div>

          <button class="side-cand right" id="cand-right" type="button" aria-label="Candidat suivant">
            <canvas width="64" height="64"></canvas>
            <i class="ground-shadow"></i>
          </button>
        </div>

        <!-- Barre d'action en bas sur la route -->
        <div class="bottom-actions">
          <button class="neon-sign sign-recruit" id="btn-recruit" type="button">
            <span class="recruit-main">RECRUTER</span>
          </button>
          <button class="neon-sign sign-reroll" id="btn-reroll" type="button" title="Appeler 3 nouveaux rebelles" aria-label="Changer les choix">
            <span class="reroll-ico">↻</span>
          </button>
        </div>
      </div>
    </div>
  </section>`;

  /* ---------- Outils privés (le module n'emprunte rien au HTML) ---------- */
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function seg(v, max, cls){
    const n = 10, f = Math.max(0, Math.min(n, Math.round(v / max * n)));
    let h = `<div class="seg ${cls}">`;
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
  function statBlock(stats){
    return [["HP", "hp"], ["Force", "str"], ["Agilité", "agi"], ["Vitesse", "spd"]].map(([l, k]) =>
      `<div class="stat"><div class="row"><span class="lbl">${l}</span>${seg(stats[k], 10, k)}</div></div>`
    ).join("");
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
// Loot caché à la création (jamais annoncé) : 35 % rien, 65 % 1 arme
function rollLoot(b){
  if (Math.random() < .35) return;
  const w = DataEngine.pick(DataEngine.WEAPONS);
  if (!b.weapons.includes(w.id)) b.weapons.push(w.id);
}

  /* ---------- Affichage ---------- */
  function redrawAvatars(){
    QA("#avatars canvas").forEach((cv, i) => { if (st.cands[i]) renderer.drawBrute(cv.getContext("2d"), st.cands[i], 0); });
  }
  function flickerSigns(){
    QA("#screen-select .neon-sign").forEach(el => {
      el.classList.remove("flicker");
      void el.offsetWidth;
      el.classList.add("flicker");
    });
  }
  function showCand(){
    const b = st.cands[st.sel]; if (!b) return;
    const leftIdx = (st.sel + NB_CANDIDATS - 1) % NB_CANDIDATS;
    const rightIdx = (st.sel + 1) % NB_CANDIDATS;
    const drawSide = (sel, idx) => {
      const btn = Q(sel), cand = st.cands[idx]; if (!btn || !cand) return;
      btn.title = "Inspecter " + cand.name;
      btn.onclick = () => { st.sel = idx; showCand(); };
      const cv = btn.querySelector("canvas");
      if (cv) renderer.drawBrute(cv.getContext("2d"), cand, 0);
    };
    drawSide("#cand-left", leftIdx);
    drawSide("#cand-right", rightIdx);

    // 1. Grand écran cyan de gauche : Stats LED + Compétence de départ
    const D = DataEngine, k = D.SKILLS[b.skills[0]], c = D.EL_COL[k.el];
    Q("#sheet").innerHTML = statBlock(b.stats, b);
    const skBox = Q("#sign-skill");
    skBox.style.setProperty("--sk-col", c);
    skBox.innerHTML = `<div class="sk-head"><span>${D.EL_ICON[k.el]}</span><b>${k.name}</b></div><div class="sk-type">${D.ELEMENTS[k.el]} · ${{ A: "Attaque", C: "Contrôle", S: "Soutien" }[k.t]}</div><div class="sk-desc">${k.desc}</div>`;

    // 3. Bouton de recrutement sur la route
    Q("#btn-recruit").onclick = () => { if (st.onRecruit) st.onRecruit(b); };
    flickerSigns();
  }
  function reroll(){
    st.cands = Array.from({ length: NB_CANDIDATS }, genBrute);
    st.sel = 0;
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
    const selEl = Q("#screen-select");
    if (selEl) selEl.style.backgroundImage = `url("${encodeURI(SELECT_BG)}")`;
    Q("#btn-reroll").onclick = reroll;

    document.addEventListener("keydown", e => {
      const scr = Q("#screen-select");
      if (!scr || scr.classList.contains("hidden")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); st.sel = (st.sel + NB_CANDIDATS - 1) % NB_CANDIDATS; showCand(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); st.sel = (st.sel + 1) % NB_CANDIDATS; showCand(); }
      else if (e.key === "Enter" && !document.querySelector(".modal, [role='dialog']")) {
        const b = st.cands[st.sel]; if (b && st.onRecruit) st.onRecruit(b);
      }
    });

    const cv = Q("#cv-preview");
    let atkUntil = 0, nextAtk = performance.now() + 2400;
    const animLoop = now => {
      if (cv && cv.offsetParent && st.cands[st.sel]) {
        if (now >= nextAtk) { atkUntil = now + 520; nextAtk = now + 3000 + Math.random() * 1400; }
        const anim = now < atkUntil ? "punch" : "idle";
        renderer.drawBrute(cv.getContext("2d"), st.cands[st.sel], now, anim);
      }
      requestAnimationFrame(animLoop);
    };
    requestAnimationFrame(animLoop);
    reroll();
  }
  const show = () => { const s = Q("#screen-select"); if (s) s.classList.remove("hidden"); reroll(); };
  const hide = () => { const s = Q("#screen-select"); if (s) s.classList.add("hidden"); };

  return { init, show, hide, reroll, redrawAvatars, genBrute, rollLoot };
})();

function genBrute(){ return CharacterSelect.genBrute(); }   // compat : combat.js et pvp.js l'appellent en global