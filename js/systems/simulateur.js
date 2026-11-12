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
  hasSheet(k,sh){ if(sh==="base") return true; return !!DataEngine.spriteSheet(k,sh); },
  mk(key,x,flip){ return {b:{sprite:key,hue:200,name:this.keyName(key),weapons:[]},name:this.keyName(key),x,bx:x,y:188,flip0:flip,flip,anim:"idle",t0:0,flash0:-1e6,hp:100,dh:100,lastHp:100,hit0:-1e6,max:100,win:false,air:0,wpn:null}; },
  
  build(){
    this.built=true; this.keys=DataEngine.BRAWLERS.filter(k=>DataEngine.SPRITES[k]);
    const box=$("#tr-brutes"); box.innerHTML="";
    this.keys.forEach((k,i)=>{ const b=document.createElement("button"); b.className="tr-b"; b.dataset.k=k; b.innerHTML='<canvas width="64" height="64"></canvas>'+this.keyName(k); b.onclick=()=>this.pick(i); box.appendChild(b); });
    const an=$("#tr-anims"); an.innerHTML="";
    this.GROUPS.forEach(([t,list])=>{ const h=document.createElement("div"); h.className="tr-grp"; h.textContent=t; const r=document.createElement("div"); r.className="tr-row";
      list.forEach(([id,ic,lb])=>{ const b=document.createElement("button"); b.className="tr-a"; b.dataset.a=id; b.innerHTML="<b>"+ic+"</b>"+lb; b.onclick=()=>this.play(id); r.appendChild(b); });
      an.append(h,r); });
    const ws=$("#tr-wpn"); ws.innerHTML='<option value="-1">Aucune arme</option>'+DataEngine.WEAPONS.map((w,i)=>`<option value="${i}">${w.icon} ${w.name} (${DataEngine.WEAPON_STYLE[i]||"?"})</option>`).join("");
    ws.onchange=()=>this.setWpn();
    $("#tr-prev").onclick=()=>this.pick(this.idx-1); $("#tr-next").onclick=()=>this.pick(this.idx+1);
    $("#tr-replay").onclick=()=>this.play(this.cur);
    $("#tr-pause").onclick=()=>{ this.paused=!this.paused; $("#tr-pause").textContent=this.paused?"▶ Lecture":"⏸ Pause"; };
    $("#tr-step").onclick=()=>{ if(!this.paused){ this.paused=true; $("#tr-pause").textContent="▶ Lecture"; } const a=CanvasRenderer.ANIMS[this.F.anim]||CanvasRenderer.ANIMS.idle; this.clock+=1000/a.fps+1; };
    $("#tr-flip").onchange=e=>{ this.F.flip=this.F.flip0=e.target.checked; };
    $("#tr-dummy").onchange=()=>this.setDummy();
    
    // --- NAVIGATION UNIQUE À FLÈCHES REFAITE PROPREMENT ---
    const parentContainer = $("#tr-bg").parentElement;
    $("#tr-bg")?.remove();

    this.decorList = [];
    for(let i=1; i<=3; i++) {
      this.decorList.push({ label: `Nucléaire (${i})`, value: assetPath.pvp("nuclear", i) });
    }
    for(let i=1; i<=3; i++) {
      this.decorList.push({ label: `robot (${i})`, value: assetPath.pvp("robot", i) });
    }

    const afkExtensions = { general: "jpeg", empereur: "jpeg", frankenstein: "jpeg", hazmat: "jpeg", human: "jpeg", inversebrah: "jpeg", momie: "jpeg", samourai: "jpg", zeus: "jpeg" };
    Object.keys(afkExtensions).forEach(k => {
      const label = this.keyName(k);
      const ext = afkExtensions[k];
      this.decorList.push({ label: `AFK : ${label}`, value: assetPath.afk(k, 1, ext) });
    });

    const wrapper = document.createElement("div");
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "center";
    wrapper.style.border = "1px solid #ff9d2e";
    wrapper.style.borderRadius = "4px";
    wrapper.style.backgroundColor = "#111";
    wrapper.style.overflow = "hidden";

    const btnPrev = document.createElement("button");
    btnPrev.innerHTML = "◀";
    btnPrev.style.padding = "6px 10px";
    btnPrev.style.background = "none";
    btnPrev.style.color = "#ff9d2e";
    btnPrev.style.border = "none";
    btnPrev.style.cursor = "pointer";
    btnPrev.onclick = () => this.pickDecor(this.decorIdx - 1);

    const selectDecor = document.createElement("select");
    selectDecor.id = "tr-select-decor";
    selectDecor.style.padding = "4px";
    selectDecor.style.background = "none";
    selectDecor.style.color = "#ff9d2e";
    selectDecor.style.border = "none";
    selectDecor.style.fontFamily = "monospace";
    selectDecor.style.cursor = "pointer";
    selectDecor.style.outline = "none";

    let optionsHtml = '<optgroup label="⚔️ DÉCORS DE COMBAT PVP">';
    this.decorList.forEach((d, index) => {
      if (index === 6) { 
        optionsHtml += '</optgroup><optgroup label="💰 DÉCORS D\'ACCUEIL (AFK)">';
      }
      optionsHtml += `<option value="${index}">${d.label}</option>`;
    });
    optionsHtml += '</optgroup>';
    selectDecor.innerHTML = optionsHtml;
    selectDecor.onchange = (e) => this.pickDecor(parseInt(e.target.value, 10));

    const btnNext = document.createElement("button");
    btnNext.innerHTML = "▶";
    btnNext.style.padding = "6px 10px";
    btnNext.style.background = "none";
    btnNext.style.color = "#ff9d2e";
    btnNext.style.border = "none";
    btnNext.style.cursor = "pointer";
    btnNext.onclick = () => this.pickDecor(this.decorIdx + 1);

    wrapper.append(btnPrev, selectDecor, btnNext);
    parentContainer.append(wrapper);
    
    // --- FIN DE LA LOGIQUE DU NAVIGATEUR ---

    $$("#tr-speed [data-ts]").forEach(b=>b.onclick=()=>{ this.mult=+b.dataset.ts; $$("#tr-speed [data-ts]").forEach(x=>x.classList.toggle("on",x===b)); $$("#tr-speed [data-ts]").forEach(x=>x.classList.toggle("active",x===b)); });
    this.F=this.mk(this.keys[0],110,false); this.D=this.mk(this.keys[1%this.keys.length],300,true);
    
    // Initialisation de la scène avec le premier décor
    this.A={V:[this.F,this.D],P:[],fl:[],pan:0,fade:0,shake0:-1e6,amp:5,proj:null,act:true};
    
    this.pickDecor(0);

    document.addEventListener("keydown",e=>{
      const cv=$("#cv-train"); if(!cv||!cv.offsetParent) return; if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)&&e.key!==" ") return;
      if(e.key==="ArrowLeft"){ e.preventDefault(); this.pick(this.idx-1); } else if(e.key==="ArrowRight"){ e.preventDefault(); this.pick(this.idx+1); } else if(e.key===" "){ e.preventDefault(); this.play(this.cur); } });
    this.cv=$("#cv-train"); this.cv.getContext("2d").imageSmoothingEnabled=false;
    requestAnimationFrame(t=>this.tick(t));
  },
  open(){
    if(!this.built) this.build();
    this.keys.forEach((k,i)=>{ const cv=$$("#tr-brutes canvas")[i]; renderer.drawBrute(cv.getContext("2d"),{sprite:k,hue:200},0,"idle",0); });
    this.pick(this.idx);
  },
  pick(i){
    const n=this.keys.length; this.idx=((i%n)+n)%n; const k=this.keys[this.idx];
    this.F.b.sprite=k; this.F.b.name=this.F.name=this.keyName(k);
    this.setDummy();
    $$("#tr-brutes .tr-b").forEach(b=>b.classList.toggle("sel",b.dataset.k===k));
    const sel=$("#tr-brutes .tr-b.sel"); if(sel) sel.scrollIntoView({block:"nearest",inline:"center"});
    this.GROUPS.forEach(([t,list])=>list.forEach(([id])=>{ const sh=CanvasRenderer.ANIMS[id].s, b=$('#tr-anims [data-a="'+id+'"]'); const ok=this.hasSheet(k,sh); b.classList.toggle("fb",!ok); b.title=ok?"":"Planche absente : poses simulées avec la planche 1"; }));
    this.play(this.cur);
  },
  setDummy(){
    const on=$("#tr-dummy").checked, k=this.keys[(this.idx+1)%this.keys.length];
    this.D.b.sprite=k; this.D.b.name=this.D.name=this.keyName(k);
    this.A.V=on?[this.F,this.D]:[this.F];
  },
  setWpn(){ const i=+$("#tr-wpn").value; this.F.wpn=i<0?null:{id:i,ic:DataEngine.WEAPONS[i].icon}; this.F.b.weapons=i<0?[]:[i]; },
  play(a){
    this.cur=a; const F=this.F; F.anim=a; F.t0=this.clock; F.hp=a==="death"?0:F.max; if(a==="hit") F.flash0=this.clock;
  },
  pickDecor(i){
    const n = this.decorList.length;
    if (n === 0) return;
    this.decorIdx = ((i % n) + n) % n;
    const item = this.decorList[this.decorIdx];
    
    const select = $("#tr-select-decor");
    if(select) select.value = this.decorIdx;

    // Fonction interne pour tenter de charger l'image avec un chemin donné
    const chargerImage = (chemin) => {
      const img = new Image();
      img.src = chemin;
      
      img.onload = () => {
        if (this.A) {
          this.A.pan = 0;
          this.A.customBg = img;
        }
        if (typeof renderer !== "undefined") {
          renderer.ar = [img, img, img];
        }
      };

      img.onerror = () => {
        // Si la première tentative échoue et que c'est un fichier JPG, on tente en JPEG
        if (chemin.endsWith(".jpg")) {
          const nouveauChemin = chemin.replace(".jpg", ".jpeg");
          chargerImage(nouveauChemin);
        } else if (chemin.endsWith(".jpeg")) {
          // Si le JPEG échoue aussi, on tente avec une majuscule sur le nom du perso (ex: Hazmat au lieu de hazmat)
          // On extrait le nom du fichier pour modifier sa première lettre
          const parties = chemin.split('/');
          const nomFichier = parties[parties.length - 1];
          if (nomFichier && nomFichier === nomFichier.toLowerCase()) {
            const nomMaj = nomFichier.charAt(0).toUpperCase() + nomFichier.slice(1);
            parties[parties.length - 1] = nomMaj;
            chargerImage(parties.join('/'));
          } else {
            console.warn("Erreur de chargement définitive pour :", chemin);
          }
        }
      };
    };

    // Lance la première tentative de chargement
    chargerImage(item.value);
  },
  tick(t){
    const dt=Math.min(50,t-(this.last||t)); this.last=t;
    const cv=this.cv;
    if(cv&&cv.offsetParent){
      if(!this.paused) this.clock+=dt*this.mult;
      const F=this.F, A=CanvasRenderer.ANIMS[F.anim]||CanvasRenderer.ANIMS.idle, L=A.f?A.f.length:4, dur=L/A.fps*1000;
      if($("#tr-auto").checked && !A.loop && F.anim!=="idle" && this.clock-F.t0>dur+500) this.play(this.cur);
      const nRaw=Math.floor((this.clock-F.t0)*A.fps/1000), fr=A.loop?nRaw%L:Math.min(nRaw,L-1);
      const fin=!A.loop&&F.anim!=="death"&&nRaw>=L;
      const sh=A.s, ok=this.hasSheet(this.keys[this.idx],sh);
      $("#tr-info").textContent=this.keyName(this.keys[this.idx])+" · "+this.cur+" · planche "+(sh==="base"?"base (P1)":sh+(ok?" (dédiée)":" (absente → P1)"))+" · image "+(fin?"—":(fr+1)+"/"+L)+(this.paused?" · PAUSE":"");$$("#tr-anims .tr-a").forEach(b=>b.classList.toggle("on",b.dataset.a===this.cur));
// Lance le rendu graphique officiel avec les données de map synchronisées
renderer.drawArena(cv.getContext("2d"),this.A,this.clock);
}
requestAnimationFrame(t2=>this.tick(t2));
}
};