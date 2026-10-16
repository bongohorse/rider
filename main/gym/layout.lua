-- Keep authored GUI units and uniform text scale; anchor panels to viewport edges.
local M={}
function M.anchor(node,x,y)
    gui.set_xanchor(node,x<=320 and gui.ANCHOR_LEFT or x>=640 and gui.ANCHOR_RIGHT or gui.ANCHOR_NONE)
    gui.set_yanchor(node,y>=260 and gui.ANCHOR_TOP or gui.ANCHOR_BOTTOM)
    return node
end
function M.text(pos,value) return M.anchor(gui.new_text_node(pos,value),pos.x,pos.y) end
function M.box(pos,size) return M.anchor(gui.new_box_node(pos,size),pos.x,pos.y) end
return M
