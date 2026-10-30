// Ordinary coin authoring through existing real UI, with source/compiled identity and durable reload.
const assert=require('node:assert/strict'),path=require('node:path'),pointer=require('../gym/pointer.cjs');
module.exports=async function(h){
 const {page,ed,doc,key,button,at,hover,importText,settle,revision,edit,canvas,out,cases,measurements}=h;
 const fixture={schema:1,units:'metres',id:'coin-editor',name:'Coin editor',spawn:[2,2],start_speed:0,run_in:0,run_out:0,bounds:[-12,52,-10,20],chains:[[[40,0],[-5,0]]],
 editor:{editor_version:9,compiler_version:9,revision:1,next_id:2,sampling:{tolerance:.005,max_segment:.5},objects:[{id:'o1',type:'line',points:[[-5,0],[40,0]]}],connections:[],start:{position:[2,2],speed:0},finish:{position:[35,0],direction:1}}};
 await importText(JSON.stringify(fixture),'coin-editor.json');await key('Home');await settle();
 const rev=(await ed()).revision;await button('tool_coin');await at([6,1]);await revision(rev+1);
 const coins=d=>d.objects.filter(o=>o.type==='coin');let first=coins(await doc())[0];assert(first?.pickup_id);const original=first.pickup_id;
 await key('s');const e=await ed();async function world(p){return canvas(e.screen.ox+p[0]*e.screen.ppm_x,e.screen.oy+p[1]*e.screen.ppm_y);}
 const a=await world(first.position),b=await world([10,2]);await page.mouse.move(a.x,a.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);await page.mouse.move(b.x,b.y,{steps:8});await pointer.frames(page);await page.mouse.up();await revision(rev+2);
 first=coins(await doc())[0];assert.deepEqual(first.position,[10,2]);assert.equal(first.pickup_id,original);
 await key('c',['Control']);await hover([14,2]);await key('v',['Control']);await revision(rev+3);let all=coins(await doc());assert.equal(all.length,2);assert.notEqual(all[1].pickup_id,original);const copyId=all[1].pickup_id;
 await key('Delete');await revision(rev+4);assert.equal(coins(await doc()).length,1);
 await key('z',['Control']);await revision(rev+5);assert.equal(coins(await doc())[1].pickup_id,copyId);
 await key('y',['Control']);await revision(rev+6);assert.equal(coins(await doc()).length,1);
 await key('z',['Control']);await revision(rev+7);all=coins(await doc());
 await button('export');await page.waitForSelector('#rider-export-text');const saved=JSON.parse(await page.locator('#rider-export-text').inputValue());assert.equal(saved.schema,2);assert.equal(saved.editor.editor_version,11);assert.deepEqual(saved.coins.items,all.map(o=>({id:o.pickup_id,position:o.position})));
 await page.getByRole('button',{name:'Close export',exact:true}).click();await page.locator('canvas').focus();await page.waitForTimeout(1100);
 await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty&&window.riderCustom.syncState()==='saved');
 const reload=new URL(page.url());reload.search='?station=custom';await page.goto(reload.href);await edit();assert.deepEqual(coins(await doc()),all);
 await importText(JSON.stringify(saved),'coin-roundtrip.json');await key('Escape');await settle();assert.deepEqual(coins(await doc()),all);assert.equal((await ed()).conflict,false);
 await page.screenshot({path:path.join(out,'coin-editor.png')});measurements.ordinary_coins={ids:all.map(o=>o.pickup_id),schema:saved.schema,source_version:saved.editor.editor_version,gui_nodes:(await ed()).overlay.nodes,placement_move_copy_delete_undo_redo_reload:true};cases.push('g4_coin_authoring_stable_ids_undo_and_reload');
};
