"use strict";
/* ---------- ENREGISTREUR D'ÉCRAN (visible uniquement en mode dev, persistant) ---------- */
const Recorder={
  btn:null,rec:null,chunks:[],stream:null,t0:0,tick:0,
  init(){
    const b=this.btn=document.createElement("button");
    b.id="dev-rec"; b.type="button";
    b.onclick=()=>this.rec?this.stop():this.start();
    this.label();
    setInterval(()=>this.sync(),500);                   // suit l'état du mode dev (#devbox) sans toucher à main.js
  },
  sync(){                                                    // accroche le bouton au panneau dev (recréé à chaque ouverture)
    const p=document.getElementById("devbox"), b=this.btn;
    if(p){
      if(b.parentNode!==p){
        b.style.cssText="display:block;margin-top:8px;padding:4px 8px;font:600 11px monospace;color:#fff;background:#111e;border:1px solid #9f9;border-radius:4px;cursor:pointer;pointer-events:auto";
        p.appendChild(b); this.label();
      }
    }else if(this.rec){                                      // panneau fermé pendant un enregistrement : bouton flottant pour pouvoir l'arrêter
      if(b.parentNode!==document.body){
        b.style.cssText="display:block;position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:6px 10px;font:600 12px monospace;color:#fff;background:#111e;border:1px solid #f33;border-radius:6px;cursor:pointer;pointer-events:auto";
        document.body.appendChild(b);
      }
    }else if(b.parentNode) b.remove();
  },
  label(){
    if(!this.rec){ this.btn.textContent="⏺ REC"; this.btn.style.borderColor="#9f9"; return; }
    const s=Math.floor((Date.now()-this.t0)/1000);
    this.btn.textContent="⏹ "+String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
    this.btn.style.borderColor="#f33";
  },
  async start(){
    try{
      this.stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:60},audio:false,preferCurrentTab:true,selfBrowserSurface:"include"});
    }catch(e){ if(typeof toast==="function") toast("Capture refusée ou annulée."); return; }
    const track=this.stream.getVideoTracks()[0];
    try{                                                // Chrome/Edge : recadre sur le cadre du jeu uniquement
      const el=document.querySelector(".game-frame");
      if(window.CropTarget&&el&&track.cropTo) await track.cropTo(await CropTarget.fromElement(el));
    }catch(e){}
    const mime=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(m=>MediaRecorder.isTypeSupported(m));
    this.chunks=[];
    const r=this.rec=new MediaRecorder(this.stream,{mimeType:mime,videoBitsPerSecond:8000000});
    r.ondataavailable=e=>{ if(e.data.size) this.chunks.push(e.data); };
    r.onstop=()=>this.save();
    track.onended=()=>this.stop();                      // bouton « Arrêter le partage » du navigateur
    r.start(1000); this.t0=Date.now();
    this.tick=setInterval(()=>this.label(),500); this.label();
  },
  stop(){ if(this.rec&&this.rec.state!=="inactive") this.rec.stop(); },
  save(){
    clearInterval(this.tick);
    this.stream.getTracks().forEach(t=>t.stop());
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob(this.chunks,{type:"video/webm"}));
    a.download="arene-"+new Date().toISOString().replace(/[:.]/g,"-")+".webm";
    a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    this.rec=null; this.chunks=[]; this.label(); this.sync();
  }
};
Recorder.init();