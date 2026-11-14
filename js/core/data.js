"use strict";

/* Chemins des fichiers : un seul endroit à modifier si les dossiers changent */
const assetPath = {
  portrait: id => `assets/characters/${id}/portrait.png`,
  sprite: id => `assets/characters/${id}/sprite.png`,
  sheet: (id, n) => `assets/characters/${id}/sheets/sheet-${n}.png`,
  starter: id => `assets/characters/${id}/starter.jpeg`,
  weapon: (id, n) => `assets/characters/${id}/weapons/weapon-${n}-transparent.png`,
  afk: (id, n, ext) => `assets/backgrounds/afk/${id}/afk-${n}.${ext}`,
  pvp: (biome, n) => `assets/backgrounds/pvp/${biome}-${n}.jpeg`,
  pvpPreview: id => `assets/backgrounds/pvp/${id}/pvpPreview.jpeg`,  bossRoom: (boss, n) => `assets/backgrounds/boss/${boss}/bossroom-${n}.jpg`,
  bossSheet: (boss, n) => `assets/bosses/${boss}/sheets/sheet-${n}.png`,
  trainBanner: id => `assets/backgrounds/train/${id}/trainBanner.png`,
  companionArt: (form, species) => `assets/companion/form-${form}/${species}.png`,
  companionBg:  id => `assets/companion/${id}/background.jpeg`,
  companionFg:  id => `assets/companion/${id}/foreground.png`,
  characterSelectBg: () => `assets/backgrounds/character-select/background.jpeg`,
  competenceBg: () => `assets/backgrounds/competence/background.jpeg`,

};

/* ================= DataEngine ================= */
class DataEngine {
  static BRAWLERS = ["general", "empereur", "frankenstein", "hazmat", "human", "inversebrah", "momie", "samourai", "zeus"];

  // Rempli juste après la classe (boucle sur BRAWLERS)
  static SPRITES = {};

  static spriteBase(k){ const s=this.SPRITES[k]; return s ? (s.planches[0]||s.sprite||"") : ""; }
  static spriteSheet(k,sh){ const s=this.SPRITES[k]; return s ? (s.planches[{atk:1,crit:2,trn:3}[sh]]||"") : ""; }
  static portrait(k){ const s=this.SPRITES[k]; return s ? (s.portrait||"") : ""; }
  static hasImages(k){ return !!this.spriteBase(k); }
  static readyKeys(){ const r=this.BRAWLERS.filter(k=>this.hasImages(k)); return r.length?r:this.BRAWLERS.filter(k=>this.SPRITES[k]); }

  // Arène de l'écran principal selon la brute active
  static getAfkBackground(k) {
    const s = this.SPRITES[k];
    const background = s ? (s.afkBackground || "") : "";
    return background === "" ? assetPath.afk("general", 1, "jpeg") : background;
  }

  static RARITIES = [
    {id:0,name:"Commun",color:"#b8b8b8",w:55},{id:1,name:"Peu commun",color:"#6fcf5a",w:25},
    {id:2,name:"Rare",color:"#4fa0ff",w:12},{id:3,name:"Épique",color:"#b06cff",w:5},
    {id:4,name:"Légendaire",color:"#ff9d2e",w:2.2},{id:5,name:"Divin",color:"#ff5e7e",w:.8}
  ];
  static PARTS = [
    {id:"helmet",name:"Casque",icon:"🪖",statLabel:"+Vie"},
    {id:"chest",name:"Plastron",icon:"🦺",statLabel:"+Agilité"},
    {id:"boots",name:"Bottes",icon:"🥾",statLabel:"+Vitesse"},
    {id:"necklace",name:"Collier",icon:"📿",statLabel:"+Force"},
    {id:"ring",name:"Anneau",icon:"💍",statLabel:"Stat / Élément"}
  ];
  static WEAPONS = [
["Épée", "⚔️", 7, 5, 6, 5,
"Lame de récup, bien équilibrée."],
["Dague", "🗡️", 4, 9, 7, 8, "Rapide, vise les failles."],
["Couteau", "🔪", 3, 8, 6, 6, "Un classique des décharges."],
["Hache", "🪓", 9, 3, 4, 6, "Fend l'acier comme les crânes."],
["Marteau", "🔨", 10, 2, 4, 5, "Lourd, brutal, bruyant."],
["Arc", "🏹", 6, 5, 8, 7, "Cordes en câble électrique."],
["Trident", "🔱", 7, 5, 7, 6, "Piques soudées sur un tuyau."],
["Baguette", "🪄", 5, 7, 8, 4, "Un tuyau qui grésille."],
["Boomerang", "🪃", 5, 6, 6, 7, "Il revient. Parfois."],
["Pioche", "⛏️", 8, 3, 5, 6, "Outil de mineur reconverti."],
["Scie", "🪚", 6, 6, 5, 9, "Disque de scie circulaire."],
["Crochet", "🪝", 5, 7, 6, 7, "Accroche et arrache."],
["Os", "🦴", 3, 7, 5, 4, "Tibia de mutant, très solide."],
["Canne", "🎣", 4, 6, 9, 3, "Pêche aux débris et aux ennuis."],
["Fourche", "🍴", 5, 6, 7, 5, "Fourchette de cantine Wass-E."],
["Bouclier", "🛡️", 2, 4, 5, 2, "Couvercle de cuve blindé."]].map((w,i)=>({id:i,name:w[0],icon:w[1],dmg:w[2],spd:w[3],prec:w[4],crit:w[5],desc:w[6]}));

  static COMPANION_ART_FILES = {
    chien: "dog", loup: "wolf", ours: "ours", serpent: "snake",
    oiseau: "bird", arthropode: "beetle", felin: "cat", taureau: "bull",
    aquatique: "aqua", chimere: "racoon", lezard: "lizard",
    spectre: "spectre", tempete: "eagle"
  };

  static getCompanionArt(familyKey, form = 1) {
    const file = this.COMPANION_ART_FILES[familyKey] || familyKey || "dog";
    return assetPath.companionArt(Math.max(1, Math.min(3, form)), file);
  }

  static getCompanionBg(brawlerId) {
    return assetPath.companionBg(brawlerId || "empereur");
  }
  static getCompanionFg(brawlerId) {
    return assetPath.companionFg(brawlerId || "empereur");
  }

  static PVP_BIOMES = [
    [assetPath.pvp("nuclear",1), assetPath.pvp("nuclear",2), assetPath.pvp("nuclear",3)],
    [assetPath.pvp("robot",1),   assetPath.pvp("robot",2),   assetPath.pvp("robot",3)]
  ];
  static ARENAS = this.PVP_BIOMES[0];
  static ELEMENTS = ["Physique","Feu","Glace","Eau","Électricité","Terre","Air"];
  static SKILLS = [
 ["Coup de Tuyau",0,"A",1.2,{},"Dégâts moyens, fiable."],
 ["Charge Blindée",0,"A",1.8,{acc:-20},"Gros dégâts, précision réduite."],
 ["Uppercut de Décharge",0,"A",1.2,{crit:.25},"Plus de chances de critique."],
 ["Pied-de-Biche",0,"A",1.1,{pierce:1},"Ignore l’armure adverse."],
 ["Coup de Boule Mutant",0,"C",.9,{stun:.75},"Peut étourdir 1 tour."],
 ["Garde de Tôle",0,"S",0,{dr:[.3,2]},"−30 % de dégâts reçus, 2 tours."],
 ["Rage de Survivant",0,"S",0,{rage:4},"Dégâts croissants quand les PV baissent."],
 ["Réflexes de Rat",0,"S",0,{dodge:[25,3]},"Esquive accrue, 3 tours."],
 ["Cocktail Molotov",1,"A",.9,{dot:[1,2,"brûlure"]},"Dégâts + brûlure."],
 ["Chalumeau",1,"A",.5,{dot:[1.2,3,"brûlure"]},"Dégâts continus sur 3 tours."],
 ["Explosion de Bonbonne",1,"A",2.4,{recoil:.2},"Très gros dégâts, recul subi."],
 ["Nuage de Cendres",1,"C",.3,{accD:[25,3]},"Réduit la précision adverse."],
 ["Azote Liquide",2,"C",.4,{stun:1},"Gèle : l’adversaire perd son tour."],
 ["Éclat de Givre",2,"A",1.2,{crit:.35},"Forte chance de critique."],
 ["Chambre Froide",2,"C",.4,{slow:3},"Ralentit l’adversaire."],
 ["Carapace de Givre",2,"S",0,{shield:1.2},"Bouclier qui absorbe les dégâts."],
 ["Jet de Karcher",3,"A",1,{delay:.7},"Dégâts + repousse l’initiative adverse."],
 ["Eau Contaminée",3,"C",.3,{dot:[1,3,"poison"]},"Poison sur 3 tours."],
 ["Marée de Cuve",3,"A",1.1,{sure:1},"Touche toujours."],
 ["Brume Purificatrice",3,"S",0,{heal:.25,cleanse:1},"Soigne et purge les altérations."],
 ["Câble Dénudé",4,"C",1,{stun:.35},"Dégâts + chance d’étourdir."],
 ["Arc de Transfo",4,"A",1.2,{sure:1},"Ignore l’esquive."],
 ["Surtension",4,"S",0,{spdUp:3},"Vitesse accrue, 3 tours."],
 ["Court-circuit",4,"C",.5,{dispel:1},"Annule les bonus adverses."],
 ["Éboulement de Béton",5,"A",1.2,{slow:2},"Dégâts + ralentit."],
 ["Séisme de Décharge",5,"A",2.2,{selfDelay:.8},"Dégâts très élevés, lent à préparer."],
 ["Mur de Gravats",5,"S",0,{block:1},"Bloque le prochain coup."],
 ["Peau de Rouille",5,"S",0,{reflect:[.4,3]},"Renvoie une part des dégâts."],
 ["Rafale Toxique",6,"C",.5,{accD:[15,2]},"Réduit la précision, dégâts légers."],
 ["Tornade de Poussière",6,"S",.5,{dodge:[15,2]},"Esquive accrue + dégâts légers."],
 ["Souffle d’Écluse",6,"A",1.1,{push:1},"Propulsion garantie vers l’arène secrète."],
 ["Bourrasque Fatale",6,"A",1.6,{crit:.3},"Dégâts élevés, critique accru."]
 ].map((k,i)=>({id:i,name:k[0],el:k[1],t:k[2],pw:k[3],fx:k[4],desc:k[5]}));
  static EL_ICON = ["👊","🔥","❄️","💧","⚡","🪨","🌪️"];
  static EL_COL = ["#c9c2b0","#ff6a2b","#7fd8ff","#3b8cff","#ffe23d","#a8793f","#b9e8d0"];
  static EL_SYNERGIES = [
    { el: 0, p2: "+12 % Dégâts Physiques",     p3: "+25 % Dégâts Physiques & +10 % Critique", dmg: [1.12, 1.25], crit: [0, 0.10] },
    { el: 1, p2: "+15 % Dégâts de Feu",        p3: "+30 % Dégâts de Feu & Brûlure renforcée", dmg: [1.15, 1.30], dot: [1.15, 1.35] },
    { el: 2, p2: "+15 % Dégâts de Glace",      p3: "+30 % Dégâts de Glace & +15 % Gel/Ralenti", dmg: [1.15, 1.30], ctrl: [0.10, 0.20] },
    { el: 3, p2: "+15 % Dégâts d'Eau & Soin",  p3: "+30 % Dégâts d'Eau & +20 % Soins reçus",   dmg: [1.15, 1.30], heal: [1.15, 1.30] },
    { el: 4, p2: "+15 % Dégâts Électriques",   p3: "+30 % Dégâts Électriques & +10 % Vitesse", dmg: [1.15, 1.30], spd: [1.05, 1.12] },
    { el: 5, p2: "+15 % Dégâts de Terre",      p3: "+30 % Dégâts de Terre & −12 % Dégâts reçus", dmg: [1.15, 1.30], dr: [0.06, 0.12] },
    { el: 6, p2: "+15 % Dégâts d'Air",         p3: "+30 % Dégâts d'Air & +10 % Esquive",       dmg: [1.15, 1.30], dodge: [5, 10] }
  ];
  static getSynergies(skillIds = []){
    const counts = {};
    (skillIds || []).forEach(id => { const s = this.SKILLS[id]; if (s) counts[s.el] = (counts[s.el] || 0) + 1; });
    return Object.entries(counts)
      .filter(([, n]) => n >= 2)
      .map(([el, n]) => {
        const tier = n >= 3 ? 3 : 2, idx = tier - 2, def = this.EL_SYNERGIES[+el];
        return { el: +el, count: n, tier, icon: this.EL_ICON[+el], name: this.ELEMENTS[+el], col: this.EL_COL[+el], desc: tier === 3 ? def.p3 : def.p2, def, idx };
      });
  }
  static pickSkills(n){ const a=[...Array(32).keys()]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a.slice(0,n); }
  static SYL_A = ["Gor","Bru","Thor","Ska","Ma","Dra","Ur","Kra","Bal","Vor","Mor","Ras","Tor","Gru"];
  static SYL_B = ["gar","nak","mund","dor","gul","bak","rik","thar","zul","gan","dric","mok"];
  static FLAVORS = [
    "Évadé d’un entrepôt Wass-E, il a gardé le code-barres tatoué sur le bec.",
    "Il pirate les drones de patrouille pour le plaisir et les revend pour manger.",
    "Né dans une cuve toxique du secteur 7, il ne craint plus la pluie acide.",
    "Son bras cybernétique grésille quand la lune devient verte.",
    "Il jure d’arracher la couronne du magnat ornithorynque, plume par plume.",
    "Ancien ouvrier de la tour, il connaît chaque faille de ses couloirs.",
    "Silencieux, patient, il compte les failles dans l’armure adverse.",
    "Il rit avant chaque combat. Les rats de décharge quittent la pièce."
  ];
  // Familiers : clé "<espèce>:<forme>" -> image (vide = fallback du moteur)
  static PET_SHEETS = { "chien_friche:1":"", "chien_friche:2":"", "chien_friche:3":"", "ours_decharge:1":"", "ours_decharge:2":"", "ours_decharge:3":"", "aigle_veille:1":"", "aigle_veille:2":"", "aigle_veille:3":"" };
  static WEAPON_IMGS = {};   // id d'arme -> image 32x32 optionnelle
  // Nombre de skins d'arme présents dans assets/characters/<id>/weapons/ (weapon-1.jpeg … weapon-N.jpeg)
  static WEAPON_COUNT = { empereur:1, frankenstein:1, general:4, hazmat:3, human:3, inversebrah:4, momie:3, samourai:3, zeus:3 };
  static WEAPON_SKINS = Object.fromEntries(Object.entries(DataEngine.WEAPON_COUNT).map(([k, n]) =>
    [k, Array.from({ length: n }, (_, i) => assetPath.weapon(k, i + 1))]));
  // Style d'attaque par arme : estoc (P2 L1), overhead (P2 L2, saut), throw (P2 L3, jet)
  static WEAPON_STYLE = ["estoc","estoc","estoc","overhead","overhead","throw","estoc","estoc","throw","overhead","overhead","estoc","overhead","throw","estoc","overhead"];
  static WEAPON_CELLS = [0,12,13,4,5,9,1,7,14,6,11,15,10,2,3,8];
  // Équipement : 4 armures (Casque=HP, Plastron=AGI, Bottes=SPD, Collier=STR) + 2 Anneaux (Stat ou Élément)
  static GEAR_BONUS=[1,3,6,10,15,20];
  static RING_STAT_BONUS=[2,5,9,14,20,28];
  static RING_EL_BONUS=[0.10,0.15,0.20,0.25,0.30,0.38];
  static PART_STAT={helmet:"hp",chest:"agi",boots:"spd",necklace:"str"};
  static GEAR_SETS={
    carnage:{id:"carnage",name:"Carnage",icon:"🩸",col:"#ff5e5e",p2:"+12% Dégâts crit.",p4:"+20% Dégâts & perce 15% armure"},
    cyber:{id:"cyber",name:"Cyber-Flux",icon:"⚡",col:"#4ff0e6",p2:"+10% Vitesse & Précision",p4:"+25% Contrôle (Étourdit/Gel/Ralenti)"},
    mutant:{id:"mutant",name:"Cuve-Mutant",icon:"☣️",col:"#9be15d",p2:"+15% PV max & Esquive",p4:"Renvoie 20% dégâts + Régén. 5% PV/tour"}
  };
  static normGearItem(g){
    if(!g) return null;
    if(g.part==="gloves") g.part="helmet";
    if(g.part==="ring"){
      if(!g.kind) g.kind="stat";
      if(g.kind==="stat"&&!g.stat) g.stat="str";
      if(g.kind==="el"&&!Number.isInteger(g.el)) g.el=1;
      return g;
    }
    if(!g.set||!this.GEAR_SETS[g.set]) g.set="carnage";
    return g;
  }
  static getEquippedGear(b){
    const list=(b&&b.gear||[]).map(g=>this.normGearItem(g)).filter(Boolean);
    const armors=["helmet","chest","boots","necklace"].map(part=>{
      const pref=b&&b.eqArmor&&b.eqArmor[part];
      const pool=list.filter(g=>g.part===part).sort((x,y)=>y.rarity-x.rarity);
      if(!pool.length) return null;
      return (pref&&pool.find(g=>g.set===pref.set&&g.rarity===pref.rarity))||pool[0];
    }).filter(Boolean);
    const allRings=list.filter(g=>g.part==="ring").sort((x,y)=>y.rarity-x.rarity);
    const rings=[];
    (b&&Array.isArray(b.eqRings)?b.eqRings:[]).forEach(sig=>{
      if(rings.length>=2||!sig) return;
      const found=allRings.find(r=>!rings.includes(r)&&this.gearSig(r)===sig);
      if(found) rings.push(found);
    });
    allRings.forEach(r=>{ if(rings.length<2&&!rings.includes(r)) rings.push(r); });
    return {armors,rings,all:armors.concat(rings)};
  }
  static gearSig(g){
    g=this.normGearItem(g);
    if(!g) return "";
    return g.part==="ring"?`ring|${g.rarity}|${g.kind}|${g.kind==="el"?g.el:g.stat}`:`${g.part}|${g.rarity}|${g.set}`;
  }
  static getActiveSetBonuses(b){
    const {armors}=this.getEquippedGear(b), counts={};
    armors.forEach(g=>{ counts[g.set]=(counts[g.set]||0)+1; });
    return Object.entries(counts).filter(([,n])=>n>=2).map(([id,n])=>({set:this.GEAR_SETS[id],count:n,tier:n>=4?4:2}));
  }
  static gearBonus(b,k){
    const {armors,rings}=this.getEquippedGear(b);
    let sum=0;
    armors.forEach(g=>{ if(this.PART_STAT[g.part]===k) sum+=this.GEAR_BONUS[g.rarity]||0; });
    rings.forEach(r=>{ if(r.kind==="stat"&&r.stat===k) sum+=this.RING_STAT_BONUS[r.rarity]||0; });
    return sum;
  }
  static getAllSynergies(b,skillIds=[]){
    const counts={};
    (skillIds||[]).forEach(id=>{ const s=this.SKILLS[id]; if(s) counts[s.el]=(counts[s.el]||0)+1; });
    const {rings}=this.getEquippedGear(b);
    rings.forEach(r=>{ if(r.kind==="el"&&Number.isInteger(r.el)) counts[r.el]=(counts[r.el]||0)+1; });
    return Object.entries(counts).filter(([,n])=>n>=2).map(([el,n])=>{
      const tier=n>=3?3:2, idx=tier-2, def=this.EL_SYNERGIES[+el];
      return {el:+el,count:n,tier,icon:this.EL_ICON[+el],name:this.ELEMENTS[+el],col:this.EL_COL[+el],desc:tier===3?def.p3:def.p2,def,idx};
    });
  }
  static rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a}
  static pick(a){return a[Math.floor(Math.random()*a.length)]}
  // Loterie de départ : budget fixe réparti au hasard, minimum garanti partout
  static START_POINTS = 20; static START_MIN = 1;
  static rollStartStats(total=this.START_POINTS, min=this.START_MIN){
    const keys=["hp","str","agi","spd"], st={}; keys.forEach(k=>st[k]=min);
    const rest=total-min*keys.length; if(rest<=0) return st;
    const w=keys.map(()=>-Math.log(1-Math.random())), sw=w.reduce((a,b)=>a+b,0);
    const raw=w.map(x=>x/sw*rest), fl=raw.map(Math.floor);
    let left=rest-fl.reduce((a,b)=>a+b,0);
    raw.map((x,i)=>({i,r:x-Math.floor(x)})).sort((a,b)=>b.r-a.r).slice(0,left).forEach(o=>fl[o.i]++);
    keys.forEach((k,i)=>st[k]+=fl[i]);
    return st;
  }
}
// Chemins des brutes générés depuis assetPath
DataEngine.BRAWLERS.forEach(k => {
  DataEngine.SPRITES[k] = {
    portrait: assetPath.portrait(k),
    sprite:   assetPath.sprite(k),
    planches: [1, 2, 3, 4].map(n => assetPath.sheet(k, n))
  };
});

/* ================= CompanionData ================= */
class CompanionData {
  static LEVEL_CAP = 20;
  // Évolutions : name:null = forme pas encore définie (le nom actuel est conservé jusqu'à son implémentation)
  static SPECIES = {
    chien_friche:{ base:"Chien de friche", forms:[
      {form:1, minLevel:1,  name:"Chien de friche", legendary:false},
      {form:2, minLevel:10, name:null, legendary:false},
      {form:3, minLevel:20, name:null, legendary:true}
    ]}
  };
  static create(species="chien_friche"){
    return {name:this.SPECIES[species].base, species, level:1, xp:0, xpMax:100, form:1};
  }
  static formFor(c){
    const fs=(this.SPECIES[c.species]||this.SPECIES.chien_friche).forms; let f=1;
    fs.forEach(x=>{ if(c.level>=x.minLevel) f=x.form; });
    return f===3&&!c.formeFinale&&c.form!==3?2:f;
  }
  // XP reçue en même temps que la Brute. Retourne {levels, evolved, form}
  static gainXp(c,xp){
    const r={levels:0,evolved:false,form:c.form||1};
    if(!c.xpMax) c.xpMax=100;
    if(c.level>=this.LEVEL_CAP){ c.xp=0; return r; }
    c.xp+=xp;
    while(c.xp>=c.xpMax && c.level<this.LEVEL_CAP){ c.xp-=c.xpMax; c.level++; c.xpMax=Math.round(c.xpMax*1.25); r.levels++; }
    if(c.level>=this.LEVEL_CAP) c.xp=0;
    const nf=this.formFor(c);
    if(nf!==(c.form||1)){
      c.form=nf; r.evolved=true; r.form=nf;
      const def=(this.SPECIES[c.species]||this.SPECIES.chien_friche).forms.find(x=>x.form===nf);
      if(def&&def.name) c.name=def.name;      // hook : nom de forme appliqué dès qu'il sera défini
    }
    return r;
  }
  static transmute(c){
    if(!c || c.level < this.LEVEL_CAP || c.form === 3) return false;
    c.formeFinale = true;
    c.form = 3;
    const def = (this.SPECIES[c.species] || this.SPECIES.chien_friche).forms.find(x => x.form === 3);
    if(def && def.name) c.name = def.name;
    return true;
  }
}

/* ================= ProfileManager ================= */
class ProfileManager {
  static KEY = "arene_brutes_v1";
  static MAX = 5; static mem = null;
  // Variables permanentes (hors slots) : elles survivent aux réinitialisations de niveau d'une Brute
  static norm(d){
    while(d.slots.length<this.MAX) d.slots.push(null);
    d.version=2;
    if(typeof d.mutant_souls!=="number"||!isFinite(d.mutant_souls)||d.mutant_souls<0) d.mutant_souls=0;
    const ab=(d.ascension_buffs&&typeof d.ascension_buffs==="object")?d.ascension_buffs:{};
    d.ascension_buffs={hp:+ab.hp||1,str:+ab.str||1,agi:+ab.agi||1,spd:+ab.spd||1};   // multiplicateurs (1 = aucun bonus)
    const s=(d.settings&&typeof d.settings==="object")?d.settings:{};
    d.settings={speed:[1,2,4].includes(+s.speed)?+s.speed:1};
    return d;
  }
  static load(){
    try{
      const d = JSON.parse(localStorage.getItem(this.KEY));
      if(d && Array.isArray(d.slots)) return this.norm(d);
    }catch(e){}
    return this.norm(this.mem ? JSON.parse(JSON.stringify(this.mem)) : {slots:Array(this.MAX).fill(null)});
  }
  static getSouls(){ return this.load().mutant_souls; }
  static addSouls(n){ const d=this.load(); d.mutant_souls=Math.max(0,d.mutant_souls+Math.round(n)); this.save(d); return d.mutant_souls; }
  static getBuffs(){ return this.load().ascension_buffs; }
  static setBuff(stat,mult){ const d=this.load(); if(stat in d.ascension_buffs && mult>0){ d.ascension_buffs[stat]=mult; this.save(d); } return d.ascension_buffs; }
  static getSpeed(){ return this.load().settings.speed; }
  static setSpeed(s){ const d=this.load(); d.settings.speed=[1,2,4].includes(s)?s:1; this.save(d); }
  static save(d){ this.mem=JSON.parse(JSON.stringify(d)); try{ localStorage.setItem(this.KEY, JSON.stringify(d)); return true; }catch(e){ return false; } }
  static add(brute){
    const d=this.load(), i=d.slots.findIndex(s=>!s);
    if(i<0) return -1;
    d.slots[i]=brute; this.save(d); return i;
  }
  static update(brute){
    const d=this.load(), i=d.slots.findIndex(s=>s&&s.id===brute.id);
    if(i>=0){ d.slots[i]=brute; this.save(d); }
  }
  static remove(i){ const d=this.load(); d.slots[i]=null; this.save(d); }
}

// Lignées de compagnons (Canidés / Ursidés / Rapaces)
CompanionData.SPECIES.chien_friche.forms[1].name="Loup cybernétique"; CompanionData.SPECIES.chien_friche.forms[2].name="Cerbère Radioactif";
CompanionData.SPECIES.ours_decharge={base:"Ourson de décharge",forms:[{form:1,minLevel:1,name:"Ourson de décharge"},{form:2,minLevel:10,name:"Grizzly des ruines"},{form:3,minLevel:20,name:"Béhémoth Blindé",legendary:true}]};
CompanionData.SPECIES.aigle_veille={base:"Aigle de surveillance",forms:[{form:1,minLevel:1,name:"Aigle de surveillance"},{form:2,minLevel:10,name:"Aigle Géant des Friches"},{form:3,minLevel:20,name:"Phénix de Plasma",legendary:true}]};

// Bestiaire : 13 familles × 3 stades (Base → Milieu → Légende). "species" relie une famille aux espèces déjà codées dans SPECIES.
// spec = spécialité de combat affichée sur la fiche (modifiable) ; legend = bonus réel du stade Légende, si déjà implémenté.
CompanionData.EVO_LEVELS=[1,10,20];
CompanionData.FAMILIES=[
  {key:"chien",     icon:"🐕", name:"Chien",       stages:["Cyber-Chauve","Orthros","Cerbère"],                spec:"Vitesse et Harcèlement",          species:"chien_friche",  legend:"Légende : dégâts ×1,6 et attaque rapide"},
  {key:"loup",      icon:"🐺", name:"Loup",        stages:["Loup-Mutant","Amarok","Fenrir"],                   spec:"Traque et Morsures critiques",    legend:"Légende : coup critique garanti (+50 % dégâts)"},
  {key:"ours",      icon:"🐻", name:"Ours",        stages:["Ours-Broyeur","Nandi","Béhémoth"],                 spec:"Force brute et Étourdissement",   species:"ours_decharge", legend:"Légende : étourdit à coup sûr"},
  {key:"serpent",   icon:"🐍", name:"Serpent",     stages:["Cyber-Vipère","Basilic","Hydre"],                  spec:"Poison et Contrôle",              legend:"Légende : poison virulent sur 3 tours"},
  {key:"oiseau",    icon:"🦅", name:"Oiseau",      stages:["Cyber-Moineau","Roc-Mineur","Phénix"],             spec:"Précision et Frappes aériennes",  species:"aigle_veille",  legend:"Légende : esquive impossible + brûlure"},
  {key:"arthropode",icon:"🦂", name:"Arthropode",  stages:["Gratte-Terre","Chitin-Garde","Manticore"],         spec:"Armure et Contre-attaque",        legend:"Légende : renvoie 40 % des dégâts (3 tours)"},
  {key:"felin",     icon:"🐈", name:"Félin",       stages:["Cyber-Gouttière","Lynx-Traqueur","Sphinx"],        spec:"Esquive et Embuscade",            legend:"Légende : +25 % d'esquive à la Brute (3 tours)"},
  {key:"taureau",   icon:"🐂", name:"Taureau",     stages:["Cyber-Biquet","Khalkotauroi","Minotaure"],         spec:"Charge et Impact",                legend:"Légende : ignore l'armure + propulsion"},
  {key:"aquatique", icon:"🐙", name:"Aquatique",   stages:["Néon-Sangsue","Leviathan-Proto","Kraken"],         spec:"Drain et Étreinte",               legend:"Légende : soigne la Brute de 15 % PV max"},
  {key:"chimere",   icon:"🦁", name:"Chimère",     stages:["Scrap-Raton","Griffon-Basse-Cour","Chimère"],      spec:"Polyvalence hybride",             legend:"Légende : dissipe les bonus + ralentit"},
  {key:"lezard",    icon:"🦎", name:"Lézard",      stages:["Éco-Lézard","Raiju-Shiba","Kirin"],                spec:"Réflexes et Affinité élémentaire",legend:"Légende : confère Surtension (vitesse +30 %)"},
  {key:"spectre",   icon:"👻", name:"Spectre",     stages:["Néon-Chiot","Bakeneko","Nekomata"],                spec:"Illusions et Malédictions",       legend:"Légende : −25 % précision adverse + brûlure"},
  {key:"tempete",   icon:"⛈️", name:"Tempête",     stages:["Scrap-Piaf","Condor-Glaive","Thunderbird"],        spec:"Foudre et Dégâts de zone",        legend:"Légende : frappe électrique + 50 % étourdissement"}
];
CompanionData.FAMILIES.forEach(f=>{
  if(!f.species) f.species=f.key;
  if(!CompanionData.SPECIES[f.species]){
    CompanionData.SPECIES[f.species]={
      base:f.stages[0],
      forms:[
        {form:1,minLevel:1,name:f.stages[0],legendary:false},
        {form:2,minLevel:10,name:f.stages[1],legendary:false},
        {form:3,minLevel:20,name:f.stages[2],legendary:true}
      ]
    };
  }
  [1,2,3].forEach(form=>{ DataEngine.PET_SHEETS[f.species+":"+form]=DataEngine.getCompanionArt(f.key,form); });
});
CompanionData.family=function(c){ return this.FAMILIES.find(f=>f.species===c.species||f.key===c.species)||null; };

/* ================= ForgeSystem ================= */
class ForgeSystem {
  static key(g){ return DataEngine.gearSig(g); }
  static autoFuse(b){
    let n=0,div=0;
    for(;;){
      const gs=this.groups(b).filter(g=>g.n>=3&&g.rarity<5);
      if(!gs.length) break;
      const x=this.fuse(b,gs[0].k); if(!x.ok) break;
      n++; if(x.rarity===5) div++;
    }
    return {n,div};
  }
  static groups(brute){
    const m={};
    (brute.gear||[]).forEach(g=>{
      const norm=DataEngine.normGearItem(g), k=this.key(norm);
      if(!m[k]) m[k]={k,part:norm.part,rarity:norm.rarity,set:norm.set,kind:norm.kind,stat:norm.stat,el:norm.el,n:0};
      m[k].n++;
    });
    return Object.values(m);
  }
  static fuse(brute,k){
    const parts=k.split("|"), part=parts[0], rar=+parts[1];
    if(rar>=5) return {ok:false,msg:"Rareté maximale déjà atteinte."};
    let idx=[]; (brute.gear||[]).forEach((g,i)=>{ if(this.key(g)===k) idx.push(i); });
    if(idx.length<3) return {ok:false,msg:"Il faut 3 équipements strictement identiques."};
    const sample=Object.assign({},DataEngine.normGearItem(brute.gear[idx[0]]));
    idx.slice(0,3).reverse().forEach(i=>brute.gear.splice(i,1));
    sample.rarity=rar+1;
    brute.gear.push(sample);
    return {ok:true,part,rarity:rar+1,item:sample};
  }
  static transmute(brute,k){
    const idx=(brute.gear||[]).findIndex(g=>this.key(g)===k);
    if(idx<0) return {ok:false,msg:"Pièce introuvable."};
    const item=DataEngine.normGearItem(brute.gear[idx]);
    if(item.part==="ring"){
      if(item.kind==="stat"){ item.kind="el"; item.el=DataEngine.rnd(0,6); delete item.stat; }
      else { const nextEl=(item.el+1)%7; if(nextEl===0){ item.kind="stat"; item.stat=DataEngine.pick(["hp","str","agi","spd"]); delete item.el; } else item.el=nextEl; }
    } else {
      const sets=["carnage","cyber","mutant"];
      item.set=sets[(sets.indexOf(item.set)+1)%sets.length];
    }
    return {ok:true,item};
  }
}

/* ================= GachaShop ================= */
class GachaShop {
  static PRICE = 100;
  static rollRarity(){
    const t=DataEngine.RARITIES.reduce((s,r)=>s+r.w,0); let x=Math.random()*t;
    for(const r of DataEngine.RARITIES){ if((x-=r.w)<0) return r.id; }
    return 0;
  }
  static rollGear(rarity=this.rollRarity()){
    const part=DataEngine.pick(DataEngine.PARTS);
    if(part.id==="ring"){
      const isEl=Math.random()<0.5;
      const item=isEl?{part:"ring",rarity,kind:"el",el:DataEngine.rnd(0,6)}:{part:"ring",rarity,kind:"stat",stat:DataEngine.pick(["hp","str","agi","spd"])};
      return {part,rarity,item};
    }
    const set=DataEngine.pick(["carnage","cyber","mutant"]);
    return {part,rarity,item:{part:part.id,rarity,set}};
  }
  static roll(brute){
    if(Math.random()<0.35){
      const w=DataEngine.pick(DataEngine.WEAPONS);
      if(brute.weapons.includes(w.id)) return {type:"dup",w};
      brute.weapons.push(w.id); return {type:"weapon",w};
    }
    const g=this.rollGear();
    brute.gear.push(g.item);
    return Object.assign({type:"gear"},g);
  }
  static open(brute){
    if(brute.gold<this.PRICE) return {ok:false,msg:"Pas assez d’Or."};
    brute.gold-=this.PRICE;
    const result=this.roll(brute);
    if(result.type==="dup") brute.gold+=25;
    return Object.assign({ok:true},result);
  }
}
