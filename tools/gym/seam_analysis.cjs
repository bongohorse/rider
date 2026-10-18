// Independent qualification of retained completed-step values, not launch speed.
const SPEEDS=[5,7,9],CAP=.25*Math.PI*60-.01;
function qualify(r){
 const reasons=[],rows=r.trace.filter(v=>v[2]>=39),off=v=>Math.abs(v[4]-r.nominal_mps)>r.nominal_mps*.05;
 if(!SPEEDS.includes(r.nominal_mps))reasons.push('unsupported nominal speed');
 if(!rows.length||rows[0][2]>39+r.nominal_mps/60+.05||rows.at(-1)[2]<79)reasons.push('incomplete window');
 if(r.trace.some(v=>v[2]<=38&&off(v)))reasons.push('baseline speed outside +/-5% window');
 if(rows.length&&off(rows[0]))reasons.push('entry speed outside +/-5% window');
 // Free roll measures seam speed loss; powered control must hold the window.
 if(r.freewheel?rows.some(v=>v[4]>r.nominal_mps*1.05):rows.some(off))reasons.push(r.freewheel?'speed above +5% window':'speed outside +/-5% window');
 if(r.trace.some(v=>Math.abs(v[15])>=CAP||Math.abs(v[16])>=CAP))reasons.push('wheel spin at engine rotation cap');
 if(r.trace.some(v=>Math.abs(v[1]-1/60)>.00001))reasons.push('unexpected timestep');
 if(r.trace.some(v=>!v.slice(0,8).every(Number.isFinite)||!Number.isFinite(v[15])||!Number.isFinite(v[16])))reasons.push('nonfinite trace');
 if(r.trace.some((v,i)=>i&&Math.abs(v[0]-r.trace[i-1][0]-v[1])>.00001))reasons.push('missing step');
 if(r.freewheel&&r.trace.some(v=>v[10]!==0||v[11]!==0||v[12]!==0||v[13]!==false||v[14]!==false))reasons.push('freewheel conditions changed');
 return {comparable:reasons.length===0,reasons};
}
function peaks(r,x){
 let vy=0,dvy=0,dvx=0,rise=0,samples=0,loss1=0,loss2=0,first,last;
 r.trace.forEach((v,i)=>{
  if(v[2]<39||Math.abs(v[2]-x)>1)return;
  samples++;vy=Math.max(vy,Math.abs(v[5]));dvy=Math.max(dvy,i?Math.abs(v[5]-r.trace[i-1][5]):0);
  dvx=Math.max(dvx,i?r.trace[i-1][4]-v[4]:0);first??=v[4];last=v[4];
  rise=Math.max(rise,v[3]-r.baseline_y);if(!v[8])loss1++;if(!v[9])loss2++;
 });
 return {vy,dvy,dvx,rise,samples,loss1,loss2,vxLoss:samples?first-last:0};
}
module.exports={SPEEDS,qualify,peaks};
