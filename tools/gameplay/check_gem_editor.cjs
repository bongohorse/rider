// Real editor input; multiple special pickups use the same source IDs/history/save boundary.
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function(h){
 const {page,ed,doc,key,button,at,hover,importText,settle,revision,edit,out,cases,measurements}=h;
 const fixture={schema:1,units:'metres',id:'gem-editor',name:'Wonder Gems',spawn:[0,2],start_speed:0,run_in:0,run_out:0,bounds:[-12,52,-10,20],chains:[[[40,0],[-5,0]]],editor:{editor_version:9,compiler_version:9,revision:1,next_id:2,sampling:{tolerance:.005,max_segment:.5},objects:[{id:'o1',type:'line',points:[[-5,0],[40,0]]}],connections:[],start:{position:[0,2],speed:0},finish:{position:[35,0],direction:1}}};
 await importText(JSON.stringify(fixture),'gem-editor.json');await key('Home');await settle();
 const pickups=d=>d.objects.filter(o=>o.type==='coin');let rev=(await ed()).revision;
 await button('tool_coin');await at([4,1]);await revision(++rev);
 await button('tool_gem');await at([10,1]);await revision(++rev);await at([18,2]);await revision(++rev);
 let all=pickups(await doc());assert.equal(all.length,3);assert.equal((await ed()).gold_count,1);assert.equal((await ed()).gem_count,2);assert.equal(all.filter(o=>o.kind==='gem').length,2);assert.equal(new Set(all.map(o=>o.pickup_id)).size,3);
 await key('s');await at([10,1]);await key('c',['Control']);await hover([24,2]);await key('v',['Control']);await revision(++rev);all=pickups(await doc());assert.equal(all.filter(o=>o.kind==='gem').length,3);assert.equal(new Set(all.map(o=>o.pickup_id)).size,4);assert.equal((await ed()).gem_count,3);
 await key('Delete');await revision(++rev);assert.equal(pickups(await doc()).length,3);await key('z',['Control']);await revision(++rev);assert.deepEqual(pickups(await doc()),all);
 await button('export');await page.waitForSelector('#rider-export-text');const saved=JSON.parse(await page.locator('#rider-export-text').inputValue());assert.equal(saved.schema,3);assert.equal(saved.coins.version,2);assert.equal(saved.editor.editor_version,10);assert.deepEqual(saved.coins.items,all.map(o=>({id:o.pickup_id,position:o.position,...o.kind&&{kind:o.kind}})));
 await page.getByRole('button',{name:'Close export',exact:true}).click();await page.locator('canvas').focus();await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty&&window.riderCustom.syncState()==='saved');
 await page.screenshot({path:path.join(out,'wonder-gems-editor.png')});await page.setViewportSize({width:1280,height:480});await settle();assert.deepEqual(pickups(await doc()),all);assert.equal((await ed()).gem_count,3);assert.ok((await ed()).ui.boxes<=128);assert.equal((await ed()).overlay.nodes,628);await page.screenshot({path:path.join(out,'wonder-gems-editor-short.png')});await page.setViewportSize({width:1280,height:720});await settle();const reload=new URL(page.url());reload.search='?station=custom';await page.goto(reload.href);await edit();assert.deepEqual(pickups(await doc()),all);
 await importText(JSON.stringify(saved),'gem-roundtrip.json');await key('Escape');await settle();assert.deepEqual(pickups(await doc()),all);assert.equal((await ed()).conflict,false);
 measurements.wonder_gems={gold:1,gems:3,unique_ids:4,source_version:10,compiled_schema:3,one_step_delete_undo:true,reload:true};cases.push('g5_multiple_gems_gold_counts_copy_undo_and_durable_roundtrip');
};
