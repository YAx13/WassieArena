"use strict";
/* =====================================================================
   combat.js : moteur de combat « Arène des Brutes » (BattleEngine + arène + lancerCombat)
   À charger AVANT le script principal, APRÈS state.js :
     <script src="state.js"></script>  <script src="combat.js"></script>  <script> … </script>
   Puis, dans le script principal, appeler Combat.init() à la place de l'ancien câblage de l'arène.
   Utilise GameState (compétences équipées, Or) ; dépend à l'exécution de : S, $, $$, uid, genBrute, renderer, persist,
   OV, ProfileManager, DataEngine, CompanionData, CanvasRenderer, donnerRecompense, toast ;
   GameState (vip, skipsGratuits, maitriseArmes, gagnerXp).
   ===================================================================== */
/* ================= BattleEngine ================= */
class BattleEngine {
  static HP_PER_POINT = 10;     // 1 point de Vie = +10 PV réels
  static PET_CHANCE = .22; static WEAPON_CHANCE = .3;    // probabilité par tour de sortir une arme (si aucune compétence n'est déclenchée)
  // stat effective = stat de base x multiplicateur d'Ascension (buffs = null pour l'adversaire)
  static eff(b,k,bf){ return Math.max(1,Math.round((b.stats[k]+DataEngine.gearBonus(b,k))*((bf&&bf[k])||1))); }
  static maxHp(b,bf=null){ return 30+BattleEngine.eff(b,"hp",bf)*BattleEngine.HP_PER_POINT; }
  // Triangle élémentaire : Feu>Glace>Air>Terre>Électricité>Eau>Feu (Physique neutre) ; élément d'une Brute = 1re compétence non physique
  static BEATS={1:2,2:6,6:5,5:4,4:3,3:1};
  static elMult(a,d){ return BattleEngine.BEATS[a]===d?1.3:BattleEngine.BEATS[d]===a?.75:1; }
  static elOf(br){ const k=(br.skills||[]).map(id=>DataEngine.SKILLS[id]).find(s=>s&&s.el>0); return k?k.el:0; }
  constructor(a,b,buffs=null){
    [a,b].forEach(br=>{ if(!br.skills||!br.skills.length) br.skills=DataEngine.pickSkills(3); });
    this.f=[a,b].map((br,n)=>{ const bf=n===0?buffs:null, mx=BattleEngine.maxHp(br,bf);
      return {br,el:BattleEngine.elOf(br),name:br.name,max:mx,hp:mx,str:BattleEngine.eff(br,"str",bf),agi:BattleEngine.eff(br,"agi",bf),spd:BattleEngine.eff(br,"spd",bf),next:0,st:{stun:0,slow:0,spdUp:0,rage:0,accD:null,dr:null,dodge:null,reflect:null,dot:[],shield:0,block:0}}; });
    this.f.forEach(x=>x.next=(100/x.spd)*(.5+Math.random()*.5));
    this.h={}; this.round=0; this.over=false; this.winner=null;
  }
  on(e,fn){ (this.h[e]=this.h[e]||[]).push(fn); return this; }
  emit(e,p){ p.type=e; (this.h[e]||[]).forEach(fn=>fn(p)); }
  // compétence inutile à cet instant ? (évite de relancer un bonus déjà actif)
  useless(k,A,D){ const f=k.fx,s=A.st;
    return (f.dr&&s.dr)||(f.dodge&&s.dodge&&k.t==="S"&&k.pw===0)||(f.shield&&s.shield>0)||(f.block&&s.block)||(f.reflect&&s.reflect)||(f.rage&&s.rage)||(f.spdUp&&s.spdUp)||(f.heal&&A.hp/A.max>.7)||(f.dispel&&!(D.st.dr||D.st.dodge||D.st.rage||D.st.spdUp||D.st.shield||D.st.block||D.st.reflect)); }
  // Une action : initiative par Vitesse, touche/esquive par Agilité, dégâts par Force, compétence (≈40 %) selon sa fiche
  step(){
    if(this.over) return false;
    const i=this.f[0].next<=this.f[1].next?0:1, j=1-i, A=this.f[i], D=this.f[j], S=A.st, out=[];
    A.next+=(100/A.spd)*(.9+Math.random()*.2)*(S.slow>0?1.5:1)*(S.spdUp>0?.7:1); this.round++;
    let sk=null, wp=null, wl=null;
    if(Math.random()<.4){ for(let t=0;t<4&&!sk;t++){ const k=DataEngine.SKILLS[DataEngine.pick(A.br.skills)]; if(!this.useless(k,A,D)) sk=k; } }
    // Ordre au familier : attaque et effets propres aux 13 familles (Forme 1 -> 2 -> 3 Légendaire)
    const petChance = A.br.companion ? BattleEngine.PET_CHANCE + ((A.br.companion.form || 1) - 1) * 0.04 : 0;
    if(!sk && A.br.companion && Math.random() < petChance){
      const c = A.br.companion, fam = CompanionData.family(c), fk = fam ? fam.key : c.species, f = c.form || 1;
      let pw = 0.7 + c.level * 0.05, el = 0, fx = {};
      if(fk === "chien"){
        pw *= f === 3 ? 1.6 : f === 2 ? 1.2 : 1;
        A.next -= (100 / A.spd) * (f >= 2 ? 0.25 : 0.1);
      } else if(fk === "loup"){
        fx = { crit: f === 3 ? 1 : f === 2 ? 0.35 : 0.15 };
      } else if(fk === "ours"){
        pw *= 1.15;
        fx = { stun: f === 3 ? 1 : f === 2 ? 0.45 : 0.2 };
      } else if(fk === "serpent"){
        el = 3;
        fx = { dot: [f === 3 ? 1.2 : 0.7, f >= 2 ? 3 : 2, "poison"] };
      } else if(fk === "oiseau"){
        el = 1;
        fx = f === 3 ? { sure: 1, dot: [0.9, 2, "brûlure"] } : { sure: 1, acc: 20 };
      } else if(fk === "arthropode"){
        el = 5;
        fx = f === 3 ? { reflect: [0.4, 3] } : { dr: [f === 2 ? 0.25 : 0.15, 2] };
      } else if(fk === "felin"){
        el = 6;
        fx = { crit: 0.25, dodge: [f === 3 ? 25 : f === 2 ? 15 : 10, f === 3 ? 3 : 2] };
      } else if(fk === "taureau"){
        el = 5; pw *= 1.2;
        fx = f === 3 ? { pierce: 1, push: 1 } : f === 2 ? { pierce: 1 } : {};
      } else if(fk === "aquatique"){
        el = 3;
        fx = { heal: f === 3 ? 0.15 : f === 2 ? 0.08 : 0.04 };
      } else if(fk === "chimere"){
        fx = f === 3 ? { dispel: 1, slow: 2 } : f === 2 ? { slow: 2 } : { crit: 0.15 };
      } else if(fk === "lezard"){
        el = 4;
        fx = { spdUp: f === 3 ? 3 : f === 2 ? 2 : 1 };
      } else if(fk === "spectre"){
        el = 1;
        fx = f === 3 ? { accD: [f === 3 ? 25 : f === 2 ? 20 : 12, 2], dot: [0.8, 2, "brûlure"] } : { accD: [f === 2 ? 20 : 12, 2] };
      } else if(fk === "tempete"){
        el = 4; pw *= f === 3 ? 1.3 : 1.1;
        fx = { stun: f === 3 ? 0.5 : f === 2 ? 0.25 : 0.1 };
      }
      sk = { name: c.name, pet: c, el, t: "A", pw, fx, desc: "" };
    }
    // Recours à l'arme : si aucune compétence ce tour-ci, chance de sortir une arme débloquée (Estoc)
    if(!sk && A.br.weapons && A.br.weapons.length && Math.random()<BattleEngine.WEAPON_CHANCE){
      wp=DataEngine.WEAPONS[DataEngine.pick(A.br.weapons)];
      // Maîtrise d'Arme (joueur uniquement) : +10 % de puissance et +1 % de critique par niveau de maîtrise
      const m=(i===0&&GameState.maitriseArmes&&GameState.maitriseArmes[wp.id])||0;
      wl=wp.name+(m>0?" +"+m:"");
      sk={name:wl,weapon:wp,t:"A",pw:(.8+wp.dmg*.08)*(1+m*.10),fx:{acc:(wp.prec-5)*3,crit:(wp.crit-5)*.012+m*.01},desc:""};
      A.next-=(100/A.spd)*(wp.spd-5)*.03;    // l'arme influe légèrement sur la cadence
    }
    let dot=0; S.dot.forEach(d=>{dot+=d.dmg; d.n--}); S.dot=S.dot.filter(d=>d.n>0);
    if(dot){ A.hp=Math.max(0,A.hp-dot); out.push({type:"on_dot",i,j,dmg:dot,hpA:A.hp,msg:A.name+" subit "+dot+" dégâts d’altération."}); }
    const stunned=A.hp>0&&S.stun>0, dead=A.hp<=0;
    if(stunned) S.stun--;
    this.emit("on_attack",{i,j,round:this.round,self:!!(stunned||dead||(sk&&sk.pw===0)),skill:sk&&!wp?sk.name:null,weapon:wp?{name:wl,icon:wp.icon,id:wp.id}:null,pet:sk&&sk.pet?{name:sk.pet.name,species:sk.pet.species,form:sk.pet.form||1}:null,msg:dead?A.name+" vacille…":stunned?A.name+" est étourdi et perd son tour.":sk&&sk.pet?A.name+" siffle : "+sk.pet.name+" passe à l’attaque !":wp?A.name+" sort "+wp.icon+" "+wl+" et porte un estoc !":sk?A.name+" utilise "+sk.name+" !":A.name+" fonce en avant !"});
    out.forEach(e=>this.emit(e.type,e));
    if(dead){ this.over=true; this.winner=j; this.emit("on_death",{i,j,dead:i,msg:A.name+" succombe à ses blessures."}); }
    else if(!stunned){
      const fx=Object.assign({},sk?sk.fx:{}), fl=[];
      let pw=sk?sk.pw:1;
      DataEngine.getSynergies(A.br.skills||[]).forEach(syn=>{
        if(sk&&sk.el===syn.el&&syn.def.dmg) pw*=syn.def.dmg[syn.idx];
        if(syn.def.crit) fx.crit=(fx.crit||0)+syn.def.crit[syn.idx];
        if(syn.def.heal&&fx.heal) fx.heal*=syn.def.heal[syn.idx];
      });
      if(pw>0){
        const acc=Math.max(15,Math.min(95,75+(A.agi-D.agi)*1.5+(fx.acc||0)-(S.accD?S.accD.v:0)-(D.st.dodge?D.st.dodge.v:0)));
        if(D.st.block){ D.st.block=0; this.emit("on_dodge",{i,j,msg:D.name+" bloque le coup derrière un mur de gravats !"}); }
        else if(fx.sure||Math.random()*100<acc){
          const crit=Math.random()<.08+A.agi*.003+(fx.crit||0);
          const m=pw*BattleEngine.elMult(sk?sk.el||0:0,D.el)*(crit?1.5:1)*(S.rage?1+(1-A.hp/A.max)*.8:1)*(D.st.dr?1-D.st.dr.v:1);
          let dmg=Math.max(1,Math.round((A.str*.95+1+Math.random()*4-D.br.stats.hp*.03*(1-(fx.pierce?1:0)))*m));
          if(D.st.shield>0){ const x=Math.min(D.st.shield,dmg); D.st.shield-=x; dmg-=x; if(x) fl.push("le bouclier absorbe "+x); }
          D.hp=Math.max(0,D.hp-dmg);
          let back=0; if(D.st.reflect&&dmg>0) back+=Math.round(dmg*D.st.reflect.v); if(fx.recoil) back+=Math.round(dmg*fx.recoil);
          if(back){ A.hp=Math.max(1,A.hp-back); fl.push(A.name+" encaisse "+back+" de recul"); }
          this.emit("on_hit",{i,j,dmg,crit,prop:!!fx.push,hp:D.hp,hpA:A.hp,msg:crit?"Coup critique : -"+dmg+" HP !":D.name+" perd "+dmg+" HP."});
          if(D.hp>0){
            if(fx.stun&&Math.random()<fx.stun){ D.st.stun=1; fl.push(D.name+" est étourdi"); }
            if(fx.dot){ D.st.dot.push({dmg:Math.max(2,Math.round(A.str*.3*fx.dot[0])),n:fx.dot[1]}); fl.push(D.name+" subit "+fx.dot[2]); }
            if(fx.slow){ D.st.slow=fx.slow; fl.push(D.name+" est ralenti"); }
            if(fx.accD){ D.st.accD={v:fx.accD[0],n:fx.accD[1]}; fl.push("la précision de "+D.name+" chute"); }
            if(fx.delay){ D.next+=(100/D.spd)*fx.delay; fl.push(D.name+" perd l’initiative"); }
            if(fx.dispel){ Object.assign(D.st,{dr:null,dodge:null,rage:0,spdUp:0,shield:0,block:0,reflect:null}); fl.push("les bonus de "+D.name+" sautent"); }
          }
          if(fx.selfDelay){ A.next+=(100/A.spd)*fx.selfDelay; fl.push(A.name+" met du temps à récupérer"); }
        } else this.emit("on_dodge",{i,j,msg:D.name+" esquive !"});
      }
      // Application des synergies élémentaires actives sur la Brute
      const syns = DataEngine.getSynergies(A.br.competencesEquipees || A.br.skills || []);
      syns.forEach(syn => {
        if (sk && sk.el === syn.el && syn.def.dmg) pw *= syn.def.dmg[syn.idx];
        if (syn.def.crit) fx.crit = (fx.crit || 0) + syn.def.crit[syn.idx];
        if (syn.def.heal && fx.heal) fx.heal *= syn.def.heal[syn.idx];
      });
      if(sk&&(sk.t!=="A"||pw===0||sk.pet)){   // effets sur soi (compétences de soutien ou passifs de familier)
        if(fx.dr) S.dr={v:fx.dr[0],n:fx.dr[1]}; if(fx.dodge) S.dodge={v:fx.dodge[0],n:fx.dodge[1]}; if(fx.reflect) S.reflect={v:fx.reflect[0],n:fx.reflect[1]};
        if(fx.rage) S.rage=fx.rage; if(fx.spdUp) S.spdUp=fx.spdUp; if(fx.block) S.block=1; if(fx.shield) S.shield=Math.round(8+A.str*fx.shield);
        if(fx.cleanse){ S.dot=[]; S.stun=0; S.slow=0; S.accD=null; }
        if(fx.heal){ A.hp=Math.min(A.max,A.hp+Math.round(A.max*fx.heal)); }
      }
      if(fl.length||pw===0) this.emit("on_skill",{i,j,hp:D.hp,hpA:A.hp,fl:sk?sk.name:"",msg:sk&&pw===0?sk.name+" : "+sk.desc:fl.join(", ")+"."});
      if(D.hp<=0){ this.over=true; this.winner=i; this.emit("on_death",{i,j,dead:j,msg:D.name+" s’effondre."}); }
    }
    // fin d’action : usure des effets de l’acteur
    ["slow","spdUp","rage"].forEach(k=>{ if(S[k]>0) S[k]--; });
    ["accD","dr","dodge","reflect"].forEach(k=>{ if(S[k]&&--S[k].n<=0) S[k]=null; });
    if(!this.over && this.round>=200){ this.over=true; this.winner=this.f[0].hp/this.f[0].max>=this.f[1].hp/this.f[1].max?0:1; }
    if(this.over) this.emit("on_end",{winner:this.winner,msg:this.f[this.winner].name+" remporte le combat !"});
    return true;
  }
  run(){ while(this.step()); return this.winner; }
}

/* ================= Arène / Combat ================= */
const Combat={
  act:false,done:false,V:[],P:[],fl:[],q:[],ph:null,eng:null,mode:"",shake0:-1e6,
  cfg:null,pv:null,file:[],idx:0,carry:0,tues:0,degats:0,pas:0,baseStr:1,baseSpd:1,niv:1,pan:1,arTriptyque:null,ready:false,preview:false,
  lg(m,c){ const L=$("#log"),d=document.createElement("div"); d.textContent="> "+m; if(c) d.className=c; L.appendChild(d); while(L.children.length>400) L.removeChild(L.firstChild); L.scrollTop=L.scrollHeight; },
  cls(e){ return e.type==="on_hit"&&e.crit?"crit":e.type==="on_end"?"win":""; },
  setA(f,n,c){ if(f.anim!==n||n==="hit"||n==="dodge"){ f.anim=n; f.t0=c; } },
  /* ================= API universelle (voir lancerCombat) ================= */
  lancer(cfg){
    const pl=S.cur; if(!pl) return false;
    cfg=Object.assign({mode:"triptyque"},cfg||{});
    if(!["triptyque","vagues","endurance"].includes(cfg.mode)) cfg.mode="triptyque";
    this.cfg=cfg; this.mode=cfg.mode; this.ready=!!cfg.deferStart; this.preview=false;
    $("#g-combat").classList.toggle("world-boss-screen",!!(cfg.worldBoss||cfg.cleanUI));
    $("#g-combat").classList.toggle("expedition-screen",!!cfg.cleanUI);
    $("#btn-again").classList.toggle("hidden",!!cfg.worldBoss);
    $("#worldboss-actions").classList.add("hidden");
    if(!OV.stack.includes("pvp")&&!OV.stack.includes("combat")) OV.open("combat");   // ouvre l'écran de combat si besoin
    const bar=$("#g-combat .ov-bar .termbar"); if(bar) bar.textContent={triptyque:"Mode PvP",vagues:"Mode Vagues",endurance:"Mode Endurance"}[cfg.mode];
    // Vue du joueur : seules les compétences ÉQUIPÉES (GameState) sont jouées en combat ; la vraie brute n'est pas modifiée
    this.pv=Object.create(pl);
    const eq=((typeof GameState!=="undefined"&&GameState.competencesEquipees)||[]).filter(id=>pl.skills.includes(id));
    this.pv.skills=(eq.length?eq:pl.skills).slice(0,Math.max(1,pl.slotsCompetences||3));
    (cfg.competencesBonus||[]).forEach(id=>{ if(!this.pv.skills.includes(id)) this.pv.skills.push(id); });   // compétences TEMPORAIRES de ce combat (draft de raid), hors slots
    this.niv=cfg.niveau||pl.level; this.file=this.construireFile(cfg);
    this.idx=0; this.carry=0; this.tues=0; this.degats=0; this.pas=0;
    this.pan=cfg.mode==="triptyque"?1:-1;       // pan -1 : pas de triptyque, pas de propulsion, décor = config.fond
    this.fade=0; this.done=false; this.fl=[]; this.q=[]; this.shake0=-1e6; this.proj=null; this.amp=5;
    renderer.ar=cfg.mode==="triptyque"?this.arTriptyque:{"-1":this.fondCanvas(cfg.fond,cfg.fondSecours)};
    this.majMonetisation();
    const sp=this.vitesse(); renderer.setSpeed(sp); $$(".speed [data-spd]").forEach(x=>x.classList.toggle("active",+x.dataset.spd===sp));   // vitesse persistante
    const c=renderer.clock; this.V=[]; this.P=[];
    this.spawn(c,true);
    $("#endscreen").className="end hidden"; if($("#log").children.length) this.lg("────────────────────────");   // le journal est conservé
    this.annonce(true);
    this.act=!this.ready; this.ph=this.ready?null:{k:"intro",t:c+700};
    return true;
  },
  startReady(competencesBonus=[]){
    if(!this.ready||!this.eng||!this.cfg) return false;
    this.cfg.competencesBonus=competencesBonus.slice();
    this.pv.skills=this.pv.skills.concat(competencesBonus.filter(id=>!this.pv.skills.includes(id)));
    this.ready=false; this.act=true; this.done=false; this.ph={k:"intro",t:renderer.clock+700};
    this.majMonetisation();
    return true;
  },
  relancer(){ if(this.cfg) this.lancer(this.cfg); },
  showPreview(){
    const b=S.cur; if(!b||this.act||this.ready) return;
    const max=BattleEngine.maxHp(b,ProfileManager.getBuffs()), c=renderer.clock;
    this.cfg={mode:"triptyque"}; this.mode="triptyque"; this.pan=-1; this.preview=true;
    this.V=[{b,name:b.name,x:90,bx:90,y:188,flip0:false,flip:false,anim:"idle",t0:c,flash0:-1e6,
      hp:max,dh:max,lastHp:max,hit0:-1e6,max,win:false,air:0,wpn:null}];
    this.P=[]; this.fl=[]; this.proj=null; this.fade=0; this.shake0=-1e6;
    renderer.ar={"-1":this.fondCanvas("assets/backgrounds/pvp/arenaSet.jpg")};
    $("#g-combat").classList.remove("world-boss-screen");
    $("#endscreen").className="end hidden";
    $("#btn-again").classList.add("hidden");
    $("#worldboss-actions").classList.add("hidden");
  },
  // Décor : couleur ("#0f172a", "rgb()", "hsl()") ou chemin d'image ; rendu via un canvas 400x225 que drawArena prend pour une image
  // Décor : couleur ("#0f172a", "rgb()", "hsl()") ou chemin d'image cadré sans rognage (contain)
  fondCanvas(fond,secours="#14110d"){
    const f=String(fond||secours), couleur=/^(#|rgb|hsl)/i.test(f);
    if(couleur){
      const cv=document.createElement("canvas"); cv.width=800; cv.height=450; cv.complete=true; cv.naturalWidth=800; cv.naturalHeight=450;
      const g=cv.getContext("2d"); g.fillStyle=f; g.fillRect(0,0,800,450);
      return cv;
    }
    const im=new Image();
    im.secours=secours;
    im.src=encodeURI(f);
    return im;
  },
  // Ennemi à partir d'une définition (voir ENNEMIS_COMBAT). Stats = points de départ du joueur (20 + niveau-1) x mult
  creerEnnemi(def,niv,mult,role){
    const D=DataEngine, key="ennemi_"+def.id;
    if(!D.SPRITES[key]) D.SPRITES[key]={portrait:def.portrait||"",sprite:def.png||"",planches:def.planches||[]};   // vide = placeholder géométrique
    return {id:uid(),name:def.nom,species:"Mutant",style:"rebelle",hue:def.hue,sprite:key,stats:D.rollStartStats(Math.max(8,Math.round((20+niv-1)*mult))),
      level:niv,weapons:[],gear:[],skills:D.pickSkills(role==="boss"?4:2),companion:null,placeholder:def.forme||"sbire",scale:def.scale||1,animationSet:def.animationSet,portraitBounds:def.portraitBounds,role};
  },
  // File d'adversaires : triptyque = 1 brute PvP ; endurance = 1 boss ; vagues = 2 vagues de 1 à 3 sbires + boss
  construireFile(cfg){
    const D=DataEngine, E=ENNEMIS_COMBAT, niv=this.niv, mk=(def,mult,role,x)=>Object.assign({brute:this.creerEnnemi(def,niv,mult,role)},x);
    if(cfg.mode==="triptyque") return [{brute:cfg.adversaire||genBrute(),vague:0}];
    const boss=cfg.boss||E.boss[0];
    if(cfg.mode==="endurance") return [mk(boss,cfg.puissance||1,"boss",{vague:0,infini:true})];
    const defs=cfg.sbires&&cfg.sbires.length?cfg.sbires:E.sbires, f=[];
    [0,1].forEach(v=>{ const n=Math.min(3,Math.max(1,(cfg.vagues&&cfg.vagues[v])||D.rnd(1,3)));
      for(let k=1;k<=n;k++) f.push(mk(D.pick(defs),cfg.puissanceSbires||.55,"sbire",{vague:v,rang:k,total:n})); });
    f.push(mk(boss,cfg.puissance||1.1,"boss",{vague:2,rang:1,total:1,pvMult:boss.pvMult||1.6}));
    return f;
  },
  // Crée le moteur du combat en cours (PV du joueur conservés d'un ennemi à l'autre) et les combattants affichés
  spawn(c,first){
    const ent=this.file[this.idx], en=ent.brute, E=this.eng=new BattleEngine(this.pv,en,ProfileManager.getBuffs());
    if(first){
      DataEngine.getSynergies(this.pv.skills||[]).forEach(syn=>{
        this.lg(`Synergie ${syn.icon} ${syn.name} (${syn.count}) : ${syn.desc}`,"crit");
      });
    }
    if(ent.infini){ const f=E.f[1]; f.max=f.hp=999999; this.baseStr=f.str; this.baseSpd=f.spd; }       // Endurance : PV « infinis » (rechargés à chaque action)
    else if(ent.pvMult){ const f=E.f[1]; f.max=f.hp=Math.round(f.max*ent.pvMult); }
    if(!first) E.f[0].hp=Math.min(E.f[0].max,Math.max(1,Math.round(this.carry)));
    ["on_attack","on_hit","on_dot","on_skill","on_dodge","on_death","on_end"].forEach(n=>E.on(n,e=>this.q.push(e)));
    const mk=(b,i)=>({b,name:b.name+(ent.infini&&i?" ∞":""),x:i?310:90,bx:i?310:90,y:188,flip0:!!i,flip:!!i,anim:"idle",t0:c,flash0:-1e6,hp:E.f[i].hp,dh:E.f[i].hp,lastHp:E.f[i].hp,hit0:-1e6,max:E.f[i].max,win:false,air:0,wpn:null,scale:b.scale||1,st:{}});
    if(first){
      this.V=[this.pv,en].map(mk);
      this.P=this.V.map((v,i)=>{ const cp=v.b.companion; if(!cp) return null; const hx=v.bx+(i?54:-54);
        return {pet:true,i,owner:v.b,key:cp.species+":"+(cp.form||1),x:hx,hx,y:v.y+2,flip:v.flip0,flip0:v.flip0,anim:"idle",t0:c,flash0:-1e6,win:false,air:0}; }).filter(Boolean);
    } else { this.V[1]=mk(en,1); this.V[0].hp=this.V[0].dh=E.f[0].hp; this.P=this.P.filter(p=>p.i===0); }
  },
  titre(){
    const ent=this.file[this.idx], en=ent.brute;
    if(this.mode==="triptyque") return "PvP : "+S.cur.name+" contre "+en.name;
    if(this.cfg.worldBoss) return en.name+" · "+this.degats+" dégâts";
    if(this.mode==="endurance") return "Endurance : "+en.name+" · dégâts infligés : "+this.degats;
    return "Vague "+(ent.vague+1)+"/3 · "+(ent.vague===2?"BOSS":"Ennemi "+ent.rang+"/"+ent.total)+" : "+en.name;
  },
  majTitre(){ $("#arena-title").textContent=this.titre(); },
  annonce(first){ this.majTitre(); this.lg((first?"Combat engagé : ":"Nouvel adversaire : ")+S.cur.name+" contre "+this.file[this.idx].brute.name+"."); },
  // Une action du moteur. Endurance : décompte des dégâts, PV du boss rechargés, enragement progressif (+15 % de Force et +10 % de Rapidité toutes les 5 actions)
  stepEng(){
    const E=this.eng, ent=this.file[this.idx]; E.step();
    E.f.forEach((f,k)=>{ if(this.V[k]) this.V[k].st=JSON.parse(JSON.stringify(f.st)); });
    if(ent.infini){
      const b=E.f[1];
      this.q.forEach(e=>{ if(e.type==="on_hit"&&e.i===0) this.degats+=e.dmg; if(e.type==="on_dot"&&e.i===1) this.degats+=e.dmg;
        if(e.i===1&&e.hpA!==undefined) e.hpA=b.max; if(e.j===1&&e.hp!==undefined) e.hp=b.max; });
      b.hp=b.max; E.round=0; this.pas++;                        // round=0 : pas de limite de 200 actions
      if(this.pas%5===0){ const pal=this.pas/5; b.str=Math.round(this.baseStr*(1+.15*pal)); b.spd=Math.max(1,Math.round(this.baseSpd*(1+.10*pal))); }
    }
  },
  stop(){ this.act=false; this.ready=false; this.preview=false; this.ph=null; $("#g-combat").classList.remove("world-boss-screen","expedition-screen"); },
  // Tableau des états d'attaque : a = anim, T = [fin course, fin attaque, fin retour] (ms), h = instant d'impact, rel = lâcher du projectile
  K:{punch:{a:"punch",T:[400,800,1100],h:480},estoc:{a:"thrust",T:[250,620,900],h:330},overhead:{a:"overhead",T:[450,950,1300],h:620,jump:24},
     throw:{a:"throw",T:[0,720,980],h:520,rel:220,ranged:1},uppercut:{a:"uppercut",T:[420,920,1250],h:560,amp:9},pierce:{a:"pierce",T:[260,700,1050],h:200,through:1,amp:9},
     meteor:{a:"meteor",T:[520,1100,1450],h:620,jump:40,amp:13},salto:{a:"salto",T:[0,950,1200],h:650,rel:500,ranged:1,amp:9},
     self:{a:"taunt",T:[0,700,700],h:200},idle:{a:"idle",T:[0,500,500],h:100}},
  next(c){
    this.q=[]; this.stepEng(); this.proj=null;
    const at=this.q[0], ev=this.q.slice(1), ht=ev.find(e=>e.type==="on_hit"), crit=!!(ht&&ht.crit), A=this.V[at.i], bx=this.V[at.j].bx, dir=at.i?-1:1;
    let kind;
    if(at.pet) kind="pet"; else if(at.self) kind=at.skill?"self":"idle";
    else if(at.weapon) kind=crit?{estoc:"pierce",overhead:"meteor",throw:"salto"}[DataEngine.WEAPON_STYLE[at.weapon.id]||"estoc"]:(DataEngine.WEAPON_STYLE[at.weapon.id]||"estoc");
    else kind=crit?"uppercut":"punch";
    const K=this.K[kind]||this.K.idle;
    this.ph={k:"act",kind,K,t0:c,i:at.i,j:at.j,ev,hit:0,wicon:at.weapon&&at.weapon.icon,
      tx:K.ranged||at.self||kind==="pet"?(kind==="pet"?bx+(at.i?42:-42):A.bx):K.through?bx-dir*60:bx+(at.i?46:-46)};
    this.amp=K.amp||5; A.wpn=at.weapon&&!at.pet?{ic:at.weapon.icon,id:at.weapon.id}:null;
    if(kind==="pet"){ this.ph.pt=this.P.find(p=>p.i===at.i); }
    this.lg(at.msg);
  },
  impact(p,c){
    if(this.mode==="endurance") this.majTitre();
    const d=this.V[p.j], dying=p.ev.some(e=>e.type==="on_death"&&e.dead===p.j);
    for(const e of p.ev){
      this.lg(e.msg,this.cls(e));
      if(e.type==="on_hit"){
        d.hp=e.hp; d.flash0=c; this.shake0=c; if(e.crit||p.kind==="pet") renderer.freeze(100);
        this.V[p.i].hp=e.hpA; this.fl.push({s:e.dmg>0?"-"+e.dmg:"Absorbé",x:d.bx,y:d.y-CanvasRenderer.HEAD,c0:c,col:e.crit?"#ffb000":"#ffffff",big:e.crit});
        if((e.crit||e.prop)&&this.pan===1) p.prop=p.j;   // propulsion possible UNIQUEMENT depuis l'arène centrale
        if(!dying||e.crit) this.setA(d,"hit",c);
      }
      if(e.type==="on_dodge"){ this.setA(d,"dodge",c); this.fl.push({s:"Esquive",x:d.bx,y:d.y-CanvasRenderer.HEAD,c0:c,col:"#e8a830"}); }
      if(e.type==="on_dot"){ const a=this.V[e.i]; a.hp=e.hpA; a.flash0=c; this.fl.push({s:"-"+e.dmg,x:a.bx,y:a.y-CanvasRenderer.HEAD,c0:c,col:"#c58be0"}); }
      if(e.type==="on_skill"){ const a=this.V[e.i], t=this.V[e.j]; if(e.hpA>a.hp) this.fl.push({s:"+"+(e.hpA-a.hp),x:a.bx,y:a.y-CanvasRenderer.HEAD,c0:c,col:"#9be15d"}); a.hp=e.hpA; t.hp=e.hp; if(e.fl) this.fl.push({s:e.fl,x:a.bx,y:a.y-CanvasRenderer.HEAD-24,c0:c,col:"#ffd27a"}); }
      if(e.type==="on_death"&&(e.dead!==p.j||p.prop==null)){
        const dead=this.V[e.dead];
        if(this.cfg&&this.cfg.worldBoss){ dead.win=false; this.setA(dead,"idle",c); }
        else this.setA(dead,"death",c);
        const pt=this.P.find(q=>q.i===e.dead); if(pt&&!(this.cfg&&this.cfg.worldBoss)) this.setA(pt,"death",c);
      }
    }
  },
  tick(c){
    const p=this.ph; if(!this.act||!p) return;
    if(p.k==="intro"){ if(c>=p.t) this.next(c); return; }
    if(p.k==="end"){ if(c>=p.t){ this.ph=null; this.finish(); } return; }
    if(p.k==="prop"){ this.prop(p,c); return; }
    if(p.k==="swap"){ if(c>=p.t){ this.idx++; this.fl=[]; this.spawn(c,false); this.annonce(false); this.ph={k:"intro",t:c+500}; } return; }   // ennemi suivant
    const e=c-p.t0, a=this.V[p.i];
    if(p.kind==="pet"){ this.tickPet(p,c,e,a); return; }
    const K=p.K, T=K.T, d=this.V[p.j];
    if(!p.hit&&e>=K.h){ p.hit=1; this.impact(p,c); }
    if(K.rel&&e>=K.rel&&e<K.h){ a.wpn=null; if(!this.proj&&p.wicon) this.proj={ic:p.wicon,x0:a.bx+(p.i?-28:28),y0:a.y-48,x1:d.bx,y1:d.y-42,t0:p.t0+K.rel,t1:p.t0+K.h}; }
    if(e<T[0]){ const k=e/T[0]; a.x=a.bx+(p.tx-a.bx)*k; a.air=K.jump?Math.sin(Math.PI*k)*K.jump:0; a.flip=a.flip0; this.setA(a,"dash",p.t0); }
    else if(e<T[1]){ a.x=p.tx; a.air=0; a.flip=a.flip0; this.setA(a,K.a,p.t0+T[0]); }
    else if(e<T[2]){ a.wpn=null; a.x=p.tx+(a.bx-p.tx)*(e-T[1])/(T[2]-T[1]); a.flip=!a.flip0; this.setA(a,"dash",p.t0+T[1]); }
    else { a.wpn=null; a.air=0; a.x=a.bx; a.flip=a.flip0; this.setA(a,"idle",c);
      if(p.prop!=null){ this.ph={k:"prop",t0:c,j:p.prop,sw:0}; return; }
      this.after(c); }
  },
  // Séquence Dresseur : sifflet -> course du familier -> morsure (+freeze + shake) -> retour -> idle
  tickPet(p,c,e,a){
    const pt=p.pt; if(!pt){ this.after(c); return; }
    this.setA(a,e<650?"whistle":"idle",p.t0+(e<650?0:650));
    if(e<450){ this.setA(pt,"idle",p.t0); }
    else if(e<950){ pt.x=pt.hx+(p.tx-pt.hx)*(e-450)/500; pt.flip=pt.flip0; this.setA(pt,"run",p.t0+450); }
    else if(e<1300){ pt.x=p.tx; this.setA(pt,"bite",p.t0+950); if(!p.hit){ p.hit=1; this.amp=10; this.impact(p,c); } }
    else if(e<1800){ pt.x=p.tx+(pt.hx-p.tx)*(e-1300)/500; pt.flip=!pt.flip0; this.setA(pt,"run",p.t0+1300); }
    else { pt.x=pt.hx; pt.flip=pt.flip0; this.setA(pt,"idle",c);
      if(p.prop!=null){ this.ph={k:"prop",t0:c,j:p.prop,sw:0}; return; }
      this.after(c); }
  },
  after(c){
    const E=this.eng;
    if(E.over){
      if(E.winner===0&&this.idx<this.file.length-1){ this.tues++; this.carry=E.f[0].hp; this.ph={k:"swap",t:c+1000}; return; }   // il reste des ennemis
      if(this.cfg&&this.cfg.worldBoss){
        this.V.forEach(v=>{ v.win=false; v.air=0; v.x=v.bx; this.setA(v,"idle",c); });
        this.P.forEach(p=>this.setA(p,"idle",c));
      } else {
        const w=this.V[E.winner]; w.win=true; this.setA(w,"victory",c);
      }
      this.ph={k:"end",t:c+1300};
    }
    else this.next(c);
  },
  prop(p,c){   // propulsion critique : vol hors cadre, fondu au noir, arène secrète voisine
    const e=c-p.t0, d=this.V[p.j], dir=p.j?1:-1;
    if(e<650){ const k=e/650; d.x=d.bx+dir*k*k*520; d.air=Math.sin(Math.PI*k)*24; this.fade=Math.max(0,Math.min(1,(e-200)/450)); return; }
    if(!p.sw){
      p.sw=1; this.pan=Math.max(0,Math.min(2,1+dir));   // bascule DÉFINITIVE : plus de retour au centre ni de rebond
      this.V.forEach(v=>{v.x=v.bx;v.air=0;v.flip=v.flip0});
      this.lg("Propulsion ! Combat repris définitivement dans "+["l’arène secrète de gauche","l’arène centrale","l’arène secrète de droite"][this.pan]+".","crit");
      const w=this.eng.winner; if(this.eng.over&&this.eng.f[1-w].hp<=0) this.setA(this.V[1-w],"death",c); else this.setA(d,"idle",c);
    }
    if(e<1150){ this.fade=1-(e-650)/500; return; }
    this.fade=0; this.after(c);
  },
  skip(){
    if(!this.act||this.done||!this.eng) return;
    const p=this.ph;
    if(p&&p.k==="act"&&!p.hit) p.ev.forEach(e=>this.lg(e.msg,this.cls(e)));
    for(;;){   // résout tout le match, y compris les ennemis restants des vagues
      while(!this.eng.over){ this.q=[]; this.stepEng(); this.q.forEach(e=>this.lg(e.msg,this.cls(e))); }
      if(this.eng.winner===0&&this.idx<this.file.length-1){ this.tues++; this.carry=this.eng.f[0].hp; this.idx++; this.spawn(renderer.clock,false); this.annonce(false); continue; }
      break;
    }
    this.V.forEach((v,k)=>{
      const dead=this.eng.f[k].hp<=0; v.hp=v.dh=this.eng.f[k].hp; v.air=0; v.x=v.bx; v.flip=v.flip0;
      v.anim=dead?"death":this.eng.winner===k?"victory":"idle"; v.t0=dead?-1e6:renderer.clock; this.proj=null; v.win=this.eng.winner===k; v.wpn=null; v.dh=v.hp;
    });
    this.P.forEach(q=>{ const dd=this.eng.f[q.i].hp<=0; q.x=q.hx; q.anim=dd?"death":"idle"; q.t0=dd?-1e6:renderer.clock; });
    this.fade=0; this.ph=null; this.fl=[]; this.finish();
  },
  // Drop de victoire : 25 % d'obtenir une arme encore verrouillée OU une compétence (volée à l'adversaire si possible)
  rollDrop(b,en){
    if(Math.random()>=.25) return null;
    const W=DataEngine.WEAPONS.filter(w=>!b.weapons.includes(w.id));
    const pool=DataEngine.SKILLS.filter(k=>!b.skills.includes(k.id));
    if(W.length&&(Math.random()<.5||!pool.length)){ const w=DataEngine.pick(W); b.weapons.push(w.id); return {kind:"Arme",name:w.icon+" "+w.name}; }
    if(pool.length){
      const es=(en.skills||[]).filter(id=>!b.skills.includes(id)).map(id=>DataEngine.SKILLS[id]);
      const k=es.length?DataEngine.pick(es):DataEngine.pick(pool); b.skills.push(k.id); return {kind:"Compétence",name:k.name};
    }
    return null;
  },
  finish(){
    if(this.done) return; this.done=true;
    const E=this.eng, win=E.winner===0, b=S.cur, ent=this.file[this.idx], cfg=this.cfg;
    if(cfg.worldBoss){ this.act=false; this.ready=false; this.ph=null; }
    if(win) this.tues++;
    const res={mode:this.mode,victoire:win,pvRestants:Math.max(0,Math.round(E.f[0].hp)),pvMax:E.f[0].max};
    let titre=win?"VICTOIRE":"DÉFAITE", txt="";
    if(this.mode==="triptyque"){
      // Récompenses PvP d'origine (XP, Or, niveaux, compagnon, drop) ; désactivables avec config.recompenses=false
      const en=E.f[1].br, rw=cfg.recompenses!==false, xp=rw?(win?30:10):0, gold=rw?(win?40:10):0, lv=[];
      const nv0=b.level;
      if(xp>0) GameState.gagnerXp(xp);
      for(let n=nv0+1;n<=b.level;n++) lv.push("Niveau "+n+" !");
      const drop=rw&&win?this.rollDrop(b,en):null;
      if(gold>0) donnerRecompense("or",gold);
      Object.assign(res,{xp,or:gold,drop:drop?drop.name:null,niveauxGagnes:lv.length});
      this.lg("──── Récapitulatif : "+(win?"VICTOIRE":"DÉFAITE")+" ────",win?"win":"");
      this.lg("XP Brute ("+b.name+") : +"+xp+" XP — niv. "+b.level+", "+b.xp+"/"+b.xpMax+".");
      lv.forEach(m=>this.lg(m,"crit"));
      this.lg("Or amassé : +"+gold+" (total "+b.gold+").");
      this.lg("Drop : "+(drop?drop.kind+" — "+drop.name:"aucun")+".",drop?"crit":"");
      txt="+"+xp+" XP, +"+gold+" Or."+(drop?" Drop : "+drop.name+".":"")+(lv.length?" "+lv.join(" "):"");
    }
    else if(this.mode==="vagues"){
      Object.assign(res,{ennemisVaincus:this.tues,vaguesCompletes:win?3:ent.vague,bossVaincu:win});
      txt=win?"Boss vaincu ! "+this.tues+" ennemis terrassés.":"Tombé à la vague "+(ent.vague+1)+"/3 — "+this.tues+" ennemi(s) vaincu(s).";
      this.lg("──── "+(win?"VICTOIRE":"DÉFAITE")+" : "+txt+" ────",win?"win":"");
    }
    else {   // endurance : le joueur finit toujours par tomber, le score = dégâts totaux
      titre="FIN DE L’ENDURANCE"; res.victoire=false; Object.assign(res,{degatsTotal:this.degats,tours:this.pas});
      txt="Dégâts totaux infligés : "+this.degats+" en "+this.pas+" actions.";
      this.lg("──── ENDURANCE : "+txt+" ────","crit");
    }
    persist();
    $("#end-title").textContent=titre; $("#end-rewards").textContent=txt;
    $("#endscreen").className="end "+(win?"win":"lose");
    const customEnd = !!(cfg.worldBoss || cfg.raid || this.mode === "triptyque");
    $("#btn-again").classList.toggle("hidden", customEnd);
    $("#worldboss-actions").classList.toggle("hidden", !customEnd);
    if(typeof cfg.onFin==="function"){ try{ cfg.onFin(res); }catch(e){ console.error("onFin :",e); } }   // fin du match
  },
  // ----- Branchements (à appeler une fois, à la place de l'ancien câblage de l'arène) -----
  init(){
    this.arTriptyque=renderer.ar;                                            // triptyque d'origine (decors/arene-1..3.jpg)
    renderer.arena=this; renderer.arenaCv=$("#cv-arena"); renderer.tick=c=>this.tick(c);
    this.patchRenderer();
    OV.reg.combat={pane:"g-combat",onOpen(){ $("#g-combat").classList.remove("pvp-screen"); },onClose(){ $("#g-combat").classList.remove("pvp-screen"); Combat.stop(); }};   // écran de combat pour vagues / endurance
    $$(".speed [data-spd]").forEach(btn=>btn.onclick=()=>{
      if(+btn.dataset.spd===4&&!GameState.illimite){ toast("Vitesse x4 réservée au Pass VIP !"); return; }   // x4 = VIP ou mode dev
      renderer.setSpeed(+btn.dataset.spd); ProfileManager.setSpeed(+btn.dataset.spd); $$(".speed [data-spd]").forEach(x=>x.classList.toggle("active",x===btn)); });   // x1 / x2 / x4
    { const sp=this.vitesse(); renderer.setSpeed(sp); $$(".speed [data-spd]").forEach(x=>x.classList.toggle("active",+x.dataset.spd===sp)); }
    this.majMonetisation();
    $("#btn-skip").onclick=()=>{                                             // Skip : illimité en VIP, sinon quota quotidien
      if(this.cfg&&this.cfg.worldBoss&&!this.cfg.allowSkip) return;
      if(!GameState.illimite){
        if(!((GameState.skipsGratuits||0)>0)){ toast("Plus de Skip gratuit aujourd'hui (illimité avec le Pass VIP) !"); return; }
        if(!(this.act&&!this.done&&this.eng)) return;                        // aucun combat à passer : on ne consomme rien
        GameState.skipsGratuits--; persist(); this.majMonetisation();
      }
      renderer.skip();
    };
    $("#btn-again").onclick=()=>this.relancer();
    this.initDevGroupUI();
  },
  // Vitesse persistante ; le x4 est ramené à x2 si le joueur n'est pas VIP
  vitesse(){ let sp=ProfileManager.getSpeed(); if(sp===4&&!GameState.illimite){ sp=2; ProfileManager.setSpeed(2); } return sp; },
  // Monétisation confort : cadenas 🔒 sur x4 et compteur de Skips gratuits (à rappeler si le statut VIP change)
  majMonetisation(){
    const vip=!!GameState.illimite, b4=$('.speed [data-spd="4"]'), sk=$("#btn-skip");
    if(b4){ if(b4.dataset.lbl===undefined) b4.dataset.lbl=b4.textContent.replace(/^🔒\s*/,""); b4.textContent=(vip?"":"🔒 ")+b4.dataset.lbl; b4.classList.toggle("locked",!vip); }
    if(sk){
      if(sk.dataset.lbl===undefined) sk.dataset.lbl=sk.textContent.replace(/\s*\(\d+\)$/,"");
      sk.textContent=vip?sk.dataset.lbl:sk.dataset.lbl+" ("+Math.max(0,GameState.skipsGratuits||0)+")";
      sk.hidden=!!(this.cfg&&this.cfg.worldBoss&&!this.cfg.allowSkip);
    }
  },
  // Petites extensions de CanvasRenderer : échelle par combattant (boss) + placeholders géométriques des ennemis sans PNG
  patchRenderer(){
    const P=CanvasRenderer.prototype; if(P._combatPatched) return; P._combatPatched=true;
    const blit=P.blit, drawBrute=P.drawBrute;
    P.blit=function(ctx,f,c){
      const g=Combat.devGroup||{scale:1,dx:0,dy:0}, s=f.scale||1;
      const hasGroup=g.scale!==1||g.dx!==0||g.dy!==0;
      if(!hasGroup&&s===1) return blit.call(this,ctx,f,c);
      ctx.save();
      if(hasGroup){ ctx.translate(200+g.dx,188+g.dy); ctx.scale(g.scale,g.scale); ctx.translate(-200,-188); }
      if(s!==1){ ctx.translate(f.x,f.y); ctx.scale(s,s); ctx.translate(-f.x,-f.y); }
      blit.call(this,ctx,f,c);
      ctx.restore();
    };
    P.drawBrute=function(ctx,b,t,anim="idle",fi=null){
      if(b&&b.placeholder&&!DataEngine.spriteBase(b.sprite)) return placeholderEnnemi(ctx,b,t,anim,fi);
      return drawBrute.call(this,ctx,b,t,anim,fi); };
  },
  initDevGroupUI(){
    const KEY="dev_combat_group";
    try{ const raw=localStorage.getItem(KEY); if(raw) this.devGroup=Object.assign({scale:1,dx:0,dy:0},JSON.parse(raw)); }catch(_){}
    if(!this.devGroup) this.devGroup={scale:1,dx:0,dy:0};
    const host=document.getElementById("devbox");
    if(!host||document.getElementById("dev-combat-group")) return;

    const g=this.devGroup; let editing=false, backup={...g}, drag=null;
    const box=document.createElement("div");
    box.id="dev-combat-group";
    box.style.cssText="margin-top:8px;padding-top:6px;border-top:1px dashed #596b59;pointer-events:auto";
    box.innerHTML=`<div style="display:flex;gap:4px;align-items:center">
        <button type="button" id="dcg-toggle" style="flex:1;padding:3px 6px;font:bold 11px monospace;cursor:pointer">📐 Repositionner</button>
        <button type="button" id="dcg-reset" title="Réinitialiser" style="padding:3px 6px;font:11px monospace;cursor:pointer">↺</button>
      </div>
      <div id="dcg-info" style="margin-top:3px;font-size:10px;color:#9f9">Groupe combat : ${g.scale.toFixed(2)}x · X ${g.dx} · Y ${g.dy}</div>
      <div id="dcg-help" class="hidden" style="margin-top:2px;font-size:10px;color:#ffe23d">Glisser sur l'arène = déplacer · Molette = taille</div>`;
    const pre=host.querySelector("pre");
    if(pre) pre.before(box); else host.appendChild(box);

    const btnToggle=box.querySelector("#dcg-toggle"), btnReset=box.querySelector("#dcg-reset"), info=box.querySelector("#dcg-info"), help=box.querySelector("#dcg-help");
    const cv=document.getElementById("cv-arena");
    const maj=()=>{ info.textContent=`Taille : ${g.scale.toFixed(2)}x · X : ${Math.round(g.dx)} · Y : ${Math.round(g.dy)}`; };
    const sauver=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(g)); }catch(_){} maj(); };

    const setEdit=on=>{
      editing=on;
      if(on){
        backup={...g};
        btnToggle.textContent="✔ Confirmer";
        btnToggle.style.background="#133818"; btnToggle.style.borderColor="#39ff14"; btnToggle.style.color="#39ff14";
        help.classList.remove("hidden");
        if(cv){ cv.style.cursor="move"; cv.style.outline="2px dashed #39ff14"; }
      } else {
        btnToggle.textContent="📐 Repositionner";
        btnToggle.style.background="#261a0c"; btnToggle.style.borderColor="#c9953a"; btnToggle.style.color="#ffd35c";
        help.classList.add("hidden");
        if(cv){ cv.style.cursor=""; cv.style.outline=""; }
      }
    };

    btnToggle.onclick=e=>{
      e.stopPropagation();
      if(!editing) setEdit(true);
      else { sauver(); setEdit(false); if(typeof toast==="function") toast("Position et taille du groupe confirmées !"); }
    };
    btnReset.onclick=e=>{
      e.stopPropagation();
      Object.assign(g,{scale:1,dx:0,dy:0});
      sauver();
      if(typeof toast==="function") toast("Groupe réinitialisé.");
    };

    if(cv){
      cv.addEventListener("pointerdown",e=>{
        if(!editing) return;
        e.preventDefault(); e.stopPropagation();
        cv.setPointerCapture(e.pointerId);
        const r=cv.getBoundingClientRect();
        drag={x:e.clientX,y:e.clientY,dx0:g.dx,dy0:g.dy,sx:400/(r.width||400),sy:225/(r.height||225)};
      });
      cv.addEventListener("pointermove",e=>{
        if(!editing||!drag) return;
        g.dx=Math.round(drag.dx0+(e.clientX-drag.x)*drag.sx);
        g.dy=Math.round(drag.dy0+(e.clientY-drag.y)*drag.sy);
        maj();
      });
      const endDrag=e=>{ if(drag){ drag=null; if(cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId); } };
      cv.addEventListener("pointerup",endDrag);
      cv.addEventListener("pointercancel",endDrag);
      cv.addEventListener("wheel",e=>{
        if(!editing) return;
        e.preventDefault(); e.stopPropagation();
        g.scale=Math.max(0.4,Math.min(2.5,+(g.scale+(e.deltaY<0?0.05:-0.05)).toFixed(2)));
        maj();
      },{passive:false});
    }
  }
};

/* ================= Ennemis (PLACEHOLDERS en attendant vos PNG) =================
   Tant que `png` / `planches` est vide, l'ennemi est dessiné en formes géométriques :
     forme "sbire" = carré + toit triangulaire · forme "boss" = losange + couronne (affiché x1.35).
   Pour activer un vrai sprite : png = "sprite/ennemis/rat.png" (grille 4x4 de 64x64, comme la PLANCHE 1 des brutes)
   ou planches = [P1, P2, P3, P4]. Ajoutez librement d'autres entrées. */
const ENNEMIS_COMBAT={
  sbires:[
    {id:"rat",   nom:"Rat de Décharge", hue:25,  forme:"sbire", png:""},   // PLACEHOLDER orange
    {id:"drone", nom:"Drone Rouillé",   hue:200, forme:"sbire", png:""},   // PLACEHOLDER bleu
    {id:"garde", nom:"Garde Wass-E",    hue:50,  forme:"sbire", png:""}    // PLACEHOLDER jaune
  ],
  boss:[
    {id:"chef",  nom:"Chef de Meute",   hue:350, forme:"boss",  scale:1.35, pvMult:1.6, png:""}   // PLACEHOLDER rouge
  ]
};
function placeholderEnnemi(ctx,b,t,anim,fi){            // dessin 64x64 : mêmes poses simulées que le cube d'origine
  const n=fi!==null?fi:Math.floor(t/150), bob=anim==="idle"?Math.round(Math.sin(t/280)*1.5):0, h=b.hue;
  const col=`hsl(${h},60%,45%)`, dk=`hsl(${h},60%,28%)`, lt=`hsl(${h},60%,64%)`;
  ctx.clearRect(0,0,64,64); ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="rgba(0,0,0,.45)"; ctx.beginPath(); ctx.ellipse(32,56,17,6,0,0,7); ctx.fill();
  ctx.save(); ctx.translate(32,56);
  ctx.rotate(anim==="death"?-Math.min(n+1,4)*Math.PI/8:anim==="hit"?.2:anim==="dodge"?-.3:anim==="dash"?.12:0); ctx.translate(-32,-56);
  if(b.placeholder==="boss"){
    ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(32,8+bob); ctx.lineTo(56,32+bob); ctx.lineTo(32,56); ctx.lineTo(8,32+bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle=dk; ctx.beginPath(); ctx.moveTo(32,8+bob); ctx.lineTo(56,32+bob); ctx.lineTo(32,32+bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#ffdf4a"; ctx.fillRect(21,2+bob,5,9); ctx.fillRect(29,0+bob,6,11); ctx.fillRect(38,2+bob,5,9);        // couronne
    ctx.fillStyle="#fff"; ctx.fillRect(24,28+bob,5,5); ctx.fillRect(35,28+bob,5,5); ctx.fillStyle="#200"; ctx.fillRect(26,30+bob,2,3); ctx.fillRect(37,30+bob,2,3);
  } else {
    ctx.fillStyle=col; ctx.fillRect(16,28+bob,32,26);
    ctx.fillStyle=dk; ctx.beginPath(); ctx.moveTo(14,28+bob); ctx.lineTo(32,12+bob); ctx.lineTo(50,28+bob); ctx.closePath(); ctx.fill();   // toit
    ctx.fillStyle=lt; ctx.fillRect(16,28+bob,32,3);
    ctx.fillStyle="#fff"; ctx.fillRect(22,36+bob,6,6); ctx.fillRect(36,36+bob,6,6); ctx.fillStyle="#200"; ctx.fillRect(24,38+bob,2,3); ctx.fillRect(38,38+bob,2,3);
  }
  ctx.restore();
}

/* ================= Fonction universelle =================
   lancerCombat({
     mode:  'triptyque' | 'vagues' | 'endurance',
     fond:  '#0f172a' ou 'decors/mon-image.jpg'   (ignoré en triptyque : décor arene-1..3.jpg),
     onFin: resultat => { ... },                   // appelé à la fin du match
     // options : niveau, puissance (boss), competencesBonus:[ids] (compétences temporaires), puissanceSbires, vagues:[n1,n2] (1 à 3 sbires), sbires:[defs], boss:def, adversaire:brute (triptyque), recompenses:false (triptyque)
   })
   resultat : { mode, victoire, pvRestants, pvMax } +
     triptyque : xp, or, drop, niveauxGagnes
     vagues    : ennemisVaincus, vaguesCompletes (0-3), bossVaincu
     endurance : degatsTotal, tours (victoire = toujours false)                                   */
function lancerCombat(config){ return Combat.lancer(config); }
