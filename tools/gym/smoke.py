"""Small HTML5 gym runtime smoke, independent of the retained G1 fixture."""
import argparse
import json
import subprocess
import sys
import uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/g1'))
from bundle import build_bundle, verify_bundle
from run import stop

parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True)
parser.add_argument('--case',default='a1')
parser.add_argument('--bundle', help='Reuse a verified shared debug Gym build')
args=parser.parse_args()
out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
run_id=str(uuid.uuid4())
bundle=Path(args.bundle).resolve() if args.bundle else out/'bundle'
if not args.bundle:build_bundle(bundle,sha)
verify_bundle(bundle,sha)
runner='seams.cjs' if args.case=='a18' else 'steps.cjs' if args.case=='a17' else 'ramps.cjs' if args.case=='a16' else 'stations.cjs' if args.case=='a15' else 'browser.cjs'
process=subprocess.Popen(['node',str(ROOT/'tools/gym'/runner),str(out),sha,run_id,args.case,str(bundle)],cwd=ROOT,start_new_session=True)
try: code=process.wait(timeout=600 if args.case=='a18' else 360 if args.case in ('a16','a17') else 90)
finally: stop(process)
if code:raise SystemExit(code)
if args.case=='a18':
    report=json.loads((out/'seams-result.json').read_text())
    assert report['status']=='PASS' and report['source_sha']==sha and report['run_id']==run_id and len(report['results'])==6
    print(json.dumps({'status':report['status'],'comparison':report['comparison']}));raise SystemExit(0)
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
        expected.update({'reverse_speed','reverse_dx','air_angle','camera_direction_zoom'})
        assert cases['reverse_speed'] < -50 and cases['reverse_dx'] < -50 and cases['air_angle']>0.1 and cases['camera_direction_zoom'] is True
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
    assert set(cases)=={'url_selected','invalid_fallback','three_drivable','full_replacement','no_reload'}
    assert all(cases[k] is True for k in ['url_selected','three_drivable','full_replacement','no_reload'])
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
    assert set(cases)=={'fps_green_55','fps_orange_54','fps_orange_30','fps_red_29'}
    assert all(cases.values())
elif args.case=='coast':
    assert set(cases)=={'coast_distance_m','brake_tap_stopped','rest_speed_mps'}
    assert 6<=cases['coast_distance_m']<=15 and cases['brake_tap_stopped'] and cases['rest_speed_mps']<0.1
else: raise RuntimeError('Unknown gym test case')
print(json.dumps(report))
