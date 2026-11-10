// #672 coin paths through real pointer/keyboard input: draw start -> end, bend into an arc, spacing, Undo,
// export as ordinary coins, Delete.
const assert=require('node:assert/strict'),path=require('node:path'),pointer=require('../gym/pointer.cjs');
module.exports=async function(h){
 const {page,ed,doc,key,button,at,hover,importText,settle,revision,canvas,out,cases,measurements}=h;
 const fixture={schema:1,units:'metres',id:'coin-path-editor',name:'Coin path editor',spawn:[2,2],start_speed:0,run_in:0,run_out:0,bounds:[-12,52,-10,20],chains:[[[40,0],[-5,0]]],
 editor:{editor_version:13,compiler_version:13,revision:1,next_id:2,sampling:{tolerance:.005,max_segment:.5},objects:[{id:'o1',type:'line',points:[[-5,0],[40,0]]}],connections:[],start:{position:[2,2],speed:0},finish:{position:[35,0],direction:1}}};
 await importText(JSON.stringify(fixture),'coin-path-editor.json');await key('Home');await settle();
 const members=d=>d.objects.filter(o=>o.type==='coin'&&o.path);
 const rev=(await ed()).revision;await button('tool_coin_path');
 await at([4,1]);await hover([10,1]);await hover([16,1]);await at([16,1]);await revision(rev+1);let d=await doc();
 assert.equal(d.editor_version,17);const p=d.coin_paths.items[0];assert.equal(p.points.length,3);assert.equal(p.spacing,1.5);
 const straight=members(d);assert.equal(straight.length,9);assert.ok(straight.every(o=>Math.abs(o.position[1]-1)<1e-9));
 const e=await ed();const world=q=>canvas(e.screen.ox+q[0]*e.screen.ppm_x,e.screen.oy+q[1]*e.screen.ppm_y);
 const a=await world([10,1]),b=await world([10,5]);await page.mouse.move(a.x,a.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);await page.mouse.move(b.x,b.y,{steps:8});await pointer.frames(page);await page.mouse.up();
 await revision(rev+2);d=await doc();const arc=members(d);assert.deepEqual(d.coin_paths.items[0].points[1],[10,5]);
 assert.ok(Math.max(...arc.map(o=>o.position[1]))>4.9,'arc reaches the bent point');assert.ok(arc.length>straight.length,'longer arc lays more coins');
 await page.keyboard.type('+');await revision(rev+3);d=await doc();assert.equal(d.coin_paths.items[0].spacing,1.75);const wide=members(d).length;assert.ok(wide<arc.length);
 await key('z',['Control']);await revision(rev+4);d=await doc();assert.equal(d.coin_paths.items[0].spacing,1.5);assert.equal(members(d).length,arc.length);
 await button('export');await page.waitForSelector('#rider-export-text');const saved=JSON.parse(await page.locator('#rider-export-text').inputValue());
 assert.equal(saved.editor.editor_version,17);assert.equal(saved.coins.items.length,arc.length);assert.ok(saved.coins.items.every(c=>c.path===undefined&&c.kind===undefined));
 await page.getByRole('button',{name:'Close export',exact:true}).click();await page.locator('canvas').focus();await pointer.frames(page);
 await page.screenshot({path:path.join(out,'coin-path-editor.png')});
 await at([4,1]);await key('Delete');await revision(rev+5);d=await doc();assert.equal(d.coin_paths,undefined);assert.equal(d.editor_version,13);assert.equal(members(d).length,0);
 measurements.coin_paths={straight:straight.length,arc:arc.length,wide,exported:saved.coins.items.length,source_version:saved.editor.editor_version};
 cases.push('g672_coin_path_draw_bend_spacing_undo_export_delete');
};
