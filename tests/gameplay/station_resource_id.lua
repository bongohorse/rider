-- #412: stations.resource() applies the same id check as stations.load(): a built-in resource whose
-- `id` differs from the requested id is rejected, and every shipped station file (Gym stations,
-- official courses, objects-demo and the a15 test fixtures) still loads through resource() under its
-- own id. The real stations.lua, station_data.lua validator and course_catalog.lua run; only the
-- Defold boundary (sys, json) and the gameplay modules resource() does not use are stubbed.
local gym_test,is_debug='',false
local served={} -- resource path -> replacement text (the mismatch fixtures)
local function read(path)
    local f=io.open('.'..path,'rb');if not f then return nil end
    local text=f:read('*a');f:close();return text
end
-- stations.lua builds its tint constants at load time.
vmath={vector4=function(...) return {...} end}
sys={get_config_string=function(key,default) if key=='rider.gym_test' then return gym_test end;return default end,
    get_engine_info=function() return {is_debug=is_debug} end,
    load_resource=function(path) return served[path] or read(path) end}
-- Plain LuaJIT has no Defold json: a strict decoder for the station files (objects, arrays,
-- strings, numbers, booleans; null decodes to nil like Defold's default json.decode).
json={decode=function(text)
    local i=1
    local function ws() i=text:find('[^ \t\r\n]',i) or #text+1 end
    local value
    local function str()
        local out={};i=i+1
        while true do
            local c=text:sub(i,i)
            if c=='' then error('unterminated string') end
            if c=='"' then i=i+1;return table.concat(out) end
            if c=='\\' then
                local e=text:sub(i+1,i+1)
                local map={['"']='"',['\\']='\\',['/']='/',b='\b',f='\f',n='\n',r='\r',t='\t'}
                if map[e] then out[#out+1]=map[e];i=i+2
                elseif e=='u' then
                    local code=assert(tonumber(text:sub(i+2,i+5),16),'bad \\u escape')
                    assert(code<128,'non-ASCII \\u escape not supported by this fixture decoder')
                    out[#out+1]=string.char(code);i=i+6
                else error('bad escape') end
            else out[#out+1]=c;i=i+1 end
        end
    end
    function value()
        ws()
        local c=text:sub(i,i)
        if c=='{' then
            local t={};i=i+1;ws()
            if text:sub(i,i)=='}' then i=i+1;return t end
            while true do
                ws();assert(text:sub(i,i)=='"','object key expected');local k=str()
                ws();assert(text:sub(i,i)==':','colon expected');i=i+1
                t[k]=value();ws()
                local d=text:sub(i,i);i=i+1
                if d=='}' then return t end
                assert(d==',','comma expected')
            end
        elseif c=='[' then
            local t,n={},0;i=i+1;ws()
            if text:sub(i,i)==']' then i=i+1;return t end
            while true do
                n=n+1;t[n]=value();ws()
                local d=text:sub(i,i);i=i+1
                if d==']' then return t end
                assert(d==',','comma expected')
            end
        elseif c=='"' then return str()
        elseif text:sub(i,i+3)=='true' then i=i+4;return true
        elseif text:sub(i,i+4)=='false' then i=i+5;return false
        elseif text:sub(i,i+3)=='null' then i=i+4;return nil end
        local s,e=text:find('^-?%d+%.?%d*[eE]?[-+]?%d*',i)
        assert(s,'value expected at '..i)
        local n=assert(tonumber(text:sub(s,e)),'bad number');i=e+1;return n
    end
    local v=value();ws();assert(i>#text,'trailing data');return v
end}
for _,name in ipairs({'feel','ramp_metrics','gap_metrics','seam_metrics','step_metrics','balance_metrics',
    'bump_metrics','air_metrics','custom'}) do package.loaded['main.game.'..name]={} end
local catalog=require 'main.game.course_catalog'
local function fresh(test,debug_engine)
    gym_test,is_debug=test,debug_engine
    package.loaded['main.game.stations']=nil
    return require 'main.game.stations'
end
local stations=fresh('',false)
local default_ids={}
for _,id in ipairs(stations.ids) do default_ids[#default_ids+1]=id end
local a15=fresh('a15',true)
assert(table.concat(a15.ids,',')=='straight,straight-test,invalid-test','a15 fixture list changed')
-- Every station file on disk is covered: the shipped lists, the official courses, objects-demo and
-- the a15 fixtures. A new file without a matching list entry fails here.
local listed={['objects-demo']=true}
for _,id in ipairs(default_ids) do listed[id]=true end
for _,id in ipairs(catalog.ids) do listed[id]=true end
for _,id in ipairs(a15.ids) do listed[id]=true end
local files={}
local ls=assert(io.popen('ls main/game/stations'))
for name in ls:lines() do local id=name:match('^(.+)%.json$');if id then files[#files+1]=id end end
ls:close()
assert(#files>=18,'station directory listing failed: '..#files)
local loaded,rejected={},{}
for _,id in ipairs(files) do
    assert(listed[id],'station file not in any shipped list: '..id)
    local m=(id=='straight-test' or id=='invalid-test') and a15 or stations
    local d,err=m.resource(id)
    if id=='invalid-test' then
        -- The deliberately invalid a15 fixture stays rejected.
        assert(d==nil and err=='Unreadable station file',id)
        rejected[#rejected+1]=id
    else
        assert(d,id..': '..tostring(err))
        assert(d.id==id,id..' loaded as '..tostring(d.id))
        loaded[#loaded+1]=id
    end
end
-- Off the a15 test, the fixtures stay unknown.
assert(select(2,stations.resource('straight-test'))=='Unknown station')
assert(select(2,stations.resource('nope'))=='Unknown station')
-- A requested id whose resource carries another station's id is rejected by resource(), exactly as
-- load() rejects it. Every requestable id is checked against a donor file with a different id.
local mismatches=0
for _,id in ipairs(loaded) do
    local m=id=='straight-test' and a15 or stations
    local donor=id=='straight' and 'ramps' or 'straight'
    local path='/main/game/stations/'..id..'.json'
    served[path]=assert(read('/main/game/stations/'..donor..'.json'))
    local d,err=m.resource(id)
    assert(d==nil and err=='Station id mismatch',id..': resource() accepted the '..donor..' file ('..tostring(d and d.id)..')')
    local l,lerr=m.load(id)
    assert(l==nil and lerr=='Station id mismatch',id..': load() parity')
    served[path]=nil
    mismatches=mismatches+1
end
-- The served fixture is released: the real file loads again.
assert(stations.resource('straight').id=='straight')
print(string.format('PASS station resource id: %d shipped stations load under their own id (%s), %s rejected; %d mismatched resources rejected by resource() and load()',
    #loaded,table.concat(loaded,','),table.concat(rejected,','),mismatches))
