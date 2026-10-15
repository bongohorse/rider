"""Package one exact HTML5 bundle under a commit-specific asset namespace."""
import argparse
import json
from pathlib import Path
import re
import shutil


def package(bundle, output, sha, build_id):
    if not re.fullmatch(r'[a-f0-9]{40}',sha):
        raise ValueError('Full source SHA required')
    if not re.fullmatch(r'[0-9]+-[0-9]+',build_id):
        raise ValueError('Build ID must contain workflow run and attempt')
    indexes=list(Path(bundle).rglob('index.html'))
    if len(indexes)!=1:
        raise ValueError('Exactly one HTML5 bundle required')
    source=indexes[0].parent
    if not list(source.rglob('*.wasm')):
        raise ValueError('HTML5 Wasm engine missing')
    output=Path(output)
    if output.exists():
        raise ValueError('Refusing to mix preview builds in existing output')
    target=output/'builds'/sha/build_id
    shutil.copytree(source,target)
    shutil.copyfile(Path(__file__).with_name('index.html'),output/'index.html')
    (output/'build.json').write_text(json.dumps({'source_sha':sha,'build_id':build_id,'path':f'builds/{sha}/{build_id}/index.html'})+'\n')
    (output/'.nojekyll').touch()
    print(json.dumps({'source_sha':sha,'site':str(output)}))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--bundle',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--sha',required=True)
    parser.add_argument('--build-id',required=True)
    args=parser.parse_args()
    package(args.bundle,args.output,args.sha,args.build_id)
