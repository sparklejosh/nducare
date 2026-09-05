const B='http://localhost:3000';
const jar={};
async function call(who,path,opts={}){const r=await fetch(B+'/api'+path,{...opts,headers:{'Content-Type':'application/json',cookie:jar[who]||''},body:opts.body?JSON.stringify(opts.body):undefined});const sc=r.headers.get('set-cookie');if(sc)jar[who]=sc.split(';')[0];const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(path+' '+r.status+' '+JSON.stringify(j));return j;}
(async()=>{
  const em='test'+Date.now()+'@x.ng';
  let u=await call('p','/auth/signup',{method:'POST',body:{name:'Test Patient',email:em,password:'secret1',dob:'1990-01-01'}}); console.log('signup ok',u.user.id,u.user.role);
  await call('d','/auth/login',{method:'POST',body:{email:'adaeze@nducare.ng',password:'doctor123'}}); console.log('doctor login ok');
  try{await call('x','/auth/login',{method:'POST',body:{email:em,password:'wrong'}})}catch(e){console.log('bad pw rejected ✓')}
  const {doctors}=await call('p','/doctors'); console.log('doctors',doctors.length);
  const {appointment:a}=await call('p','/appointments',{method:'POST',body:{doctor_id:doctors[0].id,reason:'Fever & chills 3 days',symptoms:['Fever','Headache'],urgency:'soon'}}); console.log('booked',a.id,a.status,a.room_code);
  try{await call('p',`/appointments/${a.id}/status`,{method:'POST',body:{status:'accepted'}})}catch(e){console.log('patient cannot accept ✓')}
  await call('d',`/appointments/${a.id}/status`,{method:'POST',body:{status:'accepted'}}); console.log('accepted');
  const {plan}=await call('d',`/appointments/${a.id}/plan`,{method:'PUT',body:{diagnosis:'Uncomplicated malaria',tests:[{name:'Malaria Parasite',urgent:true},{name:'Full Blood Count'}],prescriptions:[{drug:'Artemether/Lumefantrine',strength:'80/480 mg',dose:'1 tab',frequency:'BD',duration:'3 days',qty:6}],advice:'Fluids, rest',follow_up_days:3}}); console.log('plan',plan.code);
  const v=await call('x','/verify/'+plan.code); console.log('verify ok →',v.plan.doctor_name,v.plan.prescriptions.length,'rx');
  try{await call('x','/verify/NC-NOPE00')}catch(e){console.log('bad code 404 ✓')}
  await call('d',`/appointments/${a.id}/status`,{method:'POST',body:{status:'completed'}});
  await call('p',`/appointments/${a.id}/review`,{method:'POST',body:{stars:5,comment:'Great'}}); console.log('review ok');
  const f=await call('x','/facilities?type=lab&lat=6.4483&lng=7.5139&service=Malaria%20Parasite|Full%20Blood%20Count&limit=3'); console.log('labs:',f.facilities.map(x=>`${x.name} ${x.distance_km}km ${x.matches}/2`));
  const ph=await call('x','/facilities?type=pharmacy&lat=6.4483&lng=7.5139&limit=3'); console.log('pharm:',ph.facilities.map(x=>`${x.name} ${x.distance_km}km`));
  const r=await call('x',`/route?from=6.4483,7.5139&to=${f.facilities[0].lat},${f.facilities[0].lng}`); console.log('route',Math.round(r.distance_m),'m',Math.round(r.duration_s/60),'min',r.steps.length,'steps, fallback:',!!r.fallback); console.log('  e.g.',r.steps.slice(0,3).map(s=>s.instruction));
  const st=await call('p','/stats'); console.log('stats',st);
  const qr=await fetch(B+'/api/qr?text=hello'); console.log('qr',qr.headers.get('content-type'));
  // WebSocket signaling test
  const WS=require('ws');
  const mk=(who)=>new Promise(res=>{const w=new WS('ws://localhost:3000/ws',{headers:{cookie:jar[who]}});w.on('open',()=>res(w));});
  const {appointment:a2}=await call('p','/appointments',{method:'POST',body:{doctor_id:doctors[1].id,reason:'ws test'}});
  await call('d2','/auth/login',{method:'POST',body:{email:doctors[1].email,password:'doctor123'}});
  await call('d2',`/appointments/${a2.id}/status`,{method:'POST',body:{status:'accepted'}});
  const wp=await mk('p'), wd=await mk('d2');
  const got=[]; wp.on('message',m=>got.push(JSON.parse(m))); wd.on('message',m=>got.push({d:JSON.parse(m)}));
  wp.send(JSON.stringify({type:'join',room:a2.room_code})); await new Promise(r=>setTimeout(r,200));
  wd.send(JSON.stringify({type:'join',room:a2.room_code})); await new Promise(r=>setTimeout(r,200));
  wd.send(JSON.stringify({type:'offer',sdp:{type:'offer',sdp:'x'}})); wp.send(JSON.stringify({type:'chat',room:a2.room_code,body:'hello doc'})); await new Promise(r=>setTimeout(r,300));
  console.log('ws events:',got.map(x=>x.d?('D:'+x.d.type):('P:'+x.type)).join(', '));
  const bad=new WS('ws://localhost:3000/ws'); bad.on('close',c=>console.log('unauth ws closed',c));
  await new Promise(r=>setTimeout(r,300)); wp.close();wd.close(); process.exit(0);
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
