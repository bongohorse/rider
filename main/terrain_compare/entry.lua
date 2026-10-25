-- Separate-build entry only: immutable P0 fixtures and ordinary validated START variants.
local custom=require "main.gym.custom"
local M={}
function M.enabled() return sys.get_config_int("rider.terrain_compare",0)==1 end
function M.options()
    local q={}
    if html5 then q=json.decode(html5.run("JSON.stringify(Object.fromEntries(new URLSearchParams(location.search)))")) end
    local course=({["six-anchor"]=true,["long-curves"]=true,mixed=true})[q.course] and q.course or "long-curves"
    local variant=({flat=true,depth=true,sprites=true})[q.look] and q.look or "depth"
    local view=({start=true,tight=true,crest=true,descent=true,jump=true,reverse=true})[q.view] and q.view or "start"
    if course=="six-anchor" then view="start" end
    local intervals=tonumber(q.chunk);if intervals~=32 and intervals~=64 and intervals~=128 then intervals=64 end
    return {course=course,variant=variant,view=view,intervals=intervals}
end
function M.initial(self)
    if not M.enabled() then return false end
    local o=M.options()
    local text=assert(sys.load_resource("/main/terrain_compare/courses/"..o.course..".json"))
    local d,err=custom.parse(text);assert(d,err)
    local views={tight={{192,0.9},5},crest={{236,22.9},0},descent={{244,18.9},5},jump={{282,0.9},7},reverse={{12,0.9},0}}
    local v=views[o.view]
    if v then d.spawn,d.start_speed=v[1],v[2];d.editor.start={position=v[1],speed=v[2]} end
    text=json.encode(d,{encode_empty_table_as_object=false})
    assert(custom.parse(text)) -- same original guard, including START and the 800-object estimate
    self.station,self.speed,self.snapshot="custom",d.start_speed,custom.freeze(d,text)
    self.note="Terrain comparison: "..o.variant
    if html5 then html5.run(assert(sys.load_resource("/main/terrain_compare/compare.js"))) end
    return true
end
return M
