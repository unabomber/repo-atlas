const fs=require('fs');
const src=fs.readFileSync(__dirname+'/analyzer.js','utf8');
const {analyzeRepo}=new Function(src+'\nreturn {analyzeRepo};')();
(async()=>{
  const A=await analyzeRepo(process.argv[2],{budget:+process.argv[3]||400,token:process.env.GH_TOKEN},()=>{});
  const s=A.stats; console.log(`files ${s.totalFiles} src ${s.sourceFiles} scanned ${s.scanned}`, s.languages.slice(0,4).map(l=>l.name+l.files).join(' '));
  console.log('COMPS'); A.comps.forEach(c=>console.log(' ',c.label.padEnd(34),c.role+(c.roleGuessed?'?':''),'f'+c.files.length,'in'+c.fanIn,'out'+c.fanOut,'ep'+c.endpoints,'['+c.tags.map(t=>t.label).join(',')+']'));
  console.log('EDGES'); A.edges.sort((a,b)=>b.w-a.w).slice(0,15).forEach(e=>console.log(' ',A.comps[e.s].label,'->',A.comps[e.t].label,e.w));
  console.log('SERVICES',A.services.map(s=>s.label+'('+s.cat+(s.inferred?',inf':'')+'->'+s.links.map(l=>A.comps[l[0]].label).join('|')+')').join('; '));
  console.log('ENTRIES',A.entries.slice(0,6).map(e=>e.path+':'+e.kind).join(', '));
  console.log('ROUTES',A.routes.length,A.routes.slice(0,5).map(r=>r.method+' '+r.path).join(', '),'MODELS',A.models.length,A.models.slice(0,5).map(m=>m.name).join(','));
  console.log('COMPOSE',A.compose.services.map(s=>s.name+':'+(s.image||s.build)+'<-'+s.dependsOn).join('; '));
  { const k=A.classes||[]; console.log('FN MODULES',k.filter(x=>x.fn).length,'functions',k.filter(x=>x.fn).reduce((a,x)=>a+x.methods.length,0)); const t=[0,0,0]; (A.classEdges||[]).forEach(e=>t[e[2]]++); console.log('CLASSES',k.length,'uses/extends/implements',t.join('/')); (A.classEdges||[]).filter(e=>e[2]>0).slice(0,8).forEach(e=>console.log('  ',k[e[0]].name,['','extends','implements'][e[2]],k[e[1]].name)); console.log('CALLS',(A.calls||[]).length); (A.calls||[]).filter(c=>c[0]!==c[2]).slice(0,10).forEach(c=>console.log('  ',k[c[0]].name+'.'+k[c[0]].methods[c[1]],'->',k[c[2]].name+'.'+k[c[2]].methods[c[3]])); const big=k.slice().sort((a,b)=>b.methods.length-a.methods.length)[0]; if(big) console.log('  most methods:',big.name,big.methods.slice(0,8).join(',')); }
  { const c=A.apiCalls||[]; console.log('API CALLS',c.length,'matched',c.filter(x=>x.rt>=0).length,'external',c.filter(x=>x.host&&x.rt<0).length); c.slice(0,14).forEach(x=>console.log('  ',x.method.padEnd(6),x.path.padEnd(38),(x.file.split('/').pop()+':'+x.line).padEnd(26),x.rt>=0?'-> '+A.routes[x.rt].method+' '+A.routes[x.rt].path+' ('+A.routes[x.rt].file.split('/').pop()+')':(x.host?'ext '+x.host:'UNMATCHED'))); (A.apiEdges||[]).forEach(e=>console.log('  EDGE',A.comps[e.s].label,'->',A.comps[e.t].label,e.w,'calls',e.eps,'endpoints')); }
  console.log('ENV',A.env.length,'DEPLOY',A.deployTargets.join(','));
})().catch(e=>{console.error(e);process.exit(1)});
