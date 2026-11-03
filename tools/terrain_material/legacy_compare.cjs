// #392 Stage A: the untextured route must render as on main. Two verified debug Gym bundles (main and the branch),
// same stations, Edit view after Fit; writes screenshots and diff.json (differing pixels, max channel delta).
// Local evidence only, not part of `required`:
//   node tools/terrain_material/legacy_compare.cjs <main bundle> <branch bundle> <out dir>
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const STATIONS=['first-run','gaps-landing','rolling-hills'];
const [mainArg,branchArg,outArg]=process.argv.slice(2);
if(!mainArg||!branchArg||!outArg)throw Error('Usage: node tools/terrain_material/legacy_compare.cjs MAIN_BUNDLE BRANCH_BUNDLE OUT');
const out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
function serve(root){const web=path.dirname(find(path.resolve(root)));return http.createServer((req,res)=>{const f=path.resolve(web,'.'+new URL(req.url,'http://l').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(f).pipe(res);});}
async function key(p,k){await p.keyboard.down(k);await pointer.frames(p,{n:3});await p.keyboard.up(k);}
(async()=>{
 const b=await chromium.launch();const errors=[],shots={};
 for(const [name,root] of [['main',mainArg],['branch',branchArg]]){
  shots[name]=JSON.parse(fs.readFileSync(path.join(root,'bundle.json'),'utf8')).source_sha;
  const server=serve(root);await new Promise(o=>server.listen(0,'127.0.0.1',o));
  for(const station of STATIONS){
   const ctx=await b.newContext({viewport:{width:1280,height:720}});const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
   await configure(p,'legacy-392','le6');await p.goto('http://127.0.0.1:'+server.address().port+'/index.html?station='+station);
   await p.waitForFunction(()=>window.riderRoadProjection?.sections>0&&window.riderTelemetry?.sequence>30,null,{timeout:60000});
   await p.locator('canvas').focus();await key(p,'e');
   await p.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:20000});
   // Fit twice: the first press can land while the editor camera still settles.
   await key(p,'Home');await p.waitForTimeout(1500);await key(p,'Home');await p.waitForTimeout(2500);
   await p.screenshot({path:path.join(out,name+'-'+station+'-edit.png')});
   await ctx.close();
  }
  server.close();
 }
 await b.close();
 const diff=execFileSync('python',['-c',`
import json,sys
from PIL import Image,ImageChops
out=sys.argv[1];r={}
for st in sys.argv[2:]:
    a=Image.open(f'{out}/main-{st}-edit.png').convert('RGB');b=Image.open(f'{out}/branch-{st}-edit.png').convert('RGB')
    d=ImageChops.difference(a,b);px=[v for v in d.get_flattened_data() if v!=(0,0,0)]
    r[st]={'differing_pixels':len(px),'max_channel_delta':max((max(v) for v in px),default=0),'bbox':d.getbbox()}
print(json.dumps(r))`,out,...STATIONS],{encoding:'utf8'});
 const result={schema:1,issue:392,bundles:shots,errors,diff:JSON.parse(diff)};
 fs.writeFileSync(path.join(out,'legacy-compare.json'),JSON.stringify(result,null,1)+'\n');
 console.log(JSON.stringify(result));
 process.exitCode=errors.length?1:0;
})();
