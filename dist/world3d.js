'use strict';
class CoastWorld {
 constructor(){
  const T=THREE;this.T=T;this.scale=.05;this.mode=0;this.yaw=0;this.peds=[];this.modes=['CHASE','STREET','OVERHEAD'];
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
  this.scene=new T.Scene();this.scene.background=new T.Color('#cda8b8');this.scene.fog=new T.FogExp2('#cda8b8',.008);this.view=new T.PerspectiveCamera(62,innerWidth/innerHeight,.1,400);this.look=new T.Vector3();this.view.position.set(110,7,100);
  this.scene.add(new T.HemisphereLight('#d5d7ff','#657565',2.1));const sun=new T.DirectionalLight('#ffe0ad',3);sun.position.set(125,80,-35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:1,far:250});sun.shadow.bias=-.001;sun.target.position.set(65,0,65);this.scene.add(sun,sun.target);
  this.boxGeo=new T.BoxGeometry(1,1,1);this.materials=new Map();
  this.box(64,-.5,60,140,1,140,'#6a9687');this.box(145,-.35,60,35,.5,160,'#dfc5a0');this.water=this.box(190,-.5,60,80,.4,180,'#499ca9');
  for(let i=0;i<30;i++)this.box(162+i%3*2,.03,i*5,1,.03,3,'#a1d7d3');
  for(const x of roadsX){this.box(x*.05,0,60,6.3,.12,120,'#b2b5ae');this.box(x*.05,.08,60,4.9,.06,120,'#3c4656');for(let z=0;z<120;z+=2.5)this.box(x*.05,.12,z,.08,.02,1.1,'#ead4a0');}
  for(const y of roadsY){this.box(61.5,.01,y*.05,123,.12,6.3,'#b2b5ae');this.box(61.5,.09,y*.05,123,.06,4.9,'#3c4656');for(let x=0;x<123;x+=2.5)this.box(x,.13,y*.05,1.1,.02,.08,'#ead4a0');}
  for(const x of roadsX)for(const z of roadsY)for(let i=0;i<6;i++){this.box(x*.05-2+i*.7,.15,z*.05-2.1,.4,.02,1,'#e5ded2');this.box(x*.05-2+i*.7,.15,z*.05+2.1,.4,.02,1,'#e5ded2');}
  buildings.forEach((b,i)=>{for(let k=0;k<4;k++){let bx=b.x*.05+(k%2)*8.75+4.2,bz=b.y*.05+Math.floor(k/2)*8.75+4.2,h=4+((i*7+k*3)%7)*1.6;const colors=['#d3b6bf','#a8c7c4','#a6afc8','#e0c6ad'];const m=this.box(bx,h/2,bz,8.1,h,8.1,colors[(i+k)%4]);m.receiveShadow=true;m.castShadow=true;this.box(bx,h+.2,bz,8.4,.3,8.4,'#d8d8d4');this.box(bx,h+.7,bz,2,1,2,'#7e8b97');for(let level=1;level<h-1;level+=1.8)for(let n=0;n<4;n++){this.box(bx-2.8+n*1.8,level,bz+4.08,.8,.9,.04,'#efc78f',true);this.box(bx+4.08,level,bz-2.8+n*1.8,.04,.9,.8,'#7ce1d9',true);}this.box(bx,1,bz+4.2,8.1,.2,.2,k%2?'#6ef6de':'#ff87bf',true);}
   this.sign(b.name,(b.x+b.w/2)*.05,3.3,(b.y+b.h)*.05+.1);
  });
  for(const p of palms)this.palm(p.x*.05,p.y*.05);
  for(let z=5;z<120;z+=9){this.box(117,2,z,.12,4,.12,'#444d65');this.box(116.4,4,z,1.3,.12,.15,'#444d65');this.box(115.9,3.9,z,.6,.1,.35,'#ffe5a0',true);this.box(121,.45,z,1.2,.15,.5,'#a48680');}
  // Distant skyline and a sunset disk beyond the city.
  for(let i=0;i<22;i++)this.box(-15+i*7,3+(i%5),-14,4,6+(i%5)*2,5,'#78839c');
  const disk=new T.Mesh(new T.SphereGeometry(9,24,16),new T.MeshBasicMaterial({color:'#ffcd96'}));disk.position.set(170,25,-85);this.scene.add(disk);
  this.ride=this.carMesh('#f56ca9');this.trafficMeshes=traffic.map(t=>this.carMesh(t.c));this.avatar=this.person('#54d8c0');
  for(let i=0;i<64;i++){const b=buildings[i%16],minX=b.x-9,maxX=b.x+b.w+9,minZ=b.y-9,maxZ=b.y+b.h+9;this.peds.push({mesh:this.person(['#f2d08d','#ed8eab','#75bfc8','#d5d2e4','#56728c'][i%5]),route:[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]],segment:i%4,t:(i%7)/7,speed:22+i%6*3});}
  for(let i=0;i<12;i++){const x=roadsX[i%5],z=roadsY[1+i%3]-42;this.peds.push({mesh:this.person(i%2?'#e8bf81':'#aa96c8'),route:[[x-66,z],[x+66,z]],segment:i%2,t:i/12,speed:25});}
  this.marker=new T.Mesh(new T.TorusGeometry(2.5,.1,8,40),this.mat('#ffd369',true));this.marker.rotation.x=-Math.PI/2;this.scene.add(this.marker);this.beacon=this.box(0,4,0,.18,8,.18,'#ffcf67',true);
  this.cameraButton=document.querySelector('#camera');this.cameraButton.onclick=()=>this.cycle();window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='c'&&!e.repeat)this.cycle()});
  let dragging=false,lx=0;canvas.addEventListener('pointerdown',e=>{dragging=true;lx=e.clientX;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(dragging){this.yaw-=(e.clientX-lx)*.006;lx=e.clientX}});canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
 }
 mat(c,glow=false){const key=c+glow;if(!this.materials.has(key))this.materials.set(key,new THREE.MeshStandardMaterial({color:c,roughness:.8,emissive:glow?c:'#000000',emissiveIntensity:glow?.65:0}));return this.materials.get(key)}
 box(x,y,z,w,h,d,c,glow=false,parent=this.scene){const m=new THREE.Mesh(this.boxGeo,this.mat(c,glow));m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m}
 sign(text,x,y,z){const c=document.createElement('canvas');c.width=512;c.height=96;let t=c.getContext('2d');t.fillStyle='#233747';t.fillRect(0,0,512,96);t.strokeStyle='#f891c5';t.lineWidth=5;t.strokeRect(3,3,506,90);t.fillStyle='#fff0cc';t.font='bold 36px Arial';t.textAlign='center';t.fillText(text,256,62);const m=new THREE.Mesh(new THREE.PlaneGeometry(7,1.3),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide}));m.position.set(x,y,z);this.scene.add(m)}
 palm(x,z){const trunk=this.box(x,1.8,z,.22,3.6,.22,'#998169');trunk.rotation.z=.08;for(let j=0;j<6;j++){const leaf=this.box(x+Math.cos(j*Math.PI/3)*.6,3.9,z+Math.sin(j*Math.PI/3)*.6,.45,.1,2,'#438b76');leaf.rotation.y=-j*Math.PI/3+Math.PI/2;leaf.rotation.z=.15;}}
 carMesh(c){const g=new THREE.Group();this.scene.add(g);this.box(0,.55,0,2.65,.6,1.35,c,false,g).castShadow=true;this.box(-.15,1,0,1.25,.5,1.12,'#324b65',false,g);this.box(-.25,1.29,0,1.15,.08,1.15,c,false,g);for(const x of [-.85,.85])for(const z of [-.7,.7]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.18,12),this.mat('#242637'));wheel.rotation.x=Math.PI/2;wheel.position.set(x,.32,z);g.add(wheel);}for(const z of [-.42,.42]){this.box(1.34,.58,z,.04,.19,.25,'#fff1b5',true,g);this.box(-1.34,.58,z,.04,.19,.25,'#f94567',true,g)}return g;}
 person(color){const g=new THREE.Group();this.scene.add(g);this.box(0,1.05,0,.4,.6,.3,color,false,g).castShadow=true;const head=new THREE.Mesh(new THREE.SphereGeometry(.17,8,6),this.mat('#d6aa87'));head.position.y=1.55;g.add(head);const limbs=[];for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.12,.77,0);this.box(0,-.33,0,.15,.65,.17,'#35475d',false,leg);g.add(leg);limbs.push(leg);const arm=new THREE.Group();arm.position.set(side*.28,1.3,0);this.box(0,-.25,0,.12,.5,.13,color,false,arm);g.add(arm);limbs.push(arm);}g.userData.limbs=limbs;return g;}
 cycle(){this.mode=(this.mode+1)%3;this.yaw=0;this.cameraButton.textContent='C · '+this.modes[this.mode];}
 animatePerson(mesh,moving,phase){mesh.userData.limbs.forEach((l,i)=>l.rotation.x=moving?Math.sin(phase)*(i<2?1:-1)*(i%2?-.55:.55):0)}
 tick(dt){for(const p of this.peds){let start=p.route[p.segment],end=p.route[(p.segment+1)%p.route.length],len=Math.hypot(end[0]-start[0],end[1]-start[1]);if(!paused&&running)p.t+=dt*p.speed/len;if(p.t>=1){p.t-=1;p.segment=(p.segment+1)%p.route.length;start=p.route[p.segment];end=p.route[(p.segment+1)%p.route.length];}const x=start[0]+(end[0]-start[0])*p.t,z=start[1]+(end[1]-start[1])*p.t;p.x=x;p.z=z;p.mesh.position.set(x*.05,0,z*.05);p.mesh.rotation.y=-Math.atan2(end[1]-start[1],end[0]-start[0])+Math.PI/2;this.animatePerson(p.mesh,running&&!paused,time*6+p.segment);}}
 render(dt){const w=innerWidth,h=innerHeight;if(this.width!==w||this.height!==h){this.width=w;this.height=h;this.renderer.setSize(w,h,false);this.view.aspect=w/h;this.view.updateProjectionMatrix()}
 this.tick(dt);this.ride.position.set(car.x*.05,0,car.y*.05);this.ride.rotation.y=-car.a;traffic.forEach((t,i)=>{const mesh=this.trafficMeshes[i];mesh.position.set(t.x*.05,0,t.y*.05);mesh.rotation.y=-t.a});this.avatar.visible=!driving;this.avatar.position.set(player.x*.05,0,player.y*.05);this.avatar.rotation.y=-player.a+Math.PI/2;this.animatePerson(this.avatar,running&&!paused&&(keys.w||keys.s||keys.a||keys.d||keys.arrowup||keys.arrowdown||keys.arrowleft||keys.arrowright),time*9);
 const t=stage===0?car:target;this.marker.visible=this.beacon.visible=stage<3;this.marker.position.set(t.x*.05,.2,t.y*.05);this.marker.scale.setScalar(1+Math.sin(time*3)*.07);this.beacon.position.set(t.x*.05,3,t.y*.05);
 const pos=new THREE.Vector3(player.x*.05,driving?1:1.4,player.y*.05),angle=player.a+this.yaw;let desired,look=pos.clone();
 if(this.mode===2){desired=pos.clone().add(new THREE.Vector3(0,48,13));look.y=0;}
 else {const dist=this.mode===1?(driving?4.8:3.8):(driving?9:6),height=this.mode===1?1.8:4;desired=pos.clone().add(new THREE.Vector3(-Math.cos(angle)*dist,height,-Math.sin(angle)*dist));look.add(new THREE.Vector3(Math.cos(angle)*4,.2,Math.sin(angle)*4));}
 // Raise the camera above nearby buildings rather than looking through walls.
 for(const b of buildings){if(desired.x>b.x*.05&&desired.x<(b.x+b.w)*.05&&desired.z>b.y*.05&&desired.z<(b.y+b.h)*.05)desired.y=Math.max(desired.y,18);}
 this.view.position.lerp(desired,1-Math.exp(-dt*6));this.look.lerp(look,1-Math.exp(-dt*8));this.view.lookAt(this.look);this.renderer.render(this.scene,this.view);
 document.querySelector('#viewlabel').textContent=this.modes[this.mode]+' CAMERA · C TO SWITCH';
 }
}
window.CoastWorld=CoastWorld;
