-- Terrain Look session: drafts are separate from source, Apply is one existing editor commit.
local editor=require 'main.gym.editor'
local doc=require 'main.gym.editor_doc'
local look=require 'main.terrain_perspective.look'
local projection=require 'main.terrain_perspective.projection'
local socket=require 'socket'
local M={}
local function signature(e)
 local p=look.params(e);local t={e.road_profile or 'legacy',{p.mode,p.width,p.perspective,p.angle,p.side,p.shading},{}}
 for _,o in ipairs(e.objects) do if look.authored(e) and o.road_look then t[3][#t[3]+1]={o.id,o.road_look.version,o.road_look.width,o.road_look.side,o.road_look.shading} end end
 return json.encode(t)
end
function M.sync()
 if not editor.doc then return end
 local s=M.session;local e=editor.doc.editor
 if not s or s.instance~=editor.opened then
  s={instance=editor.opened,open=false,scope='level',params=look.params(e),revision=e.revision,signature=signature(e)};M.session=s;editor.look_preview=nil
 elseif s.revision~=e.revision then
  local sig=signature(e)
  if sig~=s.signature then
   s.params=look.params(e);if s.scope=='selected' then local values=look.values(e);for _,id in ipairs(s.ids or {}) do if values[id] then for _,k in ipairs(look.LOCAL) do s.params[k]=values[id][k] end;break end end end
   s.dirty=false;s.clear=nil;editor.look_preview=nil;s.signature=sig
  end
  s.revision=e.revision
 end
 return s
end
function M.scope(value)
 local s=M.sync();s.scope=value;s.ids=editor.selected_ids();s.params=look.params(editor.doc.editor);s.clear=nil;s.error=nil;s.dirty=false;editor.look_preview=nil;editor.look_epoch=(editor.look_epoch or 0)+1
 s.mixed=false
 if value=='selected' then local values=look.values(editor.doc.editor)
  local first
  for _,id in ipairs(s.ids) do if values[id] then
   if not first then first=values[id];for _,k in ipairs(look.LOCAL) do s.params[k]=first[k] end
   else for _,k in ipairs(look.LOCAL) do if values[id][k]~=first[k] then s.mixed=true end end end
  end end
 end
 editor.touch()
end
function M.open()
 local s=M.sync();if s.scope=="selected" and table.concat(s.ids or {},"|")~=table.concat(editor.selected_ids(),"|") then M.scope("selected");s=M.session end;s.open=true
 if s.dirty then s.pending=true end
end
function M.close() local s=M.sync();if s then s.open=false;s.field=nil;s.drag=nil end end
local function candidate(s)
 local e=editor.doc.editor;local copy=doc.copy(e);local ids={}
 if s.scope=='selected' then
  if not require('main.terrain_perspective.profile').enabled(e) then return nil,'Legacy level: Apply a level-wide look first. Loading or opening this menu never converts it.' end
  for _,id in ipairs(s.ids or {}) do ids[id]=true end
  if not next(ids) then return nil,'Select terrain sections first, then choose Selected sections.' end
 end
 local count=0
 for _,o in ipairs(copy.objects) do if doc.terrain(o) and (s.scope=='level' or ids[o.id]) then
  if o.locked then return nil,'Locked terrain: unlock it or select only unlocked sections. Level-wide projection cannot bypass locks.' end
  count=count+1
  if s.scope=='selected' then
   if s.clear then o.road_look=nil else o.road_look={version=1,width=s.params.width,side=s.params.side,shading=s.params.shading} end
  end
 elseif ids[o.id] then return nil,'Terrain Look applies only to terrain sections, not props or labels.' end end
 if s.scope=='selected' and count==0 then return nil,'Select terrain sections first.' end
 copy.road_profile=look.ID
 copy.road_look={version=1,params=s.scope=='level' and projection.validate(s.params) or look.params(e)}
 return copy
end
function M.preview()
 local s=M.sync();s.pending=nil;local e,err=candidate(s)
 if not e then s.error=err;return nil end
 local wrapper={schema=1,units='metres',id=editor.doc.id,name=editor.doc.name,editor=e}
 local ok,why=doc.validate(wrapper)
 if not ok then s.error=why;return nil end
 -- Invalid geometry drafts remain editable; valid courses must pass actual selected-layout admission.
 local compiled,blocked=doc.compile(wrapper)
 if not compiled and blocked and blocked:find('Resource budget:',1,true) then s.error_detail=blocked;s.error=(blocked:match('^[^%.]+%.') or blocked)..' Shorten/simplify terrain or split the course.';return nil end
 s.error=nil;editor.look_preview=e;editor.look_epoch=(editor.look_epoch or 0)+1;editor.touch();return e
end
function M.change(k,value)
 local s=M.sync();local r=projection.RANGES[k]
 if s.scope=='selected' and (k=='perspective' or k=='angle') then s.error='Perspective and view angle are level-wide.';return end
 if not r or type(value)~='number' or value~=value or value<r[1] or value>r[2] then s.error=k..' must be '..r[1]..'..'..r[2];return nil end
 s.params[k]=value;s.params.mode='perspective';s.dirty=true;s.clear=nil;s.pending=true;s.error=nil;return true
end
function M.reset()
 local s=M.sync();s.params=s.scope=='selected' and look.params(editor.doc.editor) or projection.validate(projection.DEFAULT);s.clear=s.scope=='selected';s.dirty=true;s.pending=true;s.field=nil
end
function M.apply()
 local s=M.sync();local e=M.preview();if not e then return nil end
 if signature(e)==signature(editor.doc.editor) then s.dirty=false;editor.look_preview=nil;return true end
 local ok=editor.commit(function(target)
  target.road_profile=e.road_profile;target.road_look=doc.copy(e.road_look)
  for i,o in ipairs(target.objects) do o.road_look=doc.copy(e.objects[i].road_look) end
 end,false)
 if ok then
  s.signature=signature(editor.doc.editor);s.revision=editor.doc.editor.revision;s.dirty=false;s.clear=nil;s.mixed=false;editor.look_preview=nil;editor.look_epoch=(editor.look_epoch or 0)+1;editor.touch();s.error=nil
 else s.error=editor.message end
 return ok
end
function M.tick()
 local s=M.sync();if not s then return end
 if editor.mode=='edit' and s.pending and (not s.last or socket.gettime()-s.last>=.1) then s.last=socket.gettime();M.preview() end
end
function M.confirm()
 local s=M.sync();local f=s.field;if not f then return true end
 if not M.change(f.key,tonumber(f.text)) then return nil end;s.field=nil;return true
end
return M
