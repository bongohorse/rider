-- Derive the first short directed course from Rider's accepted P0 six-anchor source.
local doc=require 'main.gym.editor_doc'
local d=dofile(arg[1]);d.id='first-run';d.name='First run'
for _,o in ipairs(d.editor.objects) do
    o.name='Rolling road'
    for _,a in ipairs(o.anchors) do for _,k in ipairs({'p','in','out'}) do a[k][1]=a[k][1]*.5;a[k][2]=a[k][2]*.5 end end
end
-- A short flat run-in/run-out retains the smooth P0 roller shape between 0 and 165 m.
local edit=require 'main.gym.editor_edit'
d.editor.start.position={2,1.7};d.editor.finish.position={160,1.5}
d.editor.road_profile='perspective-v1'
local compiled=assert(doc.compile(d))
-- Small serializer used only by this offline course authoring tool.
local function enc(v)
 if type(v)=='table' then
  local array=#v>0;local t={};if array then for _,x in ipairs(v) do t[#t+1]=enc(x) end else
   local keys={};for k in pairs(v) do keys[#keys+1]=k end;table.sort(keys)
   for _,k in ipairs(keys) do t[#t+1]=string.format('%q',k)..':'..enc(v[k]) end end
  return (array and '[' or '{')..table.concat(t,',')..(array and ']' or '}')
 elseif type(v)=='string' then return string.format('%q',v)
 else return tostring(v) end
end
print(enc(compiled))
