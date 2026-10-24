from pathlib import Path
import re,json,csv,hashlib,urllib.parse
R=Path('/workspace/HC2');D=R/'research';p=D/'HCR2_Technical_Reference_for_Rider.md';t=p.read_text(encoding='utf-8')
errors=[];links=[];anchors=re.findall(r'<a id="([^"]+)"></a>',t)
if len(anchors)!=len(set(anchors)):errors.append('duplicate explicit anchors')
for label,url in re.findall(r'\[([^\]]*)\]\(([^\s)]+)\)',t):
 if url.startswith(('https://','http://')):continue
 if url.startswith('#'):
  if url[1:] not in anchors:errors.append('missing anchor '+url)
  continue
 target=url.split('#',1)[0];dest=(p.parent/urllib.parse.unquote(target)).resolve();links.append(str(dest))
 if not dest.exists():errors.append('missing local link '+url)
rows=list(csv.DictReader((D/'evidence_register.csv').open(encoding='utf-8')))
for r in rows:
 if r['artifact_path']:
  q=R/r['artifact_path']
  if not q.exists():errors.append('missing evidence '+str(q))
  elif r['sha256'] and hashlib.sha256(q.read_bytes()).hexdigest()!=r['sha256']:errors.append('hash mismatch '+str(q))
  if q.is_file():
   m=re.fullmatch(r'lines? (\d+)[–-](\d+)',r['locator'])
   if m and int(m[2])>sum(1 for _ in q.open(errors='replace')):errors.append('invalid line range '+str(q))
ids=set(r['claim_id'] for r in rows)
for i in ids:
 if 'claim-'+i.lower() not in anchors:errors.append('missing claim anchor '+i)
assert t.count('```')%2==0,'unclosed code fence'
assert '@@' not in t,'unexpanded template'
summary={'document':str(p),'utf8':True,'word_count':len(t.split()),'explicit_anchors':len(anchors),'local_link_occurrences':len(links),'unique_local_link_targets':len(set(links)),'claim_ids':len(ids),'evidence_rows':len(rows),'hashes_verified':sum(bool(r['sha256']) for r in rows),'errors':errors,'status':'PASS' if not errors else 'FAIL','scope':'Local existence, supplied SHA-256, navigation and basic format checks. Does not prove inferred semantics or online URL availability.'}
(D/'validation.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2));raise SystemExit(bool(errors))
