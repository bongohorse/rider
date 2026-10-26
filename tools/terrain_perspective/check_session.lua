-- Production session transactions/guards with the real source compiler, simulated editor owner only.
local doc=require 'main.gym.editor_doc'
local look=require 'main.terrain_perspective.look'
local proj=require 'main.terrain_perspective.projection'
local function encode(v)
 if type(v)~='table' then return tostring(v) end
 local keys={};for k in pairs(v) do keys[#keys+1]=k end;table.sort(keys,function(a,b)return tostring(a)<tostring(b)end)
 local t={};for _,k in ipairs(keys) do t[#t+1]=tostring(k)..'='..encode(v[k]) end;return '{'..table.concat(t,',')..'}'
end
json={encode=encode}
package.loaded.socket={gettime=function() return 1 end}
local E={doc=dofile(arg[1]..'/long-curves-source.lua'),opened=1,mode='edit',ids={}}
E.doc.editor.road_profile=nil
function E.selected_ids() return E.ids end
function E.touch() end
local count=0
function E.commit(fn)
 local before=doc.copy(E.doc);fn(E.doc.editor)
 local conflict=doc.lock_conflict(before.editor,E.doc.editor);assert(not conflict,conflict)
 assert(doc.validate(E.doc));E.doc.editor.revision=E.doc.editor.revision+1;count=count+1;return true
end
package.loaded['main.gym.editor']=E
local session=require 'main.gym.editor_look'
session.open();session.close();assert(not E.doc.editor.road_profile and not E.look_preview)
session.open();assert(session.change('width',1.4));assert(session.preview());assert(not E.doc.editor.road_profile)
session.close();session.open();assert(session.session.params.width==1.4 and not E.doc.editor.road_profile)
assert(session.apply());assert(count==1 and E.doc.editor.road_profile==look.ID and E.doc.editor.road_look.params.width==1.4)
E.ids={'o2'};session.scope('selected');assert(session.change('width',1.8));assert(session.apply());assert(count==2)
local manual=encode(E.doc.editor.objects[2].road_look)
-- A protected adjacent section cannot be changed indirectly through their common transition.
E.doc.editor.objects[3].locked=true
assert(session.change('width',.25));assert(not session.apply());assert(session.session.error:find('Locked terrain'));assert(encode(E.doc.editor.objects[2].road_look)==manual and count==2)
E.doc.editor.objects[3].locked=nil
session.scope('level');assert(session.change('width',.5));assert(session.apply());assert(encode(E.doc.editor.objects[2].road_look)==manual)
session.reset();assert(session.preview());assert(E.doc.editor.road_look.params.width==.5);assert(session.apply());assert(E.doc.editor.road_look.params.width==.9 and encode(E.doc.editor.objects[2].road_look)==manual)
session.scope('selected');session.reset();assert(session.apply());assert(not E.doc.editor.objects[2].road_look)
print('PASS persistent draft/Apply transactions, protected connected transitions, manual defaults and scoped Reset')

assert(session.change('width',1.3));assert(session.preview());session.close()
local anchor=E.doc.editor.objects[2].anchors[2];anchor['out'][2]=anchor['out'][2]+1;E.doc.editor.revision=E.doc.editor.revision+1
session.tick();assert(E.look_preview.objects[2].anchors[2]['out'][2]==anchor['out'][2]);assert(E.look_preview.road_look.params.width==1.3 and E.doc.editor.road_look.params.width==.9)
print('PASS retained look preview rebases onto geometry edits without applying its settings')
