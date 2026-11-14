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
    if (!t.dataset.ready) {
      t.dataset.ready = "1";
      t.innerHTML = `<canvas id="cv-train" width="520" height="150"></canvas><button type="button" class="train-sign" title="Entraînement mutagène (+1 stat aléatoire)"></button>`;
      t.querySelector(".train-sign").onclick = e => { e.stopPropagation(); if (!this._statsEditing) this.entrainer(); };
      this._trainQ = []; this._trainRun = null; this._trainHit = null;
      const loop = now => {
        const cv = this.Q("#cv-train");
        if (cv && cv.offsetParent && S.cur) this.drawTrainRoom(cv.getContext("2d"), S.cur, now);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  },
  lancerAnimTrain(stat){
    if (!this._trainQ) this._trainQ = [];
    this._trainQ.push(stat);
  },
  drawTrainRoom(ctx, b, now){
    const W = 520, H = 150, FLOOR_Y = 128;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    // 4 bornes d'entraînement holographiques sur le tapis (Force, Vie, Agilité, Rapidité)
    const STATIONS = [
      { key: "str", x: 195, icon: "💪", col: "#ff6b6b" },
      { key: "hp",  x: 280, icon: "❤️", col: "#ff922b" },
      { key: "agi", x: 365, icon: "🌀", col: "#4ff0e6" },
      { key: "spd", x: 450, icon: "⚡", col: "#ffe066" }
    ];
    const DUMMY_X = { str: 195, hp: 280, agi: 365, spd: 450 }, HOME_X = 68, REACH = 38;

    STATIONS.forEach(st => {
      const hitNow = this._trainHit && this._trainHit.st === st.key && (now - this._trainHit.t0 < 320);
      const wobble = hitNow ? Math.sin((now - this._trainHit.t0) * 0.06) * 5 : 0;
      ctx.save();
      ctx.translate(st.x + wobble, FLOOR_Y);
      // Socle & poteau
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(-16, -4, 32, 6);
      ctx.fillStyle = "#3a4552";
      ctx.fillRect(-3, -44, 6, 40);
      // Cible lumineuse
      ctx.fillStyle = "rgba(8,18,24,0.88)";
      ctx.strokeStyle = hitNow ? "#fff" : st.col;
      ctx.lineWidth = 2;
      ctx.fillRect(-14, -68, 28, 26);
      ctx.strokeRect(-14, -68, 28, 26);
      ctx.font = "15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(st.icon, 0, -55);
      ctx.restore();
    });

    let r = this._trainRun;
    if (!r && this._trainQ && this._trainQ.length) {
      const st = this._trainQ.shift();
      r = this._trainRun = { st, phase: "to", x: HOME_X, tx: DUMMY_X[st] || 280, t0: now };
    }
    let px = HOME_X, flip = false, anim = "idle";
    if (r) {
      const dt = Math.min(50, now - (r.last || now)); r.last = now;
      if (r.phase === "to") {
        anim = "run"; flip = false; r.x += dt * 0.34;
        if (r.x >= r.tx - REACH) { r.x = r.tx - REACH; r.phase = "hit"; r.t0 = now; this._trainHit = { st: r.st, x: r.tx, t0: now }; }
      } else if (r.phase === "hit") {
        anim = "atk"; flip = false;
        if (now - r.t0 > 260) {
          if (this._trainQ.length) {
            const st = this._trainQ.shift();
            r.st = st; r.tx = DUMMY_X[st] || 280; r.phase = r.x <= r.tx - REACH ? "to" : "back";
          } else { r.phase = "back"; }
        }
      } else if (r.phase === "back") {
        anim = "run"; flip = true; r.x -= dt * 0.34;
        if (r.x <= HOME_X) { this._trainRun = null; r = null; }
      }
      if (r) px = r.x;
    }

    // Dessin du mini-brawler qui court sur le tapis
    if (typeof renderer !== "undefined" && renderer.drawBrute) {
      const off = this._trainOff || (this._trainOff = Object.assign(document.createElement("canvas"), { width: 64, height: 64 }));
      renderer.drawBrute(off.getContext("2d"), b, now, anim);
      ctx.save();
      ctx.translate(Math.round(px - 36), FLOOR_Y - 70);
      if (flip) { ctx.translate(72, 0); ctx.scale(-1, 1); }
      ctx.drawImage(off, 0, 0, 64, 64, 0, 0, 72, 72);
      ctx.restore();
    }

    // Impact + "+1" flottant au-dessus de la borne frappée
    if (this._trainHit && now - this._trainHit.t0 < 750) {
      const p = (now - this._trainHit.t0) / 750;
      const nom = { str: "+1 FORCE", hp: "+1 VIE", agi: "+1 AGILITÉ", spd: "+1 RAPIDITÉ" }[this._trainHit.st] || "+1";
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
      ctx.strokeText(nom, this._trainHit.x, 42 - p * 22);
      ctx.fillStyle = "#7ffcf4";
      ctx.fillText(nom, this._trainHit.x, 42 - p * 22);
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
/* ---------- 2b. CAISSES EN 1 CLIC & MULTI-TIRAGE, ÉQUIPEMENT PVP & FORGE ---------- */
  actionCaisse(count = 1){
    const GS = GameState, b = S.cur; if (!b) return;
    const target = Math.max(1, Math.min(50, count | 0));
    let opened = 0, gearCnt = 0, weapCnt = 0, dupGold = 0, bestRar = -1;
    for (let i = 0; i < target; i++) {
      if ((GS.ressources.caisses || 0) <= 0) {
        if (!depenserRessource("or", GS.PRIX_CAISSE)) break;
        donnerRecompense("caisses", 1);
      }
      if (target === 1) {
        GS.ouvrirCaisse();
        const resEl = this.Q("#chest-result");
        if (resEl && resEl.innerHTML) this._lastChestHTML = resEl.innerHTML;
        opened = 1;
        break;
      }
      GS.ressources.caisses--;
      const r = GachaShop.open(b);
      if (!r || !r.ok) { GS.ressources.caisses++; break; }
      opened++;
      if (r.type === "gear") { gearCnt++; bestRar = Math.max(bestRar, r.rarity); }
      else if (r.type === "weapon") { weapCnt++; }
      else if (r.type === "dup") {
        dupGold += 25;
        const m = GS.maitriseArmes[r.w.id] || 0;
        if (m < GS.MAITRISE_MAX) GS.maitriseArmes[r.w.id] = m + 1;
        else GS.ressources.parchemins++;
      }
    }
    if (!opened) { toast("Or insuffisant (" + GS.PRIX_CAISSE + " Or requis)."); return; }
    if (opened > 1) {
      const rarTag = bestRar >= 0 ? ` · Max <b style="color:${DataEngine.RARITIES[bestRar].color}">${DataEngine.RARITIES[bestRar].name}</b>` : "";
      this._lastChestHTML = `📦 <b>×${opened}</b> : ${gearCnt} pièce(s)${weapCnt ? `, ${weapCnt} arme(s)` : ""}${dupGold ? `, +${dupGold} Or` : ""}${rarTag}`;
      toast(`Ouverture ×${opened} terminée !`);
    }
    persist();
  },
  equiperPiece(sig){
    const b = S.cur; if (!b) return;
    const item = (b.gear || []).find(g => DataEngine.gearSig(g) === sig);
    if (!item) return;
    if (item.part === "ring") {
      if (!Array.isArray(b.eqRings)) b.eqRings = [];
      const idx = b.eqRings.indexOf(sig);
      if (idx >= 0) b.eqRings.splice(idx, 1);
      else {
        if (b.eqRings.length >= 2) b.eqRings.shift();
        b.eqRings.push(sig);
      }
    } else {
      if (!b.eqArmor) b.eqArmor = {};
      b.eqArmor[item.part] = { set: item.set, rarity: item.rarity };
    }
    persist();
  },
  async transmuterGroupe(key){
    if (!depenserRessource("pierres", 1)) { toast("1 Pierre de Transmutation (💎) requise."); return; }
    const r = ForgeSystem.transmute(S.cur, key);
    if (!r.ok) { donnerRecompense("pierres", 1); toast(r.msg); return; }
    toast("💎 Pièce transmutée !");
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
    const res = ForgeSystem.autoFuse(S.cur);
    if (!res.n) { toast("Aucune série de 3 équipements strictement identiques à fusionner."); return; }
    toast("Auto-Forge : " + res.n + " fusion" + (res.n > 1 ? "s" : "") + " effectuée" + (res.n > 1 ? "s" : "") + " !");
    for (let i = 0; i < res.div; i++) if (typeof divineAwakening === "function") await divineAwakening(S.cur);
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
    if (pw) pw.textContent = `⚔️ ${(typeof calculerPuissance === "function" ? calculerPuissance() : 0).toLocaleString("fr-FR")}`;
    this.applyStatsLayout();
    if (this._syncStatsDev) this._syncStatsDev();
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
      const syns = DataEngine.getAllSynergies(b, eq), maxSlots = this.slotsOuverts();
      if (syns.length) {
        const s = syns[0];
        const descLines = E(s.desc).replace(/\s*&\s*/g, "<br>");
        synBox.classList.add("active");
        synBox.style.setProperty("--syn-c", s.col);
        synBox.title = `${s.name} (${s.count}/${maxSlots}) : ${s.desc}`;
        synBox.innerHTML = `<b style="color:${s.col}">${s.icon} ${s.name.toUpperCase()} [${s.count}/${maxSlots}]</b><span>${descLines}</span>`;
      } else {
        synBox.classList.remove("active");
        synBox.style.removeProperty("--syn-c");
        synBox.removeAttribute("title");
        synBox.innerHTML = `<b style="opacity:.8">SYNERGIE</b><span style="opacity:.65">2+ même élément</span>`;
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
    if (this._syncSkillsDev) this._syncSkillsDev();
    this.renderEquipementTab();
  },
  majUnlock(){
    const u = this.Q("#cs-unlock"), b = S.cur; if (!u || !b) return;
    const c = this.coutParchemin(), tout = b.skills.length >= DataEngine.SKILLS.length, R = GameState.ressources;
    u.textContent = tout ? "✔ 32/32 DÉBLOQUÉES" : `📜 TIRAGE (${c} 📜 · stock: ${R.parchemins})`;
    u.disabled = !this._skillsEditing && (tout || R.parchemins < c);
  },
  describeGear(g){
    const D = DataEngine, STAT_NOM = { hp: "Vie", str: "Force", agi: "Agilité", spd: "Vitesse" };
    if (g.part === "ring") {
      if (g.kind === "el") {
        const pct = Math.round((D.RING_EL_BONUS[g.rarity] || 0.1) * 100);
        return { title: "Anneau " + D.ELEMENTS[g.el], sub: `${D.EL_ICON[g.el]} +${pct}% Dégâts & +1 Synergie`, col: D.EL_COL[g.el] };
      }
      const val = D.RING_STAT_BONUS[g.rarity] || 2;
      return { title: "Anneau " + STAT_NOM[g.stat], sub: `+${val} ${STAT_NOM[g.stat]}`, col: "#7ffcf4" };
    }
    const p = D.PARTS.find(x => x.id === g.part), s = D.GEAR_SETS[g.set] || D.GEAR_SETS.carnage;
    const val = D.GEAR_BONUS[g.rarity] || 1;
    return { title: `${p.name} ${s.name}`, sub: `${s.icon} +${val} ${STAT_NOM[D.PART_STAT[g.part]]}`, col: s.col };
  },
  renderEquipementTab(){
    const root = this.Q("#cs-equip-root"), b = S.cur; if (!root || !b) return;
    const D = DataEngine, R = GameState.ressources, RAR = D.RARITIES;
    const allGs = ForgeSystem.groups(b).sort((a, c) => c.rarity - a.rarity);
    const filt = this._equipFilter || "all";
    const gs = filt === "all" ? allGs : allGs.filter(g => g.part === filt);
    const fusables = allGs.filter(g => g.n >= 3 && g.rarity < 5).length;
    const eq = D.getEquippedGear(b), eqSigs = new Set(eq.all.map(x => D.gearSig(x)));
    const activeSets = D.getActiveSetBonuses(b);

    const cnt = this.Q("#cs-eqcount");
    if (cnt) cnt.textContent = (b.gear ? b.gear.length : 0) + " pièce(s)";

    const hasStock = (R.caisses || 0) > 0;
    const lcdText = hasStock ? `STOCK ×${R.caisses}` : `${GameState.PRIX_CAISSE} OR`;
    const btnDis = !hasStock && R.or < GameState.PRIX_CAISSE ? "disabled" : "";
    const maxOpen = Math.min(50, (R.caisses || 0) + Math.floor((R.or || 0) / GameState.PRIX_CAISSE));
    const n10 = Math.min(10, maxOpen);

    const slotsDef = [
      { label: "Casque", icon: "🪖", item: eq.armors.find(g => g.part === "helmet") },
      { label: "Plastron", icon: "🦺", item: eq.armors.find(g => g.part === "chest") },
      { label: "Bottes", icon: "🥾", item: eq.armors.find(g => g.part === "boots") },
      { label: "Collier", icon: "📿", item: eq.armors.find(g => g.part === "necklace") },
      { label: "Anneau I", icon: "💍", item: eq.rings[0] },
      { label: "Anneau II", icon: "💍", item: eq.rings[1] }
    ];

    const bgUrl = typeof assetPath !== "undefined" && assetPath.equipementBg ? assetPath.equipementBg() : "assets/backgrounds/equipement/background.jpeg";

    const equippedHTML = slotsDef.map((sl, idx) => {
      if (!sl.item) return `<div class="cs-eq-slot" data-eq-item="slot_${idx}" title="${sl.label} : Vide"><span class="cs-eq-ico" style="opacity:.28">${sl.icon}</span><span class="cs-eq-badge">${sl.label}</span></div>`;
      const rInfo = RAR[sl.item.rarity], desc = this.describeGear(sl.item);
      return `<div class="cs-eq-slot filled" data-eq-item="slot_${idx}" style="--rc:${rInfo.color}" title="${desc.title} (${rInfo.name}) : ${desc.sub}">
        <span class="cs-eq-ico">${sl.icon}</span>
        <span class="cs-eq-badge" style="--rc:${rInfo.color}">${desc.sub}</span>
      </div>`;
    }).join("");

    const setsHTML = activeSets.length
      ? activeSets.map(sb => `<span class="cs-set-pill" style="--sc:${sb.set.col}">${sb.set.icon} <b>${sb.set.name} (${sb.count}/4)</b> · ${sb.tier === 4 ? sb.set.p2 + " + " + sb.set.p4 : sb.set.p2}</span>`).join("")
      : `<span style="color:#d6c39c">🪙 ${R.or.toLocaleString("fr-FR")} Or · 💎 ${R.pierres} Pierres${this._lastChestHTML ? ` · Loot : ${this._lastChestHTML}` : ""}</span>`;

    const filtersHTML = [["all","Tout"],["helmet","🪖"],["chest","🦺"],["boots","🥾"],["necklace","📿"],["ring","💍"]]
      .map(([k, lbl]) => `<button type="button" class="${filt === k ? "on" : ""}" data-efilt="${k}">${lbl}</button>`).join("");

    const invHTML = gs.length ? gs.map(g => {
      const p = D.PARTS.find(q => q.id === g.part), rInfo = RAR[g.rarity], desc = this.describeGear(g);
      const canFuse = g.n >= 3 && g.rarity < 5, isEq = eqSigs.has(g.k);
      return `<div class="cs-inv-item ${canFuse ? "fusable" : ""} ${isEq ? "equipped" : ""}" style="--rc:${rInfo.color}" title="${desc.title} (${rInfo.name}) : ${desc.sub}">
        <span class="cs-inv-ico">${p.icon}</span>
        <span class="cs-inv-name" style="color:${rInfo.color}">${desc.title}</span>
        <small style="color:${desc.col}">${desc.sub} · <b>×${g.n}</b></small>
        <div class="cs-inv-acts">
          <button type="button" data-eq="${g.k}">${isEq ? "✔" : "Équip."}</button>
          ${canFuse ? `<button type="button" class="fuse-btn" data-fk="${g.k}" title="Fusionner ×3">🔨</button>` : ""}
          ${R.pierres > 0 ? `<button type="button" class="trans-btn" data-tr="${g.k}" title="Transmuter (1 💎)">💎</button>` : ""}
        </div>
      </div>`;
    }).join("") : `<span style="opacity:.65;margin:auto;font:10px monospace">Cliquez sur la caisse dorée pour forger du loot !</span>`;

    root.innerHTML = `<div id="cs-equip-stage" style="background-image:url('${encodeURI(bgUrl)}')">
      <div class="cs-gold-crate-wrap" data-eq-item="cargo">
        <button type="button" id="cs-oneclick-chest" class="cs-gold-crate" ${btnDis} title="Ouvrir 1 caisse Wass-E">
          <span class="cs-crate-icon">📦</span>
          <span class="cs-digital-lcd ${hasStock ? "" : "amber"}">${lcdText}</span>
          <span class="cs-crate-sub">${hasStock ? "OUVRIR ×1" : "ACHETER ×1"}</span>
        </button>
        <div class="cs-crate-multi">
          <button type="button" data-copen="${n10}" ${n10 < 2 ? "disabled" : ""}>×${n10 || 10}</button>
          <button type="button" data-copen="${maxOpen}" ${maxOpen < 2 ? "disabled" : ""}>MAX (${maxOpen})</button>
        </div>
      </div>
      <div class="cs-set-bar" data-eq-item="sets">${setsHTML}</div>
      ${equippedHTML}
      <div class="cs-inv-dock" data-eq-item="inv">
        <div class="cs-inv-head">
          <div class="cs-inv-filters">${filtersHTML}</div>
          <button id="cs-autofuse" class="fx-mini" style="padding:1px 6px;font-size:9.5px" ${fusables ? "" : "disabled"}>🔨 ×3 (${fusables})</button>
        </div>
        <div class="cs-inv-strip">${invHTML}</div>
      </div>
    </div>`;

    this.applyEquipLayout();
    this.initEquipDevUI();
    if (this._syncEquipDev) this._syncEquipDev();

    const cb = this.Q("#cs-oneclick-chest");
    if (cb) cb.onclick = e => { e.stopPropagation(); this.actionCaisse(1); };
    root.querySelectorAll("[data-copen]").forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); this.actionCaisse(+btn.dataset.copen); };
    });
    const af = this.Q("#cs-autofuse");
    if (af) af.onclick = e => { e.stopPropagation(); this.toutFusionner(); };
    root.querySelectorAll("[data-efilt]").forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); this._equipFilter = btn.dataset.efilt; this.renderEquipementTab(); };
    });
    root.querySelectorAll("[data-eq]").forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); this.equiperPiece(btn.dataset.eq); };
    });
    root.querySelectorAll("[data-fk]").forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); this.fusionnerGroupe(btn.dataset.fk); };
    });
    root.querySelectorAll("[data-tr]").forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); this.transmuterGroupe(btn.dataset.tr); };
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
    setTab(2);
    if (typeof Caserne !== "undefined") Caserne.snap = idx => setTab(idx);
    const fiche = this.Q("#g-fiche");
    if (fiche) {
      new MutationObserver(() => {
        if (!fiche.classList.contains("hidden") && fiche.classList.contains("active")) setTab(2);
      }).observe(fiche, { attributes: true, attributeFilter: ["class"] });
    }
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
      + ".fx-equip-tab{position:relative;flex:1;min-height:0;overflow:hidden}"
      + "#cs-equip-root{width:100%;height:100%}"
      + "#cs-equip-stage{position:relative;width:100%;max-height:100%;aspect-ratio:1408/752;background-size:100% 100%;background-repeat:no-repeat;margin:0 auto;overflow:hidden;user-select:none}"
      + "#cs-equip-stage.is-editing [data-eq-item]{outline:1px dashed #f2b21c !important;background:rgba(242,178,28,.16) !important;cursor:grab !important;z-index:25;touch-action:none}"
      + "#cs-equip-stage.is-editing [data-eq-item]:active{cursor:grabbing !important}"
      + "#cs-equip-stage.is-editing [data-eq-item]>*{pointer-events:none}"
      + ".fx-panel.fx-hero{position:relative;flex:1;min-height:0;padding:0 !important;overflow:hidden;background:transparent !important;border:none !important;display:flex;align-items:center;justify-content:center}"
      + "#cs-stats-stage{position:relative;height:100%;width:auto;max-width:100%;aspect-ratio:1408/752;background-size:100% 100%;background-repeat:no-repeat;margin:0 auto;overflow:hidden;user-select:none}"
      + "#cs-stats-stage.is-editing [data-st-item]{outline:1px dashed #f2b21c !important;background:rgba(242,178,28,.12) !important;cursor:grab !important;z-index:25;touch-action:none}"
      + "#cs-stats-stage.is-editing [data-st-item]:active{cursor:grabbing !important}"
      + "#cs-stats-stage.is-editing [data-st-item]>*{pointer-events:none}"
      + "#cs-stats-stage .fx-avatar{width:auto;height:auto;background:transparent !important;border:none !important;box-shadow:none !important;display:flex !important;align-items:center;justify-content:center}"
      + "#cs-stats-stage .fx-avatar::after{content:'';position:absolute;inset:8% 14%;border-radius:50%;background:repeating-linear-gradient(0deg,rgba(79,240,230,.12) 0 1px,transparent 1px 4px);mix-blend-mode:screen;pointer-events:none;opacity:.55}"
      + "#cs-stats-stage .fx-avatar canvas{width:100% !important;height:100% !important;image-rendering:pixelated;filter:contrast(1.06) saturate(.94) drop-shadow(0 8px 6px rgba(0,0,0,.9)) drop-shadow(0 0 10px rgba(79,240,230,.45))}"
      + "#cs-hero-plate{display:flex !important;flex-direction:column;align-items:center;gap:2px;padding:3px 10px;background:rgba(5,16,20,.85);border:1px solid rgba(79,240,230,.48);border-radius:2px;box-shadow:0 0 12px rgba(79,240,230,.25),inset 0 0 8px rgba(0,0,0,.9);text-align:center;z-index:12}"
      + "#cs-hero-plate #fx-name-row{display:flex !important;align-items:center;justify-content:center;gap:5px;margin:0 !important}"
      + "#cs-hero-plate #fx-name{display:block !important;font:bold clamp(11px,1.2vw,16px)/1.1 Impact,sans-serif !important;color:#fff !important;text-shadow:0 0 8px rgba(79,240,230,.85);letter-spacing:.7px;white-space:nowrap}"
      + "#cs-hero-plate #fx-rename{width:auto !important;height:auto !important;min-width:0 !important;min-height:0 !important;padding:1px 4px !important;font-size:10px !important;line-height:1 !important;background:rgba(79,240,230,.15) !important;border:1px solid #4ff0e6 !important;color:#7ffcf4 !important}"
      + "#cs-hero-plate #fx-tag{display:block !important;margin:0 !important;font:bold clamp(8px,0.75vw,10px)/1.1 monospace !important;color:#7ffcf4 !important;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}"
      + "#cs-stats-stage .fx-hero-actions{position:absolute;display:flex !important;gap:5px;z-index:18}"
      + "#cs-stats-stage .fx-hero-actions button{width:auto !important;height:auto !important;min-height:0 !important;padding:4px 7px !important;font-size:13px !important;line-height:1 !important}"
      + "#cs-stats-crt{display:flex !important;flex-direction:column;justify-content:space-between;gap:5px;padding:8px 10px;box-sizing:border-box;background:repeating-linear-gradient(0deg,rgba(79,240,230,.04) 0 1px,transparent 1px 3px);color:#9cf9ff;font:11px/1.2 monospace !important;overflow:hidden;z-index:10}"
      + ".cs-crt-top{display:flex !important;justify-content:space-between;align-items:center;gap:6px;border-bottom:1px solid rgba(79,240,230,.28);padding-bottom:3px}"
      + ".cs-crt-power{font:bold clamp(10px,0.95vw,13px)/1.1 monospace !important;color:#ffd77a !important;text-shadow:0 0 6px rgba(255,190,40,.75);white-space:nowrap}"
      + ".cs-crt-gold{color:#7ffcf4 !important;font:bold clamp(10px,0.9vw,12px)/1.1 monospace !important;white-space:nowrap}"
      + "#cs-stats-crt .fx-vitals{display:flex !important;align-items:center;justify-content:space-between;gap:8px;margin:0 !important;padding:4px 6px;background:rgba(4,16,20,.82);border:1px solid rgba(79,240,230,.35)}"
      + "#cs-stats-crt .fx-lv{flex:1;display:flex !important;align-items:center;gap:6px;margin:0 !important}"
      + "#cs-stats-crt .fx-lvt{font:bold 10px/1.1 monospace !important;color:#7ffcf4 !important;white-space:nowrap}"
      + "#cs-stats-crt .fx-xp{position:relative;flex:1;height:11px !important;background:#061014;border:1px solid #356570}"
      + "#cs-stats-crt .fx-xp i{display:block;height:100%;background:linear-gradient(90deg,#25b8c4,#7ffcf4);box-shadow:0 0 6px #4ff0e6}"
      + "#cs-stats-crt .fx-xp span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:8.5px !important;color:#fff;text-shadow:0 1px 2px #000}"
      + "#cs-stats-crt .fx-pv{margin:0 !important;font-size:10px !important;color:#ff8a8a !important;white-space:nowrap}"
      + "#cs-stats-crt .fx-stats{display:grid !important;grid-template-columns:1fr 1fr;gap:5px 8px;margin:0 !important;flex:1;min-height:0}"
      + "#cs-stats-crt .fx-stat{display:flex !important;flex-direction:column;justify-content:center;padding:4px 7px !important;min-height:0 !important;background:rgba(4,16,20,.85) !important;border:1px solid rgba(79,240,230,.35) !important;border-radius:2px}"
      + "#cs-stats-crt .fx-stat:hover{border-color:#7ffcf4}"
      + "#cs-stats-crt .fx-sl{display:flex !important;justify-content:space-between;font-size:10px !important;margin-bottom:3px}"
      + "#cs-stats-crt .seg{display:flex !important;gap:2px;height:7px !important}"
      + "#cs-stats-crt .seg{display:flex !important;gap:2px;height:7px !important}"
      + ".cs-train-track{position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;background:rgba(8,10,12,.68)}"
      + ".cs-train-track canvas{width:100% !important;height:100% !important;display:block;image-rendering:pixelated}"
      + ".cs-train-track .train-sign{position:absolute;top:6px;left:8px;width:auto !important;height:auto !important;min-height:0 !important;padding:3px 8px !important;background:rgba(12,9,6,.92);border:1px solid #ffb000;color:#ffe27a;font:bold 10px monospace !important;cursor:pointer;box-shadow:0 0 10px rgba(255,176,0,.45);z-index:5}"
      + ".cs-train-track .train-sign:hover:not(.disabled){background:#382208;color:#fff;box-shadow:0 0 16px rgba(255,176,0,.85)}"
      + ".cs-train-track .train-sign.disabled{opacity:.48;cursor:not-allowed;box-shadow:none}"
      + ".fx-equip-tab .csd-corner-bar,.fx-panel.fx-hero .csd-corner-bar{position:absolute;right:12px;bottom:12px;z-index:30;display:flex;gap:5px;align-items:center}"
      + ".fx-equip-tab .csd-corner-btn,.fx-panel.fx-hero .csd-corner-btn{width:auto !important;height:auto !important;min-height:0 !important;padding:5px 10px !important;font-size:11px !important;line-height:1.2 !important}"
      + ".fx-equip-tab .csd-corner-mini,.fx-panel.fx-hero .csd-corner-mini{width:auto !important;height:auto !important;min-height:0 !important;padding:5px 8px !important;font-size:11px !important;line-height:1.2 !important}"
      + ".cs-gold-crate-wrap{display:flex;flex-direction:column;align-items:stretch;gap:3px}"
      + ".cs-gold-crate{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:5px 7px;background:linear-gradient(180deg,#9c6b14 0%,#4a2e05 100%);border:2px solid #ffe066;border-radius:3px;box-shadow:0 0 26px rgba(255,210,60,.9),inset 0 0 12px rgba(255,235,130,.65),0 4px 10px #000;cursor:pointer;transition:transform .12s,box-shadow .15s}"
      + ".cs-gold-crate::before,.cs-gold-crate::after{content:'';position:absolute;width:5px;height:5px;background:#ffe98a;box-shadow:0 0 6px #ffb000}"
      + ".cs-gold-crate::before{top:2px;left:2px}.cs-gold-crate::after{top:2px;right:2px}"
      + ".cs-gold-crate:hover:not(:disabled){transform:translateY(-1px) scale(1.03);box-shadow:0 0 30px rgba(255,210,70,.95),inset 0 0 14px rgba(255,230,120,.7)}"
      + ".cs-gold-crate:active:not(:disabled){transform:scale(.96)}"
      + ".cs-gold-crate:disabled{filter:grayscale(.85) brightness(.55);cursor:not-allowed;box-shadow:0 2px 8px #000}"
      + ".cs-crate-icon{font-size:22px;line-height:1;filter:drop-shadow(0 0 8px rgba(255,200,50,.9))}"
      + ".cs-digital-lcd{width:100%;padding:2px 4px;background:#070c08;border:1px solid #3c543e;color:#4dff7c;font:bold 9.5px/1.1 monospace;letter-spacing:.6px;text-align:center;text-shadow:0 0 6px rgba(77,255,124,.85);box-shadow:inset 0 0 6px rgba(0,0,0,.95)}"
      + ".cs-digital-lcd.amber{color:#ffc83d;border-color:#5e4618;text-shadow:0 0 6px rgba(255,200,61,.85)}"
      + ".cs-crate-sub{font:bold 8px monospace;color:#ffe699;letter-spacing:.4px;text-transform:uppercase}"
      + ".cs-crate-multi{display:flex;gap:3px}"
      + ".cs-crate-multi button{flex:1;padding:2px 3px;background:#120d05;border:1px solid #d99b26;color:#ffd97d;font:bold 8.5px monospace;cursor:pointer;box-shadow:0 2px 6px #000}"
      + ".cs-crate-multi button:hover:not(:disabled){background:#3d2608;color:#fff;border-color:#ffe07d}"
      + ".cs-crate-multi button:disabled{opacity:.38;cursor:not-allowed}"
      + ".cs-set-bar{display:flex;flex-wrap:wrap;justify-content:center;gap:4px;align-items:center;padding:2px 6px;background:rgba(12,9,6,.68);border:1px solid rgba(232,168,48,.35);font:9.5px monospace;text-align:center}"
      + ".cs-set-pill{padding:1px 6px;border:1px solid var(--sc,#e8a830);background:rgba(0,0,0,.65);color:var(--sc,#fff)}"
      + ".cs-eq-slot{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:3px;background:rgba(10,8,6,.72);border:1px solid var(--rc,#5c4b32);border-radius:3px;box-shadow:inset 0 0 10px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.85);text-align:center;cursor:pointer;transition:transform .12s,box-shadow .15s}"
      + ".cs-eq-slot:hover{transform:scale(1.06)}"
      + ".cs-eq-slot.filled{border-color:var(--rc,#e8a830);box-shadow:inset 0 0 12px color-mix(in srgb,var(--rc,#e8a830) 32%,transparent),0 0 10px color-mix(in srgb,var(--rc,#e8a830) 55%,transparent)}"
      + ".cs-eq-ico{font-size:clamp(14px,1.9vw,22px);line-height:1;filter:drop-shadow(0 2px 3px #000)}"
      + ".cs-eq-badge{padding:0 3px;background:rgba(10,8,6,.88);border:1px solid var(--rc,#5a4b32);font:bold 7.5px/1.2 monospace;color:var(--rc,#b9a88c);text-transform:uppercase;max-width:96%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".cs-inv-dock{display:flex;flex-direction:column;justify-content:space-between;gap:3px;padding:4px 6px;background:rgba(12,11,10,.78);border:none;overflow:hidden}"
      + ".cs-inv-head{display:flex;justify-content:space-between;align-items:center;gap:4px;font:bold 9.5px monospace;color:#ffd77a}"
      + ".cs-inv-filters{display:flex;gap:2px}"
      + ".cs-inv-filters button{padding:1px 5px;font:bold 9px monospace;background:rgba(0,0,0,.7);border:1px solid #4d3f28;color:#b8a684;cursor:pointer}"
      + ".cs-inv-filters button.on{border-color:#ffb000;color:#ffd77a;background:#2e1f0a}"
      + ".cs-inv-strip{display:flex;gap:5px;overflow-x:auto;align-items:stretch;flex:1;min-height:0;scrollbar-width:thin;scrollbar-color:#e8a830 #0b0e12}"
      + ".cs-inv-item{flex:0 0 98px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:3px 4px;background:linear-gradient(180deg,rgba(28,23,18,.94) 0%,rgba(14,11,9,.96) 100%);border:1px solid var(--rc,#5c4c34);color:#f2eadc;font:9px monospace;text-align:center}"
      + ".cs-inv-item.equipped{outline:1px solid #ffd24d;box-shadow:inset 0 0 8px rgba(255,210,77,.35)}"
      + ".cs-inv-item.fusable{box-shadow:0 0 8px rgba(155,225,93,.6)}"
      + ".cs-inv-ico{font-size:15px;line-height:1}.cs-inv-name{font-weight:bold;font-size:8.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}"
      + ".cs-inv-acts{display:flex;gap:2px;width:100%}"
      + ".cs-inv-acts button{flex:1;padding:1px 2px;font:bold 8.5px monospace;background:#211a12;border:1px solid #5c4b32;color:#f5e6c8;cursor:pointer}"
      + ".cs-inv-acts button:hover{border-color:#ffb000;color:#fff}"
      + ".cs-inv-acts button.fuse-btn{border-color:#9be15d;color:#9be15d}"
      + ".cs-inv-acts button.trans-btn{border-color:#7fd8ff;color:#7fd8ff}"
      + ".cs-gold{align-self:flex-end;width:max-content;padding:3px 8px;color:#ffd77a;background:rgba(26,16,8,.88);border:1px solid #c9953a;font:11px monospace;white-space:nowrap}"
      + "#cs-skills{position:relative;width:100%;aspect-ratio:1408/752;background-size:100% 100%;background-repeat:no-repeat;margin:0 auto;overflow:hidden;user-select:none}"
      + "#cs-skills-fg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;z-index:20}"
      + "#cs-skills .cs-syn-screen{position:absolute !important;z-index:15 !important;display:flex !important;flex-direction:column;justify-content:center;align-items:center;gap:3px;padding:4px 6px;box-sizing:border-box;text-align:center;background:rgba(4,14,18,.85);border:1px solid rgba(79,240,230,.45);border-radius:2px;font:700 clamp(7px,0.7vw,9.5px)/1.3 monospace !important;letter-spacing:.2px;color:#7ffcf4;text-shadow:0 0 6px rgba(79,240,230,.85);overflow:hidden}"
      + "#cs-skills .cs-syn-screen b{display:block;width:100%;font-size:1.08em !important;line-height:1.2 !important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + "#cs-skills .cs-syn-screen span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;width:100%;font-size:0.95em !important;line-height:1.25 !important;overflow:hidden;color:#d8fbff}"
      + "#cs-skills .cs-syn-screen.active{color:#fff;box-shadow:inset 0 0 14px color-mix(in srgb,var(--syn-c,#4ff0e6) 40%,transparent)}"
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
    // Scène 16:9 Bio-Scanner & Labo d'Entraînement (onglet Stats)
    const hero = this.Q(".fx-panel.fx-hero");
    if (hero) {
      const statsBgUrl = typeof assetPath !== "undefined" && assetPath.statsBg ? assetPath.statsBg() : "assets/backgrounds/stats/background.jpeg";
      const stStage = document.createElement("div");
      stStage.id = "cs-stats-stage";
      stStage.style.backgroundImage = `url("${encodeURI(statsBgUrl)}")`;

      const av = hero.querySelector(".fx-avatar");
      if (av) { av.dataset.stItem = "avatar"; stStage.appendChild(av); }

      const acts = hero.querySelector(".fx-hero-actions");
      if (acts) { acts.dataset.stItem = "actions"; stStage.appendChild(acts); }

      const nameRow = hero.querySelector("#fx-name-row"), tagEl = hero.querySelector("#fx-tag");
      const plate = document.createElement("div");
      plate.id = "cs-hero-plate";
      plate.dataset.stItem = "plate";
      if (nameRow) plate.appendChild(nameRow);
      if (tagEl) plate.appendChild(tagEl);
      stStage.appendChild(plate);

      const crt = document.createElement("div");
      crt.id = "cs-stats-crt";
      crt.dataset.stItem = "crt";
      const vitals = hero.querySelector(".fx-vitals"), statsBox = this.Q("#fx-stats");
      const pw = document.createElement("div"); pw.id = "cs-power"; pw.className = "cs-crt-power";
      const gold = document.createElement("span"); gold.id = "cs-stats-gold"; gold.className = "cs-crt-gold"; gold.setAttribute("aria-live", "polite");
      const topRow = document.createElement("div"); topRow.className = "cs-crt-top";
      topRow.appendChild(pw);
      topRow.appendChild(gold);
      crt.appendChild(topRow);
      if (vitals) crt.appendChild(vitals);
      if (statsBox) crt.appendChild(statsBox);
      stStage.appendChild(crt);

      const tb = document.createElement("div");
      tb.id = "cs-train";
      tb.className = "cs-train-track";
      tb.dataset.stItem = "train";
      tb.onclick = e => { e.stopPropagation(); if (!this._statsEditing) this.entrainer(); };
      stStage.appendChild(tb);

      hero.innerHTML = '<div id="fx-gear" hidden></div>';
      hero.appendChild(stStage);
      this.applyStatsLayout();
      this.initStatsDevUI();
    }
    // Console holo-cyan des compétences (décor assets/backgrounds/competence/background.jpeg)
    const sg = this.Q("#fx-sgrid"), pn = document.createElement("div");
    pn.id = "cs-skills";
    const bgUrl = typeof assetPath !== "undefined" && assetPath.competenceBg ? assetPath.competenceBg() : "assets/backgrounds/competence/background.jpeg";
    const fgUrl = typeof assetPath !== "undefined" && assetPath.competenceFg ? assetPath.competenceFg() : "assets/backgrounds/competence/foreground.png";
    pn.style.backgroundImage = `url("${encodeURI(bgUrl)}")`;
    pn.innerHTML = '<div id="cs-synergies" class="cs-syn-screen"></div><div id="cs-slots" class="cs-slots"></div><div class="cs-ctrl-right"><div id="cs-presets" class="cs-pres"></div><button id="cs-unlock" class="fx-btn cs-btn"></button></div><img id="cs-skills-fg" alt="" aria-hidden="true">';
    const fgImg = pn.querySelector("#cs-skills-fg");
    fgImg.onerror = () => { fgImg.style.display = "none"; };
    fgImg.src = encodeURI(fgUrl);
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
      { id: "unlock", x: 45.2,  y: 88.2,  size: 22.0, angle: 0 }
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
          if (s.id === "unlock" && s.size < 8) return;
          if (s.id === "syn" && s.size > 30) return;
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
    const w = (stage && stage.clientWidth) || 800;
    el.style.position = "absolute";
    el.style.left = pos.x + "%";
    el.style.top = pos.y + "%";
    el.style.transform = `translate(-50%,-50%) rotate(${pos.angle || 0}deg)`;
    if (pos.id === "syn") {
      el.style.width = pos.size + "%";
      el.style.height = (pos.size * 0.68) + "%";
      el.style.removeProperty("font-size");
    } else if (pos.id.startsWith("pre_")) {
      el.style.width = pos.size + "%";
      el.style.height = "auto";
      el.style.fontSize = Math.max(8, w * pos.size * 0.0014) + "px";
    } else if (pos.id === "unlock") {
      el.style.width = pos.size + "%";
      el.style.height = "auto";
      el.style.fontSize = Math.max(10, w * pos.size * 0.0052) + "px";
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
  },
  EQUIP_LAYOUT_KEY: "arene_equip_dev_layout_v1",
  _equipEditing: false,
  _equipPositions: null,
  defaultEquipPositions(){
    return [
      { id: "cargo",   x: 50.0, y: 38.8, size: 13.5, angle: 0 },
      { id: "sets",    x: 50.0, y: 69.2, size: 42.0, angle: 0 },
      { id: "slot_0",  x: 16.3, y: 37.4, size: 7.5,  angle: 0 },
      { id: "slot_1",  x: 16.3, y: 52.2, size: 7.5,  angle: 0 },
      { id: "slot_2",  x: 16.3, y: 67.0, size: 7.5,  angle: 0 },
      { id: "slot_3",  x: 91.9, y: 47.2, size: 7.5,  angle: 0 },
      { id: "slot_4",  x: 91.9, y: 62.0, size: 7.5,  angle: 0 },
      { id: "slot_5",  x: 91.9, y: 76.8, size: 7.5,  angle: 0 },
      { id: "inv",     x: 50.0, y: 86.2, size: 43.5, angle: 0 }
    ];
  },
  getEquipPositions(){
    if (this._equipPositions) return this._equipPositions;
    const def = this.defaultEquipPositions();
    try {
      const saved = JSON.parse(localStorage.getItem(this.EQUIP_LAYOUT_KEY) || "null");
      if (Array.isArray(saved)) {
        saved.forEach(s => {
          const t = def.find(d => d.id === s.id);
          if (t && Number.isFinite(s.x) && Number.isFinite(s.y)) Object.assign(t, s);
        });
      }
    } catch (_) {}
    this._equipPositions = def;
    return def;
  },
  saveEquipPositions(){
    if (!this._equipPositions) return;
    const clean = this._equipPositions.map(({ id, x, y, size, angle }) => ({
      id, x: +x.toFixed(2), y: +y.toFixed(2), size: +size.toFixed(1), angle: +(angle || 0).toFixed(1)
    }));
    try { localStorage.setItem(this.EQUIP_LAYOUT_KEY, JSON.stringify(clean)); } catch (_) {}
    console.log("EQUIP_LAYOUT =", JSON.stringify(clean));
  },
  applyEquipItemPos(el, pos, stage){
    const w = stage ? stage.clientWidth : 800;
    el.style.position = "absolute";
    el.style.left = pos.x + "%";
    el.style.top = pos.y + "%";
    el.style.transform = `translate(-50%,-50%) rotate(${pos.angle || 0}deg)`;
    if (pos.id === "inv") {
      el.style.width = pos.size + "%";
      el.style.height = "19.5%";
    } else if (pos.id === "sets" || pos.id === "cargo") {
      el.style.width = pos.size + "%";
      el.style.height = "auto";
    } else {
      el.style.width = pos.size + "%";
      el.style.aspectRatio = "1 / 1";
      el.style.fontSize = Math.max(9, w * pos.size * 0.012) + "px";
    }
  },
  applyEquipLayout(){
    const stage = this.Q("#cs-equip-stage"); if (!stage) return;
    const list = this.getEquipPositions();
    stage.querySelectorAll("[data-eq-item]").forEach(el => {
      const pos = list.find(p => p.id === el.dataset.eqItem);
      if (pos) this.applyEquipItemPos(el, pos, stage);
    });
  },
  initEquipDevUI(){
    const stage = this.Q("#cs-equip-stage"); if (!stage) return;
    const host = stage.closest(".fx-equip-tab") || stage;
    const isDev = () => !!document.getElementById("devbox") || !!GameState.illimite || /[?&]dev\b/.test(location.search);
    const setEdit = on => {
      this._equipEditing = on;
      const curStage = this.Q("#cs-equip-stage");
      if (curStage) curStage.classList.toggle("is-editing", on);
      const btn = host.querySelector("#eqd-edit");
      if (btn) btn.textContent = on ? "Terminer le placement" : "ÉDITER L'ATELIER";
    };

    if (!host.querySelector("#eqd-corner-bar")) {
      const bar = document.createElement("div");
      bar.id = "eqd-corner-bar";
      bar.className = "csd-corner-bar";
      bar.innerHTML = `<button type="button" id="eqd-copy" class="fx-btn csd-corner-mini" title="Copier JSON">📋</button>`
        + `<button type="button" id="eqd-reset" class="fx-btn csd-corner-mini" title="Réinitialiser">↺</button>`
        + `<button type="button" id="eqd-edit" class="fx-btn csd-corner-btn">ÉDITER L'ATELIER</button>`;
      host.appendChild(bar);

      const syncVis = () => {
        const on = isDev();
        bar.style.display = on ? "flex" : "none";
        if (!on && this._equipEditing) setEdit(false);
      };
      syncVis();
      this._syncEquipDev = syncVis;
      new MutationObserver(syncVis).observe(document.body, { childList: true });

      bar.querySelector("#eqd-edit").onclick = e => {
        e.stopPropagation();
        setEdit(!this._equipEditing);
        if (!this._equipEditing && typeof toast === "function") toast("Placement de l'atelier enregistré !");
      };
      bar.querySelector("#eqd-copy").onclick = e => {
        e.stopPropagation();
        const clean = this.getEquipPositions().map(({ id, x, y, size, angle }) => ({
          id, x: +x.toFixed(2), y: +y.toFixed(2), size: +size.toFixed(1), angle: +(angle || 0).toFixed(1)
        }));
        if (navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(clean));
        if (typeof toast === "function") toast("Coordonnées atelier copiées !");
      };
      bar.querySelector("#eqd-reset").onclick = e => {
        e.stopPropagation();
        try { localStorage.removeItem(this.EQUIP_LAYOUT_KEY); } catch (_) {}
        this._equipPositions = null;
        this.applyEquipLayout();
        if (typeof toast === "function") toast("Positions par défaut restaurées.");
      };
    }

    stage.classList.toggle("is-editing", this._equipEditing);
    if (stage.dataset.devBound) return;
    stage.dataset.devBound = "1";
    let drag = null;

    stage.addEventListener("pointerdown", ev => {
      if (!this._equipEditing) return;
      const el = ev.target.closest("[data-eq-item]"); if (!el) return;
      ev.preventDefault(); ev.stopPropagation();
      const pos = this.getEquipPositions().find(p => p.id === el.dataset.eqItem); if (!pos) return;
      drag = { el, pos, pointerId: ev.pointerId };
      try { el.setPointerCapture(ev.pointerId); } catch (_) {}
    }, true);
    stage.addEventListener("pointermove", ev => {
      if (!drag || ev.pointerId !== drag.pointerId) return;
      const rect = stage.getBoundingClientRect();
      drag.pos.x = Math.max(2, Math.min(98, ((ev.clientX - rect.left) / rect.width) * 100));
      drag.pos.y = Math.max(2, Math.min(98, ((ev.clientY - rect.top) / rect.height) * 100));
      this.applyEquipItemPos(drag.el, drag.pos, stage);
    }, true);
    const endDrag = ev => {
      if (!drag || ev.pointerId !== drag.pointerId) return;
      drag = null;
      this.saveEquipPositions();
    };
    stage.addEventListener("pointerup", endDrag, true);
    stage.addEventListener("pointercancel", endDrag, true);
    stage.addEventListener("click", ev => {
      if (!this._equipEditing || !ev.target.closest("[data-eq-item]")) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
    }, true);
    stage.addEventListener("wheel", ev => {
      if (!this._equipEditing) return;
      const el = ev.target.closest("[data-eq-item]"); if (!el) return;
      ev.preventDefault(); ev.stopPropagation();
      const pos = this.getEquipPositions().find(p => p.id === el.dataset.eqItem); if (!pos) return;
      const d = ev.deltaY || ev.deltaX;
      if (ev.shiftKey) pos.angle = (pos.angle || 0) + (d < 0 ? 5 : -5);
      else pos.size = Math.max(4, Math.min(98, (pos.size || 15) + (d < 0 ? 1.0 : -1.0)));
      this.applyEquipItemPos(el, pos, stage);
      this.saveEquipPositions();
    }, { passive: false, capture: true });

    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => this.applyEquipLayout()).observe(stage);
    }
  },
  STATS_LAYOUT_KEY: "arene_stats_dev_layout_v1",
  _statsEditing: false,
  _statsPositions: null,
  defaultStatsPositions(){
    return [
      { id: "avatar",  x: 27.2, y: 54.0, size: 22.0, angle: 0 },
      { id: "plate",   x: 27.2, y: 23.8, size: 23.0, angle: 0 },
      { id: "actions", x: 93.5, y: 6.0,  size: 10.0, angle: 0 },
      { id: "crt",     x: 72.8, y: 31.2, size: 33.8, angle: 0 },
      { id: "train",   x: 72.8, y: 74.2, size: 42.2, angle: 0 }
    ];
  },
  getStatsPositions(){
    if (this._statsPositions) return this._statsPositions;
    const def = this.defaultStatsPositions();
    try {
      const saved = JSON.parse(localStorage.getItem(this.STATS_LAYOUT_KEY) || "null");
      if (Array.isArray(saved)) {
        saved.forEach(s => {
          const t = def.find(d => d.id === s.id);
          if (t && Number.isFinite(s.x) && Number.isFinite(s.y)) Object.assign(t, s);
        });
      }
    } catch (_) {}
    this._statsPositions = def;
    return def;
  },
  saveStatsPositions(){
    if (!this._statsPositions) return;
    const clean = this._statsPositions.map(({ id, x, y, size, angle }) => ({
      id, x: +x.toFixed(2), y: +y.toFixed(2), size: +size.toFixed(1), angle: +(angle || 0).toFixed(1)
    }));
    try { localStorage.setItem(this.STATS_LAYOUT_KEY, JSON.stringify(clean)); } catch (_) {}
    console.log("STATS_LAYOUT =", JSON.stringify(clean));
  },
  applyStatsItemPos(el, pos, stage){
    const w = (stage && stage.clientWidth) || 800;
    el.style.position = "absolute";
    el.style.left = pos.x + "%";
    el.style.top = pos.y + "%";
    el.style.transform = `translate(-50%,-50%) rotate(${pos.angle || 0}deg)`;
    if (pos.id === "avatar") {
      el.style.width = pos.size + "%";
      el.style.aspectRatio = "1 / 1";
      el.style.height = "auto";
    } else if (pos.id === "plate") {
      el.style.width = pos.size + "%";
      el.style.height = "auto";
    } else if (pos.id === "crt") {
      el.style.width = pos.size + "%";
      el.style.height = (pos.size * 0.94) + "%";
    } else if (pos.id === "train") {
      el.style.width = pos.size + "%";
      el.style.height = (pos.size * 0.34) + "%";
    } else {
      el.style.width = "auto";
      el.style.height = "auto";
    }
  },
  applyStatsLayout(){
    const stage = this.Q("#cs-stats-stage"); if (!stage) return;
    const list = this.getStatsPositions();
    stage.querySelectorAll("[data-st-item]").forEach(el => {
      const pos = list.find(p => p.id === el.dataset.stItem);
      if (pos) this.applyStatsItemPos(el, pos, stage);
    });
  },
  initStatsDevUI(){
    const stage = this.Q("#cs-stats-stage"); if (!stage) return;
    const host = stage.closest(".fx-panel.fx-hero") || stage;
    const isDev = () => !!document.getElementById("devbox") || !!GameState.illimite || /[?&]dev\b/.test(location.search);
    const setEdit = on => {
      this._statsEditing = on;
      stage.classList.toggle("is-editing", on);
      const btn = host.querySelector("#std-edit");
      if (btn) btn.textContent = on ? "Terminer le placement" : "ÉDITER LES STATS";
    };

    if (!host.querySelector("#std-corner-bar")) {
      const bar = document.createElement("div");
      bar.id = "std-corner-bar";
      bar.className = "csd-corner-bar";
      bar.innerHTML = `<button type="button" id="std-copy" class="fx-btn csd-corner-mini" title="Copier JSON">📋</button>`
        + `<button type="button" id="std-reset" class="fx-btn csd-corner-mini" title="Réinitialiser">↺</button>`
        + `<button type="button" id="std-edit" class="fx-btn csd-corner-btn">ÉDITER LES STATS</button>`;
      host.appendChild(bar);

      const syncVis = () => {
        const on = isDev();
        bar.style.display = on ? "flex" : "none";
        if (!on && this._statsEditing) setEdit(false);
      };
      syncVis();
      this._syncStatsDev = syncVis;
      new MutationObserver(syncVis).observe(document.body, { childList: true, subtree: true });

      bar.querySelector("#std-edit").onclick = e => {
        e.stopPropagation();
        setEdit(!this._statsEditing);
        if (!this._statsEditing && typeof toast === "function") toast("Placement des stats enregistré !");
      };
      bar.querySelector("#std-copy").onclick = e => {
        e.stopPropagation();
        const clean = this.getStatsPositions().map(({ id, x, y, size, angle }) => ({
          id, x: +x.toFixed(2), y: +y.toFixed(2), size: +size.toFixed(1), angle: +(angle || 0).toFixed(1)
        }));
        if (navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(clean));
        if (typeof toast === "function") toast("Coordonnées stats copiées !");
      };
      bar.querySelector("#std-reset").onclick = e => {
        e.stopPropagation();
        try { localStorage.removeItem(this.STATS_LAYOUT_KEY); } catch (_) {}
        this._statsPositions = null;
        this.applyStatsLayout();
        if (typeof toast === "function") toast("Positions par défaut restaurées.");
      };
    }

    if (stage.dataset.devBound) return;
    stage.dataset.devBound = "1";
    let drag = null;

    stage.addEventListener("pointerdown", ev => {
      if (!this._statsEditing) return;
      const el = ev.target.closest("[data-st-item]"); if (!el) return;
      ev.preventDefault(); ev.stopPropagation();
      const pos = this.getStatsPositions().find(p => p.id === el.dataset.stItem); if (!pos) return;
      drag = { el, pos, pointerId: ev.pointerId };
      try { el.setPointerCapture(ev.pointerId); } catch (_) {}
    }, true);
    stage.addEventListener("pointermove", ev => {
      if (!drag || ev.pointerId !== drag.pointerId) return;
      const rect = stage.getBoundingClientRect();
      drag.pos.x = Math.max(2, Math.min(98, ((ev.clientX - rect.left) / rect.width) * 100));
      drag.pos.y = Math.max(2, Math.min(98, ((ev.clientY - rect.top) / rect.height) * 100));
      this.applyStatsItemPos(drag.el, drag.pos, stage);
    }, true);
    const endDrag = ev => {
      if (!drag || ev.pointerId !== drag.pointerId) return;
      drag = null;
      this.saveStatsPositions();
    };
    stage.addEventListener("pointerup", endDrag, true);
    stage.addEventListener("pointercancel", endDrag, true);
    stage.addEventListener("click", ev => {
      if (!this._statsEditing || !ev.target.closest("[data-st-item]")) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
    }, true);
    stage.addEventListener("wheel", ev => {
      if (!this._statsEditing) return;
      const el = ev.target.closest("[data-st-item]"); if (!el) return;
      ev.preventDefault(); ev.stopPropagation();
      const pos = this.getStatsPositions().find(p => p.id === el.dataset.stItem); if (!pos) return;
      const d = ev.deltaY || ev.deltaX;
      if (ev.shiftKey) pos.angle = (pos.angle || 0) + (d < 0 ? 5 : -5);
      else pos.size = Math.max(6, Math.min(95, (pos.size || 20) + (d < 0 ? 1.0 : -1.0)));
      this.applyStatsItemPos(el, pos, stage);
      this.saveStatsPositions();
    }, { passive: false, capture: true });

    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => this.applyStatsLayout()).observe(stage);
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
