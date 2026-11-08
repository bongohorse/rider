// Normal pointer gestures to reach controls in the approved scrollable inspector. This does not
// inject state or relax an assertion: a missing/inapplicable control still fails in the caller.
const pointer=require('./pointer.cjs');
// #685: in the HTML library dock a control is reached by opening its tab (and the dock), then scrolling it into
// the dock's own scroll area; the same real pointer taps a user makes.
async function libraryTap(page,name){
 const p=await page.evaluate(n=>{const b=window.riderEditor.buttons[n],c=document.querySelector('canvas'),r=c.getBoundingClientRect();return b&&{x:r.x+b.x/c.width*r.width,y:r.y+(1-b.y/c.height)*r.height};},name);
 if(!p)return false;await pointer.tap(page,p);await pointer.frames(page,{n:4});return true;
}
async function revealLibrary(page,name){
 let e=await page.evaluate(()=>window.riderEditor);
 if(e?.open_dialog||e?.help_open||e?.warnings_open)return;
 const tab=/^kind_/.test(name)?'track':/^object_(?!name$)/.test(name)?'objects':/^tool_(start|finish|coin|fuel|gem|crate|plate|gate)$/.test(name)?'play':null;
 if(!tab)return;
 if(!e.visible.includes(name)){
  if(e.ui.tools_collapsed){await libraryTap(page,'collapse_tools');e=await page.evaluate(()=>window.riderEditor);}
  if(!e.visible.includes(name))await libraryTap(page,'lib_'+tab);
 }
 await page.evaluate(n=>document.querySelector(`#rider-chrome [data-cmd="${n}"]`)?.scrollIntoView({block:'nearest'}),name);
 await pointer.frames(page,{n:4});
}
const INSPECTOR_NAME=/^(wire$|unlink_|auto_|along_track$|track_height$|drop_to_track$|fuel_|collapse_fuel$|medal_|collapse_medals$|clear_medals$|param_\d|[di][en]c_|mirror_|convert$|delete$|smooth|corner_all$|paste$|split$|connect$|disconnect$|direction$|object_name$|rename$|plus$|minus$|speed$|test_speed$|mode_)/;
// #686: an inspector control is reached by opening the inspector and scrolling the control into its body.
async function revealInspector(page,name){
 let e=await page.evaluate(()=>window.riderEditor);
 if(e?.open_dialog||e?.help_open||e?.warnings_open||e.visible.includes(name))return;
 if(e.ui.properties_collapsed){await libraryTap(page,'collapse_properties');await pointer.frames(page,{n:4});}
 await page.evaluate(n=>document.querySelector(`#rider-chrome-insp [data-cmd="${n}"],#rider-chrome-insp [data-alias="${n}"]`)?.scrollIntoView({block:'nearest'}),name);
 await pointer.frames(page,{n:4});
}
async function reveal(page,name){
 if((await page.evaluate(()=>window.riderEditor?.buttons?.lib_play))&&/^(object_(?!name$)|kind_|tool_)/.test(name))return revealLibrary(page,name);
 if(INSPECTOR_NAME.test(name)&&await page.evaluate(()=>!!document.querySelector('#rider-chrome-insp')&&!document.querySelector('#rider-chrome-insp').hidden))return revealInspector(page,name);
 if(/^(object_(?!name$)|collapse_objects|kind_|collapse_prefabs|collapse_gameplay|collapse_tool_category|tool_)/.test(name)){
  let e=await page.evaluate(()=>window.riderEditor);
  if(e?.visible.includes(name)||e?.open_dialog||e?.help_open||e?.warnings_open)return;
  if(e?.ui?.tools_collapsed)return;
  const r=e.ui.tools_panel;if(!r)return;
  const p=await page.evaluate(({r,s})=>{const c=document.querySelector('canvas'),b=c.getBoundingClientRect();return {x:b.x+(r.x+80)*s/c.width*b.width,y:b.y+(r.y+70)*s/c.height*b.height};},{r,s:e.ui.scale});
  await page.mouse.move(p.x,p.y);await pointer.frames(page);
  for(let i=0;i<Math.ceil(e.ui.tool_max_scroll/64)+2;i++){await page.mouse.wheel(0,-120);await pointer.frames(page);}
  for(let i=0;i<Math.ceil(e.ui.tool_max_scroll/64)+2;i++){
   if((await page.evaluate(()=>window.riderEditor)).visible.includes(name))return;
   await page.mouse.wheel(0,120);await pointer.frames(page);
  }
  return;
 }

 if(!/^(wire$|unlink_|auto_|along_track$|track_height$|drop_to_track$|fuel_|collapse_fuel$|medal_|collapse_medals$|clear_medals$|param_\d|[di][en]c_|mirror_|convert$|delete$|smooth|corner_all$|paste$|split$|connect$|disconnect$|direction$|object_name$|rename$|plus$|minus$)/.test(name))return;
 let e=await page.evaluate(()=>window.riderEditor);
 if(e?.visible.includes(name)||!e?.ui?.max_scroll||e.open_dialog||e.help_open||e.warnings_open)return;
 const r=e.ui.rects.collapse_properties;if(!r)return;
 const p=await page.evaluate(({r,s})=>{const c=document.querySelector('canvas'),b=c.getBoundingClientRect();return {x:b.x+(r.x+140)*s/c.width*b.width,y:b.y+(r.y+200)*s/c.height*b.height};},{r,s:e.ui.scale});
 await page.mouse.move(p.x,p.y);await pointer.frames(page);
 for(let i=0;i<Math.ceil(e.ui.max_scroll/64)+2;i++){
  if((await page.evaluate(()=>window.riderEditor)).ui.scroll<=0)break;
  await page.mouse.wheel(0,-120);await pointer.frames(page);
 }
 for(let i=0;i<Math.ceil(e.ui.max_scroll/64)+2;i++){
  if((await page.evaluate(()=>window.riderEditor)).visible.includes(name))return;
  await page.mouse.wheel(0,120);await pointer.frames(page);
 }
}
async function frameCourse(page,ed,canvas,{zooms=5,minX=0}={}){
 let e=await ed();const u=e.usable,centre=await canvas((u.x0+u.x1)/2,(u.y0+u.y1)/2);
 await page.mouse.move(centre.x,centre.y);await pointer.frames(page);
 for(let i=0;i<Math.abs(zooms);i++){await page.mouse.wheel(0,zooms>0?120:-120);await pointer.frames(page);}
 e=await ed();const goal=e.usable.x0+16-minX*e.screen.ppm_x,delta=goal-e.screen.ox;
 const target=await canvas((u.x0+u.x1)/2+delta,(u.y0+u.y1)/2);
 await page.mouse.move(centre.x,centre.y);await pointer.frames(page);await page.mouse.down({button:'middle'});await pointer.frames(page);
 await page.mouse.move(target.x,target.y,{steps:6});await pointer.frames(page);await page.mouse.up({button:'middle'});await pointer.frames(page);
 await page.waitForFunction(goal=>Math.abs(window.riderEditor.screen.ox-goal)<2,goal);
}
// Keep a requested source location inside the visible workspace before a click/hover. The old UI
// allowed clicks in its empty palette areas; the opaque approved panels correctly consume them now.
async function ensureWorld(page,ed,canvas,p){
 for(let i=0;i<24;i++){
  const e=await ed();if(e.mode!=='edit'||e.field!==false||!e.screen)return;
  const u=e.usable,s=e.screen,x=s.ox+p[0]*s.ppm_x,y=s.oy+p[1]*s.ppm_y;
  if(x>=u.x0+12&&x<=u.x1-12&&y>=u.y0+12&&y<=u.y1-12)return;
  const cx=(u.x0+u.x1)/2,cy=(u.y0+u.y1)/2;
  const dx=Math.max(-(u.x1-u.x0)/3,Math.min((u.x1-u.x0)/3,cx-x));
  const dy=Math.max(-(u.y1-u.y0)/3,Math.min((u.y1-u.y0)/3,cy-y));
  const a=await canvas(cx,cy),b=await canvas(cx+dx,cy+dy);
  await page.mouse.move(a.x,a.y);await pointer.frames(page);await page.mouse.down({button:'middle'});await pointer.frames(page);
  await page.mouse.move(b.x,b.y,{steps:5});await pointer.frames(page);await page.mouse.up({button:'middle'});await pointer.frames(page);
 }
 throw Error('source location could not be panned into the workspace: '+JSON.stringify(p));
}
module.exports={reveal,frameCourse,ensureWorld};
