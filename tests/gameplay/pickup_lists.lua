-- #388: coin, gem and fuel-canister pickups (coins.items) must be a dense JSON list, and coins must be an
-- object, before a level is admitted. A null member ends ipairs early, so the pickups after it would be
-- neither validated nor built while the budget still counts #items; a scalar coins used to throw inside
-- station_data.validate instead of returning a rejection. Cases go through the import path (custom.parse:
-- JSON text -> json.decode -> station_data.validate) with a decoder that gives the Defold json.decode
-- shapes (tests/gameplay/lib/json.lua); the real engine import is the le1a Gym case.
local J=require 'tests.gameplay.lib.json'
json={decode=J.decode}
sys={get_save_file=function(app,name) return app..'/'..name end,get_engine_info=function() return {is_debug=true} end,
    load=function() return {} end,save=function() error('this suite never saves') end}
html5=nil
local data=require 'main.game.station_data'
local custom=require 'main.game.custom'
local coin_data=require 'main.game.coin_data'
local budget=require 'main.game.terrain_budget'

local FUEL='{"version":1,"enabled":true,"start":60,"time":1,"drive":2,"warning":20,"refill":35}'
local COIN='{"id":"coin-a","position":[5,1.5]}'
local COIN2='{"id":"coin-b","position":[10,1.5]}'
local GEM='{"id":"gem-a","kind":"gem","position":[15,2]}'
local CAN='{"id":"fuel-a","kind":"fuel","position":[20,2]}'
local CAN2='{"id":"fuel-b","kind":"fuel","position":[25,2]}'
-- Invalid on its own: a position that is not two numbers.
local BAD='{"id":"fuel-bad","kind":"fuel","position":[30,"x"]}'
-- A small schema-4 level (fuel settings, so every pickup kind is allowed) with replaceable coins and fuel.
local function level(coins,fuel,schema)
    return '{"schema":'..(schema or 4)..',"id":"pickup-lists","name":"Pickup lists","units":"metres","spawn":[0,1.7],'
        ..'"start_speed":7,"run_in":8,"run_out":20,"bounds":[-8,68,-6,20],"chains":[[[70,0.8],[-10,0.8]]]'
        ..(fuel and ',"fuel":'..fuel or '')..(coins and ',"coins":'..coins or '')..'}'
end
local function items(list,version) return '{"version":'..(version or 3)..',"items":'..list..'}' end
-- custom.parse must answer, never throw (the import panel shows its reason).
local function parse(text,label)
    local ok,d,err,unsupported=pcall(custom.parse,text)
    assert(ok,label..': the import threw instead of refusing: '..tostring(d))
    return d,err,unsupported
end
local function count(t) local n=0;for _ in ipairs(t) do n=n+1 end;return n end
-- Admitted: the list ipairs walks is the whole list, and counts and budget see exactly those pickups.
local function admitted(text,gold,gems,cans,label)
    local d,err=parse(text,label)
    assert(d,label..': must be admitted, got '..tostring(err))
    local list=d.coins and d.coins.items or {}
    local fuel=0;for _,p in ipairs(list) do if p.kind=='fuel' then fuel=fuel+1 end end
    local g,m=coin_data.counts(list)
    assert(count(list)==#list and #list==gold+gems+cans,label..': admitted '..count(list)..' of '..#list..' pickups')
    assert(g==gold and m==gems and fuel==cans,label..': counted '..g..' gold, '..m..' gems, '..fuel..' canisters')
    local sprites=budget.measure(d).sprites;local coins=d.coins;d.coins=nil
    assert(sprites-budget.measure(d).sprites==#list,label..': the budget counts other pickups than the level builds')
    d.coins=coins
    return d
end
local function refused(text,expected,label)
    local d,err=parse(text,label)
    assert(d==nil and err==expected,label..': must be refused with "'..expected..'", got '..(d and 'an admitted level' or '"'..tostring(err)..'"'))
    assert(#err<=80,label..': message longer than 80 bytes')
end

-- 1. Valid pickups are unchanged: dense lists of every kind, empty arrays and objects ({} and [] decode
-- alike), a trailing null (the shorter list, nothing after it to lose) and the 128-pickup maximum.
admitted(level(items('['..COIN..','..COIN2..','..GEM..','..CAN..','..CAN2..']'),FUEL),2,1,2,'dense coins, gem and canisters')
admitted(level(items('[]'),FUEL),0,0,0,'empty array')
admitted(level(items('[{"id":"coin-a","position":[5,1.5],"indicator":false},'..CAN..']',4),FUEL),1,0,1,'version 4 with a hidden indicator')
admitted(level(items('{}'),FUEL),0,0,0,'empty object')
admitted(level(nil,FUEL),0,0,0,'no coins')
admitted(level(items('['..COIN..','..GEM..',null]'),FUEL),1,1,0,'trailing null')
local many={};for i=1,coin_data.MAX+1 do many[i]='{"id":"coin-'..i..'","position":['..(i%60)..',1.5]}' end
admitted(level(items('['..table.concat(many,',',1,coin_data.MAX)..']'),FUEL),coin_data.MAX,0,0,'128 pickups')
refused(level(items('['..table.concat(many,',')..']'),FUEL),'Combined coin pickup limit is 128','129 pickups')
for _,path in ipairs({'main/game/stations/first-run.json','main/game/stations/rolling-hills.json'}) do
    local file=assert(io.open(path,'rb'));local text=file:read('*a');file:close()
    local raw=J.decode(text);local g,m=coin_data.counts(raw.coins.items)
    local cans=0;for _,p in ipairs(raw.coins.items) do if p.kind=='fuel' then cans=cans+1 end end
    admitted(text,g,m,cans,path)
end
print('PASS dense, empty and trailing-null pickup lists up to 128 are admitted and counted as built')

-- 2. Malformed pickup lists are refused before import with the field, the cause and a bad key or the gap.
for _,c in ipairs({
    -- Issue literal: a JSON null hole followed by a valid and an invalid pickup.
    {'hole before a valid and an invalid pickup','['..COIN..','..COIN2..',null,'..GEM..','..BAD..']','Invalid pickups: coins.items has a gap at entry 3'},
    {'list starting with null','[null,'..COIN..']','Invalid pickups: coins.items has a gap at entry 1'},
    {'gem after a hole','['..COIN..',null,'..GEM..']','Invalid pickups: coins.items has a gap at entry 2'},
    {'fuel canister after a hole','['..CAN..',null,'..CAN2..']','Invalid pickups: coins.items has a gap at entry 2'},
    {'object-shaped items','{"1":'..COIN..'}','Invalid pickups: coins.items is not a list (key "1")'},
    {'object-shaped items, name key','{"gem":'..GEM..'}','Invalid pickups: coins.items is not a list (key "gem")'},
    {'number items','42','Invalid pickups: coins.items is not a list'},
    {'string items','"coin-a"','Invalid pickups: coins.items is not a list'},
    -- A key from the file is cut so the message stays one short line (coin_data.CAUSE bytes of cause).
    {'long key','{"'..string.rep('k',200)..'":'..COIN..'}','Invalid pickups: coins.items is not a list (key "'..string.rep('k',17)..'...'},
}) do refused(level(items(c[2]),FUEL),c[3],c[1]) end
refused(level('{"version":3}',FUEL),'Invalid pickups: coins.items is not a list','missing items')
print('PASS sparse, object-shaped and non-list coin, gem and canister lists are refused with a short cause')

-- 3. A scalar coins is refused with a normal validation error (it used to throw on coins.version), with
-- and without fuel settings and for every schema that allows coins. Schema 1 keeps its schema message.
for _,value in ipairs({'42','true','false','"bad"','0','""'}) do
    for _,fuel in ipairs({FUEL,false}) do
        for _,schema in ipairs({2,3,4,5}) do
            refused(level(value,fuel or nil,schema),'Invalid coins: coins is not an object','coins '..value..' schema '..schema..(fuel and ' with fuel' or ''))
        end
    end
    refused(level(value,nil,1),'Ordinary coins require station schema 2','coins '..value..' schema 1')
end
-- A scalar fuel was already refused without throwing; it keeps its message.
for _,value in ipairs({'42','true','"bad"'}) do
    refused(level(items('['..COIN..']',1),value),'Unsupported fuel version','fuel '..value)
end
print('PASS a number, boolean or string coins is refused without throwing; scalar fuel keeps its message')

-- 4. Shapes JSON cannot write but a Lua caller can: a string key next to a numeric entry, a fractional or zero key.
local base=assert(custom.parse(level(items('['..COIN..','..GEM..']'),FUEL)))
local coin,gem=base.coins.items[1],base.coins.items[2]
for _,c in ipairs({
    {{coin,['2']=gem},'Invalid pickups: coins.items is not a list (key "2")'},
    {{coin,x=gem},'Invalid pickups: coins.items is not a list (key "x")'},
    {{coin,[2.5]=gem},'Invalid pickups: coins.items is not a list (key 2.5)'},
    {{[0]=coin,gem},'Invalid pickups: coins.items is not a list (key 0)'},
    {{coin,nil,gem},'Invalid pickups: coins.items has a gap at entry 2'},
}) do
    local d=J.decode(level(items('[]'),FUEL));d.coins.items=c[1]
    local ok,why=data.validate(d)
    assert(not ok and why==c[2],c[2]..': got '..tostring(why))
end
print('PASS a string, fractional or zero key or a hole next to numeric pickups is refused')

-- 5. Versions, kinds, ids and bounds accept/reject exactly as before (messages and the unsupported flag).
local function outcome(text)
    local d,err,unsupported=parse(text,text)
    return d and 'ok' or err..(unsupported and ' (unsupported)' or '')
end
for _,c in ipairs({
    {level(items('['..COIN..']',1),nil,2),'ok'},
    {level(items('['..COIN..']',1),nil,1),'Ordinary coins require station schema 2 (unsupported)'},
    {level(items('['..GEM..']',2),nil,3),'ok'},
    {level(items('['..GEM..']',2),nil,2),'Wonder Gems require station schema 3 (unsupported)'},
    {level(items('['..GEM..']',1),nil,3),'Unsupported pickup kind/version (unsupported)'},
    {level(items('['..CAN..']',3),FUEL),'ok'},
    {level(items('['..CAN..']',3),nil),'Canisters require fuel settings'},
    {level(items('['..CAN..']',3),FUEL,3),'Fuel requires station schema 4 (unsupported)'},
    {level(items('['..CAN..']',2),FUEL),'Unsupported pickup kind/version (unsupported)'},
    {level(items('['..COIN..']',5),FUEL),'Unsupported coin pickup version (unsupported)'},
    -- #669: indicator=false needs coin version 4; any other value is refused.
    {level(items('[{"id":"coin-a","position":[5,1.5],"indicator":false}]'),FUEL),'Unsupported pickup indicator/version (unsupported)'},
    {level(items('[{"id":"coin-a","position":[5,1.5],"indicator":true}]',4),FUEL),'Unsupported pickup indicator/version (unsupported)'},
    {level('[]',FUEL),'Unsupported coin pickup version (unsupported)'},
    {level('{"version":1,"items":[],"extra":1}',FUEL),'Unsupported coin pickup field extra (unsupported)'},
    {level(items('['..COIN..','..COIN..']'),FUEL),'Invalid/duplicate coin pickup ID or position'},
    {level(items('[{"id":"Coin A","position":[5,1.5]}]'),FUEL),'Invalid/duplicate coin pickup ID or position'},
    {level(items('[{"id":"coin-a","position":[5]}]'),FUEL),'Invalid/duplicate coin pickup ID or position'},
    {level(items('[1]'),FUEL),'Invalid/duplicate coin pickup ID or position'},
    {level(items('[{"id":"coin-a","position":[99,1.5]}]'),FUEL),'Coin coin-a is outside safety bounds'},
    {level(items('[{"id":"fuel-a","kind":"fuel","position":[20,2],"content":0}]'),FUEL),'Canister refill is configured once for the course (unsupported)'},
    {level(items('[{"id":"coin-a","position":[5,1.5],"size":2}]'),FUEL),'Unsupported coin pickup item field size (unsupported)'},
    {level(items('[{"id":"coin-a","kind":"star","position":[5,1.5]}]'),FUEL),'Unsupported pickup kind/version (unsupported)'},
    {level(items('['..COIN..','..BAD..']'),FUEL),'Invalid/duplicate coin pickup ID or position'},
}) do
    local got=outcome(c[1])
    assert(got==c[2],c[1]..': expected "'..c[2]..'", got "'..got..'"')
end
print('PASS coin versions 1/2/3, pickup kinds, ids, positions and bounds keep their outcome and messages')
