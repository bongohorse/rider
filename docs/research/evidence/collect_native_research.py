#!/usr/bin/env python3
"""Read-only primary ELF evidence collection; writes only research/evidence/."""
import sys,struct,json,hashlib,re,collections
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,'/workspace/HC2/decompiled/codex_verified/scripts')
from native_accounting import ELF
R=Path('/workspace/HC2');O=R/'research/evidence';needles=[b'Box2D',b'box2d',b'b2World',b'b2Body',b'b2WheelJoint',b'b2PolygonShape',b'b2ChainShape',b'b2EdgeShape',b'b2Fixture',b'b2ContactListener'];search=[];symbols=[]
for p in sorted((R/'decompiled/native').glob('*/*.so/*.so')):
 e=ELF(p);sha=hashlib.sha256(e.b).hexdigest();hits=[]
 for needle in needles:
  at=0
  while True:
   at=e.b.find(needle,at)
   if at<0:break
   hits.append(dict(needle=needle.decode(),file_offset=hex(at)));at+=1
 search.append(dict(binary=str(p.relative_to(R)),sha256=sha,byte_count=len(e.b),hits=hits))
 if p.name!='libcocos2dcpp.so':continue
 tags={}
 for ds in e.ph:
  if ds['type']!=2:continue
  for pos in range(ds['offset'],ds['offset']+ds['filesz'],2*e.ptr):
   t,v=struct.unpack_from(e.end+('qQ' if e.ptr==8 else 'iI'),e.b,pos)
   if not t:break
   tags[t]=v
 count=0
 if 4 in tags:count=struct.unpack_from(e.end+'II',e.b,e.off(tags[4]))[1]
 elif 0x6ffffef5 in tags:
  g=e.off(tags[0x6ffffef5]);nb,first,bl,shift=struct.unpack_from(e.end+'IIII',e.b,g);bo=g+16+bl*e.ptr;co=bo+nb*4;count=first
  for b in struct.unpack_from(e.end+str(nb)+'I',e.b,bo):
   if b==0:continue
   i=b
   while True:
    value=struct.unpack_from(e.end+'I',e.b,co+4*(i-first))[0];count=max(count,i+1)
    if value&1:break
    i+=1
    if i>2_000_000:raise ValueError('GNU hash bounds')
 if not count:raise ValueError('no symbol count')
 mapping=R/'decompiled/codex_verified/native'/p.parent.parent.name/p.name/'call_recovery/mapping.jsonl';maps=[]
 if mapping.exists():
  for l in mapping.open():
   x=json.loads(l)
   try:aa=int(x['start'],16);zz=int(x['end_inclusive'],16)+1
   except ValueError:continue
   if x.get('file_offset',-1)>=0:maps.append((x['file_offset'],x['file_offset']+zz-aa,aa))
 rows=[]
 for i in range(count):
  so=e.off(tags[6])+i*tags[11]
  if e.ptr==8:no,info,other,shndx,value,size=struct.unpack_from(e.end+'IBBHQQ',e.b,so)
  else:no,value,size,info,other,shndx=struct.unpack_from(e.end+'IIIBBH',e.b,so)
  if no>=tags[10]:raise ValueError('bad name offset')
  st=e.off(tags[5])+no;name=e.b[st:e.b.index(0,st)].decode('utf-8',errors='strict');off=None;ga=None
  if value and shndx:
   try:off=e.off(value&~1 if p.parent.parent.name=='armeabi-v7a' else value)
   except ValueError:pass
   if off is not None:
    matches={a+off-x for x,z,a in maps if x<=off<z}
    if len(matches)==1:ga=hex(next(iter(matches)))
  rows.append(dict(symbol_index=i,name=name,type=info&15,binding=info>>4,section_index=shndx,defined=shndx!=0,elf_va=hex(value),size=size,file_offset=hex(off) if off is not None else None,ghidra_address=ga,source_sha256=sha,symbol_record_file_offset=hex(so)))
 out=O/(p.parent.parent.name+'_cocos_dynamic_symbols.json');out.write_text(json.dumps(dict(binary=str(p.relative_to(R)),sha256=sha,symbol_count=count,source='Original PT_DYNAMIC symbol/string tables; count from original GNU_HASH or DT_HASH',mapping_evidence=str(mapping.relative_to(R)) if mapping.exists() else None,symbols=rows),indent=2));symbols.extend(dict(x,architecture=p.parent.parent.name,binary=str(p.relative_to(R))) for x in rows)
(O/'box2d_raw_byte_search.json').write_text(json.dumps(dict(needles=[x.decode() for x in needles],binaries=search,scope='All30 original copied native ELF inputs; full raw bytes. Absence is bounded and does not prove a library absent from transformed/hidden code.'),indent=2))
selected=[x for x in symbols if any(k in x['name'] for k in ['Cocos2dxRenderer_native','Cocos2dxActivity_getGLContextAttrs','AppActivity_get','AppActivity_native','b2World','b2Body','b2WheelJoint'])];(O/'selected_native_symbols.json').write_text(json.dumps(selected,indent=2));print('symbols',len(symbols),'selected',len(selected),'Box2D hits',sum(len(x['hits']) for x in search))
