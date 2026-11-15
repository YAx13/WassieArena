"use strict";

/* ================= Écurie / Compagnons (placement + projecteur d'évolution) ================= */
const COMP_LAYOUT_PREFIX = "arene_companion_dev_layout_v2_";
const HOLO_LAYOUT_PREFIX = "arene_comp_holo_layout_v2_";
let compEditing = false, compPositions = null, compDrag = null;
let holoPositions = null, holoDrag = null, activeCompSprite = null;

const COMP_FROZEN = [
  { key: "chien", x: 16.65, y: 21.02, size: 10, angle: 0, flip: false },
  { key: "loup", x: 49.81, y: 39.25, size: 13.5, angle: 0, flip: false },
  { key: "ours", x: 17.67, y: 41.89, size: 15, angle: 0, flip: false },
  { key: "serpent", x: 39.2, y: 20.68, size: 13.5, angle: 0, flip: false },
  { key: "oiseau", x: 60.61, y: 40.19, size: 12.5, angle: 0, flip: false },
  { key: "arthropode", x: 61.69, y: 19.25, size: 15, angle: 0, flip: false },
  { key: "felin", x: 72.24, y: 21.02, size: 11, angle: 0, flip: false },
  { key: "taureau", x: 27.96, y: 20.13, size: 16, angle: 0, flip: false },
  { key: "aquatique", x: 28.4, y: 39.61, size: 13.5, angle: 0, flip: false },
  { key: "chimere", x: 38.95, y: 39.99, size: 11, angle: 0, flip: false },
  { key: "lezard", x: 49.68, y: 21.42, size: 12.5, angle: 0, flip: false },
  { key: "spectre", x: 71.66, y: 41.01, size: 13.5, angle: 0, flip: false },
  { key: "tempete", x: 83.23, y: 21.35, size: 11, angle: 0, flip: false }
];

const HOLO_FROZEN = [
  { id: "st1", x: 37.48, y: 71.69, size: 9.2, angle: 0, flip: false },
  { id: "ar1", x: 43.2, y: 75, size: 4.5, angle: 0, flip: false },
  { id: "st2", x: 49.74, y: 71.59, size: 12, angle: 0, flip: false },
  { id: "ar2", x: 56, y: 73, size: 4.5, angle: 0, flip: false },
  { id: "st3", x: 63.32, y: 68.47, size: 14.6, angle: 0, flip: false }
];

// Modèle de salle dédié au Dummy (à promouvoir dans COMP_FROZEN / HOLO_FROZEN après validation)
const COMP_DUMMY_TEMPLATE = [];
const HOLO_DUMMY_TEMPLATE = [];

// Légers ajustements par personnage par-dessus le modèle global (ex: momie: [{ key: "serpent", x: 40.5, y: 21.5 }])
const COMP_BRAWLER_OVERRIDES = {
  dummy: COMP_DUMMY_TEMPLATE
};
const HOLO_BRAWLER_OVERRIDES = {
  dummy: HOLO_DUMMY_TEMPLATE
};

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
  btn.style.position = "absolute";
  btn.style.left = pos.x + "%";
  btn.style.top = pos.y + "%";
  btn.style.height = pct + "%";
  btn.style.width = "auto";
  btn.style.aspectRatio = "1 / 1";
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
      } catch (e) {}
      compPositions = defaultCompPositions(activeCompSprite);
      holoPositions = defaultHoloPositions(activeCompSprite);
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

function startCompIdleLoop() {
  if (window._compIdleLoop) return;
  window._compIdleLoop = true;
  const cache = {};
  const tick = now => {
    const holoFrame = Math.floor(now / 180) % 4;
    document.querySelectorAll(".fx-panel.fx-comp .comp-cv").forEach((cv, idx) => {
      if (!cv.offsetParent) return;
      const src = cv.dataset.art; if (!src) return;
      let im = cache[src];
      if (!im) { im = cache[src] = new Image(); im.src = src; }
      if (!im.complete || !im.naturalWidth) return;
      const fw = im.naturalWidth / 4, fh = im.naturalHeight / 4, ctx = cv.getContext("2d");
      const inPod = !!cv.closest(".fx-comp-pet"), locked = !!cv.closest(".locked");
      ctx.clearRect(0, 0, 64, 64);
      ctx.imageSmoothingEnabled = false;
      ctx.globalCompositeOperation = "source-over";
      if (inPod) {
        const ph = idx * 1.37;
        const bob = Math.sin(now / 650 + ph) * 3.5;
        const tilt = Math.sin(now / 950 + ph) * 0.08;
        ctx.save();
        ctx.translate(32, 32 + bob);
        ctx.rotate(tilt);
        ctx.drawImage(im, 0, 0, fw, fh, -28, -28, 56, 56);
        ctx.restore();
        if (locked) {
          ctx.globalCompositeOperation = "source-atop";
          const grd = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
          grd.addColorStop(0, "rgba(8, 42, 54, 0.88)");
          grd.addColorStop(1, "rgba(14, 116, 144, 0.94)");
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, 64, 64);
          ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = "rgba(45, 212, 191, 0.14)";
          ctx.fillRect(0, 0, 64, 64);
          ctx.globalCompositeOperation = "source-over";
        }
        // Micro-bulles montantes dans le liquide
        ctx.fillStyle = locked ? "rgba(56, 232, 255, 0.35)" : "rgba(186, 245, 255, 0.55)";
        for (let b = 0; b < 3; b++) {
          const by = 58 - (((now / 28) + idx * 19 + b * 21) % 54);
          const bx = 18 + ((idx * 13 + b * 17) % 28) + Math.sin(now / 300 + b) * 2;
          ctx.fillRect(Math.round(bx), Math.round(by), b === 0 ? 2 : 1, b === 0 ? 2 : 1);
        }
      } else {
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
  }
  const caps = (GameState.ressources && GameState.ressources.capsules) || 0;
  const shards = b.dnaShards || 0;
  const ccEl = $("#fx-ccount");
  if (ccEl) ccEl.textContent = `${roster.length}/${CompanionData.FAMILIES.length}`;
  if (compPanel) {
    let incBar = compPanel.querySelector("#comp-incubate-bar");
    if (!incBar) {
      incBar = document.createElement("div");
      incBar.id = "comp-incubate-bar";
      Object.assign(incBar.style, { position: "absolute", left: "12px", bottom: "12px", zIndex: "30", display: "flex", alignItems: "center", gap: "6px" });
      compPanel.appendChild(incBar);
    }
    incBar.innerHTML = `<button type="button" id="btn-incubate-cap" class="fx-btn" ${caps < 1 ? "disabled" : ""} style="padding:5px 10px;font-size:11px;cursor:pointer">🥚 Incuber (${caps})</button>`
      + (shards > 0 ? `<span style="background:rgba(10,14,22,.85);border:1px solid #38bdf8;border-radius:4px;padding:4px 7px;font:bold 11px monospace;color:#7ffcf4" title="3 Éclats = 1 familier garanti">🧬 ${shards}/3</span>` : "");
    const incBtn = incBar.querySelector("#btn-incubate-cap");
    if (incBtn) incBtn.onclick = e => { e.stopPropagation(); if (typeof CaserneUI !== "undefined") CaserneUI.incuberCapsule(); };
  }
  updateCompDevUI();
  if (!compPositions) compPositions = readCompPositions(sp) || defaultCompPositions(sp);
  stage.classList.toggle("is-editing", compEditing);
  stage.innerHTML = CompanionData.FAMILIES.map(f => {
    const ownedObj = findOwned(f);
    const o = !!ownedObj, eq = f === cf, form = o ? (ownedObj.form || 1) : 1, art = DataEngine.getCompanionArt(f.key, form);
    return `<button class="fx-comp-pet ${o ? "owned" : "locked"} ${eq ? "equipped" : ""}" data-fam="${f.key}" title="${E(f.name)} — ${E(f.spec)}" aria-label="${o ? E(f.name) : "Famille inconnue"}"><canvas class="comp-cv" width="64" height="64" data-art="${E(art)}"></canvas></button>`;
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
holo.dataset.fam = key;
holo.innerHTML = [
  `<div class="holo-step st1 ${unlockedForm > 0 ? "owned" : "locked"}" data-holo="st1"><canvas class="comp-cv" width="64" height="64" data-art="${E(DataEngine.getCompanionArt(key, 1))}"></canvas><span class="holo-lbl">${E(f.stages[0])}<small>Niv. ${CompanionData.EVO_LEVELS[0]}</small></span></div>`,
  `<span class="holo-arrow" data-holo="ar1">➜</span>`,
  `<div class="holo-step st2 ${unlockedForm > 1 ? "owned" : "locked"}" data-holo="st2"><canvas class="comp-cv" width="64" height="64" data-art="${E(DataEngine.getCompanionArt(key, 2))}"></canvas><span class="holo-lbl">${E(f.stages[1])}<small>Niv. ${CompanionData.EVO_LEVELS[1]}</small></span></div>`,
  `<span class="holo-arrow" data-holo="ar2">➜</span>`,
  `<div class="holo-step st3 ${unlockedForm > 2 ? "owned" : "locked"}" data-holo="st3"><canvas class="comp-cv" width="64" height="64" data-art="${E(DataEngine.getCompanionArt(key, 3))}"></canvas><span class="holo-lbl">${E(f.stages[2])}<small>Niv. ${CompanionData.EVO_LEVELS[2]}</small></span></div>`,
  `<div id="evo-body" style="position:absolute;left:50%;bottom:10px;transform:translateX(-50%);width:min(360px,92%);z-index:10;pointer-events:auto;background:rgba(10,8,6,.88);border-radius:4px"></div>`
].join("");
holo.classList.remove("hidden");
holo.querySelectorAll("[data-holo]").forEach(el => {
const pos = holoPositions.find(p => p.id === el.dataset.holo);
if (pos) applyHoloItemPos(el, pos);
});
if (typeof CaserneUI !== "undefined") CaserneUI.attacherEvo(key);
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



