-- #683: loads the shared HTML editor UI kit (tokens, fonts, icons, components) for the editor chrome (#682).
-- UI only: the kit renders and reports clicks; the editor stays the owner of the level document and Undo.
local M={loaded=false}
local FILES={'/main/editor/web/ui_fonts.js','/main/editor/web/ui_kit.js'}
-- Inject once per page. Safe to call every time the editor opens; a no-op outside HTML5.
function M.ensure()
    if M.loaded or not html5 then return M.loaded end
    for _,file in ipairs(FILES) do html5.run(assert(sys.load_resource(file),'Missing editor UI kit file '..file)) end
    html5.run('window.riderUI.install()')
    M.loaded=true
    -- Debug builds only: ?uikit=1 opens the component sheet for review.
    if sys.get_engine_info().is_debug and html5.run("String(new URLSearchParams(location.search).get('uikit')==='1')")=='true' then
        html5.run('window.riderUI.sheet()')
    end
    return true
end
return M
