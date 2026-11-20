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
const ghBlob = p => `${A.repo.url}/blob/${A.repo.branch}/${p.split('/').map(encodeURIComponent).join('/')}`;
const ghTree = p => `${A.repo.url}/tree/${A.repo.branch}/${p.split('/').map(encodeURIComponent).join('/')}`;
const short = (s,n) => s.length>n ? '…'+s.slice(-(n-1)) : s;
const lsGet = k => { try { return localStorage.getItem(k); } catch(e){ return null; } };
const lsSet = (k,v) => { try { v==null?localStorage.removeItem(k):localStorage.setItem(k,v); } catch(e){} };

let A = null;
const UI = {tab:'overview', sel:null, layout:'layered', showExt:true, drill:null, tree:{}, selFile:null, apiFilter:'', envFilter:'', treeFilter:''};

/* ---------------- derived ---------------- */
let D = null;
function derive(){
  const comps = A.comps;
  const col = c => ROLE_COL[c.role] ?? 2;
  const edges = A.edges.map(e=>({...e, back: col(comps[e.t]) < col(comps[e.s])}));
  const svcEdges = []; A.services.forEach((s,i)=>s.links.forEach(([cid,w])=>svcEdges.push({s:cid,t:'x'+i,w,inferred:s.inferred})));
  const inc = comps.map(()=>[]), out = comps.map(()=>[]);
  edges.forEach(e=>{ out[e.s].push(e); inc[e.t].push(e); });
  D = {edges, svcEdges, inc, out, col};
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
  svg.innerHTML = `<defs>${[['n','var(--edge)'],['o','var(--out)'],['i','var(--in)'],['w','var(--warn)']].map(([id,c])=>`<marker id="a-${id}-${svg.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill="${c}"/></marker>`).join('')}</defs><g class="vp"><g class="lanes"></g><g class="hdr"></g><g class="edges"></g><g class="nodes"></g></g>`;
  const vp = svg.querySelector('.vp'), gL = svg.querySelector('.lanes'), gH = svg.querySelector('.hdr'), gE = svg.querySelector('.edges'), gN = svg.querySelector('.nodes');
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
    for (const h of (G.headers||[])) { const t=mk('text',{class:'colhdr',x:h.x,y:h.y},gH); t.textContent=h.text; }
    const maxw = Math.max(1,...G.edges.map(e=>e.w||0));
    for (const e of G.edges) {
      if (!G.byId.has(e.s)||!G.byId.has(e.t)) continue;
      const g = mk('g',{class:'edge'+(e.back?' back':'')+(e.inferred?' inf':'')},gE);
      const line = mk('path',{class:'line','stroke-width':(1+Math.log2(1+(e.w||0))*0.7).toFixed(2),'marker-end':mid(e.back?'w':'n')},g);
      const hit = mk('path',{class:'hit'},g);
      const ti = mk('title',{},g); ti.textContent = e.title||'';
      g.addEventListener('click',ev=>{ ev.stopPropagation(); cb.edge&&cb.edge(e); });
      g.addEventListener('mouseenter',()=>g.classList.add('hov')); g.addEventListener('mouseleave',()=>g.classList.remove('hov'));
      G.edgeEls.push({e,g,line,hit});
    }
    updEdges();
    for (const n of G.nodes) { const g=buildNode(n); gN.appendChild(g); G.nodeEls.set(n.id,g); setPos(n); wireNode(g,n); }
    select(G.sel&&G.byId.has(G.sel)?G.sel:null, true);
  }
  function wireNode(g,n){
    let sx,sy,ox,oy,moved=false,down=false;
    g.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); down=true; moved=false; sx=ev.clientX; sy=ev.clientY; ox=n.x; oy=n.y; g.setPointerCapture(ev.pointerId); });
    g.addEventListener('pointermove',ev=>{ if(!down) return; const dx=ev.clientX-sx, dy=ev.clientY-sy; if(!moved && Math.hypot(dx,dy)>4) moved=true; if(moved){ n.x=ox+dx/G.view.k; n.y=oy+dy/G.view.k; setPos(n); updEdges(n.id); } });
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
      let m = e.back?'w':'n';
      if (id) { if (e.s===id){ g.classList.add('out'); m='o'; } else if (e.t===id){ g.classList.add('in'); m='i'; }
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
  G.set = (nodes,edges,mode,extra={}) => { G.nodes=nodes; G.edges=edges; G.mode=mode; G.headers=extra.headers; G.lanes=extra.lanes; render(); };
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
    for (let i=0;i<n;i++) for (let j=i+1;j<n;j++) { const a=nodes[i], b=nodes[j]; let dx=a.x-b.x, dy=a.y-b.y, d2=dx*dx+dy*dy||.01, d=Math.sqrt(d2); const minD=a.r+b.r+26; const f=(k*k/d2)*0.9 + (d<minD?(minD-d)*0.2:0); const fx=dx/d*f, fy=dy/d*f; a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy; }
    for (const [i,j] of links) { const a=nodes[i], b=nodes[j]; const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||.01; const f=(d-k*0.9)*0.035; const fx=dx/d*f, fy=dy/d*f; a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy; }
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
     <button class="btn sm" id="drillBtn">Explore files →</button>
     ${c.path?`<a class="btn sm" href="${ghTree(c.path)}" target="_blank" rel="noopener">GitHub ↗</a>`:''}
   </div>
   ${c.pkg?`<h5>Package</h5><div class="mono">${esc(c.pkg.name||'')} <span class="hint">(${esc(c.pkg.eco)})</span></div>`:''}
   <h5>Languages</h5><div class="bar">${Object.entries(c.langs).sort((a,b)=>b[1]-a[1]).map(([l,n],i)=>`<i style="width:${n/total*100}%;background:hsl(${(i*57+200)%360} 65% 60%)" title="${l}: ${n}"></i>`).join('')}</div>
   <div class="hint">${Object.entries(c.langs).sort((a,b)=>b[1]-a[1]).map(([l,n])=>`${l} ${n}`).join(' · ')}</div>
   ${c.tags.length?`<h5>Built with</h5>${c.tags.map(t=>`<span class="tag fw">${esc(t.label)}</span>`).join('')}`:''}
   ${c.entries.length?`<h5>Entry points</h5><ul class="clean">${c.entries.slice(0,6).map(p=>`<li>⚡ <a href="${ghBlob(p)}" target="_blank" rel="noopener" class="mono">${esc(p)}</a></li>`).join('')}</ul>`:''}
   ${eps.length?`<h5>Endpoints (${c.endpoints})</h5><ul class="clean">${eps.map(r=>`<li><span class="method m-${r.method}">${r.method}</span> <span class="mono">${esc(r.path)}</span></li>`).join('')}</ul>`:''}
   <h5>Depends on (${out.length})</h5>${out.length?`<ul class="clean">${out.map(e=>`<li>${compLink(e.t)} <span class="w">${e.w}×</span><div class="ex">${e.ex.slice(0,2).map(x=>esc(base(x[0]))+' → '+esc(base(x[1]))).join('<br>')}</div></li>`).join('')}</ul>`:'<div class="hint">Nothing inside the repo (leaf).</div>'}
   <h5>Used by (${inc.length})</h5>${inc.length?`<ul class="clean">${inc.map(e=>`<li>${compLink(e.s)} <span class="w">${e.w}×</span></li>`).join('')}</ul>`:'<div class="hint">Not imported by other components — likely an entry point or unused.</div>'}
   ${svcs.length?`<h5>Talks to</h5><ul class="clean">${svcs.map(x=>`<li>${CAT_ICON[x.s.cat]||''} <a class="link" data-svc="${x.i}">${esc(x.s.label)}</a> <span class="w">${x.s.inferred?'inferred':x.l[1]+' files'}</span></li>`).join('')}</ul>`:''}
   <h5>Key files</h5><ul class="clean">${key.map(f=>`<li><a href="${ghBlob(f.path)}" target="_blank" rel="noopener" class="mono">${esc(short(f.path,44))}</a><span class="w">${f.importedBy.length?'used by '+f.importedBy.length:fmtB(f.size)}</span></li>`).join('')}</ul>`;
  wireDrawer();
  $('#roleSel').onchange = e => { c.role=e.target.value; c.roleGuessed=false; derive(); drawArch(); drawerComp(c); };
  $('#drillBtn').onclick = () => { UI.drill=c.id; drawDrill(c.id); drawerDrillHead(c); };
}
function drawerDrillHead(c){
  $('#drawer').innerHTML = `<h4>${esc(c.label)}</h4><div class="hint">File-level view: circles are files (size ∝ bytes), arrows are imports. Dashed circles are other components these files touch.</div><div style="margin:10px 0"><button class="btn sm" id="backBtn">← Back to architecture</button></div><div class="hint">Click a file for details.</div>`;
  $('#backBtn').onclick = () => { UI.drill=null; drawArch(); drawerComp(c); };
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
  const r = e.raw; if(!r){ return; }
  $('#drawer').innerHTML = `<h4>${compLink(r.s)} → ${compLink(r.t)}</h4><div style="margin:6px 0">${r.w} import${r.w>1?'s':''}</div>${e.back?'<div class="callout warn">Goes against the usual layer direction (a lower layer importing a higher one). Worth a look if you care about clean layering.</div>':''}
   <h5>Examples</h5><ul class="clean">${r.ex.map(x=>`<li class="mono" style="font-size:11.5px"><a href="${ghBlob(x[0])}" target="_blank" rel="noopener">${esc(x[0])}</a><br>→ <a href="${ghBlob(x[1])}" target="_blank" rel="noopener">${esc(x[1])}</a></li>`).join('')}</ul>`;
  wireDrawer();
}
function drawerFile(f){
  const imp = f.imports.map(i=>A.files[i]), by = f.importedBy.map(i=>A.files[i]);
  $('#drawer').innerHTML = `<h4>${esc(base(f.path))}</h4><div class="mono hint">${esc(f.path)}</div><div style="margin:8px 0"><a class="btn sm" href="${ghBlob(f.path)}" target="_blank" rel="noopener">Open on GitHub ↗</a></div>
   <div class="hint">${fmtB(f.size)}${f.loc?' · '+f.loc+' lines':''}${f.lang?' · '+f.lang:''}${f.comp>=0?' · in '+esc(A.comps[f.comp].label):''}</div>
   ${f.routes.length?`<h5>Routes</h5>${f.routes.slice(0,10).map(r=>`<div><span class="method m-${r.method}">${r.method}</span> <span class="mono">${esc(r.path)}</span></div>`).join('')}`:''}
   ${f.models.length?`<h5>Models</h5>${f.models.map(m=>`<span class="tag fw">${esc(m.name)}</span>`).join('')}`:''}
   <h5>Imports (${imp.length})</h5><ul class="clean">${imp.slice(0,30).map(x=>`<li class="mono" style="font-size:11.5px">${esc(x.path)}</li>`).join('')||'<li class="hint">none resolved in repo</li>'}</ul>
   <h5>Imported by (${by.length})</h5><ul class="clean">${by.slice(0,30).map(x=>`<li class="mono" style="font-size:11.5px">${esc(x.path)}</li>`).join('')||'<li class="hint">no one (in scanned files)</li>'}</ul>
   ${f.externals.length?`<h5>External packages</h5>${f.externals.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}`:''}`;
}
function wireDrawer(){
  document.querySelectorAll('#drawer [data-comp]').forEach(a=>a.onclick=()=>selectComp(+a.dataset.comp));
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
const TABS = [['overview','Overview'],['arch','Architecture'],['flows','Flows'],['api','API & Data'],['runtime','Runtime'],['files','Files'],['export','Export']];
function showTab(t){
  UI.tab=t; document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  const p=$('#panel'); p.className='panel'+(t==='arch'||t==='files'?' flush':''); p.scrollTop=0;
  ({overview:renderOverview,arch:renderArch,flows:renderFlows,api:renderApi,runtime:renderRuntime,files:renderFiles,export:renderExport})[t]();
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
  if (A.stats.truncated) out.push(['warn','GitHub truncated the file tree for this very large repo; some files are missing.']);
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
    <div class="stat"><b>${A.models.length}</b><span>data models</span></div><div class="stat"><b>${A.entries.length}</b><span>entry points</span></div></div>
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
     <label><input type="checkbox" id="extChk" ${UI.showExt?'checked':''}> External systems</label><button class="btn sm" id="fitBtn">Fit</button><input type="search" id="findIn" placeholder="Find component…" list="complist"><datalist id="complist">${A.comps.map(c=>`<option value="${esc(c.label)}">`).join('')}</datalist></div>
    <div class="keybox"><div class="row"><span><i class="ln" style="border-color:var(--out)"></i>depends on</span><span><i class="ln" style="border-color:var(--in)"></i>used by</span><span><i class="ln" style="border-color:var(--warn);border-top-style:dashed"></i>against layer flow</span><span>⚡ entry · ↻ cycle</span></div></div></div>
    <aside class="drawer" id="drawer"></aside></div>`;
  GRAPH = GraphView($('#g1'),{node:selectNode, edge:drawerEdge, background:()=>{ UI.sel=null; GRAPH.select(null); if(UI.drill==null) drawerHome(); }});
  document.querySelectorAll('.toolbar [data-l]').forEach(b=>b.onclick=()=>{ UI.layout=b.dataset.l; UI.drill=null; document.querySelectorAll('.toolbar [data-l]').forEach(x=>x.classList.toggle('on',x===b)); drawArch(); });
  $('#extChk').onchange=e=>{ UI.showExt=e.target.checked; drawArch(); };
  $('#fitBtn').onclick=()=>GRAPH.fit();
  $('#findIn').onchange=e=>{ const c=A.comps.find(c=>c.label===e.target.value)||A.comps.find(c=>c.label.toLowerCase().includes(e.target.value.toLowerCase())); if(c) selectComp(c.id); };
  drawArch(); if (UI.sel && UI.sel[0]==='c') drawerComp(A.comps[+UI.sel.slice(1)]); else drawerHome();
  const qp=new URLSearchParams(location.search); if (qp.has('sel') && !renderArch.done) { renderArch.done=true; const c=A.comps.find(c=>c.label.includes(qp.get('sel'))); if(c){ selectComp(c.id); if(qp.has('drill')){ UI.drill=c.id; drawDrill(c.id); drawerDrillHead(c);} } }
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

function renderApi(){
  const routes=A.routes, byMethod={}; routes.forEach(r=>byMethod[r.method]=(byMethod[r.method]||0)+1);
  const f=UI.apiFilter.toLowerCase();
  const rs = routes.filter(r=>!f||(r.path+' '+r.file+' '+r.method).toLowerCase().includes(f));
  const ms = A.models.filter(m=>!f||(m.name+' '+m.file+' '+m.kind).toLowerCase().includes(f));
  $('#panel').innerHTML = `<div class="wrap"><input class="filter" id="apiF" placeholder="Filter routes & models…" value="${esc(UI.apiFilter)}">
   <h3>HTTP surface <small>${routes.length} routes${Object.keys(byMethod).length?' · '+Object.entries(byMethod).map(([m,n])=>m+' '+n).join(' · '):''}</small></h3>
   ${rs.length?`<table><tr><th style="width:70px">Method</th><th>Path</th><th>Component</th><th>Defined in</th></tr>${rs.slice(0,500).map(r=>`<tr><td><span class="method m-${r.method}">${r.method}</span></td><td class="mono">${esc(r.path)}</td><td>${r.comp>=0?compLink(r.comp):''}</td><td><a class="mono" href="${ghBlob(r.file)}" target="_blank" rel="noopener">${esc(short(r.file,52))}</a></td></tr>`).join('')}</table>${rs.length>500?`<p class="hint">Showing 500 of ${rs.length}.</p>`:''}`:'<div class="callout">No HTTP routes detected (supported: Express/Fastify/Koa, Next.js file routes, NestJS, Flask, FastAPI, Django, Spring, ASP.NET, Rails, Laravel, Go routers, Actix/Axum).</div>'}
   <h3>Data model <small>${A.models.length} tables / entities / models</small></h3>
   ${ms.length?`<table><tr><th>Name</th><th>Kind</th><th>Component</th><th>Defined in</th></tr>${ms.slice(0,500).map(m=>`<tr><td><b>${esc(m.name)}</b></td><td><span class="pill">${esc(m.kind)}</span></td><td>${m.comp>=0?compLink(m.comp):''}</td><td><a class="mono" href="${ghBlob(m.file)}" target="_blank" rel="noopener">${esc(short(m.file,52))}</a></td></tr>`).join('')}</table>`:'<div class="callout">No ORM models / SQL tables detected.</div>'}</div>`;
  $('#apiF').oninput=e=>{ UI.apiFilter=e.target.value; const pos=e.target.selectionStart; renderApi(); const i=$('#apiF'); i.focus(); i.setSelectionRange(pos,pos); };
  document.querySelectorAll('#panel [data-comp]').forEach(a=>a.onclick=()=>{ showTab('arch'); setTimeout(()=>selectComp(+a.dataset.comp),50); });
}

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
   <div style="margin:10px 0;display:flex;gap:8px;flex-wrap:wrap"><a class="btn sm" href="${ghBlob(f.path)}" target="_blank" rel="noopener">Open on GitHub ↗</a>${c?`<button class="btn sm" id="toComp">Show ${esc(short(c.label,30))} in map</button>`:''}</div>
   <div class="hint">${esc(f.kind)} · ${fmtB(f.size)}${f.loc?' · '+f.loc+' lines':''}${f.lang?' · '+f.lang:''}${f.scanned?'':' · not scanned for imports'}</div>
   ${f.routes.length?`<h3>Routes</h3>${f.routes.map(r=>`<div><span class="method m-${r.method}">${r.method}</span> <span class="mono">${esc(r.path)}</span></div>`).join('')}`:''}
   ${f.models.length?`<h3>Models</h3>${f.models.map(m=>`<span class="tag fw">${esc(m.name)}</span>`).join('')}`:''}
   <div class="two"><div><h3>Imports <small>${imp.length}</small></h3><ul class="clean">${imp.map(x=>`<li class="mono link" data-p="${esc(x.path)}">${esc(x.path)}</li>`).join('')||'<li class="hint">none inside the repo</li>'}</ul></div>
   <div><h3>Imported by <small>${by.length}</small></h3><ul class="clean">${by.slice(0,60).map(x=>`<li class="mono link" data-p="${esc(x.path)}">${esc(x.path)}</li>`).join('')||'<li class="hint">no one in scanned files</li>'}</ul></div></div>
   ${f.externals.length?`<h3>External packages</h3>${f.externals.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}`:''}`;
  if (c) $('#toComp').onclick=()=>{ showTab('arch'); setTimeout(()=>selectComp(c.id),50); };
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
  return lines.join('\n');
}
function markdownReport(){
  const r=A.repo, s=A.stats; const L=[];
  L.push(`# ${r.owner}/${r.name} — architecture`,'',`_Generated by Repo Atlas from ${r.url} @ ${r.branch}_`,'',narrative().replace(/<[^>]+>/g,''),'','## Components','','| Component | Layer | Files | Depends on | Used by |','|---|---|---|---|---|');
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
  const m=mermaid(), md=markdownReport();
  $('#panel').innerHTML = `<div class="wrap"><h3>Mermaid diagram <small>paste into GitHub README, Notion, mermaid.live…</small></h3><textarea class="out" id="mm" readonly>${esc(m)}</textarea>
   <div style="margin:8px 0 22px;display:flex;gap:8px"><button class="btn" id="cpm">Copy</button><button class="btn" id="dlm">Download .mmd</button></div>
   <h3>Markdown architecture report</h3><textarea class="out" id="md" readonly>${esc(md)}</textarea><div style="margin:8px 0 22px;display:flex;gap:8px"><button class="btn" id="cpr">Copy</button><button class="btn" id="dlr">Download .md</button></div>
   <h3>Raw analysis</h3><p class="hint">Everything the analyzer found, as JSON. Re-open it later with “Load JSON” — no GitHub requests needed.</p><button class="btn" id="dlj">Download JSON</button></div>`;
  const cp=(id,btn)=>{ $(id).select(); navigator.clipboard&&navigator.clipboard.writeText($(id).value); btn.textContent='Copied ✓'; setTimeout(()=>btn.textContent='Copy',1200); };
  $('#cpm').onclick=e=>cp('#mm',e.target); $('#cpr').onclick=e=>cp('#md',e.target);
  $('#dlm').onclick=()=>download(A.repo.name+'-architecture.mmd',m); $('#dlr').onclick=()=>download(A.repo.name+'-architecture.md',md);
  $('#dlj').onclick=()=>download(A.repo.name+'-atlas.json',JSON.stringify(A),'application/json');
}

/* ---------------- app shell ---------------- */
function setProgress(p){ $('#progress i').style.width=p+'%'; }
function landing(){
  const recent = JSON.parse(lsGet('atlas.recent')||'[]');
  $('#main').innerHTML = `<div class="landing"><h1>See how any GitHub repo<br>is built.</h1><p class="lead">Paste a repository and get an interactive map: the components, how they connect, where the entry points, APIs, databases and queues are, and how it runs. Everything is derived from the actual code — nothing leaves your browser except requests to GitHub.</p>
   <div class="chips" id="ex">${['fastapi/full-stack-fastapi-template','spring-projects/spring-petclinic','gin-gonic/gin','expressjs/express','discourse/discourse','vercel/commerce'].map(r=>`<span class="chip" data-r="${r}">${r}</span>`).join('')}</div>
   ${recent.length?`<p class="hint" style="margin-top:22px">Recent</p><div class="chips">${recent.map(r=>`<span class="chip" data-r="${esc(r)}">${esc(r)}</span>`).join('')}</div>`:''}
   <div class="grid3"><div class="feat"><b>🗺 Architecture map</b><span>Layered diagram of components, imports between them, and the external systems they touch. Click anything to trace dependencies.</span></div>
   <div class="feat"><b>🧭 Execution paths</b><span>Auto-generated walkthroughs from each entry point down through the code to the database or API at the end.</span></div>
   <div class="feat"><b>🌐 API & data model</b><span>Every HTTP route and ORM model/table, grouped by the component that owns it.</span></div>
   <div class="feat"><b>🐳 Runtime</b><span>Docker Compose topology, Dockerfiles, CI workflows, env vars and scripts.</span></div>
   <div class="feat"><b>🔎 Findings</b><span>Cycles, layer inversions, hubs, isolated code and test coverage ratio.</span></div>
   <div class="feat"><b>📤 Export</b><span>Mermaid diagram, Markdown report and JSON to drop into docs.</span></div></div></div>`;
  document.querySelectorAll('[data-r]').forEach(c=>c.onclick=()=>{ $('#repoInput').value=c.dataset.r; run(); });
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
  A=res; TREE=null; UI.sel=null; UI.drill=null; UI.tree={}; UI.treeFilter=''; UI.apiFilter=''; UI.envFilter='';
  // rehydrate Map-ish fields after JSON
  A.services.forEach(s=>{ if(!Array.isArray(s.links)) s.links=Object.entries(s.links).map(([k,v])=>[+k,v]); });
  derive(); const r=A.repo;
  $('#main').innerHTML = `<div class="repohead"><h2><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.owner)}/<b>${esc(r.name)}</b></a></h2><div class="meta"><span>⎇ ${esc(r.branch)}</span>${r.stars!=null?`<span>★ ${fmt(r.stars)}</span>`:''}${r.language?`<span>${esc(r.language)}</span>`:''}${r.license&&r.license!=='NOASSERTION'?`<span>${esc(r.license)}</span>`:''}${r.pushed?`<span>updated ${esc(r.pushed.slice(0,10))}</span>`:''}</div><div class="spacer"></div><button class="btn sm" id="shareBtn">Copy link</button></div>
   <nav class="tabs">${TABS.map(([k,l])=>`<button data-t="${k}">${l}</button>`).join('')}</nav><div class="panel" id="panel"></div>`;
  document.querySelectorAll('nav.tabs button').forEach(b=>b.onclick=()=>showTab(b.dataset.t));
  $('#shareBtn').onclick=e=>{ navigator.clipboard&&navigator.clipboard.writeText(location.href); e.target.textContent='Copied ✓'; setTimeout(()=>e.target.textContent='Copy link',1200); };
  const qt=new URLSearchParams(location.search).get('tab'); showTab(TABS.some(t=>t[0]===qt)?qt:'overview');
}
/* wiring */
$('#goform').onsubmit=e=>{ e.preventDefault(); run(); };
$('#themeBtn').onclick=()=>{ const r=document.documentElement; const cur=r.dataset.theme|| (matchMedia('(prefers-color-scheme:light)').matches?'light':'dark'); r.dataset.theme=cur==='light'?'dark':'light'; lsSet('atlas.theme',r.dataset.theme); if(A&&UI.tab==='arch') drawArch(); };
{ const th=lsGet('atlas.theme'); if(th) document.documentElement.dataset.theme=th; }
$('#tokenBtn').onclick=()=>{ $('#tokenInput').value=lsGet('atlas.token')||''; $('#tokenDlg').showModal(); };
$('#tokenDlg').addEventListener('close',()=>{ const v=$('#tokenDlg').returnValue; if(v==='save') lsSet('atlas.token',$('#tokenInput').value.replace(/[\s"']/g,'')||null); if(v==='clear') lsSet('atlas.token',null); $('#tokenBtn').textContent=lsGet('atlas.token')?'⚙ Token ✓':'⚙ Token'; });
$('#tokenBtn').textContent=lsGet('atlas.token')?'⚙ Token ✓':'⚙ Token';
$('#loadJson').onclick=()=>$('#fileIn').click();
$('#fileIn').onchange=async e=>{ const f=e.target.files[0]; if(!f)return; try { open_(JSON.parse(await f.text())); } catch(err){ alert('Could not read that file: '+err.message); } };
window.addEventListener('resize',()=>{ if(GRAPH&&UI.tab==='arch') GRAPH.fit(); });
{ const h=decodeURIComponent(location.hash.slice(1)); if(h){ $('#repoInput').value=h; run(); } else landing(); }
