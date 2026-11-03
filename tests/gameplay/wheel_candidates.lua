-- #114 stage 1: the debug-only wheel candidates through the real feel.lua loader (preset files from disk).
-- A release engine refuses them like an unknown key; a debug engine applies A's values plus the candidate geometry.
local debug=false
sys={get_engine_info=function() return {is_debug=debug} end,
    load_resource=function(path)
        local f=io.open("."..path,"rb");if not f then return nil end
        local text=f:read("*a");f:close();return text
    end}
-- The preset files are flat JSON objects (no arrays): turn them into a Lua table constructor.
json={decode=function(text)
    local chunk=assert(loadstring("return "..text:gsub('"([%w_]+)"%s*:','["%1"]=')))
    return chunk()
end}
local feel=require "main.game.feel"
local function same(a,b) return math.abs(a-b)<1e-12 end
local a={}
for _,k in ipairs(feel.preset_keys) do a[k]=feel.values[k] end
local function default_geometry()
    local v=feel.values
    assert(v.wheel_y==-30 and v.wheel_radius==22 and v.wheel_radius_m==.22 and v.wheel_factory=="#wheel" and v.wheel_art_scale==1)
    assert(feel.follow.rest==46)
end
-- Load time: A with the shipped wheel. The P cycle and chips are unchanged.
default_geometry()
assert(table.concat(feel.order,",")=="a,b,c,d,e,f" and feel.next("f")=="a")
for _,k in ipairs(feel.debug_order) do assert(feel.index(k)==nil and feel.is_candidate(k)) end
-- Release engine: a candidate is an invalid request that falls back to A (geometry included).
for _,k in ipairs({"w26","w30"}) do
    local key,valid,refused=feel.preset(k)
    assert(key=="a" and valid==false and refused==nil,k)
    default_geometry()
end
-- Debug engine: A's tuning, the candidate's wheel.
debug=true
for _,c in ipairs({{"w26",26,-35,55},{"w30",30,-41,65}}) do
    local key,valid=feel.preset(c[1])
    assert(key==c[1] and valid==true,c[1])
    for _,k in ipairs(feel.preset_keys) do assert(feel.values[k]==a[k],k) end
    local v=feel.values
    assert(v.wheel_radius==c[2] and same(v.wheel_radius_m,c[2]*.01) and v.wheel_y==c[3] and v.wheel_factory=="#wheel"..c[2],c[1])
    assert(same(v.wheel_art_scale,c[2]/22) and feel.follow.rest==c[4],c[1])
    assert(not feel.same_geometry(c[1],"a") and feel.same_geometry(c[1],c[1]),c[1])
    -- P from a candidate would leave its wheels behind: the controller refuses that switch (same_geometry).
    assert(feel.next(c[1])=="a")
end
-- Back to A (and B-F) restores the shipped geometry exactly; A-F share it.
for _,k in ipairs(feel.order) do
    assert(feel.preset(k)==k);default_geometry()
    assert(feel.same_geometry(k,"a"))
end
-- Unknown keys still fall back to A in a debug engine.
local key,valid=feel.preset("w99");assert(key=="a" and valid==false);default_geometry()
print("PASS #114 wheel candidates: debug-only, A values plus authored wheel geometry; release falls back to A; A-F geometry unchanged")
