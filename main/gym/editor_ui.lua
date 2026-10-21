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
    local u={boxes={},texts={},buttons={},visible={},rects={},scroll=0,tools=false,properties=false,prefabs=false}
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
    u.buttons,u.visible,u.rects={},{},{}
end
function M.size(u)
    local w,h=window.get_size()
    -- Desktop sizes keep the approved CSS-pixel chrome. Tiny windows remain accessible by scaling
    -- the same desktop layout, without claiming a mobile-authoring UI.
    local density=html5 and tonumber(html5.run("(function(){var c=document.querySelector('canvas');return c&&c.clientWidth?c.width/c.clientWidth:1;})()")) or 1
    if not density or density<=0 or density~=density then density=1 end
    u.scale=density*math.min(1,math.max(1,w)/density/1280,math.max(1,h)/density/720)
    u.w,u.h=math.max(1,w)/u.scale,math.max(1,h)/u.scale
    return u.w,u.h
end
function M.usable(u)
    local w,h=M.size(u);local s=u.scale
    return {x0=(u.tools and 72 or 216)*s,x1=(w-(u.properties and 72 or 312))*s,y0=80*s,y1=(h-124)*s}
end
function M.pointer(u,action)
    if action.screen_x then u.pointer={action.screen_x/u.scale,u.h-action.screen_y/u.scale} end
end
function M.area(u,action)
    local p=action.screen_x and {action.screen_x/u.scale,u.h-action.screen_y/u.scale} or u.pointer
    if not p then return nil end
    if p[2]<124 or p[2]>u.h-80 then return 'chrome' end
    if p[1]<(u.tools and 56 or 200) then return 'tools' end
    if p[1]>u.w-(u.properties and 56 or 296) then return 'properties' end
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
function M.play(u,k,message)
    M.hide(u);M.size(u)
    local n=u.texts[1]
    gui.set_enabled(n,true);gui.set_text(n,'Edit level [E]');gui.set_color(n,C.secondary)
    gui.set_screen_position(n,vmath.vector3(16*u.scale,53*u.scale,0))
    local scale=12/14*u.scale/k;gui.set_scale(n,vmath.vector3(scale,scale,1))
    if message and message~='' then
        local value=shorten(message,u.w-32,14);local m=u.texts[2]
        gui.set_enabled(m,true);gui.set_text(m,value);gui.set_color(m,C.error)
        gui.set_screen_position(m,vmath.vector3(math.max(16,(u.w-#value*8)/2)*u.scale,(u.h-94)*u.scale,0))
        scale=u.scale/k;gui.set_scale(m,vmath.vector3(scale,scale,1))
    end
end
function M.render(u,d)
    local w,h=M.size(u);u.k=d.k;u.nb,u.nt=0,0;u.buttons,u.visible,u.rects,u.tips={},{},{},{}
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
        local r={x=x,y=y,w=bw,h=bh};local hover=u.pointer and inside(r,u.pointer[1],u.pointer[2])
        if hover then box(x-1,y-1,bw+2,bh+2,C.hover) end
        local b=box(x,y,bw,bh,active and C.active or C.control)
        gui.set_texture(b,'editor_control');gui.set_slice9(b,vmath.vector4(4,4,4,4))
        local danger=name=='delete' or name:match('^libdel_') or label:match('^Sure%?')
        local t=text(x+8,y+bh/2,label,danger and C.error or disabled and colour('b0c3cc',.6) or active and C.canvas or C.text,14,bw-12)
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
    -- Modal contents share the same pools; no underlying text can render above a modal box.
    if not modal then
        box(0,0,w,64,C.panel);text(20,28,'RIDER',C.active,18);text(100,28,'/ Level editor',C.secondary)
        text(258,26,d.title,C.text,18,math.max(160,w-610));text(258,49,d.status,d.status:lower():find('failed') and C.error or d.status:lower():find('only') and C.selected or C.active,12,math.max(160,w-610))
        for i,v in ipairs({{'new','New',60},{'open','Open',68},{'import','Import',76},{'export','Export',76}}) do
            local x=({w-320,w-252,w-176,w-92})[i];button(v[1],x,16,v[3],v[2])
        end
        button('undo',16,76,92,'Undo');button('redo',116,76,76,'Redo');button('play',200,76,112,'Play [E]',true)
        text(340,92,'Edit mode',C.active)
        button('warnings',w-284,76,160,d.diagnostics,false,'Show problems; click a located row to select and centre its source')
        button('view_help',w-116,76,100,'Help [H]')
        local lw=u.tools and 40 or 184
        box(16,124,lw,h-204,C.panel);button('collapse_tools',28,132,lw-24,u.tools and '>' or 'TOOLS  <',false,'Collapse or expand Tools')
        if not u.tools then
            local labels={'Select [S]','Draw [D]','Curve [C]','Prefab [P]','START','FINISH','Label [L]','Pan'}
            for i,tool in ipairs(d.tools) do
                local x,y=28+(i-1)%2*80,172+math.floor((i-1)/2)*42
                button('tool_'..tool[1],x,y,76,labels[i]:match('^[^ ]+'),d.tool==tool[1],labels[i],36)
                local key=labels[i]:match('%[(%w)%]');if key then text(x+62,y+7,key,d.tool==tool[1] and C.canvas or C.secondary,12) end
            end
            button('collapse_prefabs',28,344,160,u.prefabs and 'PREFABS  >' or 'PREFABS  v',false,'Collapse or expand the prefab library')
            if not u.prefabs then
                for i,kind in ipairs(d.kinds) do
                    local x,y=28+(i-1)%2*80,384+math.floor((i-1)/2)*56
                    button('kind_'..kind,x,y,76,'',false,tostring(i)..': '..d.full_names[kind]..' — click to place; Esc cancels',52)
                    thumb(kind,x+18,y+5);text(x+8,y+42,shorten(d.names[kind],64,12),kind==d.prefab_kind and C.selected or C.text,12)
                end
            end
        end
        local rx=w-(u.properties and 56 or 296)
        box(rx,124,u.properties and 40 or 280,h-204,C.panel)
        button('collapse_properties',rx+12,132,u.properties and 20 or 256,u.properties and '<' or 'PROPERTIES  >',false,'Collapse or expand Properties')
        if not u.properties then
            local clip={176,h-96};local start=190;local y=start-u.scroll
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
                        button('mode_angle',rx+16,y+12,120,'Angle',f.value=='angle')
                        button('mode_height',rx+144,y+12,120,'Height',f.value=='height')
                        -- Existing tests/keyboard actions retain a single choice-field target.
                        u.buttons[f.name]=u.buttons[f.value=='angle' and 'mode_height' or 'mode_angle']
                        u.visible[#u.visible+1]=f.name
                    end
                    y=y+64
                    if f.error then y=paragraph(rx+16,y-8,f.error,248,C.error,12,clip)+8 end
                elseif f.choices then row(f.name,f.label..': '..f.value,nil,nil,nil,'Cycle '..f.label)
                else row(f.name,f.label,f.unit,f.value,f.error) end
            end
            if d.level then row('rename','Name','',''..d.name,d.name_error);row('speed','START speed','m/s',d.speed,d.speed_error);row('test_speed','Test start speed','m/s',d.test_speed)
            elseif d.start_selected then row('speed','START speed','m/s',d.speed,d.speed_error) end
            for i,v in ipairs(d.actions) do
                if v.name=='mirror_left' and d.actions[i+1] and d.actions[i+1].name=='mirror_right' then
                    if y>=clip[1] and y+32<=clip[2] then
                        button('mirror_left',rx+16,y,120,'Mirror <');button('mirror_right',rx+144,y,120,'Mirror >')
                    end
                    y=y+44
                elseif v.name~='mirror_right' then row(v.name,v.label,nil,nil,nil,v.tip) end
            end
            u.max_scroll=math.max(0,y+u.scroll-clip[2]+12)
            u.scroll=math.min(u.scroll,u.max_scroll)
            if u.max_scroll>0 then
                box(w-22,180,2,h-280,C.border)
                local f=math.min(1,(h-280)/(h-280+u.max_scroll))
                box(w-23,180+(h-280)*(1-f)*u.scroll/math.max(1,u.max_scroll),4,math.max(16,(h-280)*f),C.secondary)
            end
        end
        box(0,h-64,w,64,C.panel)
        local views={{'view_fit',16,92,'Fit [Home]'},{'view_centre',116,100,'Centre [.]'},{'view_start',224,68,'START'},
            {'view_test',300,92,'Last test'},{'view_bounds',400,76,'Bounds'},{'view_ghost',484,76,'Ghost'}}
        for _,v in ipairs(views) do button(v[1],v[2],h-56,v[3],v[4],d.on[v[1]],d.reasons[v[1]],32,d.reasons[v[1]]~=nil) end
        text(580,h-40,'Grid '..d.grid..' [G]',C.active,12);text(748,h-40,string.format('Zoom %.0f%%',d.zoom*100),C.secondary,12)
        text(16,h-12,d.message~='' and d.message or d.readout,C.secondary,12,w-344)
        text(w-312,h-12,d.cursor_text,C.secondary,12,296)
    else
        box(0,0,w,h,C.canvas)
        local mw,mh=math.min(1120,w-64),math.min(620,h-64);local mx,my=(w-mw)/2,(h-mh)/2
        local panel=box(mx,my,mw,mh,C.panel);u.modal_rect={x=mx,y=my,w=mw,h=mh}
        if modal=='help' then
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
        elseif modal=='open' then
            u.dialog_panel=panel
            text(mx+20,my+24,d.library_title,C.text,14,mw/2-40);text(mx+mw/2+20,my+24,'Templates (open as a copy)',C.text)
            for i,v in ipairs(d.library_rows) do
                local y=my+48+(i-1)*44
                button('lib_'..i,mx+20,y,mw/2-124,v.title,false,v.title)
                if v.remove then button('libdel_'..i,mx+mw/2-96,y,76,v.confirm and 'Sure?' or 'Delete') end
            end
            for i,v in ipairs(d.template_rows) do button(v.name,mx+mw/2+20,my+48+(i-1)*44,mw/2-40,v.title,false,v.title) end
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
    if not modal and u.pointer and inside({x=258,y=36,w=math.max(160,w-610),h=24},u.pointer[1],u.pointer[2]) then u.hover,u.tip='status',d.status end
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
