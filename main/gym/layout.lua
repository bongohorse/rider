-- Anchor panel roots; keep every child in the same uniformly scaled local space.
-- Anchoring each child separately scales its position by the full axis ratio,
-- while FIT scales its size uniformly: tracks/knobs/bars then disagree at 20:9.
local M={}
local specs={
    right_top={960,540,gui.ANCHOR_RIGHT,gui.ANCHOR_TOP},
    right_bottom={960,0,gui.ANCHOR_RIGHT,gui.ANCHOR_BOTTOM},
    left_top={0,540,gui.ANCHOR_LEFT,gui.ANCHOR_TOP},
    left_bottom={0,0,gui.ANCHOR_LEFT,gui.ANCHOR_BOTTOM},
    top={480,540,gui.ANCHOR_NONE,gui.ANCHOR_TOP},
    bottom={480,0,gui.ANCHOR_NONE,gui.ANCHOR_BOTTOM},
    centre={480,270,gui.ANCHOR_NONE,gui.ANCHOR_NONE}}
function M.init() M.roots={};M.nodes={};M.parents={} end
local function group(name)
    if M.roots[name] then return M.roots[name] end
    local s=specs[name]
    local root=gui.new_box_node(vmath.vector3(s[1],s[2],0),vmath.vector3(1,1,0))
    gui.set_color(root,vmath.vector4(0,0,0,0))
    gui.set_xanchor(root,s[3]);gui.set_yanchor(root,s[4])
    M.roots[name]=root
    return root
end
function M.position(node,pos)
    local s=specs[M.parents[node]]
    gui.set_position(node,vmath.vector3(pos.x-s[1],pos.y-s[2],pos.z))
end
local function attach(node,pos,name)
    name=name or (pos.x>=640 and (pos.y>=260 and 'right_top' or 'right_bottom')
        or pos.x<=320 and (pos.y>=260 and 'left_top' or 'left_bottom')
        or pos.y>=400 and 'top' or pos.y<=40 and 'bottom' or 'centre')
    gui.set_parent(node,group(name),false)
    M.parents[node]=name;M.nodes[#M.nodes+1]=node
    M.position(node,pos)
    return node
end
function M.visible(visible)
    for _,node in ipairs(M.nodes) do gui.set_visible(node,visible) end
end
function M.text(pos,value,name) return attach(gui.new_text_node(pos,value),pos,name) end
function M.box(pos,size,name) return attach(gui.new_box_node(pos,size),pos,name) end
return M
