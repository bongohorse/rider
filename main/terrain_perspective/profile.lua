-- Course-wide compatibility identifier only; section authoring belongs to #278.
local M={ID='perspective-v1'}
function M.id(d)
    if type(d)~='table' then return nil end
    local e=type(d.editor)=='table' and d.editor or d
    if e.road_profile~=nil then return e.road_profile end
    return d._road_profile
end
function M.enabled(d) return M.id(d)==M.ID end
function M.validate(d)
    local id=M.id(d)
    if id~=nil and id~=M.ID then return nil,'Unsupported road profile '..tostring(id)..'; keep the original file and use a supported Rider version.' end
    return true
end
return M
