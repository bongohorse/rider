-- #272: supplementary pure-Lua CPU observation, run with verified Bob's LuaJIT -joff.
-- This is native interpreter CPU, not HTML5 engine/frame timing. No physics/engine calls.
local doc=require 'main.gym.editor_doc'
local sample=require 'main.gym.editor_sample'
local function measure(fn)
    local times={}
    for i=1,31 do local at=os.clock();fn();times[i]=(os.clock()-at)*1000 end
    table.sort(times)
    return string.format('{"n":31,"p50":%.6f,"p95":%.6f,"max":%.6f}',times[16],times[30],times[31])
end
print('{"runtime":"verified Bob LuaJIT, JIT disabled; native CPU ms, not HTML5","results":[')
for i,id in ipairs({'six-anchor','long-curves','mixed'}) do
    local source=dofile(arg[1]..'/'..id..'-source.lua')
    assert(doc.validate(source))
    local function sampled()
        local n=0
        for _,o in ipairs(source.editor.objects) do if o.type=='curve' then n=n+#assert(sample.curve(o.anchors))-1 end end
        return n
    end
    local segments=sampled()
    local cold=measure(sampled)
    for _,o in ipairs(source.editor.objects) do doc.path(o) end
    local cached=measure(function() for _,o in ipairs(source.editor.objects) do doc.path(o) end end)
    local compile=measure(function() local d=assert(doc.compile(doc.copy(source)));assert(#d.chains[1]-1==segments) end)
    assert(doc.compile(source))
    local warm=measure(function() assert(doc.compile(source)) end)
    print(string.format('%s{"id":"%s","segments":%d,"sampling_ms":%s,"cached_paths_ms":%s,"cold_compile_ms":%s,"warm_compile_ms":%s}',i>1 and ',' or '',id,segments,cold,cached,compile,warm))
end
print(']}')
