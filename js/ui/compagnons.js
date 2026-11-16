"use strict";

/* ================= Écurie / Compagnons (placement + projecteur d'évolution) ================= */
const COMP_LAYOUT_PREFIX = "arene_companion_dev_layout_v2_";
const HOLO_LAYOUT_PREFIX = "arene_comp_holo_layout_v2_";
const PROPS_LAYOUT_PREFIX = "arene_comp_props_layout_v1_";
let compEditing = false, compPositions = null, compDrag = null;
let holoPositions = null, holoDrag = null, propsPositions = null, propsDrag = null, activeCompSprite = null;

const PROPS_FROZEN = [
  { id: "feed", x: 16.5, y: 85.5, w: 14, h: 11, angle: 0 },
  { id: "incubate", x: 92.2, y: 32.0, w: 9, h: 15, angle: 0 },
  { id: "evolve", x: 78.5, y: 81.0, w: 11, h: 13, angle: 0 }
];
const PROPS_BRAWLER_OVERRIDES = {};

function defaultPropsPositions(spriteKey) {
  const base = PROPS_FROZEN.map(p => ({ ...p }));
  (PROPS_BRAWLER_OVERRIDES[spriteKey] || []).forEach(s => { const t = base.find(d => d.id === s.id); if (t) Object.assign(t, s); });
  return base;
}
function readPropsPositions(spriteKey) {
  try {
    const arr = JSON.parse(localStorage.getItem(PROPS_LAYOUT_PREFIX + spriteKey) || "null");
    return Array.isArray(arr) && arr.length === 3 ? arr : null;
  } catch (e) { return null; }
}
function savePropsPositions() {
  if (!propsPositions || !activeCompSprite) return;
  try { localStorage.setItem(PROPS_LAYOUT_PREFIX + activeCompSprite, JSON.stringify(propsPositions)); } catch (e) {}
  console.log(`PROPS_OVERRIDE_${activeCompSprite.toUpperCase()} =`, JSON.stringify(propsPositions.map(({ id, x, y, w, h, angle }) => ({ id, x: +x.toFixed(2), y: +y.toFixed(2), w: +w.toFixed(2), h: +h.toFixed(2), angle: +(angle || 0).toFixed(1) }))));
}
function applyPropPos(el, pos) {
  el.style.left = pos.x + "%";
  el.style.top = pos.y + "%";
  el.style.width = pos.w + "%";
  el.style.height = pos.h + "%";
  el.style.transform = `translate(-50%,-50%) rotate(${pos.angle || 0}deg)`;
}

const COMP_FROZEN = [
  { key: "chien", x: 16.38, y: 16.33, size: 27.5, angle: 0, flip: false },
  { key: "loup", x: 72.11, y: 53.13, size: 20, angle: 0, flip: false },
  { key: "ours", x: 27.7, y: 52.52, size: 22.5, angle: 0, flip: false },
  { key: "serpent", x: 38.96, y: 15.35, size: 22.5, angle: 0, flip: false },
  { key: "oiseau", x: 61.1, y: 16.21, size: 22.5, angle: 0, flip: false },
  { key: "arthropode", x: 83.36, y: 15.72, size: 27.5, angle: 0, flip: false },
  { key: "felin", x: 71.95, y: 20.3, size: 10, angle: 0, flip: false },
  { key: "taureau", x: 16.76, y: 56.67, size: 27.5, angle: 0, flip: false },
  { key: "aquatique", x: 27.96, y: 15.72, size: 23.5, angle: 0, flip: false },
  { key: "chimere", x: 38.9, y: 51.29, size: 20, angle: 0, flip: false },
  { key: "lezard", x: 49.78, y: 16.94, size: 20, angle: 0, flip: false },
  { key: "spectre", x: 50, y: 51.17, size: 26, angle: 0, flip: false },
  { key: "tempete", x: 83.36, y: 57.16, size: 23.5, angle: 0, flip: false }
];

const HOLO_FROZEN = [
  { id: "st1", x: 37.48, y: 71.69, size: 2, angle: 0, flip: false },
  { id: "ar1", x: 43.2, y: 75, size: 4.5, angle: 0, flip: false },
  { id: "st2", x: 49.74, y: 71.59, size: 4.8, angle: 0, flip: false },
  { id: "ar2", x: 56, y: 73, size: 4.5, angle: 0, flip: false },
  { id: "st3", x: 63.32, y: 68.47, size: 2.6, angle: 0, flip: false }
];

// Légers ajustements par personnage par-dessus le modèle global (ex: momie: [{ key: "serpent", x: 40.5, y: 21.5 }])
const COMP_BRAWLER_OVERRIDES = {};
const HOLO_BRAWLER_OVERRIDES = {};

function defaultCompPositions(spriteKey) {
  const cols = 7;
  const base = CompanionData.FAMILIES.map((f, i) => ({
    key: f.key, x: 10 + (i % cols) * 13.2, y: i < cols ? 34 : 74, size: 26, angle: 0, flip: false
  }));
  COMP_FROZEN.forEach(s => { const t = base.find(d => d.key === s.key); if (t) Object.assign(t, s); });
  (COMP_BRAWLER_OVERRIDES[spriteKey] || []).forEach(s => { const t = base.find(d => d.key === s.key); if (t) Object.assign(t, s); });
  return base;
}

function readCompPositions(spriteKey) {
  try {
    const arr = JSON.parse(localStorage.getItem(COMP_LAYOUT_PREFIX + spriteKey) || "null");
    return Array.isArray(arr) && arr.length === CompanionData.FAMILIES.length ? arr : null;
  } catch (e) { return null; }
}

function saveCompPositions() {
  if (!compPositions || !activeCompSprite) return;
  try { localStorage.setItem(COMP_LAYOUT_PREFIX + activeCompSprite, JSON.stringify(compPositions)); } catch (e) {}
  console.log(`COMP_OVERRIDE_${activeCompSprite.toUpperCase()} =`, JSON.stringify(compPositions.map(({ key, x, y, size, angle, flip }) => ({ key, x: +x.toFixed(2), y: +y.toFixed(2), size: +(size || 26).toFixed(2), angle: +(angle || 0).toFixed(1), flip: !!flip }))));
}

function defaultHoloPositions(spriteKey) {
  const base = [
    { id: "st1", x: 37.5, y: 75, size: 14, angle: 0, flip: false },
    { id: "ar1", x: 43.2, y: 75, size: 4.5, angle: 0, flip: false },
    { id: "st2", x: 49.5, y: 73, size: 18, angle: 0, flip: false },
    { id: "ar2", x: 56.0, y: 73, size: 4.5, angle: 0, flip: false },
    { id: "st3", x: 63.0, y: 70, size: 23, angle: 0, flip: false }
  ];
  HOLO_FROZEN.forEach(s => { const t = base.find(d => d.id === s.id); if (t) Object.assign(t, s); });
  (HOLO_BRAWLER_OVERRIDES[spriteKey] || []).forEach(s => { const t = base.find(d => d.id === s.id); if (t) Object.assign(t, s); });
  return base;
}

function readHoloPositions(spriteKey) {
  try {
    const arr = JSON.parse(localStorage.getItem(HOLO_LAYOUT_PREFIX + spriteKey) || "null");
    return Array.isArray(arr) && arr.length === 5 ? arr : null;
  } catch (e) { return null; }
}

function saveHoloPositions() {
  if (!holoPositions || !activeCompSprite) return;
  try { localStorage.setItem(HOLO_LAYOUT_PREFIX + activeCompSprite, JSON.stringify(holoPositions)); } catch (e) {}
  console.log(`HOLO_OVERRIDE_${activeCompSprite.toUpperCase()} =`, JSON.stringify(holoPositions.map(({ id, x, y, size, angle, flip }) => ({ id, x: +x.toFixed(2), y: +y.toFixed(2), size: +(size || 14).toFixed(2), angle: +(angle || 0).toFixed(1), flip: !!flip }))));
}

function exportCompLayoutStore() {
  const pods = Object.assign({ global: COMP_FROZEN }, JSON.parse(JSON.stringify(COMP_BRAWLER_OVERRIDES)));
  const holo = Object.assign({ global: HOLO_FROZEN }, JSON.parse(JSON.stringify(HOLO_BRAWLER_OVERRIDES)));
  const props = Object.assign({ global: PROPS_FROZEN }, JSON.parse(JSON.stringify(PROPS_BRAWLER_OVERRIDES)));
  const chars = Array.from(new Set(["dummy", ...(DataEngine.BRAWLERS || [])]));
  chars.forEach(k => {
    const p = readCompPositions(k);
    if (p) pods[k] = p.map(({ key, x, y, size, angle, flip }) => ({ key, x: +x.toFixed(2), y: +y.toFixed(2), size: +(size || 26).toFixed(2), angle: +(angle || 0).toFixed(1), flip: !!flip }));
    const h = readHoloPositions(k);
    if (h) holo[k] = h.map(({ id, x, y, size, angle, flip }) => ({ id, x: +x.toFixed(2), y: +y.toFixed(2), size: +(size || 14).toFixed(2), angle: +(angle || 0).toFixed(1), flip: !!flip }));
    const pr = readPropsPositions(k);
    if (pr) props[k] = pr.map(({ id, x, y, w, h, angle }) => ({ id, x: +x.toFixed(2), y: +y.toFixed(2), w: +w.toFixed(2), h: +h.toFixed(2), angle: +(angle || 0).toFixed(1) }));
  });
  return { pods, holo, props };
}

function applyHoloItemPos(el, pos) {
  el.style.position = "absolute";
  el.style.left = pos.x + "%";
  el.style.top = pos.y + "%";
  el.style.transform = `translate(-50%,-50%) rotate(${pos.angle || 0}deg)`;
  const cv = el.querySelector(".comp-cv");
  if (cv) {
    cv.style.height = (pos.size || 16) + "vh";
    cv.style.width = "auto";
    cv.style.aspectRatio = "1 / 1";
    cv.style.transform = `scaleX(${pos.flip ? -1 : 1})`;
  } else {
    el.style.fontSize = Math.max(12, (pos.size || 4.5) * 3.4) + "px";
  }
}

function applyCompPosition(btn, pos) {
  const pct = pos.size || 26;
  const isPod = btn.classList.contains("fx-comp-pet");
  btn.style.position = "absolute";
  btn.style.left = pos.x + "%";
  btn.style.top = pos.y + "%";
  btn.style.height = pct + "%";
  btn.style.width = "auto";
  btn.style.aspectRatio = isPod ? "1 / 2" : "1 / 1";
  btn.style.margin = "0";
  btn.style.transform = `translate(-50%,-50%) rotate(${pos.angle || 0}deg) scaleX(${pos.flip ? -1 : 1})`;
}

function updateCompDevUI() {
  const compPanel = $(".fx-panel.fx-comp");
  if (!compPanel) return;
  let bar = $("#fx-comp-devbar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "fx-comp-devbar";
    bar.style.cssText = "position:absolute;right:12px;bottom:12px;z-index:25;display:flex;gap:6px;align-items:center";
    bar.innerHTML = `<button type="button" id="fx-comp-reset" class="fx-btn" style="position:static!important;width:auto!important;height:auto!important;padding:4px 8px!important;font-size:11px!important">↺ Reset (${activeCompSprite || "dummy"})</button><button type="button" id="fx-comp-edit" class="fx-btn" style="position:static!important;width:auto!important;height:auto!important;padding:4px 8px!important;font-size:11px!important"></button>`;
    compPanel.appendChild(bar);
  }
  const dev = !!$("#devbox"), edit = $("#fx-comp-edit"), rst = $("#fx-comp-reset");
  bar.style.display = dev ? "flex" : "none";
  if (rst) {
    rst.textContent = `↺ Reset (${activeCompSprite || "dummy"})`;
    rst.onclick = () => {
      if (!activeCompSprite) return;
      try {
        localStorage.removeItem(COMP_LAYOUT_PREFIX + activeCompSprite);
        localStorage.removeItem(HOLO_LAYOUT_PREFIX + activeCompSprite);
        localStorage.removeItem(PROPS_LAYOUT_PREFIX + activeCompSprite);
      } catch (e) {}
      compPositions = defaultCompPositions(activeCompSprite);
      holoPositions = defaultHoloPositions(activeCompSprite);
      propsPositions = defaultPropsPositions(activeCompSprite);
      renderFiche(S.cur);
    };
  }
  if (edit) {
    edit.textContent = compEditing ? "Terminer le placement" : "Éditer les compagnons";
    edit.onclick = () => { compEditing = !compEditing; renderFiche(S.cur); };
  }
}

function attachCompEditor(stage) {
  if (stage.dataset.editorBound) return;
  stage.dataset.editorBound = "1";
  stage.addEventListener("pointerdown", ev => {
    if (!compEditing) return;
    const btn = ev.target.closest("[data-fam]");
    if (!btn) return;
    ev.preventDefault(); ev.stopPropagation();
    const pos = compPositions.find(p => p.key === btn.dataset.fam);
    if (!pos) return;
    compDrag = { key: btn.dataset.fam, pos, pointerId: ev.pointerId, stage };
    btn.setPointerCapture(ev.pointerId);
  });
  stage.addEventListener("pointermove", ev => {
    if (!compDrag || ev.pointerId !== compDrag.pointerId) return;
    const { key, pos, stage } = compDrag, rect = stage.getBoundingClientRect();
    pos.x = Math.max(2, Math.min(98, (ev.clientX - rect.left) / rect.width * 100));
    pos.y = Math.max(6, Math.min(96, (ev.clientY - rect.top) / rect.height * 100));
    const btn = stage.querySelector(`[data-fam="${key}"]`);
    if (btn) applyCompPosition(btn, pos);
  });
  const end = ev => { if (compDrag && ev.pointerId === compDrag.pointerId) { compDrag = null; saveCompPositions(); } };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  stage.addEventListener("contextmenu", ev => {
    if (!compEditing) return;
    const btn = ev.target.closest("[data-fam]");
    if (!btn) return;
    ev.preventDefault();
    const pos = compPositions.find(p => p.key === btn.dataset.fam);
    if (pos) { pos.flip = !pos.flip; applyCompPosition(btn, pos); saveCompPositions(); }
  });
  stage.addEventListener("wheel", ev => {
    if (!compEditing) return;
    const btn = ev.target.closest("[data-fam]");
    if (!btn) return;
    ev.preventDefault(); ev.stopPropagation();
    const pos = compPositions.find(p => p.key === btn.dataset.fam);
    if (!pos) return;
    if (ev.shiftKey) pos.angle = (pos.angle || 0) + (ev.deltaY < 0 ? 5 : -5);
    else pos.size = Math.max(10, Math.min(70, (pos.size || 26) + (ev.deltaY < 0 ? 2.5 : -2.5)));
    applyCompPosition(btn, pos);
    saveCompPositions();
  }, { passive: false });
}

const DUMMY_PET_FILES = {
  chien: "dog.png", loup: "wolf.png", ours: "ours.png", serpent: "snake.png",
  oiseau: "bird.png", arthropode: "beetle.png", felin: "cat.png", taureau: "bull.png",
  aquatique: "aqua.png", chimere: "racoon.png", lezard: "lizard.png", spectre: "spectre.png", tempete: "eagle.png"
};
function dummyPetArt(key, form) {
  const file = DUMMY_PET_FILES[key];
  return file ? `assets/pet/form-${Math.min(3, Math.max(1, +form || 1))}/${file}` : "";
}

function startCompIdleLoop() {
  if (window._compIdleLoop) return;
  window._compIdleLoop = true;
  const cache = {};
  const tick = now => {
    const holoFrame = Math.floor(now / 180) % 4;
    document.querySelectorAll(".fx-panel.fx-comp .comp-cv").forEach((cv, idx) => {
      if (!cv.offsetParent) return;
      const inPod = !!cv.closest(".fx-comp-pet"), locked = !!cv.closest(".locked");
      const petArt = inPod ? cv.dataset.petArt : "";
      const fallbackSrc = cv.dataset.art;
      let src = petArt || fallbackSrc;
      if (!src) return;
      let im = cache[src];
      if (!im) {
        im = cache[src] = new Image();
        im.onerror = () => { im._broken = true; };
        im.src = src;
      }
      if (im._broken && petArt && fallbackSrc) {
        src = fallbackSrc;
        im = cache[src] || (cache[src] = Object.assign(new Image(), { src }));
      }
      if (!im.complete || !im.naturalWidth) return;
      const isStaticPod = !!petArt && !im._broken;
      const cw = cv.width, ch = cv.height, ctx = cv.getContext("2d");
      ctx.clearRect(0, 0, cw, ch);
      ctx.imageSmoothingEnabled = false;
      ctx.globalCompositeOperation = "source-over";
      if (inPod) {
        const ph = idx * 1.37;
        const form = +(cv.dataset.form || 1);
        const bob = isStaticPod && form >= 3 ? 0 : Math.sin(now / 650 + ph) * (isStaticPod ? 2 : 3.5);
        const tilt = isStaticPod ? (form >= 3 ? 0 : Math.sin(now / 950 + ph) * 0.03) : Math.sin(now / 950 + ph) * 0.08;
        ctx.save();
        ctx.translate(cw / 2, ch / 2 + bob);
        ctx.rotate(tilt);
        if (isStaticPod) {
          ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, -cw * 0.46, -ch * 0.48, cw * 0.92, ch * 0.96);
        } else {
          const fw = im.naturalWidth / 4, fh = im.naturalHeight / 4;
          ctx.drawImage(im, 0, 0, fw, fh, -28, -28, 56, 56);
        }
        ctx.restore();
        if (locked) {
          ctx.globalCompositeOperation = "source-atop";
          const grd = ctx.createRadialGradient(cw / 2, ch / 2, 4, cw / 2, ch / 2, ch * 0.48);
          grd.addColorStop(0, "rgba(8, 42, 54, 0.88)");
          grd.addColorStop(1, "rgba(14, 116, 144, 0.94)");
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, cw, ch);
          ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = "rgba(45, 212, 191, 0.14)";
          ctx.fillRect(0, 0, cw, ch);
          ctx.globalCompositeOperation = "source-over";
        }
        // Micro-bulles montantes dans le liquide
        ctx.fillStyle = locked ? "rgba(56, 232, 255, 0.35)" : "rgba(186, 245, 255, 0.55)";
        for (let b = 0; b < 3; b++) {
          const by = (ch - 6) - (((now / 28) + idx * 19 + b * 21) % (ch - 10));
          const bx = (cw * 0.28) + ((idx * 13 + b * 17) % (cw * 0.44)) + Math.sin(now / 300 + b) * 2;
          ctx.fillRect(Math.round(bx), Math.round(by), b === 0 ? 2 : 1, b === 0 ? 2 : 1);
        }
      } else {
        const fw = im.naturalWidth / 4, fh = im.naturalHeight / 4;
        ctx.drawImage(im, holoFrame * fw, 0, fw, fh, 0, 0, 64, 64);
        if (locked) {
          ctx.globalCompositeOperation = "source-atop";
          const grd = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
          grd.addColorStop(0, "rgba(8, 42, 54, 0.88)");
          grd.addColorStop(1, "rgba(14, 116, 144, 0.94)");
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, 64, 64);
          ctx.fillStyle = "rgba(56, 232, 255, 0.24)";
          for (let y = 0; y < 64; y += 4) ctx.fillRect(0, y, 64, 1);
          ctx.globalCompositeOperation = "source-over";
        }
      }
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderCompanionsPanel(b) {
  const E = FX.esc, c = b.companion, cf = c ? CompanionData.family(c) : null;
  const roster = Array.isArray(b.companions) ? b.companions : (c ? [c] : []);
  const findOwned = f => roster.find(x => x && CompanionData.family(x) === f) || null;
  const compPanel = $(".fx-panel.fx-comp"), stage = $("#fx-comp");
  if (compPanel) {
    compPanel.style.background = `url("${DataEngine.getCompanionBg(b.sprite)}") center/cover no-repeat`;
    let fg = compPanel.querySelector(".comp-fg-layer");
    if (!fg) { fg = document.createElement("div"); fg.className = "comp-fg-layer"; compPanel.appendChild(fg); }
    fg.style.backgroundImage = `url("${DataEngine.getCompanionFg(b.sprite)}")`;
  }
  const sp = b.sprite || "general";
  if (activeCompSprite !== sp) {
    activeCompSprite = sp;
    compPositions = readCompPositions(sp) || defaultCompPositions(sp);
    holoPositions = readHoloPositions(sp) || defaultHoloPositions(sp);
    propsPositions = readPropsPositions(sp) || defaultPropsPositions(sp);
  }
  if (!propsPositions) propsPositions = readPropsPositions(sp) || defaultPropsPositions(sp);
  const caps = (GameState.ressources && GameState.ressources.capsules) || 0;
  const food = (GameState.ressources && GameState.ressources.nourriture) || 0;
  const stones = (GameState.ressources && GameState.ressources.pierres) || 0;
  const shards = b.dnaShards || 0;
  const ccEl = $("#fx-ccount");
  if (ccEl) ccEl.textContent = `${roster.length}/${CompanionData.FAMILIES.length}`;
  if (compPanel) {
    if (!document.getElementById("comp-prop-styles")) {
      const pst = document.createElement("style");
      pst.id = "comp-prop-styles";
      pst.textContent = `
        @keyframes compPropSpark{0%{opacity:0;transform:translateY(6px) scale(.6)}35%{opacity:1}100%{opacity:0;transform:translateY(-22px) scale(1.15)}}
        .comp-prop-zone{position:absolute;pointer-events:auto;background:transparent;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:box-shadow .2s,background .2s;touch-action:none}
        .comp-prop-zone .cp-sparks{position:absolute;inset:0;pointer-events:none;overflow:visible}
        .comp-prop-zone .cp-sparks i{position:absolute;width:4px;height:4px;border-radius:50%;background:var(--pc,#4ff0e6);box-shadow:0 0 8px var(--pc,#4ff0e6),0 0 14px var(--pc,#4ff0e6);opacity:0}
        .comp-prop-zone .cp-sparks i:nth-child(1){left:24%;top:34%;animation-delay:0s}
        .comp-prop-zone .cp-sparks i:nth-child(2){left:72%;top:46%;animation-delay:.35s}
        .comp-prop-zone .cp-sparks i:nth-child(3){left:38%;top:64%;animation-delay:.7s}
        .comp-prop-zone .cp-sparks i:nth-child(4){left:64%;top:26%;animation-delay:1.05s}
        #comp-lab-props:not(.is-editing) .comp-prop-zone:hover{background:radial-gradient(ellipse at center,var(--pg,rgba(79,240,230,.16)) 0%,transparent 72%);box-shadow:inset 0 0 16px var(--pg,rgba(79,240,230,.28)),0 0 14px var(--pg,rgba(79,240,230,.25))}
        #comp-lab-props:not(.is-editing) .comp-prop-zone:hover .cp-sparks i{animation:compPropSpark 1.4s ease-out infinite}
        #comp-lab-props:not(.is-editing) .comp-prop-zone.sparking{background:radial-gradient(ellipse at center,var(--pg,rgba(255,200,90,.38)) 0%,transparent 75%);box-shadow:0 0 24px var(--pc,#ffb000)}
        #comp-lab-props:not(.is-editing) .comp-prop-zone.sparking .cp-sparks i{animation:compPropSpark .55s ease-out 1}
        #comp-lab-props.is-editing .comp-prop-zone{outline:1.5px dashed #f2b21c !important;background:rgba(242,178,28,.14) !important;cursor:grab !important}
        #comp-lab-props.is-editing .comp-prop-zone:active{cursor:grabbing !important}
        #comp-lab-props.is-editing .comp-prop-zone::after{content:attr(data-edit-lbl);font:bold 11px monospace;color:#ffd24d;text-shadow:0 1px 3px #000;pointer-events:none;white-space:nowrap}
      `;
      document.head.appendChild(pst);
    }
    const oldInc = compPanel.querySelector("#comp-incubate-bar");
    if (oldInc) oldInc.remove();
    let propsLayer = compPanel.querySelector("#comp-lab-props");
    if (!propsLayer) {
      propsLayer = document.createElement("div");
      propsLayer.id = "comp-lab-props";
      Object.assign(propsLayer.style, { position: "absolute", inset: "0", zIndex: "24", pointerEvents: "none" });
      compPanel.appendChild(propsLayer);

      propsLayer.addEventListener("pointerdown", ev => {
        if (!compEditing) return;
        const el = ev.target.closest("[data-prop]"); if (!el) return;
        ev.preventDefault(); ev.stopPropagation();
        const pos = propsPositions.find(p => p.id === el.dataset.prop); if (!pos) return;
        const rect = compPanel.getBoundingClientRect();
        propsDrag = { el, pos, sx: ((ev.clientX - rect.left) / rect.width) * 100, sy: ((ev.clientY - rect.top) / rect.height) * 100, ox: pos.x, oy: pos.y, pointerId: ev.pointerId };
        try { el.setPointerCapture(ev.pointerId); } catch (_) {}
      }, true);
      propsLayer.addEventListener("pointermove", ev => {
        if (!propsDrag || ev.pointerId !== propsDrag.pointerId) return;
        const rect = compPanel.getBoundingClientRect();
        const px = ((ev.clientX - rect.left) / rect.width) * 100;
        const py = ((ev.clientY - rect.top) / rect.height) * 100;
        propsDrag.pos.x = Math.max(2, Math.min(98, propsDrag.ox + (px - propsDrag.sx)));
        propsDrag.pos.y = Math.max(4, Math.min(96, propsDrag.oy + (py - propsDrag.sy)));
        applyPropPos(propsDrag.el, propsDrag.pos);
      }, true);
      const endProp = ev => { if (propsDrag && ev.pointerId === propsDrag.pointerId) { propsDrag = null; savePropsPositions(); } };
      propsLayer.addEventListener("pointerup", endProp, true);
      propsLayer.addEventListener("pointercancel", endProp, true);
      propsLayer.addEventListener("click", ev => {
        if (!compEditing || !ev.target.closest("[data-prop]")) return;
        ev.preventDefault(); ev.stopImmediatePropagation();
      }, true);
      propsLayer.addEventListener("wheel", ev => {
        if (!compEditing) return;
        const el = ev.target.closest("[data-prop]"); if (!el) return;
        ev.preventDefault(); ev.stopPropagation();
        const pos = propsPositions.find(p => p.id === el.dataset.prop); if (!pos) return;
        const d = (ev.deltaY || ev.deltaX) < 0 ? 1.06 : 0.94;
        if (ev.shiftKey) pos.angle = (pos.angle || 0) + ((ev.deltaY || ev.deltaX) < 0 ? 5 : -5);
        else { pos.w = Math.max(4, Math.min(60, +(pos.w * d).toFixed(2))); pos.h = Math.max(4, Math.min(60, +(pos.h * d).toFixed(2))); }
        applyPropPos(el, pos); savePropsPositions();
      }, { passive: false, capture: true });
    }
    propsLayer.classList.toggle("is-editing", compEditing);
    const sparks = '<span class="cp-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
    propsLayer.innerHTML = `
      <div class="comp-prop-zone" data-prop="feed" data-edit-lbl="🥩 FEED" title="Feeding Trough · +50 XP (Food: ${food})" style="--pc:#fbbf24;--pg:rgba(251,191,36,.22)">${sparks}</div>
      <div class="comp-prop-zone" data-prop="incubate" data-edit-lbl="🥚 INCUBATE" title="Incubator Terminal · Hatch Capsule (${caps}${shards > 0 ? ` · DNA ${shards}/3` : ""})" style="--pc:#38bdf8;--pg:rgba(56,232,255,.22)">${sparks}</div>
      <div class="comp-prop-zone" data-prop="evolve" data-edit-lbl="💎 EVOLVE" title="Crystal Socket · Final Evolution Form 3 (Stones: ${stones})" style="--pc:#c084fc;--pg:rgba(192,132,252,.24)">${sparks}</div>
    `;
    propsLayer.querySelectorAll("[data-prop]").forEach(el => {
      const pos = propsPositions.find(p => p.id === el.dataset.prop);
      if (pos) applyPropPos(el, pos);
    });
    const pulseProp = el => { el.classList.remove("sparking"); void el.offsetWidth; el.classList.add("sparking"); };
    const feedProp = propsLayer.querySelector('[data-prop="feed"]');
    if (feedProp) feedProp.onclick = e => {
      if (compEditing) return;
      e.stopPropagation(); pulseProp(feedProp);
      const famKey = (holo && holo.dataset.fam) || (cf && cf.key);
      if (famKey && typeof CaserneUI !== "undefined") CaserneUI.nourrir(famKey);
    };
    const incProp = propsLayer.querySelector('[data-prop="incubate"]');
    if (incProp) incProp.onclick = e => {
      if (compEditing) return;
      e.stopPropagation(); pulseProp(incProp);
      if (typeof CaserneUI !== "undefined") CaserneUI.incuberCapsule();
    };
    const evoProp = propsLayer.querySelector('[data-prop="evolve"]');
    if (evoProp) evoProp.onclick = e => {
      if (compEditing) return;
      e.stopPropagation(); pulseProp(evoProp);
      const famKey = (holo && holo.dataset.fam) || (cf && cf.key);
      if (famKey && typeof CaserneUI !== "undefined") CaserneUI.evoluerForme3(famKey);
    };
  }
  updateCompDevUI();
  if (!compPositions) compPositions = readCompPositions(sp) || defaultCompPositions(sp);
  stage.classList.toggle("is-editing", compEditing);
  stage.innerHTML = CompanionData.FAMILIES.map(f => {
    const ownedObj = findOwned(f);
    const o = !!ownedObj, eq = f === cf, form = o ? (ownedObj.form || 1) : 1, art = DataEngine.getCompanionArt(f.key, form);
    const pArt = dummyPetArt(f.key, form);
    return `<button class="fx-comp-pet ${o ? "owned" : "locked"} ${eq ? "equipped" : ""}" data-fam="${f.key}" title="${E(f.name)} — ${E(f.spec)}" aria-label="${o ? E(f.name) : "Unknown Pet"}"><canvas class="comp-cv" width="64" height="128" data-form="${form}" data-art="${E(art)}" data-pet-art="${E(pArt)}"></canvas></button>`;
  }).join("");
  requestAnimationFrame(() => {
    stage.querySelectorAll(".fx-comp-pet").forEach(btn => {
      const pos = compPositions.find(p => p.key === btn.dataset.fam);
      if (pos) applyCompPosition(btn, pos);
    });
  });
  attachCompEditor(stage);

  if (!holoPositions) holoPositions = readHoloPositions(sp) || defaultHoloPositions(sp);
  let holo = compPanel && compPanel.querySelector(".comp-holo-stage");
  const showHolo = key => {
    const f = CompanionData.FAMILIES.find(x => x.key === key); if (!f || !holo) return;
    const ownedObj = findOwned(f);
    const unlockedForm = ownedObj ? (ownedObj.form || 1) : 0;
    const max = CompanionData.LEVEL_CAP;
    const isEquipped = !!(ownedObj && c === ownedObj);
    let hudHTML = "";
    if (!ownedObj) {
      hudHTML = `<span style="color:#94a3b8">🔒 <b>${E(f.name)}</b> · ${E(f.spec)} · Incubate a Capsule at the terminal to unlock</span>`;
    } else {
      const xpTxt = ownedObj.level < max ? ` · XP ${ownedObj.xp}/${ownedObj.xpMax}` : "";
      const eqHTML = isEquipped
        ? `<span style="color:#4ade80;font-weight:bold">✔ EQUIPPED</span>`
        : `<button type="button" id="pet-hud-equip" class="fx-btn" style="padding:2px 8px;font-size:10px;background:#854d0e;border-color:#facc15;color:#fef08a;cursor:pointer">⚔️ EQUIP</button>`;
      const stateHTML = unlockedForm === 3
        ? `<span style="color:#fbbf24;font-weight:bold">✨ LEGENDARY FORM</span>`
        : (typeof CaserneUI !== "undefined" && CaserneUI.peutForme3(ownedObj))
          ? `<button type="button" id="pet-hud-evo" class="fx-btn" style="padding:2px 8px;font-size:10px;background:#581c87;border-color:#c084fc;color:#f3e8ff;cursor:pointer">💎 EVOLVE FORM 3</button>`
          : `<span style="color:#cbd5e1">Form 3: Lv.${max} + 1💎</span>`;
      hudHTML = `<span><b style="color:#fde68a">${E(ownedObj.name)}</b> · Form ${unlockedForm} · Lv. ${ownedObj.level}/${max}${xpTxt}</span><span style="color:#7dd3fc">${E(f.spec)}</span>${eqHTML}${stateHTML}`;
    }
    holo.dataset.fam = key;
    holo.innerHTML = [
      `<div class="holo-step st1 ${unlockedForm > 0 ? "owned" : "locked"}" data-holo="st1"><canvas class="comp-cv" width="64" height="64" data-art="${E(DataEngine.getCompanionArt(key, 1))}"></canvas><span class="holo-lbl">${E(f.stages)}<small>Lv. ${CompanionData.EVO_LEVELS}</small></span></div>`,
      `<span class="holo-arrow" data-holo="ar1">➜</span>`,
      `<div class="holo-step st2 ${unlockedForm > 1 ? "owned" : "locked"}" data-holo="st2"><canvas class="comp-cv" width="64" height="64" data-art="${E(DataEngine.getCompanionArt(key, 2))}"></canvas><span class="holo-lbl">${E(f.stages)}<small>Lv. ${CompanionData.EVO_LEVELS}</small></span></div>`,
      `<span class="holo-arrow" data-holo="ar2">➜</span>`,
      `<div class="holo-step st3 ${unlockedForm > 2 ? "owned" : "locked"}" data-holo="st3"><canvas class="comp-cv" width="64" height="64" data-art="${E(DataEngine.getCompanionArt(key, 3))}"></canvas><span class="holo-lbl">${E(f.stages)}<small>Lv. ${CompanionData.EVO_LEVELS}</small></span></div>`,
      `<div id="evo-body" style="position:fixed;left:50%;bottom:10px;transform:translateX(-50%);width:max-content;max-width:74vw;z-index:26;pointer-events:auto;background:rgba(10,12,18,.92);border:1px solid rgba(56,232,255,.45);border-radius:4px;padding:4px 10px;box-shadow:0 4px 16px rgba(0,0,0,.8);display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;font:11px monospace;color:#f1f5f9">${hudHTML}</div>`
    ].join("");
    holo.classList.remove("hidden");
    holo.querySelectorAll("[data-holo]").forEach(el => {
      const pos = holoPositions.find(p => p.id === el.dataset.holo);
      if (pos) applyHoloItemPos(el, pos);
    });
    const eqBtn = holo.querySelector("#pet-hud-equip");
    if (eqBtn && typeof CaserneUI !== "undefined") eqBtn.onclick = e => { e.stopPropagation(); CaserneUI.equiperCompagnon(key); };
    const evoBtn = holo.querySelector("#pet-hud-evo");
    if (evoBtn && typeof CaserneUI !== "undefined") evoBtn.onclick = e => { e.stopPropagation(); CaserneUI.evoluerForme3(key); };
  };
if (compPanel && !holo) {
holo = document.createElement("div");
holo.className = "comp-holo-stage hidden";
compPanel.appendChild(holo);
stage.addEventListener("click", ev => {
if (compEditing) return;
const btn = ev.target.closest("[data-fam]");
if (!btn) { holo.classList.add("hidden"); holo.dataset.fam = ""; return; }
ev.stopPropagation();
const key = btn.dataset.fam;
if (holo.dataset.fam === key && !holo.classList.contains("hidden")) { holo.classList.add("hidden"); holo.dataset.fam = ""; return; }
showHolo(key);
});
holo.addEventListener("pointerdown", ev => {
if (!compEditing) return;
const el = ev.target.closest("[data-holo]"); if (!el) return;
ev.preventDefault(); ev.stopPropagation();
const pos = holoPositions.find(p => p.id === el.dataset.holo); if (!pos) return;
holoDrag = { el, pos, pointerId: ev.pointerId };
el.setPointerCapture(ev.pointerId);
});
holo.addEventListener("pointermove", ev => {
if (!holoDrag || ev.pointerId !== holoDrag.pointerId) return;
const rect = compPanel.getBoundingClientRect();
holoDrag.pos.x = Math.max(4, Math.min(96, (ev.clientX - rect.left) / rect.width * 100));
holoDrag.pos.y = Math.max(20, Math.min(96, (ev.clientY - rect.top) / rect.height * 100));
applyHoloItemPos(holoDrag.el, holoDrag.pos);
});
const endHolo = ev => { if (holoDrag && ev.pointerId === holoDrag.pointerId) { holoDrag = null; saveHoloPositions(); } };
holo.addEventListener("pointerup", endHolo);
holo.addEventListener("pointercancel", endHolo);
holo.addEventListener("contextmenu", ev => {
if (!compEditing) return;
const el = ev.target.closest("[data-holo]"); if (!el) return;
ev.preventDefault();
const pos = holoPositions.find(p => p.id === el.dataset.holo);
if (pos) { pos.flip = !pos.flip; applyHoloItemPos(el, pos); saveHoloPositions(); }
});
holo.addEventListener("wheel", ev => {
if (!compEditing) return;
const el = ev.target.closest("[data-holo]"); if (!el) return;
ev.preventDefault(); ev.stopPropagation();
const pos = holoPositions.find(p => p.id === el.dataset.holo); if (!pos) return;
if (ev.shiftKey) pos.angle = (pos.angle || 0) + (ev.deltaY < 0 ? 5 : -5);
else pos.size = Math.max(2, Math.min(45, (pos.size || 16) + (ev.deltaY < 0 ? 1.2 : -1.2)));
applyHoloItemPos(el, pos); saveHoloPositions();
}, { passive: false });
}
if (holo) {
holo.classList.toggle("is-editing", compEditing);
if (compEditing) showHolo(holo.dataset.fam || CompanionData.FAMILIES[0].key);
else if (holo.dataset.fam) showHolo(holo.dataset.fam);
else if (cf) showHolo(cf.key);
else holo.classList.add("hidden");
}
startCompIdleLoop();
}



