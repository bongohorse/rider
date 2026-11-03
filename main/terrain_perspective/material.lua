-- #392 Stage A: opt-in textured terrain route (Kenney 1.1 atlas, main/terrain_material/).
-- Visual only: never reads or writes collision, physics or level source data.
--
-- TEMPORARY pilot selection (Stage A only): the page URL parameter
--   terrain_material=<family>                 one family for the whole course
--   terrain_material=<left>,<right>@<x>       <left> for intervals whose midpoint is left of x metres, <right> otherwise
-- Stage B replaces this with a versioned per-section field in the level source. Without the
-- parameter every course keeps the untextured 48-byte vertex route, byte for byte.
local M={STRIDE=52,UNTEXTURED_STRIDE=48,FAMILIES={'grass','dirt','sand','snow','stone','purple'},
    -- Face index = atlas column (manifest slot order): surface, rim, side, end.
    SURFACE=0,RIM=1,SIDE=2,END=3}
-- Neutral face shading (equal RGB): the texture keeps its own colour (Snow stays white);
-- selection/hover gains from terrain_mesh.colors multiply these base values.
M.SHADE={[0]=1,[1]=1,[2]=.86,[3]=.74}
-- Metres per tile along the arc (must match textured.vp).
M.PERIOD={[0]=.9,[1]=.9,[2]=1}
local SELECT_GAIN={1.6,.95,.5}
local INDEX={};for i,f in ipairs(M.FAMILIES) do INDEX[f]=i-1 end

function M.parse(text)
    if type(text)~='string' or text=='' then return nil end
    if #text>64 then return nil,'terrain_material is too long' end
    local one=text:match('^(%a+)$')
    if one then
        if not INDEX[one] then return nil,'Unknown terrain material '..one end
        return {left=INDEX[one],right=INDEX[one],boundary=math.huge,text=text}
    end
    local left,right,x=text:match('^(%a+),(%a+)@(%-?%d+%.?%d*)$')
    x=tonumber(x)
    if not left or not x or x~=x or math.abs(x)>1e6 then return nil,'Use terrain_material=<family> or <left>,<right>@<x metres>' end
    if not INDEX[left] then return nil,'Unknown terrain material '..left end
    if not INDEX[right] then return nil,'Unknown terrain material '..right end
    return {left=INDEX[left],right=INDEX[right],boundary=x,text=text}
end
-- Read once per page load; the selection never changes while the engine runs.
function M.spec()
    if M.override~=nil then return M.override or nil end
    if M.cached==nil then
        local text=html5 and html5.run("new URLSearchParams(location.search).get('terrain_material')||''") or ''
        local spec,err=M.parse(text)
        if err then print('RIDER_TERRAIN_MATERIAL ignored: '..err) end
        M.cached=spec or false
        M.error=err
    end
    return M.cached or nil
end
function M.stride() return M.spec() and M.STRIDE or M.UNTEXTURED_STRIDE end
function M.describe()
    local s=M.spec()
    return {active=s~=nil,text=s and s.text or false,stride=M.stride(),error=M.error or false,
        left=s and M.FAMILIES[s.left+1] or false,right=s and M.FAMILIES[s.right+1] or false,
        boundary=s and s.boundary~=math.huge and s.boundary or false}
end

-- Adds one float per vertex (family*4+face) to a perspective section built by projection.section,
-- gives end caps a 0..1 depth U and neutral face shading. Positions, look_data and partition stay exactly
-- as built; the arc-length U of the other faces differs by whole tiles per quad (see bound below).
function M.apply(c,prep,first,last,spec,styles)
    local p=prep.p
    local slot,uv,base,color={},c.uv,c.base_colors,c.color
    c.texture=slot
    local function paint(vertex,family,face,interval)
        slot[vertex]=family*4+face
        local state=styles and styles[interval] or 0
        local k=(vertex-1)*4
        for j=1,3 do
            local v=M.SHADE[face];base[k+j]=v
            color[k+j]=state==1 and v*SELECT_GAIN[j] or state==2 and v*1.2 or v
        end
    end
    local function family(i) return (p[i][1]+p[i+1][1])/2<spec.boundary and spec.left or spec.right end
    -- Quads share no vertices: drop whole tiles from each quad's U (units of 4 m) so the shader's tile U stays
    -- within about 1 + segment/period. Its fract() is unchanged, so the pattern stays continuous.
    local function bound(first_vertex,period)
        local tiles=4/period
        local start=math.huge
        for j=0,5 do start=math.min(start,uv[(first_vertex+j-1)*2+1]) end
        local whole=math.floor(start*tiles)/tiles
        for j=0,5 do local k=(first_vertex+j-1)*2+1;uv[k]=uv[k]-whole end
    end
    for i=first,last-1 do
        local n,f=(i-first)*18,family(i)
        for j=1,6 do paint(n+j,f,M.SIDE,i);paint(n+6+j,f,M.RIM,i);paint(n+12+j,f,M.SURFACE,i) end
        bound(n+1,M.PERIOD[M.SIDE]);bound(n+7,M.PERIOD[M.RIM]);bound(n+13,M.PERIOD[M.SURFACE])
    end
    -- Caps: quad(e,{e,depth},{bottom,depth},bottom) emits a,b,c,a,c,d; U runs front (0) to back (1).
    local n,depth_u=(last-first)*18,{0,1,1,0,1,0}
    for _,i in ipairs({first==1 and first or false,last==#p and last or false}) do if i then
        local interval=i==1 and 1 or i-1
        local f=family(interval)
        for j=1,6 do paint(n+j,f,M.END,interval);uv[(n+j-1)*2+1]=depth_u[j] end
        n=n+6
    end end
    c.textured=true
    c.bytes=c.vertices*M.STRIDE
    return c
end
return M
