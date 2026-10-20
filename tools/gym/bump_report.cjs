// A19b report parts; shared by the full run and the CI part merge. CI splits the protocol over two
// runners: part 1 checks geometry, URL/R, both ladders and the repeats; part 2 runs the lift-off sweep
// with its bisection, which needs only its own runs. The merge rebuilds the report of a single run.
const PARTS={'1/2':{ladders:true,sweep:false},'2/2':{ladders:false,sweep:true}};
const CASES={ladders:['geometry_reproduced_by_editor_compiler','url_opens_station_and_r_returns_to_start','ladder_default_and_comparison_speed','repeatable_fresh_load_and_retry'],
 sweep:['crest_liftoff_speed_sweep']};
function plan(part){
 if(!part)return {ladders:true,sweep:true};
 if(!Object.hasOwn(PARTS,part))throw Error('Unknown A19b part: '+part);
 return PARTS[part];
}
// Case names in the order a single run reports them.
function cases(scope){return [...(scope.ladders?CASES.ladders.slice(0,3):[]),...(scope.sweep?CASES.sweep:[]),...(scope.ladders?CASES.ladders.slice(3):[])];}
// Parts must come from one source and browser and together cover the full protocol once.
function merge(parts){
 const names=parts.map(p=>p.part).sort();
 if(JSON.stringify(names)!==JSON.stringify(Object.keys(PARTS).sort()))throw Error('A19b parts incomplete or repeated: '+names.join());
 for(const p of parts){
  if(p.status!=='PASS')throw Error('A19b part '+p.part+' did not pass');
  if(p.source_sha!==parts[0].source_sha||p.browser!==parts[0].browser)throw Error('A19b parts differ in source or browser');
  if(JSON.stringify(p.cases)!==JSON.stringify(cases(PARTS[p.part])))throw Error('A19b part '+p.part+' holds the wrong cases');
 }
 if(new Set(parts.map(p=>p.run_id)).size!==parts.length)throw Error('A19b parts share a run id');
 const one=parts.find(p=>p.part==='1/2'),two=parts.find(p=>p.part==='2/2');
 if(JSON.stringify(one.protocol)!==JSON.stringify(two.protocol))throw Error('A19b parts differ in protocol');
 return {status:'PASS',source_sha:one.source_sha,run_ids:[one.run_id,two.run_id],parts:['1/2','2/2'],browser:one.browser,cases:cases(plan(null)),
  tolerances:one.tolerances,protocol:one.protocol,geometry:one.geometry,ladders:one.ladders,liftoff:two.liftoff,sweep:two.sweep,
  repeats:one.repeats,retry:one.retry,real_device:'NOT RUN'};
}
module.exports={PARTS,plan,cases,merge};
