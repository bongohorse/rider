-- #684: drives the HTML editor chrome (main/editor/web/chrome.js): floating tool bar, level chip and system
-- buttons. The chrome only renders and queues the same button names the Defold editor uses; the editor
-- handles them through on_button, so commands, shortcuts and Undo stay in Lua (level-editor contract #682).
-- Outside HTML5 the Defold top bar and tool section remain as the fallback.
local kit=require 'main.editor.editor_ui_kit'
local M={loaded=false}
function M.ensure()
    if M.loaded or not html5 then return M.loaded end
    kit.ensure()
    html5.run(assert(sys.load_resource('/main/editor/web/chrome.js'),'Missing editor chrome'))
    M.loaded=true
    return true
end
function M.active() return M.loaded end
-- state: {visible, tool, undo, redo, title, status, warnings={count, blocking, label}}
function M.render(state)
    if not M.loaded then return end
    local text=json.encode(state)
    if text==M.last then return end
    M.last=text
    html5.run('window.riderChrome.render('..text..')')
end
function M.hide() if M.loaded and M.last~='hidden' then M.last='hidden';html5.run('window.riderChrome.render({visible:false})') end end
-- Button names clicked since the last call.
function M.take()
    if not M.loaded then return {} end
    local text=html5.run('window.riderChrome.take()')
    if text=='[]' or text=='' then return {} end
    local ok,list=pcall(json.decode,text)
    return ok and type(list)=='table' and list or {}
end
-- Chrome button centres in canvas space, for the debug test state (window.riderEditor.buttons).
function M.rects()
    if not M.loaded then return {} end
    local ok,r=pcall(json.decode,html5.run('window.riderChrome.rects()'))
    return ok and type(r)=='table' and r or {}
end
return M
