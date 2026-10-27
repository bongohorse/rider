local socket=require 'socket'
-- Editor A1b: fixed-size desktop chrome. A fixed pool is reused between the inspector and every
-- modal/list; disabling a node never frees its budget. Coordinates here are canvas pixels, top-left.
local M={BOXES=128,TEXTS=128}
local function colour(hex,a)
    local n=tonumber(hex,16)
    return vmath.vector4(math.floor(n/65536)/255,math.floor(n/256)%256/255,n%256/255,a or 1)
end
M.c={canvas=colour('101e26'),panel=colour('192c36'),control=colour('223b47'),border=colour('35515f'),
    text=colour('edf4f6'),secondary=colour('b0c3cc'),active=colour('8de0c5'),hover=colour('d5f3e9'),
    selected=colour('ffc66d'),connected=colour('72dbe9'),error=colour('ff9298')}
local C=M.c
-- Code-native 24 px line icons: no font-dependent Unicode glyphs or external artwork.
local ICONS={
 eye={{2,12,7,7},{7,7,17,7},{17,7,22,12},{22,12,17,17},{17,17,7,17},{7,17,2,12},{10,10,14,10},{14,10,14,14},{14,14,10,14},{10,14,10,10}},
 eye_off={{2,12,7,7},{7,7,17,7},{17,7,22,12},{22,12,17,17},{17,17,7,17},{7,17,2,12},{3,3,21,21}},
 lock={{5,10,19,10},{19,10,19,21},{19,21,5,21},{5,21,5,10},{8,10,8,5},{8,5,11,2},{11,2,15,3},{15,3,16,6},{16,6,16,10},{12,14,12,17}},
 unlock={{5,10,19,10},{19,10,19,21},{19,21,5,21},{5,21,5,10},{8,10,8,5},{8,5,11,2},{11,2,15,3},{15,3,16,6},{12,14,12,17}},
 new={{5,3,15,3},{15,3,20,8},{20,8,20,21},{20,21,5,21},{5,21,5,3},{15,3,15,8},{15,8,20,8},{8,14,17,14},{12,10,12,18}},
 open={{3,7,10,7},{10,7,12,10},{12,10,21,10},{3,7,3,21},{3,21,19,21},{19,21,22,12},{22,12,7,12},{7,12,3,21}},
 import={{12,3,12,16},{7,11,12,16},{12,16,17,11},{3,16,3,21},{3,21,21,21},{21,21,21,16}},
 export={{12,17,12,3},{7,8,12,3},{12,3,17,8},{3,16,3,21},{3,21,21,21},{21,21,21,16}},
 undo={{9,4,3,10},{3,10,9,16},{3,10,15,10},{15,10,20,14},{20,14,20,20}},
 redo={{15,4,21,10},{21,10,15,16},{21,10,9,10},{9,10,4,14},{4,14,4,20}},
 play={{6,3,21,12},{21,12,6,21},{6,21,6,3}},
 tool_select={{5,3,20,14},{20,14,13,15},{13,15,10,22},{10,22,5,3}},
 tool_draw={{4,20,7,13},{7,13,17,3},{17,3,21,7},{21,7,11,17},{11,17,4,20}},
 tool_curve={{3,20,7,10},{7,10,12,5},{12,5,18,7},{18,7,21,18}},
 tool_prefab={{3,7,12,3},{12,3,21,7},{21,7,21,18},{21,18,12,22},{12,22,3,18},{3,18,3,7},{3,7,12,12},{12,12,21,7},{12,12,12,22}},
 tool_start={{5,22,5,3},{5,3,20,3},{20,3,20,12},{20,12,5,12}},
 tool_finish={{5,22,5,3},{5,3,20,3},{20,3,20,12},{20,12,5,12},{10,3,10,12},{15,3,15,12},{5,7,20,7}},
 tool_label={{3,5,21,5},{12,5,12,21},{7,21,17,21}},
 tool_pan={{3,12,21,12},{12,3,12,21},{3,12,7,8},{3,12,7,16},{21,12,17,8},{21,12,17,16},{12,3,8,7},{12,3,16,7},{12,21,8,17},{12,21,16,17}},
 view_fit={{3,9,3,3},{3,3,9,3},{15,3,21,3},{21,3,21,9},{21,15,21,21},{21,21,15,21},{9,21,3,21},{3,21,3,15}},
 view_centre={{12,2,12,8},{12,16,12,22},{2,12,8,12},{16,12,22,12},{8,8,16,8},{16,8,16,16},{16,16,8,16},{8,16,8,8}},
 view_bounds={{3,3,21,3},{21,3,21,21},{21,21,3,21},{3,21,3,3}},
 view_start={{5,22,5,3},{5,3,20,3},{20,3,20,12},{20,12,5,12}},
 view_test={{12,3,19,6},{19,6,22,12},{22,12,19,19},{19,19,12,22},{12,22,5,19},{5,19,2,12},{2,12,5,6},{5,6,12,3},{12,6,12,12},{12,12,17,15}},
 view_ghost={{3,16,5,8},{5,8,18,8},{18,8,22,16},{22,16,3,16},{6,16,6,20},{6,20,9,20},{9,20,9,16},{16,16,16,20},{16,20,19,20},{19,20,19,16}},
}
local function inside(r,x,y) return x and y and x>=r.x and x<=r.x+r.w and y>=r.y and y<=r.y+r.h end
function M.init()
    -- Three tiny code-native UI masks, uploaded once. Direct textures avoid sampling adjacent
    -- atlas frames when a solid panel is stretched to the viewport size.
    assert(gui.new_texture('editor_solid',1,1,'rgba',string.char(255,255,255,255),false))
    for _,spec in ipairs({{'editor_control',16},{'editor_ring',32}}) do
        local bytes={};local size=spec[2]
        for y=0,size-1 do for x=0,size-1 do
            local alpha
            if spec[1]=='editor_ring' then
                local r=math.sqrt((x-15.5)^2+(y-15.5)^2)
                alpha=math.max(0,math.min(1,math.min(r-10,15.5-r)))
            else
                local dx=math.max(3.5-x,0,x-11.5);local dy=math.max(3.5-y,0,y-11.5)
                alpha=math.max(0,math.min(1,4.5-math.sqrt(dx*dx+dy*dy)))
            end
            local v=math.floor(alpha*255);bytes[#bytes+1]=string.char(v,v,v,v)
        end end
        assert(gui.new_texture(spec[1],size,size,'rgba',table.concat(bytes),false))
    end
    for name,segments in pairs(ICONS) do
        local bytes={}
        for y=0,23 do for x=0,23 do
            local distance=100
            for _,v in ipairs(segments) do
                local dx,dy=v[3]-v[1],v[4]-v[2]
                local t=math.max(0,math.min(1,((x-v[1])*dx+(y-v[2])*dy)/(dx*dx+dy*dy)))
                distance=math.min(distance,math.sqrt((x-v[1]-t*dx)^2+(y-v[2]-t*dy)^2))
            end
            local a=math.floor(255*math.max(0,math.min(1,1.5-distance)))
            bytes[#bytes+1]=string.char(a,a,a,a)
        end end
        assert(gui.new_texture('editor_icon_'..name,24,24,'rgba',table.concat(bytes),false))
    end
    local u={boxes={},texts={},buttons={},visible={},rects={},scroll=0,tool_scroll=0,tools=false,properties=false,prefabs=false}
    for i=1,M.BOXES do u.boxes[i]=gui.new_box_node(vmath.vector3(),vmath.vector3(1,1,0));gui.set_size_mode(u.boxes[i],gui.SIZE_MODE_MANUAL);gui.set_enabled(u.boxes[i],false) end
    for i=1,M.TEXTS do
        local n=gui.new_text_node(vmath.vector3(),"");gui.set_font(n,'default');gui.set_pivot(n,gui.PIVOT_W)
        gui.set_enabled(n,false);u.texts[i]=n
    end
    M.size(u)
    return u
end
function M.hide(u)
    for _,pool in ipairs({u.boxes,u.texts}) do for _,n in ipairs(pool) do gui.set_enabled(n,false) end end
    u.buttons,u.visible,u.rects={},{},{};u.scroll_drag=nil
end
function M.size(u)
    local w,h=window.get_size()
    -- Desktop sizes keep the approved CSS-pixel chrome. Tiny windows remain accessible by scaling
    -- the same desktop layout, without claiming a mobile-authoring UI.
    local density=html5 and tonumber(html5.run("(function(){var c=document.querySelector('canvas');return c&&c.clientWidth?c.width/c.clientWidth:1;})()")) or 1
    if not density or density<=0 or density~=density then density=1 end
    u.scale=density*math.min(1,math.max(1,w)/density/1280)
    u.w,u.h=math.max(1,w)/u.scale,math.max(1,h)/u.scale
    return u.w,u.h
end
function M.usable(u)
    local w,h=M.size(u);local s=u.scale
    return {x0=(u.tools and 72 or 216)*s,x1=(w-(u.properties and 72 or 312))*s,y0=80*s,y1=(h-104)*s}
end
function M.pointer(u,action)
    if action.screen_x then u.pointer={action.screen_x/u.scale,u.h-action.screen_y/u.scale} end
end
function M.object_area(u)
    return u.object_rect and u.pointer and inside(u.object_rect,u.pointer[1],u.pointer[2])
end
function M.area(u,action)
    local p=action.screen_x and {action.screen_x/u.scale,u.h-action.screen_y/u.scale} or u.pointer
    if not p then return nil end
    if p[2]<104 or p[2]>u.h-80 then return 'chrome' end
    if u.tools_rect and inside(u.tools_rect,p[1],p[2]) then return 'tools' end
    if u.properties_rect and inside(u.properties_rect,p[1],p[2]) then return 'properties' end
    if u.error_banner and inside(u.error_banner,p[1],p[2]) then return 'chrome' end
end
local function shorten(t,width,size)
    local count=math.max(1,math.floor(width/((size or 14)*.57)))
    if #t>count then return t:sub(1,math.max(1,count-3)):gsub('[\128-\191]*$',''):gsub('[\192-\255]$','')..'...' end
    return t
end
local function wrap(t,width,size)
    local out={};local count=math.max(8,math.floor(width/((size or 14)*.57)))
    for line in (t..'\n'):gmatch('(.-)\n') do
        if line=='' then out[#out+1]='' end
        while #line>count do
            local cut=line:sub(1,count):match('.*()%s') or count
            out[#out+1]=line:sub(1,cut);line=line:sub(cut+1)
        end
        if line~='' then out[#out+1]=line end
    end
    return out
end
-- Preserve the existing driving-mode entry hint/message using the same text pool.
function M.play(u,k,message,session,legacy,status)
    M.render(u,{play=true,k=k,selection='',tool='',now=socket.gettime(),message=message or '',look=session,
        look_legacy=legacy,status=status or '',modal=session and session.open and 'terrain_look' or nil})
end
function M.scrollbar_hit(u)
    if not u.pointer then return false end
    for _,r in pairs(u.scrollbars or {}) do if inside(r,u.pointer[1],u.pointer[2]) then return true end end
    return false
end
-- Scrollbar tracks support both drag and a click to seek; only view state changes.
function M.scrollbar_input(u,id,action)
    local p=u.pointer
    if not p then return false end
    if id==hash('ui_pointer') and action.released and u.scroll_drag then u.scroll_drag=nil;return true end
    if id==hash('ui_pointer') and action.pressed then
        for key,r in pairs(u.scrollbars or {}) do
            if inside(r,p[1],p[2]) then
                local y=r.y+(r.h-r.knob)*(u[key] or 0)/r.maximum
                u.scroll_drag={key=key,offset=p[2]>=y and p[2]<=y+r.knob and p[2]-y or r.knob/2};break
            end
        end
    end
    if u.scroll_drag and (id==nil or id==hash('ui_pointer')) then
        local key=u.scroll_drag.key;local r=u.scrollbars[key]
        if r then u[key]=math.max(0,math.min(r.maximum,(p[2]-r.y-u.scroll_drag.offset)/math.max(1,r.h-r.knob)*r.maximum)) end
        if key=="object_scroll" then u[key]=math.floor(u[key]+.5) end
        return true
    end
    return false
end
function M.render(u,d)
    local w,h=M.size(u);u.k=d.k;u.nb,u.nt=0,0;u.buttons,u.visible,u.rects,u.tips={},{},{},{}
    u.scrollbars={};u.error_banner,u.error_text=nil,nil
    u.scroll_key=d.selection..':'..d.tool
    if u.scroll_key~=u.last_scroll_key then u.scroll,u.last_scroll_key=0,u.scroll_key end
    local function box(x,y,bw,bh,c)
        u.nb=u.nb+1;local n=assert(u.boxes[u.nb],'editor UI box pool exhausted')
        gui.set_enabled(n,true);gui.set_screen_position(n,vmath.vector3((x+bw/2)*u.scale,(h-y-bh/2)*u.scale,0))
        gui.set_texture(n,'editor_solid');gui.set_slice9(n,vmath.vector4())
        gui.set_size(n,vmath.vector3(bw*u.scale/u.k,bh*u.scale/u.k,0));gui.set_euler(n,vmath.vector3())
        gui.set_color(n,c or C.control);return n
    end
    local function text(x,y,t,c,size,width)
        u.nt=u.nt+1;local n=assert(u.texts[u.nt],'editor UI text pool exhausted')
        gui.set_enabled(n,true);gui.set_screen_position(n,vmath.vector3(x*u.scale,(h-y)*u.scale,0))
        gui.set_text(n,width and shorten(t,width,size) or t);gui.set_color(n,c or C.text)
        local s=(size or 14)/14*u.scale/u.k;gui.set_scale(n,vmath.vector3(s,s,1));return n
    end
    local function button(name,x,y,bw,label,active,tip,bh,disabled)
        bh=bh or 32
        local icon_name=d.icons and d.icons[name] or name
        local icon=ICONS[icon_name]
        local field=name=='object_name' or name=='object_search' or name:match('^object_select_') or name=='rename' or name=='snapshot' or name=='speed' or name=='test_speed' or name:match('^param_') or name:match('^medal_')
        if not icon and not field and label~='' and not name:match('^collapse_') then bw=math.min(bw,math.max(32,#label*8+16)) end
        local r={x=x,y=y,w=bw,h=bh};local hover=u.pointer and inside(r,u.pointer[1],u.pointer[2])
        if hover then box(x-1,y-1,bw+2,bh+2,C.hover) end
        local blocked=name=='warnings' and d.blocking
        local b=box(x,y,bw,bh,blocked and C.error or active and C.active or C.control)
        if name=='warnings' then u.problem_colour=blocked and 'error' or 'normal' end
        gui.set_texture(b,'editor_control');gui.set_slice9(b,vmath.vector4(4,4,4,4))
        local danger=name=='delete' or name:match('^libdel_') or label:match('^Sure%?')
        local fg=blocked and C.canvas or danger and C.error or disabled and colour('b0c3cc',.6) or active and C.canvas or C.text
        local t
        if icon then
            local n=box(x+(bw-24)/2,y+(bh-24)/2,24,24,fg)
            gui.set_texture(n,'editor_icon_'..icon_name)
        else t=text(x+8,y+bh/2,label,fg,14,bw-12) end
        u.tips[name]=tip or label
        u.buttons[name]={box=b,label=t};u.visible[#u.visible+1]=name;u.rects[name]=r
        if hover then u.hover=name;u.tip=tip or label end
        return b
    end
    local function paragraph(x,y,t,width,c,size,clip)
        size=size or 14;local line=size==12 and 16 or 20
        for _,s in ipairs(wrap(t,width,size)) do
            if not clip or (y-line/2>=clip[1] and y+line/2<=clip[2]) then text(x,y,s,c,size) end
            y=y+line
        end
        return y
    end
    local function thumb(kind,x,y)
        local shapes={flat={{0,12,42,12}},ramp={{0,20,42,0}},step={{0,20,20,20},{20,20,20,0},{20,0,42,0}},
            gap={{0,4,12,4},{30,4,42,4}},kicker={{0,20,16,0},{30,12,42,12}},
            platform={{0,20,0,0},{0,0,42,0},{42,0,42,20},{42,20,0,20}},
            wave={{0,12,7,1},{7,1,14,1},{14,1,28,22},{28,22,35,22},{35,22,42,12}}}
        for _,p in ipairs(shapes[kind] or {}) do
            local dx,dy=(p[3]-p[1])*.85,(p[4]-p[2])*.85
            local length=math.sqrt(dx*dx+dy*dy)
            local n=box(x+(p[1]+p[3])*.425-length/2,y+(p[2]+p[4])*.425-1,length,2,kind==d.prefab_kind and C.selected or C.secondary)
            gui.set_euler(n,vmath.vector3(0,0,-math.deg(math.atan2(dy,dx))))
        end
    end
    u.hover,u.tip=nil,nil
    local modal=d.modal
    if modal then u.scroll_drag=nil end
    -- Modal contents share the same pools; no underlying text can render above a modal box.
    if d.play and not modal then
        text(16,h-40,'Edit level [E]',C.secondary,12)
        button('terrain_look',560,h-56,132,d.look and d.look.dirty and 'Terrain Look *' or 'Terrain Look',false,'Change Terrain Look live in this run; Apply saves to the level.')
        if d.message~='' then text(16,94,d.message,C.error,14,w-32) end
    elseif not modal then
        box(0,0,w,48,C.panel);text(16,24,'RIDER',C.active,18)
        local title_width=math.min(280,math.max(96,#d.title*10.5+4))
        text(96,24,d.title,C.text,18,title_width)
        local sx=112+title_width
        text(sx,24,d.status,d.status:lower():find('failed') and C.error or d.status:lower():find('only') and C.selected or C.active,12,w-384-sx)
        u.status_rect={x=sx,y=8,w=math.max(0,w-384-sx),h=32}
        for i,v in ipairs({{'new','New level'},{'open','Open levels / templates'},{'import','Import JSON'},{'export','Export JSON'}}) do
            button(v[1],w-264+(i-1)*40,8,32,v[2],false,v[2])
        end
        button('warnings',w-104,8,48,d.blocking and ('! '..d.error_count) or d.warning_count>0 and ('! '..d.warning_count) or 'OK',false,d.diagnostics..': show problems and their sources')
        button('view_help',w-48,8,32,'?',false,'Help [H]')
        button('versions',w-352,8,80,'Versions',false,'Restore saved versions / named snapshots')
        button('undo',16,56,32,'Undo',false,'Undo [Ctrl+Z]')
        button('redo',56,56,32,'Redo',false,'Redo [Ctrl+Y]')
        button('play',96,56,40,'Play',true,'Play from START [E]')
        local lw=u.tools and 40 or 184
        local tools_end=u.tools and 160 or u.prefabs and 280 or 508
        local objects_top=u.prefabs and 280 or 508
        local object_rows=math.min(4,math.max(1,#d.objects))
        local object_height=u.objects_collapsed and 40 or 80+object_rows*36+24
        if not u.tools then tools_end=objects_top+object_height+12 end
        tools_end=math.min(h-80,tools_end)
        u.tools_rect={x=16,y=104,w=lw,h=math.max(56,tools_end-104)}
        box(16,104,lw,u.tools_rect.h,C.panel)
        button('collapse_tools',u.tools and 20 or 28,112,u.tools and 32 or 160,u.tools and '>' or 'TOOLS  <',false,'Collapse or expand Tools')
        local function scrollbar(key,x,top,bottom,content)
            local height=math.max(24,bottom-top);local maximum=math.max(0,content-height)
            local value=math.max(0,math.min(maximum,u[key] or 0));u[key]=value
            if key=='scroll' then u.max_scroll=maximum else u.tool_max_scroll=maximum end
            if maximum<=0 then return end
            local knob=math.max(24,height*height/(height+maximum))
            local y=top+(height-knob)*value/maximum
            box(x,top,8,height,C.control);box(x+1,y,6,knob,C.secondary)
            u.scrollbars[key]={x=x-3,y=top,w=14,h=height,knob=knob,maximum=maximum}
        end
        if not u.tools then
            local labels={'Select [S]','Draw [D]','Curve [C]','Prefab [P]','START','FINISH','Label [L]','Pan'}
            local top,bottom=152,tools_end-12
            scrollbar('tool_scroll',190,top,bottom,objects_top+object_height-top)
            local function shown(y,bh) return y>=top and y+bh<=bottom end
            for i,tool in ipairs(d.tools) do
                local x,y=28+(i-1)%4*40,152+math.floor((i-1)/4)*40-u.tool_scroll
                if shown(y,32) then button('tool_'..tool[1],x,y,32,labels[i],d.tool==tool[1],labels[i]) end
            end
            local py=236-u.tool_scroll
            if shown(py,32) then button('collapse_prefabs',28,py,152,u.prefabs and 'PREFABS  >' or 'PREFABS  v',false,'Collapse or expand the prefab library') end
            if not u.prefabs then
                for i,kind in ipairs(d.kinds) do
                    local x,y=28+(i-1)%2*80,276+math.floor((i-1)/2)*56-u.tool_scroll
                    if shown(y,52) then
                        button('kind_'..kind,x,y,72,'',false,tostring(i)..': '..d.full_names[kind]..' — click to place; Esc cancels',52)
                        thumb(kind,x+16,y+5);text(x+8,y+42,shorten(d.names[kind],56,12),kind==d.prefab_kind and C.selected or C.text,12)
                    end
                end
            end
            local oy=objects_top-u.tool_scroll
            if shown(oy,32) then button('collapse_objects',28,oy,152,u.objects_collapsed and 'OBJECTS  >' or 'OBJECTS  v',false,'Collapse or expand Objects') end
            if not u.objects_collapsed then
                if shown(oy+40,32) then button('object_search',28,oy+40,152,d.search~='' and d.search or 'Search objects',false,'Search by type, name or id; Esc cancels') end
                local count=#d.objects
                local rows=4;u.object_max_scroll=math.max(0,count-rows)
                u.object_scroll=math.max(0,math.min(u.object_scroll or 0,u.object_max_scroll))
                if u.list_selection~=d.selection or u.list_query~=d.search then
                    u.list_selection,u.list_query=d.selection,d.search
                    for i,obj in ipairs(d.objects) do if obj.id==d.selection then
                        if i<=u.object_scroll then u.object_scroll=i-1 elseif i>u.object_scroll+rows then u.object_scroll=i-rows end
                    end end
                end
                for i=1,rows do
                    local obj=d.objects[u.object_scroll+i];local y=oy+80+(i-1)*36
                    if obj and shown(y,32) then
                        button('object_select_'..obj.id,28,y,88,'',obj.selected,obj.tip)
                        text(34,y+10,obj.title,obj.selected and C.canvas or C.text,12,78)
                        text(34,y+24,obj.subtitle,obj.selected and C.canvas or C.secondary,12,78)
                        button('object_eye_'..obj.id,120,y,28,'',false,obj.hidden and 'Hidden: show '..obj.tip or 'Visible: hide '..obj.tip)
                        button('object_lock_'..obj.id,152,y,28,'',false,obj.locked and 'Locked: unlock '..obj.tip or 'Editable: lock '..obj.tip)
                    elseif not obj and i==1 and shown(y,24) then text(28,y+12,'No objects',C.secondary,12) end
                end
                -- The shared tools scrollbar reveals this bounded list. Wheel over its rows scrolls
                -- the object index, independently of the surrounding prefab/tool panel.
                u.object_rect={x=28,y=oy+80,w=152,h=object_rows*36}
                local last_y=oy+80+object_rows*36
                if count>rows and shown(last_y,16) then
                    local height=rows*36;local knob=math.max(16,height*rows/count)
                    local top=oy+80;local y=top+(height-knob)*u.object_scroll/u.object_max_scroll
                    if shown(top,height) then
                        box(182,top,4,height,C.control);box(182,y,4,knob,C.secondary)
                        u.scrollbars.object_scroll={x=180,y=top,w=6,h=height,knob=knob,maximum=u.object_max_scroll}
                    end
                end
                if count>rows and shown(oy+224,16) then text(28,oy+232,(u.object_scroll+1)..'-'..math.min(count,u.object_scroll+rows)..' / '..count,C.secondary,12) end
            else u.object_rect=nil end
        else u.tool_scroll,u.tool_max_scroll=0,0;u.object_rect=nil end
        local rx=w-(u.properties and 56 or 296)
        local property_panel=box(rx,104,u.properties and 40 or 280,56,C.panel)
        u.properties_rect={x=rx,y=104,w=u.properties and 40 or 280,h=56}
        button('collapse_properties',rx+(u.properties and 4 or 12),112,u.properties and 32 or 256,u.properties and '<' or 'PROPERTIES  >',false,'Collapse or expand Properties')
        if not u.properties then
            local clip={156,h-96};local start=170;local y=start-u.scroll
            local function row(name,label,unit,value,err,choices)
                local rowh=unit~=nil and 66 or 44
                if u.reveal==name then
                    if y<clip[1]+12 then u.scroll=math.max(0,u.scroll+y-clip[1]-12)
                    elseif y+48>clip[2] then u.scroll=u.scroll+y+48-clip[2] end
                    u.reveal=nil
                end
                if unit~=nil then
                    if y>=clip[1] and y+48<=clip[2] then
                        text(rx+16,y,label,C.secondary,12)
                        local focused=d.field and d.field.key==name
                        if focused then box(rx+14,y+12,252,36,err and C.error or C.active) end
                        button(name,rx+16,y+14,unit~='' and 184 or 248,value,false,label..(unit~='' and ' ('..unit..')' or '')..': type directly; Enter applies, Esc cancels')
                        if unit~='' then
                            text(rx+164,y+30,unit,C.secondary,12)
                            button('dec_'..name,rx+200,y+14,32,'-',false,d.disabled['dec_'..name] or 'Decrease '..label,32,d.disabled['dec_'..name])
                            button('inc_'..name,rx+232,y+14,32,'+',false,d.disabled['inc_'..name] or 'Increase '..label,32,d.disabled['inc_'..name])
                        end
                    end
                    y=y+rowh
                    if err then y=paragraph(rx+16,y-8,err,248,C.error,12,clip)+8 end
                else
                    if y>=clip[1] and y+32<=clip[2] then button(name,rx+16,y,248,label,false,choices) end
                    y=y+rowh
                end
            end
            -- The heading/summary wraps and scrolls as a single body with all actions reachable.
            local title,rest=d.description:match('([^\n]+)\n?(.*)')
            y=paragraph(rx+16,y,title or '',248,d.selection~='' and C.selected or C.text,18,clip)
            if rest~='' then y=paragraph(rx+16,y,rest,248,C.secondary,14,clip) end
            y=y+16
            for _,f in ipairs(d.fields) do
                if f.choices and f.ramp then
                    if y>=clip[1] and y+48<=clip[2] then
                        text(rx+16,y,'Input mode',C.secondary,12)
                        button('mode_angle',rx+16,y+12,64,'Angle',f.value=='angle')
                        button('mode_height',rx+88,y+12,72,'Height',f.value=='height')
                        -- Existing tests/keyboard actions retain a single choice-field target.
                        u.buttons[f.name]=u.buttons[f.value=='angle' and 'mode_height' or 'mode_angle']
                        u.visible[#u.visible+1]=f.name
                    end
                    y=y+64
                    if f.error then y=paragraph(rx+16,y-8,f.error,248,C.error,12,clip)+8 end
                elseif f.choices then row(f.name,f.label..': '..f.value,nil,nil,nil,'Cycle '..f.label)
                else row(f.name,f.label,f.unit,f.value,f.error) end
            end
            if d.object_name~=nil then row('object_name','Object name','',d.object_name,d.object_name_error) end
            if d.level then row('rename','Name','',''..d.name,d.name_error);row('speed','START speed','m/s',d.speed,d.speed_error);row('test_speed','Test start speed','m/s',d.test_speed)
                row('collapse_medals',u.medals and 'MEDAL TARGETS  v' or 'MEDAL TARGETS  >',nil,nil,nil,'Edit Gold / Silver / Bronze. First edit enables 26 / 30 / 40 s defaults; editor starts remain practice.')
                if u.medals then
                for _,key in ipairs({'gold','silver','bronze'}) do
                    local label=key:sub(1,1):upper()..key:sub(2)..' target'
                    local value=d.medal_field==key and d.medal_text or d.medal_times and tostring(d.medal_times[key]) or '--'
                    row('medal_'..key,label,'s',value,d.medal_field==key and d.medal_error)
                end
                if d.medal_times then row('clear_medals','Remove medal targets') end
                end
            elseif d.start_selected then row('speed','START speed','m/s',d.speed,d.speed_error) end
            for i,v in ipairs(d.actions) do
                if v.name=='mirror_left' and d.actions[i+1] and d.actions[i+1].name=='mirror_right' then
                    if y>=clip[1] and y+32<=clip[2] then
                        button('mirror_left',rx+16,y,80,'Mirror <');button('mirror_right',rx+104,y,80,'Mirror >')
                    end
                    y=y+44
                elseif v.name~='mirror_right' then row(v.name,v.label,nil,nil,nil,v.tip) end
            end
            local content_end=y+u.scroll+8
            local panel_end=math.min(h-80,math.max(160,content_end+16))
            u.properties_rect.h=panel_end-104
            gui.set_screen_position(property_panel,vmath.vector3((rx+140)*u.scale,(h-104-u.properties_rect.h/2)*u.scale,0))
            gui.set_size(property_panel,vmath.vector3(280*u.scale/u.k,u.properties_rect.h*u.scale/u.k,0))
            scrollbar('scroll',w-26,156,panel_end-16,content_end-156)
        else u.scroll,u.max_scroll=0,0 end
        if d.play_error then
            local width=math.max(240,w-528);local lines=wrap('Cannot play: '..d.play_error,width-24,14)
            local height=16+math.min(3,#lines)*20
            u.error_banner={x=216,y=52,w=width,h=height};u.error_text='Cannot play: '..d.play_error
            box(216,52,width,height,C.error)
            for i=1,math.min(3,#lines) do text(228,60+i*20-10,lines[i],C.canvas,14,width-24) end
        else u.error_text=nil end
        box(0,h-64,w,64,C.panel)
        local views={{'view_fit','Fit level [Home]'},{'view_centre','Centre selection [.]'},{'view_start','Go to START'},
            {'view_test','Go to last test start'},{'view_bounds','Show level bounds'},{'view_ghost','Ghost: preview test start (off by default)'}}
        for i,v in ipairs(views) do button(v[1],16+(i-1)*40,h-56,32,v[2],d.on[v[1]],d.reasons[v[1]] or v[2],32,d.reasons[v[1]]~=nil) end
        button('terrain_look',560,h-56,132,d.look and d.look.dirty and 'Terrain Look *' or 'Terrain Look',false,'Terrain Look: level or selected terrain sections. * means preview values need Apply.')
        text(268,h-40,'Grid '..d.grid..' [G]',C.active,12);text(428,h-40,string.format('Zoom %.0f%%',d.zoom*100),C.secondary,12)
        text(16,h-12,d.message~='' and d.message or d.readout,C.secondary,12,w-344)
        text(w-312,h-12,d.cursor_text,C.secondary,12,296)
    else
        if modal~='terrain_look' then box(0,0,w,h,C.canvas) end
        local mw,mh=math.min(1120,w-64),math.min(620,h-64);local mx,my=(w-mw)/2,(h-mh)/2
        if modal=='terrain_look' then mw=420;mh=math.min(580,h-96);mx=w-mw-16;my=16 end
        local panel=box(mx,my,mw,mh,C.panel);u.modal_rect={x=mx,y=my,w=mw,h=mh}
        if modal=='terrain_look' then
            local s=d.look
            text(mx+16,my+24,'Terrain Look',C.active,18)
            button('look_scope_level',mx+16,my+40,120,'Level',s.scope=='level')
            button('look_scope_selected',mx+148,my+40,200,'Selected sections',s.scope=='selected')
            text(mx+16,my+88,s.scope=='level' and (d.look_legacy and 'Legacy unchanged. Level Apply enables perspective.' or (d.play and 'Gym live preview; manual section looks stay intact.' or 'Level defaults; manual section looks stay intact.')) or ('Selected '..#(s.ids or {})..(s.mixed and ': mixed locals; Apply unifies them.' or ' source sections')),C.secondary,12,mw-32)
            local top,bottom=my+104,my+mh-104
            local height=5*44;u.look_max=math.max(0,height-(bottom-top));u.look_scroll=math.max(0,math.min(u.look_max,u.look_scroll or 0))
            for i,spec in ipairs(require('main.terrain_perspective.projection').CONTROLS) do
                local y=top+(i-1)*44-u.look_scroll;local key=spec.key
                if y>=top and y+40<=bottom then
                    local disabled=s.scope=='selected' and (key=='perspective' or key=='angle')
                    local value=s.field and s.field.key==key and (s.field.text..'_') or string.format('%.4g',s.params[key])
                    text(mx+16,y+10,spec.label,disabled and C.secondary or C.text,12,268)
                    button('look_value_'..key,mx+300,y,100,value,false,'Numeric '..spec.label,24,disabled)
                    local r=require('main.terrain_perspective.projection').RANGES[key];local x=mx+16;local width=mw-36
                    local track=box(x,y+30,width,8,C.border);u.buttons['look_slider_'..key]={box=track};u.visible[#u.visible+1]='look_slider_'..key
                    u.rects['look_slider_'..key]={x=x,y=y+24,w=width,h=18}
                    local fraction=(s.params[key]-r[1])/(r[2]-r[1]);box(x+fraction*(width-8),y+26,8,16,disabled and C.secondary or C.active)
                end
            end
            if s.error then paragraph(mx+16,my+mh-96,s.error,mw-32,C.error,12,{my+mh-104,my+mh-40})
            else
                text(mx+16,my+mh-86,'Strength / angle: level-wide. Scroll for all controls.',C.secondary,12,mw-32)
                paragraph(mx+16,my+mh-68,s.dirty and 'Preview only; Apply saves one Undo action.' or ('Applied settings: '..d.status),mw-32,C.secondary,12,{my+mh-84,my+mh-36})
            end
            button('look_reset',mx+16,my+mh-36,92,'Reset',false,'Reset preview; Apply to store. Selected reset restores inheritance.',28)
            button('look_apply',mx+120,my+mh-36,92,'Apply',true,'Store this scope as one Undo action',28)
            button('look_close',mx+mw-104,my+mh-36,88,'Close',false,'Close without resetting settings',28)
        elseif modal=='help' then
            u.help_panel=panel
            for col,lines in ipairs(d.help) do
                local x=mx+20+(col-1)*mw/2
                local y=my+24-(u.help_scroll or 0)
                for _,line in ipairs(lines) do y=paragraph(x,y,line,mw/2-40,C.text,14,{my+16,my+mh-72}) end
                u.help_max=math.max(u.help_max or 0,y+(u.help_scroll or 0)-(my+mh-72))
            end
            button('help_close',mx+mw-148,my+mh-48,128,'Close [Esc]')
        elseif modal=='conflict' then
            paragraph(mx+24,my+36,d.conflict,mw-48,C.text,14)
            button('conflict_source',mx+24,my+mh-56,mw/2-36,'Recompile from source')
            button('conflict_lines',mx+mw/2+12,my+mh-56,mw/2-36,'Keep compiled (as lines)')
        elseif modal=='versions' then
            u.dialog_panel=panel
            text(mx+20,my+24,'Versions — '..d.title,C.text,16,mw-40)
            text(mx+20,my+52,(d.version_error and 'Save failed' or d.version_status)..' · 10 auto + 10 named / level · 16 MiB · Click a row to restore',d.version_error and C.error or C.secondary,12,mw-40)
            for i=1,d.version_per do
                local v=d.version_rows[d.version_page*d.version_per+i]
                if v then
                    local y=my+76+(i-1)*48
                    local label=os.date('%Y-%m-%d %H:%M',v.time)..'  '..v.name..'  ('..v.count..' objects, '..(v.named and 'named' or 'auto')..')'
                    button('restore_'..i,mx+20,y,mw-128,label,false,'Restore: '..label)
                    button('versiondel_'..i,mx+mw-96,y,76,d.version_delete==v.id and 'Sure?' or 'Delete')
                end
            end
            if d.version_page>0 then button('versions_prev',mx+20,my+mh-104,112,'< Newer') end
            if (d.version_page+1)*d.version_per<#d.version_rows then button('versions_next',mx+144,my+mh-104,112,'Older >') end
            paragraph(mx+20,my+mh-148,d.version_error or d.version_message or '',mw-40,d.version_error and C.error or C.secondary,12,{my+mh-160,my+mh-108})
            button('snapshot',mx+20,my+mh-56,mw-188,d.version_name and ('Name: '..d.version_name..'_  [Enter]') or 'Create named snapshot',false,'Type a snapshot name and press Enter')
            button('dialog_close',mx+mw-148,my+mh-56,128,'Close [Esc]')
        elseif modal=='open' then
            u.dialog_panel=panel
            text(mx+20,my+24,d.library_title,C.text,14,mw/2-40);text(mx+mw/2+20,my+24,'Templates (open as a copy)',C.text)
            for i,v in ipairs(d.library_rows) do
                local y=my+48+(i-1)*44
                button('lib_'..i,mx+20,y,mw/2-124,v.title,false,v.title)
                if v.remove then button('libdel_'..i,mx+mw/2-96,y,76,v.confirm and 'Sure?' or 'Delete') end
            end
            for i,v in ipairs(d.template_rows) do button(v.name,mx+mw/2+20,my+48+(i-1)*44,mw/2-40,v.title,false,v.title) end
            paragraph(mx+20,my+mh-140,d.dialog_message or '',mw-40,(d.dialog_message or ''):lower():find('failed') and C.error or C.secondary,12,{my+mh-144,my+mh-100})
            if d.page>0 then button('lib_newer',mx+20,my+mh-96,112,'< Newer') end
            if d.library_more then button('lib_older',mx+144,my+mh-96,112,'Older >') end
            if d.tpl_page>0 then button('tpl_prev',mx+mw/2+20,my+mh-96,120,'< Previous') end
            if d.template_more then button('tpl_next',mx+mw/2+152,my+mh-96,120,'More >') end
            button('dialog_close',mx+mw-148,my+mh-48,128,'Close [Esc]')
        else
            text(mx+20,my+24,d.diagnostics,C.text)
            for i,v in ipairs(d.problems) do
                local name='warn_'..i;local y=my+56+(i-1)*54
                button(name,mx+20,y,mw-40,'',false,v.text,48)
                paragraph(mx+28,y+13,(v.error and 'Error: ' or 'Warning: ')..v.text..(v.located and '  -> show' or ''),mw-70,v.error and C.error or C.selected,12)
            end
            if d.warn_page>0 then button('warn_prev',mx+20,my+mh-48,96,'<') end
            if d.warning_more then button('warn_next',mx+128,my+mh-48,96,'>') end
            button('open',mx+mw-280,my+mh-48,120,'Open')
            button('warnings',mx+mw-148,my+mh-48,128,'Close [Esc]')
        end
    end
    if not modal and not d.play and u.pointer and inside(u.status_rect,u.pointer[1],u.pointer[2]) then u.hover,u.tip='status',d.status end
    if d.field and not u.hover and u.tips[d.field.key] then
        u.hover,u.tip=d.field.key,u.tips[d.field.key]
    end
    u.tooltip_text=nil
    if u.hover~=u.previous_hover then u.hover_at=d.now;u.previous_hover=u.hover end
    if u.hover and d.now-(u.hover_at or d.now)>=.5 and u.pointer then
        local area=M.usable(u)
        local left,right=modal and 16 or area.x0/u.scale,modal and w-16 or area.x1/u.scale
        local tw=math.min(336,right-left-16);local tx=math.max(left+8,math.min(right-tw-8,u.pointer[1]+16))
        local lines=wrap(u.tip,tw-24,12);local th=16+#lines*16;local ty=math.max(16,math.min(h-th-80,u.pointer[2]+24))
        box(tx-1,ty-1,tw+2,th+2,C.border);box(tx,ty,tw,th,C.panel)
        paragraph(tx+12,ty+16,u.tip,tw-24,C.text,12)
        u.tooltip_text=u.tip
    end
    for i=u.nb+1,#u.boxes do gui.set_size_mode(u.boxes[i],gui.SIZE_MODE_MANUAL);gui.set_enabled(u.boxes[i],false) end
    for i=u.nt+1,#u.texts do gui.set_enabled(u.texts[i],false) end
end
return M
