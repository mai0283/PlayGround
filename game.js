(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = id => document.getElementById(id);
  const ui = {
    topbar:$('topbar'), hud:$('hud'), night:$('nightLabel'), clock:$('clockLabel'), health:$('healthBar'), healthText:$('healthText'), ammo:$('ammoText'), zombies:$('zombieText'), coins:$('coinText'), boss:$('bossBar'), bossHealth:$('bossHealth'), bossPct:$('bossHealthText'), toast:$('toast'), reload:$('reloadNote'), controlsHint:$('controlsHint'), touch:$('touchControls'), menu:$('menuScreen'), pause:$('pauseScreen'), shop:$('shopScreen'), end:$('endScreen'),
    endEyebrow:$('endEyebrow'), endEmblem:$('endEmblem'), endTitle:$('endTitle'), endMessage:$('endMessage'), endNights:$('endNights'), endKills:$('endKills'), endCoins:$('endCoins')
  };
  const rand = (a,b) => a + Math.random() * (b-a);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  let W=innerWidth, H=innerHeight, dpr=1, mode='menu', last=0, elapsed=0, night=1, coins=0, kills=0, nightKills=0;
  let player, enemies=[], bullets=[], particles=[], spawnLeft=0, spawnTimer=0, fireTimer=0, reloadTimer=0, hurtFlash=0, toastTimer=0, boss=null, shake=0, scenery=[];
  const keys = new Set();
  const pointer = {x:W/2,y:H/2,down:false,seen:false};
  const joystick = {x:0,y:0,id:null,startX:0,startY:0};
  let firingTouch=false, touchMode=matchMedia('(pointer:coarse)').matches;
  const colors = {ground:'#202923',road:'#353a32',green:'#60734d',orange:'#e8794d'};

  function resize(){
    W=innerWidth; H=innerHeight; dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    makeScenery();
  }
  function makeScenery(){
    scenery=[];
    // Quiet, compact block layout; the streets and abandoned lots are painted procedurally.
    const n=Math.max(9,Math.floor(W*H/52000));
    for(let i=0;i<n;i++){
      const edge=i%4, bw=rand(65,145), bh=rand(55,115);
      let x=edge===0?rand(-15,W*.2):edge===1?rand(W*.8,W-bw+15):rand(0,W-bw);
      let y=edge===2?rand(-12,H*.22):edge===3?rand(H*.78,H-bh+12):rand(0,H-bh);
      if(x>W*.32&&x<W*.68&&y>H*.27&&y<H*.74) { x=(i%2?12:W-bw-12); }
      scenery.push({x,y,w:bw,h:bh,c:i%3,seed:rand(0,1000)});
    }
  }
  function freshGame(){
    night=1; coins=0; kills=0; nightKills=0; elapsed=0; spawnLeft=0; spawnTimer=0; fireTimer=0; reloadTimer=0; hurtFlash=0; toastTimer=0; enemies=[]; bullets=[]; particles=[]; boss=null;
    pointer.down=false; firingTouch=false; keys.clear(); ui.reload.hidden=true; ui.toast.hidden=true;
    player={x:W/2,y:H*.57,r:11,hp:100,maxHp:100,ammo:12,reserve:48,aim:0,walk:0,hit:0};
    beginNight(1); mode='playing'; showGameplay(); updateHud();
  }
  function beginNight(n){
    night=n; elapsed=0; nightKills=0; spawnTimer=2; spawnLeft=n===5?7:8+n*3; enemies=[]; bullets=[]; boss=null;
    if(n===5){ spawnLeft=6; boss={x:W/2,y:-65,hp:180,maxHp:180,r:35,attack:0,hit:0}; }
    updateHud(); say(n===5?'NOCHE 5 · EL COLOSAL SE ACERCA':'NOCHE '+n+' · NO DEJES QUE TE ALCANCEN');
  }
  function showGameplay(){ui.menu.hidden=true;ui.pause.hidden=true;ui.shop.hidden=true;ui.end.hidden=true;ui.topbar.hidden=false;ui.hud.hidden=false;ui.touch.hidden=!touchMode;ui.controlsHint.hidden=touchMode;}
  function say(text){ui.toast.textContent=text;ui.toast.hidden=false;toastTimer=2.2;}
  function updateHud(){
    if(!player)return;
    ui.night.textContent='NOCHE '+night;
    ui.clock.textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
    ui.health.style.width=(player.hp/player.maxHp*100)+'%';ui.health.style.background=player.hp<30?'#e26d4e':'#9fc47c';ui.healthText.textContent=Math.ceil(player.hp);
    ui.ammo.innerHTML=player.ammo+' <small>/ '+player.reserve+'</small>';
    ui.zombies.textContent=String(spawnLeft+enemies.length+(boss?1:0)).padStart(2,'0');ui.coins.textContent=coins;
    ui.boss.hidden=!boss;
    if(boss){const p=clamp(boss.hp/boss.maxHp*100,0,100);ui.bossHealth.style.width=p+'%';ui.bossPct.textContent=Math.ceil(p)+'%';}
  }
  function spawnEnemy(){
    const angle=rand(0,Math.PI*2),pad=32;
    const rx=W*.52,ry=H*.52;
    const x=clamp(W/2+Math.cos(angle)*rx,-pad,W+pad),y=clamp(H/2+Math.sin(angle)*ry,-pad,H+pad);
    let type='walker';
    const r=Math.random();if(night>=2&&r<.28)type='runner';else if(night>=3&&r<.5)type='armored';
    const specs={walker:{hp:2,speed:rand(23,31)+night*.7,r:11,damage:8,color:'#829473',reward:5},runner:{hp:2,speed:rand(49,58)+night,r:9,damage:7,color:'#b8754e',reward:8},armored:{hp:5,speed:rand(18,23)+night*.4,r:13,damage:13,color:'#78817a',reward:13}}[type];
    enemies.push({x,y,...specs,maxHp:specs.hp,type,attack:rand(.1,1),walk:rand(0,8),hit:0,dead:false});
  }
  function aimAtPointer(){const rect=canvas.getBoundingClientRect();pointer.x=(pointer.x/rect.width)*W;pointer.y=(pointer.y/rect.height)*H;}
  function targetAngle(){
    if(touchMode){let best=null,bd=Infinity;for(const e of enemies){const d=dist(e,player);if(d<bd){bd=d;best=e;}}if(boss&&dist(boss,player)<bd)best=boss;if(best)return Math.atan2(best.y-player.y,best.x-player.x);}
    return Math.atan2(pointer.y-player.y,pointer.x-player.x);
  }
  function shoot(){
    if(mode!=='playing'||reloadTimer>0||fireTimer>0)return;
    if(player.ammo<=0){reload();return;}
    player.ammo--;fireTimer=.22;player.aim=targetAngle();
    const a=player.aim, sx=player.x+Math.cos(a)*15, sy=player.y+Math.sin(a)*15;
    bullets.push({x:sx,y:sy,vx:Math.cos(a)*510,vy:Math.sin(a)*510,life:.85,damage:1.55});
    for(let i=0;i<3;i++)particles.push({x:sx,y:sy,vx:Math.cos(a)*rand(35,90)+rand(-35,35),vy:Math.sin(a)*rand(35,90)+rand(-35,35),life:rand(.08,.2),max:.2,color:'#ffd28a',size:rand(2,4)});
    shake=Math.max(shake,1.8);updateHud();
  }
  function reload(){if(reloadTimer>0||player.ammo===12||player.reserve<=0)return;reloadTimer=1.15;ui.reload.hidden=false;}
  function damagePlayer(amount){player.hp=Math.max(0,player.hp-amount);player.hit=.2;hurtFlash=.23;shake=Math.max(shake,5);if(player.hp<=0)finish(false);updateHud();}
  function killEnemy(e){e.dead=true;kills++;nightKills++;coins+=e.reward;for(let i=0;i<8;i++)particles.push({x:e.x,y:e.y,vx:rand(-65,65),vy:rand(-65,65),life:rand(.18,.48),max:.48,color:i%2?'#aab888':'#9c5946',size:rand(2,5)});say('+'+e.reward+' CHATARRA');updateHud();}
  function finish(win){mode=win?'victory':'defeat';ui.topbar.hidden=true;ui.hud.hidden=true;ui.touch.hidden=true;ui.controlsHint.hidden=true;ui.end.hidden=false;ui.endEyebrow.textContent=win?'TRANSMISIÓN RESTAURADA':'TRANSMISIÓN INTERRUMPIDA';ui.endEmblem.textContent=win?'✦':'☠';ui.endEmblem.style.color=win?'#e5b65d':'#e8794d';ui.endTitle.textContent=win?'LA CIUDAD ES TUYA':'EL REFUGIO HA CAÍDO';ui.endMessage.textContent=win?'Cinco noches resistiendo. La señal vuelve a encenderse.':'La horda te ha superado. Aún puedes volver a intentarlo.';ui.endNights.textContent=(win?5:night)+' / 5';ui.endKills.textContent=kills;ui.endCoins.textContent=coins;}

  function update(dt){
    if(mode!=='playing')return;
    elapsed+=dt;fireTimer=Math.max(0,fireTimer-dt);hurtFlash=Math.max(0,hurtFlash-dt);shake=Math.max(0,shake-dt*18);
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui.toast.hidden=true;}
    if(reloadTimer>0){reloadTimer-=dt;if(reloadTimer<=0){const n=Math.min(12-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;ui.reload.hidden=true;updateHud();}}
    let mx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joystick.x;
    let my=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+joystick.y;
    const m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m;}
    const speed=190;player.x=clamp(player.x+mx*speed*dt,18,W-18);player.y=clamp(player.y+my*speed*dt,65,H-25);
    if(m>.04)player.walk+=dt*12;player.aim=targetAngle();player.hit=Math.max(0,player.hit-dt);
    if(pointer.down||firingTouch||keys.has(' '))shoot();
    if(spawnLeft>0){spawnTimer-=dt;if(spawnTimer<=0&&enemies.length<(night===5?7:9)){spawnEnemy();spawnLeft--;spawnTimer=rand(.72,1.35)*Math.max(.5,1-night*.045);}}
    for(const e of enemies){
      const a=Math.atan2(player.y-e.y,player.x-e.x),d=dist(e,player);e.walk+=dt*e.speed*.18;e.hit=Math.max(0,e.hit-dt);
      if(d>player.r+e.r+2){e.x+=Math.cos(a)*e.speed*dt;e.y+=Math.sin(a)*e.speed*dt;}
      e.attack-=dt;if(d<player.r+e.r+5&&e.attack<=0){damagePlayer(e.damage);e.attack=e.type==='runner'?.82:1.05;}
    }
    if(boss){const a=Math.atan2(player.y-boss.y,player.x-boss.x),d=dist(boss,player);boss.hit=Math.max(0,boss.hit-dt);boss.x+=Math.cos(a)*Math.min(27,d*.55)*dt;boss.y+=Math.sin(a)*Math.min(27,d*.55)*dt;boss.attack-=dt;if(d<boss.r+player.r+7&&boss.attack<=0){damagePlayer(19);boss.attack=1.1;}}
    for(const b of bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
      if(boss&&Math.hypot(b.x-boss.x,b.y-boss.y)<boss.r+4){boss.hp-=b.damage;boss.hit=.1;b.life=0;for(let i=0;i<3;i++)particles.push({x:b.x,y:b.y,vx:rand(-45,45),vy:rand(-45,45),life:.16,max:.16,color:'#ee8a58',size:3});if(boss.hp<=0){boss=null;coins+=100;kills++;nightKills++;updateHud();say('EL COLOSAL HA CAÍDO · +100 CHATARRA');finish(true);}continue;}
      for(const e of enemies){if(!e.dead&&Math.hypot(b.x-e.x,b.y-e.y)<e.r+3){e.hp-=b.damage;e.hit=.12;b.life=0;if(e.hp<=0)killEnemy(e);break;}}
    }
    enemies=enemies.filter(e=>!e.dead);bullets=bullets.filter(b=>b.life>0&&b.x>-30&&b.x<W+30&&b.y>-30&&b.y<H+30);
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.93;p.vy*=.93;p.life-=dt;}particles=particles.filter(p=>p.life>0);
    if(night!==5&&spawnLeft===0&&enemies.length===0){mode='shop';showShop();}
    if(night===5&&spawnLeft===0&&enemies.length===0&&!boss){finish(true);}
    updateHud();
  }
  function showShop(){ui.topbar.hidden=true;ui.hud.hidden=true;ui.touch.hidden=true;ui.controlsHint.hidden=true;ui.shop.hidden=false;ui.shopCoins.textContent=coins;const next=night+1;ui.shopTitle.textContent='NOCHE '+night+' SUPERADA';ui.shopDescription.textContent=night===4?'El Colosal llega esta noche. Esta es tu última oportunidad.':'Has aguantado otra noche. Respira. Reabastécete.';ui.nextNightButton.querySelector('span').textContent=night===4?'ENFRENTAR AL COLOSAL':'PREPARARSE PARA LA NOCHE '+next;}
  function buy(price,type){if(coins<price){say('NO HAY SUFICIENTE CHATARRA');return;}if(type==='ammo'&&player.reserve>=96){say('RESERVA DE MUNICIÓN LLENA');return;}if(type==='med'&&player.hp>=100){say('YA TIENES LA VIDA AL MÁXIMO');return;}coins-=price;if(type==='ammo')player.reserve+=24;else player.hp=Math.min(100,player.hp+40);ui.shopCoins.textContent=coins;updateHud();}

  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function drawBackground(){
    rect(0,0,W,H,'#202923');
    // Cracked asphalt and dead grass, kept deliberately low-detail for mobile.
    for(let i=0;i<95;i++){const x=((i*173+31)%Math.max(W,1)),y=((i*97+19)%Math.max(H,1));rect(x,y,((i%3)+1),1,i%4===0?'#394237':i%3===0?'#29332c':'#242d27');}
    const roadW=Math.max(52,Math.min(100,W*.105));
    rect(W*.5-roadW/2,0,roadW,H,'#343a33');rect(0,H*.48-roadW*.34,W,roadW*.68,'#343a33');
    rect(W*.5-roadW/2+4,0,2,H,'#42463b');rect(W*.5+roadW/2-6,0,2,H,'#42463b');
    for(let y=18;y<H;y+=48)rect(W*.5-1,y,2,20,'#77745a');
    // Curb stones and road markings.
    for(let y=0;y<H;y+=19){rect(W*.5-roadW/2-3,y,3,10,'#66705a');rect(W*.5+roadW/2,y,3,10,'#66705a');}
    for(let x=0;x<W;x+=19){rect(x,H*.48-roadW*.34-3,10,3,'#66705a');rect(x,H*.48+roadW*.34,10,3,'#66705a');}
    // Little crosswalks, broken paint, drainage.
    for(let i=0;i<7;i++){rect(W*.5-roadW/2+8+i*9,H*.48-roadW*.34+5,5,3,'#9b9873');rect(W*.5-roadW/2+8+i*9,H*.48+roadW*.34-8,5,3,'#9b9873');}
    rect(W*.5-roadW/2+8,H*.2,7,2,'#171e1a');rect(W*.5+roadW/2-14,H*.82,7,2,'#171e1a');
    for(const b of scenery)drawBuilding(b);
    // Street lamps with small, muted pools of amber light.
    for(let i=0;i<4;i++){const x=i%2?W*.5+roadW*.5+18:W*.5-roadW*.5-18,y=H*(.2+i*.2);ctx.fillStyle='#d5a35b';ctx.globalAlpha=.12;ctx.beginPath();ctx.arc(x,y,29,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;rect(x-2,y-2,5,5,'#c8a05d');rect(x-1,y-1,2,2,'#f3d28a');}
    // Grain-sized debris and tufts around the safe lanes.
    for(let i=0;i<26;i++){const x=(i*211+43)%W,y=(i*137+87)%H;if(Math.abs(x-W/2)>roadW/2+3&&Math.abs(y-H*.48)>roadW*.34+3){rect(x,y,3+(i%3),2,i%2?'#5c6446':'#705741');if(i%4===0)rect(x+3,y-3,2,3,'#788052');}}
  }
  function drawBuilding(b){
    const x=Math.round(b.x),y=Math.round(b.y),w=Math.round(b.w),h=Math.round(b.h),c=b.c;
    rect(x+5,y+7,w,h,c===0?'#121a16':c===1?'#171a17':'#1c211d');rect(x,y,w,h,c===0?'#42443a':c===1?'#49463a':'#3e453c');
    rect(x+4,y+4,w-8,h-8,c===0?'#333a31':c===1?'#3b3a31':'#353d35');rect(x+7,y+7,w-14,4,'#59604a');
    // Roof patches, cracked panels, and small boarded windows.
    for(let i=0;i<3;i++){const px=x+12+(i*29+b.seed%13)%(Math.max(14,w-28)),py=y+13+(i*23+b.seed%9)%(Math.max(14,h-28));rect(px,py,12,8,'#252b26');rect(px+2,py+2,8,2,'#44483a');}
    for(let i=0;i<Math.floor(w/27);i++){const wx=x+10+i*26;rect(wx,y+h-9,11,5,'#202822');rect(wx+2,y+h-8,7,2,'#817957');}
    rect(x+w*.5-8,y+h*.5-6,16,12,'#27312a');rect(x+w*.5-5,y+h*.5-4,10,8,'#111a15');
    if(c===1){rect(x+9,y+8,15,4,'#625c46');rect(x+w-18,y+h-13,11,5,'#6f5942');}
    if(c===2){rect(x+10,y+h*.55,18,3,'#77724f');rect(x+13,y+h*.55-3,2,9,'#292d25');}
    rect(x+2,y+h-2,w-4,2,'#77735a');
  }
  function drawSurvivor(){
    const p=player;ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.rotate(p.aim);
    // Ground shadow and little boot-step animation.
    ctx.fillStyle='#090e0b99';ctx.beginPath();ctx.ellipse(-1,8,12,6,0,0,Math.PI*2);ctx.fill();
    const step=Math.sin(p.walk)*2;
    rect(-7,-1+step,5,9,'#323934');rect(2,-1-step,5,9,'#323934');rect(-8,6+step,7,3,'#171b18');rect(1,6-step,7,3,'#171b18');
    rect(-8,-8,16,16,p.hit>0?'#f3e8c6':'#a27c54');rect(-7,-7,14,13,'#687d62');rect(-7,-3,14,3,'#3f5141');
    rect(-5,-11,10,6,'#d0a478');rect(-6,-13,12,4,'#34362c');rect(-5,-15,10,4,'#b88c5c');
    rect(0,-7,3,2,'#e0cba5');rect(6,-2,10,4,'#78674d');rect(12,-2,8,3,'#282b26');rect(18,-1,4,2,'#c7a466');
    if(p.hit>0){ctx.strokeStyle='#e77554';ctx.lineWidth=2;ctx.strokeRect(-10,-16,31,34);}ctx.restore();
  }
  function drawZombie(e){
    const a=Math.atan2(player.y-e.y,player.x-e.x),step=Math.sin(e.walk)*1.5;ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y));ctx.rotate(a);
    ctx.fillStyle='#090e0b99';ctx.beginPath();ctx.ellipse(-1,6,e.r+3,e.r*.65,0,0,Math.PI*2);ctx.fill();
    if(e.type==='armored'){rect(-8,-9,16,17,'#414943');rect(-8,-9,16,5,'#6c7770');rect(-9,-7,4,11,'#899083');rect(5,-7,4,11,'#899083');rect(-5,-13,10,7,'#a1a48e');rect(-4,-14,8,3,'#414a43');rect(0,-11,2,2,'#cf674b');rect(-7,7,5,4,'#363a33');rect(3,7,5,4,'#363a33');}
    else{const body=e.type==='runner'?'#9c674b':'#657a5d';rect(-6,-7+step,12,15,e.hit?'#eadfc1':body);rect(-9,-2,5,3,body);rect(5,-2,6,3,body);rect(-5,-12,10,7,e.hit?'#efe3c6':e.type==='runner'?'#bd8662':'#9aa28a');rect(-5,-13,7,3,'#49463a');rect(-2,-9,2,2,'#d46149');rect(3,-9,2,2,'#d46149');rect(-5,7+step,4,5,'#41453a');rect(2,7-step,4,5,'#41453a');if(e.type==='walker')rect(5,2,5,2,'#bf6851');}
    if(e.hit>0){ctx.strokeStyle='#f0e2c6';ctx.lineWidth=1.5;ctx.strokeRect(-e.r,-e.r-3,e.r*2,e.r*2+5);}ctx.restore();
    if(e.type==='armored'&&e.hp<e.maxHp){rect(e.x-9,e.y-e.r-8,18,2,'#252a25');rect(e.x-9,e.y-e.r-8,18*e.hp/e.maxHp,2,'#c87c59');}
  }
  function drawBoss(){if(!boss)return;const b=boss;ctx.save();ctx.translate(Math.round(b.x),Math.round(b.y));ctx.fillStyle='#080b09b8';ctx.beginPath();ctx.ellipse(0,21,42,19,0,0,Math.PI*2);ctx.fill();
    rect(-28,-20,56,48,b.hit?'#eee0bd':'#657559');rect(-31,-16,10,25,'#4e5e4d');rect(21,-16,11,25,'#4e5e4d');rect(-23,-30,46,22,b.hit?'#eee0bd':'#929c7c');rect(-23,-33,12,5,'#40483c');rect(11,-34,11,7,'#40483c');rect(-17,-24,5,5,'#e3754e');rect(10,-24,5,5,'#e3754e');rect(-7,-14,17,5,'#30372e');rect(-17,16,12,12,'#42483a');rect(6,16,13,12,'#42483a');rect(-25,25,20,7,'#343a31');rect(6,25,21,7,'#343a31');
    for(let i=0;i<3;i++){rect(-25+i*24,-4+(i%2)*8,6,5,'#b18359');}
    if(b.hit>0){ctx.strokeStyle='#f5e4c9';ctx.lineWidth=3;ctx.strokeRect(-34,-37,68,72);}ctx.restore();}
  function draw(){
    ctx.save();if(shake>0)ctx.translate(rand(-shake,shake),rand(-shake,shake));drawBackground();
    for(const b of bullets){ctx.fillStyle='#ffd28a';ctx.beginPath();ctx.arc(b.x,b.y,2.4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffecbb55';ctx.fillRect(b.x-6,b.y-1,7,2);}
    if(boss)drawBoss();for(const e of enemies)drawZombie(e);for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);rect(p.x,p.y,p.size,p.size,p.color);}ctx.globalAlpha=1;if(player)drawSurvivor();
    if(player&&fireTimer>.15){const a=player.aim;ctx.fillStyle='#ffd57d';ctx.beginPath();ctx.arc(player.x+Math.cos(a)*25,player.y+Math.sin(a)*25,3,0,Math.PI*2);ctx.fill();}
    ctx.restore();if(hurtFlash>0){ctx.fillStyle='rgba(180,43,32,'+(hurtFlash*.36)+')';ctx.fillRect(0,0,W,H);}
  }
  function frame(t){const dt=Math.min(.04,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(frame);}
  function pauseGame(){if(mode!=='playing')return;mode='paused';ui.pause.hidden=false;ui.touch.hidden=true;ui.controlsHint.hidden=true;}
  function resumeGame(){if(mode!=='paused')return;mode='playing';ui.pause.hidden=true;ui.touch.hidden=!touchMode;ui.controlsHint.hidden=touchMode;last=performance.now();}
  $('playButton').addEventListener('click',freshGame);
  $('pauseButton').addEventListener('click',pauseGame);
  $('resumeButton').addEventListener('click',resumeGame);
  $('quitButton').addEventListener('click',()=>{mode='menu';ui.pause.hidden=true;ui.topbar.hidden=true;ui.hud.hidden=true;ui.menu.hidden=false;});
  $('buyAmmo').addEventListener('click',()=>buy(15,'ammo'));
  $('buyMedkit').addEventListener('click',()=>buy(20,'med'));
  $('nextNightButton').addEventListener('click',()=>{beginNight(night+1);mode='playing';showGameplay();});
  $('restartButton').addEventListener('click',freshGame);
  $('endMenuButton').addEventListener('click',()=>{mode='menu';ui.end.hidden=true;ui.menu.hidden=false;});
  canvas.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.seen=true;});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;pointer.x=e.clientX;pointer.y=e.clientY;pointer.down=true;canvas.setPointerCapture?.(e.pointerId);});
  canvas.addEventListener('pointerup',()=>{pointer.down=false;});canvas.addEventListener('pointercancel',()=>{pointer.down=false;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('pointerup',()=>{pointer.down=false;});
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys.add(k);if(k==='r'&&mode==='playing')reload();if((k==='escape'||k==='p')&&mode==='playing')pauseGame();else if((k==='escape'||k==='p')&&mode==='paused')resumeGame();});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  const stickZone=$('stickZone'),knob=$('stickKnob');
  stickZone.addEventListener('pointerdown',e=>{e.preventDefault();joystick.id=e.pointerId;const r=stickZone.getBoundingClientRect();joystick.startX=r.left+r.width/2;joystick.startY=r.top+47;stickZone.setPointerCapture(e.pointerId);moveStick(e);});
  stickZone.addEventListener('pointermove',e=>{if(joystick.id===e.pointerId)moveStick(e);});
  const releaseStick=e=>{if(joystick.id===e.pointerId){joystick.id=null;joystick.x=joystick.y=0;knob.style.transform='translate(0,0)';}};
  stickZone.addEventListener('pointerup',releaseStick);stickZone.addEventListener('pointercancel',releaseStick);
  function moveStick(e){const dx=e.clientX-joystick.startX,dy=e.clientY-joystick.startY,d=Math.hypot(dx,dy),max=31,s=d>max?max/d:1;joystick.x=dx*s/max;joystick.y=dy*s/max;knob.style.transform='translate('+dx*s+'px,'+dy*s+'px)';}
  const fireButton=$('fireButton');fireButton.addEventListener('pointerdown',e=>{e.preventDefault();firingTouch=true;fireButton.setPointerCapture(e.pointerId);});fireButton.addEventListener('pointerup',()=>firingTouch=false);fireButton.addEventListener('pointercancel',()=>firingTouch=false);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pauseGame();});
  window.addEventListener('resize',resize);
  player={x:W*.72,y:H*.58,r:11,hp:100,maxHp:100,ammo:12,reserve:48,aim:-.5,walk:0,hit:0};
  if(new URLSearchParams(location.search).has('debug')){
    window.__zombie={get state(){return {mode,night,coins,kills,enemies:enemies.length,boss:!!boss,hp:player.hp};},start:()=>{freshGame();player.hp=100000;},skip:()=>{if(mode==='playing'){enemies=[];spawnLeft=0;}},toBoss:()=>{night=5;beginNight(5);mode='playing';showGameplay();},shop:()=>{night=1;coins=90;showShop();mode='shop';},killBoss:()=>{if(boss){boss.hp=0;}}};
  }
  resize();requestAnimationFrame(frame);
})();
