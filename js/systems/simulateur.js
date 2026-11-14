"use strict";
/* simulateur.js : mode Entraînement (Simulateur) avec sélecteur de décors fonctionnel */
const TRAIN={
  NAMES:{general:"Général",empereur:"Empereur",inversebrah:"Inversebrah",hazmat:"Hazmat",momie:"Momie",samourai:"Samourai",zeus:"Zeus",frankenstein:"Frankenstein",human:"Humain"},
  GROUPS:[
    ["Base (planche 1)",[["idle","🧍","Repos"],["dash","🏃","Dash"],["dodge","💨","Esquive"],["hit","💥","Touché"],["death","💀","Mort"]]],
    ["Attaques (planche 2)",[["punch","👊","Poing"],["thrust","🗡️","Estoc"],["overhead","🪓","Frappe haute"],["throw","🎯","Lancer"]]],
    ["Critiques (planche 3)",[["uppercut","⬆️","Uppercut"],["pierce","🔱","Perforation"],["meteor","☄️","Météore"],["salto","🤸","Salto"]]],
    ["Dresseur (planche 4)",[["whistle","📣","Sifflet"],["surprise","❗","Surprise"],["taunt","😏","Provocation"],["victory","🏆","Victoire"]]]
  ],
  built:false, keys:[], idx:0, cur:"idle", mult:1, paused:false, clock:0, last:0, A:null, F:null, D:null,
  
  // LOGIQUE INTERNE POUR LA NAVIGATION DES DÉCORS
  decorList: [],
  decorIdx: 0,

  keyName(k){ return this.NAMES[k]||(k[0].toUpperCase()+k.slice(1)); },
  hasSheet(k,sh){ const wid=this.F?.wpn?this.F.wpn.id:null; if(wid!==null&&wid>=0&&wid<8) return !!renderer.loadImg(DataEngine.spriteBase(k,wid)); if(sh==="base") return true; return !!DataEngine.spriteSheet(k,sh); },
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
    const chargerImage = (chemin) => {
      const img = new Image();
      img.src = chemin;
      img.onload = () => { if (this.A) { this.A.pan = 0; this.A.customBg = img; } };
      img.onerror = () => {
        if (chemin.endsWith(".jpg")) chargerImage(chemin.replace(".jpg", ".jpeg"));
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
  tick(t){
    const dt=Math.min(50,t-(this.last||t)); this.last=t;
    const cv=this.cv;
    if(cv&&cv.offsetParent){
      if(!this.paused) this.clock+=dt*this.mult;
      const F=this.F, D=this.D, el=this.clock-F.t0, isMelee=["punch","thrust","overhead","uppercut","pierce","meteor"].includes(this.cur), isThrow=["throw","salto"].includes(this.cur);
      if(isMelee && $("#tr-dummy").checked){
        const tx=F.flip0?D.bx+46:D.bx-46;
        if(el<260){ const k=el/260; F.x=F.bx+(tx-F.bx)*k; F.air=["overhead","meteor"].includes(this.cur)?Math.sin(Math.PI*k)*24:0; F.anim="dash"; F.flip=F.flip0; }
        else if(el<780){ F.x=tx; F.air=0; F.flip=F.flip0; if(F.anim!==this.cur){ F.anim=this.cur; F.t0=this.clock; } }
        else if(el<1040){ const k=(el-780)/260; F.x=tx+(F.bx-tx)*k; F.anim="dash"; F.flip=!F.flip0; }
        else {
          F.x=F.bx; F.air=0; F.flip=F.flip0; F.anim="idle";
          if($("#tr-auto").checked){ if(el>1450) this.play(this.cur); }
          else { this.cur="idle"; F.t0=this.clock; }
        }
      } else if(isThrow && $("#tr-dummy").checked){
        F.x=F.bx; F.flip=F.flip0;
        if(el<550){ if(F.anim!==this.cur){ F.anim=this.cur; F.t0=this.clock; } if(el>=220&&F.wpn){ this.A.proj={ic:F.wpn.ic,id:F.wpn.id,b:F.b,x0:F.bx+(F.flip0?-28:28),y0:F.y-48,x1:D.bx,y1:D.y-42,t0:this.clock,t1:this.clock+300}; F.wpn=null; } }
        else {
          F.anim="idle";
          if(el>950){
            const wi=+$("#tr-wpn").value; if(wi>=0) F.wpn={id:wi,ic:DataEngine.WEAPONS[wi].icon}; this.A.proj=null;
            if($("#tr-auto").checked) this.play(this.cur);
            else { this.cur="idle"; F.t0=this.clock; }
          }
        }
      } else {
        F.x=F.bx; F.air=0; F.flip=F.flip0;
        const A=CanvasRenderer.ANIMS[F.anim]||CanvasRenderer.ANIMS.idle, L=A.f?A.f.length:4, dur=L/A.fps*1000;
        if($("#tr-auto").checked && !A.loop && F.anim!=="idle" && el>dur+500) this.play(this.cur);
      }
      $$("#tr-anims .tr-pose").forEach(b=>b.classList.toggle("on",b.dataset.a===this.cur));
      renderer.drawArena(cv.getContext("2d"),this.A,this.clock);
    }
    requestAnimationFrame(t2=>this.tick(t2));
  }
  };