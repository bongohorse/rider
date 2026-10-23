#!/usr/bin/env python3
"""Collect auditable GitHub Gym step timings; requires authenticated gh, no writes to GitHub."""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import json
from pathlib import Path
import re
import statistics
import subprocess

REPO = 'bongohorse/rider'


def api(endpoint, raw=False):
    result = subprocess.run(['gh', 'api', endpoint, '--allow-escape-sequences'],
                            check=True, capture_output=True, text=True, timeout=120)
    return result.stdout if raw else json.loads(result.stdout)


def seconds(start, end):
    if not start or not end:
        return None
    return (datetime.fromisoformat(end.replace('Z', '+00:00')) -
            datetime.fromisoformat(start.replace('Z', '+00:00'))).total_seconds()


def gym_group(name):
    # Job names come from remote workflow data; never use arbitrary text as a local path.
    match = re.search(r'(?:^| / )Gym \(([a-z0-9-]+)\)$', name)
    if not match:
        raise ValueError(f'Unsafe or unrecognized Gym job name: {name!r}')
    return match[1]


def collect(run_id, output):
    dest = output / str(run_id)
    dest.mkdir(parents=True, exist_ok=True)
    run = api(f'repos/{REPO}/actions/runs/{run_id}')
    if run['status'] != 'completed':
        raise ValueError(f'Run {run_id} is not complete; timing would be partial')
    # Preserve every page: a successful first page is not proof of a complete matrix.
    jobs, page = [], 1
    while True:
        batch = api(f'repos/{REPO}/actions/runs/{run_id}/jobs?per_page=100&page={page}')['jobs']
        jobs.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    (dest / 'run.json').write_text(json.dumps(run, indent=2) + '\n')
    (dest / 'jobs.json').write_text(json.dumps(jobs, indent=2) + '\n')
    gym = [j for j in jobs if re.search(r'(?:^| / )Gym \(', j['name'])]
    build = next((j for j in jobs if j['name'].endswith('Build shared debug Gym')), None)
    required = next((j for j in jobs if j['name'] == 'required'), None)
    reports = next((j for j in jobs if j['name'].endswith('Merge Gym part reports')), None)

    def measure(job):
        group = gym_group(job['name'])
        log = api(f"repos/{REPO}/actions/jobs/{job['id']}/logs", raw=True)
        (dest / f'{group}.log').write_text(log)
        steps = job.get('steps', [])
        first = next((s['number'] for s in steps if s['name'].startswith('Verify station speed start')), None)
        last = next((s['number'] for s in steps if s['name'] == 'Keep Gym screenshot separately for visual review'), None)
        if first is None or last is None:
            raise ValueError(f'Unknown Gym step layout: {job["name"]}')
        def duration(step):
            return seconds(step.get('started_at'), step.get('completed_at')) or 0
        selected = [s for s in steps if first <= s['number'] < last and s['conclusion'] != 'skipped']
        setup_steps = [s for s in steps if s['number'] < first]
        artifact_steps = [s for s in steps if 'actions/upload-artifact@' in s['name'] or
                          'actions/download-artifact@' in s['name'] or s['number'] == last]
        install = [s for s in setup_steps if 'playwright install' in s['name'] or
                   s['name'] == 'Install pinned Chromium and validate runner dependencies']
        image = re.search(r'Image: (\S+)\s*\n[^\n]*Version: (\S+)', log)
        checkout = re.search(r'git log -1 --format=%H\n[^\n]*? ([0-9a-f]{40})\s*\n', log)
        cache = re.search(r'Cache restored from key: (\S*playwright\S*)', log)
        return {
            'group': group, 'job_id': job['id'], 'conclusion': job['conclusion'],
            'source_sha': checkout[1] if checkout else None,
            'runner_image': list(image.groups()) if image else None,
            'browser_cache_key': cache[1] if cache else None,
            'browser_cache_miss': 'Cache not found for input keys:' in log and not cache,
            'job_seconds': seconds(job['started_at'], job['completed_at']),
            'dependency_ready_to_start_seconds': seconds(build['completed_at'], job['started_at']) if build else None,
            'setup_seconds': sum(map(duration, setup_steps)),
            'playwright_seconds': sum(map(duration, install)),
            'tests_seconds': sum(map(duration, selected)),
            # Download time is also included in setup; categories are explicitly overlapping.
            'artifact_seconds': sum(map(duration, artifact_steps)),
            'tests': [{'name': s['name'], 'conclusion': s['conclusion'], 'seconds': duration(s)} for s in selected],
            'download_summary': re.findall(r'Fetched [^\n]+', log),
            'setup_report': next((json.loads(m) for m in re.findall(r'RIDER_PLAYWRIGHT_SETUP (\{[^\n]+\})', log)), None),
        }
    def measure_other_browser(job):
        log = api(f"repos/{REPO}/actions/jobs/{job['id']}/logs", raw=True)
        (dest / f"browser-{job['id']}.log").write_text(log)
        selected = [step for step in job['steps'] if 'playwright install' in step['name'] or
                    step['name'] == 'Install pinned Chromium and validate runner dependencies']
        image = re.search(r'Image: (\S+)\s*\n[^\n]*Version: (\S+)', log)
        return {
            'job': job['name'], 'job_id': job['id'], 'conclusion': job['conclusion'],
            'runner_image': list(image.groups()) if image else None,
            'playwright_seconds': sum(seconds(step.get('started_at'), step.get('completed_at')) or 0 for step in selected),
            'setup_report': next((json.loads(m) for m in re.findall(r'RIDER_PLAYWRIGHT_SETUP (\{[^\n]+\})', log)), None),
        }
    gym_ids = {job['id'] for job in gym}
    others = [job for job in jobs if job['id'] not in gym_ids and any(
        'playwright install' in step['name'] or step['name'] == 'Install pinned Chromium and validate runner dependencies'
        for step in job.get('steps', []))]
    with ThreadPoolExecutor(max_workers=4) as pool:
        measurements = list(pool.map(measure, gym))
        other_browsers = list(pool.map(measure_other_browser, others))
    source_shas = {g['source_sha'] for g in measurements}
    source_sha = next(iter(source_shas)) if len(source_shas) == 1 else None
    playwright = None
    if source_sha:
        lock = api(f'repos/{REPO}/contents/package-lock.json?ref={source_sha}')
        lock_text = base64.b64decode(lock['content']).decode()
        (dest / 'package-lock.json').write_text(lock_text)
        playwright = json.loads(lock_text)['packages']['node_modules/playwright']['version']
    result = {
        'source_sha': source_sha, 'playwright': playwright,
        'run_id': run_id, 'url': run['html_url'], 'run_head_sha': run['head_sha'],
        'event': run['event'], 'attempt': run['run_attempt'], 'conclusion': run['conclusion'],
        'created_at': run['created_at'], 'run_started_at': run['run_started_at'],
        'created_to_run_start_seconds': seconds(run['created_at'], run['run_started_at']),
        'created_to_required_seconds': seconds(run['created_at'], required['completed_at']) if required else None,
        'run_start_to_required_seconds': seconds(run['run_started_at'], required['completed_at']) if required else None,
        'run_seconds': seconds(run['created_at'], run['updated_at']),
        'gym_build_seconds': seconds(build['started_at'], build['completed_at']) if build else None,
        'build_ready_to_last_gym_seconds': max((seconds(build['completed_at'], j['completed_at']) for j in gym), default=None) if build else None,
        'build_ready_to_reports_seconds': seconds(build['completed_at'], reports['completed_at']) if build and reports else None,
        'groups': measurements, 'other_browser_setups': other_browsers,
        'limitations': [
            'dependency_ready_to_start includes scheduler/orchestration delay; GitHub does not expose exact per-job queue entry here.',
            'setup includes bundle download; artifact_seconds overlaps setup. Unattributed job time includes runner lifecycle and post steps.',
            'run updated_at can include deployment; created_to_required ends at the required job.',
            'cache provenance and package transfers come from retained raw logs; null means not established.',
        ],
    }
    (dest / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runs', type=int, nargs='+', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    results = [collect(run_id, args.output) for run_id in args.runs]
    lines = ['# Gym CI measurements', '', '| Run | Event | Result | Initial wait (s) | Run start → required (s) | Build (s) | Build → last Gym (s) | Gym PW median / range (s) | Other PW max (s) |', '| --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: |']
    for r in results:
        times = [g['playwright_seconds'] for g in r['groups']]
        timing = f'{statistics.median(times):g} / {min(times):g}–{max(times):g}' if times else 'NOT RUN'
        other_max = max((job['playwright_seconds'] for job in r['other_browser_setups']), default=None)
        lines.append(f'| [{r["run_id"]}]({r["url"]}) | {r["event"]} | {r["conclusion"]} | {r["created_to_run_start_seconds"]} | {r["run_start_to_required_seconds"]} | {r["gym_build_seconds"]} | {r["build_ready_to_last_gym_seconds"]} | {timing} | {other_max} |')
    lines += ['', 'Raw run metadata, paginated jobs, per-group logs and measurements are retained alongside this report.', '', *results[0]['limitations']]
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'benchmark.md').write_text('\n'.join(lines) + '\n')
    print('\n'.join(lines[:4 + len(results)]))


if __name__ == '__main__':
    main()
