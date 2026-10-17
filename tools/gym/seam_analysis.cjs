// Independent qualification of retained completed-step values, not launch speed.
function qualify(r){
 const reasons=[],rows=r.trace.filter(v=>v[2]>=39);
 if(![5,15,30].includes(r.nominal_mps))reasons.push('unsupported nominal speed');
 if(!rows.length||rows[0][2]>39+r.nominal_mps/60+.05||rows.at(-1)[2]<79)reasons.push('incomplete window');
 if(rows.some(v=>Math.abs(v[4]-r.nominal_mps)>r.nominal_mps*.05))reasons.push('speed outside +/-5% window');
 if(r.trace.some(v=>Math.abs(v[1]-1/60)>.00001))reasons.push('unexpected timestep');
 if(r.trace.some(v=>!v.slice(0,8).every(Number.isFinite)))reasons.push('nonfinite trace');
 if(r.trace.some((v,i)=>i&&Math.abs(v[0]-r.trace[i-1][0]-v[1])>.00001))reasons.push('missing step');
 if(r.freewheel&&r.trace.some(v=>v[10]!==0||v[11]!==0||v[12]!==0||v[13]!==false||v[14]!==false))reasons.push('freewheel conditions changed');
 return {comparable:reasons.length===0,reasons};
}
function peaks(r,x){
 let vy=0,dvy=0,rise=0,samples=0,loss1=0,loss2=0;
 r.trace.forEach((v,i)=>{
  if(v[2]<39||Math.abs(v[2]-x)>1)return;
  samples++;vy=Math.max(vy,Math.abs(v[5]));dvy=Math.max(dvy,i?Math.abs(v[5]-r.trace[i-1][5]):0);
  rise=Math.max(rise,v[3]-r.baseline_y);if(!v[8])loss1++;if(!v[9])loss2++;
 });
 return {vy,dvy,rise,samples,loss1,loss2};
}
module.exports={qualify,peaks};
