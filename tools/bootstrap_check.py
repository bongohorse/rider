#!/usr/bin/env python3
"""Validate real G0 boundaries and workflow configuration, without claiming physics tests."""
import json
from pathlib import Path
import re
import sys
import yaml

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ['README.md', 'AGENTS.md', '.gitignore', '.gitattributes', '.editorconfig',
            'renovate.json', 'tools/doctor.py', 'tools/doctor.ps1', 'tools/doctor.sh',
            'docs/G1_ACCEPTANCE.md', 'docs/TOOLCHAIN_CANDIDATES.md',
            'tools/toolchain-candidates.json', '.github/workflows/ci.yml']


def validate(root):
    errors = []
    for filename in REQUIRED:
        if not (root / filename).is_file():
            errors.append(f'Missing {filename}')
    for filename in ('game.project',):
        if (root / filename).exists():
            errors.append(f'{filename} belongs to G1, not G0')
    for folder in ('main', 'physics', 'vehicle', 'sandbox'):
        if (root / folder).exists():
            errors.append(f'{folder}/ implementation is outside G0')
    for p in root.rglob('*.appmanifest'):
        if 'node_modules' not in p.parts:
            errors.append(f'{p.name} belongs to G1')
    for filename in ('renovate.json', 'package.json', 'tools/toolchain-candidates.json'):
        try:
            json.loads((root / filename).read_text())
        except (OSError, ValueError) as exc:
            errors.append(f'{filename}: {exc}')
    for p in (root / '.github/workflows').glob('*.yml'):
        try:
            workflow = yaml.load(p.read_text(), Loader=yaml.BaseLoader)
            if not isinstance(workflow, dict) or not workflow.get('on') or not workflow.get('jobs'):
                errors.append(f'{p.name}: workflow must have triggers and jobs')
                continue
            if workflow.get('permissions') != {'contents': 'read'}:
                errors.append(f'{p.name}: expected read-only contents permission')
            for job in workflow['jobs'].values():
                if not job.get('timeout-minutes'):
                    errors.append(f'{p.name}: job timeout missing')
                for step in job.get('steps', []):
                    use = step.get('uses', '')
                    if use and not re.fullmatch(r'[\w.-]+/[\w./-]+@[0-9a-f]{40}', use):
                        errors.append(f'{p.name}: unpinned action {use}')
        except (OSError, yaml.YAMLError, TypeError, AttributeError) as exc:
            errors.append(f'{p.name}: {exc}')
    config = json.loads((root / 'renovate.json').read_text())
    if config.get('automerge') is not False:
        errors.append('Renovate must not automerge')
    return errors


def main():
    errors = validate(ROOT)
    for error in errors:
        print(f'FAIL: {error}', file=sys.stderr)
    if not errors:
        print('PASS: G0 file boundaries, JSON, workflow structure, pinned actions and permissions')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
