-- Decorations anchored to the track (level visuals contract). Pure: source model, validation and anchor
-- resolution on compiled samples. Decorations never reach collision, physics or replay.
local dense=require 'main.game.dense'
local M={VERSION=1,COMPILED_VERSION=1,MAX_ITEMS=512,MAX_OFFSET=8,MAX_DISTANCE=100000,PLACEMENTS={behind=true,front=true,body=true}}
local ITEM={id=true,source=true,distance=true,offset=true,placement=true,tilt=true,asset=true}
local function number(n,limit) return type(n)=='number' and n==n and math.abs(n)<=limit end
local ASSETS=require('main.decorations.assets').ASSETS
local function unknown(t,allowed,what)
    for k in pairs(t) do if not allowed[k] then return 'Unknown '..what..' field '..tostring(k):sub(1,40) end end
end
-- The authored block. A source that no longer exists stays valid here: the anchor is then unresolved.
function M.validate(b)
    if b==nil then return true end
    if type(b)~='table' or b.version~=M.VERSION then return nil,'Unsupported decorations version; keep the original file.',true end
    local why=unknown(b,{version=true,next_id=true,items=true},'decorations')
    if why then return nil,why,true end
    if type(b.next_id)~='number' or b.next_id<1 or b.next_id%1~=0 then return nil,'Invalid decoration next_id' end
    local n,err=dense.length(b.items,M.MAX_ITEMS)
    if not n then return nil,'Decorations are limited to '..M.MAX_ITEMS..' in a dense list: '..tostring(err) end
    local ids={}
    for _,o in ipairs(b.items) do
        if type(o)~='table' then return nil,'Invalid decoration' end
        why=unknown(o,ITEM,'decoration')
        if why then return nil,why,true end
        local id=type(o.id)=='string' and tonumber(o.id:match('^d(%d+)$'))
        if not id or id>=b.next_id or ids[o.id] then return nil,'Invalid or duplicate decoration id '..tostring(o.id):sub(1,40) end
        ids[o.id]=true
        if type(o.source)~='string' or not o.source:match('^o%d+$') then return nil,'Invalid decoration source: '..o.id end
        if not number(o.distance,M.MAX_DISTANCE) or o.distance<0 then return nil,'Invalid decoration position along the run: '..o.id end
        if not number(o.offset,M.MAX_OFFSET) then return nil,'Decoration offset is limited to '..M.MAX_OFFSET..' m: '..o.id end
        if not M.PLACEMENTS[o.placement] then return nil,'Decoration placement must be behind, front or body: '..o.id,true end
        if type(o.tilt)~='boolean' then return nil,'Invalid decoration tilt: '..o.id end
        if type(o.asset)~='string' or not ASSETS[o.asset] then return nil,'Unknown decoration asset '..tostring(o.asset):sub(1,40),true end
    end
    return true
end
-- Compiled form: resolved world transforms only; the anchors stay in the editor block.
function M.validate_compiled(c)
    if c==nil then return true end
    if type(c)~='table' or c.version~=M.COMPILED_VERSION then return nil,'Unsupported compiled decorations version',true end
    local why=unknown(c,{version=true,items=true},'compiled decorations')
    if why then return nil,why,true end
    local n,err=dense.length(c.items,M.MAX_ITEMS)
    if not n then return nil,'Decorations are limited to '..M.MAX_ITEMS..' in a dense list: '..tostring(err) end
    for _,o in ipairs(c.items) do
        if type(o)~='table' then return nil,'Invalid compiled decoration' end
        why=unknown(o,{position=true,angle=true,placement=true,asset=true},'compiled decoration')
        if why then return nil,why,true end
        if type(o.position)~='table' or #o.position~=2 or not number(o.position[1],200000) or not number(o.position[2],200000) then return nil,'Invalid compiled decoration position' end
        if not number(o.angle,math.pi) or not M.PLACEMENTS[o.placement] then return nil,'Invalid compiled decoration' end
        if type(o.asset)~='string' or not ASSETS[o.asset] then return nil,'Unknown decoration asset '..tostring(o.asset):sub(1,40),true end
    end
    return true
end
-- Length of a terrain source's open polylines; a gap between parts adds nothing.
function M.length(parts)
    local total=0
    for _,part in ipairs(parts or {}) do
        for i=2,#part do total=total+math.sqrt((part[i][1]-part[i-1][1])^2+(part[i][2]-part[i-1][2])^2) end
    end
    return total
end
-- Anchor -> x, y, angle on the source's samples, or nil when the source is shorter than the distance.
-- Distance runs from the source's entry; a positive offset lies on the upper side of the line. Tilt follows
-- the segment, read left to right so a run drawn right to left does not stand decorations on their heads.
function M.resolve(parts,distance,offset,tilt)
    local left=distance
    local last
    for _,part in ipairs(parts or {}) do
        for i=2,#part do
            local a,b=part[i-1],part[i]
            local dx,dy=b[1]-a[1],b[2]-a[2]
            local l=math.sqrt(dx*dx+dy*dy)
            if l>0 then
                last={a,b,dx,dy,l}
                if left<=l then break end
                left=left-l;last.done=true
            end
        end
        if last and not last.done then break end
    end
    if not last or (last.done and left>1e-9) then return nil end
    local a,dx,dy,l=last[1],last[3],last[4],last[5]
    local t=last.done and 1 or left/l
    if dx<0 or (dx==0 and dy<0) then dx,dy=-dx,-dy end
    local nx,ny=-dy/l,dx/l
    return a[1]+last[3]*t+nx*offset,a[2]+last[4]*t+ny*offset,tilt and math.atan2(dy,dx) or 0
end
-- The authored block -> compiled block. parts_of(source id) gives the source's polylines or nil. Unresolved
-- anchors are left out of Play; the source block keeps them. No block compiles to no block.
function M.compile(b,parts_of)
    if not b or #b.items==0 then return nil end
    local items={}
    for _,o in ipairs(b.items) do
        local x,y,angle=M.resolve(parts_of(o.source),o.distance,o.offset,o.tilt)
        if x then items[#items+1]={position={x,y},angle=angle,placement=o.placement,asset=o.asset} end
    end
    return {version=M.COMPILED_VERSION,items=items}
end
return M
