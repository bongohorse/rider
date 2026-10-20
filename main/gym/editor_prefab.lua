-- Level editor prefabs (LE5a, LE5b; contract "Prefab library v1"). Pure: kinds, defaults, ranges,
-- geometry, handles and mirroring of the seven static prefab types. Metres and degrees throughout.
-- A prefab object is {id, type="prefab", kind, at={x,y}, params={...}}. The parameters are the source
-- (R1); the geometry is derived from them. `at` is the entry (the left end; a Platform's bottom-left
-- corner). Terrain prefabs are pieces of a run like lines; a Platform is a separate hull obstacle.
local sample=require "main.gym.editor_sample"
local M={}
M.ORDER={"flat","ramp","step","gap","kicker","platform","wave"}
-- Fields in panel order. A number field has a unit and an inclusive range (magnitude: the smallest
-- allowed absolute value; zero: 0 is allowed below the range; integer: whole numbers only); a choice
-- field cycles through its choices. `when` leaves a field out of the
-- parameters (the ramp stores only the value of its input mode); `show` only hides it in the panel.
local function angle_mode(p) return p.mode=="angle" end
local function height_mode(p) return p.mode=="height" end
local function sloped(p) return p.landing~="flat" end
M.KINDS={
    flat={name="Flat",fields={{key="length",label="Length",unit="m",min=0.5,max=200}},defaults={length=10}},
    ramp={name="Ramp",fields={{key="mode",label="Input",choices={"angle","height"}},{key="length",label="Length",unit="m",min=0.5,max=100},
        {key="angle",label="Angle",unit="deg",min=-60,max=60,when=angle_mode},{key="height",label="Height",unit="m",min=-50,max=50,when=height_mode}},
        defaults={mode="angle",length=4,angle=15}},
    -- A riser and a tread (LE5b, Claudio's LE5a drive test: a bare riser looked like a plain line). The
    -- riser stands at the start or the end of the tread; tread 0 is a bare riser (LE5a steps).
    step={name="Step",fields={{key="riser",label="Riser at",choices={"start","end"}},{key="height",label="Height",unit="m",min=-20,max=20,magnitude=0.05},
        {key="length",label="Tread",unit="m",min=0.5,max=50,zero=true}},defaults={riser="start",height=0.5,length=4}},
    gap={name="Gap with pit",fields={{key="width",label="Width",unit="m",min=0.5,max=20},{key="depth",label="Pit depth",unit="m",min=0.2,max=20}},
        defaults={width=2,depth=3}},
    kicker={name="Kicker + landing",fields={{key="facing",label="Jumps",choices={"right","left"}},{key="angle",label="Kicker angle",unit="deg",min=5,max=60},
        {key="lip",label="Lip height",unit="m",min=0.1,max=5},{key="gap",label="Gap",unit="m",min=0.5,max=20},
        {key="landing",label="Landing",choices={"flat","down","up"}},{key="landing_length",label="Landing length",unit="m",min=0.5,max=50},
        {key="landing_angle",label="Landing angle",unit="deg",min=1,max=45,show=sloped}},
        defaults={facing="right",angle=15,lip=1,gap=2,landing="flat",landing_length=6,landing_angle=15}},
    platform={name="Platform",fields={{key="width",label="Width",unit="m",min=0.5,max=50},{key="height",label="Height",unit="m",min=0.2,max=20}},
        defaults={width=6,height=1}},
    -- LE5b: smooth cosine bumps (negative height: dips), sampled per R8 (editor_sample).
    wave={name="Bump/wave",fields={{key="height",label="Height",unit="m",min=-10,max=10,magnitude=0.05},{key="wavelength",label="Wavelength",unit="m",min=1,max=100},
        {key="count",label="Count",unit="",min=1,max=50,integer=true}},defaults={height=1,wavelength=8,count=1}},
}
-- A ramp steeper than this is a Step (contract: vertical drops use Step).
M.MAX_RAMP=60
function M.terrain(kind) return M.KINDS[kind]~=nil and kind~="platform" end
function M.name(kind) return M.KINDS[kind] and M.KINDS[kind].name or tostring(kind) end
local function copy(t) local r={};for k,v in pairs(t) do r[k]=v end;return r end
function M.defaults(kind) return copy(M.KINDS[kind].defaults) end
local function fmt(v) return (string.format("%.2f",v):gsub("0+$",""):gsub("%.$","")) end
local function tan(a) return math.tan(math.rad(a)) end
-- Signed ramp rise and angle, whichever input mode stores them.
function M.rise(p) if p.mode=="height" then return p.height end;return p.length*tan(p.angle) end
function M.slope(p) if p.mode=="angle" then return p.angle end;return math.deg(math.atan2(p.height,p.length)) end
local function landing_rise(p)
    if p.landing=="flat" then return 0 end
    local r=p.landing_length*tan(p.landing_angle)
    return p.landing=="down" and -r or r
end
-- Horizontal length of the kicker ramp and x of the landing start (facing right, from the entry).
function M.kicker_length(p) return p.lip/tan(p.angle) end
-- Fields stored in a parameter set; shown=true leaves out those the panel hides.
function M.fields(kind,p,shown)
    local list={}
    for _,f in ipairs(M.KINDS[kind].fields) do
        if (not f.when or f.when(p)) and not (shown and f.show and not f.show(p)) then list[#list+1]=f end
    end
    return list
end
local function field(kind,key) for _,f in ipairs(M.KINDS[kind].fields) do if f.key==key then return f end end end
function M.field(kind,key) return field(kind,key) end
-- Parameter validation (R16): every visible field present and in range, nothing else. Returns nil and
-- an actionable message for the first problem.
function M.check(kind,p)
    local spec=M.KINDS[kind]
    if not spec then return nil,"unknown prefab type "..tostring(kind) end
    if type(p)~="table" then return nil,"missing parameters" end
    local seen={}
    for _,f in ipairs(spec.fields) do
        local v=p[f.key]
        if f.choices then
            local ok=false
            for _,c in ipairs(f.choices) do ok=ok or v==c end
            if not ok then return nil,f.label.." must be one of "..table.concat(f.choices,", ") end
            seen[f.key]=true
        end
    end
    for _,f in ipairs(M.fields(kind,p)) do
        local v=p[f.key]
        if not f.choices then
            if type(v)~="number" or v~=v or math.abs(v)==math.huge then return nil,f.label.." needs a number in "..f.unit end
            if not (f.zero and v==0) and (v<f.min-1e-9 or v>f.max+1e-9) then
                return nil,string.format("%s must be %sfrom %s to %s %s (got %s).",f.label,f.zero and "0 or " or "",fmt(f.min),fmt(f.max),f.unit,fmt(v))
            end
            if f.magnitude and math.abs(v)<f.magnitude-1e-9 then return nil,string.format("%s must be at least %s %s up or down (got %s).",f.label,fmt(f.magnitude),f.unit,fmt(v)) end
            if f.integer and v%1~=0 then return nil,string.format("%s must be a whole number (got %s).",f.label,fmt(v)) end
        end
        seen[f.key]=true
    end
    for k in pairs(p) do if not seen[k] then return nil,"unexpected parameter "..tostring(k) end end
    if kind=="ramp" and p.mode=="height" and math.abs(p.height)>p.length*tan(M.MAX_RAMP)+1e-9 then
        return nil,string.format("A %s m rise over %s m is steeper than %d deg: lengthen the ramp or use a Step.",fmt(p.height),fmt(p.length),M.MAX_RAMP)
    end
    return true
end
-- Canonical geometry: facing right, entry at the origin, open parts left to right. A Kicker + landing
-- has two parts with an open gap between them (no floor): the kicker (ramp up to the lip, back wall
-- down to entry level) and the landing. Every other terrain prefab is one part.
local function canonical(kind,p)
    if kind=="flat" then return {{{0,0},{p.length,0}}}
    elseif kind=="ramp" then return {{{0,0},{p.length,M.rise(p)}}}
    elseif kind=="step" then
        if p.length==0 then return {{{0,0},{0,p.height}}} end
        if p.riser=="end" then return {{{0,0},{p.length,0},{p.length,p.height}}} end
        return {{{0,0},{0,p.height},{p.length,p.height}}}
    elseif kind=="wave" then return {M.wave_points(p)}
    elseif kind=="gap" then return {{{0,0},{0,-p.depth},{p.width,-p.depth},{p.width,0}}}
    end
    local kx=M.kicker_length(p)
    local x0=kx+p.gap
    return {{{0,0},{kx,p.lip},{kx,0}},{{x0,0},{x0+p.landing_length,landing_rise(p)}}}
end
-- Facing left is the mirror image, re-anchored so its left end (the canonical exit) is the entry:
-- (x, y) -> (X - x, y - Y), parts and points reversed so they still run left to right.
local function exit_of(parts) local last=parts[#parts];return last[#last] end
local function face(parts,left)
    if not left then return parts end
    local e=exit_of(parts)
    local X,Y=e[1],e[2]
    local out={}
    for i=#parts,1,-1 do
        local part,q=parts[i],{}
        for j=#part,1,-1 do q[#q+1]={X-part[j][1],part[j][2]-Y} end
        out[#out+1]=q
    end
    return out
end
local function to_world(p,at,left,X,Y)
    if left then return {at[1]+(X-p[1]),at[2]+(p[2]-Y)} end
    return {at[1]+p[1],at[2]+p[2]}
end
-- Bump/wave samples in local coordinates (R8), cached by parameters. Over the sampling budget the shape
-- is drawn coarsely (8 points per wavelength) and M.sample_error names the problem; Play stays blocked.
local waves,wave_order={},{}
local function wave_samples(p)
    local key=string.format("%.17g|%.17g|%.17g",p.height,p.wavelength,p.count)
    local hit=waves[key]
    if hit then return hit end
    local pts=sample.wave(p.height,p.wavelength,p.count)
    local entry={points=pts}
    if not pts then
        entry.points={}
        for i=0,8*p.count do local x=i*p.wavelength/8;entry.points[#entry.points+1]={x,p.height/2*(1-math.cos(2*math.pi*x/p.wavelength))} end
        entry.points[#entry.points][2]=0
        entry.error=true
    end
    waves[key]=entry;wave_order[#wave_order+1]=key
    if #wave_order>64 then waves[table.remove(wave_order,1)]=nil end
    return entry
end
function M.wave_points(p) return wave_samples(p).points end
-- Convert to editable path (LE5c, changed in LE5d): a Bump/wave becomes curve anchors at its ends, crests
-- and troughs (2 x count + 1), smooth with horizontal tangents of WAVE_TANGENT x the half wavelength (the
-- ends have one tangent). On each half wave the cubic's height is exactly h(3t^2 - 2t^3) for any tangent
-- length; 0.364 minimises its distance to the raised cosine (measured: 0.25 mm at 1 m x 8 m, 2.5 mm at the
-- 10 m x 100 m range corner, scaling with the size). World coordinates; a wave always runs to the right.
M.WAVE_TANGENT=0.364
function M.wave_anchors(o)
    local p,at=o.params,o.at
    local half=p.wavelength/2
    local t=M.WAVE_TANGENT*half
    local list={}
    for k=0,2*p.count do
        local y=k%2==1 and p.height or 0
        list[#list+1]={p={at[1]+k*half,at[2]+y},["in"]={k>0 and -t or 0,0},out={k<2*p.count and t or 0,0},mode="smooth"}
    end
    return list
end
function M.sample_error(o)
    if o.kind=="wave" and wave_samples(o.params).error then
        return string.format("needs more than %d points at %s mm / %s m sampling: reduce its count or wavelength",sample.MAX_POINTS,fmt(sample.TOLERANCE*1000),fmt(sample.MAX_SEGMENT))
    end
end
-- World geometry: {parts} for a terrain prefab, {outline} (closed, CCW) for a Platform.
function M.geometry(o)
    local p,a=o.params,o.at
    if o.kind=="platform" then
        return {outline={{a[1],a[2]},{a[1]+p.width,a[2]},{a[1]+p.width,a[2]+p.height},{a[1],a[2]+p.height}}}
    end
    local parts=face(canonical(o.kind,p),p.facing=="left")
    local world={}
    for i,part in ipairs(parts) do
        local q={};for j,v in ipairs(part) do q[j]={a[1]+v[1],a[2]+v[2]} end;world[i]=q
    end
    return {parts=world}
end
-- Every point, entry to exit (a Platform: its outline).
function M.path(o)
    local g=M.geometry(o)
    if g.outline then return g.outline end
    local list={}
    for _,part in ipairs(g.parts) do for _,q in ipairs(part) do list[#list+1]=q end end
    return list
end
local COUNT={flat=2,ramp=2,gap=4,kicker=5,platform=4}
-- Source points (validator limits): a wave counts its samples.
function M.count(o) return COUNT[o.kind] or #M.path(o) end
-- Object validation for the source validator: known kind, finite position, valid parameters and a
-- geometry inside the editor's coordinate limit.
function M.validate(o,finite)
    if not M.KINDS[o.kind] then return nil,"unknown prefab type "..tostring(o.kind) end
    local a=o.at
    if type(a)~="table" or #a~=2 or not finite(a[1]) or not finite(a[2]) then return nil,"invalid position" end
    local ok,err=M.check(o.kind,o.params)
    if not ok then return nil,err end
    for _,q in ipairs(M.path(o)) do if not finite(q[1]) or not finite(q[2]) then return nil,"geometry outside the coordinate limit" end end
    return true
end
-- Handles in canonical coordinates. "end" sits on the exit of every one-part terrain prefab and of a
-- Kicker + landing facing right.
local function canonical_handles(kind,p)
    if kind=="flat" then return {{name="end",p={p.length,0},label="length"}}
    elseif kind=="ramp" then return {{name="end",p={p.length,M.rise(p)},label=p.mode=="angle" and "length, angle" or "length, height"}}
    elseif kind=="step" then return {{name="end",p={p.length,p.height},label=p.length>0 and "tread, height" or "height"}}
    elseif kind=="wave" then
        return {{name="end",p={p.wavelength*p.count,0},label="wavelength"},{name="crest",p={p.wavelength/2,p.height},label="height"}}
    elseif kind=="gap" then return {{name="end",p={p.width,0},label="width"},{name="floor",p={p.width/2,-p.depth},label="pit depth"}}
    elseif kind=="platform" then return {{name="corner",p={p.width,p.height},label="width, height"}}
    end
    local kx=M.kicker_length(p)
    local x0=kx+p.gap
    -- Jumping left, the landing side holds the entry: the gap handle sits on the kicker's back-wall foot,
    -- the side that moves.
    return {{name="lip",p={kx,p.lip},label="lip height, kicker angle"},{name="gap",p=p.facing=="left" and {kx,0} or {x0,0},label="gap"},
        {name="end",p={x0+p.landing_length,landing_rise(p)},label=p.landing=="flat" and "landing length" or "landing length, angle"}}
end
-- World handles {name, p, label}. A handle on the entry is left out: the entry stays fixed on every
-- parameter change (R4), so it could not follow the cursor (edit that value in the panel).
function M.handles(o)
    local p=o.params
    local left=p.facing=="left"
    local X,Y=0,0
    if left then local e=exit_of(canonical(o.kind,p));X,Y=e[1],e[2] end
    local list={}
    for _,h in ipairs(canonical_handles(o.kind,p)) do
        local q=to_world(h.p,o.at,left,X,Y)
        if o.kind=="platform" or math.abs(q[1]-o.at[1])>1e-9 or math.abs(q[2]-o.at[2])>1e-9 then list[#list+1]={name=h.name,p=q,label=h.label} end
    end
    return list
end
-- Rounding to an exact decimal step (0.1, 0.5, 1, 15): steps below 1 are applied by their inverse.
local function round(v,step)
    if not step then return v end
    if step>=1 then return math.floor(v/step+0.5)*step end
    local inv=math.floor(1/step+0.5)
    return math.floor(v*inv+0.5)/inv
end
M.round=round
local function clamp(kind,key,v)
    local f=field(kind,key)
    v=math.max(f.min,math.min(f.max,v))
    if f.magnitude and math.abs(v)<f.magnitude then v=v<0 and -f.magnitude or f.magnitude end
    return v
end
-- A handle drag: the handle's start position moved by the drag delta d (world metres), converted into
-- parameters. Jumping left only the lip and gap handles exist; both read the delta unmirrored (moving
-- the lip right lengthens the kicker, moving the back wall right widens the gap). Lengths round to steps.length, angles to
-- steps.angle (nil = unrounded); values stop at their range limits. Returns new parameters.
function M.drag(o,name,p0,d,steps)
    local kind,p=o.kind,copy(p0)
    local h
    for _,c in ipairs(canonical_handles(kind,p0)) do if c.name==name then h=c.p end end
    if not h then return p end
    local x,y=h[1]+d[1],h[2]+d[2]
    local L,A=function(v) return round(v,steps.length) end,function(v) return round(v,steps.angle) end
    local function angle_of(dy,dx) return math.deg(math.atan2(dy,math.max(dx,1e-6))) end
    if kind=="flat" then p.length=clamp(kind,"length",L(x))
    elseif kind=="ramp" then
        p.length=clamp(kind,"length",L(x))
        if p.mode=="angle" then p.angle=clamp(kind,"angle",A(angle_of(y,p.length)))
        else
            local limit=p.length*tan(M.MAX_RAMP)
            p.height=math.max(-limit,math.min(limit,clamp(kind,"height",L(y))))
        end
    elseif kind=="step" then
        p.height=clamp(kind,"height",L(y))
        -- A tread shorter than its minimum is no tread: the step becomes a bare riser.
        local l=L(x)
        p.length=l<0.25 and 0 or clamp(kind,"length",l)
    elseif kind=="wave" then
        if name=="end" then p.wavelength=clamp(kind,"wavelength",L(x/p.count)) else p.height=clamp(kind,"height",L(y)) end
    elseif kind=="gap" then
        if name=="end" then p.width=clamp(kind,"width",L(x)) else p.depth=clamp(kind,"depth",L(-y)) end
    elseif kind=="platform" then p.width,p.height=clamp(kind,"width",L(x)),clamp(kind,"height",L(y))
    elseif name=="lip" then
        p.lip=clamp(kind,"lip",L(y))
        p.angle=clamp(kind,"angle",A(angle_of(p.lip,x)))
    elseif name=="gap" then p.gap=clamp(kind,"gap",L(p0.gap+d[1]))
    else
        local x0=M.kicker_length(p)+p.gap
        p.landing_length=clamp(kind,"landing_length",L(x-x0))
        if p.landing~="flat" then p.landing_angle=clamp(kind,"landing_angle",A(angle_of(math.abs(y),p.landing_length))) end
    end
    return p
end
-- A typed value for one number field. Accepts a decimal comma. Returns new parameters, or nil and an
-- actionable message (the previous parameters stay unchanged).
function M.set(kind,p0,key,text)
    local f=field(kind,key)
    local t=tostring(text):match("^%s*(.-)%s*$"):gsub(",","."):gsub("^%+","")
    local v=t:match("^[-+]?%d*%.?%d+$") and tonumber(t) or t:match("^[-+]?%d+%.$") and tonumber(t:sub(1,-2)) or nil
    if not v then return nil,string.format("%s: enter a number in %s, e.g. %s.",f.label,f.unit,fmt(M.KINDS[kind].defaults[key] or f.max)) end
    local p=copy(p0);p[key]=v
    local ok,err=M.check(kind,p)
    if not ok then return nil,err end
    return p
end
-- A choice field steps to its next value. The ramp input mode converts the stored value so the
-- shape stays the same; when the converted value is outside its range the switch is refused (nil and
-- the reason). The other choices change the shape (the entry stays fixed).
function M.cycle(kind,p0,key)
    local f=field(kind,key)
    local p=copy(p0)
    local i=1
    for k,c in ipairs(f.choices) do if c==p[key] then i=k end end
    p[key]=f.choices[i%#f.choices+1]
    if kind=="ramp" then
        if p.mode=="height" then p.height=M.rise(p0);p.angle=nil else p.angle=M.slope(p0);p.height=nil end
        local ok=M.check(kind,p)
        if not ok then
            local f2=field(kind,p.mode)
            return nil,string.format("Input stays %s: the %s would be %s %s, outside %s to %s %s.",p0.mode,f2.label:lower(),fmt(p[p.mode]),f2.unit,fmt(f2.min),fmt(f2.max),f2.unit)
        end
    end
    return p
end
-- Horizontal mirror about x = c2/2: the reflected exit becomes the entry; a ramp or step changes
-- direction (a step's riser moves to the other end), a Kicker + landing jumps the other way, the other
-- shapes (Flat, Gap with pit, Platform, Bump/wave) are symmetric.
function M.mirror(o,c2)
    local n={id=o.id,type="prefab",kind=o.kind,params=copy(o.params)}
    if o.kind=="platform" then n.at={c2-o.at[1]-o.params.width,o.at[2]};return n end
    local path=M.path(o)
    local e=path[#path]
    n.at={c2-e[1],e[2]}
    local p=n.params
    if o.kind=="ramp" then if p.mode=="angle" then p.angle=-p.angle else p.height=-p.height end
    elseif o.kind=="step" then p.height=-p.height;p.riser=p.riser=="end" and "start" or "end"
    elseif o.kind=="kicker" then p.facing=p.facing=="left" and "right" or "left" end
    return n
end
-- Panel text: a field's current value, and derived values that are not fields.
function M.value(f,p)
    local v=p[f.key]
    if f.choices then return tostring(v) end
    if f.integer then return string.format("%d",v) end
    if f.zero and v==0 then return "0 (riser only)" end
    return f.unit=="deg" and string.format("%.1f deg",v) or string.format("%.2f m",v)
end
function M.derived(o)
    local p=o.params
    if o.kind=="ramp" then
        local rise=M.rise(p)
        local lines={p.mode=="angle" and string.format("Height %.2f m (derived)",rise) or string.format("Angle %.1f deg (derived)",M.slope(p)),
            string.format("Slope length %.2f m",math.sqrt(p.length^2+rise^2))}
        lines[#lines+1]=rise>0 and "Climbs to the right" or rise<0 and "Descends to the right" or "Level"
        return lines
    elseif o.kind=="step" then return {(p.height>0 and "Step up" or "Step down")..(p.length>0 and (p.riser=="end" and ", tread first" or ", then tread") or " (riser only)")}
    elseif o.kind=="wave" then
        local pts=M.wave_points(p)
        return {string.format("Length %.2f m, %d samples",p.wavelength*p.count,#pts),p.height>0 and "Bumps (smooth ends)" or "Dips (smooth ends)",
            string.format("Sampled: %s mm, %s m segments",fmt(sample.TOLERANCE*1000),fmt(sample.MAX_SEGMENT))}
    elseif o.kind=="gap" then return {"Pit floor spans the gap"}
    elseif o.kind=="kicker" then
        local kx=M.kicker_length(p)
        return {string.format("Kicker length %.2f m",kx),"Open gap (no floor): two chains",
            p.landing=="flat" and "Landing at entry level" or string.format("Landing %s %.2f m",p.landing=="down" and "drops" or "rises",math.abs(landing_rise(p)))}
    elseif o.kind=="platform" then return {"Separate obstacle (hull)"} end
    return {}
end
return M
