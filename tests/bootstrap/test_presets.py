"""Preset guard (#199): every bundled preset is complete, finite and in range; A/B/C are pinned byte for byte."""
import hashlib
import json
import math
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
PRESETS = ROOT/'main/gym/presets'
FIXTURES = Path(__file__).resolve().parent/'fixtures/presets'
# A is the measurement baseline; B and C are evidence for earlier PRs. Changing one needs a new GO and a new pin.
PINNED = {
    'a': '0a229b625f9deda17c77ee9c0094bc7016c0a1ea9ec940c330212615ff683431',
    'b': 'c0d4038e33a8a6c5d6c645a846f346f3f956529c70b9d4bfd9ee90af27a4c59a',
    'c': 'e8734ba19247fa111f1031aa4b271b8da1b0b07a9d1d6931f15ca77323fb6a97',
}
# Box2D's rotation cap is 0.25*pi rad per 1/60 s step, about 47.1 rad/s (#114). B and C predate it.
ROTATION_CAP = 0.25*math.pi*60
LEGACY_ABOVE_CAP = {'b', 'c'}


def feel_tables():
    """Read the registry, keys and ranges from feel.lua, the single source the game validates with."""
    lua = (ROOT/'main/gym/feel.lua').read_text()
    order = re.findall(r'"(\w+)"', re.search(r'^M\.order=\{([^}]*)\}', lua, re.M).group(1))
    keys = re.findall(r'"(\w+)"', re.search(r'^M\.preset_keys=\{([^}]*)\}', lua, re.M).group(1))
    # Optional keys (#211) and their defaults: a preset file may omit them.
    optional = {k: float(v) for k, v in re.findall(r'(\w+)=(-?[\d.]+)', re.search(r'^M\.optional=\{([^}]*)\}', lua, re.M).group(1))}
    num = r'(-?[\d.]+)'
    ranges = {}
    sliders = lua[lua.index('M.sliders={'):]
    sliders = sliders[:sliders.index('\n}')]
    for line in re.findall(r'\{key="[^}]*\}', sliders):
        key = re.search(r'key="(\w+)"', line).group(1)
        sign = re.search(r'sign=(-?1)', line)
        ranges[key] = (float(re.search(r'min='+num, line).group(1)), float(re.search(r'max='+num, line).group(1)), int(sign.group(1)) if sign else 1)
    explicit = lua[lua.index('M.ranges={'):]
    explicit = explicit[:explicit.index('\n}')]
    for key, lo, hi in re.findall(r'(\w+)=\{min='+num+r',max='+num+r'\}', explicit):
        assert key not in ranges, key
        ranges[key] = (float(lo), float(hi), 1)
    return order, keys, optional, ranges


ORDER, KEYS, OPTIONAL, RANGES = feel_tables()
REQUIRED = [k for k in KEYS if k not in OPTIONAL]


def validate(data, key):
    """Mirror of feel.validate plus the guard-only rotation-cap rule for candidates; returns the refusal reason or None."""
    if not isinstance(data, dict) or data.get('schema') != 1 or data.get('key') != key or not isinstance(data.get('values'), dict):
        return 'invalid schema'
    values = data['values']
    for name, value in values.items():
        if name not in RANGES:
            return 'unknown key '+name
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            return 'non-finite '+name
        lo, hi, sign = RANGES[name]
        if not lo <= value*sign <= hi:
            return f'{name} {value} outside range'
    for name in REQUIRED:
        if name not in values:
            return 'missing '+name
    if len(values) != len(REQUIRED)+len(OPTIONAL.keys() & values.keys()):
        return 'unexpected fields'
    if values['camera_zoom_min'] > values['camera_zoom']:
        return 'camera_zoom_min above camera_zoom'
    if key not in LEGACY_ABOVE_CAP and abs(values['motor_speed']) >= ROTATION_CAP:
        return 'motor_speed above the Box2D rotation cap'
    return None


def check_pin(key, raw):
    if key in PINNED and hashlib.sha256(raw).hexdigest() != PINNED[key]:
        raise AssertionError(f'Preset {key.upper()} changed; it is pinned byte for byte')


class Presets(unittest.TestCase):
    def test_registry_matches_files(self):
        self.assertEqual(ORDER[:3], ['a', 'b', 'c'])
        self.assertEqual(len(set(ORDER)), len(ORDER))
        self.assertEqual(sorted(p.stem for p in PRESETS.glob('*.json')), sorted(ORDER))

    def test_every_key_has_one_range(self):
        # 22 required keys (unchanged since #199) plus the optional ones (#211), each with its default.
        self.assertEqual(len(REQUIRED), 22)
        self.assertEqual(OPTIONAL, {'air_pitch_damping': 0})
        self.assertEqual(len(set(KEYS)), len(KEYS))
        self.assertLessEqual(set(OPTIONAL), set(KEYS))
        self.assertEqual(set(KEYS), set(RANGES))
        for key, default in OPTIONAL.items():
            lo, hi, sign = RANGES[key]
            self.assertTrue(lo <= default*sign <= hi, key)
        for key, (lo, hi, sign) in RANGES.items():
            self.assertLess(lo, hi, key)
            self.assertIn(sign, (1, -1), key)

    def test_every_preset_is_valid(self):
        for path in sorted(PRESETS.glob('*.json')):
            with self.subTest(preset=path.stem):
                self.assertIsNone(validate(json.loads(path.read_text()), path.stem))

    def test_legacy_presets_are_pinned(self):
        for key in PINNED:
            check_pin(key, (PRESETS/f'{key}.json').read_bytes())

    def test_pin_rejects_any_change_to_a(self):
        raw = (PRESETS/'a.json').read_bytes()
        for changed in (raw+b'\n', raw.replace(b'"spring_hz": 5', b'"spring_hz": 5.0'), (FIXTURES/'a-changed.json').read_bytes()):
            with self.assertRaises(AssertionError):
                check_pin('a', changed)

    def test_invalid_fixtures_are_refused(self):
        expected = {
            'out-of-range.json': 'spring_hz',
            'wrong-sign.json': 'motor_speed',
            'missing-key.json': 'missing coast_torque',
            'unknown-key.json': 'unknown key',
            'above-cap.json': 'rotation cap',
            'zoom-order.json': 'camera_zoom_min',
            'wrong-key.json': 'invalid schema',
            'air-damping-negative.json': 'air_pitch_damping',
            'air-damping-above.json': 'air_pitch_damping',
        }
        self.assertEqual(sorted(p.name for p in FIXTURES.glob('*.json') if p.name != 'a-changed.json'), sorted(expected))
        for name, reason in expected.items():
            with self.subTest(fixture=name):
                data = json.loads((FIXTURES/name).read_text())
                refusal = validate(data, 'd')
                self.assertIsNotNone(refusal)
                self.assertIn(reason, refusal)

    def test_optional_key_absent_means_default(self):
        # A/B/C (pinned) and D/E carry no air_pitch_damping: the game applies the default 0 (no damping torque).
        for key in ('a', 'b', 'c', 'd', 'e'):
            data = json.loads((PRESETS/f'{key}.json').read_text())
            self.assertNotIn('air_pitch_damping', data['values'], key)
            self.assertIsNone(validate(data, key))
        self.assertEqual(OPTIONAL['air_pitch_damping'], 0)

    def test_f_is_d_plus_air_damping(self):
        d = json.loads((PRESETS/'d.json').read_text())['values']
        f = json.loads((PRESETS/'f.json').read_text())['values']
        k = f.pop('air_pitch_damping')
        self.assertEqual(f, d)
        self.assertGreater(k, 0)

    def test_non_finite_values_are_refused(self):
        data = json.loads((PRESETS/'a.json').read_text())
        for bad in (float('nan'), float('inf'), '5', True, None):
            data['values']['damping'] = bad
            self.assertIsNotNone(validate(data, 'a'))


if __name__ == '__main__':
    unittest.main()
