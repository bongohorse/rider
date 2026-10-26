// Extend the existing editor runner with actual numeric input, Undo and exported round-trip checks.
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function(h){
 const {page,ed,doc,key,button,settle,revision,importText,out,cases,measurements}=h;
 await key('Escape');await button('collapse_medals');let e=await settle();const rev=e.revision,undo=e.undo;
 assert.equal((await doc()).medal_times,undefined);
 await button('medal_gold');await page.keyboard.type('24.5',{delay:20});await key('Tab');
 e=await revision(rev+1);assert.equal(e.undo,undo+1);assert.equal(e.field,'30');assert.deepEqual((await doc()).medal_times,{version:1,gold:24.5,silver:30,bronze:40});
 await page.keyboard.type('32',{delay:20});await key('Tab');await revision(rev+2);assert.equal((await ed()).field,'40');
 await page.keyboard.type('45',{delay:20});await key('Enter');await revision(rev+3);
 await button('medal_gold');await page.keyboard.type('32',{delay:20});await key('Enter');e=await settle();assert.equal(e.revision,rev+3);assert.match(e.ui.field_error,/Gold < Silver < Bronze/);assert.equal((await doc()).medal_times.gold,24.5);await key('Escape');
 await button('inc_medal_bronze');await revision(rev+4);assert.equal((await doc()).medal_times.bronze,45.5);
 await key('z',['Control']);await revision(rev+5);assert.equal((await doc()).medal_times.bronze,45);
 await key('y',['Control']);await revision(rev+6);assert.equal((await doc()).medal_times.bronze,45.5);
 await button('clear_medals');await revision(rev+7);assert.equal((await doc()).medal_times,undefined);
 await key('z',['Control']);await revision(rev+8);assert.equal((await doc()).medal_times.bronze,45.5);
 const source=await doc();assert.equal(source.editor_version,8);
 await button('export');await page.waitForSelector('#rider-export-text');const exported=JSON.parse(await page.locator('#rider-export-text').inputValue());
 assert.deepEqual(exported.medal_times,source.medal_times);assert.deepEqual(exported.editor.medal_times,source.medal_times);
 await page.getByRole('button',{name:'Close export',exact:true}).click();await page.locator('canvas').focus();await page.waitForTimeout(1100);
 await importText(JSON.stringify(exported),'medal-roundtrip.json');await key('Escape');await settle();
 assert.deepEqual((await doc()).medal_times,source.medal_times);assert.equal((await ed()).conflict,false);
 await page.screenshot({path:path.join(out,'medal-editor.png')});
 measurements.medal_targets={times:source.medal_times,source_version:source.editor_version,gui_nodes:(await ed()).overlay.nodes,invalid_preserved:true,undo_redo_remove:true,export_import:true};cases.push('g3_medal_fields_validation_undo_and_roundtrip');
};
