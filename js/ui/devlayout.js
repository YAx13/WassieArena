"use strict";
/* =====================================================================
   devlayout.js : éditeur de positions réutilisable (mode dev)
   Glisser = déplacer · Molette = taille · Maj+molette = rotation · Flèches = ajustement fin (Maj = x10)
   Sauvegarde dans localStorage (une clé par module) + bouton 📋 (copie JSON) + ↺ (reset).
   Visible seulement si : #devbox existe, GameState.illimite, ou ?dev dans l'URL.
   Usage : marquer les éléments avec data-dev-item="id", puis DevLayout.create({ key, stage, defaults })
   ===================================================================== */
const DevLayout = {
  instances: {},
  isDev(){ return !!document.getElementById("devbox") || (typeof GameState !== "undefined" && !!GameState.illimite) || /[?&]dev\b/.test(location.search); },
  _init(){
    if (this._ok) return; this._ok = true;
    const st = document.createElement("style");
    st.textContent = ".dl-editing [data-dev-item]{outline:1px dashed #f2b21c !important;background:rgba(242,178,28,.08) !important;cursor:grab !important;z-index:20;touch-action:none}"
      + ".dl-editing [data-dev-item]:active{cursor:grabbing !important}"
      + ".dl-editing [data-dev-item]>*{pointer-events:none}"
      + ".dl-bar{position:absolute;right:12px;bottom:12px;z-index:30;display:flex;gap:5px;align-items:center}"
      + ".dl-bar button{padding:5px 10px;font:11px/1.2 monospace;cursor:pointer;color:#ffd77a;background:rgba(26,16,8,.92);border:1px solid #c9953a}";
    document.head.appendChild(st);
    new MutationObserver(() => Object.values(this.instances).forEach(L => L.stage.isConnected && L.sync())).observe(document.body, { childList: true });
  },
  /* opt : { key, stage, defaults, apply?, label?, host? }
       key      : clé localStorage UNIQUE par module (ex: "arene_companion_layout_v1")
       stage    : élément (ou sélecteur) qui contient les éléments à déplacer
       defaults : tableau (ou fonction) de { id, x, y, size, angle } (en % du stage)
       apply    : (optionnel) fn(el, pos, stage) pour un rendu sur mesure */
  create(opt){
    this._init();
    const $ = s => typeof s === "string" ? document.querySelector(s) : s;
    const stage = $(opt.stage);
    if (!stage) { console.warn("DevLayout : stage introuvable pour", opt.key); return null; }
    const old = this.instances[opt.key];
    if (old && old.stage === stage) return old;
    const host = $(opt.host) || stage;
    if (getComputedStyle(stage).position === "static") stage.style.position = "relative";
    if (getComputedStyle(host).position === "static") host.style.position = "relative";

    let pos = null, editing = false, drag = null, sel = null;
    const defaults = () => (typeof opt.defaults === "function" ? opt.defaults() : (opt.defaults || [])).map(d => Object.assign({ size: 10, angle: 0 }, d));
    const get = () => {
      if (pos) return pos;
      const def = defaults();
      try {
        const saved = JSON.parse(localStorage.getItem(opt.key) || "null");
        if (Array.isArray(saved)) saved.forEach(s => {
          if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) return;
          let t = def.find(d => d.id === s.id);
          if (!t) { t = { size: 10, angle: 0, id: s.id }; def.push(t); }
          Object.assign(t, s);
        });
      } catch (_) {}
      return pos = def;
    };
    const clean = () => get().map(({ id, x, y, size, angle }) => ({ id, x: +x.toFixed(2), y: +y.toFixed(2), size: +size.toFixed(1), angle: +(angle || 0).toFixed(1) }));
    const save = () => {
      try { localStorage.setItem(opt.key, JSON.stringify(clean())); } catch (_) {}
      console.log(opt.key + " =", JSON.stringify(clean()));
    };
    const applyOne = (el, p) => {
      if (opt.apply) return opt.apply(el, p, stage);
      el.style.position = "absolute";
      el.style.left = p.x + "%"; el.style.top = p.y + "%";
      el.style.transform = `translate(-50%,-50%) rotate(${p.angle || 0}deg)`;
      el.style.width = p.size + "%"; el.style.height = "auto";
    };
    const applyAll = () => {
      const list = get();
      stage.querySelectorAll("[data-dev-item]").forEach(el => { const p = list.find(q => q.id === el.dataset.devItem); if (p) applyOne(el, p); });
    };
    const refresh = p => { const el = [...stage.querySelectorAll("[data-dev-item]")].find(e => e.dataset.devItem === p.id); if (el) applyOne(el, p); };

    // Barre de boutons (coin bas-droit)
    const bar = document.createElement("div");
    bar.className = "dl-bar";
    bar.innerHTML = '<button type="button" data-a="copy" title="Copier le JSON">📋</button><button type="button" data-a="reset" title="Réinitialiser">↺</button><button type="button" data-a="edit"></button>';
    host.appendChild(bar);
    const btn = bar.querySelector('[data-a="edit"]');
    const setEdit = on => {
      editing = on; stage.classList.toggle("dl-editing", on);
      btn.textContent = on ? "Terminer le placement" : (opt.label || "ÉDITER LE PLACEMENT");
    };
    const sync = () => { const on = DevLayout.isDev(); bar.style.display = on ? "flex" : "none"; if (!on && editing) setEdit(false); };
    setEdit(false); sync();
    const say = m => { if (typeof toast === "function") toast(m); };
    bar.addEventListener("click", e => {
      const a = e.target.closest("button")?.dataset.a; if (!a) return;
      e.stopPropagation();
      if (a === "edit") { setEdit(!editing); if (!editing) say("Placement enregistré !"); }
      else if (a === "copy") { if (navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(clean())); say("Coordonnées copiées !"); }
      else if (a === "reset") { try { localStorage.removeItem(opt.key); } catch (_) {} pos = null; applyAll(); say("Positions par défaut restaurées."); }
    });

    // Glisser
    stage.addEventListener("pointerdown", ev => {
      if (!editing) return;
      const el = ev.target.closest("[data-dev-item]"); if (!el || !stage.contains(el)) return;
      ev.preventDefault(); ev.stopPropagation();
      const id = el.dataset.devItem; let p = get().find(q => q.id === id);
      if (!p) {   // élément sans position connue : on part de sa place actuelle
        const r = stage.getBoundingClientRect(), e = el.getBoundingClientRect();
        p = { id, x: (e.left + e.width / 2 - r.left) / r.width * 100, y: (e.top + e.height / 2 - r.top) / r.height * 100, size: e.width / r.width * 100, angle: 0 };
        get().push(p); applyOne(el, p);
      }
      sel = p; drag = { el, p, pid: ev.pointerId };
      el.setPointerCapture(ev.pointerId);
    });
    stage.addEventListener("pointermove", ev => {
      if (!drag || ev.pointerId !== drag.pid) return;
      const r = stage.getBoundingClientRect();
      drag.p.x = Math.max(0, Math.min(100, (ev.clientX - r.left) / r.width * 100));
      drag.p.y = Math.max(0, Math.min(100, (ev.clientY - r.top) / r.height * 100));
      applyOne(drag.el, drag.p);
    });
    const end = ev => { if (!drag || ev.pointerId !== drag.pid) return; drag = null; save(); };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    // Un glisser ne doit jamais déclencher le clic de l'élément
    stage.addEventListener("click", ev => {
      if (!editing || !ev.target.closest("[data-dev-item]")) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
    }, true);
    // Molette = taille, Maj+molette = rotation
    stage.addEventListener("wheel", ev => {
      if (!editing) return;
      const el = ev.target.closest("[data-dev-item]"); if (!el) return;
      const p = get().find(q => q.id === el.dataset.devItem); if (!p) return;
      ev.preventDefault(); ev.stopPropagation();
      const d = ev.deltaY || ev.deltaX;
      if (ev.shiftKey) p.angle = (p.angle || 0) + (d < 0 ? 5 : -5);
      else p.size = Math.max(1, Math.min(100, p.size + (d < 0 ? 0.6 : -0.6)));
      sel = p; applyOne(el, p); save();
    }, { passive: false });
    // Flèches = ajustement fin de l'élément sélectionné (Maj = x10)
    document.addEventListener("keydown", ev => {
      if (!editing || !sel || !stage.isConnected || !ev.key.startsWith("Arrow")) return;
      const s = ev.shiftKey ? 1 : 0.1;
      if (ev.key === "ArrowLeft") sel.x -= s; else if (ev.key === "ArrowRight") sel.x += s;
      else if (ev.key === "ArrowUp") sel.y -= s; else sel.y += s;
      ev.preventDefault(); refresh(sel); save();
    });
    // Ré-applique automatiquement si le module re-génère son contenu (innerHTML)
    new MutationObserver(applyAll).observe(stage, { childList: true, subtree: true });

    applyAll();
    return this.instances[opt.key] = { stage, apply: applyAll, sync, get, save };
  }
};