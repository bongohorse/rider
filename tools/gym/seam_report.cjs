// A18 report from retained runs; shared by the full run and the CI part merge.
const {SPEEDS}=require('./seam_analysis.cjs');
// CI splits the protocol over two runners. Each part keeps whole free-roll pairs, so every
// per-speed comparison is measured on one runner; the merge recomputes the full report.
const PARTS={'1/2':{speeds:[5,7],powered:false,rejected:true},'2/2':{speeds:[9],powered:true,rejected:false}};
function plan(part){
 if(!part)return {speeds:SPEEDS,powered:true,rejected:true};
 if(!Object.hasOwn(PARTS,part))throw Error('Unknown A18 part: '+part);
 return PARTS[part];
}
const condition=r=>({station:r.station,status:r.status,entry:r.entry_mps,min:r.speed_min_mps,max:r.speed_max_mps,drift:r.drift_mps,bumps:r.comparable?r.ghost_bumps:null,vertical:r.comparable?r.vertical_bumps:null,longitudinal:r.comparable?r.longitudinal_hits:null,spin_peak:r.wheel_spin_peak_rps,reasons:r.reasons});
const pairOf=(list,mode,speed)=>{const pair=list.filter(r=>r.nominal_mps===speed);return {mode,nominal_mps:speed,status:pair.length===2&&pair.every(r=>r.comparable)?'COMPARABLE':'NOT COMPARABLE',conditions:pair.map(condition)};};
function comparisonOf(results,poweredControls,speeds=SPEEDS,powered=true){
 return [...speeds.map(s=>pairOf(results,'free roll',s)),...(powered?[5,9].map(s=>pairOf(poweredControls,'powered control',s)):[])];
}
// D8 verdict follows only from qualified free-roll pairs; never asserted.
function verdict(comparison){
 const freeRoll=comparison.filter(r=>r.mode==='free roll'),complete=freeRoll.every(r=>r.status==='COMPARABLE');
 const bumps=(c,id)=>c.conditions.find(x=>x.station===id).bumps;
 const d8=!complete?'PROVISIONAL: retain chain; missing qualified free-roll pairs':freeRoll.every(c=>bumps(c,'seams-chain')<=bumps(c,'seams-hull'))?'CONFIRMED: chain terrain has no more ghost bumps than hull at every qualified speed':'REVISE: hull has fewer ghost bumps than chain at a qualified speed';
 return {acceptance:complete?'PASS':'BLOCKED',d8};
}
// Parts must come from one source and browser and together cover the full protocol once.
function merge(parts){
 const names=parts.map(p=>p.part).sort();
 if(JSON.stringify(names)!==JSON.stringify(Object.keys(PARTS).sort()))throw Error('A18 parts incomplete or repeated: '+names.join());
 for(const p of parts){
  if(p.status!=='PASS'||p.protocol!==3)throw Error('A18 part '+p.part+' did not pass');
  if(p.source_sha!==parts[0].source_sha||p.browser!==parts[0].browser)throw Error('A18 parts differ in source or browser');
  // Each part holds exactly its own free-roll pairs and, if planned, the four powered controls.
  const scope=PARTS[p.part],speeds=r=>[...new Set(r.map(x=>x.nominal_mps))].sort((a,b)=>a-b);
  if(JSON.stringify(speeds(p.results))!==JSON.stringify(scope.speeds)||p.results.length!==2*scope.speeds.length||p.retries.length!==p.results.length)throw Error('A18 part '+p.part+' holds the wrong free-roll runs');
  if(p.poweredControls.length!==(scope.powered?4:0)||(p.rejected!==null)!==scope.rejected)throw Error('A18 part '+p.part+' holds the wrong controls');
 }
 if(new Set(parts.map(p=>p.run_id)).size!==parts.length)throw Error('A18 parts share a run id');
 const ordered=Object.keys(PARTS).map(name=>parts.find(p=>p.part===name));
 const results=ordered.flatMap(p=>p.results),retries=ordered.flatMap(p=>p.retries),poweredControls=ordered.flatMap(p=>p.poweredControls);
 const rejected=ordered.map(p=>p.rejected).filter(Boolean);
 if(rejected.length!==1)throw Error('A18 parts must contain exactly one unsupported-speed trial');
 const comparison=comparisonOf(results,poweredControls);
 return {status:'PASS',protocol:3,...verdict(comparison),source_sha:parts[0].source_sha,run_ids:ordered.map(p=>p.run_id),parts:ordered.map(p=>p.part),
  browser:parts[0].browser,results,retries,poweredControls,comparison,rejected:rejected[0],real_device:'NOT RUN'};
}
module.exports={PARTS,plan,comparisonOf,verdict,merge};
