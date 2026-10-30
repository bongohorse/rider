// Actual selection, fields, one validated Undo transaction and durable coin source; no state injection.
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function(h){
 const {page,ed,doc,key,button,at,importText,settle,snapshot,unchanged,revision,edit,played,out,cases,measurements}=h;
 const items=[{id:'o1',type:'line',points:[[-5,0],[12,0],[24,6],[40,6]]},...[['o2',[4,5]],['o3',[8,5]],['o4',[18,12]],['o5',[48,5]]].map(([id,position])=>({id,type:'coin',pickup_id:'drop-'+id,position}))];
 const fixture={schema:2,units:'metres',id:'drop-coins',name:'Drop coins',spawn:[0,2],start_speed:0,run_in:0,run_out:0,bounds:[-15,60,-10,30],chains:[[[40,6],[24,6],[12,0],[-5,0]]],coins:{version:1,items:items.filter(o=>o.type==='coin').map(o=>({id:o.pickup_id,position:o.position}))},editor:{editor_version:9,compiler_version:9,revision:1,next_id:6,sampling:{tolerance:.005,max_segment:.5},objects:items,connections:[],start:{position:[0,2],speed:0},finish:{position:[35,6],direction:1}}};
 await importText(JSON.stringify(fixture),'drop-coins.json');await key('Home');await key('s');await settle();
 await at([4,5]);for(const p of [[8,5],[18,12],[48,5],[30,6]])await at(p,['Shift']);
 assert.deepEqual([...(await ed()).selected].sort(),['o1','o2','o3','o4','o5']);
 let e=await ed();await button('object_lock_o3');await revision(e.revision+1);await settle();
 const ids=[...(await ed()).selected].sort(),original=(await doc()).objects,baseline=await snapshot();
 async function height(text,finish='Enter'){await button('track_height');await key('Backspace');if(text)await page.keyboard.type(text,{delay:10});await key(finish);return ed();}
 assert.equal((await ed()).track_height,.7);await height('1.2');assert.equal((await ed()).track_height,1.2);await unchanged(baseline,'prepare Height');
 for(const bad of ['-1','101','bad']){e=await height(bad);assert.notEqual(e.field,false);assert.ok(e.ui.field_error);assert.equal(e.track_height,1.2);await key('Escape');}
 await height('3','Escape');assert.equal((await ed()).track_height,1.2);await unchanged(baseline,'invalid/cancelled Height');
 // Clicking Drop with a pending valid Height confirms it and projects in one geometry transaction.
 await button('track_height');await key('Backspace');await page.keyboard.type('0.7');const before=await ed();await button('drop_to_track');await revision(before.revision+1);e=await settle();
 assert.equal(e.undo,before.undo+1);assert.deepEqual([...e.selected].sort(),ids);assert.equal(e.field,false);
 const result=(await doc()).objects;assert.deepEqual(result[0],original[0]);assert.deepEqual(result[2],original[2]);assert.deepEqual(result[4],original[4]);
 for(const [id,y] of [['o2',.7],['o4',3.7]]){const a=original.find(o=>o.id===id),b=result.find(o=>o.id===id);assert.equal(b.position[0],a.position[0]);assert.ok(Math.abs(b.position[1]-y)<1e-9);assert.equal(b.pickup_id,a.pickup_id);}
 assert.match(e.message,/2 moved/);assert.match(e.message,/1 locked/);assert.match(e.message,/1 unsupported/);assert.match(e.message,/1 without a surface/);
 const applied=await snapshot();await button('drop_to_track');await unchanged(applied,'repeat no-op Drop');assert.match((await ed()).message,/0 moved, 2 already aligned/);
 await key('z',['Control']);await revision(before.revision+2);assert.deepEqual((await doc()).objects,original);await key('y',['Control']);await revision(before.revision+3);assert.deepEqual((await doc()).objects,result);
 await key('Escape');await at([48,5]);const miss=await snapshot();await button('drop_to_track');await unchanged(miss,'no-hit-only Drop');assert.match((await ed()).message,/1 without a surface/);
 await button('object_select_o3');const locked=await snapshot();await button('drop_to_track');await unchanged(locked,'locked-only Drop');assert.match((await ed()).message,/1 locked/);
 await key('Escape');await at([30,6]);assert.ok(!(await ed()).visible.includes('drop_to_track'),'terrain alone offers pickup projection');
 await key('Escape');await at([4,.7]);await button('track_height');await page.screenshot({path:path.join(out,'drop-track-properties.png')});await key('Escape');
 await button('export');await page.waitForSelector('#rider-export-text');const saved=JSON.parse(await page.locator('#rider-export-text').inputValue());assert.equal(saved.schema,2);assert.equal(saved.editor.editor_version,10);assert.deepEqual(saved.editor.objects,result);assert.deepEqual(saved.coins.items,result.filter(o=>o.type==='coin').map(o=>({id:o.pickup_id,position:o.position})));
 await page.getByRole('button',{name:'Close export',exact:true}).click();await page.locator('canvas').focus();await page.waitForTimeout(1100);await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&window.riderCustom.syncState()==='saved');
 const reload=new URL(page.url());reload.search='?station=custom';await page.goto(reload.href);await edit();assert.deepEqual((await doc()).objects,result);
 await key('e');await played('drop-coins');assert.equal(await page.evaluate(()=>window.riderCoins.practice),true);await key('e');await edit();assert.deepEqual((await doc()).objects,result);
 measurements.drop_to_track={moved:2,locked:1,unsupported:1,no_surface:1,one_undo:true,selection_retained:true,stable_ids:true,save_reload:true};cases.push('drop_to_track_selection_height_skips_single_undo_and_reload');
};
