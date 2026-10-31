'use strict';
window.coastFeed=(()=>{
 const session=crypto.randomUUID(),queue=[];
 let busy=false,connected=false,stats=null,lastSync=null,error='Connecting…';
 function enqueue(event){queue.push({...event,id:crypto.randomUUID(),client_timestamp:new Date().toISOString()});}
 async function sync(){
  if(busy||location.protocol==='file:')return;
  busy=true;
  try{
   if(queue.length){const batch=queue.slice(0,100);const sent=await fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session,events:batch}),signal:AbortSignal.timeout(4000)});if(!sent.ok)throw Error('Upload failed');queue.splice(0,batch.length);}
   const r=await fetch('/api/live',{signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('Feed unavailable');stats=await r.json();connected=true;lastSync=new Date();error='';
  }catch(e){connected=false;error='Disconnected · retrying';}finally{busy=false;}
 }
 function panel(){
  const node=document.querySelector('#feed');if(!node)return;
  node.replaceChildren();
  const line=(text,color)=>{const d=document.createElement('div');d.textContent=text;if(color)d.style.color=color;node.append(d)};
  line(connected?'● CONNECTED · LOCAL SERVER':'○ '+(location.protocol==='file:'?'Open localhost:5174 for live data':error),connected?'#7de5db':'#f5cd79');
  line('Updates every second · SQLite storage');
  line('Pending upload: '+queue.length);
  if(stats){line('Saved events: '+stats.total_events+' · Sessions: '+stats.total_sessions);line('Last sync: '+lastSync.toLocaleTimeString());line('RECENT SERVER EVENTS','#7de5db');for(const row of stats.recent.slice(0,5)){const e=row.event;line(e.type+(e.type==='position'?' · '+e.x+', '+e.y+' · '+Math.round(e.speed*.36)+' km/h':''));}}
 }
 setInterval(sync,1000);setInterval(panel,500);sync();
 return {enqueue};
})();
