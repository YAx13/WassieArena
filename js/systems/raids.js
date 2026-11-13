"use strict";
/* =====================================================================
   raids.js : Expéditions de Boss (Armes / Parchemins / Familier) + Boss Mondial
   Ordre de chargement : state.js, combat.js, raids.js, puis le script principal.
   Le panneau #rd-panel, son CSS (.rd-*) et le routage OV.reg.boss* vivent dans le HTML principal.
   Dépend à l'exécution de : $, S, FX, Combat, DataEngine, GameState, toast, lancerCombat,
   donnerRecompense, depenserRessource, calculerPuissance.
   ===================================================================== */
const Raids = {
  PALIERS: GameState.PALIERS,
  NIV_MIN: 1, NIV_MAX: 50,                              // niveau recommandé : palier 1 → Niv. 1, dernier palier → Niv. 50
  EXPE: {
    armes:      { nom: "Boss des Armes",      fond: assetPath.bossRoom("weapon", 1), fondSecours: "#0f172a", drop: "100 % d’équipement",
                  boss: { id: "boss_armes",      nom: "Gardien de l’Arsenal", hue: 210, forme: "boss", scale: 1.35, pvMult: 1.6,
                    png: assetPath.bossSheet("weapon", 1), animationSet: "weaponBoss",
                    previewAnimations: ["idle"],
                  portraitBounds: { x: 38, y: 18, w: 136, h: 122 } } },
    parchemins: { nom: "Boss des Parchemins", fond: assetPath.bossRoom("paper", 1), fondSecours: "#2e1065", drop: "Parchemins de compétence",
                  boss: { id: "boss_parchemins", nom: "Archiviste Corrompu",    hue: 270, forme: "boss", scale: 1.35, pvMult: 1.6,
                    png: assetPath.bossSheet("paper", 1), animationSet: "paperBoss",
                    previewAnimations: ["idle"],
                    portraitBounds: { x: 38, y: 18, w: 136, h: 122 } } },
    familier:   { nom: "Boss du Familier",    fond: assetPath.bossRoom("pet", 1), fondSecours: "#064e3b", drop: "100 % Nourriture + 2 à 10 % de Pierre de Transmutation",
                  boss: { id: "boss_familier",   nom: "Maître des Meutes",      hue: 150, forme: "boss", scale: 1.35, pvMult: 1.6,
                    png: assetPath.bossSheet("pet", 1), animationSet: "petBoss",
                    previewAnimations: ["idle"],
                    portraitBounds: { x: 38, y: 18, w: 136, h: 122 } } }
  },
  sel: { armes: 1, parchemins: 1, familier: 1 },       // palier choisi (non sauvegardé)

  /* Boss Mondial : 2 clés / jour (reset dans GameState.verifierReset), rotation tous les 3 jours, fermé le dimanche */
  MONDIAL_FOND: "#450a0a",
  MONDIAL_DECOR: assetPath.bossRoom("world", 1),
  MONDIAL: [
    { id: "monde_titan", nom: "Titan de Rouille", hue: 15,  forme: "boss", scale: 1.6, png: assetPath.bossSheet("world", 1), animationSet: "worldBoss", previewAnimations: ["idle"] },
    { id: "monde_wasse", nom: "Wass-E Prime",     hue: 190, forme: "boss", scale: 1.6, png: assetPath.bossSheet("world", 1), animationSet: "worldBoss", previewAnimations: ["idle"] },
    { id: "monde_hydre", nom: "Hydre Néon",       hue: 300, forme: "boss", scale: 1.6, png: assetPath.bossSheet("world", 1), animationSet: "worldBoss", previewAnimations: ["idle"] }
  ],
  BOTS: ["Vex_Ratchet", "Kasumi-9", "Dr.Boulon", "N30N_Wolf", "Tuyau_Man", "Zorg le Bref", "Mamie_Molotov", "Cable_Queen", "Rouille42", "Pioupiou_X"],
  draftBusy: false,
  leaderboardTimer: null,

  /* ================= EXPÉDITIONS ================= */
  palierMax(mode){ return Math.min(this.PALIERS, GameState.boss[mode] + 1); },
  mur(p){ return p % 5 === 0; },                                                      // murs : paliers 5, 10, 15, 20
  niveauReco(p){ return Math.round(this.NIV_MIN + (p - 1) * (this.NIV_MAX - this.NIV_MIN) / (this.PALIERS - 1)); },
  statsPalier(p){                                                                     // points de stats des PNJ
    const ptsBase = Math.round(18 * Math.pow(1.16, p - 1));
    return { ptsBase, sbires: .55 * ptsBase, boss: 1.15 * ptsBase * (this.mur(p) ? 1.35 : 1) };
  },
  bossPalier(mode, p){
    const s = this.statsPalier(p), rar = Math.min(4, Math.floor((p - 1) / 4));
    const equipement = DataEngine.PARTS.map(pt => ({ part: pt.id, rarity: rar, rarite: rar }));
    return Object.assign({}, this.EXPE[mode].boss, { pvMult: this.mur(p) ? 2.0 : 1.6, palier: p, niveau: this.niveauReco(p),
      points: s.boss, stats: s.boss, equipement, equipment: equipement });
  },
  /* Puissance recommandée : les points du boss sont répartis sur 4 stats (supprimer le /4 si le combat les applique par stat) */
  puissanceReco(mode, p){
    const b = this.bossPalier(mode, p), q = b.points / 4;
    return calculerPuissance({ stats: { hp: q, str: q, agi: q, spd: q }, gear: b.equipement, weapons: [], skills: [] });
  },
  lancerExpe(mode){
    const c = this.EXPE[mode], p = this.sel[mode]; if (!S.cur || Combat.act) return;
    if (p > this.palierMax(mode)) { toast("Palier verrouillé : gagnez le palier précédent."); return; }
    if (!depenserRessource("energie", 1)) { toast("Énergie insuffisante (1 ⚡ requise)."); return; }
    const s = this.statsPalier(p);
    lancerCombat({ mode: "vagues", raid: true, cleanUI: true, fond: c.fond, fondSecours: c.fondSecours, boss: this.bossPalier(mode, p), palier: p,
      ptsSbires: s.sbires, statsSbires: s.sbires, ptsBoss: s.boss, statsBoss: s.boss,
      onFin: r => this.finExpe(mode, p, r) });
    this.updateExpeEndActions(mode, p, false);
    Combat.lg("Expédition : " + c.nom + " — palier " + p + "/" + this.PALIERS + (this.mur(p) ? " (MUR)" : "") + ".");
  },
  finExpe(mode, p, r){
    const D = DataEngine, GS = GameState; let txt, premiereVictoire = false;
    if (r.victoire) {
      premiereVictoire = (GS.boss[mode] || 0) < p;
      GS.validerPalier(mode, p);
      const xp = 80 * p, lv = donnerRecompense("xp", xp).niveaux; let drop;
      if (mode === "armes") {
        const rar = Math.max(0, Math.min(5, Math.round((p - 1) * .4) + D.pick([-1, 0, 0, 1])));
        const g = donnerRecompense("equipement", 1, { rarite: rar })[0], pt = D.PARTS.find(x => x.id === g.part);
        drop = pt.icon + " " + pt.name + " " + D.RARITIES[g.rarity].name;
      } else if (mode === "parchemins") {
        const n = D.rnd(1, 2) + Math.floor(p / 2); donnerRecompense("parchemins", n); drop = "📜 ×" + n + " Parchemin" + (n > 1 ? "s" : "");
      } else {
        const n = D.rnd(2, 4) + p; donnerRecompense("nourriture", n); drop = "🍖 ×" + n + " Nourriture";
        if (Math.random() < .02 + .08 * (p - 1) / (this.PALIERS - 1)) { donnerRecompense("pierres", 1); drop += " + 💎 Pierre de Transmutation !"; }
      }
      txt = "VICTOIRE palier " + p + " : +" + xp + " XP" + (lv ? " (+" + lv + " niveau" + (lv > 1 ? "x" : "") + ")" : "") + " · " + drop
        + (premiereVictoire && p < this.PALIERS ? " · palier " + (p + 1) + " débloqué !" : "");
    } else {
      const xp = r.ennemisVaincus * 15 * p;
      if (xp > 0) donnerRecompense("xp", xp);
      txt = "Défaite (vague " + Math.min(3, r.vaguesCompletes + 1) + "/3) : " + r.ennemisVaincus + " sbire(s) tué(s) → +" + xp + " XP.";
    }
    $("#end-rewards").textContent = txt;
    Combat.lg("Expédition : " + txt, r.victoire ? "win" : "");
    this.rendre();
    this.updateExpeEndActions(mode, p, premiereVictoire);
  },

  /* ================= BOSS MONDIAL ================= */
  dayNum(){ const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); },   // jour local
  ouvert(){ return new Date().getDay() !== 0; },                                                                  // fermé le dimanche
  rotation(){ return Math.floor(this.dayNum() / 3); },                                                            // change tous les 3 jours
  bossMondial(){ return this.MONDIAL[this.rotation() % this.MONDIAL.length]; },
  joursAvantRotation(){ return 3 - (this.dayNum() % 3); },
  monde(){                                                                                                        // clés (minuit) gérées par GameState ; ici : record par rotation
    GameState.verifierReset();
    const m = GameState.monde, r = this.rotation();
    if (m.rotation !== r) { m.rotation = r; m.record = 0; GameState.save(); }
    return m;
  },
  classement(){
    let s = (this.rotation() * 7919 + 13) >>> 0;                                                                  // PRNG stable par rotation
    const rng = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    return this.BOTS.map((nom, k) => ({ nom, score: Math.round(9000 * Math.pow(.62, k) * (.9 + rng() * .2)), bot: true }))
      .concat({ nom: S.cur.name, score: this.monde().record, bot: false }).sort((a, b) => b.score - a.score);
  },
  tirer(n, exclu){                                                                                                // n compétences au hasard hors « exclu »
    const a = DataEngine.SKILLS.map(s => s.id).filter(id => !exclu.includes(id));
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n);
  },
  carte(titre, ids, ov, cancellable=true){                                                                        // 3 cartes ; renvoie l'id choisi (null = annulé)
    const D = DataEngine;
    return new Promise(res => {
      ov.innerHTML = `<div class="rd-dbox"><div class="rd-dt">${titre}</div><div class="rd-cards">` + ids.map(id => { const s = D.SKILLS[id];
        return `<button class="rd-card" data-id="${id}" style="--c:${D.EL_COL[s.el]}"><span class="rd-ci">${D.EL_ICON[s.el]}</span><b>${s.name}</b><small>${D.ELEMENTS[s.el]} · ${FX.TYPE[s.t]}</small><em>${s.desc}</em></button>`; }).join("")
        + `</div>${cancellable ? '<button class="btn rd-cancel">Annuler</button>' : ""}</div>`;
      const fin = v => res(v);
      ov.querySelectorAll(".rd-card").forEach(b => b.onclick = e => { e.stopPropagation(); fin(+b.dataset.id); });
      const cancel = ov.querySelector(".rd-cancel");
      if (cancel) cancel.onclick = e => { e.stopPropagation(); fin(null); };
    });
  },
  async draft(){                                                                                                  // 2 tirages de 3 cartes
    const ov = document.createElement("div"); ov.className = "rd-draft";
    $("#g-combat .arenawrap").appendChild(ov);
    const base = GameState.competencesEquipees.slice();
    let picks = null;
    try {
      const c1 = await this.carte("DRAFT 1/2 : choisissez une compétence", this.tirer(3, base), ov, false);
      if (c1 !== null) {
        const c2 = await this.carte("DRAFT 2/2 : choisissez une 2e compétence", this.tirer(3, base.concat(c1)), ov, false);
        if (c2 !== null) picks = [c1, c2];
      }
      if (picks) {
        ov.classList.add("is-fading");
        await new Promise(resolve => setTimeout(resolve, 320));
      }
      return picks;
    } finally {
      ov.remove();
    }
  },
  async lancerMondial(){
    if (!S.cur || Combat.act || Combat.ready || this.draftBusy) return;
    const m = this.monde();
    if (!this.ouvert()) { toast("Boss Mondial fermé le dimanche."); return; }
    if (m.cles < 1) { toast("Plus de Clé aujourd’hui (retour à minuit)."); return; }
    const fight = { mode: "endurance", fond: this.MONDIAL_DECOR, fondSecours: this.MONDIAL_FOND, boss: this.bossMondial(), puissance: 1.2,
      competencesBonus: [], worldBoss: true, deferStart: true, allowSkip: false, onFin: r => this.finMondial(r) };
    if (!lancerCombat(fight)) return;
    this.draftBusy = true;
    let picks;
    try {
      picks = await this.draft();
    } finally {
      this.draftBusy = false;
    }
    if (!picks) {
      Combat.stop();
      if (OV.stack.includes("combat")) OV.close("combat");
      return;
    }
    const current = this.monde();
    if (!this.ouvert() || current.cles < 1) {
      Combat.stop();
      if (OV.stack.includes("combat")) OV.close("combat");
      toast(!this.ouvert() ? "Boss Mondial fermé le dimanche." : "Plus de Clé aujourd’hui (retour à minuit).");
      return;
    }
    const keysBeforeFight = current.cles;
    current.cles--;
    Combat.cfg.allowSkip = keysBeforeFight === 1;
    GameState.save();
    this.updateWorldBossEndActions();
    if (!Combat.startReady(picks)) throw new Error("Impossible de démarrer le combat du Boss Mondial après le draft.");
    Combat.lg("Draft : " + picks.map(id => DataEngine.SKILLS[id].name).join(" + ") + " (temporaires).");
    this.rendre();
  },
  finMondial(r){
    const m = this.monde(), nouveau = r.degatsTotal > m.record; if (nouveau) m.record = r.degatsTotal; GameState.save();
    const rang = this.classement().findIndex(x => !x.bot) + 1;
    $("#end-title").textContent = "FIN DU BOSS MONDIAL";
    $("#end-rewards").textContent = "Dégâts : " + r.degatsTotal + (nouveau ? " · NOUVEAU RECORD !" : " · record : " + m.record) + " · classement : " + rang + "e/" + (this.BOTS.length + 1);
    Combat.lg("Boss Mondial : " + r.degatsTotal + " dégâts" + (nouveau ? " (nouveau record !)" : "") + ".", nouveau ? "win" : "");
    this.rendre();
    this.updateWorldBossEndActions();
  },
  updateWorldBossEndActions(){
    const button = $("#wb-restart"); if (!button) return;
    const m = this.monde();
    button.textContent = `🔑 Recommencer (${m.cles}/2)`;
    button.disabled = !this.ouvert() || m.cles < 1;
  },
  ouvrirClassement(){
    this.fermerClassement();
    const popup = document.createElement("div");
    popup.className = "wb-leaderboard";
    popup.innerHTML = `<section class="wb-leaderboard-box"><header><b>Classement mondial · ${FX.esc(this.bossMondial().nom)}</b><button type="button" class="btn" aria-label="Fermer">×</button></header><p class="wb-rotation"></p><div class="rd-lb"></div></section>`;
    popup.querySelector(".rd-lb").innerHTML = this.classement().map((entry, i) =>
      `<div class="rd-row ${entry.bot ? "" : "me"}"><span>${i + 1}.</span><span>${FX.esc(entry.nom)}${entry.bot ? "" : " (vous)"}</span><b>${entry.score}</b></div>`).join("");
    popup.querySelector("button").onclick = () => this.fermerClassement();
    $("#g-combat").appendChild(popup);
    const update = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + this.joursAvantRotation()).getTime();
      let secs = Math.max(0, Math.ceil((next - Date.now()) / 1000));
      const days = Math.floor(secs / 86400); secs %= 86400;
      const hours = Math.floor(secs / 3600); secs %= 3600;
      const mins = Math.floor(secs / 60); secs %= 60;
      popup.querySelector(".wb-rotation").textContent = `Prochaine rotation dans ${days} j ${String(hours).padStart(2, "0")} h ${String(mins).padStart(2, "0")} min ${String(secs).padStart(2, "0")} s`;
    };
    update();
    this.leaderboardTimer = setInterval(update, 1000);
  },
  fermerClassement(){
    if (this.leaderboardTimer) clearInterval(this.leaderboardTimer);
    this.leaderboardTimer = null;
    document.querySelector(".wb-leaderboard")?.remove();
  },

  /* ================= INTERFACE (panneau #rd-panel de la pop-up #g-boss ; appelée par OV.reg.boss*.onOpen) ================= */
  ouvrir(mode){
    this.mode = mode;
    if (mode === "mondial") {
      $("#boss-name").textContent = this.bossMondial().nom;
      if ($("#wb-leaderboard")) {
        $("#wb-leaderboard").classList.remove("hidden");
        $("#wb-leaderboard").textContent = "CLASSEMENT MONDIAL";
      }
      $("#wb-restart").onclick = () => this.lancerMondial();
      $("#wb-menu").onclick = () => {
        this.fermerClassement();
        if (OV.stack.includes("combat")) OV.close("combat");
        if (OV.stack.includes("bossMondial")) OV.close("bossMondial");
      };
      $("#wb-leaderboard").onclick = () => this.ouvrirClassement();
      this.updateWorldBossEndActions();
    }
    this.rendre();
  },
  updateExpeEndActions(mode, p, premiereVictoire){
    const btnNext = $("#wb-restart"), btnPaliers = $("#wb-leaderboard"), btnMenu = $("#wb-menu");
    if (!btnNext || !btnMenu) return;
    const energie = GameState.ressources.energie, maxE = GameState.ENERGIE_MAX;
    const peutSuivant = premiereVictoire && p < this.PALIERS;
    const ciblePalier = peutSuivant ? p + 1 : p;

    btnNext.textContent = peutSuivant
      ? `⏭ Palier ${ciblePalier} (1 ⚡ · ${energie}/${maxE})`
      : `🔄 Recommencer Palier ${p} (1 ⚡ · ${energie}/${maxE})`;
    btnNext.disabled = energie < 1;
    btnNext.onclick = e => {
      e.stopPropagation();
      Combat.stop();
      this.sel[mode] = ciblePalier;
      if (typeof BossModes !== "undefined") BossModes.showBoss(mode, ciblePalier);
      this.lancerExpe(mode);
    };

    if (btnPaliers) {
      btnPaliers.classList.remove("hidden");
      btnPaliers.textContent = "CHOIX DU PALIER";
      btnPaliers.onclick = e => {
        e.stopPropagation();
        Combat.stop();
        if (OV.stack.includes("combat")) OV.close("combat");
        this.rendre();
      };
    }

    btnMenu.onclick = e => {
      e.stopPropagation();
      Combat.stop();
      if (OV.stack.includes("combat")) OV.close("combat");
      const ovKey = { armes: "bossArmes", parchemins: "bossParchemins", familier: "bossFamilier" }[mode];
      if (ovKey && OV.stack.includes(ovKey)) OV.close(ovKey);
    };
  },
  rendre(){
    const box = $("#rd-panel"), mode = this.mode; if (!mode || !GameState.brute) return;
    if (mode === "mondial") return this.rendreMondial(box);
    const c = this.EXPE[mode], max = this.palierMax(mode), done = GameState.boss[mode]; if (this.sel[mode] > max) this.sel[mode] = max;
    const previousScroll = box.querySelector(".rd-path")?.scrollTop || 0;
    const p = this.sel[mode], reco = this.puissanceReco(mode, p), moi = calculerPuissance(), ok = moi >= reco, f = n => n.toLocaleString("fr-FR");
    box.innerHTML = `<div class="rd-line">⚡ ${GameState.ressources.energie}/${GameState.ENERGIE_MAX} · coût : 1 Énergie · Butin : ${c.drop}</div>`
      + `<div class="rd-path" role="list" aria-label="Parcours des ${this.PALIERS} paliers">`
      + Array.from({ length: this.PALIERS }, (_, i) => { const q = i + 1, lock = q > max, boss = this.mur(q);
        const status = lock ? "🔒 Verrouillé" : q <= done ? "✔ Vaincu" : "À combattre";
        return `<button class="rd-step ${q === p ? "on" : ""} ${lock ? "lock" : ""} ${boss ? "boss" : ""}" data-p="${q}" role="listitem" aria-pressed="${q === p}" ${lock ? "disabled" : ""}>`
          + `<span class="rd-step-node">${boss ? "♛" : lock ? "🔒" : q <= done ? "✓" : q}</span>`
          + `<span class="rd-step-copy"><b>${boss ? "Boss · " : "Palier "}${q}</b><small>${status}</small></span>`
          + `<span class="rd-step-level">Niv. ${this.niveauReco(q)}</span></button>`; }).join("") + `</div>`
      + `<div class="rd-line rd-pow">Palier ${p}${this.mur(p) ? " 💀 MUR" : ""} · Niv. ${this.niveauReco(p)} recommandé<br>`
      + `Puissance recommandée : <b class="${ok ? "ok" : "bad"}">⚔️ ${f(reco)}</b> · Vous : <b class="${ok ? "ok" : "bad"}">⚔️ ${f(moi)}</b></div>`
      + `<button class="btn big gold" id="rd-go">⚔ Lancer — Palier ${p} (1 ⚡)</button>`
      + `<div class="rd-line rd-sm">Palier ${done}/${this.PALIERS} vaincu${done < this.PALIERS ? " · victoire requise pour débloquer le palier " + (done + 1) : " · tous les paliers terminés !"}</div>`;
    const path = box.querySelector(".rd-path");
    path.scrollTop = previousScroll;
    box.querySelector(".rd-step.on")?.scrollIntoView({ block: "nearest" });
    box.querySelectorAll(".rd-step:not([disabled])").forEach(b => b.onclick = e => {
      e.stopPropagation();
      this.sel[mode] = +b.dataset.p;
      BossModes.showBoss(mode, this.sel[mode]);
      this.rendre();
    });
    box.querySelector("#rd-go").onclick = e => { e.stopPropagation(); this.lancerExpe(mode); };
  },
  rendreMondial(box){
    box.classList.remove("rd-expedition");
    const m = this.monde(), ouvert = this.ouvert(), j = this.joursAvantRotation();
    const lb = this.classement().map((x, k) => `<div class="rd-row ${x.bot ? "" : "me"}"><span>${k + 1}.</span><span>${x.bot ? x.nom : FX.esc(x.nom) + " (vous)"}</span><b>${x.score}</b></div>`).join("");
    box.innerHTML = `<div class="rd-line">🔑 Clés : <b>${m.cles}/2</b> · reset à minuit · rotation du boss dans ${j} jour${j > 1 ? "s" : ""}</div>`
      + (ouvert ? "" : `<div class="rd-line rd-warn">🔒 Boss Mondial fermé le dimanche : retour lundi.</div>`)
      + `<div class="rd-line">PV infinis : infligez un maximum de dégâts avant de tomber. Draft de 2 compétences temporaires avant le combat.</div>`
      + `<button class="btn big gold" id="rd-go" ${ouvert && m.cles > 0 ? "" : "disabled"}>🌍 Draft & Combattre — ${this.bossMondial().nom} (1 🔑)</button>`
      + `<div class="rd-line">🏆 Votre record : <b>${m.record}</b> dégâts</div><div class="rd-lb">${lb}</div>`;
    box.querySelector("#rd-go").onclick = e => { e.stopPropagation(); this.lancerMondial(); };
  }
};
