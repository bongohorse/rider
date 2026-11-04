// Read declared inputs before a terrain observer starts a browser or server.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../../tests/gameplay/level-fixtures');
function loadFixtures(names){
 const fixtures={};
 for(const name of names){
  if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid terrain fixture name: '+name);
  const file=path.join(ROOT,name.endsWith('over-budget')?'terrain-p5':'terrain-p0',name+'.json');
  try{fixtures[name]=fs.readFileSync(file,'utf8');}
  catch(cause){throw Error(`Terrain fixture ${name} is unavailable: ${file}`,{cause});}
 }
 return Object.freeze(fixtures);
}
module.exports={loadFixtures};
