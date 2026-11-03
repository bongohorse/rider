-- Pins the editor geometry helpers moved out of editor.gui_script (#331 E1). Every expected value was
-- computed by running the original editor.gui_script functions (main e40cf95); non-round values are
-- exact %.17g literals, so == compares bit for bit.
local G=require 'main.editor.editor_geometry'
local function same(a,b)
    if type(a)~='table' or type(b)~='table' then return a==b end
    for k,v in pairs(a) do if not same(v,b[k]) then return false end end
    for k in pairs(b) do if a[k]==nil then return false end end
    return true
end
local function copy(v)
    if type(v)~='table' then return v end
    local c={} for k,x in pairs(v) do c[k]=copy(x) end
    return c
end
local function both(n,...) return select('#',...)==n and {...} end
local function corner(p) return {p=p,out={0,0},['in']={0,0},mode='corner'} end
local function smooth(p,out,inn,mode) return {p=p,out=out or {0,0},['in']=inn or {0,0},mode=mode or 'smooth'} end
local function nearest(anchors,p)
    local o={anchors=anchors};local before=copy(o);local pb=copy(p)
    local r=both(2,G.curve_nearest(o,p))
    assert(r and same(o,before) and same(p,pb),'curve_nearest returns two values and only reads its arguments')
    return r[1],r[2]
end

-- to_px: metres to screen pixels through a map {ox,oy,ppm_x,ppm_y}; a new table, the point unchanged.
local p,s={2,-3},{ox=10,oy=20,ppm_x=4,ppm_y=-8}
local q=G.to_px(p,s)
assert(same(q,{18,44}) and q~=p and same(p,{2,-3}) and same(s,{ox=10,oy=20,ppm_x=4,ppm_y=-8}))
assert(same(G.to_px({0.1,0.2},{ox=0.3,oy=0,ppm_x=10,ppm_y=10}),{1.3,2}))

-- dist and length: Euclidean, symmetric, zero for equal points and the zero vector.
assert(G.dist({0,0},{3,4})==5 and G.dist({1,1},{1,1})==0 and G.dist({-1,2},{2,-2})==5)
assert(G.dist({0.1,0.2},{0.3,0.7})==0.53851648071345037 and G.dist({0.3,0.7},{0.1,0.2})==0.53851648071345037)
assert(G.length({3,4})==5 and G.length({0,0})==0 and G.length({-6,-8})==10 and G.length({1,1})==math.sqrt(2))

-- seg_t: projection parameter clamped to [0,1]; the squared length is floored at 1e-12, so a
-- zero-length segment gives 0 and a segment shorter than 1e-6 m under-reports t.
assert(G.seg_t({2,5},{0,0},{4,0})==0.5 and G.seg_t({0,2},{0,0},{2,2})==0.5)
assert(G.seg_t({-3,1},{0,0},{4,0})==0 and G.seg_t({9,-1},{0,0},{4,0})==1)
assert(G.seg_t({5,7},{1,1},{1,1})==0 and G.seg_t({-5,-7},{1,1},{1,1})==0)
assert(G.seg_t({1e-8,0},{0,0},{1e-7,0})==0.0009999999999999998 and G.seg_t({1e-5,0},{0,0},{1e-7,0})==1)
assert(G.seg_t({1e-7,0},{0,0},{1e-6,0})==0.099999999999999992)
assert(G.seg_t({0.3,0.9},{0.1,0.2},{0.7,0.4})==0.6499999999999998)

-- seg_dist: distance to the nearest point of the segment, an end point beyond either end, the
-- point itself for a zero-length segment.
assert(G.seg_dist({2,5},{0,0},{4,0})==5 and G.seg_dist({1,0},{0,0},{4,0})==0)
assert(G.seg_dist({7,4},{0,0},{4,0})==5 and G.seg_dist({-3,-4},{0,0},{4,0})==5)
assert(G.seg_dist({4,5},{1,1},{1,1})==5)
assert(G.seg_dist({0.3,0.9},{0.1,0.2},{0.7,0.4})==0.6008327554319921)
local a,b={0,0},{4,0};G.seg_dist({2,5},a,b);G.seg_t({2,5},a,b)
assert(same(a,{0,0}) and same(b,{4,0}),'segment helpers only read their arguments')

-- curve_nearest: (segment index, t) of the nearest point; nil,nil without a segment.
local i,t=nearest({},{0,0});assert(i==nil and t==nil)
i,t=nearest({corner({0,0})},{0,0});assert(i==nil and t==nil)
-- Corner-corner chords project linearly; t must be strictly inside (0,1), so clicks beyond either
-- end and zero-length chords find nothing.
i,t=nearest({corner({0,0}),corner({4,0})},{1,2});assert(i==1 and t==0.25)
i,t=nearest({corner({0,0}),corner({4,0})},{0,3});assert(i==nil and t==nil)
i,t=nearest({corner({0,0}),corner({4,0})},{-1,0});assert(i==nil and t==nil)
i,t=nearest({corner({0,0}),corner({4,0})},{6,1});assert(i==nil and t==nil)
i,t=nearest({corner({2,2}),corner({2,2})},{3,3});assert(i==nil and t==nil)
-- Any non-corner end samples the cubic at k/64, k=1..63: t is never 0 or 1.
i,t=nearest({smooth({0,0},{1,0}),smooth({3,0},nil,{-1,0})},{1.5,1});assert(i==1 and t==0.5)
i,t=nearest({smooth({0,0},{1,0}),smooth({3,0},nil,{-1,0})},{-5,0});assert(i==1 and t==1/64)
i,t=nearest({smooth({0,0},{1,0}),smooth({3,0},nil,{-1,0})},{9,0});assert(i==1 and t==63/64)
i,t=nearest({smooth({0,0},{0,2}),smooth({4,0},nil,{0,2})},{2,1.4});assert(i==1 and t==0.5)
-- A degenerate curve (all points equal): every sample ties, the first one wins.
i,t=nearest({smooth({2,2}),smooth({2,2})},{5,5});assert(i==1 and t==1/64)
-- One corner end is not enough for the chord branch: the same geometry gives a different t.
i,t=nearest({corner({0,0}),corner({4,0})},{1,1});assert(i==1 and t==0.25)
i,t=nearest({corner({0,0}),smooth({4,0})},{1,1});assert(i==1 and t==0.328125)
i,t=nearest({corner({0,0}),smooth({4,0})},{2,1});assert(i==1 and t==0.5)
-- Several segments: the nearest wins, an exact tie keeps the earlier segment.
i,t=nearest({corner({0,0}),corner({4,0}),corner({4,4})},{5,3});assert(i==2 and t==0.75)
i,t=nearest({corner({0,0}),corner({4,0}),smooth({4,4},nil,nil,'symmetric')},{5,3});assert(i==2 and t==0.671875)
i,t=nearest({corner({0,0}),corner({4,0}),corner({4,4})},{2,-1});assert(i==1 and t==0.5)
i,t=nearest({corner({0,0}),corner({4,0}),corner({0,0})},{1,1});assert(i==1 and t==0.25)
print('PASS editor geometry: to_px, dist, length, seg_t clamping and 1e-12 floor, seg_dist ends, curve_nearest chords, Bezier samples, ties and degenerate curves')
