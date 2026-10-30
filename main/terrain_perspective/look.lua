-- Versioned source appearance; one projection space, local cross-section values only.
local projection=require 'main.terrain_perspective.projection'
local M={ID='authored-v1',LOCAL={'width','side','shading'}}
local cache=setmetatable({},{__mode='k'})
local function source(d) return d and (type(d.editor)=='table' and d.editor or (d.schema~=nil and {} or d)) end
function M.authored(d) local e=source(d);return e and e.road_profile==M.ID end
function M.params(d)
 local e=source(d)
 return projection.validate(e and e.road_profile==M.ID and e.road_look.params or projection.DEFAULT)
end
function M.has_sections(d)
 local e=source(d);if not e or e.road_profile~=M.ID then return false end
 for _,o in ipairs(e.objects or {}) do if type(o)~='table' then return nil,'Invalid terrain source object' end;if o.road_look~=nil then return true end end
 return false
end
function M.validate(e)
 if e.road_profile~=M.ID then return true end
 if (e.editor_version~=7 and e.editor_version~=8 and e.editor_version~=9 and e.editor_version~=10 and e.editor_version~=11) or e.compiler_version~=e.editor_version then return nil,'Authored Terrain Look requires supported editor/compiler version 7, 8, 9, 10 or 11 source; keep the original file.',true end
 local l=e.road_look
 if type(l)~='table' or l.version~=1 then return nil,'Unsupported Terrain Look version; keep the original file.',true end
 for k in pairs(l) do if k~='version' and k~='params' then return nil,'Unsupported Terrain Look field '..tostring(k),true end end
 local p,err=projection.validate(l.params);if not p then return nil,'Terrain Look: '..err,(err:find('Unsupported',1,true) or err:find('Unknown',1,true))~=nil end
 for _,o in ipairs(e.objects or {}) do if type(o)~='table' then return nil,'Invalid terrain source object' end;if o.road_look~=nil then
  local v=o.road_look
  if (o.type~='line' and o.type~='curve' and o.type~='prefab') or (o.type=='prefab' and o.kind=='platform') then return nil,'Terrain Look applies only to terrain sections' end
  if type(v)~='table' or v.version~=1 then return nil,'Unsupported section Terrain Look version',true end
  for k in pairs(v) do if k~='version' and k~='width' and k~='side' and k~='shading' then return nil,'Section look: projection strength/angle are level-wide; unsupported field '..tostring(k),true end end
  for _,k in ipairs(M.LOCAL) do local n,r=v[k],projection.RANGES[k];if type(n)~='number' or n~=n or n<r[1] or n>r[2] then return nil,'Section '..k..' must be '..r[1]..'..'..r[2] end end
 end end
 return true
end
function M.values(e)
 local p=M.params({editor=e});local values={}
 for _,o in ipairs(e.objects) do local v=e.road_profile==M.ID and o.road_look or nil;values[o.id]={manual=v~=nil}
  for _,k in ipairs(M.LOCAL) do values[o.id][k]=v and v[k] or p[k] end
 end
 return values
end
-- A joint has one shared cross-section. A manual section pins its default neighbor;
-- two manual (or two default) sections use their mean. Interpolation is
-- between fixed source samples, independent of camera/chunk boundaries or travel direction.
function M.samples(chain,values)
 local n=#chain.points;local q={}
 for j=1,n do
  local a=values[chain.owner[j==1 and 2 or j]];local b=values[chain.owner[j==n and n or j+1]]
  q[j]={};for _,k in ipairs(M.LOCAL) do q[j][k]=a.manual and not b.manual and a[k] or b.manual and not a.manual and b[k] or (a[k]+b[k])/2 end
 end
 if chain.points[1][1]>chain.points[n][1] then local r={};for j=n,1,-1 do r[#r+1]=q[j] end;q=r end
 return q
end
function M.validate_station(d)
 if not M.authored(d) then return true end
 local doc=M.document
 if not doc then return nil,'Terrain Look requires supported editor source validation; open the source in the editor.' end
 -- Source wrappers remain schema 1; coin-bearing compiled stations use schema 2.
 local ok,err,unsupported=doc.validate({schema=1,units=d.units,id=d.id,name=d.name,editor=d.editor})
 if not ok then return nil,err,unsupported end
 if not M.has_sections(d) then return true end
 -- Cached geometry remains playable under R1. Only matching source may supply local styles;
 -- mismatches fall back to level defaults until the existing editor recovery recompiles them.
 cache[d]=nil
 local e=d.editor;local values=M.values(e);local maps={};local index=0
 for _,run in ipairs(doc.runs(e)) do for _,c in ipairs(doc.run_chains(e,run)) do
  index=index+1;local raw=d.chains[index]
  if not raw or #raw~=#c.points then return true end
  local reverse=raw[1][1]>raw[#raw][1];local other=c.points[1][1]>c.points[#c.points][1]
  for j=1,#raw do local a,b=raw[reverse and #raw-j+1 or j],c.points[other and #raw-j+1 or j]
   if math.abs(a[1]-b[1])>1e-6 or math.abs(a[2]-b[2])>1e-6 then return true end
  end
  maps[index]=M.samples(c,values)
 end end
 if index~=#d.chains then return true end
 cache[d]=maps;return true
end
function M.mapping(d) return cache[d] end
return M
