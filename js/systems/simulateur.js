"use strict";
/* simulateur.js : mode Entraînement (Simulateur) avec sélecteur de décors fonctionnel */
const TRAIN={
  NAMES:{dummy:"Dummy (Greybox)",general:"Général",empereur:"Empereur",inversebrah:"Inversebrah",hazmat:"Hazmat",momie:"Momie",samourai:"Samourai",zeus:"Zeus",frankenstein:"Frankenstein",human:"Humain"},
  built:false, keys:[], idx:0, cur:"idle", mult:1, paused:false, clock:0, last:0, A:null, F:null, D:null,
  
  // LOGIQUE INTERNE POUR LA NAVIGATION DES DÉCORS
  decorList: [],
  decorIdx: 0,

  keyName(k){ return this.NAMES[k]||(k[0].toUpperCase()+k.slice(1)); },
  mk(key,x,flip){ return {b:{sprite:key,hue:200,name:this.keyName(key),weapons:[]},name:this.keyName(key),x,bx:x,y:188,flip0:flip,flip,anim:"idle",t0:0,flash0:-1e6,hp:100,dh:100,lastHp:100,hit0:-1e6,max:100,win:false,air:0,wpn:null}; },
  
 editTarget: "hero",
  dummyIdx: 1,

  build(){
    this.built=true; this.keys=DataEngine.BRAWLERS.filter(k=>DataEngine.SPRITES[k]);
    const typeLbl={light:"Légère",heavy:"Lourde",throw:"Jet"};
    const ws=$("#tr-wpn"); ws.innerHTML='<option value="-1">👊 Mains nues (Poing)</option>'+DataEngine.WEAPONS.map((w,i)=>`<option value="${i}">${w.icon} ${w.name} (${typeLbl[w.type]||"?"})</option>`).join("");
    ws.onchange=()=>this.setWpn();

    $("#tr-av-hero").onclick=()=>{ this.editTarget="hero"; $("#tr-av-hero").classList.add("on"); $("#tr-av-dummy").classList.remove("on"); this.syncTopbar(); };
    $("#tr-av-dummy").onclick=()=>{ this.editTarget="dummy"; $("#tr-av-dummy").classList.add("on"); $("#tr-av-hero").classList.remove("on"); this.syncTopbar(); };
    $("#tr-prev").onclick=()=>this.stepChar(-1);
    $("#tr-next").onclick=()=>this.stepChar(1);

    $("#tr-replay").onclick=()=>this.play(this.cur);
    $("#tr-pause").onclick=()=>{ this.paused=!this.paused; $("#tr-pause").textContent=this.paused?"▶":"❚❚"; };
    $("#tr-step").onclick=()=>{ if(!this.paused){ this.paused=true; $("#tr-pause").textContent="▶"; } const a=CanvasRenderer.ANIMS[this.F.anim]||CanvasRenderer.ANIMS.idle; this.clock+=1000/a.fps+1; };
    $("#tr-flip").onchange=e=>{ this.F.flip=this.F.flip0=e.target.checked; };
    $("#tr-dummy").onchange=()=>this.setDummy();

    $$("#tr-anims .tr-pose").forEach(b=>{ b.onclick=()=>this.play(b.dataset.a); });
    $("#tr-btn-atk").onclick=()=>this.triggerAction("atk");
    $("#tr-btn-crit").onclick=()=>this.triggerAction("crit");
    $("#tr-emote").onchange=e=>{ if(e.target.value){ this.play(e.target.value); e.target.value=""; } };

    this.decorList = [];
    for(let i=1; i<=3; i++) this.decorList.push({ label: `Zone 1 (${i})`, value: assetPath.pvp("nuclear", i) });
    for(let i=1; i<=3; i++) this.decorList.push({ label: `Robot (${i})`, value: assetPath.pvp("robot", i) });
    const afkExtensions = { general: "jpeg", empereur: "jpeg", frankenstein: "jpeg", hazmat: "jpeg", human: "jpeg", inversebrah: "jpeg", momie: "jpeg", samourai: "jpg", zeus: "jpeg" };
    Object.keys(afkExtensions).forEach(k => {
      this.decorList.push({ label: `AFK : ${this.keyName(k)}`, value: assetPath.afk(k, 1, afkExtensions[k]) });
    });

    const selectDecor = $("#tr-select-decor");
    let optionsHtml = '<optgroup label="⚔️ DÉCORS DE COMBAT PVP">';
    this.decorList.forEach((d, index) => {
      if (index === 6) optionsHtml += '</optgroup><optgroup label="💰 DÉCORS D\'ACCUEIL (AFK)">';
      optionsHtml += `<option value="${index}">${d.label}</option>`;
    });
    optionsHtml += '</optgroup>';
    selectDecor.innerHTML = optionsHtml;
    selectDecor.onchange = (e) => this.pickDecor(parseInt(e.target.value, 10));
    $("#tr-bg-prev").onclick = () => this.pickDecor(this.decorIdx - 1);
    $("#tr-bg-next").onclick = () => this.pickDecor(this.decorIdx + 1);

    $$("#tr-speed [data-ts]").forEach(b=>b.onclick=()=>{ this.mult=+b.dataset.ts; $$("#tr-speed [data-ts]").forEach(x=>x.classList.toggle("active",x===b)); });
    this.F=this.mk(this.keys[0],110,false);
    this.D=this.mk(this.keys[this.dummyIdx%this.keys.length],300,true);
    this.A={V:[this.F,this.D],P:[],fl:[],pan:0,fade:0,shake0:-1e6,amp:5,proj:null,act:true};
    this.pickDecor(0);

    document.addEventListener("keydown",e=>{
      const cv=$("#g-train #cv-train"); if(!cv||!cv.offsetParent) return;
      if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)&&e.key!==" ") return;
      if(e.key==="ArrowLeft"){ e.preventDefault(); this.stepChar(-1); }
      else if(e.key==="ArrowRight"){ e.preventDefault(); this.stepChar(1); }
      else if(e.key===" "){ e.preventDefault(); this.play(this.cur); }
    });
    this.cv=$("#g-train #cv-train"); this.cv.getContext("2d").imageSmoothingEnabled=false;
    requestAnimationFrame(t=>this.tick(t));
  },
  open(){
    if(!this.built) this.build();
    this.pick(this.idx);
  },
  stepChar(delta){
    const n=this.keys.length;
    if(this.editTarget==="hero"){
      this.pick(this.idx+delta);
    } else {
      this.dummyIdx=((this.dummyIdx+delta)%n+n)%n;
      this.setDummy();
      this.syncTopbar();
    }
  },
  syncTopbar(){
    const hk=this.keys[this.idx], dk=this.keys[this.dummyIdx%this.keys.length];
    const activeKey=this.editTarget==="hero"?hk:dk;
    $("#tr-char-name").textContent=this.keyName(activeKey);
    const cvH=$("#tr-av-hero canvas"), cvD=$("#tr-av-dummy canvas");
    if(cvH){ const ctx=cvH.getContext("2d"); ctx.clearRect(0,0,48,48); renderer.drawBrute(ctx,{sprite:hk,hue:200},0,"idle",0); }
    if(cvD){ const ctx=cvD.getContext("2d"); ctx.clearRect(0,0,48,48); renderer.drawBrute(ctx,{sprite:dk,hue:200},0,"idle",0); }
  },
  pick(i){
    const n=this.keys.length; this.idx=((i%n)+n)%n; const k=this.keys[this.idx];
    this.F.b.sprite=k; this.F.b.name=this.F.name=this.keyName(k);
    if(this.dummyIdx===this.idx) this.dummyIdx=(this.idx+1)%n;
    this.setDummy();
    this.syncTopbar();
    this.play(this.cur);
  },
  setDummy(){
    const on=$("#tr-dummy").checked, k=this.keys[this.dummyIdx%this.keys.length];
    this.D.b.sprite=k; this.D.b.name=this.D.name=this.keyName(k);
    this.A.V=on?[this.F,this.D]:[this.F];
  },
  getWpnAnims(){
    const i=+$("#tr-wpn").value;
    if(i===10) return {atk:"overhead",crit:"meteor"};
    const wType=i>=0?(DataEngine.WEAPONS[i]?.type||"light"):"punch";
    return {light:{atk:"thrust",crit:"pierce"},heavy:{atk:"overhead",crit:"meteor"},throw:{atk:"throw",crit:"salto"}}[wType]||{atk:"punch",crit:"uppercut"};
  },
  triggerAction(kind){
    const pair=this.getWpnAnims();
    this.play(pair[kind]);
  },
  setWpn(){
    const i=+$("#tr-wpn").value;
    this.F.wpn=i<0?null:{id:i,ic:DataEngine.WEAPONS[i].icon};
    this.F.b.weapons=i<0?[]:[i];
    this.A.proj=null;
    if(i>=0) this.triggerAction("atk");
  },
  play(a){
    this.cur=a; const F=this.F; F.anim=a; F.t0=this.clock; F.x=F.bx; F.air=0; F.flip=F.flip0; F.hp=a==="death"?0:F.max; if(a==="hit") F.flash0=this.clock;
    const wi=+$("#tr-wpn").value; F.wpn=wi<0?null:{id:wi,ic:DataEngine.WEAPONS[wi].icon}; this.A.proj=null;
  },
  pickDecor(i){
    const n = this.decorList.length;
    if (n === 0) return;
    this.decorIdx = ((i % n) + n) % n;
    const item = this.decorList[this.decorIdx];
    const select = $("#tr-select-decor");
    if(select) select.value = this.decorIdx;
    const tok = this._decorTok = (this._decorTok || 0) + 1;
    const chargerImage = (chemin) => {
      const img = new Image();
      img.src = chemin;
      img.onload = () => { if (this.A && tok === this._decorTok) { this.A.pan = 0; this.A.customBg = img; } };
      img.onerror = () => {
        if (tok !== this._decorTok) return;        if (chemin.endsWith(".jpg")) chargerImage(chemin.replace(".jpg", ".jpeg"));
        else if (chemin.endsWith(".jpeg")) {
          const parties = chemin.split('/');
          const nomFichier = parties[parties.length - 1];
          if (nomFichier && nomFichier === nomFichier.toLowerCase()) {
            parties[parties.length - 1] = nomFichier.charAt(0).toUpperCase() + nomFichier.slice(1);
            chargerImage(parties.join('/'));
          }
        }
      };
    };
    chargerImage(item.value);
  },
  WPN_FX:{
    "-1":{ atk:{dashT:160,air:0,dur:380,hits:1,shake:4,freeze:0,dist:44},  crit:{dashT:210,air:34,dur:540,hits:1,shake:10,freeze:85,dist:44} }, // Mains nues
    0:   { atk:{dashT:150,air:0,dur:400,hits:1,shake:5,freeze:0,dist:48},  crit:{dashT:110,air:18,dur:560,hits:1,shake:11,freeze:95,dist:48} }, // Épée
    1:   { atk:{dashT:80, air:0,dur:320,hits:1,shake:4,freeze:0,dist:42},  crit:{dashT:65, air:0, dur:480,hits:2,shake:9, freeze:80,dist:40} }, // Dague (Blink)
    2:   { atk:{dashT:140,air:0,dur:380,hits:1,shake:5,freeze:0,dist:42},  crit:{dashT:220,air:38,dur:540,hits:1,shake:11,freeze:90,dist:42} }, // Couteau
    3:   { atk:{dashT:160,air:0,dur:540,hits:3,shake:4,freeze:0,dist:44},  crit:{dashT:140,air:0, dur:720,hits:4,shake:7, freeze:70,dist:44} }, // Scie (Multi-hit)
    4:   { atk:{dashT:200,air:12,dur:460,hits:1,shake:7,freeze:0,dist:52}, crit:{dashT:230,air:32,dur:620,hits:1,shake:13,freeze:110,dist:52}}, // Hache
    5:   { atk:{dashT:220,air:24,dur:480,hits:1,shake:8,freeze:0,dist:50}, crit:{dashT:280,air:58,dur:660,hits:1,shake:15,freeze:140,dist:50}}, // Marteau (Meteor)
    6:   { atk:{dashT:200,air:16,dur:450,hits:1,shake:7,freeze:0,dist:50}, crit:{dashT:240,air:28,dur:600,hits:1,shake:12,freeze:110,dist:50}}, // Pioche
    7:   { atk:{dashT:190,air:16,dur:440,hits:1,shake:7,freeze:0,dist:50}, crit:{dashT:250,air:48,dur:620,hits:1,shake:14,freeze:120,dist:50}}, // Os / Massue
    9:   { atk:{dashT:170,air:0, dur:440,hits:1,shake:6,freeze:0,dist:64}, crit:{dashT:150,air:12,dur:620,hits:3,shake:12,freeze:100,dist:64}}, // Trident (Lourde)
    10:  { atk:{dashT:320,air:10,dur:560,hits:1,shake:10,freeze:40,dist:62},crit:{dashT:340,air:52,dur:760,hits:1,shake:18,freeze:180,dist:62}}  // Pilier Colossal
  },
  tick(t){
    const dt=this.last?Math.min(34,t-this.last):16; this.last=t;
    const cv=this.cv;
    if(cv&&cv.offsetParent){
      if(!this.paused) this.clock+=dt*this.mult;
      const F=this.F, D=this.D, el=this.clock-F.t0, loopOn=$("#tr-auto").checked, isCrit=["uppercut","pierce","meteor","salto"].includes(this.cur), isMelee=["punch","thrust","overhead","uppercut","pierce","meteor"].includes(this.cur), isThrow=["throw","salto"].includes(this.cur);
      const wid=F.wpn?F.wpn.id:-1, fxSet=this.WPN_FX[wid]||this.WPN_FX["-1"], fx=isCrit?fxSet.crit:fxSet.atk;
      const A=CanvasRenderer.ANIMS[this.cur]||CanvasRenderer.ANIMS.idle, L=A.f?A.f.length:4, animDur=fx.dur||Math.max(400,Math.round(L/A.fps*1000));
      if(isMelee && $("#tr-dummy").checked){
        const tx=F.flip0?D.bx+fx.dist:D.bx-fx.dist, dashT=fx.dashT, hitEnd=dashT+animDur, backEnd=hitEnd+180;
        if(el<dashT){ const k=el/dashT; F.x=F.bx+(tx-F.bx)*k; F.air=fx.air?Math.sin(Math.PI*k)*fx.air:0; F.anim="dash"; F.flip=F.flip0; if(isCrit&&el<40) F.flash0=this.clock; }
        else if(el<hitEnd){
          F.x=tx; F.air=0; F.flip=F.flip0;
          if(F.anim!==this.cur){ F.anim=this.cur; this._hitStep=0; }
          const step=Math.floor(((el-dashT)/animDur)*fx.hits)+1;
          if(step>this._hitStep && el>=dashT+animDur*0.35){
            this._hitStep=step; D.anim="hit"; D.t0=this.clock; D.flash0=this.clock; this.A.amp=fx.shake; this.A.shake0=this.clock;
            if(!this.A.vfx) this.A.vfx=[];
            if([4,5,6,7,10].includes(wid)) this.A.vfx.push({kind:"slam",x:D.bx,y:D.y,crit:isCrit,t0:this.clock,dur:420});
            else if(isCrit) this.A.vfx.push({kind:"crit",x:D.bx,y:D.y,t0:this.clock,dur:340});
            if(step===fx.hits && fx.freeze) renderer.freeze(fx.freeze);
          }
        }
        else if(el<backEnd){ const k=(el-hitEnd)/180; F.x=tx+(F.bx-tx)*k; F.anim="dash"; F.flip=!F.flip0; }
        else {
          F.x=F.bx; F.air=0; F.flip=F.flip0; F.anim="idle"; D.anim="idle";
          if(loopOn){ if(el>backEnd+350) this.play(this.cur); }
          else { this.cur="idle"; F.t0=this.clock; }
        }
      } else if(isThrow && $("#tr-dummy").checked){
        F.x=F.bx; F.flip=F.flip0;
        if(el<animDur){
          if(F.anim!==this.cur){ F.anim=this.cur; this._hitStep=0; }
          if(el>=animDur*0.35&&F.wpn){ this.A.proj={ic:F.wpn.ic,id:F.wpn.id,b:F.b,x0:F.bx+(F.flip0?-28:28),y0:F.y-48,x1:D.bx,y1:D.y-42,t0:this.clock,t1:this.clock+260}; F.wpn=null; }
          if(!this._hitStep && el>=animDur*0.35+220){
            this._hitStep=1; D.anim="hit"; D.t0=this.clock; D.flash0=this.clock; this.A.amp=isCrit?12:5; this.A.shake0=this.clock;
            if(!this.A.vfx) this.A.vfx=[];
            if(wid===13) this.A.vfx.push({kind:"molotov",x:D.bx,y:D.y,t0:this.clock,dur:750});
            else if(wid===12) this.A.vfx.push({kind:"grenade",x:D.bx,y:D.y,t0:this.clock,dur:420});
            else if(isCrit) this.A.vfx.push({kind:"crit",x:D.bx,y:D.y,t0:this.clock,dur:340});
            if(isCrit) renderer.freeze(90);
          }
        }
        else {
          F.anim="idle";
          if(el>animDur+300){
            D.anim="idle";
            const wi=+$("#tr-wpn").value; if(wi>=0) F.wpn={id:wi,ic:DataEngine.WEAPONS[wi].icon}; this.A.proj=null;
            if(loopOn) this.play(this.cur);
            else { this.cur="idle"; F.t0=this.clock; }
          }
        }
      } else {
        F.x=F.bx; F.air=0; F.flip=F.flip0;
        if(F.anim!=="idle" && el>animDur+200){
          if(loopOn) this.play(this.cur);
          else { this.cur="idle"; F.anim="idle"; F.hp=F.max; F.t0=this.clock; }
        }
      }
      $$("#tr-anims .tr-pose").forEach(b=>b.classList.toggle("on",b.dataset.a===this.cur));
      renderer.drawArena(cv.getContext("2d"),this.A,this.clock);
    }
    requestAnimationFrame(t2=>this.tick(t2));
  }
  };