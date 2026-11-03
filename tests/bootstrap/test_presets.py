"""Preset guard (#199): every bundled preset is complete, finite and in range; A/B/C are pinned byte for byte."""
import hashlib
import json
import math
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
PRESETS = ROOT/'main/game/presets'
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
    lua = (ROOT/'main/game/feel.lua').read_text()
    order = re.findall(r'"(\w+)"', re.search(r'^M\.order=\{([^}]*)\}', lua, re.M).group(1))
    # #114: debug-only wheel-size candidates, outside the P cycle and chips.
    debug = re.findall(r'"(\w+)"', re.search(r'^M\.debug_order=\{([^}]*)\}', lua, re.M).group(1))
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
    return order, debug, keys, optional, ranges


ORDER, DEBUG, KEYS, OPTIONAL, RANGES = feel_tables()
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
        self.assertEqual(sorted(p.stem for p in PRESETS.glob('*.json')), sorted(ORDER+DEBUG))
        self.assertFalse(set(ORDER) & set(DEBUG))

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



GAME = ROOT/'main/game'


def geometry_table():
    """M.geometry from feel.lua: key -> {radius, radius_m, wheel_y, factory, art_scale, camera_rest}."""
    lua = (ROOT/'main/game/feel.lua').read_text()
    block = lua[lua.index('M.geometry={'):]
    block = block[:block.index('\n}')]
    table = {}
    for key, body in re.findall(r'(\w+)=\{(radius=[^}]*)\}', block):
        fields = dict(re.findall(r'(\w+)=("[^"]*"|[-\d./]+)', body))
        table[key] = {k: v.strip('"') if v.startswith('"') else number(v) for k, v in fields.items()}
    return table


def number(text):
    """A Lua number literal or a quotient of two (art_scale=26/22)."""
    if '/' in text:
        a, b = text.split('/')
        return number(a)/number(b)
    value = float(text)
    return int(value) if value.is_integer() and '.' not in text else value


class WheelCandidates(unittest.TestCase):
    """#114 stage 1: debug-only larger-wheel candidates are preset A plus authored wheel geometry only."""
    GEOMETRY = geometry_table()

    def test_candidates_are_a_with_another_key(self):
        a = json.loads((PRESETS/'a.json').read_text())
        self.assertEqual(DEBUG, ['w26', 'w30'])
        for key in DEBUG:
            data = json.loads((PRESETS/f'{key}.json').read_text())
            self.assertEqual(data['key'], key)
            self.assertEqual(data['values'], a['values'], key)

    def test_default_geometry_is_the_shipped_wheel(self):
        g = self.GEOMETRY['default']
        self.assertEqual(g, {'radius': 22, 'radius_m': .22, 'wheel_y': -30, 'factory': '#wheel', 'art_scale': 1, 'camera_rest': 46})
        self.assertEqual((GAME/'wheel.convexshape').read_text(), 'shape_type: TYPE_SPHERE\ndata: 22.0\n')
        values = re.search(r'^M\.values=\{(.*)\}$', (GAME/'feel.lua').read_text(), re.M).group(1)
        self.assertIn('wheel_y=-30', values)
        self.assertEqual(set(self.GEOMETRY), {'default', *DEBUG})

    def test_candidate_resources_match_their_geometry(self):
        wheel_go = (GAME/'wheel.go').read_text()
        base = float(re.search(r'scale \{ x: ([\d.]+)', wheel_go).group(1))
        controller = (GAME/'controller.go').read_text()
        for key in DEBUG:
            g, r = self.GEOMETRY[key], self.GEOMETRY[key]['radius']
            with self.subTest(candidate=key):
                self.assertEqual(g['factory'], f'#wheel{r}')
                self.assertAlmostEqual(g['radius_m'], r*0.01, places=12)
                self.assertAlmostEqual(g['art_scale'], r/22, places=12)
                # Ride height and clearance scale with the radius (wheel_y = -30 x r/22, rounded to whole units).
                self.assertEqual(g['wheel_y'], -round(30*r/22))
                self.assertEqual(g['camera_rest'], r-g['wheel_y']-6)
                self.assertEqual((GAME/f'wheel{r}.convexshape').read_text(), f'shape_type: TYPE_SPHERE\ndata: {r}.0\n')
                # Same body as the shipped wheel (mass, friction, filter); only the shape differs.
                self.assertEqual((GAME/f'wheel{r}.collisionobject').read_text(),
                                 (GAME/'wheel.collisionobject').read_text().replace('wheel.convexshape', f'wheel{r}.convexshape'))
                go = (GAME/f'wheel{r}.go').read_text()
                self.assertIn(f'"/main/game/wheel{r}.collisionobject"', go)
                self.assertIn('"/main/game/wheel.sprite"', go)
                self.assertAlmostEqual(float(re.search(r'scale \{ x: ([\d.]+)', go).group(1)), base*r/22, places=8)
                self.assertEqual((GAME/f'wheel{r}.factory').read_text(), f'prototype: "/main/game/wheel{r}.go"\nload_dynamically: true\n')
                self.assertIn(f'components {{ id: "wheel{r}" component: "/main/game/wheel{r}.factory" }}', controller)


if __name__ == '__main__':
    unittest.main()
