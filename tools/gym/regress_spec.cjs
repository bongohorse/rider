// A22 regression traces (#37): trace definitions, frozen tolerances and the outcome check.
// Declared before any run. The record tool never writes this file; tests/ci/regress.test.cjs pins the tolerances.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..');
const DIR=path.join(ROOT,'tests/regress');
const EXPECTED=path.join(DIR,'expected.json');

// Tolerances and their sources (main/gym/README.md):
const TOLERANCE=Object.freeze({
 // A21 replay.lua M.TOLERANCE: same preset, chassis position and angle on every replayed tick (verdict MATCH).
 pose:Object.freeze({position_m:0.05,angle_rad:0.05}),
 // Speed repeat tolerance of the stations: a19 takeoff, a19b apex, a19c takeoff speed. Checked on every trace;
 // top-speed coverage is straight-top (gaps-3 tops at its 7 m/s start speed, air-big-back at its fall speed).
 top_speed_mps:0.02,
 // a19 gaps repeat tolerances (plus same status).
 gaps:Object.freeze({jump_distance_m:0.05,takeoff_speed_mps:0.02,peak_compression_m:0.005}),
 // a19c air repeat tolerances (plus same status); airtime = two 60 Hz steps.
 air:Object.freeze({takeoff_speed_mps:0.02,airtime_s:0.034,rotation_deg:5,landing_angle_deg:5,peak_compression_m:0.005}),
});

// Each trace starts at a station start on preset A, 1.0x, 60 Hz. program: the recording driver (record mode only):
// 'full' = A19 full throttle, no brake/lean; 'air' = A19c protocol (throttle to the lip takeoff, then the URL lean).
const TRACES=Object.freeze([
 {name:'gaps-3',kind:'gaps',station:'gaps',section:'3',start_speed:7,program:'full',query:'?station=gaps&section=3',ticks:180},
 {name:'straight-top',kind:'top',station:'straight',section:false,start_speed:0,program:'full',query:'?station=straight',ticks:600},
 {name:'air-big-back',kind:'air',station:'air',section:'big',start_speed:7,program:'air',query:'?station=air&section=big',record_query:'&lean=1',ticks:420},
].map(Object.freeze));

// Declared perturbations that must FAIL, and the checks that must report them.
const PERTURB=Object.freeze({
 // Trace: throttle released on ticks 1-45 of gaps-3 (poses and expected outcomes unchanged).
 trace:Object.freeze({name:'gaps-3',throttle_zero:[1,45],must_fail:['verdict','takeoff_speed_mps']}),
 // Preset value (debug only, live-tuning path, before the replay): wheel target 32 -> 31 rad/s on straight-top.
 preset:Object.freeze({name:'straight-top',tune:{key:'motor_speed',value:-31},must_fail:['top_speed_mps']}),
});

const file=name=>path.join(DIR,'traces',name+'.json');
const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');
function readTrace(name){return JSON.parse(fs.readFileSync(file(name),'utf8'));}
function readExpected(){return JSON.parse(fs.readFileSync(EXPECTED,'utf8'));}

// Outcomes from the a22 result (window.riderRegressResult) of one run.
function outcomes(def,result){
 const o={top_speed_mps:result.top_speed_mps};
 const report=result.station_report;
 if(def.kind==='gaps'){
  const r=report&&report.records.find(x=>x.id===def.section);
  if(!r||!r.done||!r.independent)return {...o,complete:false};
  Object.assign(o,{status:r.status,jump_distance_m:r.jump_distance_m??null,takeoff_speed_mps:r.takeoff_speed_mps,peak_compression_m:r.peak_compression_m});
 }else if(def.kind==='air'){
  const j=report&&(report.jumps||[]).find(x=>x.from_lip&&x.section===def.section);
  if(!j||!j.complete)return {...o,complete:false};
  Object.assign(o,{status:j.status,takeoff_speed_mps:j.takeoff_speed_mps,airtime_s:j.airtime_s,rotation_deg:j.rotation_deg,landing_angle_deg:j.landing_angle_deg,peak_compression_m:j.peak_compression_m});
 }
 return {...o,complete:true};
}
function tolerances(def){return {top_speed_mps:TOLERANCE.top_speed_mps,...(TOLERANCE[def.kind]||{})};}

// The regression check: [] = PASS, else one entry per failed check {check, expected, measured, tolerance}.
// play = the A21 replay summary (window.riderReplay.play) at the end of the replay.
function check(def,expected,measured,play){
 const failures=[];
 const fail=(name,e,m,t)=>failures.push({check:name,expected:e,measured:m,tolerance:t??null});
 if(!play)fail('replay',true,false);
 else{
  if(play.verdict!=='MATCH')fail('verdict','MATCH',play.verdict,TOLERANCE.pose);
  if(play.ended!=='done')fail('ended','done',play.ended);
  if(play.applied!==def.ticks)fail('applied',def.ticks,play.applied);
  if(play.compared!==def.ticks+1)fail('compared',def.ticks+1,play.compared);
  if(play.mismatches!==0)fail('mismatches',0,play.mismatches);
  if(play.scaled_ticks!==0)fail('scaled_ticks',0,play.scaled_ticks);
 }
 if(!measured.complete)fail('complete',true,false);
 if(expected.status!==undefined&&measured.status!==expected.status)fail('status',expected.status,measured.status);
 for(const [key,tol] of Object.entries(tolerances(def))){
  const e=expected[key],m=measured[key];
  if(e===null&&m===null)continue; // e.g. no jump distance on a MISSED gap, in both
  if(!Number.isFinite(e)||!Number.isFinite(m)||Math.abs(m-e)>tol)fail(key,e,m,tol);
 }
 return failures;
}

// Trace file: A21 format version 1 as exported by the a22 recorder; derivation: poses rounded to 1e-6 m/rad.
const round=v=>{const r=Math.round(v*1e6)/1e6;return Object.is(r,-0)?0:r;};
function traceText(def,rec,meta){
 // Stable key order for reviewable diffs: tuning in feel.preset_keys order.
 const tuning=Object.fromEntries(presetA().keys.map(k=>[k,rec.tuning[k]]));
 if(Object.keys(rec.tuning).length!==Object.keys(tuning).length)throw Error('unexpected tuning keys');
 const t={format:'rider-recording',version:rec.version,name:def.name,derivation:'A21 recording format v1 exported by the a22 recorder; poses rounded to 1e-6 m and rad',
  recorded:meta,station:rec.station,section:rec.section,start_speed:rec.start_speed,preset:rec.preset,modified:rec.modified,tuning,
  identity:rec.identity,source_sha:rec.source_sha,ticks:rec.ticks,ended:rec.ended,scaled_ticks:rec.scaled_ticks,trailing:rec.trailing,
  throttle:rec.throttle,brake:rec.brake,reverse:rec.reverse,lean:rec.lean,pose:rec.pose.map(round)};
 const lines=[];
 for(const [k,v] of Object.entries(t)){
  if(k==='pose'){
   const rows=[];for(let i=0;i<v.length;i+=9)rows.push('  '+v.slice(i,i+9).join(','));
   lines.push(' "pose": [\n'+rows.join(',\n')+'\n ]');
  }else lines.push(' '+JSON.stringify(k)+': '+JSON.stringify(v));
 }
 return '{\n'+lines.join(',\n')+'\n}\n';
}

// Preset A identity as the game builds it (replay.lua identity(): key=tostring(value) in feel.preset_keys order;
// an optional key absent from the preset file is at its default and left out, #211).
function presetA(){
 const keys=JSON.parse('['+/M\.preset_keys=\{([^}]*)\}/.exec(fs.readFileSync(path.join(ROOT,'main/gym/feel.lua'),'utf8'))[1]+']');
 const values=JSON.parse(fs.readFileSync(path.join(ROOT,'main/gym/presets/a.json'),'utf8')).values;
 const present=keys.filter(k=>k in values);
 return {keys:present,values,identity:present.map(k=>k+'='+String(values[k])).join(';')};
}

module.exports={ROOT,DIR,EXPECTED,TOLERANCE,TRACES,PERTURB,file,sha256,readTrace,readExpected,outcomes,tolerances,check,traceText,presetA};
