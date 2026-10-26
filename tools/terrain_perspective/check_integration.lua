-- Production profile compatibility and actual compiler/resource admission; no simulation.
local doc=require 'main.gym.editor_doc'
local profile=require 'main.terrain_perspective.profile'
local budget=require 'main.gym.terrain_budget'
local data=require 'main.gym.station_data'
local function same(a,b)
 if type(a)~=type(b) then return false end
 if type(a)~='table' then return a==b end
 for k,v in pairs(a) do if not same(v,b[k]) then return false end end
 for k in pairs(b) do if a[k]==nil then return false end end
 return true
end
assert(not budget.COMPARISON)
local preset=require('main.terrain_perspective.projection').DEFAULT
assert(preset.version==1 and preset.mode=='perspective' and preset.width==.9 and preset.perspective==.35 and preset.angle==math.atan(.55)*180/math.pi and preset.side==64 and preset.shading==1,'Changing perspective-v1 requires a new profile ID')
for _,bad in ipairs({false,true,1,{},'future'}) do
 local valid,why=profile.validate({editor={road_profile=bad}})
 assert(not valid and why:find('Unsupported road profile'))
end
for _,name in ipairs({'six-anchor','long-curves','mixed','long-over-budget'}) do
 local original=dofile(arg[1]..'/'..name..'-source.lua')
 local legacy=assert(doc.compile(original));assert(not profile.enabled(legacy))
 assert(budget.measure(legacy).stride==36)
 local opened=assert(doc.open_level(legacy));assert(not profile.enabled(opened))
 local reopened=assert(doc.compile(opened));assert(same(legacy,reopened),'Changed legacy recompile')
 local copy=doc.template(legacy);assert(not profile.enabled(copy),'Restyled legacy copy')
 original.editor.road_profile=profile.ID
 local projected=assert(doc.compile(original));assert(profile.enabled(projected))
 local r=budget.measure(projected);assert(r.stride==48 and r.payload==r.vertices*48)
 local saved=assert(doc.open_level(projected));assert(profile.enabled(saved))
 assert(same(projected,assert(doc.compile(saved))),'Changed profile on reopen')
 assert(profile.enabled(doc.template(projected)),'Lost profile in copy')
 projected.editor.road_profile=nil;assert(same(projected,legacy),'Changed source/physics outside profile marker')
 print('PASS '..name..': legacy exact reopen/copy; perspective profile retained; collision/source unchanged; 36/48 B budgets')
end
local fresh=doc.blank('new-course','New course');assert(profile.enabled(fresh));assert(doc.validate(fresh))
local unknown=doc.blank('future-course','Future course');unknown.editor.road_profile='perspective-v999'
local ok,err,unsupported=doc.validate(unknown);assert(not ok and unsupported and err:find('Unsupported road profile'))
local builtin={_road_profile=profile.ID};assert(profile.enabled(builtin))
local d=assert(doc.compile(dofile(arg[1]..'/long-over-budget-source.lua')))
d.editor.road_profile='future';ok,err,unsupported=data.validate(d);assert(not ok and unsupported)
-- Same independently valid compiled chain: legacy admission remains; actual profile exceeds payload.
d.editor=nil;d.chains={{}};d.two_sided=nil;d.hulls={};d.labels={};d.finish=nil
for i=0,1521 do d.chains[1][#d.chains[1]+1]={i*.4,0} end
assert(data.validate(d));assert(budget.measure(d).stride==36)
d.editor={road_profile=profile.ID};ok,err=data.validate(d);assert(not ok and err:find('terrain vertex payload bytes at Fit') and err:find('Shorten or simplify'))
assert(budget.preview(24,1521*18+12,0,0))
assert(not budget.preview(24,1521*18+12,0,0,{road_profile=profile.ID}))
print('PASS new default, unsupported-profile refusal and independent legacy/perspective Fit admission')

-- Unknown future profiles participate in the existing alternating-slot protection.
local docs={legacy=assert(doc.compile(dofile(arg[1]..'/six-anchor-source.lua')))}
docs.future=doc.copy(docs.legacy);docs.future.editor.road_profile='future'
local saved={a={format=1,seq=1,text='legacy'},b={format=1,seq=2,text='future'}}
json={decode=function(text) return doc.copy(assert(docs[text])) end}
sys={get_save_file=function(_,n) return n end,load=function(n) return doc.copy(saved[n] or {}) end,save=function(n,t) saved[n]=doc.copy(t) end}
local custom=require 'main.gym.custom'
local parsed,why,unknown=custom.parse('future');assert(not parsed and unknown and why:find('Unsupported road profile'))
local store=custom.slot_store({'a','b'},custom.parse)
assert(store.protected());assert(store.save('legacy'));assert(saved.b.text=='future' and saved.b.seq==2)
saved.a={format=1,seq=3,text='future'}
assert(not store.save('legacy'));assert(saved.a.text=='future' and saved.b.text=='future')
print('PASS future-profile parse propagation and alternating save-slot overwrite protection')
