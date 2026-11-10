-- #672: coin paths lay ordinary coins along an editable curve; the runtime sees only the coins.
local J=require 'tests.gameplay.lib.json'
local function enc(v)
    if type(v)=='string' then return string.format('%q',v) end
    if type(v)~='table' then return tostring(v) end
    if #v>0 or next(v)==nil then local o={};for i,x in ipairs(v) do o[i]=enc(x) end;return '['..table.concat(o,',')..']' end
    local keys={};for k in pairs(v) do keys[#keys+1]=k end;table.sort(keys,function(a,b) return tostring(a)<tostring(b) end)
    local o={};for i,k in ipairs(keys) do o[i]=string.format('%q',tostring(k))..':'..enc(v[k]) end
    return '{'..table.concat(o,',')..'}'
end
json={decode=J.decode,encode=enc}
sys=sys or {get_config_number=function(_,d) return d end,get_engine_info=function() return {is_debug=false} end,get_config_int=function(_,d) return d end,get_config_string=function(_,d) return d end}
html5=nil
local D=require 'main.editor.editor_doc'
local C=require 'main.editor.editor_coin_path'
local data=require 'main.game.station_data'
local function new_id(e) local id='o'..e.next_id;e.next_id=e.next_id+1;return id end
local function base()
    local d=D.blank('coins','Coins');d.editor.objects[1]={id='o1',type='line',points={{-5,0},{30,0}}};d.editor.next_id=2
    return d
end
local function coins(e,path) local n=0;for _,o in ipairs(e.objects) do if o.type=='coin' and (path==nil or o.path==path) then n=n+1 end end;return n end
-- The curve passes every control point; spacing sets an even spread including both ends.
local arc={{0,1},{5,4},{10,1}}
local cv=C.curve(arc);assert(cv[1][1]==0 and cv[#cv][1]==10 and math.abs(cv[1+C.STEPS][2]-4)<1e-9,'passes control points')
local pos=C.positions({points={{0,0},{10,0}},spacing=2});assert(#pos==6 and math.abs(pos[6][1]-10)<1e-9,'straight spread')
-- Old levels: no block, version unchanged, coins validate.
local old=base();assert(D.validate(old));assert(old.editor.editor_version==13)
-- Add a path over a jump: members are ordinary coins, version 17, compiles to plain coin items.
local d=base();local e=d.editor
local p=assert(C.add(e,arc,1.5,new_id,D.pickup_id,128));D.refresh_version(e)
assert(e.editor_version==17 and D.validate(d),'path doc validates')
local n=coins(e,p.id);assert(n>=7,'members laid: '..n)
local out=assert(D.compile(d));assert(#out.coins.items==n and out.schema==2)
for _,it in ipairs(out.coins.items) do assert(it.path==nil and it.kind==nil) end
assert(data.validate(J.decode(enc(out))),'compiled station validates')
-- Round trip through JSON keeps the path editable.
local back=assert(D.open_level(J.decode(enc(out))));assert(back.editor.coin_paths.items[1].id==p.id and back.editor.editor_version==17)
-- Edit: move the middle point and widen spacing; members are replaced, not duplicated.
assert(C.set(e,p.id,{{0,1},{5,8},{10,1}},3,new_id,D.pickup_id,128));assert(D.validate(d))
local m=coins(e,p.id);assert(m<n and coins(e)==m,'replaced members')
-- Coin limit: refused with a reason, nothing laid.
local before=coins(e);local ok,err=C.set(e,p.id,nil,.75,new_id,D.pickup_id,10);assert(not ok and err:find('only'),'limit refused')
-- (a refused set inside editor.commit is rolled back by the commit; here the block stays as it was)
assert(coins(e)==before)
-- A pasted member is a free coin.
local E=require 'main.editor.editor_edit'
local member;for _,o in ipairs(e.objects) do if o.path then member=o.id end end
local ids=E.paste(e,E.copy(e,{member}),{1,0});for _,o in ipairs(e.objects) do if o.id==ids[1] then assert(o.path==nil) end end
assert(D.validate(d))
-- Dangling references and future fields are refused.
local bad=D.copy(d);bad.editor.objects[#bad.editor.objects].path='p9';assert(not D.validate(bad))
bad=D.copy(d);bad.editor.coin_paths.items[1].colour='red';local _,_,future=D.validate(bad);assert(future)
bad=D.copy(d);bad.editor.editor_version,bad.editor.compiler_version=16,16;assert(not D.validate(bad),'needs 17')
-- Remove: the block and members go, the version falls back.
assert(C.remove(e,p.id));D.refresh_version(e);assert(e.coin_paths==nil and e.editor_version==13 and coins(e,p.id)==0 and D.validate(d))
print('PASS coin paths')
