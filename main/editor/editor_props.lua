-- Level editor property presentation and field validation helpers (#331 E2), moved from
-- editor.gui_script. Pure: they format values, list a selected object's property rows, compute a
-- stepped parameter set and edit field text, and never commit. The caller applies a result through
-- editor.commit (apply_params), so Undo stays one step per operation. The editor state they read is
-- passed in explicitly: `anchor` is editor.anchor, `held` is the GUI script's held-modifier table.
local prefab=require "main.editor.editor_prefab"
local M={}
-- Number fields edit the same parameters as the handles; a choice field steps to its next value.
local function number_text(v) return (string.format("%.4f",v):gsub("0+$",""):gsub("%.$","")) end
local function param_rows(o,anchor)
    if o.type=="label" then return {{key="text",label="Text"}} end
    if o.type=="curve" then
        local a=anchor
        local inner=a and a.id==o.id and a.i>1 and a.i<#o.anchors and o.anchors[a.i].mode~="corner"
        return inner and {{key="mode",label="Tangents",choices={"free","smooth","symmetric"}}} or {}
    end
    return prefab.fields(o.kind,o.params,true)
end
-- The next value of a number row: step 1 for whole numbers and degrees, else 0.1 (Shift x10, Alt x0.1),
-- validated by prefab.set. Returns the new parameter set or nil and the reason; nothing is applied.
local function stepped_params(held,o,index,sign,params,anchor)
    local fd=param_rows(o,anchor)[index]
    if not fd or fd.choices then return nil,"This field cannot be stepped." end
    local step=fd.integer and 1 or fd.unit=="deg" and 1 or .1
    if not fd.integer then step=step*(held.shift and 10 or held.alt and .1 or 1) end
    params=params or o.params
    return prefab.set(o.kind,params,fd.key,number_text(params[fd.key]+sign*step))
end
-- Backspace in a text field: drops the last UTF-8 character (continuation bytes 0x80-0xBF with it).
local function drop_char(t)
    local i=#t
    while i>0 and t:byte(i)>=128 and t:byte(i)<192 do i=i-1 end
    return t:sub(1,math.max(0,i-1))
end
M.number_text,M.param_rows,M.stepped_params,M.drop_char=number_text,param_rows,stepped_params,drop_char
return M
