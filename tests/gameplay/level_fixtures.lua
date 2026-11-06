-- #387: every level JSON in the repository keeps its import outcome. Built-in stations go through the
-- resource path (stations.resource: decode, built-in road profile, station_data.validate) and every
-- file through the import path (custom.parse). Files: main/game/stations/*.json (official courses
-- included) and every other tracked *.json with "units": Gym samples, terrain_compare courses, the
-- archived terrain level fixtures (under tests/gameplay/level-fixtures/) and other test fixtures. Decoding uses the Defold json.decode shapes (tests/gameplay/lib/json.lua).
local J=require 'tests.gameplay.lib.json'
json={decode=J.decode}
sys={get_save_file=function(app,name) return app..'/'..name end,get_engine_info=function() return {is_debug=true} end,
    load=function() return {} end,save=function() error('this suite never saves') end}
html5=nil
-- Loaded by the game before any import: it provides the editor-source check for 3D look levels.
require 'main.editor.editor_doc'
local data=require 'main.game.station_data'
local custom=require 'main.game.custom'
local budget=require 'main.game.terrain_budget'
local profile=require 'main.terrain_perspective.profile'
local catalog=require 'main.game.course_catalog'

-- Deliberately invalid fixtures and their messages; every other file must load.
local REJECTED={
    ['main/game/stations/invalid-test.json']='Unsupported station schema/units',
    ['main/gym/samples/invalid-bounds.json']='Invalid safety bounds',
}
local pipe=assert(io.popen("git ls-files -z -- '*.json'"))
local listing=pipe:read('*a');pipe:close()
local files,groups={},{}
for path in listing:gmatch('[^%z]+') do
    local file=assert(io.open(path,'rb'));local text=file:read('*a');file:close()
    local station=path:match('^main/game/stations/[^/]+%.json$')~=nil
    if station or text:find('"units"%s*:%s*"metres"') then
        files[#files+1]={path=path,text=text,station=station}
        local group=path:match('^(.*)/');groups[group]=(groups[group] or 0)+1
    end
end
-- Fail closed on a short discovery (no git, a moved directory): the groups and sizes at #387.
for group,least in pairs({['main/game/stations']=18,['main/gym/samples']=5,['main/terrain_compare/courses']=3,
    ['tests/gameplay/fuel-fixtures']=6,['tests/objects/fixtures']=7,['tests/gameplay/level-fixtures/terrain-p0']=7,['tests/gameplay/level-fixtures/terrain-p5']=2,
    ['tests/gameplay/level-fixtures/terrain-292']=2,['tests/gameplay/level-fixtures/terrain-278']=1,['tools/gym']=1}) do
    assert((groups[group] or 0)>=least,group..': '..tostring(groups[group])..' level files found, expected at least '..least)
end
for path in pairs(REJECTED) do local found;for _,f in ipairs(files) do found=found or f.path==path end;assert(found,'missing '..path) end

local function count(t) local n=0;for _ in ipairs(t) do n=n+1 end;return n end
-- What the level builds (ipairs) is the whole list and the budget counts exactly that (#387 hulls/labels, #388 pickups).
local function consistent(d,path)
    local hulls,labels=d.hulls or {},d.labels or {}
    assert(count(hulls)==#hulls and count(labels)==#labels,path..': hulls or labels are not whole lists')
    local vertices=0
    for i,h in ipairs(hulls) do assert(count(h.vertices)==#h.vertices,path..': hull '..i..' vertices are not a whole list');vertices=vertices+#h.vertices end
    local r=budget.measure(d)
    assert(r.hull_vertices==vertices,path..': the budget counts '..r.hull_vertices..' hull vertices, the level builds '..vertices)
    -- #388: coin, gem and canister pickups are one whole list, and the budget counts each of them once.
    local pickups=d.coins and d.coins.items or {}
    assert(count(pickups)==#pickups,path..': coin pickups are not a whole list')
    local coins=d.coins;d.coins=nil;local without=budget.measure(d).sprites;d.coins=coins
    assert(r.sprites-without==count(pickups),path..': the budget counts '..(r.sprites-without)..' pickups, the level builds '..count(pickups))
end
local loaded,refused,stations=0,0,0
for _,f in ipairs(files) do
    local expected=REJECTED[f.path]
    if f.station then
        -- stations.resource / stations.load
        local d=J.decode(f.text);d._road_profile=profile.ID
        local ok,err=data.validate(d)
        if expected then assert(not ok and err==expected,f.path..': resource must be refused with "'..expected..'", got '..tostring(err))
        else assert(ok,f.path..': resource must load, got '..tostring(err));consistent(ok,f.path);stations=stations+1 end
    end
    -- custom.parse: page import, editor import, My levels and the saved custom level
    local d,err=custom.parse(f.text)
    local raw=J.decode(f.text)
    if not expected and type(raw)=='table' and raw.kind then expected='Custom levels cannot use station kind "'..raw.kind..'"' end
    if expected then
        assert(not d and err==expected,f.path..': import must be refused with "'..expected..'", got '..tostring(err));refused=refused+1
    else
        assert(d,f.path..': import must load, got '..tostring(err));consistent(d,f.path);loaded=loaded+1
    end
end
for _,id in ipairs(catalog.ids) do
    local found;for _,f in ipairs(files) do found=found or f.path=='main/game/stations/'..id..'.json' end
    assert(found,'official course '..id..' has no station file')
end
print(('PASS %d level files keep their outcome: %d built-in stations load, %d imports load, %d refused as before (kinds and invalid fixtures)')
    :format(#files,stations,loaded,refused))
