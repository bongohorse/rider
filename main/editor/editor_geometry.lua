-- Level editor geometry helpers (#331 E1), moved verbatim from editor.gui_script. Pure: points are
-- {x,y} in metres, a screen map is {ox,oy,ppm_x,ppm_y}; arguments are only read, results are new
-- tables or numbers. No editor state, GUI or engine access.
local M={}
local function to_px(p,s) return {s.ox+p[1]*s.ppm_x,s.oy+p[2]*s.ppm_y} end
local function dist(a,b) return math.sqrt((a[1]-b[1])^2+(a[2]-b[2])^2) end
local function length(v) return math.sqrt(v[1]*v[1]+v[2]*v[2]) end
local function seg_t(p,a,b)
    local dx,dy=b[1]-a[1],b[2]-a[2]
    return math.max(0,math.min(1,((p[1]-a[1])*dx+(p[2]-a[2])*dy)/math.max(1e-12,dx*dx+dy*dy)))
end
local function seg_dist(p,a,b)
    local t=seg_t(p,a,b)
    return dist(p,{a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t})
end
-- The Bezier segment and parameter nearest to p (for inserting an anchor on a selected curve).
local function curve_nearest(o,p)
    local best,bi,bt
    for i=1,#o.anchors-1 do
        local a,b=o.anchors[i],o.anchors[i+1]
        local p0,p3=a.p,b.p
        local p1,p2={p0[1]+a.out[1],p0[2]+a.out[2]},{p3[1]+b["in"][1],p3[2]+b["in"][2]}
        if a.mode=="corner" and b.mode=="corner" then
            -- A straight chord (LE5c): the click projected onto it (insert_anchor places corners linearly).
            local t=seg_t(p,p0,p3)
            local dd=dist(p,{p0[1]+(p3[1]-p0[1])*t,p0[2]+(p3[2]-p0[2])*t})
            if t>0 and t<1 and (not best or dd<best) then best,bi,bt=dd,i,t end
        else for k=1,63 do
            local t=k/64;local u=1-t
            local q={u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1],u*u*u*p0[2]+3*u*u*t*p1[2]+3*u*t*t*p2[2]+t*t*t*p3[2]}
            local dd=dist(p,q)
            if not best or dd<best then best,bi,bt=dd,i,t end
        end end
    end
    return bi,bt
end
M.to_px,M.dist,M.length,M.seg_t,M.seg_dist,M.curve_nearest=to_px,dist,length,seg_t,seg_dist,curve_nearest
return M
