"""The editor help overlay (LE6b) lists every key the editor binds, so it matches the shipped controls."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
# How each bound input is written in the help text.
NAMES = {
    'KEY_DEL': '[Delete]', 'KEY_BACKSPACE': '[Backspace]', 'KEY_ESC': '[Esc]', 'KEY_ENTER': '[Enter]', 'KEY_KP_ENTER': '[Enter]',
    'KEY_TAB': '[Tab]', 'KEY_HOME': '[Home]', 'KEY_PERIOD': '[.]', 'KEY_KP_DECIMAL': '[.]', 'KEY_LCTRL': 'Ctrl', 'KEY_RCTRL': 'Ctrl', 'KEY_LSHIFT': 'Shift',
    'KEY_RSHIFT': 'Shift', 'KEY_LALT': '[Alt]', 'KEY_RALT': '[Alt]', 'KEY_SPACE': '[Space]', 'MOUSE_WHEEL_UP': 'Wheel',
    'MOUSE_WHEEL_DOWN': 'Wheel', 'MOUSE_BUTTON_MIDDLE': 'Middle drag',
}


def help_text():
    source = (ROOT / 'main/gym/editor.gui_script').read_text()
    block = source.split('-- HELP BEGIN', 1)[1].split('-- HELP END', 1)[0]
    return '\n'.join(re.findall(r'"((?:[^"\\]|\\.)*)"', block))


class EditorHelp(unittest.TestCase):
    def test_every_editor_binding_is_listed(self):
        bindings = re.findall(r'input: (\w+) action: "(\w+)"', (ROOT / 'input/game.input_binding').read_text())
        text = help_text()
        # Editor actions, the help key itself and the prefab type keys (the game's station keys 1-7).
        listed = [(key, action) for key, action in bindings
                  if (action.startswith('editor_') or action == 'help_toggle' or action in {f'station_{i}' for i in range(1, 8)}) and key != 'TEXT']
        self.assertGreater(len(listed), 30)
        for key, action in listed:
            # The seven prefab type keys are listed as one range.
            name = '[1] to [7]' if action.startswith('station_') else NAMES.get(key) or '[' + key.removeprefix('KEY_') + ']'
            self.assertIn(name, text, f'{action} ({key}) is not in the editor help')

    def test_help_names_the_features(self):
        text = help_text()
        for phrase in ('Curve', 'Prefab', 'Ctrl+[C]', 'Ctrl+[V]', 'Mirror [<] [>]', 'test start', 'Shift+[F]', 'focused', 'Label', '[R] retry', 'Fit level'):
            self.assertIn(phrase, text)


if __name__ == '__main__':
    unittest.main()
