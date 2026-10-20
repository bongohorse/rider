"""The editor help overlay (LE6b) matches the shipped controls: every editor key binding is described with
its key on the line for its action, and the help names no key that is not bound."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
# How each bound input is written in the help text.
NAMES = {
    'KEY_DEL': '[Delete]', 'KEY_BACKSPACE': '[Backspace]', 'KEY_ESC': '[Esc]', 'KEY_ENTER': '[Enter]', 'KEY_KP_ENTER': '[Enter]',
    'KEY_TAB': '[Tab]', 'KEY_HOME': '[Home]', 'KEY_PERIOD': '[.]', 'KEY_KP_DECIMAL': '[.]', 'KEY_LCTRL': 'Ctrl', 'KEY_RCTRL': 'Ctrl',
    'KEY_LSHIFT': 'Shift', 'KEY_RSHIFT': 'Shift', 'KEY_LALT': '[Alt]', 'KEY_RALT': '[Alt]', 'KEY_SPACE': '[Space]',
    'MOUSE_WHEEL_UP': 'Wheel', 'MOUSE_WHEEL_DOWN': 'Wheel', 'MOUSE_BUTTON_MIDDLE': 'Middle drag',
}
# Each editor action (and the help key and the prefab type keys) with the help phrases that describe it;
# one phrase must contain the action's key as written above. A new binding needs an entry here.
PHRASES = {
    'editor_ctrl': ['Ctrl while dragging: off', 'Ctrl+[Z] undo'], 'editor_shift': ['Shift 15 deg', 'Shift+click adds or removes'],
    'editor_space': ['[Space]+drag pans'], 'editor_alt': ['[Alt] 0.1 m'], 'editor_toggle': ['[E], [Enter] or Play: drive from START'],
    'editor_play': ['[E], [Enter] or Play', 'or [Enter] finishes'], 'editor_test': ['[F] test start on the surface', 'Shift+[F] drop here'],
    'editor_tool_select': ['[S] Select'], 'editor_tool_draw': ['[D] Draw'], 'editor_tool_prefab': ['[P] Prefab'],
    'editor_grid': ['[G] grid on/off'], 'editor_cycle': ['[Tab] picks the next item'], 'editor_connect': ['[J] connect'],
    'editor_split': ['[K] split'], 'editor_delete': ['[Delete] / [Backspace] delete', '[Backspace] or Ctrl+[Z] removes'],
    'editor_cancel': ['[Esc] cancels the action', '[Esc] discards the piece'], 'editor_z': ['Ctrl+[Z] undo', 'Ctrl+Shift+[Z] redo'],
    'editor_y': ['Ctrl+[Y]'], 'editor_c': ['[C] Curve', 'Ctrl+[C] copy'], 'editor_v': ['Ctrl+[V] paste'],
    'editor_fit': ['[Home] Fit level'], 'editor_centre': ['[.] centre the selection'], 'editor_label': ['[L] Label'],
    'editor_pan': ['Middle drag'], 'editor_zoom_in': ['Wheel zooms'], 'editor_zoom_out': ['Wheel zooms'],
    'help_toggle': ['[H], [Esc] or a click outside closes it'], 'station': ['[1] to [7] pick the type'],
}
# Bracketed tokens in the help that are not keys: the Mirror buttons.
NOT_KEYS = {'<', '>'}


def help_text():
    source = (ROOT / 'main/gym/editor.gui_script').read_text()
    block = source.split('-- HELP BEGIN', 1)[1].split('-- HELP END', 1)[0]
    return '\n'.join(re.findall(r'"((?:[^"\\]|\\.)*)"', block))


def bindings():
    return re.findall(r'input: (\w+) action: "(\w+)"', (ROOT / 'input/game.input_binding').read_text())


def name(key):
    return NAMES.get(key) or '[' + key.removeprefix('KEY_') + ']'


class EditorHelp(unittest.TestCase):
    def test_every_editor_binding_is_described_with_its_key(self):
        text = help_text()
        listed = [(key, action) for key, action in bindings()
                  if (action.startswith('editor_') or action == 'help_toggle' or action in {f'station_{i}' for i in range(1, 8)}) and key != 'TEXT']
        self.assertGreater(len(listed), 30)
        for key, action in listed:
            phrases = PHRASES.get('station' if action.startswith('station_') else action)
            self.assertIsNotNone(phrases, f'{action} ({key}) has no help phrase: add it to the help and to PHRASES')
            for phrase in phrases:
                self.assertIn(phrase, text, f'{action}: "{phrase}" is not in the editor help')
            key_name = '[1] to [7]' if action.startswith('station_') else name(key)
            self.assertTrue(any(key_name in phrase for phrase in phrases), f'{action}: no phrase names its key {key_name}')

    def test_every_key_in_the_help_is_bound(self):
        bound = {name(key).strip('[]') for key, _ in bindings()}
        for token in re.findall(r'\[([^\]]+)\]', help_text()):
            if token not in NOT_KEYS:
                self.assertIn(token, bound, f'the help names [{token}], which no binding has')

    def test_help_names_the_features(self):
        text = help_text()
        for phrase in ('Curve', 'Prefab', 'Ctrl+[C]', 'Ctrl+[V]', 'Mirror [<] [>]', 'test start', 'Shift+[F]', 'focused', 'Label', '[R] retry', 'Fit level'):
            self.assertIn(phrase, text)


if __name__ == '__main__':
    unittest.main()
