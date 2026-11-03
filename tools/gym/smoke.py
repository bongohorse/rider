"""Small HTML5 gym runtime smoke, independent of the retained G1 fixture."""
import argparse
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/g1'))
from bundle import build_bundle, verify_bundle
from run import stop

# Authoritative LE6 case inventory: no skipped, duplicated or silently dropped UI checks.
LE6_EXPECTED={
    '1/2': [
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
    '2/2': [
        "editor_zoom_entry_steps_anchor_limits_and_source_invariance",
        "g4_coin_authoring_stable_ids_undo_and_reload",
        "drop_to_track_selection_height_skips_single_undo_and_reload",
        "along_track_shared_arc_height_mixed_invalidation_and_reload",
        "auto_coins_deterministic_preview_replace_exact_apply_undo_and_reload",
        "g5_multiple_gems_gold_counts_copy_undo_and_durable_roundtrip",
        "g6_configurable_fuel_canister_empty_full_retry_and_durable_source"
    ],
}
parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True)
parser.add_argument('--case',default='a1')
parser.add_argument('--bundle', help='Reuse a verified shared debug Gym build')
# CI runs long protocols in independent parts on separate runners, then merges validated reports.
PARTS={'a18':['1/2','2/2'],'le1b':['1/2','2/2'],'a19b':['1/2','2/2'],'le6':['1/2','2/2']}
parser.add_argument('--part', help='Run one CI part (1/2 or 2/2) of a18, le1b, a19b or le6')
parser.add_argument('--merge', nargs='+', metavar='PART_OUTPUT', help='Merge every part output of a18, le1b, a19b or le6')
# Car Feel 2 (#200): a measurement station run with another preset; its runner asserts the preset per trial.
# Without --preset the case is unchanged (preset A, no URL parameter). One entry per station: case -> result file.
PRESET_CASES={'a16':'ramps-result.json','a17':'steps-result.json','a18':'seams-result.json','a19':'gaps-result.json','a19c':'air-result.json','a19b':'bumps-result.json','a19d':'balance-result.json',
    # #114 stage 1 wheel-size A/B (opt-in, report only, not in CI): needs --preset (a, w26 or w30).
    'w114':'wheel114-result.json'}
parser.add_argument('--preset', help='Run a station case ('+', '.join(PRESET_CASES)+') with this preset key, e.g. b')
# A22 (#37): deliberate regeneration of the regression traces (tests/regress/); never used by CI.
parser.add_argument('--record', action='store_true', help='a22 only: re-record every regression trace, then check them')
args=parser.parse_args()
if args.record and args.case!='a22': parser.error('--record applies only to a22')
if (args.part is not None or args.merge) and args.case not in PARTS: parser.error('--part and --merge apply only to '+', '.join(PARTS))
if args.part and args.merge: parser.error('--part and --merge are exclusive')
if args.part is not None and args.part not in PARTS.get(args.case,[]): parser.error('unknown part '+repr(args.part))
if args.merge and args.bundle: parser.error('--merge reads part reports and takes no --bundle')
if args.preset is not None and (args.case not in PRESET_CASES or args.part is not None or args.merge): parser.error('--preset applies only to full runs of '+', '.join(PRESET_CASES))
out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
run_id=str(uuid.uuid4())
def identity(report):
    assert report['status']=='PASS' and report['source_sha']==sha
    if args.merge: assert report['parts']==PARTS[args.case] and len(set(report['run_ids']))==len(PARTS[args.case])
    else: assert report['run_id']==run_id and report.get('part')==args.part
if args.merge:
    subprocess.run(['node',str(ROOT/'tools/gym/merge.cjs'),args.case,str(out),*[str(Path(d).resolve()) for d in args.merge]],cwd=ROOT,check=True,timeout=60)
    code=0
else:
    bundle=Path(args.bundle).resolve() if args.bundle else out/'bundle'
    if not args.bundle:build_bundle(bundle,sha)
    verify_bundle(bundle,sha)
    runner='wheel114.cjs' if args.case=='w114' else 'fps417.cjs' if args.case=='fps417' else 'fps444.cjs' if args.case=='fps444' else 'camera443.cjs' if args.case=='cam443' else 'interp479.cjs' if args.case=='interp479' else 'coast_measure.cjs' if args.case=='coast345' else 'versions.cjs' if args.case=='ea3' else 'objects.cjs' if args.case=='ea2' else 'regress.cjs' if args.case=='a22' else 'replay.cjs' if args.case=='a21' else 'pause.cjs' if args.case=='a20' else 'struts.cjs' if args.case=='cf3' else 'editor.cjs' if args.case=='le2' else 'draw.cjs' if args.case=='le3' else 'library.cjs' if args.case=='le4' else 'prefab.cjs' if args.case=='le5a' else 'curve.cjs' if args.case=='le5b' else 'path.cjs' if args.case=='le5c' else 'points.cjs' if args.case=='le5d' else 'polish.cjs' if args.case=='le6' else 'sizes.cjs' if args.case=='le1b' else 'custom.cjs' if args.case=='le1a' else 'gaps.cjs' if args.case=='a19' else 'air.cjs' if args.case=='a19c' else 'bumps.cjs' if args.case=='a19b' else 'balance.cjs' if args.case=='a19d' else 'seams.cjs' if args.case=='a18' else 'steps.cjs' if args.case=='a17' else 'ramps.cjs' if args.case=='a16' else 'stations.cjs' if args.case=='a15' else 'browser.cjs'
    # The runner selects its part only from GYM_PART; a stray value must not shrink a full run.
    env={k:v for k,v in os.environ.items() if k!='GYM_PART'}|({'GYM_PART':args.part} if args.part else {})
    process=subprocess.Popen(['node',str(ROOT/'tools/gym'/runner),str(out),sha,run_id,args.case,str(bundle),*(['--preset',args.preset] if args.preset is not None else []),*(['--record'] if args.record else [])],cwd=ROOT,start_new_session=True,env=env)
    try: code=process.wait(timeout=600 if args.case in ('a18','le1b','a19b','ea2','ea3','w114') else 360 if args.case in ('fps417','fps444','cam443','interp479','a16','a17','a19','a19c','a19d','a20','a21','a22','le1a','le2','le3','le4','le5a','le5b','le5c','le5d','le6','ea3','cf3') else 90)
    finally: stop(process)
if code:raise SystemExit(code)
if args.preset is not None:
    report=json.loads((out/PRESET_CASES[args.case]).read_text())
    assert report['preset']==args.preset and report['preset_checks']>0, 'preset run without per-trial preset checks'
if args.case=='le1b':
    report=json.loads((out/'sizes-result.json').read_text())
    # Part 1 measures the first 9 of the 17 accepted levels; part 2 the other 8 plus all 13 rejected limit cases.
    accepted,rejected={'1/2':(9,0),'2/2':(8,13)}.get(args.part,(17,13))
    identity(report);assert len(report['results'])==accepted+rejected
    # Starts beyond ±500 m are rejected (LE2); every accepted level, including the 500 m start, must become drive-ready.
    assert sum(r.get('outcome')=='drive_ready' for r in report['results'])==accepted
    assert all(r.get('outcome')=='drive_ready' for r in report['results'] if r.get('expect')!='rejected')
    assert sum(r.get('expect')=='rejected' for r in report['results'])==rejected
    print(json.dumps({'status':report['status'],'elapsed_s':report['elapsed_s'],'switch_ms':{r['id']:r['switch']['median_ms'] for r in report['results'] if 'switch' in r}}));raise SystemExit(0)
if args.case=='w114':
    report=json.loads((out/'wheel114-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['sections'])==9
    print(json.dumps({s['id']:s['outcomes'] for s in report['sections']}));raise SystemExit(0)
if args.case=='a20':
    report=json.loads((out/'pause-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['cases'])==12
    print(json.dumps(report['cases']));raise SystemExit(0)
if args.case=='fps417':
    report=json.loads((out/'fps417-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id
    assert set(report['cases'])=={'default_cap_60','counter_reports_measured','physics_fixed_60_all_caps','persisted_reload',
        'replay_match_across_caps','cap_label_after_tap','tap_no_drive_mouse','tap_no_drive_touch'}
    # Every cap measured (0 = Unlimited) and the default measured again after the 30 -> 60 wrap.
    assert set(report['cases']['counter_reports_measured'])=={'30','60','90','120','144','0','60_after_wrap'}
    assert report['cases']['replay_match_across_caps']['verdict']=='MATCH' and report['cases']['persisted_reload']['cap']==30
    print(json.dumps({k:report['cases'][k] for k in ('counter_reports_measured','physics_fixed_60_all_caps')}));raise SystemExit(0)
if args.case=='fps444':
    report=json.loads((out/'fps444-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id
    assert set(report['cases'])=={'default_top_left','mouse_drag','threshold','drag_to_corner','drag_onto_pause','mouse_no_drive',
        'mouse_drag_reload','menu_on_off_reload','presets_desktop','preset_reload','reset_top_left','resolution_change',
        'touch_drag','touch_drag_onto_drive_zone','touch_no_drive','touch_drag_reload','rotation','presets_phone',
        'drop_on_levels_keeps_keys','drag_with_throttle_held','dense_dpr'}
    assert report['cases']['dense_dpr']['pixel_ratio']>2.5
    # All nine presets at 1280x720 and at 1080x486 (phone, touch controls).
    names={'top_left','top','top_right','left','center','right','bottom_left','bottom','bottom_right'}
    assert set(report['cases']['presets_desktop'])==names and set(report['cases']['presets_phone'])==names
    print(json.dumps({k:report['cases'][k] for k in ('mouse_no_drive','touch_no_drive','resolution_change')}));raise SystemExit(0)
if args.case=='cam443':
    report=json.loads((out/'cam443-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id
    assert set(report['cases'])=={'ramps-down-30','air-mid','straight-reverse','persist_reload','reset_defaults',
        'desktop_placement','mouse_no_drive','phone','hud_nodes','camera352_forced'}
    # Exact physics identity and a MATCH replay in all three driving scenarios.
    for name in ('ramps-down-30','air-mid','straight-reverse'):
        c=report['cases'][name]
        assert c['physics']['max_difference']==0 and c['physics']['ticks']>=300 and c['replay']['verdict']=='MATCH'
    print(json.dumps({k:{'physics':report['cases'][k]['physics']['modes'],'replay':report['cases'][k]['replay']['verdict']} for k in ('ramps-down-30','air-mid','straight-reverse')}));raise SystemExit(0)
if args.case=='interp479':
    report=json.loads((out/'interp479-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id
    c=report['cases']
    assert set(c)=={'physics_trace_vs_cap60','record_vs_replay_60','replays','on_off_cap144','refresh','windows'}
    # Every cap replayed (0 = Unlimited) with an exactly identical fixed-tick trace and a MATCH replay.
    assert set(c['physics_trace_vs_cap60'])=={'replay-60','replay-90','replay-120','replay-144','replay-unlimited','replay-30'}
    assert all(t['max_difference']==0 for t in c['physics_trace_vs_cap60'].values()) and all(r['verdict']=='MATCH' for r in c['replays'].values())
    # Cap 60 presents the physics transform exactly; on the emulated 144 Hz display every cap above 60 is smoother.
    assert c['windows']['replay-60']['verdict']=='IDENTICAL' and c['refresh']['refresh144-cap-60']['verdict']=='IDENTICAL'
    assert all(c['refresh']['refresh144-cap-'+k]['verdict']=='SMOOTHER' for k in ('90','120','144','unlimited'))
    assert all(w['physics_max_difference']==0 for w in c['refresh'].values())
    print(json.dumps({k:{'raw':w['raw_step_variance_u2'],'presented':w['presented_step_variance_u2'],'verdict':w['verdict']} for k,w in c['refresh'].items()}));raise SystemExit(0)
if args.case=='cf3':
    report=json.loads((out/'struts-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and set(report['cases'])=={'rest','landing','off','toggle'}
    assert report['cases']['off']['report_identical'] is True and report['cases']['off']['created']==0
    print(json.dumps(report['cases']));raise SystemExit(0)
if args.case=='a21':
    report=json.loads((out/'replay-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['cases'])==19
    print(json.dumps(report['measurements']));raise SystemExit(0)
if args.case=='a22':
    report=json.loads((out/'regress-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and report['mode']==('record' if args.record else 'check')
    assert len(report['cases'])==(8 if args.record else 7)
    print(json.dumps({k:report[k] for k in ('status','cases','limits')}));raise SystemExit(0)
if args.case=='coast345':
    report=json.loads((out/'coast-measure-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and report['completed']==3
    print(json.dumps({k:report[k] for k in ('status','source_sha','repeat_delta_m','repeat_delta_s')}));raise SystemExit(0)
if args.case=='le2':
    report=json.loads((out/'editor-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['cases'])==19
    print(json.dumps(report));raise SystemExit(0)
if args.case=='le3':
    report=json.loads((out/'draw-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['cases'])==15
    print(json.dumps(report));raise SystemExit(0)
if args.case=='le4':
    report=json.loads((out/'library-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['cases'])==12
    print(json.dumps(report));raise SystemExit(0)
if args.case=='le5a':
    report=json.loads((out/'prefab-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['cases'])==12
    print(json.dumps(report));raise SystemExit(0)
if args.case=='le5b':
    report=json.loads((out/'curve-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['cases'])==11
    print(json.dumps(report));raise SystemExit(0)
if args.case=='le5c':
    report=json.loads((out/'path-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['cases'])==4
    print(json.dumps(report));raise SystemExit(0)
if args.case=='le5d':
    report=json.loads((out/'points-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['cases'])==5
    print(json.dumps(report));raise SystemExit(0)
if args.case=='ea3':
    report=json.loads((out/'versions-result.json').read_text())
    identity(report)
    expected='named_reload_restore_undo automatic_timing_switch incomplete_and_unknown_versions write_and_sync_failure limits_pruning_total_cap delete_level_versions viewports'.split()
    assert sorted(report['cases'])==sorted(expected), 'ea3 inventory missing or duplicated'
    print(json.dumps(report));raise SystemExit(0)
if args.case=='ea2':
    report=json.loads((out/'objects-result.json').read_text())
    identity(report)
    expected='list_selection_search_naming hide_undo_export_geometry lock_direct_and_connected_changes copy_mirror_new_ids_unlocked_visible save_reload_import_drive_roundtrip bounded_list_and_viewports invalid_metadata_preserved_or_refused sparse_mechanism_lists_refused mechanism_blank_course_places_one_undo_each mechanism_properties_bounded_and_fail_closed mechanism_two_plates_three_gates_five_links mechanism_locks_and_hide mechanism_copy_remaps_and_keeps_external mechanism_save_reload_export_import_play_retry mechanism_pools_and_viewports'.split()
    assert sorted(report['cases'])==sorted(expected), 'ea2 inventory missing or duplicated'
    print(json.dumps(report));raise SystemExit(0)
if args.case=='le6':
    report=json.loads((out/'polish-result.json').read_text())
    identity(report)
    expected=(LE6_EXPECTED['1/2']+LE6_EXPECTED['2/2']) if (args.merge or args.part is None) else LE6_EXPECTED[args.part]
    assert len(report['cases'])==len(expected) and set(report['cases'])==set(expected), 'LE6 inventory missing, duplicated or unexpected'
    assert report['status']=='PASS'
    print(json.dumps(report));raise SystemExit(0)
if args.case=='le1a':
    report=json.loads((out/'custom-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['cases'])==22
    print(json.dumps(report));raise SystemExit(0)
if args.case=='a19':
    report=json.loads((out/'gaps-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['results'])==23
    print(json.dumps({k:report[k] for k in ('status','widest_cleared_m')}));raise SystemExit(0)
if args.case=='a19d':
    report=json.loads((out/'balance-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['skill'])==7 and len(report['cases'])==10
    assert all(r['status']=='COMPLETED' for r in report['skill'].values()) and any(r['status']=='MISSED' for r in report['full'].values())
    print(json.dumps({k:report[k] for k in ('status','cases')}));raise SystemExit(0)
if args.case=='a19b':
    report=json.loads((out/'bumps-result.json').read_text())
    # Part 1 checks geometry, URL/R, both ladders and the repeats; part 2 the lift-off sweep.
    identity(report);ladders,sweep=args.part!='2/2',args.part!='1/2'
    assert len(report['cases'])=={'1/2':4,'2/2':1}.get(args.part,5)
    assert (len(report['ladders'])==2 and all(len(r)==11 for r in report['ladders'].values()))==ladders and bool(report['ladders'])==ladders
    assert any(v['bracketed'] for v in report['liftoff'].values())==sweep
    print(json.dumps({k:report[k] for k in ('status','cases','liftoff')}));raise SystemExit(0)
if args.case=='a19c':
    report=json.loads((out/'air-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['results'])==12
    print(json.dumps({k:report[k] for k in ('status','full_lean_default')}));raise SystemExit(0)
if args.case=='a18':
    report=json.loads((out/'seams-result.json').read_text())
    # Part 1 holds the 5 and 7 m/s pairs and the unsupported speed; part 2 the 9 m/s pair and the powered controls.
    identity(report);assert len(report['results'])=={'1/2':4,'2/2':2}.get(args.part,6)
    assert len(report['poweredControls'])==(0 if args.part=='1/2' else 4) and (report['rejected'] is None)==(args.part=='2/2')
    print(json.dumps({'status':report['status'],'acceptance':report.get('acceptance'),'d8':report.get('d8'),'comparison':report['comparison']}));raise SystemExit(0)
if args.case=='a17':
    report=json.loads((out/'steps-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['results'])==16
    print(json.dumps(report));raise SystemExit(0)
if args.case=='a16':
    report=json.loads((out/'ramps-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['results'])==25
    print(json.dumps(report));raise SystemExit(0)
if args.case=='a15':
    report=json.loads((out/'stations-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['cases'])==8
    print(json.dumps(report));raise SystemExit(0)
report=json.loads((out/'gym-result.json').read_text())
assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id
cases=report['cases']
if args.case=='a1':
    assert set(cases)=={'chain_contact','camera_follow'}
    assert abs(cases['chain_contact']-95)<2 and cases['camera_follow'] is True
elif args.case in ('a2','a3','a6','a10'):
    expected={'drive_dx','drive_speed','stopped_speed','max_angle','wheel_contact','camera_follow','brake_priority'}
    if args.case=='a3':
        expected.update({'resets','asleep_before_redrive','reason_visible','bounds_recovery','input_cleared','redrive','no_collection_reload','reset_ms_min','reset_ms_p50','reset_ms_max','request_ready_ms_max'})
        assert cases['resets']==100 and all(cases[x] is True for x in ['asleep_before_redrive','reason_visible','bounds_recovery','input_cleared','redrive','no_collection_reload'])
        assert 0<=cases['reset_ms_min']<=cases['reset_ms_p50']<=cases['reset_ms_max']
        assert cases['request_ready_ms_max']>=cases['reset_ms_max']
    if args.case=='a6':
        expected.update({'reverse_speed','reverse_dx','air_angle','camera_direction_zoom','camera_follow_window'})
        assert cases['reverse_speed'] < -50 and cases['reverse_dx'] < -50 and cases['air_angle']>0.1 and cases['camera_direction_zoom'] is True and cases['camera_follow_window'] is True
    if args.case=='a10':
        expected.update({'audio_once','audio_pitch','no_autoplay','audio_context_running'})
        assert cases['audio_once'] and cases['no_autoplay'] and cases['audio_context_running'] and cases['audio_pitch']>0.85
    assert set(cases)==expected
    assert cases['drive_dx']>150 and cases['drive_speed']>100 and abs(cases['stopped_speed'])<12
    assert cases['max_angle']<0.6 and all(cases[x] is True for x in ['wheel_contact','camera_follow','brake_priority'])
elif args.case=='a7':
    assert set(cases)=={'head_detected','default_off','head_reset','sensor_retained','keyboard_toggle','overlay_toggle'}
    assert all(value is True for value in cases.values())
elif args.case=='a8':
    assert set(cases)=={'live_spring','no_restart','input_isolated','release_cleared','invalid_rejected'}
    assert all(value is True for value in cases.values())
elif args.case in ('a9','a9invalid'):
    # all_drivable (#199) replaces three_drivable: every preset in feel.order, plus a visible refused-file fallback.
    assert set(cases)=={'url_selected','invalid_fallback','all_drivable','full_replacement','no_reload','refused_visible'}
    assert all(cases[k] is True for k in ['url_selected','all_drivable','full_replacement','no_reload','refused_visible'])
    assert cases['invalid_fallback']==(args.case=='a9invalid')
elif args.case=='a11':
    assert set(cases)=={'report_requested','visible_failure','clipboard_roundtrip','denied_fallback'}
    assert all(value is True for value in cases.values())
elif args.case=='a12':
    assert set(cases)=={'bottoming_peak','spike_drawn','bounded','expired','limits_restored','no_reset','samples','oldest_age'}
    assert 16<=cases['bottoming_peak']<=20 and all(cases[k] is True for k in ['spike_drawn','bounded','expired','limits_restored','no_reset'])
    assert 299<=cases['samples']<=301 and 4.9<=cases['oldest_age']<=5.00001
elif args.case=='m2feedback':
    assert set(cases)=={'ground_left','ground_right','reset_neutral','no_reload','expanded_controls','ground_disabled','fast_speed_mps'}
    assert cases['fast_speed_mps']>8
    assert cases['ground_left']>0.03 and cases['ground_right'] < -0.03
    assert all(cases[k] is True for k in ['reset_neutral','no_reload','expanded_controls','ground_disabled'])
elif args.case=='hud':
    # #417: FPS counter colour relative to the cap (Unlimited against 60); see HUD_CASES in main/gym/scenarios.lua.
    assert set(cases)=={'cap60_54_green','cap60_53_orange','cap60_42_orange','cap60_41_red','cap30_27_green','cap30_26_orange','cap30_20_red',
        'cap144_130_green','cap144_129_orange','cap144_101_orange','cap144_100_red','cap90_60_red','cap120_108_green',
        'unlimited_54_green','unlimited_53_orange','unlimited_41_red'}
    assert all(value is True for value in cases.values())
elif args.case=='a15a':
    assert set(cases)=={'lean_back','lean_forward','landing_squash','bounded','rest','physics_unchanged'}
    assert cases['lean_back']>=0.05 and cases['lean_forward']<=-0.05 and cases['landing_squash']<=-2
    assert all(cases[k] is True for k in ['bounded','rest','physics_unchanged'])
    for name in ('rider-throttle.png','rider-brake.png','rider-landing.png'): assert (out/name).is_file(), name
elif args.case=='coast':
    assert set(cases)=={'coast_distance_m','brake_tap_stopped','rest_speed_mps'}
    assert 6<=cases['coast_distance_m']<=15 and cases['brake_tap_stopped'] and cases['rest_speed_mps']<0.1
else: raise RuntimeError('Unknown gym test case')
print(json.dumps(report))
