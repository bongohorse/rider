import argparse
import json
from pathlib import Path
import subprocess
import uuid


def main():
    p = argparse.ArgumentParser()
    p.add_argument('directory')
    args = p.parse_args()
    root = Path(args.directory)
    binaries = list(root.rglob('*.exe')) if __import__('os').name == 'nt' else [x for x in root.rglob('*') if x.is_file() and x.name == 'RiderG1.x86_64']
    if len(binaries) != 1:
        raise RuntimeError(f'Expected one matching bundled executable, got {binaries}')
    run_id = str(uuid.uuid4())
    result = subprocess.run([str(binaries[0].resolve()), '--config=rider.run_id=' + run_id], capture_output=True, text=True, timeout=30)
    (root / 'runtime.log').write_text(result.stdout + result.stderr)
    lines = [x.split('RIDER_BACKEND ', 1)[1] for x in result.stdout.splitlines() if 'RIDER_BACKEND ' in x]
    assert result.returncode == 0, result.stderr
    assert len(lines) == 1, result.stdout
    data = json.loads(lines[0])
    assert data['run_id'] == run_id, data
    assert data['version']['major'] == 3, data
    print('PASS backend probe:', json.dumps(data))


if __name__ == '__main__':
    main()
