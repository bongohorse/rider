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
            'docs/history/G1_ACCEPTANCE.md', 'docs/history/TOOLCHAIN_CANDIDATES.md',
            'tools/toolchain-candidates.json', '.github/workflows/ci.yml']


def validate(root):
    errors = []
    for filename in REQUIRED:
        if not (root / filename).is_file():
            errors.append(f'Missing {filename}')
    # The gym is the product boot; the independent G1 fixture remains available.
    project = root / 'game.project'
    if project.exists():
        import configparser
        config = configparser.ConfigParser()
        config.read(project)
        if config.get('bootstrap', 'main_collection', fallback='') != '/main/gym/boot.collectionc':
            errors.append('Gym main_collection must reference the compiled gym boot resource')
        else:
            if not (root / 'main/gym/boot.collection').is_file():
                errors.append('Gym main_collection source missing')
            if not (root / 'main/main.collection').is_file():
                errors.append('G1 physics fixture boot source missing')
        manifest = root / 'main/physics.appmanifest'
        if not manifest.is_file():
            errors.append('G1 requires an explicit integrated Box2D 3 manifest')
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
                use = job.get('uses', '')
                if use and not re.fullmatch(r'\./\.github/workflows/[\w.-]+\.ya?ml', use):
                    errors.append(f'{p.name}: only local reusable workflows are allowed: {use}')
                if not job.get('uses') and not job.get('timeout-minutes'):
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
        print('PASS: scoped project boundaries, JSON, workflow structure, pinned actions and permissions')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
