/* ============================================================
   Repo Atlas — UI
   ============================================================ */
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?Math.round(n/1e3)+'k':n>=1e3?(n/1e3).toFixed(1)+'k':String(n);
const fmtB = n => n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?Math.round(n/1024)+' KB':n+' B';
const ROLE_COLOR = {client:'var(--client)',api:'var(--api)',cli:'var(--cli)',worker:'var(--worker)',core:'var(--core)',data:'var(--data)',shared:'var(--shared)',infra:'var(--infra)',svc:'var(--ext)'};
const COL_TITLES = ['Frontend / UI','Entry points & API','Core logic','Data · shared · tooling','External systems'];
const CAT_ICON = {database:'🗄',cache:'⚡',queue:'📨',search:'🔍',storage:'🪣',cloud:'☁',auth:'🔐',ai:'✨',payments:'💳',monitoring:'📈',email:'✉',realtime:'🔌',gateway:'🚪'};
const CAT_NAME = {framework:'Frameworks',frontend:'Frontend',ui:'UI kits',state:'State & data fetching',api:'APIs & RPC',build:'Build tooling',orm:'ORM / queries',database:'Databases',cache:'Caches',queue:'Queues & jobs',search:'Search',storage:'Storage',cloud:'Cloud SDKs',auth:'Auth',ai:'AI / ML',payments:'Payments',monitoring:'Observability',email:'Email & messaging',realtime:'Realtime',http:'HTTP clients',logging:'Logging',test:'Testing',util:'Utilities',infra:'Infra',gateway:'Gateways'};
const COMP_COLOR = c => ROLE_COLOR[c.role]||'var(--core)';
const ghBlob = p => !A.repo.url ? '#nolink' : `${A.repo.url}/blob/${A.repo.branch}/${p.split('/').map(encodeURIComponent).join('/')}`;
const ghTree = p => !A.repo.url ? '#nolink' : `${A.repo.url}/tree/${A.repo.branch}/${p.split('/').map(encodeURIComponent).join('/')}`;
const short = (s,n) => s.length>n ? '…'+s.slice(-(n-1)) : s;
const lsGet = k => { try { return localStorage.getItem(k); } catch(e){ return null; } };
const lsSet = (k,v) => { try { v==null?localStorage.removeItem(k):localStorage.setItem(k,v); } catch(e){} };

let A = null;
const UI = {showApi:true, apiSel:null, apiComp:'', drillMode:'files', tab:'overview', sel:null, layout:'layered', showExt:true, drill:null, tree:{}, selFile:null, apiFilter:'', envFilter:'', treeFilter:''};

/* ---------------- derived ---------------- */
let D = null;
function derive(){
  const comps = A.comps;
  const col = c => ROLE_COL[c.role] ?? 2;
  const edges = A.edges.map(e=>({...e, back: col(comps[e.t]) < col(comps[e.s])}));
  const svcEdges = []; A.services.forEach((s,i)=>s.links.forEach(([cid,w])=>svcEdges.push({s:cid,t:'x'+i,w,inferred:s.inferred})));
  const inc = comps.map(()=>[]), out = comps.map(()=>[]);
  edges.forEach(e=>{ out[e.s].push(e); inc[e.t].push(e); });
  const cOut = new Map(), cInc = new Map();
  (A.classEdges||[]).forEach(([a,b,t])=>{ if(!cOut.has(a))cOut.set(a,[]); cOut.get(a).push([b,t]); if(!cInc.has(b))cInc.set(b,[]); cInc.get(b).push([a,t]); });
  const mOut = new Map(), mIn = new Map();
  (A.calls||[]).forEach(([ca,ma,cb,mb])=>{ const a=ca+'.'+ma, b=cb+'.'+mb; if(!mOut.has(a))mOut.set(a,[]); mOut.get(a).push([cb,mb]); if(!mIn.has(b))mIn.set(b,[]); mIn.get(b).push([ca,ma]); });
  D = {edges, svcEdges, inc, out, col, cOut, cInc, mOut, mIn};
}
function describeComp(c){
  const langs = Object.entries(c.langs).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]).join(' / ');
  const p = [];
  p.push(`${ROLE_LABEL[c.role]}${c.roleGuessed?' (guessed)':''} — ${c.files.length} source file${c.files.length>1?'s':''}${langs?' of '+langs:''}.`);
  if (c.pkg && c.pkg.name) p.push(`Package “${c.pkg.name}”${c.pkg.description?': '+c.pkg.description:''}.`);
  if (c.endpoints) p.push(`Defines ${c.endpoints} HTTP endpoint${c.endpoints>1?'s':''}.`);
  if (c.models) p.push(`Declares ${c.models} data model${c.models>1?'s':''}.`);
  if (c.fanIn) p.push(`Imported by ${c.fanIn} other component${c.fanIn>1?'s':''}.`);
  if (c.fanOut) p.push(`Depends on ${c.fanOut}.`);
  const sv = A.services.filter(s=>s.links.some(l=>l[0]===c.id)); if (sv.length) p.push(`Talks to ${sv.map(s=>s.label).join(', ')}${sv.every(s=>s.inferred)?' (inferred)':''}.`);
  if (c.entries.length) p.push(`Contains ${c.entries.length} entry point${c.entries.length>1?'s':''}.`);
  if (c.cycle) p.push('Part of a circular dependency between components.');
  return p.join(' ');
}

/* ---------------- graph view ---------------- */
function GraphView(svg, cb){
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (n,a={},p) => { const e=document.createElementNS(NS,n); for (const k in a) e.setAttribute(k,a[k]); if(p)p.appendChild(e); return e; };
  svg.innerHTML = `<defs>${[['n','var(--edge)'],['o','var(--out)'],['i','var(--in)'],['w','var(--warn)']].map(([id,c])=>`<marker id="a-${id}-${svg.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill="${c}"/></marker>`).join('')+`<marker id="a-x-${svg.id}" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M1 1 L11 6 L1 11 z" fill="var(--card)" stroke="var(--acc)" stroke-width="1.5"/></marker>`}</defs><g class="vp"><g class="lanes"></g><g class="hdr"></g><g class="edges"></g><g class="nodes"></g></g>`;
  const vp = svg.querySelector('.vp'), gL = svg.querySelector('.lanes'), gH = svg.querySelector('.hdr'), gE = svg.querySelector('.edges'), gN = svg.querySelector('.nodes');
  let grpEls = [];
  const G = {nodes:[], edges:[], mode:'layered', byId:new Map(), view:{x:0,y:0,k:1}, sel:null, nodeEls:new Map(), edgeEls:[]};
  const mid = id => `url(#a-${id}-${svg.id})`;
  const apply = () => vp.setAttribute('transform',`translate(${G.view.x} ${G.view.y}) scale(${G.view.k})`);
  function anchor(n, side){ return side==='r'?{x:n.x+n.w,y:n.y+n.h/2}:{x:n.x,y:n.y+n.h/2}; }
  function pathFor(e){
    const s = G.byId.get(e.s), t = G.byId.get(e.t); if(!s||!t) return '';
    if (G.mode==='force') {
      const dx=t.x-s.x, dy=t.y-s.y, d=Math.hypot(dx,dy)||1, ux=dx/d, uy=dy/d;
      const a={x:s.x+ux*(s.r+2),y:s.y+uy*(s.r+2)}, b={x:t.x-ux*(t.r+5),y:t.y-uy*(t.r+5)};
      const cx=(a.x+b.x)/2-uy*d*0.12, cy=(a.y+b.y)/2+ux*d*0.12;
      return `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`;
    }
    let a, b;
    if (t.x > s.x + s.w - 1) { a=anchor(s,'r'); b=anchor(t,'l'); const o=Math.max(40,(b.x-a.x)/2); return `M${a.x},${a.y} C${a.x+o},${a.y} ${b.x-o},${b.y} ${b.x},${b.y}`; }
    if (Math.abs(t.x-s.x) < 2) { a=anchor(s,'r'); b=anchor(t,'r'); const o=55+Math.abs(b.y-a.y)*0.12; return `M${a.x},${a.y} C${a.x+o},${a.y} ${b.x+o+8},${b.y} ${b.x+6},${b.y}`; }
    a=anchor(s,'l'); b=anchor(t,'r'); const o=Math.max(40,(a.x-b.x)/2); return `M${a.x},${a.y} C${a.x-o},${a.y} ${b.x+o},${b.y} ${b.x},${b.y}`;
  }
  function setPos(n){ const el=G.nodeEls.get(n.id); if(el) el.setAttribute('transform', G.mode==='force'?`translate(${n.x},${n.y})`:`translate(${n.x},${n.y})`); }
  function updGroups(){ for (const g of grpEls) { const m=G.nodes.filter(n=>n.grp===g.id); if(!m.length) continue; const cx=m.reduce((a,n)=>a+n.x,0)/m.length, cy=m.reduce((a,n)=>a+n.y,0)/m.length; const r=Math.max(...m.map(n=>Math.hypot(n.x-cx,n.y-cy)+(n.r||8)))+28; g.c.setAttribute('cx',cx); g.c.setAttribute('cy',cy); g.c.setAttribute('r',r); g.t.setAttribute('x',cx); g.t.setAttribute('y',cy-r-6); } }
  function updEdges(id){ for (const o of G.edgeEls) if (!id || o.e.s===id || o.e.t===id) { const d=pathFor(o.e); o.line.setAttribute('d',d); o.hit.setAttribute('d',d); } }

  function buildNode(n){
    const g = mk('g',{class:'node','data-id':n.id}); const col = n.color||'var(--core)';
    if (G.mode==='force') {
      if (n.kind==='svc') mk('rect',{class:'bx',x:-n.r,y:-n.r,width:n.r*2,height:n.r*2,rx:7,stroke:col,'stroke-dasharray':'4 3'},g);
      else if (n.kind==='ghost') mk('circle',{class:'bx',r:n.r,stroke:col,'stroke-dasharray':'3 3'},g);
      else mk('circle',{class:'bx',r:n.r,stroke:col,style:`fill:color-mix(in srgb,${col} 30%,var(--card))`},g);
      if (n.kind==='svc') { const t=mk('text',{class:'t1','text-anchor':'middle',y:5},g); t.textContent=n.icon||'●'; }
      const t=mk('text',{class:'t1','text-anchor':'middle',y:n.r+14},g); t.textContent=short(n.label,26);
      if (n.sub){ const t2=mk('text',{class:'t2','text-anchor':'middle',y:n.r+26},g); t2.textContent=n.sub; }
    } else {
      if (n.kind==='svc' && n.cat==='database') {
        mk('path',{class:'bx',d:`M0,8 a${n.w/2},8 0 0 1 ${n.w},0 v${n.h-16} a${n.w/2},8 0 0 1 -${n.w},0 z`,stroke:col},g);
        mk('path',{d:`M0,8 a${n.w/2},8 0 0 0 ${n.w},0`,fill:'none',stroke:col,opacity:.6},g);
      } else mk('rect',{class:'bx',width:n.w,height:n.h,rx:n.kind==='svc'?n.h/2:10,stroke:col,'stroke-dasharray':n.kind==='svc'||n.kind==='ghost'?'5 3':'none'},g);
      if (n.kind!=='svc') mk('rect',{x:0,y:0,width:5,height:n.h,rx:2,fill:col,opacity:.9},g);
      const x0 = n.kind==='svc'?(n.icon?34:16):16;
      if (n.kind==='svc' && n.icon) { const ic=mk('text',{x:16,y:n.h/2+6,style:'font-size:17px'},g); ic.textContent=n.icon; }
      const t1=mk('text',{class:'t1',x:x0,y:n.sub?n.h/2-3:n.h/2+4},g); t1.textContent=short(n.label,n.kind==='svc'?22:27);
      if (n.sub){ const t2=mk('text',{class:'t2',x:x0,y:n.h/2+13},g); t2.textContent=short(n.sub,34); }
      if (n.badges && n.badges.length){ const b=mk('text',{x:n.w-8,y:15,'text-anchor':'end',style:'font-size:12px'},g); b.textContent=n.badges.join(' '); }
    }
    const ti = mk('title',{},g); ti.textContent = n.title||n.label;
    return g;
  }
  function render(){
    gL.innerHTML=gH.innerHTML=gE.innerHTML=gN.innerHTML=''; G.nodeEls.clear(); G.edgeEls=[];
    G.byId = new Map(G.nodes.map(n=>[n.id,n]));
    for (const l of (G.lanes||[])) mk('rect',{class:'lane',x:l.x,y:l.y,width:l.w,height:l.h,rx:14},gL);
    grpEls = (G.groups||[]).map(g=>{ const c=mk('circle',{class:'lane',style:`stroke:${g.color};fill:color-mix(in srgb,${g.color} 7%,transparent)`},gL); const t=mk('text',{class:'colhdr','text-anchor':'middle',style:`fill:${g.color}`},gL); t.textContent=short(g.label,28); return {id:g.id,c,t}; });
    for (const h of (G.headers||[])) { const t=mk('text',{class:'colhdr',x:h.x,y:h.y},gH); t.textContent=h.text; }
    const maxw = Math.max(1,...G.edges.map(e=>e.w||0));
    for (const e of G.edges) {
      if (!G.byId.has(e.s)||!G.byId.has(e.t)) continue;
      const g = mk('g',{class:'edge'+(e.back?' back':'')+(e.inferred?' inf':'')+(e.kind?' k-'+e.kind:'')},gE);
      const line = mk('path',{class:'line','stroke-width':(1+Math.log2(1+(e.w||0))*0.7).toFixed(2),'marker-end':mid(e.kind==='extends'||e.kind==='implements'?'x':e.back?'w':'n')},g);
      const hit = mk('path',{class:'hit'},g);
      const ti = mk('title',{},g); ti.textContent = e.title||'';
      g.addEventListener('click',ev=>{ ev.stopPropagation(); cb.edge&&cb.edge(e); });
      g.addEventListener('mouseenter',()=>g.classList.add('hov')); g.addEventListener('mouseleave',()=>g.classList.remove('hov'));
      G.edgeEls.push({e,g,line,hit});
    }
    updEdges();
    for (const n of G.nodes) { const g=buildNode(n); gN.appendChild(g); G.nodeEls.set(n.id,g); setPos(n); wireNode(g,n); }
    updGroups();
    select(G.sel&&G.byId.has(G.sel)?G.sel:null, true);
  }
  function wireNode(g,n){
    let sx,sy,ox,oy,moved=false,down=false;
    g.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); down=true; moved=false; sx=ev.clientX; sy=ev.clientY; ox=n.x; oy=n.y; g.setPointerCapture(ev.pointerId); });
    g.addEventListener('pointermove',ev=>{ if(!down) return; const dx=ev.clientX-sx, dy=ev.clientY-sy; if(!moved && Math.hypot(dx,dy)>4) moved=true; if(moved){ n.x=ox+dx/G.view.k; n.y=oy+dy/G.view.k; setPos(n); updEdges(n.id); updGroups(); } });
    g.addEventListener('pointerup',ev=>{ down=false; if(!moved){ cb.node&&cb.node(n); } });
  }
  function select(id, silent){
    G.sel = id;
    const up=new Set(), dn=new Set(), dUp=new Set(), dDn=new Set();
    if (id) {
      const bfs=(start,dir,set,direct)=>{ const q=[start], seen=new Set([start]); while(q.length){ const x=q.shift(); for(const e of G.edges){ const [from,to]=dir==='dn'?[e.s,e.t]:[e.t,e.s]; if(from===x&&!seen.has(to)){ seen.add(to); set.add(to); if(x===start) direct.add(to); q.push(to);} } } };
      bfs(id,'dn',dn,dDn); bfs(id,'up',up,dUp);
    }
    for (const [nid,el] of G.nodeEls) {
      el.classList.remove('sel','dim','tdn','tup');
      if (!id) continue;
      if (nid===id) el.classList.add('sel'); else if (dDn.has(nid)||dUp.has(nid)) {} else if (dn.has(nid)) el.classList.add('tdn'); else if (up.has(nid)) el.classList.add('tup'); else el.classList.add('dim');
    }
    for (const o of G.edgeEls) {
      const {e,g,line}=o; g.classList.remove('out','in','tr','dim');
      let m = e.kind==='extends'||e.kind==='implements'?'x':e.back?'w':'n';
      if (id) { if (e.s===id){ g.classList.add('out'); if(m!=='x') m='o'; } else if (e.t===id){ g.classList.add('in'); if(m!=='x') m='i'; }
        else if ((dn.has(e.s)&&dn.has(e.t))||(up.has(e.s)&&up.has(e.t))||(dn.has(e.t)&&e.s===id)) g.classList.add('tr'); else g.classList.add('dim'); }
      line.setAttribute('marker-end',mid(m));
    }
  }
  function fit(){
    if (!G.nodes.length) return; const r = svg.getBoundingClientRect(); if(!r.width) return;
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for (const n of G.nodes){ const w=G.mode==='force'?n.r*2:n.w, h=G.mode==='force'?n.r*2+30:n.h; const nx=G.mode==='force'?n.x-n.r:n.x, ny=G.mode==='force'?n.y-n.r:n.y; x0=Math.min(x0,nx);y0=Math.min(y0,ny-(G.headers?28:0));x1=Math.max(x1,nx+w);y1=Math.max(y1,ny+h); }
    const pad=50, k=Math.max(.08,Math.min((r.width-pad*2)/(x1-x0),(r.height-pad*2-40)/(y1-y0),1.15));
    G.view.k=k; G.view.x=(r.width-(x1-x0)*k)/2-x0*k; G.view.y=(r.height-(y1-y0)*k)/2-y0*k+20; apply();
  }
  // pan / zoom
  let pan=null;
  svg.addEventListener('pointerdown',ev=>{ pan={x:ev.clientX,y:ev.clientY,vx:G.view.x,vy:G.view.y,moved:false}; svg.setPointerCapture(ev.pointerId); svg.classList.add('pan'); });
  svg.addEventListener('pointermove',ev=>{ if(!pan)return; const dx=ev.clientX-pan.x, dy=ev.clientY-pan.y; if(Math.hypot(dx,dy)>3)pan.moved=true; G.view.x=pan.vx+dx; G.view.y=pan.vy+dy; apply(); });
  svg.addEventListener('pointerup',()=>{ if(pan&&!pan.moved){ cb.background&&cb.background(); } pan=null; svg.classList.remove('pan'); });
  svg.addEventListener('wheel',ev=>{ ev.preventDefault(); const r=svg.getBoundingClientRect(); const mx=ev.clientX-r.left,my=ev.clientY-r.top; const f=Math.exp(-ev.deltaY*0.0015); const nk=Math.max(.05,Math.min(3,G.view.k*f)); G.view.x=mx-(mx-G.view.x)*(nk/G.view.k); G.view.y=my-(my-G.view.y)*(nk/G.view.k); G.view.k=nk; apply(); },{passive:false});
  G.set = (nodes,edges,mode,extra={}) => { G.nodes=nodes; G.edges=edges; G.mode=mode; G.headers=extra.headers; G.lanes=extra.lanes; G.groups=extra.groups; render(); };
  G.select=select; G.fit=fit; G.focus=id=>{ const n=G.byId.get(id); if(!n)return; const r=svg.getBoundingClientRect(); const cx=G.mode==='force'?n.x:n.x+n.w/2, cy=G.mode==='force'?n.y:n.y+n.h/2; G.view.x=r.width/2-cx*G.view.k; G.view.y=r.height/2-cy*G.view.k; apply(); };
  return G;
}

/* layout helpers */
function layeredLayout(nodes, edges, colOf, opts={}){
  const W=opts.w||214, H=opts.h||58, GX=opts.gx||120, GY=opts.gy||16;
  const cols = [...new Set(nodes.map(colOf))].sort((a,b)=>a-b);
  const idx = new Map(cols.map((c,i)=>[c,i]));
  const lists = cols.map(c=>nodes.filter(n=>colOf(n)===c).sort((a,b)=>(b.weight||0)-(a.weight||0)));
  const pos = new Map(); const setPos=()=>lists.forEach(l=>l.forEach((n,i)=>pos.set(n.id,i)));
  setPos();
  for (let pass=0; pass<4; pass++) {
    const order = pass%2? [...lists].reverse() : lists;
    for (const l of order) { const bc = n => { const nb=[]; edges.forEach(e=>{ if(e.s===n.id&&pos.has(e.t))nb.push(pos.get(e.t)); if(e.t===n.id&&pos.has(e.s))nb.push(pos.get(e.s)); }); return nb.length? nb.reduce((a,b)=>a+b,0)/nb.length : pos.get(n.id); };
      const b = new Map(l.map(n=>[n.id,bc(n)])); l.sort((a,c)=>b.get(a.id)-b.get(c.id)); l.forEach((n,i)=>pos.set(n.id,i)); }
  }
  const top = 60, MAXR = opts.maxRows||9; let maxH = 0; const headers=[], lanes=[];
  let xCursor = 40; const spans=[];
  lists.forEach(l=>{ const subs=Math.max(1,Math.ceil(l.length/MAXR)); const rows=Math.ceil(l.length/subs); l.forEach((n,i)=>{ const sc=Math.floor(i/rows), r=i%rows; n.x=xCursor+sc*(W+40); n.y=top+r*(H+GY); n.w=W; n.h=H; }); maxH=Math.max(maxH,rows*(H+GY)); const width=subs*W+(subs-1)*40; spans.push({x:xCursor,w:width}); xCursor+=width+GX; });
  spans.forEach((sp,ci)=>{ headers.push({x:sp.x,y:top-24,text:(opts.titles||COL_TITLES)[cols[ci]]||''}); lanes.push({x:sp.x-12,y:top-12,w:sp.w+24,h:maxH+8}); });
  return {headers, lanes};
}
function forceLayout(nodes, edges, W=900, H=600){
  const n = nodes.length; if(!n) return;
  nodes.forEach((p,i)=>{ const a=i/n*Math.PI*2; p.x=W/2+Math.cos(a)*W*0.35; p.y=H/2+Math.sin(a)*H*0.35; p.vx=0; p.vy=0; });
  const idx = new Map(nodes.map((p,i)=>[p.id,i]));
  const links = edges.map(e=>[idx.get(e.s),idx.get(e.t)]).filter(l=>l[0]!=null&&l[1]!=null);
  const k = Math.sqrt(W*H/Math.max(n,1))*0.85;
  for (let it=0; it<320; it++) {
    const t = 1 - it/320;
    for (let i=0;i<n;i++) for (let j=i+1;j<n;j++) { const a=nodes[i], b=nodes[j]; let dx=a.x-b.x, dy=a.y-b.y, d2=dx*dx+dy*dy||.01, d=Math.sqrt(d2); const minD=a.r+b.r+26+(a.grp!=null&&a.grp!==b.grp?44:0); const f=(k*k/d2)*0.9 + (d<minD?(minD-d)*0.2:0); const fx=dx/d*f, fy=dy/d*f; a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy; }
    for (const [i,j] of links) { const a=nodes[i], b=nodes[j]; const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||.01; const f=(d-k*0.9)*0.035; const fx=dx/d*f, fy=dy/d*f; a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy; }
    if (nodes.some(p=>p.grp!=null)) { const cen=new Map(); for (const p of nodes) { if(p.grp==null)continue; let c=cen.get(p.grp); if(!c){c={x:0,y:0,n:0};cen.set(p.grp,c);} c.x+=p.x; c.y+=p.y; c.n++; } const gs=[...cen.entries()].map(([id,c])=>({id,x:c.x/c.n,y:c.y/c.n,r:34+16*Math.sqrt(c.n),px:0,py:0})); for (let i=0;i<gs.length;i++) for (let j=i+1;j<gs.length;j++) { const a=gs[i],b=gs[j]; let dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy)||.1; const need=a.r+b.r; if(d<need){ const f=(need-d)*0.35; a.px+=dx/d*f; a.py+=dy/d*f; b.px-=dx/d*f; b.py-=dy/d*f; } } const gm=new Map(gs.map(g=>[g.id,g])); for (const p of nodes) { const c=p.grp!=null&&cen.get(p.grp); if(c){ const g=gm.get(p.grp); p.vx+=(c.x/c.n-p.x)*0.07+g.px; p.vy+=(c.y/c.n-p.y)*0.07+g.py; } } }
    for (const p of nodes) { p.vx+=(W/2-p.x)*0.004; p.vy+=(H/2-p.y)*0.004; const sp=Math.hypot(p.vx,p.vy)||1, cap=40*t+2; if(sp>cap){p.vx*=cap/sp;p.vy*=cap/sp;} p.x+=p.vx; p.y+=p.vy; p.vx*=0.5; p.vy*=0.5; }
  }
}

/* ---------------- view builders ---------------- */
function archNodesEdges(){
  const nodes=[], edges=[];
  A.comps.forEach(c=>{
    const langs = Object.entries(c.langs).sort((a,b)=>b[1]-a[1])[0];
    nodes.push({id:'c'+c.id, kind:'comp', label:c.label, sub:`${c.files.length} files${langs?' · '+langs[0]:''}${c.endpoints?' · '+c.endpoints+' routes':''}`, color:COMP_COLOR(c), role:c.role, cid:c.id,
      badges:[c.entries.length?'⚡':'', c.cycle?'↻':''].filter(Boolean), weight:c.files.length, r:11+Math.min(24,Math.sqrt(c.files.length)*2.4), title:`${c.label}\n${describeComp(c)}`});
  });
  D.edges.forEach(e=>edges.push({s:'c'+e.s,t:'c'+e.t,w:e.w,back:e.back,raw:e,title:`${A.comps[e.s].label} → ${A.comps[e.t].label}\n${e.w} import${e.w>1?'s':''}${e.back?'\n⚠ goes against the usual layer direction':''}`}));
  if (UI.showApi) (A.apiEdges||[]).forEach(e=>edges.push({s:'c'+e.s,t:'c'+e.t,w:e.w,kind:'api',apiRaw:e,title:`${A.comps[e.s].label} → ${A.comps[e.t].label}\nHTTP API: ${e.w} call${e.w>1?'s':''} to ${e.eps} endpoint${e.eps>1?'s':''}`}));
  if (UI.showExt) {
    A.services.forEach((s,i)=>{ nodes.push({id:'x'+i, kind:'svc', cat:s.cat, label:s.label, sub:s.cat+(s.inferred?' · inferred':''), icon:CAT_ICON[s.cat], color:'var(--ext)', sidx:i, weight:s.links.length, r:15, title:`${s.label} (${s.cat})\ndetected via ${s.sources.join(', ')}`}); });
    D.svcEdges.forEach(e=>edges.push({s:'c'+e.s,t:e.t,w:e.w,inferred:e.inferred,title:`${A.comps[e.s].label} → ${A.services[+e.t.slice(1)].label}${e.inferred?' (inferred)':''}`}));
  }
  return {nodes,edges};
}

let GRAPH=null;
function drawArch(){
  const {nodes,edges}=archNodesEdges();
  if (UI.layout==='layered') {
    const colOf = n => n.kind==='svc'?4:D.col(A.comps[n.cid]);
    const L = layeredLayout(nodes,edges,colOf);
    GRAPH.set(nodes,edges,'layered',L);
  } else {
    forceLayout(nodes,edges,1000,700); GRAPH.set(nodes,edges,'force');
  }
  GRAPH.select(UI.sel); requestAnimationFrame(()=>GRAPH.fit());
}
function drawDrill(cid){
  const c = A.comps[cid]; const inComp = new Set(c.files);
  const deg = id => A.files[id].imports.length + A.files[id].importedBy.length;
  const fl = c.files.map(id=>A.files[id]).sort((a,b)=>deg(b.id)-deg(a.id)||b.size-a.size).slice(0,90);
  const keep = new Set(fl.map(f=>f.id)); const nodes=[], edges=[], ghosts=new Map();
  fl.forEach(f=>nodes.push({id:'f'+f.id,kind:'file',label:base(f.path),sub:f.routes.length?f.routes.length+' routes':'',color:COMP_COLOR(c),r:7+Math.min(14,Math.sqrt(f.size/200)),title:f.path,fid:f.id}));
  const seen=new Set();
  for (const [a,b] of A.fileEdges) { const fa=A.files[a], fb=A.files[b];
    const ina=keep.has(a), inb=keep.has(b);
    if (ina&&inb) { const k=a+'>'+b; if(!seen.has(k)){seen.add(k);edges.push({s:'f'+a,t:'f'+b,w:1});} }
    else if (ina && fb.comp>=0 && fb.comp!==cid) { ghosts.set(fb.comp,1); const k=a+'>g'+fb.comp; if(!seen.has(k)){seen.add(k);edges.push({s:'f'+a,t:'g'+fb.comp,w:1});} }
    else if (inb && fa.comp>=0 && fa.comp!==cid) { ghosts.set(fa.comp,1); const k='g'+fa.comp+'>'+b; if(!seen.has(k)){seen.add(k);edges.push({s:'g'+fa.comp,t:'f'+b,w:1});} } }
  for (const g of ghosts.keys()) nodes.push({id:'g'+g,kind:'ghost',label:A.comps[g].label,sub:'other component',color:COMP_COLOR(A.comps[g]),r:18,cid:g,title:A.comps[g].label});
  forceLayout(nodes,edges,900,650); GRAPH.set(nodes,edges,'force'); requestAnimationFrame(()=>GRAPH.fit());
}

/* ---------------- drawer ---------------- */
function selectNode(n){
  if (n.mkey) { UI.sel=null; GRAPH.select(n.id); const [c,m]=n.mkey.split('.').map(Number); drawerMethod(A.classes[c],m); return; }
  if (n.kid!=null) { UI.sel=null; GRAPH.select('k'+n.kid); drawerClass(A.classes[n.kid]); return; }
  if (n.kind==='comp'||n.kind==='ghost') { UI.sel='c'+n.cid; GRAPH.select(UI.sel); drawerComp(A.comps[n.cid]); }
  else if (n.kind==='svc') { UI.sel=n.id; GRAPH.select(UI.sel); drawerSvc(A.services[n.sidx]); }
  else if (n.kind==='file') { drawerFile(A.files[n.fid]); GRAPH.select(n.id); }
}
function selectComp(id){ if (UI.drill!=null) { UI.drill=null; drawArch(); } UI.sel='c'+id; GRAPH.select(UI.sel); GRAPH.focus&&GRAPH.focus(UI.sel); drawerComp(A.comps[id]); }
function pillRole(c){ return `<span class="pill"><i style="background:${COMP_COLOR(c)}"></i>${ROLE_LABEL[c.role]}${c.roleGuessed?' ?':''}</span>`; }
function compLink(id){ const c=A.comps[id]; return `<a class="link" data-comp="${id}">${esc(c.label)}</a>`; }
function drawerComp(c){
  const out = D.out[c.id].slice().sort((a,b)=>b.w-a.w), inc = D.inc[c.id].slice().sort((a,b)=>b.w-a.w);
  const svcs = A.services.map((s,i)=>({s,i,l:s.links.find(l=>l[0]===c.id)})).filter(x=>x.l);
  const total = Object.values(c.langs).reduce((a,b)=>a+b,0)||1;
  const files = c.files.map(id=>A.files[id]); const key = files.slice().sort((a,b)=>(b.importedBy.length-a.importedBy.length)||(b.size-a.size)).slice(0,7);
  const eps = A.routes.filter(r=>r.comp===c.id).slice(0,6);
  $('#drawer').innerHTML = `
   <h4>${esc(c.label)}</h4>
   <div style="margin:6px 0 10px">${pillRole(c)} ${c.cycle?'<span class="pill" style="border-color:var(--warn)">↻ in a cycle</span>':''}</div>
   <div class="hint" style="font-size:13px;color:var(--text)">${esc(describeComp(c))}</div>
   <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
     <select class="btn sm" id="roleSel" title="Reassign this component's layer">${ROLE_ORDER.map(r=>`<option value="${r}"${r===c.role?' selected':''}>${ROLE_LABEL[r]}</option>`).join('')}</select>
     <button class="btn sm" id="drillBtn">Explore files →</button>${c.classCount?`<button class="btn sm" id="clsBtn">Explore classes (${c.classCount}) →</button>`:''}${c.callCount?`<button class="btn sm" id="mthBtn">Function &amp; method calls (${c.callCount}) →</button>`:''}
     ${c.path?`<a class="btn sm" href="${ghTree(c.path)}" target="_blank" rel="noopener">GitHub ↗</a>`:''}
   </div>
   ${c.pkg?`<h5>Package</h5><div class="mono">${esc(c.pkg.name||'')} <span class="hint">(${esc(c.pkg.eco)})</span></div>`:''}
   <h5>Languages</h5><div class="bar">${Object.entries(c.langs).sort((a,b)=>b[1]-a[1]).map(([l,n],i)=>`<i style="width:${n/total*100}%;background:hsl(${(i*57+200)%360} 65% 60%)" title="${l}: ${n}"></i>`).join('')}</div>
   <div class="hint">${Object.entries(c.langs).sort((a,b)=>b[1]-a[1]).map(([l,n])=>`${l} ${n}`).join(' · ')}</div>
   ${c.tags.length?`<h5>Built with</h5>${c.tags.map(t=>`<span class="tag fw">${esc(t.label)}</span>`).join('')}`:''}
   ${c.entries.length?`<h5>Entry points</h5><ul class="clean">${c.entries.slice(0,6).map(p=>`<li>⚡ <a href="${ghBlob(p)}" target="_blank" rel="noopener" class="mono">${esc(p)}</a></li>`).join('')}</ul>`:''}
   ${(A.apiEdges||[]).some(e=>e.s===c.id||e.t===c.id)?`<h5>HTTP API links</h5><ul class="clean">${(A.apiEdges||[]).filter(e=>e.s===c.id).map(e=>`<li>calls the API of ${compLink(e.t)} <span class="w">${e.w} call${e.w>1?'s':''} · ${e.eps} endpoint${e.eps>1?'s':''}</span></li>`).join('')}${(A.apiEdges||[]).filter(e=>e.t===c.id).map(e=>`<li>called over HTTP by ${compLink(e.s)} <span class="w">${e.w} call${e.w>1?'s':''}</span></li>`).join('')}</ul><a class="btn sm" data-gotoapi>See request flow →</a>`:''}
   ${eps.length?`<h5>Endpoints (${c.endpoints})</h5><ul class="clean">${eps.map(r=>`<li><span class="method m-${r.method}">${r.method}</span> <span class="mono">${esc(r.path)}</span></li>`).join('')}</ul>`:''}
   <h5>Depends on (${out.length})</h5>${out.length?`<ul class="clean">${out.map(e=>`<li>${compLink(e.t)} <span class="w">${e.w}×</span><div class="ex">${e.ex.slice(0,2).map(x=>esc(base(x[0]))+' → '+esc(base(x[1]))).join('<br>')}</div></li>`).join('')}</ul>`:'<div class="hint">Nothing inside the repo (leaf).</div>'}
   <h5>Used by (${inc.length})</h5>${inc.length?`<ul class="clean">${inc.map(e=>`<li>${compLink(e.s)} <span class="w">${e.w}×</span></li>`).join('')}</ul>`:'<div class="hint">Not imported by other components — likely an entry point or unused.</div>'}
   ${svcs.length?`<h5>Talks to</h5><ul class="clean">${svcs.map(x=>`<li>${CAT_ICON[x.s.cat]||''} <a class="link" data-svc="${x.i}">${esc(x.s.label)}</a> <span class="w">${x.s.inferred?'inferred':x.l[1]+' files'}</span></li>`).join('')}</ul>`:''}
   ${c.classCount?`<h5>Top classes / types</h5><ul class="clean">${topClasses(c.id,8).map(k=>`<li><a class="link" data-class="${k.id}">${esc(k.name)}</a> <span class="pill">${esc(k.kind)}</span><span class="w">${k.methods.length?k.methods.length+' methods':''}</span></li>`).join('')}</ul>`:''}
   <h5>Key files</h5><ul class="clean">${key.map(f=>`<li><a href="${ghBlob(f.path)}" target="_blank" rel="noopener" class="mono">${esc(short(f.path,44))}</a><span class="w">${f.importedBy.length?'used by '+f.importedBy.length:fmtB(f.size)}</span></li>`).join('')}</ul>`;
  wireDrawer();
  $('#roleSel').onchange = e => { c.role=e.target.value; c.roleGuessed=false; derive(); drawArch(); drawerComp(c); };
  $('#drillBtn').onclick = () => { UI.drill=c.id; UI.drillMode='files'; drawDrill(c.id); drawerDrillHead(c); };
  if ($('#mthBtn')) $('#mthBtn').onclick = () => { UI.drill=c.id; UI.drillMode='methods'; drawMethods(c.id); drawerDrillHead(c); };
  if ($('#clsBtn')) $('#clsBtn').onclick = () => { UI.drill=c.id; UI.drillMode='classes'; drawClasses(c.id); drawerDrillHead(c); };
}
function drawerDrillHead(c){
  const n = c.classCount||0;
  $('#drawer').innerHTML = `<h4>${esc(c.label)}</h4>
   <div class="toolbar-in" style="margin:8px 0"><div class="grp2"><button data-m="files" class="${UI.drillMode==='files'?'on':''}">Files</button><button data-m="classes" class="${UI.drillMode==='classes'?'on':''}" ${n?'':'disabled title="No classes/types detected here"'}>Classes${n?' ('+n+')':''}</button><button data-m="methods" class="${UI.drillMode==='methods'?'on':''}" ${c.callCount?'':'disabled title="No calls between class methods detected here"'}>Calls${c.callCount?' ('+c.callCount+')':''}</button></div></div>
   <div class="hint">${UI.drillMode==='methods' ? 'Each circle is a function or method; the dashed ring is its class (or, for plain functions, its file). Arrows read “calls”: <b style="color:var(--acc)">blue</b> across rings, dotted within one. Calls are matched by name, the file’s imports and the receiver’s declared type, so treat them as a very good guess, not a compiler.' : UI.drillMode==='classes'
     ? 'Each circle is a class / interface / type. <b style="color:var(--acc)">Solid arrow + hollow head</b> = extends, <b style="color:var(--acc)">dashed</b> = implements, <span>thin grey</span> = uses (mentions the type in its body). Dashed circles belong to other components.'
     : 'File-level view: circles are files (size ∝ bytes), arrows are imports. Dashed circles are other components these files touch.'}</div>
   <div style="margin:10px 0"><button class="btn sm" id="backBtn">← Back to architecture</button></div><div class="hint">Click a ${UI.drillMode==='classes'?'class':UI.drillMode==='methods'?'method':'file'} for details.</div>`;
  $('#backBtn').onclick = () => { UI.drill=null; drawArch(); drawerComp(c); };
  document.querySelectorAll('#drawer [data-m]').forEach(b=>b.onclick=()=>{ if(b.disabled) return; UI.drillMode=b.dataset.m; ({classes:()=>drawClasses(c.id),methods:()=>drawMethods(c.id),files:()=>drawDrill(c.id)})[UI.drillMode](); drawerDrillHead(c); });
}

/* ---------------- classes ---------------- */
const KIND_COLOR = {interface:'var(--api)',trait:'var(--api)',annotation:'var(--api)',enum:'var(--data)',struct:'var(--client)',record:'var(--client)',module:'var(--shared)',object:'var(--shared)'};
let CDEG=null;
function classDeg(){ if(CDEG&&CDEG.A===A) return CDEG.d; const d=new Map(); (A.classEdges||[]).forEach(([a,b])=>{ if(A.classes[a].fn||A.classes[b].fn) return; d.set(a,(d.get(a)||0)+1); d.set(b,(d.get(b)||0)+1); }); CDEG={A,d}; return d; }
function topClasses(cid,n){ const d=classDeg(); return A.classes.filter(k=>k.comp===cid&&!k.fn).sort((a,b)=>(d.get(b.id)||0)-(d.get(a.id)||0)||b.methods.length-a.methods.length).slice(0,n); }
function fileClasses(fid){ return (A.classes||[]).filter(k=>k.file===fid&&!k.fn); }
function fileFns(fid){ return (A.classes||[]).find(k=>k.fn&&k.file===fid); }
const fnList = fid => { const m=fileFns(fid); return m? `<h5>Functions (${m.methods.length})</h5><div>${m.methods.map((n,i)=>`<a class="tag mono link" data-method="${m.id}.${i}">${esc(n)}${(D.mOut.has(m.id+'.'+i)||D.mIn.has(m.id+'.'+i))?' ⇄':''}</a>`).join('')}</div>` : ''; };
const EDGE_VERB = ['uses','extends','implements'], EDGE_KIND = ['uses','extends','implements'];
function drawClasses(cid, force){
  const c=A.comps[cid]; const d=classDeg();
  let mine = A.classes.filter(k=>k.comp===cid&&!k.fn).sort((a,b)=>(d.get(b.id)||0)-(d.get(a.id)||0)||b.methods.length-a.methods.length);
  let top = mine.slice(0,80); if (force!=null && A.classes[force].comp===cid && !top.some(k=>k.id===force)) top.push(A.classes[force]);
  const keep = new Set(top.map(k=>k.id)); const ghosts = new Map(); const edges=[]; const seen=new Set();
  const ce = (A.classEdges||[]).slice().sort((a,b)=>b[2]-a[2]);
  for (const [a,b,t] of ce) {
    if (A.classes[a].fn||A.classes[b].fn) continue;
    const ina=keep.has(a), inb=keep.has(b);
    if (ina&&inb) { edges.push({s:'k'+a,t:'k'+b,w:1,kind:EDGE_KIND[t],title:`${A.classes[a].name} ${EDGE_VERB[t]} ${A.classes[b].name}`}); }
    else if (ina && A.classes[b].comp!==cid) { if(ghosts.size<30||ghosts.has(b)||b===force){ ghosts.set(b,1); edges.push({s:'k'+a,t:'k'+b,w:1,kind:EDGE_KIND[t],title:`${A.classes[a].name} ${EDGE_VERB[t]} ${A.classes[b].name}`}); } }
    else if (inb && A.classes[a].comp!==cid) { if(ghosts.size<30||ghosts.has(a)||a===force){ ghosts.set(a,1); edges.push({s:'k'+a,t:'k'+b,w:1,kind:EDGE_KIND[t],title:`${A.classes[a].name} ${EDGE_VERB[t]} ${A.classes[b].name}`}); } }
  }
  const mk = (k,ghost)=>({id:'k'+k.id,kind:ghost?'ghost':'class',kid:k.id,label:k.name,sub:k.kind+(k.methods.length?' · '+k.methods.length+' methods':'')+(ghost?' · '+short(A.comps[k.comp].label,18):''),color:KIND_COLOR[k.kind]||COMP_COLOR(A.comps[k.comp]||c),r:8+Math.min(18,Math.sqrt(k.methods.length)*2.4+(d.get(k.id)||0)*0.35),title:`${k.name} (${k.kind})\n${A.files[k.file].path}:${k.line}`});
  const nodes = top.map(k=>mk(k,false)).concat([...ghosts.keys()].filter(id=>!keep.has(id)).map(id=>mk(A.classes[id],true)));
  const nodeIds = new Set(nodes.map(n=>n.id)); const edges2 = edges.filter(e=>nodeIds.has(e.s)&&nodeIds.has(e.t));
  // keep extends/implements edges short so hierarchies cluster
  forceLayout(nodes,edges2,1000,720); GRAPH.set(nodes,edges2,'force'); requestAnimationFrame(()=>GRAPH.fit());
}
function focusClass(id){
  const k=A.classes[id]; if(!k) return;
  const go = ()=>{ UI.drill=k.comp; UI.drillMode='classes'; drawClasses(k.comp,id); GRAPH.select('k'+id); GRAPH.focus('k'+id); drawerClass(k); };
  if (UI.tab!=='arch') { showTab('arch'); setTimeout(go,60); } else go();
}
function drawerClass(k){
  const f=A.files[k.file], comp=A.comps[k.comp];
  const out=(D.cOut.get(k.id)||[]), inc=(D.cInc.get(k.id)||[]);
  const nm = id=>A.classes[id];
  const list = (arr,empty)=> arr.length? `<ul class="clean">${arr.slice(0,25).map(([id,t])=>`<li><a class="link" data-class="${id}">${esc(nm(id).name)}</a> <span class="pill">${esc(nm(id).kind)}</span><span class="w">${esc(short(A.comps[nm(id).comp]?A.comps[nm(id).comp].label:'',22))}</span></li>`).join('')}${arr.length>25?`<li class="hint">+${arr.length-25} more</li>`:''}</ul>` : `<div class="hint">${empty}</div>`;
  const parents=out.filter(e=>e[1]===1), ifaces=out.filter(e=>e[1]===2), uses=out.filter(e=>e[1]===0);
  const subs=inc.filter(e=>e[1]===1), impls=inc.filter(e=>e[1]===2), usedBy=inc.filter(e=>e[1]===0);
  $('#drawer').innerHTML = `<h4>${esc(k.name)}</h4>
   <div style="margin:6px 0 8px"><span class="pill"><i style="background:${KIND_COLOR[k.kind]||COMP_COLOR(comp)}"></i>${esc(k.kind)}</span> ${comp?`<a class="link" data-comp="${comp.id}" style="font-size:12.5px">${esc(comp.label)}</a>`:''}</div>
   <div class="mono hint" style="word-break:break-all"><a href="${ghBlob(f.path)}#L${k.line}" target="_blank" rel="noopener">${esc(f.path)}:${k.line}</a></div>
   ${comp?`<div style="margin:10px 0;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="bcBack">← All classes in ${esc(short(comp.label,22))}</button>${hasCalls(k.id)?'<button class="btn sm" id="mcBtn">Method calls →</button>':''}</div>`:''}
   ${parents.length||ifaces.length?`<h5>Inherits from</h5>${list(parents.concat(ifaces),'')}`:''}
   ${subs.length||impls.length?`<h5>Subclasses / implementations (${subs.length+impls.length})</h5>${list(subs.concat(impls),'')}`:''}
   <h5>Uses (${uses.length})</h5>${list(uses,'No other classes in the repo referenced.')}
   <h5>Used by (${usedBy.length})</h5>${list(usedBy,'Nothing else in the scanned code references it.')}
   ${k.methods.length?`<h5>Members (${k.methods.length}${k.methods.length>=60?'+':''})</h5><div>${k.methods.map((m,i)=>{ const key=k.id+'.'+i; return (D.mOut.has(key)||D.mIn.has(key))?`<a class="tag mono link" data-method="${key}" title="has call links">${esc(m)} ⇄</a>`:`<span class="tag mono">${esc(m)}</span>`; }).join('')}</div>`:''}
   <div class="hint" style="margin-top:14px">“Uses” is detected by name: the class body mentions another declared type. Ambiguous names (declared in several places) are skipped.</div>`;
  wireDrawer();
  if ($('#mcBtn')) $('#mcBtn').onclick=()=>{ UI.drill=k.comp; UI.drillMode='methods'; drawMethods(k.comp,k.id); };
  if ($('#bcBack')) $('#bcBack').onclick=()=>{ UI.drillMode='classes'; drawClasses(comp.id); drawerDrillHead(comp); };
}

/* ---------------- methods ---------------- */
const hasCalls = cid => { for (const k of D.mOut.keys()) if (+k.split('.')[0]===cid) return true; for (const k of D.mIn.keys()) if (+k.split('.')[0]===cid) return true; return false; };
const clsHue = id => `hsl(${(id*47+20)%360} 62% 52%)`;
const mname = (c,m) => A.classes[c].fn ? `${A.classes[c].name}::${A.classes[c].methods[m]}` : `${A.classes[c].name}.${A.classes[c].methods[m]}`;
function drawMethods(cid, focusCls, focusKey){
  const calls = A.calls||[]; const deg = new Map(); calls.forEach(([a,b,c,d])=>{ const x=a+'.'+b, y=c+'.'+d; deg.set(x,(deg.get(x)||0)+1); deg.set(y,(deg.get(y)||0)+1); });
  let sel; const mine = new Set(), ghost = new Set(), E = [];
  if (focusCls!=null) {
    A.classes[focusCls].methods.forEach((_,i)=>mine.add(focusCls+'.'+i));
    for (const [a,b,c,d] of calls) { const x=a+'.'+b, y=c+'.'+d; if (mine.has(x)||mine.has(y)) { E.push([x,y,a===c]); if(!mine.has(x)&&ghost.size<45) ghost.add(x); if(!mine.has(y)&&ghost.size<45) ghost.add(y); } }
  } else {
    const rel = calls.filter(([a,b,c,d])=>A.classes[a].comp===cid||A.classes[c].comp===cid);
    const cand = new Map(); rel.forEach(([a,b,c,d])=>{ [a+'.'+b,c+'.'+d].forEach(k=>cand.set(k,(deg.get(k)||0))); });
    const inComp = k=>A.classes[+k.split('.')[0]].comp===cid;
    const ranked = [...cand.keys()].sort((x,y)=>(inComp(y)-inComp(x))||(cand.get(y)-cand.get(x)));
    ranked.slice(0,100).forEach(k=>(inComp(k)?mine:ghost).add(k));
    for (const [a,b,c,d] of rel) E.push([a+'.'+b,c+'.'+d,a===c]);
  }
  if (focusKey) { mine.add(focusKey); }
  const all = new Set([...mine,...ghost]); const edges=[], seen=new Set();
  for (const [x,y,same] of E) { if(!all.has(x)||!all.has(y)) continue; const k=x+'>'+y; if(seen.has(k)) continue; seen.add(k); const [a,b]=x.split('.').map(Number), [c,d]=y.split('.').map(Number); edges.push({s:'m'+x,t:'m'+y,w:1,kind:same?'self':'call',title:`${mname(a,b)} calls ${mname(c,d)}`}); }
  const used = new Set(); edges.forEach(e=>{ used.add(e.s); used.add(e.t); });
  const nodes=[], groups=new Map();
  for (const k of all) { if (!used.has('m'+k) && !(focusCls!=null && mine.has(k)) && k!==focusKey) continue; const [c,m]=k.split('.').map(Number); const cl=A.classes[c]; const isG=!mine.has(k);
    nodes.push({id:'m'+k,kind:isG?'ghost':'method',mkey:k,label:cl.methods[m],sub:isG?cl.name+' · '+short(A.comps[cl.comp]?A.comps[cl.comp].label:'',14):'',color:clsHue(c),grp:c,r:6+Math.min(11,(deg.get(k)||0)*0.9),title:mname(c,m)+'\n'+A.files[cl.file].path});
    if(!groups.has(c)) groups.set(c,{id:c,label:cl.name,color:clsHue(c)}); }
  if (!nodes.length) { forceLayout([],[]); GRAPH.set([],[],'force'); return; }
  const ids=new Set(nodes.map(n=>n.id)); const ed=edges.filter(e=>ids.has(e.s)&&ids.has(e.t));
  forceLayout(nodes,ed,1200,800); GRAPH.set(nodes,ed,'force',{groups:[...groups.values()]}); requestAnimationFrame(()=>GRAPH.fit());
}
function focusMethod(c,m){
  const k=A.classes[c]; const go=()=>{ UI.drill=k.comp; UI.drillMode='methods'; drawMethods(k.comp,c,c+'.'+m); GRAPH.select('m'+c+'.'+m); GRAPH.focus('m'+c+'.'+m); drawerMethod(k,m); };
  if (UI.tab!=='arch') { showTab('arch'); setTimeout(go,60); } else go();
}
function drawerMethod(k,m){
  const key=k.id+'.'+m, out=D.mOut.get(key)||[], inc=D.mIn.get(key)||[]; const f=A.files[k.file]; const comp=A.comps[k.comp];
  const list=(arr,empty)=>arr.length?`<ul class="clean">${arr.slice(0,40).map(([c,mm])=>`<li><a class="link" data-method="${c}.${mm}">${esc(mname(c,mm))}</a>${c===k.id?'<span class="w">same class</span>':`<span class="w">${esc(short(A.comps[A.classes[c].comp]?A.comps[A.classes[c].comp].label:'',20))}</span>`}</li>`).join('')}${arr.length>40?`<li class="hint">+${arr.length-40} more</li>`:''}</ul>`:`<div class="hint">${empty}</div>`;
  $('#drawer').innerHTML=`<h4>${esc(k.methods[m])}()</h4>
   <div style="margin:6px 0 8px"><span class="pill"><i style="background:${clsHue(k.id)}"></i>${k.fn?'function in '+esc(k.name):'method of <a class="link" data-class="'+k.id+'">'+esc(k.name)+'</a>'}</span> ${comp?`<a class="link" data-comp="${comp.id}" style="font-size:12.5px">${esc(comp.label)}</a>`:''}</div>
   <div class="mono hint" style="word-break:break-all"><a href="${ghBlob(f.path)}#L${(k.mlines&&k.mlines[m])||k.line}" target="_blank" rel="noopener">${esc(f.path)}:${(k.mlines&&k.mlines[m])||k.line}</a></div>
   <div style="margin:10px 0"><button class="btn sm" id="mAll">Show all ${k.fn?'functions in '+esc(k.name):esc(k.name)+' calls'}</button> <button class="btn sm" data-imp="m:${key}">What depends on this?</button></div>
   <h5>Calls (${out.length})</h5>${list(out,'Makes no calls to other known methods.')}
   <h5>Called by (${inc.length})</h5>${list(inc,'No known callers in the scanned code.')}
   <div class="hint" style="margin-top:14px">Calls are resolved from the receiver’s declared type, the file’s imports, or a unique name; dynamic dispatch, callbacks and reflection can be missed.</div>`;
  wireDrawer(); $('#mAll').onclick=()=>{ UI.drillMode='methods'; drawMethods(k.comp,k.id); };
}
function drawerSvc(s){
  const i = A.services.indexOf(s);
  const x = A.externalPkgs.filter(p=>s.pkgs.includes(p.name));
  $('#drawer').innerHTML = `<h4>${CAT_ICON[s.cat]||''} ${esc(s.label)}</h4><div style="margin:6px 0 10px"><span class="pill"><i style="background:var(--ext)"></i>${esc(s.cat)}</span> ${s.inferred?'<span class="pill">inferred link</span>':''}</div>
   <div style="font-size:13px">External system the code talks to. Detected via: <b>${esc(s.sources.join(', '))}</b>.${s.inferred?' No file imports its client directly, so links to components are a best guess based on layer.':''}</div>
   ${x.length?`<h5>Packages imported</h5>${x.map(p=>`<span class="tag fw">${esc(p.name)} · ${p.files}</span>`).join('')}`:''}
   <h5>Used by components</h5><ul class="clean">${s.links.map(l=>`<li>${compLink(l[0])}<span class="w">${l[1]?l[1]+' files':'—'}</span></li>`).join('')}</ul>`;
  wireDrawer();
}
function drawerEdge(e){
  if (e.kind==='api' && e.apiRaw) { const r=e.apiRaw; const calls=(A.apiCalls||[]).filter(c=>c.comp===r.s&&c.rt>=0&&A.routes[c.rt].comp===r.t);
    $('#drawer').innerHTML = `<h4>${compLink(r.s)} → ${compLink(r.t)}</h4><div style="margin:6px 0"><span class="pill">HTTP API</span> ${r.w} call${r.w>1?'s':''} to ${r.eps} endpoint${r.eps>1?'s':''}</div>
     <h5>Calls</h5><ul class="clean">${calls.slice(0,40).map(c=>{ const rt=A.routes[c.rt]; return `<li style="font-size:12px"><span class="method m-${c.method}">${c.method}</span> <span class="mono">${esc(c.path)}</span><br><span class="hint">in </span><a class="mono" href="${ghBlob(c.file)}#L${c.line}" target="_blank" rel="noopener">${esc(base(c.file))}:${c.line}</a>${c.cu>=0?` <span class="hint">(${esc(mname(c.cu,c.mu))})</span>`:''}<br><span class="hint">→ handled by </span><span class="mono">${esc(rt.method)} ${esc(rt.path)}</span> <span class="hint">in ${esc(base(rt.file))}</span></li>`; }).join('')}</ul>${calls.length>40?`<div class="hint">+${calls.length-40} more — see the API tab.</div>`:''}<div style="margin-top:10px"><a class="btn sm" id="toApiTab">Open in API tab</a></div>`;
    wireDrawer(); const b=$('#toApiTab'); if(b) b.onclick=()=>showTab('api'); return; }
  const r = e.raw; if(!r){ return; }
  $('#drawer').innerHTML = `<h4>${compLink(r.s)} → ${compLink(r.t)}</h4><div style="margin:6px 0">${r.w} import${r.w>1?'s':''}</div>${e.back?'<div class="callout warn">Goes against the usual layer direction (a lower layer importing a higher one). Worth a look if you care about clean layering.</div>':''}
   <h5>Examples</h5><ul class="clean">${r.ex.map(x=>`<li class="mono" style="font-size:11.5px"><a href="${ghBlob(x[0])}" target="_blank" rel="noopener">${esc(x[0])}</a><br>→ <a href="${ghBlob(x[1])}" target="_blank" rel="noopener">${esc(x[1])}</a></li>`).join('')}</ul>`;
  wireDrawer();
}
function drawerFile(f){
  const imp = f.imports.map(i=>A.files[i]), by = f.importedBy.map(i=>A.files[i]);
  $('#drawer').innerHTML = `<h4>${esc(base(f.path))}</h4><div class="mono hint">${esc(f.path)}</div><div style="margin:8px 0"><a class="btn sm" href="${ghBlob(f.path)}" target="_blank" rel="noopener">Open on GitHub ↗</a> <button class="btn sm" data-imp="f:${f.id}">What depends on this?</button></div>
   <div class="hint">${fmtB(f.size)}${f.loc?' · '+f.loc+' lines':''}${f.lang?' · '+f.lang:''}${f.comp>=0?' · in '+esc(A.comps[f.comp].label):''}</div>
   ${f.routes.length?`<h5>Routes</h5>${f.routes.slice(0,10).map(r=>`<div><span class="method m-${r.method}">${r.method}</span> <span class="mono">${esc(r.path)}</span></div>`).join('')}`:''}
   ${f.models.length?`<h5>Models</h5>${f.models.map(m=>`<span class="tag fw">${esc(m.name)}</span>`).join('')}`:''}
   ${fileClasses(f.id).length?`<h5>Classes in this file</h5>${fileClasses(f.id).map(k=>`<div><a class="link" data-class="${k.id}">${esc(k.name)}</a> <span class="pill">${esc(k.kind)}</span></div>`).join('')}`:''}
   ${fnList(f.id)}
   <h5>Imports (${imp.length})</h5><ul class="clean">${imp.slice(0,30).map(x=>`<li class="mono" style="font-size:11.5px">${esc(x.path)}</li>`).join('')||'<li class="hint">none resolved in repo</li>'}</ul>
   <h5>Imported by (${by.length})</h5><ul class="clean">${by.slice(0,30).map(x=>`<li class="mono" style="font-size:11.5px">${esc(x.path)}</li>`).join('')||'<li class="hint">no one (in scanned files)</li>'}</ul>
   ${f.externals.length?`<h5>External packages</h5>${f.externals.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}`:''}`;
  wireDrawer();
}
function wireDrawer(){
  document.querySelectorAll('#drawer [data-comp]').forEach(a=>a.onclick=()=>selectComp(+a.dataset.comp));
  document.querySelectorAll('#drawer [data-class]').forEach(a=>a.onclick=()=>focusClass(+a.dataset.class));
  document.querySelectorAll('#drawer [data-method]').forEach(a=>a.onclick=()=>{ const [c,m]=a.dataset.method.split('.').map(Number); focusMethod(c,m); });
  document.querySelectorAll('#drawer [data-gotoapi]').forEach(a=>a.onclick=()=>showTab('api'));
  document.querySelectorAll('#drawer [data-svc]').forEach(a=>a.onclick=()=>{ const i=+a.dataset.svc; UI.sel='x'+i; GRAPH.select(UI.sel); GRAPH.focus&&GRAPH.focus(UI.sel); drawerSvc(A.services[i]); });
}
function drawerHome(){
  const hubs = A.comps.filter(c=>c.fanIn>=2).sort((a,b)=>b.fanIn-a.fanIn).slice(0,3);
  $('#drawer').innerHTML = `<div class="empty"><div style="font-size:30px">🧭</div><b>Click any block</b><p>to see what it is, what it depends on, what depends on it, and the files that matter.</p>
   <p class="hint">Blue arrows = depends on · orange = used by<br>Red dashed = against layer direction<br>Drag blocks · scroll to zoom · drag background to pan</p>
   ${hubs.length?`<p class="hint" style="margin-top:20px">Most depended-on:<br>${hubs.map(h=>`<a class="link" data-comp="${h.id}">${esc(h.label)}</a> (${h.fanIn})`).join('<br>')}</p>`:''}</div>`;
  wireDrawer();
}

/* ---------------- tabs ---------------- */
const TABS = [['overview','Overview'],['arch','Architecture'],['flows','Flows'],['api','API & Data'],['trace','Feature trace'],['data','Data model'],['impact','Impact'],['runtime','Runtime'],['files','Files'],['export','Export']];
function showTab(t){
  UI.tab=t; document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  const p=$('#panel'); p.className='panel'+(t==='arch'||t==='files'?' flush':''); p.scrollTop=0;
  ({overview:renderOverview,arch:renderArch,flows:renderFlows,api:renderApi,trace:renderTrace,data:renderData,impact:renderImpact,runtime:renderRuntime,files:renderFiles,export:renderExport})[t]();
}
function insights(){
  const out=[]; const cs=A.comps;
  const cyc = cs.filter(c=>c.cycle); if (cyc.length) out.push(['warn',`<b>Circular dependencies:</b> ${cyc.slice(0,6).map(c=>compLink(c.id)).join(', ')}${cyc.length>6?' …':''} import each other (directly or indirectly).`]);
  const back = D.edges.filter(e=>e.back && cs[e.s].role!=='shared' && cs[e.t].role!=='client'); if (back.length) out.push(['warn',`<b>Layer inversions:</b> ${back.length} dependenc${back.length>1?'ies point':'y points'} “upward”, e.g. ${back.slice(0,3).map(e=>compLink(e.s)+' → '+compLink(e.t)).join('; ')}.`]);
  const hubs = cs.filter(c=>c.fanIn>=3).sort((a,b)=>b.fanIn-a.fanIn).slice(0,4); if (hubs.length) out.push(['',`<b>Hubs (change with care):</b> ${hubs.map(h=>compLink(h.id)+` (${h.fanIn} dependents)`).join(', ')}.`]);
  const big = cs.slice().sort((a,b)=>b.files.length-a.files.length)[0]; if (big && cs.length>3 && big.files.length > 0.4*A.stats.sourceFiles) out.push(['',`<b>Large component:</b> ${compLink(big.id)} holds ${Math.round(big.files.length/A.stats.sourceFiles*100)}% of all source files.`]);
  const orphan = cs.filter(c=>!c.fanIn&&!c.fanOut&&!c.entries.length&&c.scannedCount>0&&!A.services.some(s=>s.links.some(l=>l[0]===c.id))); if (orphan.length) out.push(['',`<b>Isolated components:</b> ${orphan.slice(0,5).map(c=>compLink(c.id)).join(', ')} — no imports in or out (standalone tool, dead code, or loaded dynamically).`]);
  const ratio = A.stats.sourceFiles? A.stats.testFiles/A.stats.sourceFiles : 0;
  out.push([ratio<0.1?'warn':'ok',`<b>Tests:</b> ${A.stats.testFiles} test files for ${A.stats.sourceFiles} source files (${ratio.toFixed(2)} ratio).`]);
  if (A.stats.scanned < A.stats.sourceFiles) out.push(['',`<b>Coverage:</b> import analysis read ${A.stats.scanned} of ${A.stats.sourceFiles} source files. Use “Deep” in the toolbar for larger repos — edge counts are lower bounds.`]);
  if (A.stats.truncated) out.push(['warn',A.repo.local?'This folder has more than 40,000 files; only the first 40,000 were read.':'GitHub truncated the file tree for this very large repo; some files are missing.']);
  return out;
}
function narrative(){
  const s=A.stats, L=s.languages, tot=L.reduce((a,b)=>a+b.bytes,0)||1; const p=[];
  if (L.length) p.push(`Written mostly in <b>${L[0].name}</b> (${Math.round(L[0].bytes/tot*100)}%)${L[1]?` with ${L.slice(1,3).map(l=>l.name+' '+Math.round(l.bytes/tot*100)+'%').join(', ')}`:''}.`);
  const fw = A.tech.filter(t=>['framework','frontend'].includes(t.cat)).map(t=>t.label); if (fw.length) p.push(`Built on <b>${[...new Set(fw)].slice(0,6).join(', ')}</b>.`);
  p.push(`The code splits into <b>${A.comps.length} components</b>${A.comps.length>1?`: ${ROLE_ORDER.map(r=>[r,A.comps.filter(c=>c.role===r).length]).filter(x=>x[1]).map(x=>x[1]+' '+ROLE_LABEL[x[0]].toLowerCase()).join(', ')}`:''}.`);
  if (A.entries.length) p.push(`It starts from <b>${A.entries.length}</b> entry point${A.entries.length>1?'s':''} (e.g. <span class="mono">${esc(A.entries[0].path)}</span>).`);
  if (A.routes.filter(r=>r.method!=='PAGE').length) p.push(`It exposes <b>${A.routes.filter(r=>r.method!=='PAGE').length} HTTP endpoints</b>.`);
  if (A.services.length) p.push(`It talks to <b>${A.services.map(s=>s.label).slice(0,8).join(', ')}</b>.`);
  if (A.compose.services.length) p.push(`Docker Compose runs <b>${A.compose.services.length} services</b>.`);
  if (A.workflows.length) p.push(`CI runs ${A.workflows.length} GitHub Actions workflow${A.workflows.length>1?'s':''}.`);
  return p.join(' ');
}
function renderOverview(){
  const s=A.stats, r=A.repo, L=s.languages, tot=L.reduce((a,b)=>a+b.bytes,0)||1;
  const stack = {}; A.tech.forEach(t=>{ (stack[t.cat]=stack[t.cat]||[]).push(t.label); });
  const catOrder = ['framework','frontend','ui','state','api','orm','database','cache','queue','search','storage','cloud','auth','ai','payments','monitoring','email','realtime','http','build','test','logging','util','gateway','infra'];
  $('#panel').innerHTML = `<div class="wrap">
   <div class="callout" style="font-size:15px">${narrative()}</div>
   ${r.description||A.about?`<p style="color:var(--mute);margin:14px 2px">${esc(r.description||'')}${A.about&&A.about!==r.description?'<br><span style="font-size:13px">'+esc(A.about)+'</span>':''}</p>`:''}
   <h3>At a glance</h3>
   <div class="cards">
    <div class="stat"><b>${fmt(s.totalFiles)}</b><span>files in repo</span></div><div class="stat"><b>${fmt(s.sourceFiles)}</b><span>source files</span></div>
    <div class="stat"><b>${A.comps.length}</b><span>components</span></div><div class="stat"><b>${D.edges.length}</b><span>component links</span></div>
    <div class="stat"><b>${A.services.length}</b><span>external systems</span></div><div class="stat"><b>${A.routes.filter(x=>x.method!=='PAGE').length}</b><span>endpoints</span></div>
    ${(A.apiCalls||[]).filter(c=>c.rt>=0).length?`<div class="stat"><b>${(A.apiCalls||[]).filter(c=>c.rt>=0).length}</b><span>client → API calls</span></div>`:''}<div class="stat"><b>${A.models.length}</b><span>data models</span></div><div class="stat"><b>${A.entries.length}</b><span>entry points</span></div>${(A.classes||[]).some(k=>!k.fn)?`<div class="stat"><b>${fmt(A.classes.filter(k=>!k.fn).length)}</b><span>classes & types</span></div><div class="stat"><b>${(A.classEdges||[]).filter(e=>e[2]>0).length}</b><span>inheritance links</span></div>${(A.calls||[]).length?`<div class="stat"><b>${fmt(A.calls.length)}</b><span>function & method calls</span></div>`:''}`:''}${(A.classes||[]).some(k=>k.fn)&&!(A.classes||[]).some(k=>!k.fn)?`<div class="stat"><b>${fmt(A.classes.reduce((a,k)=>a+k.methods.length,0))}</b><span>functions</span></div><div class="stat"><b>${fmt((A.calls||[]).length)}</b><span>function calls</span></div>`:''}</div>
   <div class="two" style="margin-top:6px">
    <div><h3>Languages</h3><div class="box"><div class="bar" style="height:12px">${L.slice(0,10).map((l,i)=>`<i style="width:${l.bytes/tot*100}%;background:hsl(${(i*57+200)%360} 65% 60%)" title="${l.name}"></i>`).join('')}</div>
     <div class="legend">${L.slice(0,10).map((l,i)=>`<span><i style="background:hsl(${(i*57+200)%360} 65% 60%)"></i>${l.name} ${Math.round(l.bytes/tot*100)}% · ${l.files} files</span>`).join('')}</div></div>
     <h3>Layers</h3><div class="box">${ROLE_ORDER.map(role=>{ const cs=A.comps.filter(c=>c.role===role); if(!cs.length) return ''; return `<div style="margin:4px 0"><span class="pill"><i style="background:var(--${role})"></i>${ROLE_LABEL[role]}</span> ${cs.slice(0,8).map(c=>compLink(c.id)).join(' · ')}${cs.length>8?' …':''}</div>`; }).join('')||'<span class="hint">No source components found.</span>'}</div></div>
    <div><h3>Technology</h3><div class="box">${catOrder.filter(c=>stack[c]).map(c=>`<div style="margin:5px 0"><span class="hint" style="display:inline-block;min-width:120px">${CAT_NAME[c]||c}</span>${stack[c].map(l=>`<span class="tag fw">${esc(l)}</span>`).join('')}</div>`).join('')||'<span class="hint">No well-known dependencies detected.</span>'}</div>
     <h3>Findings</h3>${insights().map(([k,h])=>`<div class="callout ${k}">${h}</div>`).join('')}</div></div>
   <div class="two"><div><h3>Entry points <small>where execution starts</small></h3><div class="box"><ul class="clean">${A.entries.slice(0,12).map(e=>`<li>⚡ <a class="mono" href="${ghBlob(e.path)}" target="_blank" rel="noopener">${esc(e.path)}</a> <span class="pill">${e.kind}</span></li>`).join('')||'<li class="hint">None detected (library?).</li>'}</ul></div></div>
    <div><h3>Most-used external packages</h3><div class="box">${A.externalPkgs.slice(0,16).map(p=>`<span class="tag ${p.tech?'fw':''}" title="${p.files} files">${esc(p.name)} <b>${p.files}</b></span>`).join('')||'<span class="hint">None.</span>'}</div></div></div>
   <div style="text-align:center;margin:30px 0"><button class="btn pri" id="goArch">Open the architecture map →</button></div></div>`;
  $('#goArch').onclick=()=>showTab('arch');
  document.querySelectorAll('#panel [data-comp]').forEach(a=>a.onclick=()=>{ showTab('arch'); setTimeout(()=>selectComp(+a.dataset.comp),50); });
}
function renderArch(){
  if (!A.comps.length) { $('#panel').innerHTML='<div class="wrap"><div class="callout">No source code components were found in this repo (it may be docs, config or assets only).</div></div>'; return; }
  $('#panel').innerHTML = `<div class="archwrap"><div class="canvas"><svg id="g1"></svg>
    <div class="toolbar"><div class="grp"><button data-l="layered" class="${UI.layout==='layered'?'on':''}">Layers</button><button data-l="force" class="${UI.layout==='force'?'on':''}">Network</button></div>
     <label><input type="checkbox" id="extChk" ${UI.showExt?'checked':''}> External systems</label>${(A.apiEdges||[]).length?`<label><input type="checkbox" id="apiChk" ${UI.showApi?'checked':''}> API calls</label>`:''}<button class="btn sm" id="fitBtn">Fit</button><input type="search" id="findIn" placeholder="Find component or class…" list="complist"><datalist id="complist">${A.comps.map(c=>`<option value="${esc(c.label)}">`).join('')}${(A.classes||[]).filter(k=>!k.fn).slice(0,4000).map(k=>`<option value="${esc(k.name)}">`).join('')}</datalist></div>
    <div class="keybox"><div class="row"><span><i class="ln" style="border-color:var(--out)"></i>depends on</span><span><i class="ln" style="border-color:var(--in)"></i>used by</span><span><i class="ln" style="border-color:var(--warn);border-top-style:dashed"></i>against layer flow</span>${(A.apiEdges||[]).length?'<span><i class="ln" style="border-color:var(--acc);border-top-style:dashed"></i>HTTP API call</span>':''}<span>⚡ entry · ↻ cycle</span></div></div></div>
    <aside class="drawer" id="drawer"></aside></div>`;
  GRAPH = GraphView($('#g1'),{node:selectNode, edge:drawerEdge, background:()=>{ UI.sel=null; GRAPH.select(null); if(UI.drill==null) drawerHome(); }});
  document.querySelectorAll('.toolbar [data-l]').forEach(b=>b.onclick=()=>{ UI.layout=b.dataset.l; UI.drill=null; document.querySelectorAll('.toolbar [data-l]').forEach(x=>x.classList.toggle('on',x===b)); drawArch(); });
  $('#extChk').onchange=e=>{ UI.showExt=e.target.checked; drawArch(); };
  if ($('#apiChk')) $('#apiChk').onchange=e=>{ UI.showApi=e.target.checked; drawArch(); };
  $('#fitBtn').onclick=()=>GRAPH.fit();
  $('#findIn').onchange=e=>{ const v=e.target.value, lv=v.toLowerCase(); const c=A.comps.find(c=>c.label===v); if(c) return selectComp(c.id); const k=(A.classes||[]).find(k=>!k.fn&&k.name===v)||(A.classes||[]).find(k=>!k.fn&&k.name.toLowerCase()===lv); if(k) return focusClass(k.id); const c2=A.comps.find(c=>c.label.toLowerCase().includes(lv)); if(c2) return selectComp(c2.id); const k2=(A.classes||[]).find(k=>!k.fn&&k.name.toLowerCase().includes(lv)); if(k2) focusClass(k2.id); };
  UI.drill=null; drawArch(); if (UI.sel && UI.sel[0]==='c') drawerComp(A.comps[+UI.sel.slice(1)]); else drawerHome();
  const qp=new URLSearchParams(location.search); if (qp.has('sel') && !renderArch.done) { renderArch.done=true; const c=A.comps.find(c=>c.label.includes(qp.get('sel'))); if(c){ selectComp(c.id); if(qp.has('drill')){ UI.drill=c.id; UI.drillMode=qp.get('drill')==='classes'?'classes':'files'; UI.drillMode==='classes'?drawClasses(c.id):drawDrill(c.id); drawerDrillHead(c);} if(qp.get('drill')==='methods'){ UI.drillMode='methods'; drawMethods(c.id); drawerDrillHead(c); } if(qp.has('class')){ const k=A.classes.find(k=>k.name===qp.get('class')); if(k) focusClass(k.id); } } }
}

/* flows */
function computePaths(){
  const cs=A.comps; const starts = cs.filter(c=>c.entries.length).sort((a,b)=>b.fanOut-a.fanOut);
  let st = starts.length? starts : cs.filter(c=>c.fanIn===0&&c.fanOut>0).sort((a,b)=>b.fanOut-a.fanOut);
  st = st.slice(0,6);
  const svcBy = cs.map(()=>[]); A.services.forEach((s,i)=>s.links.forEach(l=>svcBy[l[0]].push({s,i})));
  const res=[];
  for (const start of st) {
    const paths=[]; const dfs=(cur,path,seen)=>{
      if (paths.length>600) return;
      const outs = D.out[cur].slice().sort((a,b)=>b.w-a.w).filter(e=>!seen.has(e.t));
      if (!outs.length || path.length>=7) { paths.push(path.slice()); return; }
      for (const e of outs.slice(0,6)) { seen.add(e.t); path.push({id:e.t,edge:e}); dfs(e.t,path,seen); path.pop(); seen.delete(e.t); }
    };
    dfs(start.id,[{id:start.id}],new Set([start.id]));
    const scored = paths.map(p=>{ const last=p[p.length-1].id; const sv=svcBy[last][0]; return {p, sv, score:p.length*2+(sv?3:0)+p.reduce((a,x)=>a+(x.edge?Math.log2(1+x.edge.w):0),0)*0.3}; }).sort((a,b)=>b.score-a.score);
    const chosen=[]; for (const x of scored) { if (chosen.length>=3) break; if (x.p.length<2 && chosen.length) continue; if (chosen.some(c=>c.p.slice(0,2).map(y=>y.id).join()===x.p.slice(0,2).map(y=>y.id).join() && c.p[c.p.length-1].id===x.p[x.p.length-1].id)) continue; chosen.push(x); }
    res.push({start, paths:chosen});
  }
  return res;
}
function renderFlows(){
  const fl = computePaths();
  $('#panel').innerHTML = `<div class="wrap"><h3>Execution paths <small>how a request or command travels through the code, derived from real imports</small></h3>
   <p class="hint">Each walkthrough starts at an entry point and follows the heaviest import chain, ending at the deepest component and the external system it talks to. Click a step to inspect it.</p>
   ${fl.length? fl.map(f=>`<div class="flow"><div><b style="font-size:15px">From ${compLink(f.start.id)}</b> ${f.start.entries.slice(0,2).map(e=>`<span class="pill mono">${esc(base(e))}</span>`).join(' ')}</div>
     ${f.paths.map((x,i)=>`<div class="steps" style="margin-top:14px"><div class="hint" style="margin-bottom:6px">Path ${i+1} · ${x.p.length} component${x.p.length>1?'s':''}</div>
      ${x.p.map((s,j)=>{ const c=cs(s.id); const ex=s.edge&&s.edge.ex[0]; return `<div class="step"><div class="dot" style="background:${COMP_COLOR(c)}">${j+1}</div><div class="body">${j?`<div class="via">imports ×${s.edge.w}${ex?` · <span class="mono">${esc(base(ex[0]))} → ${esc(base(ex[1]))}</span>`:''}</div>`:''}<b data-comp="${c.id}">${esc(c.label)}</b> ${pillRole(c)}<div class="hint">${esc(describeComp(c).split(' — ')[1]||'')}</div></div></div>`; }).join('')}
      ${x.sv?`<div class="step"><div class="dot" style="background:var(--ext)">${CAT_ICON[x.sv.s.cat]||'●'}</div><div class="body"><div class="via">${x.sv.s.inferred?'likely talks to':'talks to'}</div><b data-svc="${x.sv.i}">${esc(x.sv.s.label)}</b> <span class="pill">${x.sv.s.cat}</span></div></div>`:''}</div>`).join('')}</div>`).join('') : '<div class="callout">No entry points or call chains could be derived.</div>'}</div>`;
  document.querySelectorAll('#panel [data-comp]').forEach(a=>a.onclick=()=>{ showTab('arch'); setTimeout(()=>selectComp(+a.dataset.comp),50); });
  document.querySelectorAll('#panel [data-svc]').forEach(a=>a.onclick=()=>{ showTab('arch'); setTimeout(()=>{ const i=+a.dataset.svc; UI.sel='x'+i; GRAPH.select(UI.sel); GRAPH.focus('x'+i); drawerSvc(A.services[i]); },50); });
  function cs(id){ return A.comps[+String(id).replace(/^c/,'')]; }
}
/* node ids in paths are numeric comp ids */

let AGRAPH=null;
function apiGraphData(){
  const calls=(A.apiCalls||[]).filter(c=>c.rt>=0 && (!UI.apiComp || String(c.comp)===UI.apiComp));
  const N=new Map(), E=new Map(), fileId=new Map(A.files.map(f=>[f.path,f.id]));
  const node=(id,o)=>{ let n=N.get(id); if(!n){ if(N.size>=160) return null; n={id,weight:0,kind:'comp',...o}; N.set(id,n); } return n; };
  const edge=(s,t,o)=>{ const k=s+'>'+t; let e=E.get(k); if(!e){ e={s,t,w:0,...o}; E.set(k,e); } e.w++; };
  const cc = id => id>=0?A.comps[id]:null; const colr = id => { const c=cc(id); return c?COMP_COLOR(c):undefined; };
  for (const c of calls) {
    const rt=A.routes[c.rt]; const eid='e'+c.rt;
    const en=node(eid,{col:2,label:rt.method+' '+rt.path,sub:rt.comp>=0?A.comps[rt.comp].label:base(rt.file),color:colr(rt.comp),epRt:c.rt,title:`${rt.method} ${rt.path}\nhandled in ${rt.file}`}); if(!en) continue; en.weight++;
    let src;
    if (c.cu>=0) {
      const k=A.classes[c.cu], uk=c.cu+'.'+c.mu; src='u'+uk;
      const un=node(src,{col:1,label:k.fn?k.methods[c.mu]:k.name+'.'+k.methods[c.mu],sub:base(c.file),color:colr(c.comp),unitKey:uk,title:mname(c.cu,c.mu)+'\n'+c.file}); if(!un) continue; un.weight++;
      if (!un.seeded) { un.seeded=true; for (const [ca,ma] of (D.mIn.get(uk)||[])) { const kf=A.classes[ca]; if (A.files[kf.file].path===c.file) continue; const fid='f'+kf.file; const fn=node(fid,{col:0,label:base(A.files[kf.file].path),sub:A.files[kf.file].comp>=0?A.comps[A.files[kf.file].comp].label:'',color:colr(A.files[kf.file].comp),fileKey:kf.file,title:A.files[kf.file].path}); if(!fn) break; fn.weight++; edge(fid,src,{kind:'call',title:`${mname(ca,ma)} calls ${mname(c.cu,c.mu)}`}); } }
    } else {
      const fid_=fileId.get(c.file); src='f'+fid_; const fn=node(src,{col:0,label:base(c.file),sub:'calls the API directly',color:colr(c.comp),fileKey:fid_,title:c.file}); if(!fn) continue; fn.weight++;
    }
    edge(src,eid,{kind:'api',title:`${c.method} ${c.path}\n${c.file}:${c.line}`});
  }
  return {nodes:[...N.values()], edges:[...E.values()], total:calls.length};
}
function apiCallRow(c){ const rt=c.rt>=0?A.routes[c.rt]:null; return `<li style="font-size:12px"><span class="method m-${c.method}">${c.method}</span> <span class="mono">${esc(c.path)}</span>${c.host?` <span class="pill">${esc(c.host)}</span>`:''}<br><a class="mono" href="${ghBlob(c.file)}#L${c.line}" target="_blank" rel="noopener">${esc(short(c.file,46))}:${c.line}</a>${c.cu>=0?` <span class="hint">(${esc(mname(c.cu,c.mu))})</span>`:''}${rt?`<br><span class="hint">→ handled by <span class="mono">${esc(rt.method)} ${esc(rt.path)}</span> in ${esc(base(rt.file))}</span>`:''}</li>`; }
function apiDetail(n){
  const all=A.apiCalls||[]; let title, body, list=[];
  if (n.epRt!=null) { const rt=A.routes[n.epRt]; list=all.filter(c=>c.rt===n.epRt); title=`<span class="method m-${rt.method}">${rt.method}</span> <span class="mono">${esc(rt.path)}</span>`; body=`<div class="hint">Handled in <a class="mono" href="${ghBlob(rt.file)}" target="_blank" rel="noopener">${esc(rt.file)}</a>${rt.comp>=0?' · '+compLink(rt.comp):''}</div><div style="margin:8px 0"><button class="btn sm" id="trBtn">Trace this endpoint</button> <button class="btn sm" data-imp="r:${n.epRt}">What depends on this?</button></div><h5>${list.length} client call${list.length>1?'s':''}</h5>`; }
  else if (n.unitKey) { const [cu,mu]=n.unitKey.split('.').map(Number); list=all.filter(c=>c.cu===cu&&c.mu===mu&&c.rt>=0); const callers=D.mIn.get(n.unitKey)||[]; title=`<b>${esc(mname(cu,mu))}</b>`; body=`<div class="hint">API client function in <a class="mono" href="${ghBlob(A.files[A.classes[cu].file].path)}" target="_blank" rel="noopener">${esc(A.files[A.classes[cu].file].path)}</a></div><h5>Makes ${list.length} HTTP call${list.length>1?'s':''}</h5>`; n._tail=`<h5>Called by ${callers.length} function${callers.length!==1?'s':''}</h5><div>${callers.slice(0,30).map(([a,b])=>`<span class="tag mono">${esc(mname(a,b))}</span>`).join('')||'<span class="hint">Nothing in the scanned code calls it directly.</span>'}</div>`; }
  else { const f=A.files[n.fileKey]; list=all.filter(c=>c.file===f.path&&c.rt>=0); title=`<b>${esc(base(f.path))}</b>`; body=`<div class="hint mono">${esc(f.path)}</div><h5>${list.length} HTTP call${list.length>1?'s':''} from this file</h5>`; }
  $('#apiDetail').innerHTML = `<div class="box"><div>${title}</div>${body}<ul class="clean">${list.slice(0,30).map(apiCallRow).join('')}</ul>${list.length>30?`<div class="hint">+${list.length-30} more</div>`:''}${n._tail||''}</div>`;
  if ($('#trBtn')) $('#trBtn').onclick=()=>{ UI.trace.sel='r:'+n.epRt; UI.trace.q=''; showTab('trace'); };
  document.querySelectorAll('#apiDetail [data-comp]').forEach(a=>a.onclick=()=>{ showTab('arch'); setTimeout(()=>selectComp(+a.dataset.comp),50); });
}
function renderApi(){
  const routes=A.routes, byMethod={}; routes.forEach(r=>byMethod[r.method]=(byMethod[r.method]||0)+1);
  const f=UI.apiFilter.toLowerCase();
  const calls=A.apiCalls||[]; const matched=calls.filter(c=>c.rt>=0), unmatched=calls.filter(c=>c.rt<0);
  const callsBy=new Map(); matched.forEach(c=>callsBy.set(c.rt,(callsBy.get(c.rt)||0)+1));
  const rs = routes.map((r,i)=>({r,i})).filter(({r})=>!f||(r.path+' '+r.file+' '+r.method).toLowerCase().includes(f));
  const ms = A.models.filter(m=>!f||(m.name+' '+m.file+' '+m.kind).toLowerCase().includes(f));
  const clientComps=[...new Set(matched.map(c=>c.comp))].filter(x=>x>=0);
  const gd = matched.length? apiGraphData() : null;
  const colMax = gd? Math.max(...[0,1,2].map(k=>gd.nodes.filter(n=>n.col===k).length)) : 0;
  const gh = Math.max(280, Math.min(620, Math.min(colMax,9)*70+90 + (colMax>9?Math.ceil(colMax/9)*0:0)));
  const hosts=new Map(); unmatched.forEach(c=>{ const k=c.host||'(same origin — no matching route found)'; hosts.set(k,(hosts.get(k)||0)+1); });
  $('#panel').innerHTML = `<div class="wrap">
   ${matched.length?`<h3>Frontend → backend calls <small>${matched.length} call${matched.length>1?'s':''} reach ${callsBy.size} of your endpoints</small></h3>
    <p class="hint">Left to right: the UI code that uses the client, the function that sends the request, and the endpoint that handles it. Requests are matched to routes by method and path (a prefix like <span class="mono">/api/v1</span> is ignored). Click anything for call sites.</p>
    ${clientComps.length>1?`<div style="margin:6px 0"><label class="hint">Only calls from <select id="apiComp"><option value="">all components</option>${clientComps.map(id=>`<option value="${id}" ${String(id)===UI.apiComp?'selected':''}>${esc(A.comps[id].label)}</option>`).join('')}</select></label></div>`:''}
    <div class="box" style="padding:0;height:${gh}px;position:relative;overflow:hidden"><div class="canvas" style="position:absolute;inset:0"><svg id="g3"></svg></div></div>
    <div id="apiDetail" style="margin-top:10px"><div class="hint">Click a node to see exactly where each request is made.</div></div>`
    :`<div class="callout">No frontend → backend HTTP calls were matched to routes${calls.length?` (${calls.length} client request${calls.length>1?'s':''} found, none matched a route in this repo)`:''}. Supported clients: fetch, axios and similar wrappers, Angular HttpClient, SWR, generated OpenAPI SDKs, Python requests/httpx, Go net/http, Spring RestTemplate/WebClient and .NET HttpClient.</div>`}
   <input class="filter" id="apiF" style="margin-top:18px" placeholder="Filter routes & models…" value="${esc(UI.apiFilter)}">
   <h3>HTTP surface <small>${routes.length} routes${Object.keys(byMethod).length?' · '+Object.entries(byMethod).map(([m,n])=>m+' '+n).join(' · '):''}</small></h3>
   ${rs.length?`<table><tr><th style="width:70px">Method</th><th>Path</th><th>Component</th><th>Defined in</th>${matched.length?'<th>Called from UI</th>':''}</tr>${rs.slice(0,500).map(({r,i})=>`<tr><td><span class="method m-${r.method}">${r.method}</span></td><td class="mono">${esc(r.path)}</td><td>${r.comp>=0?compLink(r.comp):''}</td><td><a class="mono" href="${ghBlob(r.file)}" target="_blank" rel="noopener">${esc(short(r.file,52))}</a></td>${matched.length?`<td>${callsBy.get(i)?`<a class="link" data-rt="${i}">${callsBy.get(i)} call${callsBy.get(i)>1?'s':''}</a>`:'<span class="hint">–</span>'}</td>`:''}</tr>`).join('')}</table>${rs.length>500?`<p class="hint">Showing 500 of ${rs.length}.</p>`:''}`:'<div class="callout">No HTTP routes detected (supported: Express/Fastify/Koa, Next.js file routes, NestJS, Flask, FastAPI, Django, Spring, ASP.NET, Rails, Laravel, Go routers, Actix/Axum).</div>'}
   ${unmatched.length?`<h3>Client requests with no matching route <small>${unmatched.length} · ${[...hosts.entries()].slice(0,4).map(([h,n])=>esc(h)+' '+n).join(' · ')}</small></h3><details class="box"><summary>Show requests (external APIs, other services, or routes this scan could not see)</summary><ul class="clean" style="margin-top:8px">${unmatched.slice(0,80).map(apiCallRow).join('')}</ul></details>`:''}
   <h3>Data model <small>${A.models.length} tables / entities / models</small></h3>
   ${ms.length?`<table><tr><th>Name</th><th>Kind</th><th>Component</th><th>Defined in</th></tr>${ms.slice(0,500).map(m=>`<tr><td><b>${esc(m.name)}</b></td><td><span class="pill">${esc(m.kind)}</span></td><td>${m.comp>=0?compLink(m.comp):''}</td><td><a class="mono" href="${ghBlob(m.file)}" target="_blank" rel="noopener">${esc(short(m.file,52))}</a></td></tr>`).join('')}</table>`:'<div class="callout">No data models detected.</div>'}</div>`;
  $('#apiF').oninput=e=>{ UI.apiFilter=e.target.value; const pos=e.target.selectionStart; renderApi(); const i=$('#apiF'); i.focus(); i.setSelectionRange(pos,pos); };
  document.querySelectorAll('#panel [data-comp]').forEach(a=>a.onclick=()=>{ showTab('arch'); setTimeout(()=>selectComp(+a.dataset.comp),50); });
  if ($('#apiComp')) $('#apiComp').onchange=e=>{ UI.apiComp=e.target.value; renderApi(); };
  if (gd) {
    AGRAPH = GraphView($('#g3'),{node:n=>{ AGRAPH.select(n.id); apiDetail(n); }, edge:()=>{}, background:()=>{ AGRAPH.select(null); $('#apiDetail').innerHTML='<div class="hint">Click a node to see exactly where each request is made.</div>'; }});
    const L = layeredLayout(gd.nodes,gd.edges,n=>n.col,{titles:['UI code that uses the client','Function that sends the request','Backend endpoint'],h:52,maxRows:10});
    AGRAPH.set(gd.nodes,gd.edges,'layered',L); requestAnimationFrame(()=>AGRAPH.fit());
    document.querySelectorAll('#panel [data-rt]').forEach(a=>a.onclick=()=>{ const id='e'+a.dataset.rt, n=AGRAPH.byId.get(id); window.scrollTo&&$('#g3').scrollIntoView({block:'center',behavior:'smooth'}); if(n){ AGRAPH.select(id); AGRAPH.focus(id); apiDetail(n); } else apiDetail({epRt:+a.dataset.rt}); });
  } else document.querySelectorAll('#panel [data-rt]').forEach(a=>a.onclick=()=>apiDetail({epRt:+a.dataset.rt}));
}

/* ---------------- feature trace ---------------- */
let TGRAPH=null;
const featKey = p => { const s=p.split('/').filter(x=>x && !/^[:{\[<*]/.test(x)); while(s.length>1 && /^(api|rest|v\d+|public|private|internal)$/i.test(s[0])) s.shift(); return (s[0]||'/').toLowerCase(); };
UI.trace = {sel:null, q:''};
function traceUi(i){ return (A.apiCalls||[]).filter(c=>c.rt===i); }
function traceGroups(){
  if (TG && TG.A===A) return TG.g; const g=new Map();
  A.routes.forEach((r,i)=>{ if (r.method==='PAGE') return; const k=featKey(r.path); if(!g.has(k)) g.set(k,{key:k,rts:[],ui:0,h:0}); const o=g.get(k); const ui=traceUi(i).length>0; o.rts.push({i,r,ui,h:r.hc!=null}); if(ui) o.ui++; if(r.hc!=null) o.h++; });
  const arr=[...g.values()]; arr.forEach(o=>o.rts.sort((a,b)=>(b.ui-a.ui)||(b.h-a.h)||a.r.path.localeCompare(b.r.path)));
  arr.sort((a,b)=>(b.ui-a.ui)||(b.h-a.h)||(b.rts.length-a.rts.length)||a.key.localeCompare(b.key)); TG={A,g:arr}; return arr;
}
let TG=null;
function traceData(rts){
  const N=new Map(), E=new Map(); let capped=false;
  const colr = id => { const c=id>=0?A.comps[id]:null; return c?COMP_COLOR(c):undefined; };
  const node=(id,o)=>{ let n=N.get(id); if(!n){ if(N.size>=140){ capped=true; return null; } n={id,weight:0,kind:'comp',...o}; N.set(id,n); } n.weight++; return n; };
  const edge=(s,t,o)=>{ if(!N.has(s)||!N.has(t)||s===t) return; const k=s+'>'+t; if(!E.has(k)) E.set(k,{s,t,w:1,...o}); };
  const unit=(c,m,col)=>{ const k=A.classes[c]; return node('u'+c+'.'+m,{col,label:k.fn?k.methods[m]:k.name+'.'+k.methods[m],sub:base(A.files[k.file].path),color:colr(k.comp),unitKey:c+'.'+m,title:mname(c,m)+'\n'+A.files[k.file].path}); };
  const fileNode=(fid,sub,col)=>{ const f=A.files[fid]; return node('f'+fid,{col,label:base(f.path),sub,color:colr(f.comp),fileKey:fid,title:f.path}); };
  const fileId=new Map(A.files.map(f=>[f.path,f.id])); const done=new Set(); let nHandlers=0;
  for (const i of rts) {
    const rt=A.routes[i]; const en=node('e'+i,{col:2,label:rt.method+' '+rt.path,sub:rt.comp>=0?A.comps[rt.comp].label:base(rt.file),color:colr(rt.comp),epRt:i,title:rt.method+' '+rt.path+'\n'+rt.file}); if(!en) continue;
    for (const c of traceUi(i).slice(0,6)) {
      let src;
      if (c.cu>=0) { const un=unit(c.cu,c.mu,1); if(!un) continue; src=un.id; let seeded=0; for (const [ca,ma] of (D.mIn.get(c.cu+'.'+c.mu)||[])) { const kf=A.classes[ca]; if (A.files[kf.file].path===c.file) continue; if (seeded++>=4) break; const fn=fileNode(kf.file,'',0); if(!fn) break; edge(fn.id,src,{kind:'call',title:mname(ca,ma)+' calls '+mname(c.cu,c.mu)}); } }
      else { const fn=fileNode(fileId.get(c.file),'calls the API directly',0); if(!fn) continue; src=fn.id; }
      edge(src,'e'+i,{kind:'api',title:c.method+' '+c.path+'\n'+c.file+':'+c.line});
    }
    if (rt.hc!=null) {
      const hn=unit(rt.hc,rt.hm,3); if(!hn) continue; edge('e'+i,hn.id,{kind:'call',title:'handled by '+mname(rt.hc,rt.hm)}); nHandlers++;
      const q=[[rt.hc,rt.hm,0]]; const seen=new Set([rt.hc+'.'+rt.hm]);
      while (q.length) { const [c,m,d]=q.shift(); if (d>=3) continue; const from='u'+c+'.'+m; if (done.has(from)) continue; done.add(from);
        let n=0; for (const [cb,mb] of (D.mOut.get(c+'.'+m)||[])) { if (n>=8) break; const key=cb+'.'+mb; if (key===c+'.'+m) continue; const tn=unit(cb,mb,4+Math.min(d,1)); if(!tn) break; n++; edge(from,tn.id,{kind:'call',title:mname(c,m)+' calls '+mname(cb,mb)}); if(!seen.has(key)){ seen.add(key); q.push([cb,mb,d+1]); } } }
    }
  }
  for (const n of [...N.values()]) { if (!n.unitKey) continue; const [c,m]=n.unitKey.split('.').map(Number); const mm=A.classes[c].mm&&A.classes[c].mm[m]; if (!mm||n.col<3) continue; for (const mi of mm.slice(0,4)) { const mo=A.models[mi]; const dn=node('d'+mi,{col:6,label:mo.name,sub:mo.kind,color:'var(--warn)',modelIdx:mi,title:mo.name+' ('+mo.kind+')\n'+mo.file}); if(dn) edge(n.id,dn.id,{kind:'data',title:mname(c,m)+' uses '+mo.name}); } }
  return {nodes:[...N.values()], edges:[...E.values()], capped, nHandlers};
}
function traceSel(){ const s=UI.trace.sel||''; if (s[0]==='r') return {rts:[+s.slice(2)], title:null}; const g=traceGroups().find(x=>x.key===s.slice(2)); return g?{rts:g.rts.slice(0,10).map(x=>x.i), group:g}:{rts:[]}; }
function traceDetail(n){
  const el=$('#traceDetail'); let h='';
  const callList=(arr,empty)=>arr.length?`<ul class="clean">${arr.slice(0,30).map(([c,mm])=>`<li><a class="link" data-method="${c}.${mm}">${esc(mname(c,mm))}</a></li>`).join('')}${arr.length>30?`<li class="hint">+${arr.length-30} more</li>`:''}</ul>`:`<div class="hint">${empty}</div>`;
  if (n.epRt!=null) { const rt=A.routes[n.epRt], cs=traceUi(n.epRt); h=`<div><span class="method m-${rt.method}">${rt.method}</span> <span class="mono">${esc(rt.path)}</span></div><div class="hint">Defined in <a class="mono" href="${ghBlob(rt.file)}${rt.line?'#L'+rt.line:''}" target="_blank" rel="noopener">${esc(rt.file)}${rt.line?':'+rt.line:''}</a>${rt.comp>=0?' · '+compLink(rt.comp):''}</div>${rt.hc!=null?`<div class="hint">Handled by <a class="link" data-method="${rt.hc}.${rt.hm}">${esc(mname(rt.hc,rt.hm))}</a></div>`:'<div class="hint">The handler is written inline in the route file, so its calls are not traced.</div>'}<h5>${cs.length} UI call${cs.length!==1?'s':''}</h5>${cs.length?`<ul class="clean">${cs.slice(0,12).map(apiCallRow).join('')}</ul>`:'<div class="hint">No frontend request in this repo reaches it.</div>'}`; }
  else if (n.unitKey) { const [c,m]=n.unitKey.split('.').map(Number), k=A.classes[c], key=n.unitKey, f=A.files[k.file]; const out=D.mOut.get(key)||[], inc=D.mIn.get(key)||[]; const ml=(k.mlines&&k.mlines[m])||k.line;
    h=`<div><b>${esc(mname(c,m))}</b></div><div class="hint">${A.comps[k.comp]?compLink(k.comp)+' · ':''}<a class="mono" href="${ghBlob(f.path)}#L${ml}" target="_blank" rel="noopener">${esc(f.path)}:${ml}</a></div><div style="margin:8px 0"><button class="btn sm" data-focus="${key}">Open in call graph</button> <button class="btn sm" data-imp="m:${key}">What depends on this?</button></div><h5>Calls (${out.length})</h5>${callList(out,'Makes no calls to other known functions.')}<h5>Called by (${inc.length})</h5>${callList(inc,'No known callers.')}`; }
  else if (n.modelIdx!=null) { const mo=A.models[n.modelIdx]; const users=A.classes.flatMap(k=>(k.mm||[]).flatMap((x,i)=>x.includes(n.modelIdx)?[[k.id,i]]:[])); h=`<div><b>${esc(mo.name)}</b> <span class="pill">${esc(mo.kind)}</span></div><div class="hint">Defined in <a class="mono" href="${ghBlob(mo.file)}" target="_blank" rel="noopener">${esc(mo.file)}</a></div><div style="margin:8px 0"><button class="btn sm" data-model="${n.modelIdx}">Open in data model</button></div><h5>Used by ${users.length} function${users.length!==1?'s':''}</h5>${callList(users,'None found.')}`; }
  else { const f=A.files[n.fileKey]; const cs=(A.apiCalls||[]).filter(c=>c.file===f.path&&c.rt>=0); h=`<div><b>${esc(base(f.path))}</b></div><div class="hint mono"><a href="${ghBlob(f.path)}" target="_blank" rel="noopener">${esc(f.path)}</a></div><h5>${cs.length} HTTP call${cs.length!==1?'s':''} from this file</h5><ul class="clean">${cs.slice(0,12).map(apiCallRow).join('')}</ul>`; }
  el.innerHTML=`<div class="box">${h}</div>`;
  el.querySelectorAll('[data-comp]').forEach(a=>a.onclick=()=>{ showTab('arch'); setTimeout(()=>selectComp(+a.dataset.comp),50); });
  el.querySelectorAll('[data-method]').forEach(a=>a.onclick=()=>{ const [c,m]=a.dataset.method.split('.').map(Number); focusMethod(c,m); });
  el.querySelectorAll('[data-focus]').forEach(a=>a.onclick=()=>{ const [c,m]=a.dataset.focus.split('.').map(Number); focusMethod(c,m); });
  el.querySelectorAll('[data-model]').forEach(a=>a.onclick=()=>{ UI.data.sel=+a.dataset.model; showTab('data'); });
}
function renderTrace(){
  const groups=traceGroups(); const q=UI.trace.q.toLowerCase();
  if (!groups.length) { $('#panel').innerHTML=`<div class="wrap"><h3>Feature trace</h3><div class="callout">No HTTP endpoints were detected in this repo, so there is nothing to trace from. The Architecture tab still shows how the code is connected.</div></div>`; return; }
  if (!UI.trace.sel) { const g=groups[0]; UI.trace.sel='g:'+g.key; }
  const cur=traceSel(); const curKey=UI.trace.sel;
  const vis = groups.map(g=>({g,rts:q?g.rts.filter(x=>(x.r.method+' '+x.r.path+' '+x.r.file+' '+g.key).toLowerCase().includes(q)):g.rts})).filter(x=>x.rts.length);
  const row=x=>`<div class="trrow ${curKey==='r:'+x.i?'on':''}" data-r="${x.i}"><span class="method m-${x.r.method}">${x.r.method}</span> <span class="mono">${esc(short(x.r.path,34))}</span>${x.ui?' <span class="pill" title="A frontend request reaches this endpoint">UI</span>':''}${x.h?'':' <span class="hint" title="No handler function was identified">·</span>'}</div>`;
  const list = vis.slice(0,80).map(({g,rts})=>{ const open=q||curKey==='g:'+g.key||(curKey[0]==='r'&&g.rts.some(x=>'r:'+x.i===curKey)); return `<div class="trgrp ${curKey==='g:'+g.key?'on':''}" data-g="${esc(g.key)}"><b>${esc(g.key)}</b> <span class="hint">${g.rts.length} endpoint${g.rts.length>1?'s':''}${g.ui?' · '+g.ui+' from UI':''}</span></div>${open?rts.slice(0,60).map(row).join(''):''}`; }).join('');
  const td=traceData(cur.rts); const colMax=Math.max(1,...[0,1,2,3,4,5,6].map(k=>td.nodes.filter(n=>n.col===k).length)); const gh=Math.max(300,Math.min(640,Math.min(colMax,8)*66+110));
  const title = cur.group ? `Feature “${esc(cur.group.key)}” <small>${cur.rts.length} endpoint${cur.rts.length>1?'s':''}${cur.group.rts.length>cur.rts.length?' of '+cur.group.rts.length:''}</small>` : `${esc(A.routes[cur.rts[0]].method)} ${esc(A.routes[cur.rts[0]].path)}`;
  $('#panel').innerHTML=`<div class="wrap"><h3>Feature trace <small>follow one feature from the screen to the database</small></h3>
   <p class="hint">Pick an area on the left. The graph reads left to right: the UI code that triggers it, the function that sends the request, the endpoint, the handler, what the handler calls, and the data models those functions touch. Click any box for its code location.</p>
   <div class="tr-grid"><div class="box trlist"><input class="filter" id="trF" placeholder="Find a feature or endpoint…" value="${esc(UI.trace.q)}">${list||'<div class="hint" style="padding:8px">Nothing matches.</div>'}${vis.length>80?`<div class="hint" style="padding:8px">Showing 80 of ${vis.length} groups. Use the filter.</div>`:''}</div>
   <div><h4 style="margin:0 0 6px">${title}</h4><div class="box" style="padding:0;height:${gh}px;position:relative;overflow:hidden"><div class="canvas" style="position:absolute;inset:0"><svg id="g5"></svg></div></div>
   ${td.capped?'<div class="hint" style="margin-top:4px">Large feature: the graph is trimmed. Select a single endpoint to see all of it.</div>':''}
   <div id="traceDetail" style="margin-top:10px"><div class="hint">Click a box to see where it lives, what it calls and who calls it.${td.nHandlers===0&&td.nodes.length?' (No handler function could be identified for these endpoints, so the trace stops at the endpoint.)':''}</div></div></div></div></div>`;
  $('#trF').oninput=e=>{ UI.trace.q=e.target.value; const pos=e.target.selectionStart; renderTrace(); const i=$('#trF'); i.focus(); i.setSelectionRange(pos,pos); };
  document.querySelectorAll('#panel .trgrp').forEach(a=>a.onclick=()=>{ UI.trace.sel='g:'+a.dataset.g; renderTrace(); });
  document.querySelectorAll('#panel .trrow').forEach(a=>a.onclick=()=>{ UI.trace.sel='r:'+a.dataset.r; renderTrace(); });
  if (td.nodes.length) {
    TGRAPH=GraphView($('#g5'),{node:n=>{ TGRAPH.select(n.id); traceDetail(n); }, edge:()=>{}, background:()=>{ TGRAPH.select(null); }});
    const L=layeredLayout(td.nodes,td.edges,n=>n.col,{titles:['UI that triggers it','Function that sends the request','Endpoint','Handler','Calls','Then calls','Data touched'],h:52,maxRows:9});
    TGRAPH.set(td.nodes,td.edges,'layered',L); requestAnimationFrame(()=>TGRAPH.fit());
    const first=td.nodes.find(n=>n.epRt!=null); if (first && cur.rts.length===1) { TGRAPH.select(first.id); traceDetail(first); }
  } else $('#g5').parentNode.innerHTML='<div class="hint" style="padding:16px">Nothing to draw for this selection.</div>';
}

/* ---------------- data model (ER) ---------------- */
let DGRAPH=null, MRT=null;
UI.data = {sel:null, q:''};
function modelRoutes(){
  if (MRT && MRT.A===A) return MRT.m; const m=new Map();
  A.routes.forEach((rt,ri)=>{ if (rt.hc==null) return; const seen=new Set([rt.hc+'.'+rt.hm]); let q=[[rt.hc,rt.hm,0]]; const got=new Set();
    while (q.length) { const [c,mi,d]=q.shift(); const mm=A.classes[c].mm&&A.classes[c].mm[mi]; if (mm) mm.forEach(x=>got.add(x)); if (d>=3) continue; let n=0; for (const [cb,mb] of (D.mOut.get(c+'.'+mi)||[])) { if (n++>=8) break; const k=cb+'.'+mb; if (!seen.has(k)) { seen.add(k); q.push([cb,mb,d+1]); } } }
    got.forEach(x=>{ if(!m.has(x)) m.set(x,[]); m.get(x).push(ri); }); });
  MRT={A,m}; return m;
}
function modelFlags(fl){ return (/pk/.test(fl)?'<span class="pill" style="background:var(--acc);color:#fff">PK</span> ':'')+(/fk/.test(fl)?'<span class="pill">FK</span> ':'')+(/uniq/.test(fl)?'<span class="pill">unique</span>':''); }
function dataGraph(){
  const E=A.modelEdges||[]; const deg=new Map(); E.forEach(([a,b])=>{ deg.set(a,(deg.get(a)||0)+1); deg.set(b,(deg.get(b)||0)+1); });
  let ids=A.models.map((_,i)=>i).sort((a,b)=>(deg.get(b)||0)-(deg.get(a)||0)); const trimmed=ids.length>120; ids=ids.slice(0,120); const set=new Set(ids);
  const edges=E.filter(([a,b])=>set.has(a)&&set.has(b)&&a!==b); const lvl=new Map(ids.map(i=>[i,0]));
  for (let it=0; it<8; it++) { let ch=false; for (const [a,b,k] of edges) { if (k==='m2m'||k==='o2o') continue; if (lvl.get(a)<=lvl.get(b) && lvl.get(b)+1<8) { lvl.set(a,lvl.get(b)+1); ch=true; } } if (!ch) break; }
  const used=modelRoutes();
  const nodes=ids.map(i=>{ const m=A.models[i]; return {id:'d'+i,col:lvl.get(i),kind:'comp',weight:deg.get(i)||0,label:m.name,sub:(m.fields?m.fields.length+' fields':m.kind)+((used.get(i)||[]).length?' · '+used.get(i).length+' endpoints':''),color:'var(--warn)',modelIdx:i,title:m.name+' ('+m.kind+')'}; });
  return {nodes, edges:edges.map(([a,b,k,via])=>({s:'d'+a,t:'d'+b,w:1,kind:'data',title:A.models[a].name+(k==='m2m'?' ↔ ':k==='o2o'?' ↔ (one-to-one) ':' → references ')+A.models[b].name+(via?' via '+via:'')})), trimmed};
}
function dataDetail(i){
  UI.data.sel=i; const m=A.models[i]; const rts=(modelRoutes().get(i)||[]); const E=A.modelEdges||[];
  const outs=E.filter(e=>e[0]===i), ins=E.filter(e=>e[1]===i);
  const rl=(arr,dir)=>arr.map(e=>{ const o=dir?e[1]:e[0]; return `<li><a class="link" data-model="${o}">${esc(A.models[o].name)}</a> <span class="hint">${e[2]==='m2m'?'many-to-many':e[2]==='o2o'?'one-to-one':dir?'referenced by this table':'has a foreign key to this table'}${e[3]?' · '+esc(e[3]):''}</span></li>`; }).join('');
  const users=A.classes.flatMap(k=>(k.mm||[]).flatMap((x,mi)=>x.includes(i)?[[k.id,mi]]:[]));
  $('#dataDetail').innerHTML=`<div class="box"><div><b style="font-size:15px">${esc(m.name)}</b> <span class="pill">${esc(m.kind)}</span> ${m.comp>=0?compLink(m.comp):''}</div>
   <div class="hint">Defined in <a class="mono" href="${ghBlob(m.file)}" target="_blank" rel="noopener">${esc(m.file)}</a> <button class="btn sm" data-imp="d:${i}">What depends on this?</button></div>
   ${m.fields&&m.fields.length?`<h5>${m.fields.length} field${m.fields.length>1?'s':''}</h5><table><tr><th>Name</th><th>Type</th><th></th></tr>${m.fields.map(f=>`<tr><td class="mono">${esc(f[0])}</td><td class="mono">${esc(f[1])}</td><td>${modelFlags(f[2])}</td></tr>`).join('')}</table>`:'<div class="hint" style="margin-top:8px">Fields could not be read from this definition.</div>'}
   ${outs.length||ins.length?`<h5>Relations</h5><ul class="clean">${rl(outs,true)}${rl(ins,false)}</ul>`:''}
   <h5>Endpoints that reach this data (${rts.length})</h5>${rts.length?`<ul class="clean">${rts.slice(0,20).map(ri=>{ const r=A.routes[ri]; return `<li><span class="method m-${r.method}">${r.method}</span> <span class="mono">${esc(r.path)}</span> <a class="link" data-trace="${ri}">trace</a></li>`; }).join('')}${rts.length>20?`<li class="hint">+${rts.length-20} more</li>`:''}</ul>`:'<div class="hint">No endpoint was traced to it (handlers are followed up to 3 calls deep).</div>'}
   <h5>Used by ${users.length} function${users.length!==1?'s':''}</h5><div>${users.slice(0,24).map(([c,mi])=>`<a class="tag mono link" data-method="${c}.${mi}">${esc(mname(c,mi))}</a>`).join(' ')||'<span class="hint">None found.</span>'}${users.length>24?` <span class="hint">+${users.length-24} more</span>`:''}</div></div>`;
  const d=$('#dataDetail');
  d.querySelectorAll('[data-comp]').forEach(a=>a.onclick=()=>{ showTab('arch'); setTimeout(()=>selectComp(+a.dataset.comp),50); });
  d.querySelectorAll('[data-model]').forEach(a=>a.onclick=()=>{ const j=+a.dataset.model; if (DGRAPH&&DGRAPH.byId.has('d'+j)) { DGRAPH.select('d'+j); DGRAPH.focus('d'+j); } dataDetail(j); });
  d.querySelectorAll('[data-trace]').forEach(a=>a.onclick=()=>{ UI.trace.sel='r:'+a.dataset.trace; UI.trace.q=''; showTab('trace'); });
  d.querySelectorAll('[data-method]').forEach(a=>a.onclick=()=>{ const [c,mi]=a.dataset.method.split('.').map(Number); focusMethod(c,mi); });
  document.querySelectorAll('.mcard').forEach(c=>c.classList.toggle('on',+c.dataset.m===i));
}
function renderData(){
  const ms=A.models; const E=A.modelEdges||[];
  if (!ms.length) { $('#panel').innerHTML=`<div class="wrap"><h3>Data model</h3><div class="callout">No data models were detected. Supported: Prisma, SQL, Django, SQLAlchemy/SQLModel, JPA, TypeORM, Drizzle, Mongoose, Sequelize and ActiveRecord.</div></div>`; return; }
  const used=modelRoutes(); const touched=ms.filter((_,i)=>(used.get(i)||[]).length).length;
  const q=UI.data.q.toLowerCase(); const cards=ms.map((m,i)=>({m,i})).filter(({m})=>!q||(m.name+' '+m.kind+' '+(m.fields||[]).map(f=>f[0]).join(' ')).toLowerCase().includes(q));
  const g=E.length?dataGraph():null; const colMax=g?Math.max(1,...[0,1,2,3,4,5,6,7].map(k=>g.nodes.filter(n=>n.col===k).length)):0; const gh=Math.max(280,Math.min(620,Math.min(colMax,8)*66+110));
  $('#panel').innerHTML=`<div class="wrap"><h3>Data model <small>${ms.length} table${ms.length>1?'s':''} / models · ${E.length} relation${E.length!==1?'s':''} · ${touched} reached by an endpoint</small></h3>
   <p class="hint">${g?'Tables that others point to are on the left; the tables that reference them are to the right. Dashed lines are foreign keys or references.':'No relations between these models were detected.'} Click a table for its fields, relations and the endpoints that reach it.</p>
   ${g?`<div class="box" style="padding:0;height:${gh}px;position:relative;overflow:hidden"><div class="canvas" style="position:absolute;inset:0"><svg id="g6"></svg></div></div>${g.trimmed?'<div class="hint">Showing the 120 most connected tables.</div>':''}`:''}
   <div id="dataDetail" style="margin-top:10px"><div class="hint">Click a table to see its columns.</div></div>
   <input class="filter" id="dataF" style="margin-top:18px" placeholder="Filter tables or columns…" value="${esc(UI.data.q)}">
   <div class="mgrid">${cards.slice(0,120).map(({m,i})=>`<div class="mcard" data-m="${i}"><b>${esc(m.name)}</b><span class="hint"> ${esc(m.kind)}</span>${(m.fields||[]).slice(0,7).map(f=>`<div class="mono mf">${esc(f[0])} <span class="hint">${esc(f[1])}</span> ${/pk/.test(f[2])?'🔑':''}${/fk/.test(f[2])?'🔗':''}</div>`).join('')}${(m.fields||[]).length>7?`<div class="hint">+${m.fields.length-7} more</div>`:''}</div>`).join('')}</div>${cards.length>120?'<div class="hint">Showing 120. Use the filter.</div>':''}</div>`;
  $('#dataF').oninput=e=>{ UI.data.q=e.target.value; const pos=e.target.selectionStart; renderData(); const x=$('#dataF'); x.focus(); x.setSelectionRange(pos,pos); };
  document.querySelectorAll('.mcard').forEach(c=>c.onclick=()=>{ const j=+c.dataset.m; if (DGRAPH&&DGRAPH.byId.has('d'+j)) { DGRAPH.select('d'+j); DGRAPH.focus('d'+j); } dataDetail(j); window.scrollTo&&$('#dataDetail').scrollIntoView({block:'nearest'}); });
  if (g) { DGRAPH=GraphView($('#g6'),{node:n=>{ DGRAPH.select(n.id); dataDetail(n.modelIdx); }, edge:()=>{}, background:()=>DGRAPH.select(null)});
    const L=layeredLayout(g.nodes,g.edges,n=>n.col,{titles:['Referenced tables','Reference those','Then these','And these','','','',''],h:52,maxRows:9}); DGRAPH.set(g.nodes,g.edges,'layered',L); requestAnimationFrame(()=>DGRAPH.fit()); }
  if (UI.data.sel!=null && UI.data.sel<ms.length) { dataDetail(UI.data.sel); if (DGRAPH&&DGRAPH.byId.has('d'+UI.data.sel)) DGRAPH.select('d'+UI.data.sel); }
}

/* ---------------- impact analysis ---------------- */
let IGRAPH=null; UI.impact=null; UI.impQ='';
const impKey = (t,k) => t+':'+k;
function impactSearch(q){
  q=q.toLowerCase().trim(); if (q.length<2) return [];
  const rank=(label)=>{ const l=label.toLowerCase(); const nm=l.split(/[.:]+/).pop(); return (nm===q?0:nm.startsWith(q)?1:l.startsWith(q)?2:3)*1000+label.length; };
  const fn=[]; for (const k of A.classes) for (let i=0;i<k.methods.length;i++) { const nm=mname(k.id,i); if (nm.toLowerCase().includes(q)) fn.push({t:'m',key:k.id+'.'+i,label:nm,sub:A.files[k.file].path,r:rank(nm)}); }
  const fl=A.files.filter(f=>f.path.toLowerCase().includes(q)&&f.scanned).map(f=>({t:'f',key:String(f.id),label:base(f.path),sub:f.path,r:rank(base(f.path))}));
  const md=A.models.map((m,i)=>({m,i})).filter(({m})=>m.name.toLowerCase().includes(q)).map(({m,i})=>({t:'d',key:String(i),label:m.name,sub:m.kind+' · '+m.file,r:rank(m.name)}));
  const rt=A.routes.map((r,i)=>({r,i})).filter(({r})=>r.method!=='PAGE'&&(r.method+' '+r.path).toLowerCase().includes(q)).map(({r,i})=>({t:'r',key:String(i),label:r.method+' '+r.path,sub:r.file,r:rank(r.path)}));
  const s=a=>a.sort((x,y)=>x.r-y.r);
  return [...s(rt).slice(0,6),...s(md).slice(0,6),...s(fl).slice(0,8),...s(fn).slice(0,14)];
}
function impactCompute(type,key){
  const seeds=[]; const seedFiles=new Set(); const fileOfUnit=k=>A.classes[+k.split('.')[0]].file;
  if (type==='m') seeds.push(key);
  else if (type==='f') { const fid=+key; seedFiles.add(fid); for (const k of A.classes) if (k.file===fid) for (let i=0;i<k.methods.length&&seeds.length<80;i++) seeds.push(k.id+'.'+i); }
  else if (type==='d') { const mi=+key; for (const k of A.classes) (k.mm||[]).forEach((x,i)=>{ if (x.includes(mi)&&seeds.length<150) seeds.push(k.id+'.'+i); }); }
  else if (type==='r') { for (const c of A.apiCalls||[]) if (c.rt===+key && c.cu>=0 && !seeds.includes(c.cu+'.'+c.mu)) seeds.push(c.cu+'.'+c.mu); }
  const depth=new Map(); const q=[]; seeds.forEach(s=>{ if (!depth.has(s)) { depth.set(s,0); q.push(s); } });
  for (let h=0;h<q.length&&depth.size<600;h++) { const s=q[h], d=depth.get(s); if (d>=6) continue; for (const [c,m] of (D.mIn.get(s)||[])) { const k=c+'.'+m; if (!depth.has(k)) { depth.set(k,d+1); q.push(k); if (depth.size>=600) break; } } }
  const files=new Set(seedFiles), comps=new Map(); for (const k of depth.keys()) { const fid=fileOfUnit(k); files.add(fid); const cid=A.files[fid].comp; if (cid>=0) comps.set(cid,(comps.get(cid)||0)+1); }
  const routes=new Set(); if (type==='r') routes.add(+key); else A.routes.forEach((rt,ri)=>{ if (rt.method==='PAGE') return; const fid=A.files.findIndex(f=>f.path===rt.file); if (rt.hc!=null ? depth.has(rt.hc+'.'+rt.hm) : (type==='f'&&seedFiles.has(fid))) routes.add(ri); });
  const ui=new Set(); for (const c of A.apiCalls||[]) if (routes.has(c.rt)) { const f=A.files.find(x=>x.path===c.file); if (f) ui.add(f.id); }
  for (const fid of files) { const c=A.files[fid].comp>=0?A.comps[A.files[fid].comp]:null; if (c&&c.role==='client'&&!TEST_RE.test(A.files[fid].path)) ui.add(fid); }
  const tests=new Set([...files].filter(fid=>TEST_RE.test(A.files[fid].path)));
  let importers=[]; if (type==='f') { const seen=new Map([[+key,0]]); const qq=[+key]; for (let h=0;h<qq.length&&seen.size<400;h++) { const d=seen.get(qq[h]); if (d>=4) continue; for (const i of A.files[qq[h]].importedBy) if (!seen.has(i)) { seen.set(i,d+1); qq.push(i); } } importers=[...seen.entries()].filter(([i])=>i!==+key).sort((a,b)=>a[1]-b[1]); }
  return {seeds, depth, files, comps, routes, ui, tests, importers, capped:depth.size>=600};
}
function impactGraph(type,key,R){
  const N=new Map(), E=[]; const colr=id=>{ const c=id>=0?A.comps[id]:null; return c?COMP_COLOR(c):undefined; };
  const order=[...R.depth.entries()].sort((a,b)=>a[1]-b[1]||(D.mIn.get(b[0])||[]).length-(D.mIn.get(a[0])||[]).length).slice(0,70);
  for (const [k,d] of order) { const [c,m]=k.split('.').map(Number); const kk=A.classes[c]; N.set('u'+k,{id:'u'+k,col:6-Math.min(d,6),kind:'comp',weight:(D.mIn.get(k)||[]).length,label:kk.fn?kk.methods[m]:kk.name+'.'+kk.methods[m],sub:base(A.files[kk.file].path),color:colr(kk.comp),unitKey:k,title:mname(c,m)+'\n'+A.files[kk.file].path}); }
  for (const [k] of order) for (const [cb,mb] of (D.mOut.get(k)||[])) { const t=cb+'.'+mb; if (N.has('u'+t) && R.depth.get(t)<R.depth.get(k)) E.push({s:'u'+k,t:'u'+t,w:1,kind:'call',title:mname(...k.split('.').map(Number))+' calls '+mname(cb,mb)}); }
  if (type==='d') { const m=A.models[+key]; N.set('t',{id:'t',col:7,kind:'comp',weight:5,label:m.name,sub:m.kind,color:'var(--warn)',modelIdx:+key,title:m.name}); R.seeds.slice(0,70).forEach(s=>{ if (N.has('u'+s)) E.push({s:'t',t:'u'+s,w:1,kind:'data',title:'uses '+m.name}); }); E.forEach(e=>{ if (e.s==='t') { const x=e.s; e.s=e.t; e.t=x; } }); }
  if (type==='r') { const rt=A.routes[+key]; N.set('t',{id:'t',col:7,kind:'comp',weight:5,label:rt.method+' '+rt.path,sub:base(rt.file),color:colr(rt.comp),epRt:+key,title:rt.method+' '+rt.path}); R.seeds.slice(0,70).forEach(s=>{ if (N.has('u'+s)) E.push({s:'u'+s,t:'t',w:1,kind:'api',title:'sends a request to this endpoint'}); }); }
  return {nodes:[...N.values()],edges:E,trimmed:R.depth.size>70};
}
function impactTitle(type,key){
  if (type==='m') { const [c,m]=key.split('.').map(Number); const k=A.classes[c], f=A.files[k.file]; return {name:mname(c,m),sub:`<a class="mono" href="${ghBlob(f.path)}#L${(k.mlines&&k.mlines[m])||k.line}" target="_blank" rel="noopener">${esc(f.path)}</a>`,kind:'Function'}; }
  if (type==='f') { const f=A.files[+key]; return {name:base(f.path),sub:`<a class="mono" href="${ghBlob(f.path)}" target="_blank" rel="noopener">${esc(f.path)}</a>`,kind:'File'}; }
  if (type==='d') { const m=A.models[+key]; return {name:m.name,sub:`<span class="mono">${esc(m.file)}</span>`,kind:'Data model'}; }
  const r=A.routes[+key]; return {name:r.method+' '+r.path,sub:`<span class="mono">${esc(r.file)}</span>`,kind:'Endpoint'};
}
function impactHome(){
  const hot=[...D.mIn.entries()].map(([k,v])=>({k,n:v.length})).sort((a,b)=>b.n-a.n).slice(0,8);
  const hf=A.files.filter(f=>f.scanned&&f.importedBy.length&&!TEST_RE.test(f.path)).sort((a,b)=>b.importedBy.length-a.importedBy.length).slice(0,8);
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:14px"><div class="box"><b>Most-called functions</b><div class="hint">Changing these touches the most code.</div><ul class="clean">${hot.map(h=>{ const [c,m]=h.k.split('.').map(Number); return `<li><a class="link" data-imp="m:${h.k}">${esc(mname(c,m))}</a> <span class="hint">${h.n} caller${h.n>1?'s':''}</span></li>`; }).join('')||'<li class="hint">No calls were resolved in this repo.</li>'}</ul></div>
   <div class="box"><b>Most-imported files</b><div class="hint">The files other files depend on most.</div><ul class="clean">${hf.map(f=>`<li><a class="link" data-imp="f:${f.id}">${esc(short(f.path,40))}</a> <span class="hint">${f.importedBy.length} file${f.importedBy.length>1?'s':''}</span></li>`).join('')||'<li class="hint">No imports were resolved.</li>'}</ul></div></div>`;
}
function renderImpact(){
  const I=UI.impact; const res=impactSearch(UI.impQ);
  let body='';
  if (I) {
    const R=impactCompute(I.type,I.key); const T=impactTitle(I.type,I.key); const gd=impactGraph(I.type,I.key,R);
    const nF=R.depth.size, nFiles=R.files.size, nC=R.comps.size, nR=R.routes.size;
    const level = (nR>=6||nC>=4||nF>=60)?'Wide':(nR>=1||nC>=2||nF>=8)?'Moderate':'Contained';
    const tile=(n,l)=>`<div class="box" style="text-align:center;padding:10px 6px"><div style="font-size:22px;font-weight:700">${n}</div><div class="hint">${l}</div></div>`;
    const colMax=Math.max(1,...[0,1,2,3,4,5,6,7].map(k=>gd.nodes.filter(n=>n.col===k).length)); const gh=Math.max(260,Math.min(620,Math.min(colMax,8)*66+110));
    const byDepth=[...R.depth.entries()].sort((a,b)=>a[1]-b[1]);
    const routesL=[...R.routes].slice(0,30);
    body=`<div class="box" style="margin-top:14px"><div class="hint">${T.kind}</div><div style="font-size:17px;font-weight:700">${esc(T.name)}</div><div class="hint">${T.sub}</div>
     <p style="margin:10px 0 0"><b>Blast radius: ${level}.</b> ${nF?`A change here can reach <b>${nF}</b> function${nF>1?'s':''} in <b>${nFiles}</b> file${nFiles>1?'s':''}${nC?` across <b>${nC}</b> component${nC>1?'s':''}`:''}${nR?`, <b>${nR}</b> endpoint${nR>1?'s':''}`:''}${R.ui.size?` and <b>${R.ui.size}</b> UI file${R.ui.size>1?'s':''}`:''}.`:`Nothing in the scanned code calls ${I.type==='d'?'functions that use this table':'this'}.`}${R.capped?' (Search stopped at 600 functions.)':''}</p></div>
     <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:10px">${tile(nF,'functions')}${tile(nFiles,'files')}${tile(nC,'components')}${tile(nR,'endpoints')}${tile(R.ui.size,'UI files')}${tile(R.tests.size,'tests')}</div>
     ${gd.nodes.length?`<h3>Who depends on it <small>read left to right: the farthest callers first, the thing you change on the right</small></h3><div class="box" style="padding:0;height:${gh}px;position:relative;overflow:hidden"><div class="canvas" style="position:absolute;inset:0"><svg id="g7"></svg></div></div>${gd.trimmed?'<div class="hint">Showing the 70 closest functions.</div>':''}<div id="traceDetail" style="margin-top:10px"><div class="hint">Click a box for its code location.</div></div>`:''}
     <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:14px">
      ${nR?`<div class="box"><b>Endpoints affected (${nR})</b><ul class="clean">${routesL.map(ri=>{ const r=A.routes[ri]; return `<li><span class="method m-${r.method}">${r.method}</span> <span class="mono">${esc(r.path)}</span> <a class="link" data-trace="${ri}">trace</a></li>`; }).join('')}</ul>${nR>30?`<div class="hint">+${nR-30} more</div>`:''}</div>`:''}
      ${R.ui.size?`<div class="box"><b>UI code affected (${R.ui.size})</b><ul class="clean">${[...R.ui].slice(0,25).map(fid=>`<li><a class="mono" href="${ghBlob(A.files[fid].path)}" target="_blank" rel="noopener">${esc(short(A.files[fid].path,44))}</a></li>`).join('')}</ul></div>`:''}
      ${nC?`<div class="box"><b>Components affected (${nC})</b><ul class="clean">${[...R.comps.entries()].sort((a,b)=>b[1]-a[1]).map(([cid,n])=>`<li>${compLink(cid)} <span class="hint">${n} function${n>1?'s':''}</span></li>`).join('')}</ul></div>`:''}
      ${R.tests.size?`<div class="box"><b>Tests that exercise it (${R.tests.size})</b><ul class="clean">${[...R.tests].slice(0,20).map(fid=>`<li><a class="mono" href="${ghBlob(A.files[fid].path)}" target="_blank" rel="noopener">${esc(short(A.files[fid].path,44))}</a></li>`).join('')}</ul></div>`:(nF?`<div class="box"><b>Tests</b><div class="hint">No test file was found among the callers.</div></div>`:'')}
      ${R.importers.length?`<div class="box"><b>Files that import this file (${R.importers.length})</b><ul class="clean">${R.importers.slice(0,25).map(([fid,d])=>`<li><span class="mono" style="font-size:12px">${esc(short(A.files[fid].path,44))}</span> <span class="hint">${d===1?'directly':d+' steps away'}</span></li>`).join('')}</ul></div>`:''}
     </div>
     ${nF>1?`<details class="box" style="margin-top:14px"><summary>All ${nF} affected functions, nearest first</summary><ul class="clean" style="margin-top:8px">${byDepth.slice(0,120).map(([k,d])=>{ const [c,m]=k.split('.').map(Number); return `<li><a class="link" data-method="${k}">${esc(mname(c,m))}</a> <span class="hint">${d===0?'the target':d===1?'calls it directly':d+' calls away'} · ${esc(short(A.files[A.classes[c].file].path,40))}</span></li>`; }).join('')}</ul></details>`:''}
     <p class="hint" style="margin-top:12px">This follows calls and imports found by reading the code. Callbacks, events, reflection and dynamic dispatch can hide a dependency, so treat it as a minimum, not a guarantee.</p>`;
    var GD=gd;
  } else body=impactHome();
  $('#panel').innerHTML=`<div class="wrap"><h3>Impact analysis <small>what breaks if I change this?</small></h3>
   <p class="hint">Search for a function, file, data table or endpoint. You will see everything that calls or depends on it, the endpoints and UI it reaches, and the tests that cover it.</p>
   <input class="filter" id="impF" style="max-width:560px;width:100%" placeholder="Search a function, file, table or endpoint…" value="${esc(UI.impQ)}" autocomplete="off">
   ${res.length?`<div class="box" style="margin-top:6px;padding:4px">${res.map(x=>`<div class="trrow" data-imp="${x.t}:${x.key}" style="padding-left:10px"><span class="pill">${{m:'function',f:'file',d:'table',r:'endpoint'}[x.t]}</span> <b>${esc(x.label)}</b> <span class="hint">${esc(short(x.sub,56))}</span></div>`).join('')}</div>`:''}
   ${body}</div>`;
  const inp=$('#impF'); inp.oninput=e=>{ UI.impQ=e.target.value; const pos=e.target.selectionStart; renderImpact(); const i=$('#impF'); i.focus(); i.setSelectionRange(pos,pos); };
  document.querySelectorAll('#panel [data-comp]').forEach(a=>a.onclick=()=>{ showTab('arch'); setTimeout(()=>selectComp(+a.dataset.comp),50); });
  document.querySelectorAll('#panel [data-trace]').forEach(a=>a.onclick=()=>{ UI.trace.sel='r:'+a.dataset.trace; UI.trace.q=''; showTab('trace'); });
  document.querySelectorAll('#panel details [data-method]').forEach(a=>a.onclick=()=>{ const [c,m]=a.dataset.method.split('.').map(Number); focusMethod(c,m); });
  if (typeof GD!=='undefined' && GD && GD.nodes.length) { IGRAPH=GraphView($('#g7'),{node:n=>{ IGRAPH.select(n.id); if (n.unitKey||n.epRt!=null||n.modelIdx!=null) traceDetail(n); }, edge:()=>{}, background:()=>IGRAPH.select(null)});
    const L=layeredLayout(GD.nodes,GD.edges,n=>n.col,{titles:['6 calls away','5 calls away','4 calls away','3 calls away','2 calls away','Calls it directly',({f:'Functions in this file',d:'Functions that use it',r:'Client function'})[I.type]||'Change here',({d:'Data table',r:'Endpoint'})[I.type]||''].slice(0,8),h:52,maxRows:9}); IGRAPH.set(GD.nodes,GD.edges,'layered',L); requestAnimationFrame(()=>IGRAPH.fit()); }
}
document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('[data-imp]'); if (!b) return; e.preventDefault(); const [t,...k]=b.dataset.imp.split(':'); UI.impact={type:t,key:k.join(':')}; UI.impQ=''; if (UI.tab!=='impact') showTab('impact'); else renderImpact(); window.scrollTo&&($('#panel').scrollTop=0); });

let RGRAPH=null;
function renderRuntime(){
  const cs=A.compose.services, dk=A.docker, wf=A.workflows;
  const envf=UI.envFilter.toLowerCase(); const env=A.env.filter(e=>!envf||e.name.toLowerCase().includes(envf));
  $('#panel').innerHTML = `<div class="wrap">
   <h3>Deploy & tooling signals</h3><div>${A.deployTargets.map(t=>`<span class="pill" style="margin:2px">${esc(t)}</span>`).join('')||'<span class="hint">None detected.</span>'}</div>
   ${cs.length?`<h3>Docker Compose <small>${A.compose.files.map(esc).join(', ')}</small></h3><div class="box" style="padding:0;height:${Math.max(240,Math.min(520,cs.length*60))}px;position:relative;overflow:hidden"><div class="canvas" style="position:absolute;inset:0"><svg id="g2"></svg></div></div>
    <table style="margin-top:12px"><tr><th>Service</th><th>Image / build</th><th>Ports</th><th>Depends on</th><th>Runs component</th></tr>${cs.map(s=>`<tr><td><b>${esc(s.name)}</b></td><td class="mono">${esc(s.image||('build: '+s.build))}</td><td class="mono">${esc(s.ports.join(', '))}</td><td>${esc(s.dependsOn.join(', '))}</td><td>${(s.comps||[]).slice(0,3).map(compLink).join(', ')}</td></tr>`).join('')}</table>`:''}
   ${dk.length?`<h3>Dockerfiles</h3><div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">${dk.map(d=>`<div class="box"><a class="mono" href="${ghBlob(d.path)}" target="_blank" rel="noopener">${esc(d.path)}</a><div class="hint" style="margin-top:6px">${d.stages.map(s=>esc(s.image)+(s.name?' as <b>'+esc(s.name)+'</b>':'')).join(' → ')}</div>${d.expose.length?`<div>exposes ${d.expose.map(p=>`<code>${esc(p)}</code>`).join(' ')}</div>`:''}${d.cmd?`<div class="mono hint">${esc(d.cmd)}</div>`:''}</div>`).join('')}</div>`:''}
   ${wf.length?`<h3>CI / CD workflows</h3>${wf.map(w=>`<div class="box" style="margin-bottom:10px"><b>${esc(w.name)}</b> <a class="mono hint" href="${ghBlob(w.path)}" target="_blank" rel="noopener">${esc(w.path)}</a><div style="margin:6px 0">on: ${w.triggers.map(t=>`<span class="pill">${esc(t)}</span>`).join(' ')}</div>
     ${w.jobs.map(j=>`<div style="margin:6px 0;padding-left:10px;border-left:2px solid var(--line)"><b>${esc(j.name)}</b> <span class="hint">${esc(j.runsOn)}${j.needs.length?' · after '+esc(j.needs.join(', ')):''}</span><div class="mono hint">${j.runs.map(esc).join('<br>')}</div>${j.uses.length?`<div>${j.uses.slice(0,6).map(u=>`<span class="tag">${esc(u)}</span>`).join('')}</div>`:''}</div>`).join('')}</div>`).join('')}`:''}
   ${Object.keys(A.scripts).length||A.makeTargets.length||A.procfile?`<h3>Commands</h3><div class="two">${Object.entries(A.scripts).slice(0,6).map(([p,s])=>`<div class="box"><div class="hint mono">${esc(p)}</div>${Object.entries(s).slice(0,12).map(([k,v])=>`<div><b class="mono">${esc(k)}</b> <span class="mono hint">${esc(String(v).slice(0,70))}</span></div>`).join('')}</div>`).join('')}${A.makeTargets.length?`<div class="box"><div class="hint">Makefile targets</div>${A.makeTargets.map(t=>`<span class="tag fw">${esc(t)}</span>`).join('')}</div>`:''}${A.procfile?`<div class="box"><div class="hint">Procfile</div><pre class="mono" style="margin:4px 0">${esc(A.procfile)}</pre></div>`:''}</div>`:''}
   ${A.infraFiles.length?`<h3>Infrastructure-as-code files</h3><div class="box">${A.infraFiles.slice(0,25).map(p=>`<div><a class="mono" href="${ghBlob(p)}" target="_blank" rel="noopener">${esc(p)}</a></div>`).join('')}</div>`:''}
   <h3>Configuration <small>${A.env.length} environment variables</small></h3><input class="filter" id="envF" placeholder="Filter variables…" value="${esc(UI.envFilter)}">
   ${env.length?`<table><tr><th>Variable</th><th>Example / default</th><th>Seen in</th></tr>${env.slice(0,300).map(e=>`<tr><td class="mono"><b>${esc(e.name)}</b></td><td class="mono">${esc((e.example||'').slice(0,50))}</td><td class="hint">${esc([...e.sources.filter(s=>s!=='code').map(s=>base(s)),e.files.length?e.files.length+' code file'+(e.files.length>1?'s':''):''].filter(Boolean).join(' · '))}</td></tr>`).join('')}</table>`:'<div class="callout">No environment variables found.</div>'}</div>`;
  document.querySelectorAll('#panel [data-comp]').forEach(a=>a.onclick=()=>{ showTab('arch'); setTimeout(()=>selectComp(+a.dataset.comp),50); });
  $('#envF').oninput=e=>{ UI.envFilter=e.target.value; const pos=e.target.selectionStart; renderRuntime(); const i=$('#envF'); i.focus(); i.setSelectionRange(pos,pos); };
  if (cs.length) {
    const depth = {}; const names=new Set(cs.map(s=>s.name));
    const h = (n,seen=new Set())=>{ if(depth[n]!==undefined) return depth[n]; if(seen.has(n)) return 0; seen.add(n); const s=cs.find(x=>x.name===n); const ds=(s?s.dependsOn:[]).filter(d=>names.has(d)); return depth[n]=ds.length?1+Math.max(...ds.map(d=>h(d,seen))):0; };
    cs.forEach(s=>h(s.name)); const H=Math.max(...Object.values(depth));
    const nodes = cs.map(s=>{ const kind=s.tech?s.tech.cat:(s.build?'app':'other'); return {id:s.name,kind:s.tech&&SERVICE_CATS.has(s.tech.cat)?'svc':'comp',cat:s.tech&&s.tech.cat,label:s.name,sub:s.image||('build '+s.build),icon:s.tech&&CAT_ICON[s.tech.cat],color:s.tech?'var(--ext)':'var(--core)',weight:1,title:s.name+(s.ports.length?'\nports: '+s.ports.join(', '):'')}; });
    const edges=[]; cs.forEach(s=>s.dependsOn.forEach(d=>{ if(names.has(d)) edges.push({s:s.name,t:d,w:1,title:s.name+' depends on '+d}); }));
    RGRAPH = GraphView($('#g2'),{node:()=>{}, edge:()=>{}});
    const titles = Array.from({length:H+1},(_,i)=>i===0?'Entry / apps':i===H?'Backing services':'Layer '+(i+1));
    const L=layeredLayout(nodes,edges,n=>H-depth[n.id],{titles,h:56}); RGRAPH.set(nodes,edges,'layered',L); requestAnimationFrame(()=>RGRAPH.fit());
  }
}

/* files */
function buildTree(){
  const root={name:'',children:new Map(),files:0,path:''};
  for (const f of A.files) { if (f.kind==='ignored') continue; let n=root; n.files++; const parts=f.path.split('/'); parts.forEach((p,i)=>{ if(i===parts.length-1) { n.children.set(p,{name:p,file:f,path:f.path}); } else { let c=n.children.get(p); if(!c){c={name:p,children:new Map(),files:0,path:parts.slice(0,i+1).join('/')};n.children.set(p,c);} c.files++; n=c; } }); }
  return root;
}
let TREE=null;
function renderFiles(){
  if(!TREE) TREE=buildTree();
  $('#panel').innerHTML = `<div class="filesplit"><div class="tree" id="tree"><div class="fsearch"><input id="tf" placeholder="Search files…" value="${esc(UI.treeFilter)}"></div><div id="trows"></div></div><div class="fdetail" id="fdetail"><div class="hint">Select a file. Colored dots show which architecture component (and layer) owns it.</div></div></div>`;
  const rows=$('#trows');
  function row(n,depth){
    const d=document.createElement('div'); d.className='trow'; d.style.paddingLeft=(6+depth*14)+'px';
    if (n.file) { const c=n.file.comp>=0?A.comps[n.file.comp]:null; d.innerHTML=`<span style="width:12px"></span><span class="dotc" style="background:${c?COMP_COLOR(c):'var(--line)'}"></span><span>${esc(n.name)}</span><span class="cnt">${fmtB(n.file.size)}</span>`; d.onclick=()=>{ rows.querySelectorAll('.on').forEach(x=>x.classList.remove('on')); d.classList.add('on'); fileDetail(n.file); }; return [d]; }
    const open = UI.tree[n.path]; d.innerHTML=`<span style="width:12px">${open?'▾':'▸'}</span><span>📁 ${esc(n.name)}</span><span class="cnt">${n.files}</span>`;
    const holder=document.createElement('div'); if(!open) holder.style.display='none';
    let built=false; const fill=()=>{ if(built) return; built=true; [...n.children.values()].sort((a,b)=>(!!a.file-!!b.file)||a.name.localeCompare(b.name)).forEach(c=>row(c,depth+1).forEach(x=>holder.appendChild(x))); };
    if(open) fill();
    d.onclick=()=>{ UI.tree[n.path]=!UI.tree[n.path]; fill(); holder.style.display=UI.tree[n.path]?'':'none'; d.firstChild.textContent=UI.tree[n.path]?'▾':'▸'; };
    return [d,holder];
  }
  function build(){
    rows.innerHTML=''; const q=UI.treeFilter.toLowerCase();
    if (q) { const hits=A.files.filter(f=>f.kind!=='ignored'&&f.path.toLowerCase().includes(q)).slice(0,300); hits.forEach(f=>row({name:f.path,file:f,path:f.path},0).forEach(x=>rows.appendChild(x))); if(!hits.length) rows.innerHTML='<div class="hint" style="padding:10px">No matches.</div>'; }
    else [...TREE.children.values()].sort((a,b)=>(!!a.file-!!b.file)||a.name.localeCompare(b.name)).forEach(c=>row(c,0).forEach(x=>rows.appendChild(x)));
  }
  build();
  $('#tf').oninput=e=>{ UI.treeFilter=e.target.value; build(); };
}
function fileDetail(f){
  const imp=f.imports.map(i=>A.files[i]), by=f.importedBy.map(i=>A.files[i]);
  const c=f.comp>=0?A.comps[f.comp]:null;
  $('#fdetail').innerHTML = `<h3 style="margin-top:0">${esc(base(f.path))}</h3><div class="mono hint">${esc(f.path)}</div>
   <div style="margin:10px 0;display:flex;gap:8px;flex-wrap:wrap"><a class="btn sm" href="${ghBlob(f.path)}" target="_blank" rel="noopener">Open on GitHub ↗</a><button class="btn sm" data-imp="f:${f.id}">What depends on this?</button>${c?`<button class="btn sm" id="toComp">Show ${esc(short(c.label,30))} in map</button>`:''}</div>
   <div class="hint">${esc(f.kind)} · ${fmtB(f.size)}${f.loc?' · '+f.loc+' lines':''}${f.lang?' · '+f.lang:''}${f.scanned?'':' · not scanned for imports'}</div>
   ${fileClasses(f.id).length?`<h3>Classes & types</h3>${fileClasses(f.id).map(k=>`<div><a class="link" data-class="${k.id}">${esc(k.name)}</a> <span class="pill">${esc(k.kind)}</span> <span class="hint">${k.methods.length?k.methods.slice(0,6).join(', ')+(k.methods.length>6?'…':''):''}</span></div>`).join('')}`:''}
   ${f.routes.length?`<h3>Routes</h3>${f.routes.map(r=>`<div><span class="method m-${r.method}">${r.method}</span> <span class="mono">${esc(r.path)}</span></div>`).join('')}`:''}
   ${f.models.length?`<h3>Models</h3>${f.models.map(m=>`<span class="tag fw">${esc(m.name)}</span>`).join('')}`:''}
   ${fileFns(f.id)?`<h3>Functions <small>${fileFns(f.id).methods.length}</small></h3><div>${fileFns(f.id).methods.map((n,i)=>{ const key=fileFns(f.id).id+'.'+i; return `<a class="tag mono link" data-method="${key}">${esc(n)}${(D.mOut.has(key)||D.mIn.has(key))?' ⇄':''}</a>`; }).join('')}</div>`:''}
   <div class="two"><div><h3>Imports <small>${imp.length}</small></h3><ul class="clean">${imp.map(x=>`<li class="mono link" data-p="${esc(x.path)}">${esc(x.path)}</li>`).join('')||'<li class="hint">none inside the repo</li>'}</ul></div>
   <div><h3>Imported by <small>${by.length}</small></h3><ul class="clean">${by.slice(0,60).map(x=>`<li class="mono link" data-p="${esc(x.path)}">${esc(x.path)}</li>`).join('')||'<li class="hint">no one in scanned files</li>'}</ul></div></div>
   ${f.externals.length?`<h3>External packages</h3>${f.externals.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}`:''}`;
  if (c) $('#toComp').onclick=()=>{ showTab('arch'); setTimeout(()=>selectComp(c.id),50); };
  document.querySelectorAll('#fdetail [data-class]').forEach(a=>a.onclick=()=>focusClass(+a.dataset.class));
  document.querySelectorAll('#fdetail [data-method]').forEach(a=>a.onclick=()=>{ const [c,m]=a.dataset.method.split('.').map(Number); focusMethod(c,m); });
  document.querySelectorAll('#fdetail [data-p]').forEach(a=>a.onclick=()=>{ const t=A.files.find(x=>x.path===a.dataset.p); if(t) fileDetail(t); });
}

/* export */
const mid_ = s => 'n'+s;
function mermaid(){
  const q = s => String(s).replace(/"/g,"'");
  const lines=['flowchart LR']; const byCol={};
  A.comps.forEach(c=>{ (byCol[D.col(c)]=byCol[D.col(c)]||[]).push(c); });
  Object.keys(byCol).sort().forEach(k=>{ lines.push(`  subgraph L${k}["${COL_TITLES[k]}"]`); byCol[k].forEach(c=>lines.push(`    c${c.id}["${q(c.label)}<br/><small>${c.files.length} files</small>"]`)); lines.push('  end'); });
  if (A.services.length) { lines.push('  subgraph EXT["External systems"]'); A.services.forEach((s,i)=>lines.push(`    x${i}[("${q(s.label)}")]`)); lines.push('  end'); }
  D.edges.forEach(e=>lines.push(`  c${e.s} ${e.back?'-.->':'-->'}|${e.w}| c${e.t}`));
  A.services.forEach((s,i)=>s.links.forEach(l=>lines.push(`  c${l[0]} -.-> x${i}`)));
  (A.apiEdges||[]).forEach(e=>lines.push(`  c${e.s} -. "HTTP API ×${e.w}" .-> c${e.t}`));
  return lines.join('\n');
}
function classMermaid(){
  const ce=(A.classEdges||[]).filter(e=>e[2]>0); if(!ce.length) return '';
  const d=classDeg(); const pick=ce.slice().sort((a,b)=>(d.get(b[0])||0)+(d.get(b[1])||0)-(d.get(a[0])||0)-(d.get(a[1])||0)).slice(0,90);
  const id=k=>k.name.replace(/\W/g,'_'); const lines=['classDiagram']; const seen=new Set();
  pick.forEach(([a,b,t])=>{ const A_=A.classes[a],B_=A.classes[b]; const l=`  ${id(B_)} <|${t===2?'..':'--'} ${id(A_)}`; if(!seen.has(l)){seen.add(l);lines.push(l);} });
  return lines.join('\n');
}
function callMermaid(){
  const cs=(A.calls||[]).filter(c=>c[0]!==c[2]); if(!cs.length) return '';
  const deg=new Map(); cs.forEach(([a,b,c,d])=>{ [a+'.'+b,c+'.'+d].forEach(k=>deg.set(k,(deg.get(k)||0)+1)); });
  const pick=cs.slice().sort((x,y)=>(deg.get(y[0]+'.'+y[1])+deg.get(y[2]+'.'+y[3]))-(deg.get(x[0]+'.'+x[1])+deg.get(x[2]+'.'+x[3]))).slice(0,70);
  const nodes=new Map(); const lines=['flowchart LR'];
  const nd=(c,m)=>{ const id='m'+c+'_'+m; if(!nodes.has(id)){ nodes.set(id,1); lines.push(`  ${id}["${mname(c,m).replace(/"/g,"'")}"]`); } return id; };
  pick.forEach(([a,b,c,d])=>lines.push(`  ${nd(a,b)} --> ${nd(c,d)}`));
  return lines.join('\n');
}
function markdownReport(){
  const r=A.repo, s=A.stats; const L=[];
  L.push(`# ${r.local?r.name:r.owner+'/'+r.name} — architecture`,'',`_Generated by Repo Atlas from ${r.local?'a local folder':r.url} @ ${r.branch}_`,'',narrative().replace(/<[^>]+>/g,''),'','## Components','','| Component | Layer | Files | Depends on | Used by |','|---|---|---|---|---|');
  A.comps.forEach(c=>L.push(`| \`${c.label}\` | ${ROLE_LABEL[c.role]} | ${c.files.length} | ${D.out[c.id].map(e=>A.comps[e.t].label).join(', ')||'—'} | ${D.inc[c.id].map(e=>A.comps[e.s].label).join(', ')||'—'} |`));
  if (A.services.length) { L.push('','## External systems',''); A.services.forEach(x=>L.push(`- **${x.label}** (${x.cat}) — used by ${x.links.map(l=>A.comps[l[0]].label).join(', ')}${x.inferred?' _(inferred)_':''}`)); }
  if (A.entries.length) { L.push('','## Entry points',''); A.entries.slice(0,15).forEach(e=>L.push(`- \`${e.path}\` (${e.kind})`)); }
  const rt=A.routes.filter(x=>x.method!=='PAGE'); if (rt.length) { L.push('','## HTTP endpoints',''); rt.slice(0,60).forEach(x=>L.push(`- \`${x.method} ${x.path}\` — ${x.file}`)); }
  if (A.compose.services.length) { L.push('','## Docker Compose services',''); A.compose.services.forEach(x=>L.push(`- **${x.name}** — ${x.image||'build '+x.build}${x.dependsOn.length?' (depends on '+x.dependsOn.join(', ')+')':''}`)); }
  L.push('','## Findings',''); insights().forEach(([,h])=>L.push('- '+h.replace(/<[^>]+>/g,'')));
  L.push('','```mermaid',mermaid(),'```');
  return L.join('\n');
}
function download(name, text, type='text/plain'){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function renderExport(){
  const m=mermaid(), md=markdownReport(), cm=classMermaid(), km=callMermaid();
  $('#panel').innerHTML = `<div class="wrap"><h3>Mermaid diagram <small>paste into GitHub README, Notion, mermaid.live…</small></h3><textarea class="out" id="mm" readonly>${esc(m)}</textarea>
   <div style="margin:8px 0 22px;display:flex;gap:8px"><button class="btn" id="cpm">Copy</button><button class="btn" id="dlm">Download .mmd</button></div>
   ${cm?`<h3>Class diagram (inheritance &amp; interfaces) <small>top ${Math.min(90,(A.classEdges||[]).filter(e=>e[2]>0).length)} relations</small></h3><textarea class="out" id="cm" readonly>${esc(cm)}</textarea><div style="margin:8px 0 22px"><button class="btn" id="cpc">Copy</button></div>`:''}
   ${km?`<h3>Method call graph <small>top cross-class calls</small></h3><textarea class="out" id="km" readonly>${esc(km)}</textarea><div style="margin:8px 0 22px"><button class="btn" id="cpk">Copy</button></div>`:''}
   <h3>Markdown architecture report</h3><textarea class="out" id="md" readonly>${esc(md)}</textarea><div style="margin:8px 0 22px;display:flex;gap:8px"><button class="btn" id="cpr">Copy</button><button class="btn" id="dlr">Download .md</button></div>
   <h3>Raw analysis</h3><p class="hint">Everything the analyzer found, as JSON. Re-open it later with “Load JSON” — no GitHub requests needed.</p><button class="btn" id="dlj">Download JSON</button></div>`;
  const cp=(id,btn)=>{ $(id).select(); navigator.clipboard&&navigator.clipboard.writeText($(id).value); btn.textContent='Copied ✓'; setTimeout(()=>btn.textContent='Copy',1200); };
  if ($('#cpc')) $('#cpc').onclick=e=>cp('#cm',e.target);
  if ($('#cpk')) $('#cpk').onclick=e=>cp('#km',e.target);
  $('#cpm').onclick=e=>cp('#mm',e.target); $('#cpr').onclick=e=>cp('#md',e.target);
  $('#dlm').onclick=()=>download(A.repo.name+'-architecture.mmd',m); $('#dlr').onclick=()=>download(A.repo.name+'-architecture.md',md);
  $('#dlj').onclick=()=>download(A.repo.name+'-atlas.json',JSON.stringify(A),'application/json');
}

/* ---------------- app shell ---------------- */
function setProgress(p){ $('#progress i').style.width=p+'%'; }
function landing(){
  const recent = JSON.parse(lsGet('atlas.recent')||'[]');
  $('#main').innerHTML = `<div class="landing"><h1>See how any GitHub repo<br>is built.</h1><p class="lead">Paste a repository and get an interactive map: the components, how they connect, where the entry points, APIs, databases and queues are, and how it runs. Everything is derived from the actual code — nothing leaves your browser except requests to GitHub.</p>
   <p><button class="btn" id="pickDir2">📁 Analyze a local folder</button> <span class="hint">Private or unpushed code? Pick a folder: it is read in your browser and never uploaded.</span></p>
   <div class="chips" id="ex">${['fastapi/full-stack-fastapi-template','spring-projects/spring-petclinic','gin-gonic/gin','expressjs/express','discourse/discourse','vercel/commerce'].map(r=>`<span class="chip" data-r="${r}">${r}</span>`).join('')}</div>
   ${recent.length?`<p class="hint" style="margin-top:22px">Recent</p><div class="chips">${recent.map(r=>`<span class="chip" data-r="${esc(r)}">${esc(r)}</span>`).join('')}</div>`:''}
   <div class="grid3"><div class="feat"><b>🗺 Architecture map</b><span>Layered diagram of components, imports between them, and the external systems they touch. Click anything to trace dependencies.</span></div>
   <div class="feat"><b>🧭 Execution paths</b><span>Auto-generated walkthroughs from each entry point down through the code to the database or API at the end.</span></div>
   <div class="feat"><b>🌐 API & data model</b><span>Every HTTP route and ORM model/table, grouped by the component that owns it.</span></div>
   <div class="feat"><b>🐳 Runtime</b><span>Docker Compose topology, Dockerfiles, CI workflows, env vars and scripts.</span></div>
   <div class="feat"><b>🔎 Findings</b><span>Cycles, layer inversions, hubs, isolated code and test coverage ratio.</span></div>
   <div class="feat"><b>📤 Export</b><span>Mermaid diagram, Markdown report and JSON to drop into docs.</span></div></div></div>`;
  document.querySelectorAll('[data-r]').forEach(c=>c.onclick=()=>{ $('#repoInput').value=c.dataset.r; run(); });
  if ($('#pickDir2')) $('#pickDir2').onclick=pickLocal;
}
async function run(){
  const v=$('#repoInput').value.trim(); if(!v) return;
  let parsed; try { parsed=parseRepoInput(v); } catch(e){ $('#main').innerHTML=`<div id="status"><div class="err">${esc(e.message)}</div></div>`; return; }
  $('#main').innerHTML = `<div id="status"><div style="font-size:40px">🛰</div><h3 id="phase" style="margin:10px 0 4px">Starting…</h3><div class="hint">Reading ${esc(parsed.owner+'/'+parsed.repo)} from GitHub — this takes 5–40 seconds depending on size.</div></div>`; setProgress(2);
  try {
    const res = await analyzeRepo(v,{token:lsGet('atlas.token'),budget:+$('#depth').value},p=>{ setProgress(p.pct); const el=$('#phase'); if(el) el.textContent=p.phase; });
    const rec=[parsed.owner+'/'+parsed.repo, ...JSON.parse(lsGet('atlas.recent')||'[]')].filter((x,i,a)=>a.indexOf(x)===i).slice(0,6); lsSet('atlas.recent',JSON.stringify(rec));
    try { history.replaceState(null,'','#'+parsed.owner+'/'+parsed.repo+(parsed.ref?'@'+parsed.ref:'')); } catch(e){}
    open_(res);
  } catch(e) { setProgress(0); $('#main').innerHTML=`<div id="status"><div style="font-size:40px">⚠️</div><div class="err"><b>Couldn't analyze that repo.</b><p>${esc(e.message)}</p></div></div>`; console.error(e); }
  setTimeout(()=>setProgress(0),600);
}
function open_(res){
  A=res; TREE=null; UI.sel=null; UI.drill=null; UI.drillMode='files'; A.classes=A.classes||[]; A.classEdges=A.classEdges||[]; A.calls=A.calls||[]; UI.tree={}; UI.treeFilter=''; UI.apiFilter=''; UI.envFilter='';
  // rehydrate Map-ish fields after JSON
  A.services.forEach(s=>{ if(!Array.isArray(s.links)) s.links=Object.entries(s.links).map(([k,v])=>[+k,v]); });
  derive(); const r=A.repo;
  $('#main').innerHTML = `<div class="repohead"><h2>${r.local?`📁 <b>${esc(r.name)}</b>`:`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.owner)}/<b>${esc(r.name)}</b></a>`}</h2><div class="meta">${r.local?`<span class="pill" title="Analysed in your browser. Nothing was uploaded.">🔒 local · not uploaded</span>`:''}<span>⎇ ${esc(r.branch)}</span>${r.remote?`<span>${esc(r.remote)}</span>`:''}${r.stars!=null?`<span>★ ${fmt(r.stars)}</span>`:''}${r.language?`<span>${esc(r.language)}</span>`:''}${r.license&&r.license!=='NOASSERTION'?`<span>${esc(r.license)}</span>`:''}${r.pushed?`<span>updated ${esc(r.pushed.slice(0,10))}</span>`:''}</div><div class="spacer"></div>${r.local?'':'<button class="btn sm" id="shareBtn">Copy link</button>'}</div>
   <nav class="tabs">${TABS.map(([k,l])=>`<button data-t="${k}">${l}</button>`).join('')}</nav><div class="panel" id="panel"></div>`;
  document.querySelectorAll('nav.tabs button').forEach(b=>b.onclick=()=>showTab(b.dataset.t));
  if ($('#shareBtn')) $('#shareBtn').onclick=e=>{ navigator.clipboard&&navigator.clipboard.writeText(location.href); e.target.textContent='Copied ✓'; setTimeout(()=>e.target.textContent='Copy link',1200); };
  const qt=new URLSearchParams(location.search).get('tab'); showTab(TABS.some(t=>t[0]===qt)?qt:'overview');
}

/* ---------------- local folder ---------------- */
function localStatus(msg){ const el=$('#phase'); if(el) el.textContent=msg; }
async function readGitInfo(textOf){
  const info={};
  try { const h=await textOf('.git/HEAD'); const m=h&&h.match(/ref:\s*refs\/heads\/(.+)/); if(m) info.branch=m[1].trim(); else if(h&&/^[0-9a-f]{7,}/.test(h.trim())) info.branch='detached @'+h.trim().slice(0,7); } catch(e){}
  try { const c=await textOf('.git/config'); const m=c&&c.match(/\[remote "origin"\][^\[]*?url\s*=\s*(\S+)/); if(m) info.remote=m[1].replace(/^git@([^:]+):/,'$1/').replace(/^https?:\/\//,'').replace(/\.git$/,'').replace(/\/\/[^@\/]*@/,'//'); } catch(e){}
  return info;
}
async function walkHandle(dirH, prefix, gi, out, st){
  const kids=[]; for await (const [name,h] of dirH.entries()) kids.push([name,h]);
  const g=kids.find(([n,h])=>n==='.gitignore'&&h.kind==='file'); if (g) { try { gi.add(prefix, await (await g[1].getFile()).text()); } catch(e){} }
  for (const [name,h] of kids) { const p=prefix+name;
    if (h.kind==='directory') { if (name==='.git' || IGN_RE.test(p+'/x') || gi.ignored(p,true)) continue; await walkHandle(h,p+'/',gi,out,st); }
    else { if (gi.ignored(p,false)) continue; if (out.length>=st.cap) { st.capped=true; continue; } try { const f=await h.getFile(); out.push({path:p,size:f.size,read:()=>f.text()}); } catch(e){} if (out.length%200===0) { localStatus(`Listing files… ${out.length}`); await new Promise(r=>setTimeout(r)); } }
  }
}
async function pickLocal(){
  if (!window.showDirectoryPicker) { $('#dirIn').value=''; $('#dirIn').click(); return; }
  let h; try { h = await showDirectoryPicker({mode:'read'}); } catch(e){ if (e && e.name==='AbortError') return; return localFail(e); }
  startLocalStatus(h.name);
  try {
    const gi=makeGitignore(), out=[], st={cap:40000,capped:false};
    await walkHandle(h,'',gi,out,st);
    const git = await readGitInfo(async p=>{ let d=h; const parts=p.split('/'); for (const x of parts.slice(0,-1)) d=await d.getDirectoryHandle(x); return await (await (await d.getFileHandle(parts[parts.length-1])).getFile()).text(); });
    await runLocal({name:h.name,files:out,branch:git.branch,remote:git.remote,capped:st.capped});
  } catch(e){ localFail(e); }
}
async function pickLocalFiles(list){
  const arr=[...list]; if(!arr.length) return;
  const name=(arr[0].webkitRelativePath||'').split('/')[0]||'folder'; startLocalStatus(name);
  try {
    const rel=f=>(f.webkitRelativePath||f.name).split('/').slice(1).join('/');
    const byPath=new Map(arr.map(f=>[rel(f),f]));
    const gi=makeGitignore(); const gis=[...byPath.keys()].filter(p=>/(^|\/)\.gitignore$/.test(p)&&!IGN_RE.test(p)).sort((a,b)=>a.split('/').length-b.split('/').length);
    for (const p of gis) { try { gi.add(p.replace(/\.gitignore$/,''), await byPath.get(p).text()); } catch(e){} }
    const out=[]; for (const [p,f] of byPath) { if (/(^|\/)\.git\//.test('/'+p) || IGN_RE.test(p) || gi.ignoredDeep(p)) continue; if (out.length>=40000) break; out.push({path:p,size:f.size,read:()=>f.text()}); }
    const git=await readGitInfo(async p=>byPath.has(p)?await byPath.get(p).text():null);
    await runLocal({name,files:out,branch:git.branch,remote:git.remote,capped:byPath.size>out.length&&out.length>=40000});
  } catch(e){ localFail(e); }
}
function startLocalStatus(name){ $('#main').innerHTML = `<div id="status"><div style="font-size:40px">📁</div><h3 id="phase" style="margin:10px 0 4px">Reading ${esc(name)}…</h3><div class="hint">🔒 Analysed entirely in your browser. No files are uploaded and no network requests are made.</div></div>`; setProgress(4); }
function localFail(e){ setProgress(0); $('#main').innerHTML=`<div id="status"><div style="font-size:40px">⚠️</div><div class="err"><b>Couldn't read that folder.</b><p>${esc(e&&e.message||e)}</p></div></div>`; console.error(e); }
async function runLocal(src){
  if (!src.files.length) return localFail(new Error('No analysable files found (everything was ignored by .gitignore or the built-in ignore list).'));
  try { history.replaceState(null,'',location.pathname+location.search); } catch(e){}
  const res = await analyzeRepo(null,{local:src,budget:+$('#depth').value},p=>{ setProgress(p.pct); localStatus(p.phase); });
  if (src.capped) res.stats.truncated=true;
  open_(res); setTimeout(()=>setProgress(0),600);
}
/* wiring */
$('#goform').onsubmit=e=>{ e.preventDefault(); run(); };
$('#themeBtn').onclick=()=>{ const r=document.documentElement; const cur=r.dataset.theme|| (matchMedia('(prefers-color-scheme:light)').matches?'light':'dark'); r.dataset.theme=cur==='light'?'dark':'light'; lsSet('atlas.theme',r.dataset.theme); if(A&&UI.tab==='arch') drawArch(); };
{ const th=lsGet('atlas.theme'); if(th) document.documentElement.dataset.theme=th; }
$('#tokenBtn').onclick=()=>{ $('#tokenInput').value=lsGet('atlas.token')||''; $('#tokenDlg').showModal(); };
$('#tokenDlg').addEventListener('close',()=>{ const v=$('#tokenDlg').returnValue; if(v==='save') lsSet('atlas.token',$('#tokenInput').value.replace(/[\s"']/g,'')||null); if(v==='clear') lsSet('atlas.token',null); $('#tokenBtn').textContent=lsGet('atlas.token')?'⚙ Token ✓':'⚙ Token'; });
$('#tokenBtn').textContent=lsGet('atlas.token')?'⚙ Token ✓':'⚙ Token';
$('#loadJson').onclick=()=>$('#fileIn').click();
$('#pickDir').onclick=pickLocal;
$('#dirIn').onchange=e=>pickLocalFiles(e.target.files);
document.addEventListener('click',e=>{ const a=e.target.closest&&e.target.closest('a[href="#nolink"]'); if(a) e.preventDefault(); });
$('#fileIn').onchange=async e=>{ const f=e.target.files[0]; if(!f)return; try { open_(JSON.parse(await f.text())); } catch(err){ alert('Could not read that file: '+err.message); } };
window.addEventListener('resize',()=>{ if(GRAPH&&UI.tab==='arch') GRAPH.fit(); });
{ const h=decodeURIComponent(location.hash.slice(1)); if(h){ $('#repoInput').value=h; run(); } else landing(); }
