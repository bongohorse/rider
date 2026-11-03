-- Small fixed HUD allocation; read-only display, no input/finish/scoring actions.
local layout=require 'main.gym.layout'
local M={}
local function text(x,y,value)
 local n=layout.text(vmath.vector3(x,y,0),value,'top');gui.set_font(n,'default');gui.set_scale(n,vmath.vector3(.55,.55,1));return n
end
function M.new()
 local t={nodes={},marker={}}
 local function box(x,y,w,h,color)
  local n=layout.box(vmath.vector3(x,y,0),vmath.vector3(w,h,0),'top');gui.set_color(n,color);t.nodes[#t.nodes+1]=n;return n
 end
 local dark=vmath.vector4(.10,.20,.24,.95);local light=vmath.vector4(.7,.85,.82,1)
 t.track=box(480,463,240,4,dark)
 t.start=box(360,463,3,12,light);t.finish=box(600,463,3,12,light)
 t.marker.body=box(360,467,14,6,vmath.vector4(.3,.9,.85,1));t.marker.roof=box(360,472,8,4,vmath.vector4(.3,.9,.85,1))
 t.marker.left=box(355,463,4,4,light);t.marker.right=box(365,463,4,4,light)
 t.start_text=text(330,463,'Start');t.finish_text=text(633,463,'Finish');t.label=text(480,444,'')
 for _,n in ipairs({t.start_text,t.finish_text,t.label}) do t.nodes[#t.nodes+1]=n end
 M.show(t,nil,false);return t
end
function M.show(t,data,touch)
 t.data=data
 local visible=data and data.enabled and not touch or false
 for _,n in ipairs(t.nodes)do gui.set_visible(n,visible)end
 if not data then return end
 if not data.available then
  for _,n in ipairs(t.nodes)do gui.set_visible(n,false)end
  gui.set_visible(t.label,visible);gui.set_text(t.label,'Progress unavailable: '..data.reason);return
 end
 local x=360+240*data.fraction
 layout.position(t.marker.body,vmath.vector3(x,467,0));layout.position(t.marker.roof,vmath.vector3(x,472,0))
 layout.position(t.marker.left,vmath.vector3(x-5,463,0));layout.position(t.marker.right,vmath.vector3(x+5,463,0))
 gui.set_text(t.label,string.format('%d%%',math.floor(data.fraction*100+.000001))..(data.phase=='paused' and ' - Paused' or ''))
end
function M.geometry(t)
 local function point(n)local p=gui.get_screen_position(n);return {x=p.x,y=p.y}end
 return {start=point(t.start),finish=point(t.finish),marker=point(t.marker.body),label=gui.get_text(t.label)}
end
return M
