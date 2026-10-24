from pathlib import Path
import csv,json,hashlib,re
R=Path('/workspace/HC2'); D=R/'research'
rows=[]
def relative(p):
 p=str(p)
 return p.removeprefix(str(R)+'/')
def add(i,confidence,provenance,path,locator,finding,limit='',sha='',architecture='',binary='',address=''):
 path=relative(path);p=R/path
 assert p.exists(),(i,path)
 actual=hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else ''
 if sha:assert actual==sha,(i,path,sha,actual)
 rows.append(dict(claim_id=i,confidence=confidence,provenance=provenance,artifact_path=path,locator=locator if isinstance(locator,str) else json.dumps(locator,ensure_ascii=False),sha256=actual,architecture=architecture,binary_identity=binary,address_basis=address,finding=finding,remaining_limitation=limit))
for c in json.loads((D/'parent_claims.json').read_text()):
 add(c['id'],c['confidence'],c['provenance'],c['artifact'],c['locator'],c['finding'],c['limitation'],c.get('sha256',''))
for c in json.loads((D/'assets_claims.json').read_text())['claims']:
 add('AS-'+c['id'],'Confirmed','original_asset' if '/unpacked/' in c['path'] else 'schema_derived_or_verified_inventory',c['path'],c['locator'],c['finding'],c['limitation'],c['sha256'])
for c in json.loads((D/'android_claims.json').read_text())['claims']:
 i=c['claim_id'];limit=c['limitation']; conf='Confirmed' if c['confidence']=='high_static' else 'Unknown'
 add(i,conf,'actual_Android_output',c['path'],c['locator'],c['finding'],limit,c.get('source_sha256',''))
 for e in c.get('additional_evidence',[]):
  if isinstance(e,dict): add(i,conf,'actual_Android_output',e['path'],e.get('locator',''),c['finding'],limit,e.get('sha256',e.get('source_sha256','')))
  else:add(i,conf,'actual_Android_output',e,'corroborating source',c['finding'],limit)
n=json.loads((D/'native_claims.json').read_text());primary=n['primary_elf']
for c in n['claims']:
 conf={'observed':'Confirmed','not_established':'Unknown','unknown':'Unknown','unsupported_historical':'Unverified','implementation_unrecovered':'Unknown','measured_snapshot':'Confirmed'}[c['status']]
 for path in c['evidence']:
  add(c['id'],conf,'native_static_evidence',path,'see source-specific native_claims.json record: '+c['id'],c['claim'],'Bounded static evidence; see native chapter and source-specific ledger for exact scope.',architecture='arm64-v8a unless record states another ABI',binary=primary['path']+' SHA256 '+primary['sha256'],address='ELF VA/file offset through PT_LOAD; Ghidra actual memory mapping; selected JNI +0x100000')
 for s in c.get('symbols',[]):
  add(c['id'],conf,'original_ELF_symbol',s.get('binary',primary['path']),'symbol '+s['name']+'; index '+str(s['symbol_index'])+'; symbol record file offset '+str(s.get('symbol_record_file_offset')),c['claim'],'A defined symbol establishes interface identity, not recovered implementation; zero-valued imports are not code addresses.',s.get('source_sha256',''),s.get('architecture','arm64-v8a'),s.get('source_sha256',primary['sha256']),'ELF '+str(s.get('elf_va'))+'; file '+str(s.get('file_offset'))+'; Ghidra '+str(s.get('ghidra_address')))
add('N10','Confirmed','original_ELF_symbols','research/evidence/arm64-v8a_cocos_dynamic_symbols.json','symbol index429: _ZNSt6__ndk16localeC2ERKS0_RKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEi','Original ELF contains defined C++-mangled libc++/NDK symbols.','Establishes C++ runtime material, not the implementation language of every subsystem.',architecture='arm64-v8a',binary=primary['sha256'])
add('N11','Supported inference','source_bound_derived_bytes','decompiled/codex_verified/native_derived/arm64-v8a/libfingersoft_hcr2.so/helper_stage/provenance.json','patches; conditional_key_byte; target_executed=false','A separate ARM64 derived ELF applies source-bound ChaCha8 transformation to201440bytes at ELF0x66fd80 and455metadata bytes.','Conditional byte0x46is supported by independent code/FDE validation, not observed process state. Not a complete runtime image.',architecture='arm64-v8a',binary='raw f9b4ee1664ec8b681da145d97dcbfbeefe6dd8c6a78d1543f22d25933e62c803; derived815c8c438462532191950c7c9bb8d2c6941dc39abf27beffd3be41bdfaeffd49',address='ELF0x66fd80=file0x66fd80; metadataELF0x7251a0=file0x71d1a0')
# Register explicitly bounded unresolved areas/proposals without manufacturing a source.
for i,topic,source in [('U01','Original camera controller','src/graphics/PerspectiveCamera.js'),('U02','Original terrain CPU/collision generation','decompiled/unpacked/base.apk/assets/Common/shaders/terrain.vsh'),('U03','Original suspension and crash implementation','decompiled_src/cpp/Box2DVehicleBuilder.cpp'),('U04','Original ghost telemetry schema','src/game/GhostReplaySystem.js')]:
 add(i,'Unknown','research_boundary',source,'scope limitation discussed in main report',topic+' remains unresolved by inspected primary evidence.','The cited artifact is the boundary/lead, not proof of the missing original implementation.')
for i,title,basis in [('R1','Downhill-aware camera','G01/P01; original camera unknown'),('R2','Chunked terrain visual/collision separation','AS-G01/AS-G02; CPU implementation unknown'),('R3','Vehicle handling harness','G01/G05; HCR2 physics integration unknown'),('R4','Authoritative race state and presentation separation','G06/G08; actual HCR2 timing unknown'),('R5','Reusable editor compilation','G07'),('R6','Event-driven equipment and feedback','G02/G03/G04'),('R7','Cosmetic pose replay','G08/P04; original replay schema unknown')]:
 rows.append(dict(claim_id=i,confidence='Proposal',provenance='independent_Rider_design',artifact_path='',locator='Main report section '+i,sha256='',architecture='',binary_identity='',address_basis='',finding=title+'; motivation '+basis,remaining_limitation='Rider source/version unavailable; validate independently; not a claim about HCR2 implementation.'))
external=[
 ('EXT-01','https://defold.com/manuals/camera/','Defold camera manual','Orthographic and perspective camera options are documented.'),
 ('EXT-02','https://defold.com/manuals/mesh/','Defold mesh manual','Runtime vertex buffers, vertex spaces and mesh bounds metadata are documented.'),
 ('EXT-03','https://defold.com/manuals/render/','Defold render manual','Batching depends on texture, material, constants and ordering; culling is configurable.'),
 ('EXT-04','https://defold.com/manuals/physics/','Defold physics manual','Physics backend choice and fixed-step interaction are documented; match installed version.'),
 ('EXT-05','https://defold.com/manuals/physics-joints/','Defold joints manual','Programmatic wheel and other joint categories are documented.'),
 ('EXT-06','https://defold.com/manuals/application-lifecycle/','Lifecycle manual; versions from1.12.0','Callback stages are documented; object ordering is unspecified.'),
 ('EXT-07','https://defold.com/examples/physics/interpolation/','Official interpolation example','The example separates physics transforms and interpolated visual transforms.'),
 ('EXT-08','https://box2d.org/documentation/md_simulation.html','Current upstream Box2D simulation documentation','Current generic friction mixing is described using geometric mean; no HCR2 version attribution.')]
for i,url,loc,finding in external:
 rows.append(dict(claim_id=i,confidence='Confirmed',provenance='external_authoritative_documentation',artifact_path='',locator=loc+'; accessed2026-10-24',sha256='',architecture='',binary_identity='',address_basis='',finding=finding,remaining_limitation='Explains technology only; not proof of HCR2 use or Rider installed configuration.',source_url=url))
for r in rows:r.setdefault('source_url','')
with (D/'evidence_register.csv').open('w',encoding='utf-8',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
# Compact evidence index: one claim, all evidence paths, no repeated full claims.
index=[]
for i in dict.fromkeys(r['claim_id'] for r in rows):
 group=[r for r in rows if r['claim_id']==i];r=group[0]
 index.append(f'<a id="claim-{i.lower()}"></a>\n\n**{i} — {r["confidence"]}.**')
 seen_paths=set()
 for z in group:
  if z['artifact_path'] in seen_paths and z['artifact_path']:continue
  seen_paths.add(z['artifact_path'])
  if z['artifact_path']:
   index.append(f'- [{z["artifact_path"]}](../{z["artifact_path"]}) — {z["locator"]}.')
  elif z.get('source_url'):index.append(f'- [{z["locator"]}]({z["source_url"]}) — external technology reference only.')
  else:index.append('- Independent proposal; see corresponding Rider section.')
 index.append('')
front=(D/'main_front.md').read_text()
native=(D/'native_findings.md').read_text().split('## Corrected accounting context')[0]
native=native.replace('# Native engine and game research: verified evidence','<a id="architecture"></a>\n## Technical architecture and native evidence')
native+='''\n### Languages, boundaries and conditional static recovery\n\n**Confirmed:** original ELF symbols include C++-mangled NDK/libc++ material (for example symbol 429, `_ZNSt6__ndk16localeC2ERKS0_RKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEi`). [N10](#claim-n10). Java/Smali establishes the Android host; GLSL assets establish shipped shader code. This does not identify every hidden native subsystem's original language.\n\nThe following diagram summarizes inspected interfaces, not a recovered scene/game-loop implementation:\n\n```mermaid\nflowchart TD\n  Manifest[Android manifest] --> App[MultiDexApplication / AppActivity]\n  App --> GL[Cocos2dxGLSurfaceView / Renderer]\n  App --> Services[Account, analytics, billing, asset delivery]\n  GL --> JNI[Named Cocos JNI exports]\n  Controls[Touch / controller / keyboard] --> JNI\n  JNI -. unresolved native body .-> Game[Game update and scene code]\n  Assets[Original shaders / CSB / models / media] -. runtime producers unresolved .-> Game\n```\n\n**Supported inference, explicitly conditional:** a separately retained ARM64 Fingersoft helper-stage ELF applies a source-bound ChaCha8 transformation to201,440bytes at ELF VA `0x66fd80` plus 455 metadata bytes. The selected conditional key byte `0x46` is supported by independent code/FDE validation, not observed process state. Raw SHA256 `f9b4ee1664ec8b681da145d97dcbfbeefe6dd8c6a78d1543f22d25933e62c803` and derived SHA256 `815c8c438462532191950c7c9bb8d2c6941dc39abf27beffd3be41bdfaeffd49` must remain distinct. The file is not a captured runtime image and does not apply every initializer/GOT/state write. Its 131 unwind-derived exports do not resolve the game physics, camera or terrain producers. [N11](#claim-n11), [targeted run](../decompiled/codex_verified/native_derived/arm64-v8a/libfingersoft_hcr2.so/helper_stage/analysis/run.json).\n\n'''
android=(D/'android_findings.md').read_text().replace('# Android platform and engine boundary findings','<a id="android"></a>\n## Android startup, lifecycle, input and services')
android=android.replace('All findings below are static.','All findings below are **Confirmed static path/configuration facts** within their stated scope; AND-023 is an **Unknown** feature conclusion supported only by a bounded negative search. No SDK capability is promoted to observed execution.')
# Convert absolute links with :line suffix into portable links with line in label.
def convert(m):
 label,path,line=m.group(1),m.group(2),m.group(3)
 return '['+label+((' (line '+line+')') if line else '')+'](../'+path+')'
android=re.sub(r'\[([^\]]+)\]\(/workspace/HC2/([^):]+)(?::(\d+))?\)',convert,android)
# Normalize links authored from an appendix location; source docs already use ../ for main parts.
native=native.replace('(evidence/','(evidence/')
# Overall links in original excerpts to raw ledgers are valid in research/.
parts=[front,native,android,(D/'main_graphics.md').read_text(),(D/'main_gameplay.md').read_text(),(D/'main_recommendations.md').read_text(),(D/'main_tail.md').read_text().replace('@@EVIDENCE_INDEX@@','\n'.join(index))]
text='\n\n'.join(parts)
# Avoid dense inherited summary typography without altering paths, identifiers, addresses or code.
replacements={'58independent':'58 independent','35splits':'35 splits','98,729belongs':'98,729 belongs','320,486metadata':'320,486 metadata','69,624Ghidra':'69,624 Ghidra','5.10%of':'5.10% of','9,753thunks':'9,753 thunks','19,373partial':'19,373 partial','3,929halt':'3,929 halt','131unwind':'131 unwind','1,908assets':'1,908 assets','twoNoneparents':'two None parents','twoTrackleaves':'two Track leaves','theJSON':'the JSON','191RUBE':'191 RUBE','1,717and':'1,717 and','63complete':'63 complete','42unsupported':'42 unsupported','36fully':'36 fully','30/60Hz':'30/60 Hz','30/60/120Hzand':'30/60/120 Hz and','2Dvisual':'2D visual','2Ddirection':'2D direction','2Dstyle':'2D style','2Dfeedback':'2D feedback','full3D':'full 3D','3Dgeometry':'3D geometry','3Dsimulated':'3D simulated','3Dphysics':'3D physics','2Dphysics':'2D physics','3Dvisuals':'3D visuals','2Dparallax':'2D parallax','30/60Hzsampling':'30/60 Hz sampling','R1–R4and':'R1–R4 and','one Trackleaf':'one Track leaf','A Trackleaf':'A Track leaf','all1,988runtime':'all 1,988 runtime','279typed':'279 typed','24October2026':'24 October 2026','from1.12.0':'from 1.12.0','identified1.14.0Stable':'identified 1.14.0 Stable','compatible1.53creader':'compatible 1.53c reader','supplied1.53eeditor':'supplied 1.53e editor','Effekseer1.53creader':'Effekseer 1.53c reader','and455metadata':'and 455 metadata','131unwind-derived':'131 unwind-derived','to201,440bytes':'to 201,440 bytes','all1,988':'all 1,988','C++-mangled NDK':'C++-mangled NDK'}
for a,b in replacements.items():text=text.replace(a,b)
(D/'HCR2_Technical_Reference_for_Rider.md').write_text(text,encoding='utf-8')
(D/'citation_manifest.json').write_text(json.dumps({'claim_count':len(set(r['claim_id'] for r in rows)),'evidence_rows':len(rows),'local_artifacts':list({r['artifact_path'] for r in rows if r['artifact_path']}),'hashes_checked':len([r for r in rows if r['sha256']]),'no_target_execution':True},indent=2)+'\n')
print(json.dumps({'claims':len(set(r['claim_id'] for r in rows)),'rows':len(rows),'words':len(text.split()),'bytes':len(text.encode())}))
