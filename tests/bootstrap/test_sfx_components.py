"""#438: every one-shot effect in main/game/audio.lua has its sound component, .sound and CC0 wav.

The Lua suite stubs `sound`, so it cannot see a URL ("#sfx_<name>") without a component; Bob only
rejects missing resource paths. This checks the wiring in every GO that runs controller.script.
"""
from pathlib import Path
import re
import unittest
import wave

ROOT = Path(__file__).resolve().parents[2]
CONTROLLER = '/main/game/controller.script'


def effect_names():
    source = (ROOT / 'main/game/audio.lua').read_text()
    match = re.search(r'^M\.effects=\{([^}]*)\}', source, re.M)
    assert match, 'audio.effects table not found'
    return sorted(re.findall(r'([a-z_]+)=', match.group(1)))


def components(go_file):
    text = go_file.read_text()
    return dict(re.findall(r'components \{ id: "([^"]+)" component: "([^"]+)" \}', text))


class SfxComponents(unittest.TestCase):
    def test_every_effect_is_wired_in_every_controller_go(self):
        names = effect_names()
        self.assertEqual(names, ['coin', 'crash', 'finish', 'fuel', 'gem', 'land'])
        owners = [p for p in sorted((ROOT / 'main').rglob('*.go')) if components(p).get('script') == CONTROLLER]
        self.assertGreaterEqual(len(owners), 2, owners)
        for owner in owners:
            found = components(owner)
            for name in names:
                with self.subTest(go=str(owner.relative_to(ROOT)), effect=name):
                    self.assertEqual(found.get(f'sfx_{name}'), f'/main/game/sfx_{name}.sound')

    def test_sound_resources_point_at_short_mono_pcm_wavs_with_a_license(self):
        license_text = (ROOT / 'main/game/assets/sfx-LICENSE.txt').read_text()
        self.assertIn('CC0-1.0', license_text)
        for name in effect_names():
            with self.subTest(effect=name):
                sound = (ROOT / f'main/game/sfx_{name}.sound').read_text()
                self.assertIn(f'sound: "/main/game/assets/sfx_{name}.wav"', sound)
                self.assertIn('looping: 0', sound)
                self.assertIn(f'sfx_{name}.wav', license_text)
                with wave.open(str(ROOT / f'main/game/assets/sfx_{name}.wav'), 'rb') as w:
                    self.assertEqual((w.getnchannels(), w.getsampwidth()), (1, 2))
                    self.assertLessEqual(w.getnframes() / w.getframerate(), 1.0)


if __name__ == '__main__':
    unittest.main()
