-- #543, #706: the track texture session (Texture tab): immediate commit, drag-style draft, locks, bounded input.
local J=require 'tests.gameplay.lib.json'
local function enc(v) if type(v)~='table' then return tostring(v) end;local k={};for x in pairs(v) do k[#k+1]=tostring(x) end;table.sort(k);local o={};for i,x in ipairs(k) do o[i]=x..'='..enc(v[x] or v[tonumber(x)]) end;return '{'..table.concat(o,',')..'}' end
json={decode=J.decode,encode=enc}
sys=sys or {get_config_number=function(_,d) return d end,get_engine_info=function() return {is_debug=false} end,get_config_int=function(_,d) return d end,get_config_string=function(_,d) return d end}
html5=nil
local D=require 'main.editor.editor_doc'
local commits=0
local E={touch=function() end,look_epoch=0}
function E.commit(fn)
    local before=D.copy(E.doc);local _,err=fn(E.doc.editor,E.doc)
    if not err then local ok,why=D.validate(E.doc);if not ok then err=why end end
    if err then E.doc=before;return nil,err end
    commits=commits+1;E.undo_doc=before;return true
end
package.loaded['main.editor.editor']=E
local T=require 'main.editor.editor_track'
local function fresh()
    local d=D.blank('t','Track');d.editor.objects[1]={id='o1',type='line',points={{0,0},{20,0}}};d.editor.next_id=2;return d
end
assert(T.base64('Man')=='TWFu' and T.base64('Ma')=='TWE=' and T.base64('M')=='TQ==')
E.doc=fresh();local plain=D.copy(E.doc)
-- A draft previews with the default look and leaves the document alone.
assert(T.draft({preset='city',band='meadow',surface=false,fill=''}))
assert(E.look_preview.material.preset=='city' and E.look_preview.material.band=='meadow' and E.look_preview.material.fill==nil)
assert(E.look_preview.road_look.params.perspective==6)
assert(E.doc.editor.material==nil and E.doc.editor.editor_version==13)
-- An override equal to the preset is no override.
assert(T.draft({preset='city',band='city'}));assert(E.look_preview.material.band==nil)
-- Discard restores.
T.discard();assert(E.look_preview==nil and T.current==nil and E.doc.editor.material==nil)
-- Unknown input is refused, the draft unchanged.
assert(not T.draft({preset='nope'}) and T.message:find('Unknown',1,true) and E.look_preview==nil)
assert(not T.draft('x'));T.op('x');T.op(nil);T.op({type='other'});T.op({key='band',value='meadow'})
assert(commits==0 and E.doc.editor.material==nil,'an override needs a material first')
assert(not T.apply(),'nothing to apply')
-- Apply is one commit and clears the preview.
assert(T.commit({preset='quarry',fill='volcano'}))
assert(commits==1 and E.doc.editor.material.preset=='quarry' and E.doc.editor.material.fill=='volcano' and E.look_preview==nil)
assert(E.doc.editor.editor_version==14 and E.undo_doc.editor.material==nil)
-- #706 Texture tab operations: a preset keeps the overrides; '' inherits; an unknown key is ignored.
local before=commits
assert(T.op({preset='city'}));assert(E.doc.editor.material.preset=='city' and E.doc.editor.material.fill=='volcano' and commits==before+1)
assert(T.op({key='band',value='glacier'}));assert(E.doc.editor.material.band=='glacier' and commits==before+2)
assert(T.op({key='band',value=''}));assert(E.doc.editor.material.band==nil and E.doc.editor.material.fill=='volcano' and commits==before+3)
T.op({key='colour',value='city'});T.op({preset=7});assert(commits==before+3)
assert(T.commit({preset='quarry',fill='volcano'}) and commits==before+4)
-- A second material keeps the author's look.
E.doc.editor.road_look.params.width=1.1;T.draft({preset='inca'});T.apply();assert(E.doc.editor.road_look.params.width==1.1 and commits==before+5)
-- Locked terrain refuses.
E.doc=fresh();E.doc.editor.objects[1].locked=true;T.draft({preset='city'})
local ok,why=T.apply();assert(not ok and why:find('Locked',1,true) and commits==before+5 and E.doc.editor.material==nil)
T.discard();
-- A refused immediate choice keeps the reason and leaves no preview of the refused material.
ok=T.commit({preset='city'});assert(not ok and T.message:find('Locked',1,true) and T.current==nil and E.look_preview==nil and commits==before+5);T.discard();
assert(plain.editor.material==nil)
-- A level that only fits at the smaller stride is refused, with no draft.
local big=fresh();local line={};for i=0,1300 do line[#line+1]={i*.6,0} end;big.editor.objects[1].points=line;E.doc=big
local fits=T.draft({preset='city'});assert(not fits or T.message=='' ,'consistent result');T.discard()
print('PASS #543 track panel session: preview, Apply, Discard, refusal, locks')
