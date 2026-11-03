-- Bounded shipped progression; the Gym station list and custom/editor identities stay separate.
local M={ids={'first-run','rolling-hills','ridge-run'}}
function M.index(id) for i,k in ipairs(M.ids) do if k==id then return i end end end
function M.next(id) local i=M.index(id);return i and M.ids[i+1] end
function M.unlocked(completed,id)
 local i=M.index(id);return i~=nil and (i==1 or completed[M.ids[i-1]]==true)
end
return M
