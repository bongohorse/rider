-- Native fallback; HTML5 uses the responsive DOM surface with the same admitted commands/state.
local layout=require 'main.gym.layout'
local runtime=require 'main.gym.levels_runtime'
local M={}
local function text(t,x,y,s,scale)
 local n=layout.text(vmath.vector3(x,y,0),s,'centre');gui.set_font(n,'default');gui.set_scale(n,vmath.vector3(scale or .8,scale or .8,1));t.nodes[#t.nodes+1]=n;return n
end
local function button(t,x,y,s,w)
 local n=layout.box(vmath.vector3(x,y,0),vmath.vector3(w or 150,38,0),'centre');gui.set_color(n,vmath.vector4(.14,.36,.3,1));t.nodes[#t.nodes+1]=n;text(t,x,y,s);return n
end
function M.new()
 local t={nodes={},index=1};local bg=layout.box(vmath.vector3(480,270,0),vmath.vector3(940,520,0),'centre');gui.set_color(bg,vmath.vector4(.025,.075,.1,.99));t.nodes[1]=bg
 text(t,480,468,'Choose a level',1.2);t.title=text(t,480,418,'');t.detail=text(t,480,370,'');t.status=text(t,480,325,'',.65)
 t.prev=button(t,260,230,'Previous');t.play=button(t,480,230,'Play');t.next=button(t,700,230,'Next');t.close=button(t,480,160,'Back')
 t.lines={};for i=1,19 do local n=layout.box(vmath.vector3(480,285,0),vmath.vector3(1,2,0),'centre');gui.set_color(n,vmath.vector4(.5,.85,.6,1));t.nodes[#t.nodes+1]=n;t.lines[i]=n end
 M.update(t);return t
end
function M.update(t)
 local v=runtime.view;local shown=not html5 and v.open
 for _,n in ipairs(t.nodes) do gui.set_visible(n,shown or false) end
 if not shown then return end
 local c=v.courses[t.index];if not c then return end
 gui.set_text(t.title,t.index..'. '..c.name..(c.completed and ' - Completed' or c.unlocked and '' or ' - Locked'))
 gui.set_text(t.detail,string.format('Best %s | %s | Wonder Gems %d/%d',c.best>0 and string.format('%.2f s',c.best) or '--',require('main.gym.medals').names[c.medal+1],c.gems,c.total_gems))
 gui.set_text(t.status,c.unlocked and v.status or 'Finish the previous level to unlock')
 local pts=c.preview;local lo,hi=math.huge,-math.huge;for _,p in ipairs(pts) do lo=math.min(lo,p[2]);hi=math.max(hi,p[2]) end
 local xmin,xmax=math.min(pts[1][1],pts[#pts][1]),math.max(pts[1][1],pts[#pts][1]);local function p(a)return 260+440*(a[1]-xmin)/math.max(1,xmax-xmin),270+35*(a[2]-lo)/math.max(4,hi-lo)end
 for i,n in ipairs(t.lines) do local x,y=p(pts[i]);local a,b=p(pts[i+1]);local dx,dy=a-x,b-y;layout.position(n,vmath.vector3((x+a)/2,(y+b)/2,0));gui.set_size(n,vmath.vector3(math.sqrt(dx*dx+dy*dy),2,0));gui.set_rotation(n,vmath.quat_rotation_z(math.atan2(dy,dx))) end
end
function M.input(t,id,a)
 local v=runtime.view;if not v.open then return false end
 if id==hash('ui_pointer') and a.pressed then
  if gui.pick_node(t.close,a.x,a.y) then msg.post('main:/loader#script','levels_menu',{open=false})
  elseif gui.pick_node(t.prev,a.x,a.y) then t.index=math.max(1,t.index-1)
  elseif gui.pick_node(t.next,a.x,a.y) then t.index=math.min(#v.courses,t.index+1)
  elseif gui.pick_node(t.play,a.x,a.y) and v.courses[t.index].unlocked then msg.post('main:/loader#script','select_station',{id=v.courses[t.index].id,preset='a',level_menu=true}) end
 end
 return true
end
return M
