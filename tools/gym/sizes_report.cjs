// LE1b report tables and the CI part split; shared by the full run and the part merge.
const {cases}=require('./levels.cjs');
// CI splits the accepted levels into contiguous halves on two runners; each level is measured whole on one runner.
// A later part first measures, but does not report, the level before its first one, so every first import
// switches from the same previous level and world state as in a single run. The rejected limit cases run once,
// in the last part, after that part's accepted levels.
const PARTS=['1/2','2/2'];
function select(all,part){
 if(!part)return all;
 const index=PARTS.indexOf(part);if(index<0)throw Error('Unknown LE1b part: '+part);
 const accepted=all.filter(c=>c.expect==='accepted'),size=Math.ceil(accepted.length/PARTS.length),from=index*size;
 const own=accepted.slice(from,from+size),previous=from?[{...accepted[from-1],warmup:true}]:[];
 return [...previous,...own,...(index===PARTS.length-1?all.filter(c=>c.expect==='rejected'):[])];
}
// Report tables for docs; every value is copied from the result JSON, sub-resolution values are marked.
function markdown(r){
 const f=(v,d=1)=>v===null||v===undefined?'unknown':v.toFixed(d),res=r.identity.performance_now_step_ms;
 const below=(v,step,d)=>v===null||v===undefined?'unknown':v<step?'<'+step:v.toFixed(d);
 const ms=v=>v===null||v===undefined?'n/a':v<1?'<1':Math.round(v);
 const median=a=>a.length?[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)/2)]:null;
 const row=c=>'| '+c.join(' | ')+' |';
 const ok=r.results.filter(x=>x.outcome==='drive_ready'),failed=r.results.filter(x=>x.outcome==='placement_failed'),rejected=r.results.filter(x=>x.expect==='rejected');
 const out=['Source `'+r.source_sha+'`, '+(r.run_ids?'runs `'+r.run_ids.join('`, `')+'` (CI parts '+r.parts.join(', ')+')':'run `'+r.run_id+'`')+', Chromium '+r.browser+' headless, '+r.identity.gl_renderer+', viewport '+r.identity.viewport.width+'x'+r.identity.viewport.height+' DPR '+r.identity.dpr+
  ', preset '+r.preset.toUpperCase()+'. Repeats '+r.protocol.repeats+'; '+r.protocol.warmup_ms/1000+' s warm-up, then '+r.protocol.sample_ms/1000+' s full throttle. performance.now() step '+f(res,3)+' ms (cross-origin isolated: '+r.identity.cross_origin_isolated+').','',
  '### Levels and sizes','',row(['Level','Dimension','Length m','Start m','Segments','Chains','Hulls','Render objects','Text KiB','Save KiB','Terrain shapes','Decoration sprites']),row(Array(12).fill('---'))];
 for(const x of [...ok,...failed])out.push(row([x.id,x.dimension,x.length_m,x.start_m,x.segments,x.chains,x.hulls,x.render_objects,f(x.text_bytes/1024),x.save_bytes?f(x.save_bytes/1024):'n/a',x.counts?.terrain_shapes??'n/a',x.counts?.decor_sprites??'n/a']));
 out.push('','### World switch (Import text click to drive-ready)','',row(['Level','Median ms','Worst ms','First import ms','Longest frame in switch ms','Lua parse ms','Lua terrain ms','Lua decoration ms','Lua switch ms']),row(Array(9).fill('---')));
 for(const x of ok){const l=x.switch.lua;out.push(row([x.id,f(x.switch.median_ms),f(x.switch.worst_ms),f(x.switch.first_ms),f(x.switch.longest_frame_ms),
  ms(median(l.map(v=>v.parse_ms))),ms(median(l.map(v=>v.build_ms))),ms(median(l.map(v=>v.decorate_ms))),ms(median(l.map(v=>v.switch_ms)))]));}
 for(const x of failed)out.push(row([x.id,'placement failed: `'+x.error+'`','','','','','','','']));
 out.push('','### Frames and physics during the drive window','',row(['Level','Interval p50/p95/p99/max ms','Over 25 ms','Engine callback work p50/p95/max ms','Physics step p50/p95/max ms','Zero step samples','Contacts max','Static tree height','Distance m','Resets']),row(Array(10).fill('---')));
 for(const x of ok){const i=x.frame.interval_ms,w=x.frame.work_ms,p=x.physics.step_ms,step=Math.round((x.physics.resolution.smallest_difference??res)*1000)/1000;
  out.push(row([x.id,[i.p50,i.p95,i.p99,i.max].map(v=>f(v)).join(' / '),x.frame.over_25ms+' of '+i.n,[w.p50,w.p95,w.max].map(v=>below(v,res,1)).join(' / '),
   [p.p50,p.p95,p.max].map(v=>below(v,step,1)).join(' / '),x.physics.resolution.zero+' of '+p.n,x.physics.contacts?.max??'unknown',x.physics.static_tree_height??'unknown',f(x.drive.distance_m),x.drive.resets]));}
 out.push('','### Memory observations (end of drive window)','',row(['Level','Box2D world KiB','Lua heap KiB','WASM linear memory MiB','JS heap']),row(Array(5).fill('---')));
 for(const x of ok)out.push(row([x.id,f(x.memory.box2d_bytes/1024),f(x.memory.lua_kib),x.memory.wasm_bytes?f(x.memory.wasm_bytes/1048576,0):'unknown',x.memory.js_heap]));
 out.push('','### Rejected limit cases','',row(['Case','Dimension','Render objects','Text KiB','Message','Physics cost']),row(Array(6).fill('---')));
 for(const x of rejected)out.push(row([x.id,x.dimension,x.render_objects,f(x.text_bytes/1024),'`'+x.message+'`',x.physics]));
 return out.join('\n')+'\n';
}

// Parts must come from one source, browser and machine identity and together cover every case once.
function merge(parts){
 const names=parts.map(p=>p.part).sort();
 if(JSON.stringify(names)!==JSON.stringify([...PARTS].sort()))throw Error('LE1b parts incomplete or repeated: '+names.join());
 const same=['user_agent','gl_renderer','gl_vendor','dpr','cross_origin_isolated'];
 for(const p of parts){
  if(p.status!=='PASS')throw Error('LE1b part '+p.part+' did not pass');
  const {lua_clock_values_whole_ms,...protocol}=p.protocol,{lua_clock_values_whole_ms:_,...first}=parts[0].protocol;
  if(p.source_sha!==parts[0].source_sha||p.browser!==parts[0].browser||p.preset!==parts[0].preset||JSON.stringify(protocol)!==JSON.stringify(first))throw Error('LE1b parts differ in source, browser, preset or protocol');
  for(const k of same)if(p.identity[k]!==parts[0].identity[k])throw Error('LE1b parts differ in '+k);
  if(JSON.stringify(p.identity.viewport)!==JSON.stringify(parts[0].identity.viewport))throw Error('LE1b parts differ in viewport');
 }
 if(new Set(parts.map(p=>p.run_id)).size!==parts.length)throw Error('LE1b parts share a run id');
 const ordered=PARTS.map(name=>parts.find(p=>p.part===name)),byId=new Map(ordered.flatMap(p=>p.results).map(r=>[r.id,r]));
 const ids=cases().map(c=>c.id);
 if(byId.size!==ids.length||ordered.flatMap(p=>p.results).length!==ids.length||!ids.every(id=>byId.has(id)))throw Error('LE1b parts do not cover every case exactly once');
 // performance.now() resolution is per runner: keep the coarsest so no value is reported finer than measured.
 const identity={...ordered[0].identity,performance_now_step_ms:Math.max(...ordered.map(p=>p.identity.performance_now_step_ms))};
 return {source_sha:parts[0].source_sha,run_ids:ordered.map(p=>p.run_id),parts:ordered.map(p=>p.part),status:'PASS',browser:parts[0].browser,identity,
  // The Lua clock observation is measured per runner: whole milliseconds only if every part saw them.
  identities:ordered.map(p=>p.identity),preset:parts[0].preset,protocol:{...parts[0].protocol,lua_clock_values_whole_ms:ordered.every(p=>p.protocol.lua_clock_values_whole_ms)},
  // Wall-clock of the parallel parts, not of one sequential run.
  elapsed_s:Math.max(...ordered.map(p=>p.elapsed_s)),parts_elapsed_s:ordered.map(p=>p.elapsed_s),results:ids.map(id=>byId.get(id))};
}
module.exports={PARTS,select,markdown,merge};
