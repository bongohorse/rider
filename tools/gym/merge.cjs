// Merge CI part results of long Gym protocols into a complete, validated report.
// CLI: node tools/gym/merge.cjs <case> <output-dir> <part-dir>...
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const LE6_EXPECTED=[
 [
  "problems_jump_to_source_after_edit_and_undo",
  "fit_centre_start_last_test_view_only",
  "bounds_display_matches_compile",
  "template_pages_view_row_budget",
  "unlocated_message_shown_only",
  "labels_place_edit_move_copy_undo_persist",
  "help_modal_lists_controls",
  "ghost_matches_test_start",
  "readouts_start_drag_units",
  "coin_editor_categories_independent_and_centered_commands",
  "a1b_feedback_errors_and_scroll",
  "a1b_layout_viewports_and_collapse",
  "a1b_numeric_focus_steps_and_connected_run",
  "a1b_scrolling_and_modal_capture",
  "a1b_maximum_level_and_switch_budgets",
  "g3_medal_fields_validation_undo_and_roundtrip"
 ],
 [
  "editor_zoom_entry_steps_anchor_limits_and_source_invariance",
  "g4_coin_authoring_stable_ids_undo_and_reload",
  "drop_to_track_selection_height_skips_single_undo_and_reload",
  "along_track_shared_arc_height_mixed_invalidation_and_reload",
  "auto_coins_deterministic_preview_replace_exact_apply_undo_and_reload",
  "g5_multiple_gems_gold_counts_copy_undo_and_durable_roundtrip",
  "g6_configurable_fuel_canister_empty_full_retry_and_durable_source"
 ]
];
function mergeLe6(reports){
 assert.equal(reports.length,2,'Both LE6 parts required');
 const first=reports[0],measurements={},runIds=new Set();
 assert.match(first.source_sha,/^[0-9a-f]{40}$/,'source SHA must be complete');
 assert.ok(typeof first.browser==='string'&&first.browser.length,'browser identity required');
 for(let i=0;i<reports.length;i++){
  const r=reports[i];
  assert.equal(r.status,'PASS','A failed part cannot merge');
  assert.equal(r.part,(i+1)+'/2','Unexpected LE6 part/order');
  assert.equal(r.source_sha,first.source_sha,'Mixed source versions');
  assert.equal(r.browser,first.browser,'Mixed browser versions');
  assert.ok(typeof r.run_id==='string'&&r.run_id.length,'Missing run identity');
  assert.ok(!runIds.has(r.run_id),'Reused run identity');
  runIds.add(r.run_id);
  assert.deepEqual(r.cases,LE6_EXPECTED[i],'LE6 case inventory differs from frozen complete coverage');
  assert.ok(r.measurements&&typeof r.measurements==='object'&&!Array.isArray(r.measurements),'Missing measurements');
  for(const [k,v] of Object.entries(r.measurements)){
   assert.ok(!Object.hasOwn(measurements,k),'Duplicate LE6 measurement '+k);
   measurements[k]=v;
  }
 }
 return {status:'PASS',source_sha:first.source_sha,parts:['1/2','2/2'],run_ids:[...runIds],
         browser:first.browser,cases:[...LE6_EXPECTED[0],...LE6_EXPECTED[1]],measurements};
}

const RUNS={
 a18:{file:'seams-result.json',merge:require('./seam_report.cjs').merge},
 le1b:{file:'sizes-result.json',merge:require('./sizes_report.cjs').merge,report:require('./sizes_report.cjs').markdown,reportFile:'sizes-report.md'},
 a19b:{file:'bumps-result.json',merge:require('./bump_report.cjs').merge},
 le6:{file:'polish-result.json',merge:mergeLe6},
};
function main([testcase,out,...dirs]){
 const run=RUNS[testcase];if(!run||!out||!dirs.length)throw Error('Usage: merge.cjs <a18|le1b|a19b|le6> <output-dir> <part-dir>...');
 const merged=run.merge(dirs.map(dir=>JSON.parse(fs.readFileSync(path.join(dir,run.file),'utf8'))));
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,run.file),JSON.stringify(merged,null,testcase==='le1b'?1:2));
 if(run.report)fs.writeFileSync(path.join(out,run.reportFile),run.report(merged));
 console.log(JSON.stringify({status:merged.status,case:testcase,parts:merged.parts}));
}
if(require.main===module)main(process.argv.slice(2));
module.exports={mergeLe6,LE6_EXPECTED};
