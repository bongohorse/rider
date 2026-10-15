"""Small strict G1 protocol collector, reused by native and browser runners."""
import json

IDS = ['backend', 'body_collision', 'wheel_motor', 'wheel_spring', 'units', 'fixed_ticks', 'cleanup_reset', 'collection_cleanup']
PREFIX = 'RIDER_G1 '


class Collector:
    def __init__(self, run_id, source_sha, config_hash):
        self.run_id, self.source_sha, self.config_hash = run_id, source_sha, config_hash
        self.started, self.ended = False, False
        self.cases, self.foreign = {}, 0

    def feed(self, line):
        if 'ERROR:SCRIPT:' in line or 'ERROR:PHYSICS:' in line:
            raise RuntimeError(line)
        if PREFIX not in line:
            return
        data = json.loads(line.split(PREFIX, 1)[1])
        if data.get('run_id') != self.run_id:
            self.foreign += 1
            return
        if self.ended:
            raise RuntimeError('Event after suite completion')
        event = data.get('event')
        if event == 'suite_start':
            if self.started or data.get('protocol') != 1 or data.get('suite') != 'g1' or data.get('expected') != IDS:
                raise RuntimeError('Invalid/duplicate suite start or inventory')
            if data.get('source_sha') != self.source_sha or data.get('config_hash') != self.config_hash:
                raise RuntimeError('Source/config identity mismatch')
            self.started = True
        elif event == 'case':
            key = data.get('id')
            if not self.started or key not in IDS or key in self.cases or data.get('status') != 'PASS' or not data.get('measurements'):
                raise RuntimeError('Invalid/duplicate/failing case: ' + str(data))
            self.cases[key] = data['measurements']
        elif event == 'suite_end':
            if not self.started or data.get('status') != 'PASS' or set(self.cases) != set(IDS) or data.get('count') != len(IDS) or data.get('passed') != len(IDS):
                raise RuntimeError('Incomplete/failing suite: ' + str(data))
            self.ended = True
        else:
            raise RuntimeError('Unknown protocol event')

    def finish(self):
        if not self.ended:
            raise RuntimeError('Missing completion (zero/partial results cannot pass)')
        return {'run_id': self.run_id, 'source_sha': self.source_sha, 'config_hash': self.config_hash,
                'status': 'PASS', 'cases': self.cases, 'ignored_foreign': self.foreign}
