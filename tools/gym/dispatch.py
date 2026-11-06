"""Gym execution metadata; scheduling and independent expected inventories remain elsewhere (#514)."""

# case -> (Node entry, seconds); unknown cases retain the browser runner's existing rejection path.
RUNNERS = {
    'bg546': ('background546.cjs', 180),
    'w114': ('wheel114.cjs', 600),
    'fps417': ('fps417.cjs', 360),
    'fps444': ('fps444.cjs', 360),
    'cam443': ('camera443.cjs', 360),
    'coast345': ('coast_measure.cjs', 90),
    'ea3': ('versions.cjs', 600),
    'ea2': ('objects.cjs', 600),
    'a22': ('regress.cjs', 360),
    'a21': ('replay.cjs', 360),
    'a20': ('pause.cjs', 360),
    'cf3': ('struts.cjs', 360),
    'le2': ('editor.cjs', 360),
    'le3': ('draw.cjs', 360),
    'le4': ('library.cjs', 360),
    'le5a': ('prefab.cjs', 360),
    'le5b': ('curve.cjs', 360),
    'le5c': ('path.cjs', 360),
    'le5d': ('points.cjs', 360),
    'le6': ('polish.cjs', 360),
    'le1b': ('sizes.cjs', 600),
    'le1a': ('custom.cjs', 360),
    'a19': ('gaps.cjs', 360),
    'a19c': ('air.cjs', 360),
    'a19b': ('bumps.cjs', 600),
    'a19d': ('balance.cjs', 360),
    'a18': ('seams.cjs', 600),
    'a17': ('steps.cjs', 360),
    'a16': ('ramps.cjs', 360),
    'a15': ('stations.cjs', 90),
}

PARTS = {'a18': ['1/2', '2/2'], 'le1b': ['1/2', '2/2'], 'a19b': ['1/2', '2/2'], 'le6': ['1/2', '2/2']}

# Ordered public preset choices and their unchanged result filenames.
PRESET_CASES = {case: RUNNERS[case][0].removesuffix('.cjs') + '-result.json'
                for case in ('a16', 'a17', 'a18', 'a19', 'a19c', 'a19b', 'a19d', 'w114')}


def runner_config(case):
    return RUNNERS.get(case, ('browser.cjs', 90))
