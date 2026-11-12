"use strict";
/* =====================================================================
   pvp.js : mode PvP (Elo, 5 grades, tickets quotidiens, choix de 3 adversaires, saisons de 48 h)
   À charger AVANT le script principal, APRÈS state.js et combat.js :
     <script src="state.js"></script> <script src="combat.js"></script> <script src="pvp.js"></script> … <script> (principal) </script>
   state.js appelle PvP.init() puis PvP.verifierSaison() au démarrage (GameState.boot).
   Utilise GameState (reputation = Elo, saisonDebut, ticketsPvp, ticketsPvpJour), donnerRecompense(), calculerPuissance()
   et lancerCombat({mode:'triptyque'}).
   Dépend à l'exécution de : S, OV, Combat, DataEngine, genBrute, calculerPuissance, uiDialog, toast.
   Pas de campagne ni de loot direct : le combat PvP est lancé avec recompenses:false (ni XP, ni Or, ni drop) ;
   l'Or de combat est donné ici, via donnerRecompense("or", ...).
   ===================================================================== */
const PvP = {
  SAISON_MS: 48 * 3600 * 1000,       // saison de 48 h réelles
  ELO_DEPART: 1000,                  // Elo d'un joueur sans réputation (et Elo de départ de chaque saison)
  K: 32,                             // facteur K du calcul Elo
  TICKETS_MAX: 5,                    // tickets PvP quotidiens
  OR_VICTOIRE: 25, OR_DEFAITE: 10,   // Or par niveau de la brute
  RECOMPENSE_PIERRE: "pierres_transmutation",   // clé passée à donnerRecompense() (à adapter si ton inventaire utilise un autre nom)
  /* min/max = bornes d'Elo · rar = rareté d'équipement de base des bots (0 Commun … 5 Divin)
     armes / comp = nb d'armes / de compétences des bots · or / caisses / pierres = récompense de fin de saison */
  GRADES: [
    { id: "bronze",  nom: "Bronze",  icone: "🥉", min: 0,    max: 1099,     rar: 0, armes: 0, comp: 1, or: 200,  caisses: 0, pierres: 0 },
    { id: "argent",  nom: "Argent",  icone: "🥈", min: 1100, max: 1299,     rar: 1, armes: 0, comp: 1, or: 500,  caisses: 1, pierres: 0 },
    { id: "or",      nom: "Or",      icone: "🥇", min: 1300, max: 1549,     rar: 2, armes: 1, comp: 2, or: 1000, caisses: 2, pierres: 0 },
    { id: "elite",   nom: "Élite",   icone: "💠", min: 1550, max: 1849,     rar: 3, armes: 2, comp: 2, or: 2000, caisses: 4, pierres: 1 },
    { id: "legende", nom: "Légende", icone: "👑", min: 1850, max: Infinity, rar: 4, armes: 3, comp: 3, or: 4000, caisses: 8, pierres: 1 }
  ],
  /* Les 3 cibles proposées : décalage d'Elo, modificateur de rareté, familier */
  DIFFICULTES: [
    { id: "facile",    nom: "Facile",    icone: "🟢", decal: -150, rar: -1, familier: false },
    { id: "equilibre", nom: "Équilibré", icone: "🟡", decal: 0,    rar: 0,  familier: false, alea: 30 },
    { id: "difficile", nom: "Difficile", icone: "🔴", decal: 150,  rar: 1,  familier: true }
  ],
  _ok: false, _popup: false, _timer: null, _cibles: [], _adv: null,
  Q(s){ return document.querySelector(s); },

  /* ---------- Elo & grades ---------- */
  elo(){ return GameState.reputation > 0 ? GameState.reputation : this.ELO_DEPART; },
  grade(pts = this.elo()){ let g = this.GRADES[0]; this.GRADES.forEach(x => { if (pts >= x.min) g = x; }); return g; },
  niveau(){ const b = GameState.brute; return Math.max(1, (b && (b.niveau || b.level)) || 1); },
  proba(eloJ, eloAdv){ return 1 / (1 + Math.pow(10, (eloAdv - eloJ) / 400)); },     // probabilité de victoire attendue du joueur
  deltaElo(victoire, eloJ, eloAdv){
    const E = this.proba(eloJ, eloAdv);
    return victoire ? Math.max(5, Math.round(this.K * (1 - E))) : -Math.max(5, Math.round(this.K * E));
  },

  /* ---------- Tickets quotidiens (remis à TICKETS_MAX chaque jour local) ---------- */
  tickets(){
    GameState.verifierReset();            // reset quotidien unique (sauvegardé) géré par state.js
    return GameState.ticketsPvp;
  },

  /* ---------- Matchmaking : un bot simulé à un Elo donné ---------- */
  bot(eloAdv, diff){
    const D = DataEngine, g = this.grade(eloAdv), i = this.GRADES.indexOf(g), e = genBrute();
    e.elo = eloAdv;
    e.stats = D.rollStartStats(Math.max(18, Math.round(20 + (eloAdv - 800) * 0.14)));
    e.level = 1 + i * 5 + D.rnd(0, 2);
    e.gear = []; D.PARTS.forEach(p => {
      const r = Math.min(5, g.rar + diff.rar + D.pick([-1, 0, 0]));                 // rareté ≈ grade de l'adversaire, ±1 selon la difficulté
      if (r >= 0) e.gear.push({ part: p.id, rarity: r });
    });
    e.weapons = []; while (e.weapons.length < g.armes) { const id = D.pick(D.WEAPONS).id; if (!e.weapons.includes(id)) e.weapons.push(id); }
    e.skills = D.pickSkills(g.comp);
    if (diff.familier) {                                                             // le bot Difficile arrive avec un familier
      const liste = D.PETS || D.FAMILIERS || D.FAMILIARS;
      e.familier = e.pet = liste && liste.length ? D.pick(liste) : true;
      if (e.familier && e.familier.id) e.petId = e.familier.id;
    } else { e.familier = e.pet = null; e.petId = null; }
    return e;
  },
  tirerCibles(){
    const eloJ = this.elo();
    this._cibles = this.DIFFICULTES.map(d => {
      const elo = Math.max(0, eloJ + d.decal + (d.alea ? DataEngine.rnd(-d.alea, d.alea) : 0));
      const adv = this.bot(elo, d);
      return { diff: d, elo, adv, nom: adv.nom || adv.name || "Adversaire", puissance: calculerPuissance(adv) };
    });
    return this._cibles;
  },

  /* ---------- Combat ---------- */
  lancer(k){
    if (!S.cur || !GameState.brute) return;
    if (Combat.act) return;
    const c = this._cibles[k]; if (!c) return;
    if (this.tickets() <= 0) { toast("🎟️ Plus de ticket PvP aujourd'hui ! Reviens demain."); this.majPanneau(); return; }
    GameState.ticketsPvp--; GameState.save();
    this._adv = c;
    $("#g-combat").classList.remove("pvp-preview");
    lancerCombat({ mode: "triptyque", pvp: true, adversaire: c.adv, recompenses: false, onFin: r => this.fin(r) });    this.majPanneau();
  },
  fin(r){
    const GS = GameState, c = this._adv, eloAvant = this.elo(), g0 = this.grade(eloAvant);
    const eloAdv = c ? c.elo : eloAvant;
    const delta = this.deltaElo(r.victoire, eloAvant, eloAdv);
    GS.reputation = Math.max(0, eloAvant + delta);
    const or = (r.victoire ? this.OR_VICTOIRE : this.OR_DEFAITE) * this.niveau();
    donnerRecompense("or", or);
    GS.save();
    const g1 = this.grade(), d = GS.reputation - eloAvant, i0 = this.GRADES.indexOf(g0), i1 = this.GRADES.indexOf(g1);
    const txt = (d >= 0 ? "+" : "−") + Math.abs(d) + " Elo · " + GS.reputation + " · " + g1.icone + " " + g1.nom
      + (i1 > i0 ? " — PROMOTION !" : i1 < i0 ? " — rétrogradation" : "") + " · +" + or + " Or";
    const el = this.Q("#end-rewards"); if (el) el.textContent = txt;
    Combat.lg("Elo : " + txt, r.victoire ? "win" : "");
    this._adv = null;
    this.majPanneau();
  },
  async ouvrir(){                                   // appelée à l'ouverture de la bulle PvP : affiche le choix des 3 cibles
    this.tickets();
    if (!this._cibles.length) this.tirerCibles();
    this.majPanneau();
    await this.verifierSaison();
    if (!OV.stack.includes("pvp")) return;           // fermé pendant la pop-up
    this.majPanneau();
  },

  /* ---------- Saisons de 48 h (GameState.saisonDebut, sauvegardé) ---------- */
  restant(){ return Math.max(0, GameState.saisonDebut + this.SAISON_MS - Date.now()); },
  async verifierSaison(){
    const GS = GameState; if (!GS.brute || this._popup) return false;
    const ecoule = Date.now() - GS.saisonDebut; if (ecoule < this.SAISON_MS) return false;
    this._popup = true;
    const g = this.grade(), pts = this.elo();
    GS.saisonDebut += Math.floor(ecoule / this.SAISON_MS) * this.SAISON_MS;     // le cycle reste régulier même après une longue absence
    GS.reputation = this.ELO_DEPART; GS.save();                                // remise à zéro AVANT la pop-up : aucun risque de double récompense
    donnerRecompense("or", g.or);
    if (g.caisses) donnerRecompense("caisses", g.caisses);
    if (g.pierres) donnerRecompense(this.RECOMPENSE_PIERRE, g.pierres);
    this._cibles = [];
    await uiDialog("🏆 FIN DE SAISON", "Rang atteint : " + g.icone + " " + g.nom + " (" + pts + " Elo)\nRécompenses : +" + g.or + " Or"
      + (g.caisses ? " · +" + g.caisses + " Caisse" + (g.caisses > 1 ? "s" : "") + " Wass-E" : "")
      + (g.pierres ? " · +" + g.pierres + " Pierre de Transmutation" : "")
      + "\nL'Elo est remis à " + this.ELO_DEPART + ". Nouvelle saison !", [["Continuer", true]], true);
    this._popup = false;
    this.tirerCibles(); this.majPanneau(); return true;
  },

  /* ---------- Interface ---------- */
  fmt(ms){ const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h + "h " + String(m).padStart(2, "0") + "m " + String(x).padStart(2, "0") + "s"; },
  majTimer(){
    const t = this.Q("#pvp-timer"); if (!t || !GameState.brute) return;
    const r = this.restant(); t.textContent = r > 0 ? "⏳ Fin de saison dans " + this.fmt(r) : "⏳ Saison terminée : récompenses à la prochaine ouverture du PvP";
  },
  majPanneau(){
    if (!GameState.brute || !this.Q("#pvp-grade")) return;
    const pts = this.elo(), g = this.grade(pts), i = this.GRADES.indexOf(g), nx = this.GRADES[i + 1];
    this.Q("#pvp-grade").innerHTML = g.icone + " <b>" + g.nom + "</b> · " + pts + " Elo" + (nx ? " · prochain : " + nx.icone + " " + nx.nom + " à " + nx.min : " · rang maximum");
    this.Q("#pvp-fill").style.width = Math.round((nx ? (pts - g.min) / (nx.min - g.min) : 1) * 100) + "%";
    this.Q("#pvp-grades").innerHTML = this.GRADES.map((x, k) => `<span class="pvp-g ${k === i ? "on" : ""}">${x.icone} ${x.nom}<small>${x.min}${x.max === Infinity ? "+" : "–" + x.max}</small></span>`).join("");
    const t = this.tickets();
    this.Q("#pvp-tickets").textContent = "🎟️ Tickets : " + t + "/" + this.TICKETS_MAX;
    const lock = t <= 0 || !!Combat.act;
    this.Q("#pvp-cibles").innerHTML = this._cibles.map((c, k) =>
      `<button type="button" class="pvp-c ${lock ? "off" : ""}" data-k="${k}"><span class="pvp-cd">${c.diff.icone} ${c.diff.nom}</span>`
      + `<b>${c.nom}</b><span>Elo ${c.elo}</span><span>⚔️ ${c.puissance.toLocaleString("fr-FR")}</span></button>`).join("");
    this.majTimer();
  },

  /* ---------- Démarrage ---------- */
  init(){
    if (this._ok) return; this._ok = true;
    const st = document.createElement("style");
    st.textContent = ".pvp-panel{margin:0 0 8px;padding:8px;border:1px solid #c9953a;background:rgba(26,16,8,.88);color:#fff4d6;font:12px monospace}.pvp-bar{height:6px;background:#050705;margin:6px 0}"
      + ".pvp-bar i{display:block;height:100%;width:0;background:#f2b21c}.pvp-grades{display:flex;flex-wrap:wrap;gap:4px}.pvp-g{flex:1;min-width:58px;text-align:center;padding:3px;border:1px dashed #6b4a2b;opacity:.6}"
      + ".pvp-g small{display:block;font-size:9px}.pvp-g.on{opacity:1;border:1px solid #f2b21c;box-shadow:0 0 6px #f2b21c}.pvp-timer{margin-top:6px;text-align:center;color:#ffb000}"
      + ".pvp-tickets{margin:6px 0;text-align:center;font-weight:bold;color:#ffd35c}"
      + ".pvp-cibles{display:flex;flex-wrap:wrap;gap:6px}.pvp-c{flex:1;min-width:90px;display:flex;flex-direction:column;gap:2px;align-items:center;padding:6px 4px;cursor:pointer;"
      + "font:12px monospace;color:#fff4d6;background:rgba(60,36,14,.9);border:1px solid #c9953a}.pvp-c:hover{box-shadow:0 0 6px #f2b21c}.pvp-c.off{opacity:.45;cursor:not-allowed}"
      + ".pvp-cd{font-size:10px;text-transform:uppercase;color:#ffb000}";
    document.head.appendChild(st);
    const p = document.createElement("div"); p.id = "pvp-panel"; p.className = "pvp-panel";
    p.innerHTML = '<div class="pvp-left"><div id="pvp-grade"></div><div class="pvp-bar"><i id="pvp-fill"></i></div><div id="pvp-grades" class="pvp-grades"></div><div id="pvp-timer" class="pvp-timer"></div></div>'
      + '<div class="pvp-right"><div id="pvp-tickets" class="pvp-tickets"></div><div id="pvp-cibles" class="pvp-cibles"></div></div>';    this.Q("#arena").before(p);
    this.Q("#pvp-cibles").addEventListener("click", ev => {
      const b = ev.target.closest("[data-k]"); if (b) PvP.lancer(+b.dataset.k);
    });
    OV.reg.pvp.onOpen = () => {
      $("#g-combat").classList.add("pvp-screen");
      if (!Combat.act && !Combat.ready) { Combat.showPreview(); $("#g-combat").classList.add("pvp-preview"); }      PvP.ouvrir();
    };
    OV.reg.pvp.onClose = () => { $("#g-combat").classList.remove("pvp-screen", "pvp-preview"); Combat.stop(); };    this.Q("#btn-again").onclick = () => {                                     // « Nouveau combat » = 3 nouveaux adversaires à choisir
      if (Combat.cfg && Combat.cfg.pvp) { Combat.stop(); PvP.tirerCibles(); PvP.majPanneau(); Combat.showPreview(); $("#g-combat").classList.add("pvp-preview"); }      else Combat.relancer();
    };
    this._timer = setInterval(() => PvP.majTimer(), 1000);
  }
};
