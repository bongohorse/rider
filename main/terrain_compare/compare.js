// Release-capable controls for the isolated P1 build. Every URL selects the same fixture source.
(() => {
  if (document.getElementById('terrain-compare')) return;
  const q = new URLSearchParams(location.search);
  const panel = document.createElement('section'); panel.id = 'terrain-compare';
  panel.innerHTML = `<style>
#terrain-compare{position:fixed;z-index:110;left:300px;right:160px;top:12px;color:#dcebe6;background:#14282f;border:1px solid #47665e;border-radius:7px;padding:10px 12px;font:13px system-ui;max-width:680px;box-shadow:0 4px 20px #0007}
#terrain-compare header{display:flex;align-items:center;gap:10px;margin-bottom:7px}#terrain-compare strong{font-size:12px;letter-spacing:.12em;color:#9ed5bd}#terrain-compare .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}#terrain-compare button,#terrain-compare select{background:#243f46;border:1px solid #5c8276;border-radius:4px;padding:7px 10px;color:#e0eee8;font:inherit}#terrain-compare button[aria-pressed=true]{background:#a1d8ba;color:#102820;border-color:#c4f3d5}#terrain-compare small{display:block;color:#a7bbb3;margin-top:7px;font-size:11px}#terrain-compare output{display:block;color:#bad0c4;margin-top:7px;font-size:11px}
@media(max-width:800px){#terrain-compare{left:10px;right:10px;top:8px;padding:7px}#terrain-compare button,#terrain-compare select{padding:5px 7px}#terrain-compare small{display:none}#terrain-compare header{margin-bottom:5px}}
</style><header><strong>TERRAIN STUDY · P1</strong><span>Same driving edge. Two visual treatments.</span></header><div class="row"><button data-look="flat">Flat fill</button><button data-look="depth">Top + edge + depth</button><button data-look="sprites">Original lines</button></div><div class="row" style="margin-top:7px"><label>Course <select id="terrain-course"><option value="six-anchor">Six anchors · 330 m</option><option value="long-curves">Varied course · 500 m</option><option value="mixed">Course + objects</option></select></label><label>View <select id="terrain-view"><option value="start">Run-in</option><option value="tight">Tight bends</option><option value="crest">Crest</option><option value="descent">45° descent</option><option value="jump">Gap jump</option><option value="reverse">Reverse</option></select></label></div><output>Loading comparison…</output><small>Arrows drive / brake / reverse · A/D lean · R retries. Switching a view restarts the same course. Experimental visuals; phone/GPU results pending.</small>`;
  document.body.appendChild(panel);
  const change = (key,value) => { const u=new URL(location.href);u.searchParams.set(key,value);location.href=u.href; };
  const look=q.get('look')||'depth', course=q.get('course')||'long-curves';
  panel.querySelectorAll('[data-look]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.look===look));b.onclick=()=>change('look',b.dataset.look);});
  const courses=panel.querySelector('#terrain-course'), views=panel.querySelector('#terrain-view');
  courses.value=course;views.value=course==='six-anchor'?'start':q.get('view')||'start';views.disabled=course==='six-anchor';
  courses.onchange=()=>change('course',courses.value);views.onchange=()=>change('view',views.value);
  const update=()=>{const s=window.riderTerrainCompare;if(s){panel.querySelector('output').textContent=s.variant==='sprites'?`Original renderer · ${s.decoration_sprites} scenery sprites`:`${s.chunks} road sections · ${s.vertices.toLocaleString()} vertices · ${(s.buffer_bytes/1024).toFixed(0)} KiB vertex data`;} };
  update();setInterval(update,500);
  // The isolated comparison neither edits nor imports into the player's normal save slots.
  document.querySelector('#custom-import')?.setAttribute('hidden','');
})();
