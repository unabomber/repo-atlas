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
  console.log('ENV',A.env.length,'DEPLOY',A.deployTargets.join(','));
})().catch(e=>{console.error(e);process.exit(1)});
