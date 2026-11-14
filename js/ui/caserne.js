"use strict";
/* =====================================================================
   caserne.js : intérieur de la pop-up « Caserne » + pop-up « Évolutions » + Forge cybernétique
   À charger AVANT le script principal, APRÈS state.js :
     <script src="state.js"></script> <script src="caserne.js"></script> … <script> (principal) </script>
   state.js appelle CaserneUI.init() au démarrage (GameState.boot).
   Utilise GameState (Or, Parchemins, Nourriture, Pierres, compétences équipées, presets, compteurs).
   Dépend à l'exécution de : S, persist, toast, uiDialog, FX, DataEngine, CompanionData, ForgeSystem,
   divineAwakening, openEvo, renderFiche, depenserRessource.
   ===================================================================== */
const CaserneUI = {
  NIV_SLOTS: [1, 5, 10],        // niveau requis pour les slots 1, 2, 3
  STAT_CAP: 250,                // plafond des stats de base
  MAX_ACHATS_STATS: 100,        // nombre maximum d'entraînements mutagènes
  ARME_SELECTOR: "[data-arme],[data-weapon],[data-weapon-id]",  // éléments de l'UI représentant une arme possédée (id lu dans data-arme / data-weapon / data-weapon-id)
  _ok: false,
    _lastChestHTML: "",
  Q(s){ return document.querySelector(s); },
  esc(s){ return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); },

  /* ---------- 1. ENTRAÎNEMENT MUTAGÈNE ---------- */
  coutEntrainement(){ return Math.floor(40 * Math.pow(1.08, GameState.achatsStats)); },
  entrainementMax(){ return GameState.achatsStats >= this.MAX_ACHATS_STATS; },
  entrainer(){
    const b = S.cur; if (!b) return;
    if (this.entrainementMax()) { toast("Entraînement maximum atteint (" + this.MAX_ACHATS_STATS + " achats)."); return; }
    const ouvertes = ["hp", "str", "agi", "spd"].filter(k => b.stats[k] < this.STAT_CAP);
    if (!ouvertes.length) { toast("Toutes les stats sont au maximum (" + this.STAT_CAP + ")."); return; }
    const cout = this.coutEntrainement();
    if (!depenserRessource("or", cout)) { toast("Or insuffisant (" + cout + " requis)."); return; }
    const k = DataEngine.pick(ouvertes), nom = { hp: "Vie", str: "Force", agi: "Agilité", spd: "Rapidité" }[k];
    b.stats[k]++; GameState.achatsStats++;
    this.lancerAnimTrain(k);
    persist(); toast("Entraînement : +1 " + nom + " !");
  },
  initTrainRoom(t, b){
    const sp = b.sprite || "empereur", bgUrl = assetPath.trainBanner(sp);
    if (!t.dataset.ready) {
      t.dataset.ready = "1";
      t.onclick = null;
      t.innerHTML = `<canvas id="cv-train" width="526" height="53"></canvas><button type="button" class="train-sign" style="left:1.5%" title="Acheter +1 stat aléatoire"></button>`;
      t.querySelector(".train-sign").onclick = e => { e.stopPropagation(); this.entrainer(); };
      this._trainQ = []; this._trainRun = null; this._trainHit = null;
      const loop = now => {
        const cv = this.Q("#cv-train");
        if (cv && cv.offsetParent && S.cur) this.drawTrainRoom(cv.getContext("2d"), S.cur, now);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    if (t.dataset.bg !== bgUrl) {
      t.dataset.bg = bgUrl;
      const img = new Image();
      img.onload = () => { this._trainBg = img; };
      img.onerror = () => {
        const fb = new Image();
        fb.onload = () => { this._trainBg = fb; };
        fb.src = assetPath.trainBanner("empereur");
      };
      img.src = bgUrl;
    }
  },
  lancerAnimTrain(stat){
    if (!this._trainQ) this._trainQ = [];
    this._trainQ.push(stat);
  },
  drawTrainRoom(ctx, b, now){
    const W = 526, H = 53;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    if (this._trainBg && this._trainBg.complete && this._trainBg.naturalWidth) {
      ctx.drawImage(this._trainBg, 0, 0, W, H);
    }
    // Positions X exactes des 4 mannequins (espacés régulièrement tous les ~80px)
    const DUMMY_X = { str: 184, hp: 263, agi: 390, spd: 473 }, HOME_X = 62, REACH = 26;
    let r = this._trainRun;
    if (!r && this._trainQ && this._trainQ.length) {
      const st = this._trainQ.shift();
      r = this._trainRun = { st, phase: "to", x: HOME_X, tx: DUMMY_X[st] || 260, t0: now };
    }
    let px = HOME_X, flip = false, anim = "idle";
    if (r) {
      const dt = Math.min(50, now - (r.last || now)); r.last = now;
      if (r.phase === "to") {
        anim = "run"; flip = false; r.x += dt * 0.24;
        if (r.x >= r.tx - REACH) { r.x = r.tx - REACH; r.phase = "hit"; r.t0 = now; this._trainHit = { st: r.st, x: r.tx, t0: now }; }
      } else if (r.phase === "hit") {
        anim = "atk"; flip = false;
        if (now - r.t0 > 280) {
          if (this._trainQ.length) {
            const st = this._trainQ.shift();
            r.st = st; r.tx = DUMMY_X[st] || 260; r.phase = r.x <= r.tx - REACH ? "to" : "back";
          } else { r.phase = "back"; }
        }
      } else if (r.phase === "back") {
        anim = "run"; flip = true; r.x -= dt * 0.24;
        if (r.x <= HOME_X) { this._trainRun = null; r = null; }
      }
      if (r) px = r.x;
    }
    // Dessin du brawler actif
    if (typeof renderer !== "undefined" && renderer.drawBrute) {
      const off = this._trainOff || (this._trainOff = Object.assign(document.createElement("canvas"), { width: 64, height: 64 }));
      renderer.drawBrute(off.getContext("2d"), b, now, anim);
      ctx.save();
      ctx.translate(Math.round(px), 8);
      if (flip) { ctx.translate(42, 0); ctx.scale(-1, 1); }
      ctx.drawImage(off, 0, 0, 64, 64, 0, 0, 42, 42);
      ctx.restore();
    }
    // Effet d'impact + "+1" au-dessus du mannequin frappé
    if (this._trainHit && now - this._trainHit.t0 < 650) {
      const p = (now - this._trainHit.t0) / 650;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5;
      ctx.strokeText("+1", this._trainHit.x, 18 - p * 12);
      ctx.fillStyle = "#ffe23d";
      ctx.fillText("+1", this._trainHit.x, 18 - p * 12);
      ctx.restore();
    }
  },

  /* ---------- 3. COMPÉTENCES : slots, presets, parchemins ---------- */
  slotsOuverts(){ return S.cur.slotsCompetences; },                       // 1 / 2 / 3 selon le niveau (state.js)
  equipees(){                                                             // liste équipée normalisée (possédées, uniques, ≤ slots, ≥ 1)
    const b = S.cur, GS = GameState;
    let eq = (GS.competencesEquipees || []).filter((id, i, a) => b.skills.includes(id) && a.indexOf(id) === i).slice(0, this.slotsOuverts());
    if (!eq.length && b.skills.length) eq = [b.skills[0]];
    GS.competencesEquipees = eq; return eq;
  },
  async choisirSlot(i){
    const b = S.cur, D = DataEngine, eq = this.equipees(), cur = eq[i];
    const btns = b.skills.filter(id => !eq.includes(id)).map(id => [D.EL_ICON[D.SKILLS[id].el] + " " + D.SKILLS[id].name, id]);
    if (cur !== undefined && eq.length > 1) btns.push(["Retirer", "__retirer"]);
    btns.push(["Annuler", null]);
    const r = await uiDialog("Slot " + (i + 1), cur !== undefined ? "Remplacer « " + D.SKILLS[cur].name + " » par :" : "Équiper une compétence :", btns, null);
    if (r === null || r === undefined) return;
    if (r === "__retirer") eq.splice(i, 1); else if (cur !== undefined) eq[i] = r; else eq.push(r);
    GameState.competencesEquipees = eq; GameState.save(); persist();
  },
  preset(n, action){
    const GS = GameState; this.equipees();
    if (action === "save") { GS.sauverPreset(n); toast("Preset " + n + " sauvegardé."); }
    else if (GS.chargerPreset(n)) { this.equipees(); toast("Preset " + n + " chargé."); }
    persist();
  },
  coutParchemin(){ return 1 + Math.floor(GameState.tentativesParchemins * 1.5); },  // 1, 2, 4, 5, 7, 8…
  async debloquerCompetence(){
    const b = S.cur, D = DataEngine, pool = D.SKILLS.filter(s => !b.skills.includes(s.id));
    if (!pool.length) { toast("Toutes les compétences sont déjà débloquées."); return; }
    const cout = this.coutParchemin();
    if (!depenserRessource("parchemins", cout)) { toast("Parchemins insuffisants (" + cout + " requis)."); return; }
    GameState.tentativesParchemins++;
    persist();

    const choix = pool.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(3, pool.length));
    let k = choix[0];
    if (choix.length > 1) {
      const ov = document.createElement("div");
      ov.className = "rd-draft";
      document.body.appendChild(ov);
      const id = await Raids.carte("📜 PARCHEMIN : choisissez 1 compétence", choix.map(s => s.id), ov, false);
      ov.remove();
      if (id !== null) k = D.SKILLS[id] || k;
    }

    b.skills.push(k.id);
    const eq = this.equipees(), auto = eq.length < this.slotsOuverts();
    if (auto) { eq.push(k.id); GameState.competencesEquipees = eq; }
    persist();
    toast("Nouvelle compétence : " + D.EL_ICON[k.el] + " " + k.name + (auto ? " (équipée)" : "") + " !");
  },
  /* ---------- 2b. CAISSES EN 1 CLIC & AUTO-FORGE ---------- */
  actionCaisse(){
    const GS = GameState;
    if ((GS.ressources.caisses || 0) <= 0) {
      if (!depenserRessource("or", GS.PRIX_CAISSE)) { toast("Or insuffisant (" + GS.PRIX_CAISSE + " Or requis)."); return; }
      donnerRecompense("caisses", 1);
    }
    GS.ouvrirCaisse();
    const resEl = this.Q("#chest-result");
    if (resEl && resEl.innerHTML) this._lastChestHTML = resEl.innerHTML;
    persist();
  },
  async fusionnerGroupe(key){
    const r = ForgeSystem.fuse(S.cur, key);
    if (!r.ok) { toast(r.msg); return; }
    toast("Fusion réussie : " + DataEngine.RARITIES[r.rarity].name + " !");
    if (r.rarity === 5 && typeof divineAwakening === "function") await divineAwakening(S.cur);
    persist();
  },
  async toutFusionner(){
    let count = 0, divin = false;
    for (;;) {
      const gs = ForgeSystem.groups(S.cur).filter(g => g.n >= 3 && g.rarity < 5);
      if (!gs.length) break;
      const r = ForgeSystem.fuse(S.cur, gs[0].k);
      if (!r.ok) break;
      count++;
      if (r.rarity === 5) divin = true;
    }
    if (!count) { toast("Aucune série de 3 équipements identiques à fusionner."); return; }
    toast("Auto-Forge : " + count + " fusion" + (count > 1 ? "s" : "") + " effectuée" + (count > 1 ? "s" : "") + " !");
    if (divin && typeof divineAwakening === "function") await divineAwakening(S.cur);
    persist();
  },

  /* ---------- Rendu des ajouts dans la Caserne (appelé après chaque renderFiche) ---------- */
  render(){
    const b = S.cur; if (!b || !this.Q("#cs-train")) return;
    const D = DataEngine, GS = GameState, eq = this.equipees(), R = GS.ressources, E = this.esc;
    // Entraînement (salle interactive)
    const cout = this.coutEntrainement(), t = this.Q("#cs-train"), maxA = this.entrainementMax();
    this.initTrainRoom(t, b);
    const sign = t.querySelector(".train-sign");
    if (sign) {
      sign.innerHTML = maxA
        ? `<span class="train-max">MAX (${GS.achatsStats}/${this.MAX_ACHATS_STATS})</span>`
        : `<span class="train-price">💰 ${cout.toLocaleString("fr-FR")}</span><span class="train-cnt">${GS.achatsStats}/${this.MAX_ACHATS_STATS}</span>`;
      sign.classList.toggle("disabled", maxA || R.or < cout);
    }
    const statsGold = this.Q("#cs-stats-gold");
    if (statsGold) statsGold.textContent = "🪙 " + R.or.toLocaleString("fr-FR") + " Or";
    // Puissance (haut de l'onglet Stats)
    const pw = this.Q("#cs-power");
    if (pw) pw.textContent = `⚔️ Puissance : ${(typeof calculerPuissance === "function" ? calculerPuissance() : 0).toLocaleString("fr-FR")}`;
    // Rang de maîtrise (+1, +2…) sur les armes possédées
    const maitrise = GS.maitriseArmes || {};
    document.querySelectorAll(this.ARME_SELECTOR).forEach(el => {
      const id = el.dataset.arme ?? el.dataset.weapon ?? el.dataset.weaponId, rang = maitrise[id] | 0;
      const old = el.querySelector(":scope > .cs-rank"); if (old) old.remove();
      if (rang > 0) {
        if (getComputedStyle(el).position === "static") el.style.position = "relative";
        const bd = document.createElement("span"); bd.className = "cs-rank"; bd.textContent = "+" + rang; el.appendChild(bd);
      }
      
    });
    // Slots (1 / 5 / 10) — icône seule sans contour
    this.Q("#cs-slots").innerHTML = this.NIV_SLOTS.map((lv, i) => {
      if (b.level < lv) return `<div class="cs-slot lock" data-sk-item="slot_${i}" title="Se débloque au niveau ${lv}"><span>🔒</span></div>`;
      const id = eq[i];
      if (id === undefined) return `<button class="cs-slot" data-sk-item="slot_${i}" data-slot="${i}" title="Slot ${i + 1} vide — cliquer pour équiper"><span>＋</span></button>`;
      const s = D.SKILLS[id];
      return `<button class="cs-slot on" data-sk-item="slot_${i}" data-slot="${i}" title="${E(s.name)} — ${E(s.desc)}" style="--c:${D.EL_COL[s.el]}"><span>${D.EL_ICON[s.el]}</span></button>`;
    }).join("");
    this.Q("#cs-slots").querySelectorAll("[data-slot]").forEach(x => x.onclick = e => {
      if (this._skillsEditing) return;
      e.stopPropagation(); this.choisirSlot(+x.dataset.slot);
    });
    const synBox = this.Q("#cs-synergies");
    if (synBox) {
      synBox.dataset.skItem = "syn";
      const syns = DataEngine.getSynergies(eq), maxSlots = this.slotsOuverts();
      if (syns.length) {
        const s = syns[0];
        synBox.classList.add("active");
        synBox.style.setProperty("--syn-c", s.col);
        synBox.innerHTML = `<b style="color:${s.col}">${s.icon} ${s.name.toUpperCase()} (${s.count}/${maxSlots})</b><span>${E(s.desc)}</span>`;
      } else {
        synBox.classList.remove("active");
        synBox.style.removeProperty("--syn-c");
        synBox.innerHTML = `<span style="opacity:.75">SYNERGIE INACTIVE<br><small>2+ même élément</small></span>`;
      }
    }
    // Presets
    this.Q("#cs-presets").innerHTML = [1, 2, 3].map(n => `<span class="cs-pre" data-sk-item="pre_${n}"><button class="fx-mini" data-pl="${n}" ${GS.presets[n] ? "" : "disabled"}>P${n}</button><button class="fx-mini" data-ps="${n}" title="Sauvegarder le build dans P${n}">💾</button></span>`).join("");
    this.Q("#cs-presets").querySelectorAll("[data-pl]").forEach(x => x.onclick = e => {
      if (this._skillsEditing) return;
      e.stopPropagation(); this.preset(+x.dataset.pl, "load");
    });
    this.Q("#cs-presets").querySelectorAll("[data-ps]").forEach(x => x.onclick = e => {
      if (this._skillsEditing) return;
      e.stopPropagation(); this.preset(+x.dataset.ps, "save");
    });
    // Parchemins
    const u = this.Q("#cs-unlock");
    u.dataset.skItem = "unlock";
    this.majUnlock();
    this.Q("#fx-sgrid").querySelectorAll(".fx-s").forEach((el, idx) => { el.dataset.skItem = "sk_" + idx; });
    this.applySkillsLayout();
    if (this._syncSkillsDev) this._syncSkillsDev();    this.renderEquipementTab();
  },
    majUnlock(){
    const u = this.Q("#cs-unlock"), b = S.cur; if (!u || !b) return;
    const c = this.coutParchemin(), tout = b.skills.length >= DataEngine.SKILLS.length, R = GameState.ressources;
    u.textContent = tout ? "✔ 32/32 DÉBLOQUÉES" : `📜 TIRAGE (${c} 📜 · stock: ${R.parchemins})`;
    u.disabled = !this._skillsEditing && (tout || R.parchemins < c);   // un bouton disabled ne peut pas être glissé
  },
    renderEquipementTab(){
    const root = this.Q("#cs-equip-root"), b = S.cur; if (!root || !b) return;
    const D = DataEngine, R = GameState.ressources, RAR = D.RARITIES, PARTS = D.PARTS;
    const gs = ForgeSystem.groups(b).sort((a, c) => c.rarity - a.rarity);
    const fusables = gs.filter(g => g.n >= 3 && g.rarity < 5).length;

    const cnt = this.Q("#cs-eqcount");
    if (cnt) cnt.textContent = (b.gear ? b.gear.length : 0) + " pièce(s)";

    const hasStock = (R.caisses || 0) > 0;
    const btnTxt = hasStock ? `📦 Ouvrir Caisse en stock (${R.caisses})` : `📦 Acheter & Ouvrir Caisse — ${GameState.PRIX_CAISSE} Or`;
    const btnDis = !hasStock && R.or < GameState.PRIX_CAISSE ? "disabled" : "";

    const equippedHTML = PARTS.map(p => {
      const owned = (b.gear || []).filter(g => g.part === p.id).sort((a, c) => c.rarity - a.rarity);
      const best = owned[0];
      if (!best) return `<div class="cs-eq-slot"><span>${p.icon}</span><small>${p.name}<br>Vide</small></div>`;
      const rInfo = RAR[best.rarity];
      return `<div class="cs-eq-slot" style="border-color:${rInfo.color}"><span>${p.icon}</span><small style="color:${rInfo.color}">${p.name}<br><b>${rInfo.name}</b></small></div>`;
    }).join("");

    const invHTML = gs.length ? gs.map(g => {
      const p = PARTS.find(q => q.id === g.part), rInfo = RAR[g.rarity];
      const canFuse = g.n >= 3 && g.rarity < 5;
      return `<button class="cs-inv-item ${canFuse ? "fusable" : ""}" data-fk="${g.k}" style="border-color:${rInfo.color}">
        <span class="cs-inv-ico">${p.icon}</span>
        <span class="cs-inv-name" style="color:${rInfo.color}">${p.name}</span>
        <small>${rInfo.name} · <b>×${g.n}</b>${canFuse ? " 🔨" : ""}</small>
      </button>`;
    }).join("") : `<p class="cs-note">Votre inventaire est vide. Ouvrez une Caisse Wass-E ci-dessus !</p>`;

    root.innerHTML = `
      <div style="margin-bottom:10px">
        <div class="cs-gold" id="cs-equip-gold" aria-live="polite">🪙 ${R.or.toLocaleString("fr-FR")} Or</div>
        <button id="cs-oneclick-chest" class="fx-btn cs-btn" ${btnDis}>${btnTxt}</button>
        ${this._lastChestHTML ? `<div class="cs-power" style="margin-top:6px">Dernier tirage : ${this._lastChestHTML}</div>` : ""}
      </div>
      <div class="fx-h" style="font-size:1.5em"><span>Équipement actif (auto-équipé)</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px">${equippedHTML}</div>
      <div class="fx-h" style="font-size:1.5em">
        <span>Inventaire & Forge (${gs.length} types)</span>
        <button id="cs-autofuse" class="fx-mini" ${fusables ? "" : "disabled"}>🔨 Tout fusionner (${fusables})</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px">${invHTML}</div>
    `;

    const cb = this.Q("#cs-oneclick-chest");
    if (cb) cb.onclick = e => { e.stopPropagation(); this.actionCaisse(); };
    const af = this.Q("#cs-autofuse");
    if (af) af.onclick = e => { e.stopPropagation(); this.toutFusionner(); };
    root.querySelectorAll("[data-fk]").forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); this.fusionnerGroupe(btn.dataset.fk); };
    });
  },
/* ---------- 4. COMPAGNON : Nourriture + évolution Forme 3 (pop-up Évolutions) ---------- */
  nourrir(key){
    const c = S.cur && S.cur.companion;
    if (!c) { toast("Aucun compagnon actif."); return; }
    if (c.level >= CompanionData.LEVEL_CAP) { toast(c.name + " est déjà au niveau maximum (" + CompanionData.LEVEL_CAP + ") !"); return; }
    if (!depenserRessource("nourriture", 1)) { toast("Pas de Nourriture."); return; }
    const res = CompanionData.gainXp(c, 50);
    persist();
    toast(res.evolved ? `✨ ${c.name} évolue en Forme ${res.form} !` : res.levels > 0 ? `🐾 ${c.name} passe niveau ${c.level} !` : `🍖 +50 XP (${c.xp}/${c.xpMax})`);
    openEvo(key);
  },
  peutForme3(c){ return c && c.form === 2 && c.level >= CompanionData.EVO_LEVELS[2] && GameState.ressources.pierres >= 1; },
  evoluerForme3(key){
    const c = S.cur && S.cur.companion;
    if (!c) { toast("Aucun compagnon actif."); return; }
    if (c.level < CompanionData.LEVEL_CAP) { toast("Niveau " + CompanionData.LEVEL_CAP + " requis pour la Transmutation."); return; }
    if (c.form === 3) { toast(c.name + " a déjà atteint sa forme Légendaire !"); return; }
    if (!depenserRessource("pierres", 1)) { toast("Pierre de Transmutation requise (💎)."); return; }
    CompanionData.transmute(c);
    persist();
    toast(`💎 Transmutation réussie : ${c.name} (Forme Légendaire) !`);
    openEvo(key);
  },
  attacherEvo(key){                                                           // ajoute le panneau sous la frise existante
    const f = CompanionData.FAMILIES.find(x => x.key === key), c = S.cur && S.cur.companion, body = this.Q("#evo-body");
    if (!f || !c || CompanionData.family(c) !== f || !body) return;
    const R = GameState.ressources, max = CompanionData.LEVEL_CAP, nivReq = CompanionData.EVO_LEVELS[2], form = c.form || 1;
    const box = document.createElement("div"); box.className = "cs-evo";
    let h = `<div class="cs-evo-h"><b>${this.esc(c.name)}</b> · Forme ${form} · niv. ${c.level}/${max}${c.level < max ? " · XP " + c.xp + "/" + c.xpMax : ""}</div>`;
    h += `<button class="btn" id="cs-feed" ${c.level >= max || R.nourriture < 1 ? "disabled" : ""}>🍖 Nourrir : +1 niveau (1 Nourriture · vous : ${R.nourriture})</button>`;
    if (form >= 3) h += `<p class="cs-note">✔ Forme finale atteinte.</p>`;
    else {
      const ok = this.peutForme3(c);
      h += `<button class="btn gold" id="cs-f3" ${ok ? "" : "disabled"}>🔮 Évolution finale : Forme 3 (1 Pierre de Transmutation · vous : ${R.pierres})</button>`;
      if (!ok) h += `<p class="cs-note">Conditions : niveau ${nivReq} (actuel ${c.level}) et 1 Pierre de Transmutation (vous : ${R.pierres}).</p>`;
    }
    box.innerHTML = h; body.appendChild(box);
    const fd = box.querySelector("#cs-feed"), f3 = box.querySelector("#cs-f3");
    if (fd) fd.onclick = e => { e.stopPropagation(); this.nourrir(key); };
    if (f3) f3.onclick = e => { e.stopPropagation(); this.evoluerForme3(key); };
  },
  /* ---------- 2. FORGE CYBERNÉTIQUE : fusion gratuite 3 identiques → rang supérieur ---------- */
  async fusionner(){
    const r = ForgeSystem.fuse(S.cur, S.forgeKey);
    if (!r.ok) { toast(r.msg); return; }
    S.forgeKey = null; toast("Fusion réussie : " + DataEngine.RARITIES[r.rarity].name + " !");
    if (r.rarity === 5) await divineAwakening(S.cur);
    persist();
  },

  /* ---------- Démarrage ---------- */
  init(){
    if (this._ok) return; this._ok = true;
    const rf = window.renderFiche, oe = window.openEvo;                     // on greffe l'UI sans réécrire les fonctions d'origine
    window.renderFiche = b => { rf(b); CaserneUI.render(); };
    window.openEvo = key => { oe(key); CaserneUI.attacherEvo(key); };
    const shopBub = this.Q(".bub.b-shop");
    if (shopBub) shopBub.style.display = "none";
    setTab(0);
    if (typeof Caserne !== "undefined") Caserne.snap = idx => setTab(idx);
    this.Q("#fx-pager")?.addEventListener("click", e => {
      const btn = e.target.closest("button[data-p]");
      if (!btn) return;
      e.stopImmediatePropagation();
      setTab(+btn.dataset.p);
    }, true);

    const st = document.createElement("style");
    st.textContent = ".cs-btn{display:block;width:100%;margin-top:8px}.cs-slots{display:flex;gap:6px;margin:6px 0}.cs-slot{flex:1;min-height:46px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"
      + "background:rgba(26,16,8,.88);border:1px solid #c9953a;color:#fff4d6;font:11px monospace;padding:4px;cursor:pointer}.cs-slot.on{border-color:var(--c,#c9953a);box-shadow:0 0 6px var(--c,#c9953a)}"
      + ".cs-slot.lock{opacity:.55;cursor:default;border-style:dashed}.cs-slot span{font-size:18px}.cs-slot small{font-size:10px;text-align:center}.cs-pres{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}"
      + ".cs-pre{display:inline-flex;gap:2px}.cs-evo{margin-top:12px;padding:10px;border:1px solid #c9953a;display:flex;flex-direction:column;gap:8px;align-items:stretch}.cs-evo-h{text-align:center}.cs-note{margin:0;font-size:12px;opacity:.8;text-align:center}"
      + ".cs-power{margin:6px 0;padding:6px;text-align:center;font:bold 14px monospace;color:#ffd77a;background:rgba(26,16,8,.88);border:1px solid #c9953a}"
      + ".cs-rank{position:absolute;top:2px;right:2px;padding:0 4px;font:bold 11px monospace;color:#1a1008;background:#ffd77a;border-radius:3px;pointer-events:none}"
      + ".cs-eq-slot{display:flex;flex-direction:column;align-items:center;padding:8px 4px;background:rgba(0,0,0,.6);border:1px solid #3a3f46;border-radius:4px;text-align:center}"
      + ".cs-inv-item{display:flex;flex-direction:column;align-items:center;padding:8px 6px;background:rgba(15,17,20,.9);border:1px solid #555;border-radius:4px;cursor:pointer;text-align:center}"
      + ".cs-inv-item.fusable{box-shadow:0 0 8px rgba(57,255,20,.45)}.cs-inv-ico{font-size:2em}.cs-inv-name{font-weight:bold;margin:2px 0}"
      + ".cs-gold{align-self:flex-end;width:max-content;padding:3px 8px;color:#ffd77a;background:rgba(26,16,8,.88);border:1px solid #c9953a;font:11px monospace;white-space:nowrap}"
      + "#cs-skills{position:relative;width:100%;aspect-ratio:1408/752;background-size:100% 100%;background-repeat:no-repeat;margin:0 auto;overflow:hidden;user-select:none}"
      + "#cs-skills .cs-syn-screen{position:absolute;padding:3px 6px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;font:clamp(8px,.8vw,10px)/1.15 monospace;color:#8ef6ff;text-shadow:0 0 6px rgba(79,240,230,.8);overflow:hidden}"
      + "#cs-skills .cs-syn-screen.active{color:#fff;box-shadow:inset 0 0 12px var(--syn-c,#4ff0e6)}"
      + "#cs-skills .cs-slots,#cs-skills .cs-ctrl-right,#cs-skills .cs-pres,#cs-skills #fx-sgrid{position:static;display:contents}"
      + "#cs-skills .cs-slot{position:absolute;min-height:0;background:transparent !important;border:none !important;box-shadow:none !important;padding:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;transition:filter .14s}"
      + "#cs-skills .cs-slot:hover:not(.lock){filter:drop-shadow(0 0 6px #7ffcf4)}"
      + "#cs-skills .cs-slot span{font-size:inherit;line-height:1;filter:drop-shadow(0 2px 4px #000)}"
      + "#cs-skills .cs-slot small{display:none}"
      + "#cs-skills .cs-pre{position:absolute;display:flex;gap:2px;margin:0;box-sizing:border-box}"
      + "#cs-skills .cs-pre button:first-child{flex:1;padding:2px 3px;font-size:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
      + "#cs-skills .cs-pre button:last-child{padding:2px 4px;font-size:inherit}"
      + ".fx-panel.fx-skills{flex:1;min-height:0;overflow:hidden}"
      + "#cs-skills #cs-unlock{position:absolute;min-height:0 !important;height:auto !important;margin:0;padding:4px 6px !important;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(10,22,28,.92);border:1px solid #4ff0e6;color:#7ffcf4;box-shadow:0 0 8px rgba(79,240,230,.35)}"
      + "#cs-skills #cs-unlock:disabled{opacity:.45;box-shadow:none}"
      + "#cs-skills #fx-sgrid>*{position:absolute;min-height:0;margin:0;padding:0;background:transparent !important;border:none !important;box-shadow:none !important;display:flex;align-items:center;justify-content:center;box-sizing:border-box}"
      + "#cs-skills #fx-sgrid>*:hover{filter:drop-shadow(0 0 6px #7ffcf4)}"
      + "#cs-skills.is-editing [data-sk-item]{outline:1px dashed #f2b21c !important;background:rgba(242,178,28,.08) !important;cursor:grab !important;z-index:20;touch-action:none}"
      + "#cs-skills.is-editing [data-sk-item]:active{cursor:grabbing !important}"
      + "#cs-skills.is-editing [data-sk-item]>*{pointer-events:none}"
      + ".fx-panel.fx-skills{position:relative}"
      + ".fx-panel.fx-skills .csd-corner-bar{position:absolute;right:12px;bottom:12px;z-index:30;display:flex;gap:5px;align-items:center}"
      + ".fx-panel.fx-skills .csd-corner-btn{width:auto !important;height:auto !important;min-height:0 !important;padding:5px 10px !important;font-size:11px !important;line-height:1.2 !important}"
      + ".fx-panel.fx-skills .csd-corner-mini{width:auto !important;height:auto !important;min-height:0 !important;padding:5px 8px !important;font-size:11px !important;line-height:1.2 !important}";

    document.head.appendChild(st);
    // Bouton d'entraînement sous les stats (onglet Stats)
    const tb = document.createElement("button"); tb.id = "cs-train"; tb.className = "fx-btn cs-btn"; tb.onclick = e => { e.stopPropagation(); this.entrainer(); };
    this.Q("#fx-stats").after(tb);
    const gold = document.createElement("div"); gold.id = "cs-stats-gold"; gold.className = "cs-gold"; gold.setAttribute("aria-live", "polite");
    this.Q("#fx-stats").after(gold);
    // Puissance en haut de l'onglet Stats
    const pw = document.createElement("div"); pw.id = "cs-power"; pw.className = "cs-power"; this.Q("#fx-stats").before(pw);
    // Console holo-cyan des compétences (décor assets/backgrounds/competence/background.jpeg)
    const sg = this.Q("#fx-sgrid"), pn = document.createElement("div");
    pn.id = "cs-skills";
    const bgUrl = typeof assetPath !== "undefined" && assetPath.competenceBg ? assetPath.competenceBg() : "assets/backgrounds/competence/background.jpeg";
    pn.style.backgroundImage = `url("${encodeURI(bgUrl)}")`;
    pn.innerHTML = '<div id="cs-synergies" class="cs-syn-screen"></div><div id="cs-slots" class="cs-slots"></div><div class="cs-ctrl-right"><div id="cs-presets" class="cs-pres"></div><button id="cs-unlock" class="fx-btn cs-btn"></button></div>';
    sg.before(pn);
    pn.appendChild(sg);
    this.Q("#cs-unlock").onclick = e => { e.stopPropagation(); this.debloquerCompetence(); };
    this.Q("#btn-fuse").onclick = () => this.fusionner();                    // Forge
    this.applySkillsLayout();
    this.initSkillsDevUI();
  },
  SKILLS_LAYOUT_KEY: "arene_skills_dev_layout_v1",
  _skillsEditing: false,
  _skillsPositions: null,
  defaultSkillsPositions(){
    const items = [
      { id: "syn",    x: 20.18, y: 23.95, size: 18.2, angle: 0 },
      { id: "slot_0", x: 36.21, y: 22.95, size: 7.8,  angle: 0 },
      { id: "slot_1", x: 44.68, y: 21.95, size: 9.0,  angle: 0 },
      { id: "slot_2", x: 53.51, y: 22.52, size: 9.0,  angle: 0 },
      { id: "pre_1",  x: 37.06, y: 4.0,   size: 7.4,  angle: 0 },
      { id: "pre_2",  x: 44.62, y: 4.0,   size: 7.4,  angle: 0 },
      { id: "pre_3",  x: 52.24, y: 4.0,   size: 7.4,  angle: 0 },
      { id: "unlock", x: 31.43, y: 4.0,   size: 3.1,  angle: 0 }
    ];
    // Grille 8 x 4 : centre exact de chaque case (mesuré sur ta capture)
    const GX0 = 16.13, GDX = 8.21;   // x de la colonne 0 + écart entre colonnes (%)
    const GY0 = 49.15, GDY = 9.80;   // y de la ligne 0 + écart entre lignes (%)
    for (let i = 0; i < 32; i++) {
      const col = i % 8, row = Math.floor(i / 8);
      items.push({
        id: "sk_" + i,
        x: +(GX0 + col * GDX).toFixed(2),
        y: +(GY0 + row * GDY).toFixed(2),
        size: 6.7,
        angle: 0
      });
    }
    return items;
  },  getSkillsPositions(){
    if (this._skillsPositions) return this._skillsPositions;
    const def = this.defaultSkillsPositions();
    try {
      const saved = JSON.parse(localStorage.getItem(this.SKILLS_LAYOUT_KEY) || "null");
      if (Array.isArray(saved)) {
        saved.forEach(s => {
          const t = def.find(d => d.id === s.id);
          if (t && Number.isFinite(s.x) && Number.isFinite(s.y)) Object.assign(t, s);
        });
      }
    } catch (_) {}
    this._skillsPositions = def;
    return def;
  },
  saveSkillsPositions(){
    if (!this._skillsPositions) return;
    const clean = this._skillsPositions.map(({ id, x, y, size, angle }) => ({
      id, x: +x.toFixed(2), y: +y.toFixed(2), size: +size.toFixed(1), angle: +(angle || 0).toFixed(1)
    }));
    try { localStorage.setItem(this.SKILLS_LAYOUT_KEY, JSON.stringify(clean)); } catch (_) {}
    console.log("SKILLS_LAYOUT =", JSON.stringify(clean));
  },
  applySkillItemPos(el, pos, stage){
    const w = stage ? stage.clientWidth : 800;
    el.style.position = "absolute";
    el.style.left = pos.x + "%";
    el.style.top = pos.y + "%";
    el.style.transform = `translate(-50%,-50%) rotate(${pos.angle || 0}deg)`;
    if (pos.id === "syn") {
      el.style.width = pos.size + "%";
      el.style.height = (pos.size * 0.65) + "%";
      el.style.fontSize = Math.max(7, w * pos.size * 0.0055) + "px";
    } else if (pos.id.startsWith("pre_")) {
      el.style.width = pos.size + "%";
      el.style.height = "auto";
      el.style.fontSize = Math.max(8, w * pos.size * 0.0014) + "px";
    } else if (pos.id === "unlock") {
      el.style.width = pos.size + "%";
      el.style.height = "auto";
      el.style.fontSize = Math.max(7, w * pos.size * 0.0042) + "px";
    } else {
      el.style.height = pos.size + "%";
      el.style.width = "auto";
      el.style.aspectRatio = "1 / 1";
      el.style.fontSize = Math.max(12, w * pos.size * 0.0046) + "px";
    }
  },
  applySkillsLayout(){
    const pn = this.Q("#cs-skills"); if (!pn) return;
    const list = this.getSkillsPositions();
    pn.querySelectorAll("[data-sk-item]").forEach(el => {
      const pos = list.find(p => p.id === el.dataset.skItem);
      if (pos) this.applySkillItemPos(el, pos, pn);
    });
  },
  initSkillsDevUI(){
    const pn = this.Q("#cs-skills"); if (!pn) return;
    const host = pn.closest(".fx-panel.fx-skills") || pn;
    if (host.querySelector("#csd-corner-bar")) return;
    let drag = null;

    const bar = document.createElement("div");
    bar.id = "csd-corner-bar";
    bar.className = "csd-corner-bar";
    bar.innerHTML = `<button type="button" id="csd-copy" class="fx-btn csd-corner-mini" title="Copier les coordonnées JSON">📋</button>`
      + `<button type="button" id="csd-reset" class="fx-btn csd-corner-mini" title="Réinitialiser les positions">↺</button>`
      + `<button type="button" id="csd-edit" class="fx-btn csd-corner-btn">ÉDITER LES COMPÉTENCES</button>`;
    host.appendChild(bar);

    const isDev = () => !!document.getElementById("devbox") || !!GameState.illimite || /[?&]dev\b/.test(location.search);
    const setEdit = on => {
      this._skillsEditing = on;
      pn.classList.toggle("is-editing", on);
      const btn = bar.querySelector("#csd-edit");
      if (btn) btn.textContent = on ? "Terminer le placement" : "ÉDITER LES COMPÉTENCES";
      this.majUnlock();   // le bouton Tirage doit rester déplaçable même grisé
    };
    const syncVis = () => {
      const on = isDev();
      bar.style.display = on ? "flex" : "none";
      if (!on && this._skillsEditing) setEdit(false);
    };
    syncVis();
    this._syncSkillsDev = syncVis;   // rappelé à chaque render()
    new MutationObserver(syncVis).observe(document.body, { childList: true });
    bar.querySelector("#csd-edit").onclick = e => {
      e.stopPropagation();
      setEdit(!this._skillsEditing);
      if (!this._skillsEditing && typeof toast === "function") toast("Placement des compétences enregistré !");
    };
    bar.querySelector("#csd-copy").onclick = e => {
      e.stopPropagation();
      const clean = this.getSkillsPositions().map(({ id, x, y, size, angle }) => ({
        id, x: +x.toFixed(2), y: +y.toFixed(2), size: +size.toFixed(1), angle: +(angle || 0).toFixed(1)
      }));
      if (navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(clean));
      if (typeof toast === "function") toast("Coordonnées copiées dans le presse-papiers !");
    };
    bar.querySelector("#csd-reset").onclick = e => {
      e.stopPropagation();
      try { localStorage.removeItem(this.SKILLS_LAYOUT_KEY); } catch (_) {}
      this._skillsPositions = null;
      this.applySkillsLayout();
      if (typeof toast === "function") toast("Positions par défaut restaurées.");
    };

    pn.addEventListener("pointerdown", ev => {
      if (!this._skillsEditing) return;
      const el = ev.target.closest("[data-sk-item]"); if (!el) return;
      ev.preventDefault(); ev.stopPropagation();
      const pos = this.getSkillsPositions().find(p => p.id === el.dataset.skItem); if (!pos) return;
      drag = { el, pos, pointerId: ev.pointerId };
      el.setPointerCapture(ev.pointerId);
    });
    pn.addEventListener("pointermove", ev => {
      if (!drag || ev.pointerId !== drag.pointerId) return;
      const rect = pn.getBoundingClientRect();
      drag.pos.x = Math.max(2, Math.min(98, ((ev.clientX - rect.left) / rect.width) * 100));
      drag.pos.y = Math.max(4, Math.min(96, ((ev.clientY - rect.top) / rect.height) * 100));
      this.applySkillItemPos(drag.el, drag.pos, pn);
    });
    const endDrag = ev => {
      if (!drag || ev.pointerId !== drag.pointerId) return;
      drag = null;
      this.saveSkillsPositions();
    };
    pn.addEventListener("pointerup", endDrag);
    pn.addEventListener("pointercancel", endDrag);
    // En mode édition : un glisser ne doit JAMAIS déclencher le clic (tirage, slots, presets, compétences)
    pn.addEventListener("click", ev => {
      if (!this._skillsEditing || !ev.target.closest("[data-sk-item]")) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
    }, true);    pn.addEventListener("wheel", ev => {
      if (!this._skillsEditing) return;
      const el = ev.target.closest("[data-sk-item]"); if (!el) return;
      ev.preventDefault(); ev.stopPropagation();
      const pos = this.getSkillsPositions().find(p => p.id === el.dataset.skItem); if (!pos) return;
      const d = ev.deltaY || ev.deltaX;   // Maj + molette = deltaX sur Windows/Chrome
      if (ev.shiftKey) pos.angle = (pos.angle || 0) + (d < 0 ? 5 : -5);
      else pos.size = Math.max(3, Math.min(50, (pos.size || 8.5) + (d < 0 ? 0.6 : -0.6)));      this.applySkillItemPos(el, pos, pn);
      this.saveSkillsPositions();
    }, { passive: false });

    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => this.applySkillsLayout()).observe(pn);
    }
  }
};

/* ---------- Forge cybernétique (sous-pop-up) : affichage ---------- */
function renderForge(){
  const b = S.cur, gs = ForgeSystem.groups(b), R = DataEngine.RARITIES, P = DataEngine.PARTS, $c = s => document.querySelector(s);
  if (S.forgeKey && !gs.find(g => g.k === S.forgeKey)) S.forgeKey = null;
  const g = gs.find(x => x.k === S.forgeKey), part = g && P.find(p => p.id === g.part);
  const ok = g && g.n >= 3 && g.rarity < 5;
  const slot = i => `<div class="fslot">${g && i < Math.min(g.n, 3) ? part.icon : ""}</div>`;
  $c("#fusion").innerHTML = slot(0) + '<span class="fop">+</span>' + slot(1) + '<span class="fop">+</span>' + slot(2) + '<span class="fop">➜</span>' +
    `<div class="fslot out" style="${ok ? `border-color:${R[g.rarity + 1].color}` : ""}">${ok ? part.icon : "?"}</div>`;
  $c("#btn-fuse").disabled = !ok;
  $c("#inv").innerHTML = gs.length ? gs.sort((a, c) => c.rarity - a.rarity).map(x => {
    const p = P.find(q => q.id === x.part);
    return `<button class="item ${x.k === S.forgeKey ? "sel" : ""}" data-k="${x.k}" style="border-color:${R[x.rarity].color}">${p.icon} ${p.name} · ${R[x.rarity].name} ×${x.n}</button>`; }).join("")
    : '<p class="hint">Aucun équipement. Volez des caisses dans le Piratage de cargos.</p>';
  document.querySelectorAll("#inv .item").forEach(e => e.onclick = () => { S.forgeKey = e.dataset.k; renderForge(); });
}
