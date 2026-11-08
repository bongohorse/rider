// #683: shared HTML editor UI kit. Runs main/editor/web/ui_kit.js in a stubbed browser realm and checks
// the component helpers; the real-browser look is reviewed through the debug sheet (?uikit=1).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../main/editor/web/ui_kit.js'),'utf8');

function load(){
  const appended={head:[],body:[]};
  const el=tag=>({tag,id:'',hidden:false,textContent:'',innerHTML:'',className:''});
  const document={
    getElementById:id=>[...appended.head,...appended.body].find(e=>e.id===id)??null,
    createElement:el,
    head:{append:n=>appended.head.push(n)},body:{append:n=>appended.body.push(n)},
  };
  const realm={document,console};realm.window=realm;vm.createContext(realm);vm.runInContext(source,realm);
  return {ui:realm.riderUI,appended};
}

test('install injects the scoped stylesheet and icon sprite once',()=>{
  const {ui,appended}=load();
  ui.install();ui.install();
  assert.equal(appended.head.filter(n=>n.id==='rider-ui-kit').length,1);
  assert.equal(appended.body.filter(n=>n.id==='rider-ui-icons').length,1);
  const css=appended.head[0].textContent;
  for(const rule of css.split('}').map(r=>r.trim()).filter(Boolean))
    assert.match(rule,/^\.rider-ui/,`unscoped rule: ${rule.slice(0,60)}`);
  for(const name of ui.icons) assert.ok(appended.body[0].innerHTML.includes(`id="ui-${name}"`),name);
});

test('helpers escape text and reject unknown icons',()=>{
  const {ui}=load();
  const html=ui.button({icon:'cursor',title:'<img src=x onerror=1>',label:'"quoted"'});
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img src=x onerror=1&gt;'));
  assert.ok(html.includes('&quot;quoted&quot;'));
  assert.throws(()=>ui.icon('no-such-icon'),/Unknown UI icon/);
  assert.ok(ui.search({id:'s',placeholder:'Find',value:'<b>'}).includes('value="&lt;b&gt;"'));
});

test('states are visible in markup: on, disabled, pressed and checked',()=>{
  const {ui}=load();
  assert.match(ui.button({icon:'grid',on:true,title:'Grid'}),/class="b on"[^>]*aria-pressed="true"/);
  assert.match(ui.button({icon:'undo',disabled:true,title:'Undo'}),/ disabled>/);
  const seg=ui.seg('layer',[['behind','behind','Behind'],['front','front','Front']],'front','#6fd36b');
  assert.match(seg,/aria-checked="true" class="b on"[^>]*data-v="front"/);
  assert.match(seg,/aria-checked="false" class="b "[^>]*data-v="behind"/);
  assert.match(ui.play({playing:true}),/use href="#ui-stop"/);
  const r=ui.range({key:'size',min:0,max:2,value:1,label:'Size',icon:'size',color:'#4cc9ff',text:'1×'});
  assert.match(r,/--p:50%/);
});

test('every class the helpers emit has a style rule',()=>{
  const {ui,appended}=load();ui.install();
  const css=appended.head[0].textContent;
  for(const cls of ['b','play','seg','row','lab','range','val','search','ph','ic','chip','chips','ui-toast','cat','tag'])
    assert.ok(css.includes(`.rider-ui .${cls}`)||css.includes(`.${cls}{`)||css.includes(`.${cls} `),`no rule for .${cls}`);
  assert.match(ui.seg('n',[[1,'coin','1'],[5,'coin','5']],'5','#fff'),/aria-checked="true" class="b on"[^>]*data-v="5"/);
  assert.match(ui.range({key:'k',min:1,max:1,value:1,label:'K',icon:'size',color:'#fff'}),/--p:0%/);
});
