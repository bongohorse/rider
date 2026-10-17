// Independent qualification of the retained completed-step trace.
function qualify(r){
 const reasons=[];
 const rows=r.trace.filter(v=>v[2]>=39);
 if(![5,15,30].includes(r.nominal_mps))reasons.push('unsupported nominal speed');
 if(!rows.length||rows[0][2]>39+r.nominal_mps/60+.05||rows.at(-1)[2]<79)reasons.push('incomplete window');
 if(rows.some(v=>Math.abs(v[4]-r.nominal_mps)>r.nominal_mps*.05))reasons.push('speed outside +/-5% window');
 if(r.trace.some(v=>Math.abs(v[1]-1/60)>.00001))reasons.push('unexpected timestep');
 if(rows.some(v=>!v.slice(0,8).every(Number.isFinite)))reasons.push('nonfinite trace');
 return {comparable:reasons.length===0,reasons};
}
module.exports={qualify};
