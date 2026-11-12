"use strict";
/* ================= CanvasRenderer ================= */
class CanvasRenderer {
  // Grille 4x4 de 64x64 : frames 0-3 idle, 4-7 dash, 8-9 esquive, 10-11 touché, 12-15 mort
  // s = planche (base P1, atk P2, crit P3, trn P4), r = ligne ; fb = frames de P1 réutilisées tant que la planche n'existe pas
  // Échelle d'affichage : case 64x64 dessinée en SPR px (avant 128). PAD = marge basse de la case : f.y = point de contact avec le sol
  static SPR=84; static PAD=12; static HEAD=76;   // HEAD = hauteur approx. au-dessus du sol pour textes flottants
  static ANIMS={
    idle:{s:"base",r:0,fps:6,loop:1}, dash:{s:"base",r:1,fps:12,loop:1}, dodge:{s:"base",f:[8,9],fps:8}, hit:{s:"base",f:[10,11],fps:8}, death:{s:"base",r:3,fps:6},
    punch:{s:"atk",r:0,fps:10,fb:[4,5,6,7]}, thrust:{s:"atk",r:1,fps:13,fb:[5,6,7,7]}, overhead:{s:"atk",r:2,fps:8,fb:[4,5,7,6]}, throw:{s:"atk",r:3,fps:9,fb:[5,5,6,4]},
    uppercut:{s:"crit",r:0,fps:8,fb:[4,5,7,7]}, pierce:{s:"crit",r:1,fps:14,fb:[5,6,7,7]}, meteor:{s:"crit",r:2,fps:7,fb:[4,5,7,6]}, salto:{s:"crit",r:3,fps:8,fb:[6,5,4,5]},
    whistle:{s:"trn",r:0,fps:7,fb:[2,3,2,3]}, surprise:{s:"trn",r:1,fps:8,fb:[10,11,10,11]}, taunt:{s:"trn",r:2,fps:8,loop:1,fb:[0,1,2,3]}, victory:{s:"trn",r:3,fps:7,loop:1,fb:[0,1,2,3]}
  };
  static ANIM_SETS={
    worldBoss:{
      idle:{s:"base",r:0,fps:6,loop:1},
      dash:{s:"base",r:1,fps:12,loop:1},
      dodge:{s:"base",r:1,fps:12,loop:1},
      hit:{s:"base",r:2,fps:8,loop:1},
      death:{s:"base",r:2,fps:8,loop:1},
      punch:{s:"base",r:2,fps:8,loop:1},
      thrust:{s:"base",r:2,fps:8,loop:1},
      overhead:{s:"base",r:2,fps:8,loop:1},
      throw:{s:"base",r:2,fps:8,loop:1},
      uppercut:{s:"base",r:2,fps:8,loop:1},
      pierce:{s:"base",r:2,fps:8,loop:1},
      meteor:{s:"base",r:2,fps:8,loop:1},
      salto:{s:"base",r:2,fps:8,loop:1},
      taunt:{s:"base",r:3,fps:8,loop:1},
      victory:{s:"base",r:3,fps:8,loop:1}
    },
    paperBoss:{
      idle:{s:"base",r:0,fps:6,loop:1},
      dash:{s:"base",r:1,fps:12,loop:1},
      dodge:{s:"base",r:1,fps:12,loop:1},
      hit:{s:"base",r:2,fps:8,loop:1},
      death:{s:"base",r:3,fps:8,loop:1},
      punch:{s:"base",r:2,fps:8,loop:1},
      thrust:{s:"base",r:2,fps:8,loop:1},
      overhead:{s:"base",r:2,fps:8,loop:1},
      throw:{s:"base",r:2,fps:8,loop:1},
      uppercut:{s:"base",r:2,fps:8,loop:1},
      pierce:{s:"base",r:2,fps:8,loop:1},
      meteor:{s:"base",r:2,fps:8,loop:1},
      salto:{s:"base",r:2,fps:8,loop:1},
      taunt:{s:"base",r:0,fps:8,loop:1},
      victory:{s:"base",r:0,fps:8,loop:1}
    }
  };
  static PET={ idle:{r:0,fps:6,loop:1,fb:[0,1,2,3]}, run:{r:1,fps:14,loop:1,fb:[4,5,6,7]}, bite:{r:2,fps:12,fb:[6,7,6,5]}, death:{r:3,fps:6,fb:[12,13,14,15]} };
  // Point d'ancrage de la main (px dans la case 64x64, rotation en rad) par frame ; null = arme absente (lâchée). Calibrez selon vos dessins.
  static ANCHORS={
    thrust:[[30,38,-.3],[38,37,-.1],[50,36,0],[54,36,0]],
    overhead:[[34,12,-2.3],[36,8,-1.7],[47,30,.5],[50,40,1.3]],
    throw:[[30,30,-1],[36,26,-.6],[48,30,0],null],
    pierce:[[30,38,-.3],[44,36,0],[54,36,0],[54,36,0]],
    meteor:[[34,10,-2.3],[36,6,-1.8],[46,34,.6],[50,42,1.3]],
    salto:[[30,36,-.6],[34,30,-1],[44,30,-.4],null]
  };
  static SKY=[[10,22,18],[40,14,30],[70,30,12],[120,16,24],[160,26,16],[250,20,28],[290,34,14],[350,30,22]];
  constructor(){
    this.targets=[]; this.imgs={}; this.weaponSheets={}; this.weaponBounds={}; this.speed=1; this.clock=0; this.last=0; this.arena=null; this.tick=null;
    this.off=document.createElement("canvas"); this.off.width=this.off.height=64; this.octx=this.off.getContext("2d");
    this.loop=this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  bind(canvas,getBrute){ canvas.getContext("2d").imageSmoothingEnabled=false; this.targets.push({canvas,getBrute}); }
  setSpeed(s){ this.speed=[1,2,4].includes(s)?s:1; }
  skip(){ if(this.arena) this.arena.skip(); }
  sprite(key,allowEnemy=false){
    if(!DataEngine.SPRITES[key]||(!allowEnemy&&!DataEngine.BRAWLERS.includes(key))){const ks=DataEngine.readyKeys();key=ks[[...String(key)].reduce((a,c)=>a+c.charCodeAt(0),0)%ks.length]}
    const src=DataEngine.spriteBase(key); if(!src) return null;
    return this.loadImg(src);
  }
  drawBrute(ctx,b,t,anim="idle",fi=null){
    const set=b&&CanvasRenderer.ANIM_SETS[b.animationSet], A=(set&&set[anim])||CanvasRenderer.ANIMS[anim]||CanvasRenderer.ANIMS.idle, row=[0,1,2,3].map(i=>A.r*4+i);
    let img, F;   // planche dédiée si elle existe, sinon pose simulée avec les frames P1
    if(A.s==="base"){ img=this.sprite(b.sprite,!!(b&&b.animationSet)); F=A.f||row; }
    else{ img=this.sheet(b.sprite,A.s); if(img) F=row; else { img=this.sprite(b.sprite); F=A.fb; } }
    const n=fi!==null?fi:Math.floor(t*A.fps/1000), k=A.loop?n%F.length:Math.min(n,F.length-1), fr=F[k];
    ctx.clearRect(0,0,64,64); ctx.imageSmoothingEnabled=false;
    if(img){ const fw=img.naturalWidth/4, fh=img.naturalHeight/4; ctx.drawImage(img,(fr%4)*fw,((fr/4)|0)*fh,fw,fh,0,0,64,64); return; }
    // Placeholder 2.5D : cube de couleur, pose selon l'animation
    const bob=anim==="idle"?Math.round(Math.sin(t/280)*1.5):0, h=b.hue, c=`hsl(${h},55%,48%)`, cl=`hsl(${h},55%,64%)`, cd=`hsl(${h},55%,30%)`;
    ctx.fillStyle="rgba(0,0,0,.45)"; ctx.beginPath(); ctx.ellipse(32,56,17,6,0,0,7); ctx.fill();
    ctx.save(); ctx.translate(32,56);
    ctx.rotate(anim==="dodge"?-.3:anim==="hit"?.2:anim==="dash"?.12:anim==="death"?-(k+1)*Math.PI/8:0);
    ctx.translate(-32,-56);
    const l=anim==="dash"?(k%2?3:-3):0;
    ctx.fillStyle=cd; ctx.fillRect(22,46,7,9-l); ctx.fillRect(35,46,7,9+l);
    ctx.fillStyle=c; ctx.fillRect(18,24+bob,24,22);
    ctx.fillStyle=cd; ctx.fillRect(42,24+bob,6,22);
    ctx.fillStyle=cl; ctx.fillRect(18,20+bob,24,4); ctx.fillRect(42,20+bob,6,4);
    ctx.fillStyle="#9fd66f"; ctx.fillRect(23,8+bob,16,14);
    ctx.fillStyle=b.species==="Ornithorynque"?"#6b4a2b":"#e65c00"; ctx.fillRect(37,15+bob,9,4);
    ctx.fillStyle="#222"; ctx.fillRect(26,13+bob,3,3); ctx.fillRect(34,13+bob,3,3);
    ctx.fillStyle="#d9d9d9"; ctx.fillRect(48,18+bob,3,22);
    ctx.restore();
  }
  loadImg(src){ if(!src) return null; const k="u|"+src; if(!this.imgs[k]){ const i=new Image(); i.onerror=()=>{i.failed=true}; i.src=encodeURI(src); this.imgs[k]=i; } const i=this.imgs[k]; return i.complete&&i.naturalWidth&&!i.failed?i:null; }
  pvpPreviewImg(){ const b=GameState.brute, k=b&&b.sprite; return this.loadImg(assetPath.pvpPreview(k||"general"))||this.loadImg(assetPath.pvpPreview("general")); }  weaponSprite(b,id,onload=null){
    const skins=DataEngine.WEAPON_SKINS[b&&b.sprite]; if(!skins||!skins.length) return null;
    const key=String(b.id||b.sprite), hash=[...key].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
    const src=skins[hash%skins.length], cacheKey="keyed|"+src;
    if(!this.weaponSheets[cacheKey]){
      const source=this.loadImg(src);
      if(!source){
        const pending=this.imgs["u|"+src], marker="pending|"+cacheKey;
        if(onload&&pending&&!pending.failed&&!this.weaponSheets[marker]){
          this.weaponSheets[marker]=true;
          pending.addEventListener("load",()=>{ delete this.weaponSheets[marker]; onload(); },{once:true});
        }
        return null;
      }
      const canvas=document.createElement("canvas"); canvas.width=source.naturalWidth; canvas.height=source.naturalHeight;
      const ctx=canvas.getContext("2d",{willReadFrequently:true}); ctx.drawImage(source,0,0);
      try{ const image=ctx.getImageData(0,0,canvas.width,canvas.height), pixels=image.data;
      for(let i=0;i<pixels.length;i+=4){
        const r=pixels[i], g=pixels[i+1], blue=pixels[i+2], dominance=g-Math.max(r,blue);
        if(g>80&&dominance>18){
          const keep=Math.max(0,Math.min(1,(90-dominance)/72));
          pixels[i+3]=Math.round(pixels[i+3]*keep);
          if(keep<1) pixels[i+1]=Math.min(g,Math.round(Math.max(r,blue)+dominance*keep));
        }
      }
      ctx.putImageData(image,0,0); }catch(e){ /* ouverture en file:// : fond vert non retiré, à faire à la main dans les images */ } this.weaponSheets[cacheKey]=canvas;
    }
    const sheet=this.weaponSheets[cacheKey], tile=sheet.width/4, cell=DataEngine.WEAPON_CELLS[id];
    if(sheet.width!==sheet.height||!Number.isInteger(tile)||!Number.isInteger(cell)) return null;
    const boundsKey=cacheKey+"|"+cell;
    if(!this.weaponBounds[boundsKey]){
      const x=(cell%4)*tile,y=Math.floor(cell/4)*tile;
      let pixels=null; try{ pixels=sheet.getContext("2d").getImageData(x,y,tile,tile).data; }catch(e){}
      if(!pixels){ this.weaponBounds[boundsKey]={x,y,width:tile,height:tile}; return {sheet,...this.weaponBounds[boundsKey]}; }
      let left=tile,top=tile,right=-1,bottom=-1;
      for(let i=3;i<pixels.length;i+=4){
        if(pixels[i]<=24) continue;
        const pixel=(i-3)/4,px=pixel%tile,py=Math.floor(pixel/tile);
        left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py);
      }
      if(right<left||bottom<top) return null;
      const padding=Math.ceil(tile*.035);
      left=Math.max(0,left-padding);top=Math.max(0,top-padding);
      right=Math.min(tile-1,right+padding);bottom=Math.min(tile-1,bottom+padding);
      this.weaponBounds[boundsKey]={x:x+left,y:y+top,width:right-left+1,height:bottom-top+1};
    }
    return {sheet,...this.weaponBounds[boundsKey]};
  }
  drawBossPortrait(ctx,img,x,y,size,bounds={x:88,y:12,w:104,h:108}){
    const inset=1,inner=size-inset*2,scale=Math.max(inner/bounds.w,inner/bounds.h),w=bounds.w*scale,h=bounds.h*scale;
    ctx.save();ctx.beginPath();ctx.rect(x+1,y+1,size-2,size-2);ctx.clip();
    ctx.translate(x+size,y);ctx.scale(-1,1);
    ctx.drawImage(img,bounds.x,bounds.y,bounds.w,bounds.h,(size-w)/2,(size-h)/2,w,h);
    ctx.restore();
  }
  sheet(spr,s){ return this.loadImg(DataEngine.spriteSheet(spr,s)); }
  // Familier : planche réelle sinon mini-brute teintée (frames P1) tant que le PNG n'existe pas
  drawPet(ctx,f,an,n){
    const A=CanvasRenderer.PET[an]||CanvasRenderer.PET.idle, k=A.loop?n%4:Math.min(n,3);
    ctx.clearRect(0,0,64,64); ctx.imageSmoothingEnabled=false;
    const img=this.loadImg(DataEngine.PET_SHEETS[f.key]);
    if(img){ const fr=A.r*4+k; ctx.drawImage(img,(fr%4)*64,((fr/4)|0)*64,64,64,0,0,64,64); return; }
    const bi=this.sprite(f.owner.sprite), fb=A.fb[k];
    if(bi){ ctx.drawImage(bi,(fb%4)*64,((fb/4)|0)*64,64,64,12,26,40,40); ctx.globalCompositeOperation="source-atop"; ctx.fillStyle="rgba(150,95,40,.55)"; ctx.fillRect(0,0,64,64); ctx.globalCompositeOperation="source-over"; }
    else{ ctx.fillStyle="#8a5a2b"; ctx.fillRect(14,40,30,14); ctx.fillRect(40,34,12,10); ctx.fillStyle="#222"; ctx.fillRect(46,37,2,2); }
  }
  freeze(ms){ this.frozen=performance.now()+ms; }   // freeze frame : l'horloge de jeu s'arrête
  animFrame(f,c){
    const T=f.pet?CanvasRenderer.PET:CanvasRenderer.ANIMS, set=!f.pet&&f.b&&CanvasRenderer.ANIM_SETS[f.b.animationSet];
    const A=(set&&set[f.anim])||T[f.anim]||T.idle, n=Math.floor((c-f.t0)*A.fps/1000), L=A.f?A.f.length:4;
    if(!A.loop && f.anim!=="death" && n>=L) return ["idle",Math.floor(c*6/1000)];
    return [f.anim,n];
  }
  blit(ctx,f,c){
    const [an,n]=this.animFrame(f,c), o=this.octx; f.pet?this.drawPet(o,f,an,n):this.drawBrute(o,f.b,c,an,n);
    const fl=Math.max(0,1-(c-f.flash0)/180);            // flash blanc à l'impact
    if(fl>0){ o.globalCompositeOperation="source-atop"; o.fillStyle=`rgba(255,255,255,${fl})`; o.fillRect(0,0,64,64); o.globalCompositeOperation="source-over"; }
    const hop=(f.win?Math.abs(Math.sin(c/180))*8:0)+(f.air||0);
    ctx.save(); ctx.translate(Math.round(f.x),Math.round(f.y-hop)); const fp=f.flip&&!f.win; if(fp) ctx.scale(-1,1);
    const R=CanvasRenderer, SC=R.SPR/64, OY=-(R.SPR-R.PAD); ctx.drawImage(this.off,-R.SPR/2,OY,R.SPR,R.SPR);
    const an_=!f.pet&&f.wpn&&CanvasRenderer.ANCHORS[an];   // Layering : arme collée au pivot de la main selon l'anim et la frame
    if(an_){ const A=CanvasRenderer.ANIMS[an], h=an_[A.loop?n%4:Math.min(n,3)];
      if(h){ ctx.translate(-R.SPR/2+h[0]*SC,OY+h[1]*SC); ctx.rotate(h[2]);
        const wi=this.loadImg(DataEngine.WEAPON_IMGS[f.wpn.id]), skin=this.weaponSprite(f.b,f.wpn.id);
        if(wi) ctx.drawImage(wi,-12,-12,24,24);
        else if(skin) ctx.drawImage(skin.sheet,skin.x,skin.y,skin.size,skin.size,-12,-12,24,24);
        else { if(fp) ctx.scale(-1,1); ctx.font="20px serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(f.wpn.ic,0,0); } } }
    ctx.restore();
  }
  drawArena(ctx,A,c){
    const W=400,H=225; ctx.setTransform(2,0,0,2,0,0); ctx.save();
    if(c-A.shake0<150) ctx.translate((Math.random()-.5)*(A.amp||5),(Math.random()-.5)*(A.amp||5));
    
    // --- GESTION DU DÉCOR (STANDARD OU PERSONNALISÉ) ---
    ctx.imageSmoothingEnabled=true;
    let im = null;
    
    // 1. Si une map personnalisée est choisie dans le simulateur
    if (A && A.customBg) {
      if (typeof A.customBg === "string") {
        const src = A.customBg;
        A.customBg = new Image();
        A.customBg.src = src;
      }
      im = A.customBg;
    } else {
      // 2. Sinon, on utilise le décor pvp standard d'origine
      im = this.ar && this.ar[A.pan];
      if (A.preview && !A.act && OV.stack.includes("pvp")) im = this.pvpPreviewImg() || im;    }

    // Rendu de l'image de fond
    if (im && im.complete && im.naturalWidth) {
      if (A && (A.customBg || A.pan === -1)) {
        ctx.fillStyle = im.secours || "#14110d";
        ctx.fillRect(-6, -6, W + 12, H + 12);
        const rImg = im.naturalWidth / (im.naturalHeight || 1);
        const rBox = W / H;
        let dw = W, dh = H, dx = 0, dy = 0;
        if (rImg > rBox) { dh = W / rImg; dy = (H - dh) / 2; }
        else { dw = H * rImg; dx = (W - dw) / 2; }
        ctx.drawImage(im, dx, dy, dw, dh);
      } else {
        ctx.drawImage(im, -6, -6, W + 12, H + 12);
      }
    } else {
      ctx.fillStyle = (im && im.secours) || "#14110d";
      ctx.fillRect(-6, -6, W + 12, H + 12);
    }
    // --- FIN DE LA GESTION DU DÉCOR ---

    [...A.V,...(A.P||[])].sort((a,b)=>a.y-b.y).forEach(f=>{
      ctx.fillStyle="rgba(0,0,0,.5)"; ctx.beginPath(); ctx.ellipse(f.x,f.y-2,f.pet?14:20,f.pet?4:5,0,0,7); ctx.fill();
      this.blit(ctx,f,c);
    });
    const pj=A.proj; if(pj&&c>=pj.t0&&c<=pj.t1){ const k=(c-pj.t0)/(pj.t1-pj.t0); ctx.save(); ctx.translate(pj.x0+(pj.x1-pj.x0)*k,pj.y0+(pj.y1-pj.y0)*k-Math.sin(Math.PI*k)*18); ctx.rotate(c/45); ctx.font="19px serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(pj.ic,0,0); ctx.restore(); }
    ctx.textAlign="center";
    A.fl.forEach(t=>{                                   // nombres flottants
      const age=c-t.c0; if(age<0||age>1000) return;
      ctx.globalAlpha=1-age/1000; ctx.font=`bold ${t.big?24:16}px monospace`; ctx.lineWidth=3; ctx.strokeStyle="#000";
      ctx.strokeText(t.s,t.x,t.y-age*.05); ctx.fillStyle=t.col; ctx.fillText(t.s,t.x,t.y-age*.05);
    });
    ctx.globalAlpha=1; ctx.font="10px monospace";
(A.preview?[]:A.V).forEach((f,k)=>{                  // HUD arcade : HP Shadow + portrait + râtelier de poche
      const dt=Math.min(60,Math.max(0,c-(f.pc===undefined?c:f.pc))); f.pc=c;
      if(f.lastHp===undefined) f.lastHp=f.hp;
      if(f.hp<f.lastHp){ f.hit0=c; }
      f.lastHp=f.hp;
      if(f.dh<f.hp) f.dh=f.hp; else if(c-f.hit0>450) f.dh+=(f.hp-f.dh)*Math.min(1,dt/260);
      if(f.dh-f.hp<.05) f.dh=f.hp;
      const x=k?240:10, dead=f.hp<=0; ctx.save();
      ctx.fillStyle="rgba(26,16,8,.88)"; ctx.fillRect(x-2,5,154,26); ctx.strokeStyle="#c9953a"; ctx.lineWidth=1; ctx.strokeRect(x-1.5,5.5,153,25);
      ctx.font="bold 9px monospace"; ctx.textBaseline="alphabetic"; ctx.fillStyle="#fff4d6"; ctx.textAlign=k?"right":"left"; ctx.fillText(f.name.toUpperCase()+"  "+Math.round(f.hp)+"/"+f.max,k?x+150:x,15);
      ctx.fillStyle="#050705"; ctx.fillRect(x,19,150,8);
      ctx.fillStyle="#ff5a1f"; ctx.fillRect(x,19,150*Math.max(0,f.dh)/f.max,8);
      ctx.fillStyle=k?"#b620e0":"#f2b21c"; ctx.fillRect(x,19,150*Math.max(0,f.hp)/f.max,8);
      const px=k?x+118:x, py=33; ctx.fillStyle="#2a1a0c"; ctx.fillRect(px,py,32,32);       // portrait
      const si=this.sprite(f.b.sprite,!!f.b.animationSet), enemy=k>0; ctx.imageSmoothingEnabled=false;
      if(si&&f.b.animationSet) this.drawBossPortrait(ctx,si,px,py,32,f.b.portraitBounds);
      else if(si){
        ctx.save();
        if(enemy){ctx.translate(px+32,0);ctx.scale(-1,1);ctx.drawImage(si,16,2,32,32,1,py+1,30,30);}
        else ctx.drawImage(si,16,2,32,32,px+1,py+1,30,30);
        ctx.restore();
      }
      else { ctx.fillStyle=`hsl(${f.b.hue},55%,48%)`; ctx.fillRect(px+4,py+4,24,24); }
      const rd=Math.max(0,1-(c-f.flash0)/260); if(rd>0){ ctx.fillStyle=`rgba(255,20,20,${rd*.75})`; ctx.fillRect(px+1,py+1,30,30); }   // portrait rouge au coup reçu
      ctx.strokeStyle="#c9953a"; ctx.lineWidth=2; ctx.strokeRect(px,py,32,32);
      if(dead){ ctx.lineCap="round"; [["#300",8],["#ff2a2a",4]].forEach(([col,w])=>{ ctx.strokeStyle=col; ctx.lineWidth=w; ctx.beginPath(); ctx.moveTo(px+3,py+3); ctx.lineTo(px+29,py+29); ctx.moveTo(px+29,py+3); ctx.lineTo(px+3,py+29); ctx.stroke(); }); }
      ctx.font="11px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";                // râtelier de poche
      (f.b.weapons||[]).slice(0,8).forEach((id,n)=>ctx.fillText(DataEngine.WEAPONS[id].icon,k?x+106-n*13:x+43+n*13,py+8));
      ctx.restore();
    });
    const wn=A.V.find(f=>f.win); if(wn&&!(A.cfg&&A.cfg.worldBoss)){ const t=wn.name.toUpperCase()+" GAGNE LE MATCH"; ctx.save(); ctx.font="bold 15px monospace"; ctx.textAlign="center"; ctx.textBaseline="alphabetic"; ctx.lineWidth=3; ctx.strokeStyle="#000"; ctx.strokeText(t,200,214); ctx.fillStyle="#fff"; ctx.fillText(t,200,214); ctx.restore(); }
    if(A.cfg&&A.cfg.worldBoss){
      const damage="DÉGÂTS : "+Math.floor(A.degats||0).toLocaleString("fr-FR");
      ctx.font="bold 10px monospace"; ctx.textAlign="center"; ctx.textBaseline="alphabetic";
      ctx.lineWidth=3; ctx.strokeStyle="#000"; ctx.strokeText(damage,200,17);
      ctx.fillStyle="#ffe23d"; ctx.fillText(damage,200,17);
    }else{
for(let k=0;k<3&&!A.preview;k++){ ctx.fillStyle=k===A.pan?"#e8a830":"rgba(230,220,200,.35)"; ctx.fillRect(185+k*12,12,8,3); }
    }
    if(A.fade>0){ ctx.fillStyle="rgba(0,0,0,"+A.fade+")"; ctx.fillRect(-6,-6,W+12,H+12); }
    ctx.restore();
  }
  loop(t){
    const dt=Math.min(50,t-(this.last||t)); this.last=t; if(!(this.frozen&&t<this.frozen)) this.clock+=dt*this.speed;   // l'horloge x1/x2/x4 pilote logique et frames
    if(this.tick) this.tick(this.clock);
    for(const g of this.targets){
      if(!g.canvas.offsetParent) continue;
      const b=g.getBrute();
      if(b){
        if(g.canvas.id==="cv-afk-hero") AFKMode.drawHero(g.canvas.getContext("2d"),t);
        else if(g.canvas.id==="boss-sprite"&&b.previewAnimations&&b.previewAnimations.length){
          const duration=900, phase=Math.floor(this.clock/duration)%b.previewAnimations.length;
          this.drawBrute(g.canvas.getContext("2d"),b,this.clock%duration,b.previewAnimations[phase]);
        }else this.drawBrute(g.canvas.getContext("2d"),b,t);
      }
    }
    const cv=this.arenaCv;
    if(this.arena&&(this.arena.act||this.arena.ready||this.arena.preview)&&cv&&cv.offsetParent) this.drawArena(cv.getContext("2d"),this.arena,this.clock);
    requestAnimationFrame(this.loop);
  }
}
