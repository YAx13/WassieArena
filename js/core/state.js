"use strict";
/* =====================================================================
   state.js : état unique du jeu « Arène des Brutes »
   À charger AVANT le script principal. Dépend (à l'exécution seulement) de :
   $, S, OV, FX, enterGame, renderGame, persist, toast, uiDialog, Energy, AFKMode, Combat,
   CharacterSelect, DataEngine, GachaShop, ProfileManager, PvP, Raids, CaserneUI.
   ===================================================================== */
const GameState = {
  KEY: "arene_gamestate_v1",
  VERSION: 1,
  get ENERGIE_MAX(){ return this.vip ? 25 : 20; },
  NIVEAU_MAX: 50,
  PALIERS: 20,                       // paliers par Boss (source unique, lue par Raids)
  MAITRISE_MAX: 10,
  get PRIX_CAISSE(){ return GachaShop.PRICE; },
  vip: false,
  get illimite(){ return this.vip || !!document.getElementById("devbox"); },   // x4 + Skip illimités : Pass VIP ou mode développeur (#devbox)

  /* Clés persistées (hors brute) : snapshot() les lit telles quelles */
  SAVED: ["ressources", "energieTs", "achatsStats", "tentativesParchemins", "reputation", "saisonDebut", "monde", "vip",
          "ticketsPvp", "skipsGratuits", "jourReset", "maitriseArmes", "competencesEquipees", "presets", "boss"],

  /* Progression d'une partie neuve : source unique (recruter, effacer, charger) */
  _vierge(){
    return {
      boss: { armes: 0, parchemins: 0, familier: 0, mondial: 0 },   // palier atteint par mode
      presets: { actif: 1, 1: null, 2: null, 3: null },
      monde: { cles: 2, jour: "", rotation: -1, record: 0 },        // Boss Mondial (voir raids.js)
      achatsStats: 0,            // Entraînements Mutagènes achetés
      tentativesParchemins: 0,   // tirages de compétence (coût en Parchemins = 2^n)
      reputation: 1000,          // Elo PvP
      maitriseArmes: {},         // { idArme: 0..10 } via les doublons de caisse
      ticketsPvp: 5, skipsGratuits: 3
    };
  },
  _reset(){
    Object.assign(this, { brute: null, competencesEquipees: [], energieTs: Date.now(), saisonDebut: Date.now(),
      jourReset: this._jourLocal(), ressources: this.defaultRessources(), _mem: null }, this._vierge());
  },

  /* L'équipement et les compétences débloquées vivent DANS la brute */
  get equipement(){ const b = this.brute; return b ? { armes: b.weapons, pieces: b.gear } : { armes: [], pieces: [] }; },
  get competencesDebloquees(){ return this.brute ? this.brute.skills : []; },

  slotsPourNiveau(n){ n = +n || 1; return n >= 10 ? 3 : n >= 5 ? 2 : 1; },
  defaultRessources(){ return { or: 300, caisses: 0, energie: this.ENERGIE_MAX, parchemins: 0, nourriture: 0, pierres: 0 }; },
  _n(v, def = 0){ v = Math.floor(+v); return Number.isFinite(v) && v >= 0 ? v : def; },
  xpMaxPour(niveau){ return Math.floor(100 * Math.pow(1.18, (+niveau || 1) - 1)); },
  _lire(k){ try { return localStorage.getItem(k); } catch (e) { return null; } },   // localStorage peut être bloqué (iframe sandbox)

  /* ---- Quotidien : minuit, heure locale (tickets, skips, clés du Boss Mondial) ---- */
  _jourLocal(){
    const d = new Date(), p = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  },
  verifierReset(){
    const j = this._jourLocal(); if (this.jourReset === j) return false;
    this.jourReset = j; this.ticketsPvp = 5; this.skipsGratuits = 3; this.monde.cles = 2;
    if (this.brute) this.save();
    return true;
  },

  /* Alias de types acceptés par donnerRecompense / depenserRessource */
  cle(t){
    const m = { or: "or", gold: "or", caisse: "caisses", caisses: "caisses", energie: "energie", "énergie": "energie", energy: "energie",
      parchemin: "parchemins", parchemins: "parchemins", nourriture: "nourriture", pierre: "pierres", pierres: "pierres", transmutation: "pierres" };
    return m[String(t || "").trim().toLowerCase()] || null;
  },

  /* ---- La brute lit/écrit ses ressources dans GameState : b.gold, b.energy… continuent de marcher ---- */
  attach(b){
    const GS = this, def = (k, g, s) => Object.defineProperty(b, k, { get: g, set: s, enumerable: false, configurable: true });
    def("gold",      () => GS.ressources.or,      v => { v = Math.floor(+v); if (Number.isFinite(v)) GS.ressources.or = Math.max(0, v); });
    def("energy",    () => GS.ressources.energie, v => { v = Math.floor(+v); if (Number.isFinite(v)) GS.ressources.energie = Math.max(0, Math.min(GS.ENERGIE_MAX, v)); });
    def("energyMax", () => GS.ENERGIE_MAX,        () => {});
    def("energyTs",  () => GS.energieTs,          v => { if (Number.isFinite(v)) GS.energieTs = v; });
    def("niveau",    () => b.level,               v => { b.level = v; });
    def("nom",       () => b.name,                v => { b.name = v; });
    def("archetype", () => b.sprite,              v => { b.sprite = v; });
    def("slotsCompetences", () => GS.slotsPourNiveau(b.level), () => {});
    return b;
  },
  _normBrute(b){
    b.level = Math.min(this.NIVEAU_MAX, Math.max(1, Math.floor(+b.level) || 1));
    if (!Number.isFinite(b.xp)) b.xp = 0;
    b.hasBeenRenamed = b.hasBeenRenamed === true;
    b.xpMax = this.xpMaxPour(b.level);
    ["weapons", "gear", "skills"].forEach(k => { if (!Array.isArray(b[k])) b[k] = []; });
    if (!Number.isFinite(b.afkTs) || b.afkTs > Date.now()) b.afkTs = Date.now();
    return b;
  },

  /* ---- Sauvegarde / chargement : un seul objet dans localStorage ---- */
  snapshot(){
    const s = { version: this.VERSION, brute: this.brute, sauvegardeLe: Date.now() };
    this.SAVED.forEach(k => s[k] = this[k]);
    return s;
  },
  save(){
    if (!this.brute) return false;
    const s = this._mem = JSON.stringify(this.snapshot());
    try { localStorage.setItem(this.KEY, s); return true; } catch (e) { return false; }
  },
  charger(){
    const raw = this._lire(this.KEY) || this._mem; if (!raw) return false;
    let d; try { d = JSON.parse(raw); } catch (e) { return false; }
    if (!d || !d.brute) return false;
    const v = this._vierge(), D0 = this.defaultRessources();
    this.vip = d.vip === true;                                   // avant tout calcul dépendant de ENERGIE_MAX
    this.ressources = {}; Object.keys(D0).forEach(k => this.ressources[k] = this._n(d.ressources && d.ressources[k], D0[k]));
    this.ressources.energie = Math.min(this.ressources.energie, this.ENERGIE_MAX);
    this.energieTs = Number.isFinite(d.energieTs) ? d.energieTs : Date.now();
    this.saisonDebut = Number.isFinite(d.saisonDebut) ? d.saisonDebut : Date.now();
    this.jourReset = typeof d.jourReset === "string" ? d.jourReset : "";
    ["achatsStats", "tentativesParchemins", "reputation", "ticketsPvp", "skipsGratuits"].forEach(k => this[k] = this._n(d[k], v[k]));
    this.boss = {}; Object.keys(v.boss).forEach(k => this.boss[k] = Math.min(this.PALIERS, this._n(d.boss && d.boss[k])));
    this.maitriseArmes = {}; Object.keys(d.maitriseArmes || {}).forEach(k => this.maitriseArmes[k] = Math.min(this.MAITRISE_MAX, this._n(d.maitriseArmes[k])));
    this.presets = Object.assign(v.presets, d.presets);
    this.monde = Object.assign(v.monde, d.monde); this.monde.cles = this._n(this.monde.cles, 2); this.monde.record = this._n(this.monde.record);
    this.brute = this.attach(this._normBrute(d.brute));
    this.competencesEquipees = Array.isArray(d.competencesEquipees) ? d.competencesEquipees : this.brute.skills.slice(0, this.brute.slotsCompetences);
    this.verifierReset();
    return true;
  },
  migrer(){            // ancienne sauvegarde (ProfileManager, 5 socles) → on garde UNE brute
    const list = ProfileManager.load().slots.filter(Boolean); if (!list.length) return false;
    const last = this._lire("arene_brutes_last"), b = list.find(x => x.id === last) || list[0];
    const energie = this._n(b.energy, this.ENERGIE_MAX), ts = Number.isFinite(b.energyTs) ? b.energyTs : Date.now();
    this.ressources = Object.assign(this.defaultRessources(), { or: this._n(b.gold, 300), energie: Math.min(energie, this.ENERGIE_MAX) });
    this.energieTs = ts;
    delete b.gold; delete b.energy; delete b.energyMax; delete b.energyTs;
    this.brute = this.attach(this._normBrute(b));
    this.competencesEquipees = b.skills.slice(0, b.slotsCompetences);
    return true;
  },

  /* ---- Création de l'unique Brute (bouton « RECRUTER ») ---- */
  recruter(cand){
    if (this.brute) { toast("Vous avez déjà une Brute. Utilisez « Nouvelle Partie » pour recommencer."); return false; }
    const b = JSON.parse(JSON.stringify(cand));
    CharacterSelect.rollLoot(b);                         // tirage caché
    b.skills = b.skills.slice(0, 1);                     // niveau 1 : 1 compétence, 1 slot
    this._reset();
    this.brute = this.attach(this._normBrute(b));
    this.competencesEquipees = b.skills.slice(0, b.slotsCompetences);
    this.save(); this.appliquerDecor(); this.majRate();
    toast(b.name + " rejoint la résistance !");
    enterGame(b);
    return true;
  },

  /* ---- Nouvelle partie : efface les sauvegardes du jeu ---- */
  async nouvellePartie(){
    const msg = "Effacer la sauvegarde ?\nVotre Brute, vos ressources, équipements et la progression des Boss seront définitivement perdus.";
    if (await uiDialog("⚠ NOUVELLE PARTIE", msg, [["Tout effacer", true], ["Annuler", false]], false)) this.effacer();
  },
  effacer(){
    let stockageEfface = true;
    try {
      [this.KEY, ProfileManager.KEY, "arene_brutes_last"].forEach(k => localStorage.removeItem(k));
    } catch (error) {
      stockageEfface = false;
      console.error("Impossible d'effacer entièrement la sauvegarde locale.", error);
    }
    ProfileManager.mem = null;
    this.vip = false; this._reset();
    AFKMode.stop(); OV.closeAll(); Combat.stop();
    S.cur = null;
    $("#screen-game").classList.add("hidden");
    CharacterSelect.show();
    toast(stockageEfface ? "Sauvegarde effacée : nouvelle partie !"
      : "Nouvelle partie créée, mais la sauvegarde locale n'a pas pu être entièrement effacée.");
  },

    /* ---- Décor AFK : ASSETS/decors/afk/<archétype>_AFK (1).<jpg|jpeg|png> ---- */
  appliquerDecor(){
    const b = this.brute, st = $("#afk-stage"); if (!b || !st) return;
    let key = String(b.sprite || "").toLowerCase();
    DataEngine.BRAWLERS.forEach(k => { if (key.startsWith(k)) key = k; });   // "samouraiplanche1" → "samourai" (même logique que l'ancienne sécurité)
    const essayer = (exts) => {
      if (!exts.length) { st.style.removeProperty("--afk-bg-img"); return; }   // image absente : fond uni
      const img = new Image();
      img.onload = () => { if (this.brute === b) st.style.setProperty("--afk-bg-img", "url('" + img.src + "')"); };
      img.onerror = () => essayer(exts.slice(1));
      img.src = encodeURI(assetPath.afk(key, 1, exts[0]));
    };
    essayer(["jpeg", "jpg", "png"]);
  },
  /* ---- Or AFK : 3 × niveau par seconde (×1,5 en VIP). Source unique : AFKMode.RATE l'appelle ---- */
  tauxOrAfk(){ return Math.round(3 * (this.brute ? this.brute.niveau : 1) * (this.vip ? 1.5 : 1)); },
  majRate(){ const el = $("#afk-rate"); if (el) el.textContent = "+" + this.tauxOrAfk() + " Or / sec"; },

  /* ---- Header ---- */
  headerHTML(){
    const R = this.ressources, f = n => n.toLocaleString("fr-FR");
    return `<div class="chip">⚡ ${R.energie}/${this.ENERGIE_MAX}</div><div class="chip">🪙 ${f(R.or)} Or</div><div class="chip">⚔️ ${f(calculerPuissance())}</div>` +
      `<div class="chip" title="Caisses Wass-E">📦 ${R.caisses}</div><div class="chip" title="Parchemins de compétence">📜 ${R.parchemins}</div>` +
      `<div class="chip" title="Nourriture compagnon">🍖 ${R.nourriture}</div><div class="chip" title="Pierres de Transmutation">💎 ${R.pierres}</div>`;
  },
  rafraichir(){
    if (S.cur) renderGame();
    AFKMode.hud(); this.majRate(); this.majCargos();
  },

  /* ---- XP (Brute + compagnon) : donnerRecompense("xp") ---- */
  gagnerXp(q){
    const b = this.brute, st = [], recompenses = []; let niveaux = 0;
    if (b.level < this.NIVEAU_MAX) b.xp += q;
    while (b.level < this.NIVEAU_MAX && b.xp >= this.xpMaxPour(b.level)) {
      b.xp -= this.xpMaxPour(b.level); b.level++; niveaux++;
      for (let i = 0; i < 2; i++) { const k = DataEngine.pick(["hp", "str", "agi", "spd"]); b.stats[k]++; st.push(k); }   // +2 points, sans plafond
      if (b.level % 5 === 0) { this.ressources.caisses++; this.ressources.parchemins++; recompenses.push(b.level); }       // paliers 5, 10… : +1 caisse, +1 parchemin
    }
    if (b.level >= this.NIVEAU_MAX) b.xp = 0;
    b.xpMax = this.xpMaxPour(b.level);
    const evolution = b.companion ? CompanionData.gainXp(b.companion, q).evolved : false;
    this.save(); this.rafraichir();
    return { xp: q, niveaux, stats: st, recompenses, evolution };
  },
  /* ---- Équipement : donnerRecompense("equipement", n, { rarite, part }) ---- */
  donnerEquipement(n, o = {}){
    const D = DataEngine, out = [];
    for (let i = 0; i < n; i++) {
      const r = Number.isInteger(o.rarite) && o.rarite >= 0 ? o.rarite : GachaShop.rollRarity();
      const g = { part: o.part || D.pick(D.PARTS).id, rarity: Math.min(5, r) };
      this.brute.gear.push(g); out.push(g);
    }
    this.save(); this.rafraichir(); return out;
  },

  /* ---- Presets de compétences (1/2/3) ---- */
  sauverPreset(n){
    n = +n; if (![1, 2, 3].includes(n) || !this.brute) return false;
    this.presets[n] = { competences: this.competencesEquipees.slice() }; this.presets.actif = n; this.save(); return true;
  },
  chargerPreset(n){
    n = +n; const p = this.presets[n]; if (!p || !this.brute) return false;
    this.competencesEquipees = p.competences.filter(id => this.brute.skills.includes(id)).slice(0, this.brute.slotsCompetences);
    this.presets.actif = n; this.save(); this.rafraichir(); return true;
  },

  /* ---- Boss : palier atteint par mode ---- */
  validerPalier(mode, n){
    if (!(mode in this.boss)) return false;
    this.boss[mode] = Math.max(this.boss[mode], Math.min(this.PALIERS, this._n(n))); this.save(); return true;
  },

  /* ---- Cargos Wass-E : acheter (GachaShop.PRICE Or → +1 caisse) puis ouvrir ---- */
  brancherCargos(){
    const btn = $("#btn-chest"); if (!btn) return;
    btn.textContent = "📦 Acheter une Caisse Wass-E : " + GachaShop.PRICE + " Or";
    btn.onclick = () => this.acheterCaisse();
    let ob = $("#btn-chest-open");
    if (!ob) { ob = document.createElement("button"); ob.id = "btn-chest-open"; ob.className = btn.className.replace("gold", "").trim(); btn.after(ob); }
    ob.onclick = () => this.ouvrirCaisse();
    this.majCargos();
  },  majCargos(){
    const ob = $("#btn-chest-open"); if (!ob || !this.ressources) return;
    ob.textContent = "🔓 Ouvrir une Caisse (" + this.ressources.caisses + ")"; ob.disabled = this.ressources.caisses < 1;
  },
  acheterCaisse(){
    if (!depenserRessource("or", GachaShop.PRICE)) { toast("Pas assez d’Or."); return; }
    donnerRecompense("caisses", 1); toast("Caisse Wass-E volée !");
  },
  ouvrirCaisse(){
    if (this.ressources.caisses < 1) { toast("Aucune caisse à ouvrir."); return; }
    const r = GachaShop.roll(this.brute), R = DataEngine.RARITIES; let h;
    this.ressources.caisses--;
    if (r.type === "dup") {              // doublon : maîtrise d'arme (puis parchemin une fois à +10)
      const m = this.maitriseArmes[r.w.id] || 0;
      if (m < this.MAITRISE_MAX) { this.maitriseArmes[r.w.id] = m + 1; r.maitrise = m + 1; }
      else { this.ressources.parchemins++; r.maitrise = "parchemin"; }
      h = r.maitrise === "parchemin" ? `Doublon (${r.w.icon} ${r.w.name}) : maîtrise max (+10) → <b>+1 📜 parchemin</b> !`
        : `Doublon (${r.w.icon} ${r.w.name}) : maîtrise <b>+${r.maitrise}</b> / +10 !`;
    } else if (r.type === "weapon") h = `Nouvelle arme : <b>${r.w.icon} ${r.w.name}</b> !`;
    else h = `<b style="color:${R[r.rarity].color}">${r.part.icon} ${r.part.name} ${R[r.rarity].name}</b>`;
    const c = $("#chest"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake");
    $("#chest-result").innerHTML = h;
    persist(); this.majCargos();
  },
  /* ---- Démarrage ---- */
  boot(){
    if (this._booted) return; this._booted = true;
    CharacterSelect.init({ onRecruit: cand => this.recruter(cand) });
    PvP.init(); CaserneUI.init();
    const resetButton = $("#btn-reset-save") || $("#btn-back");
    if (resetButton) resetButton.onclick = () => this.nouvellePartie();
    this.brancherCargos();
    if (!this.charger()) this.migrer();
    setInterval(() => { this.verifierReset(); this.save(); }, 5000);          // sauvegarde automatique
    addEventListener("pagehide", () => this.save());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.save(); else this.verifierReset(); });
    if (this.brute) {
      this.save(); this.majRate();
      enterGame(this.brute);       // 1. stabiliser le personnage  2. décor en dernier
      this.appliquerDecor();
      PvP.verifierSaison();
    }                              // sinon : 1re connexion, seul l'écran des Cuves de clonage est visible
  }
};
GameState._reset();

/* ===== Fonctions universelles ===== */
/* type : "or" | "caisses" | "energie" | "parchemins" | "nourriture" | "pierres" → nouveau total, ou false.
   Cas spéciaux : "xp" (Brute + compagnon, niveaux auto) et "equipement" (pièces ajoutées à la Brute). */
function donnerRecompense(type, quantite, options){
  const GS = GameState, q = Math.floor(+quantite), t = String(type || "").trim().toLowerCase();
  if (!GS.brute || !(q > 0)) return false;
  if (t === "xp") return GS.gagnerXp(q);
  if (t === "equipement" || t === "équipement") return GS.donnerEquipement(q, options);
  const k = GS.cle(type); if (!k) return false;
  GS.ressources[k] = k === "energie" ? Math.min(GS.ENERGIE_MAX, GS.ressources.energie + q) : GS.ressources[k] + q;
  GS.save(); GS.rafraichir();
  return GS.ressources[k];
}
/* true si la dépense a eu lieu, false si le solde est insuffisant. L'énergie passe par Energy.spend (cycle de 15 min). */
function depenserRessource(type, quantite){
  const GS = GameState, k = GS.cle(type), q = Math.floor(+quantite);
  if (!GS.brute || !k || !(q > 0)) return false;
  let ok = true;
  if (k === "energie") ok = Energy.spend(GS.brute, q);
  else if (GS.ressources[k] < q) return false;
  else GS.ressources[k] -= q;
  GS.save(); GS.rafraichir();
  return ok;
}

/* Score de Puissance (joueur par défaut, ou ennemi : b.skills, pas de maîtrise d'armes). Les stats incluent le bonus d'équipement. */
function calculerPuissance(b = GameState.brute){
  if (!b) return 0;
  const GS = GameState, joueur = b === GS.brute, st = b.stats || {}, armes = b.weapons || [];
  const v = k => (+st[k] || 0) + DataEngine.gearBonus(b, k);
  let p = v("hp") * 2 + v("str") * 15 + v("agi") * 12 + v("spd") * 12;
  p += 150 * (joueur ? GS.competencesEquipees : (b.skills || [])).length + 100 * armes.length;
  if (joueur) armes.forEach(id => p += 50 * (GS.maitriseArmes[id] || 0));
  if (b.companion) p += (+b.companion.level || 0) * 40 + (b.companion.form || 1) * 250;
  return Math.round(p);
}
