"""Small HTML5 gym runtime smoke, independent of the retained G1 fixture."""
import argparse
import json
import subprocess
import sys
import uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/g1'))
from build import build
from run import stop

parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True)
parser.add_argument('--case',default='a1')
args=parser.parse_args()
out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
run_id=str(uuid.uuid4())
settings=out/'gym.settings'
settings.write_text(f'[project]\ndependencies =\n[rider]\nsource_sha = {sha}\nrun_id = {run_id}\ngym_test = {args.case}\n')
build('wasm-web',out,settings,variant='debug')
process=subprocess.Popen(['node',str(ROOT/'tools/gym/browser.cjs'),str(out),sha,run_id,args.case],cwd=ROOT,start_new_session=True)
try: code=process.wait(timeout=90)
finally: stop(process)
if code:raise SystemExit(code)
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
else: raise RuntimeError('Unknown gym test case')
print(json.dumps(report))
