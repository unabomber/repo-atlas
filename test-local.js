// node test-local.js <folder>   — analyse a local folder with the network disabled
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(__dirname+'/analyzer.js','utf8');
const {analyzeRepo,makeGitignore,IGN_RE}=new Function(src+'\nreturn {analyzeRepo,makeGitignore,IGN_RE};')();
global.fetch=()=>{ throw new Error('NETWORK CALL IN LOCAL MODE'); };
const root=path.resolve(process.argv[2]||'.'); const gi=makeGitignore(); const files=[];
(function walk(dir,prefix){
  const ents=fs.readdirSync(dir,{withFileTypes:true});
  if (ents.some(e=>e.name==='.gitignore')) gi.add(prefix, fs.readFileSync(path.join(dir,'.gitignore'),'utf8'));
  for (const e of ents) { const p=prefix+e.name;
    if (e.isDirectory()) { if (e.name==='.git'||IGN_RE.test(p+'/x')||gi.ignored(p,true)) continue; walk(path.join(dir,e.name),p+'/'); }
    else if (e.isFile() && !gi.ignored(p,false)) { const fp=path.join(dir,e.name); files.push({path:p,size:fs.statSync(fp).size,read:async()=>fs.readFileSync(fp,'utf8')}); } }
})(root,'');
analyzeRepo(null,{local:{name:path.basename(root),files,branch:'main'},budget:+process.env.BUDGET||300},()=>{}).then(A=>{
  console.log('repo',JSON.stringify({name:A.repo.name,local:A.repo.local,branch:A.repo.branch,url:A.repo.url}));
  console.log('files',files.length,'scanned',A.stats.scanned,'comps',A.comps.length,'classes',A.classes.length,'calls',A.calls.length);
  { const R=A.routes.filter(r=>r.method!=='PAGE'); const H=R.filter(r=>r.hc!=null); console.log('ROUTES',R.length,'with handler',H.length); H.slice(0,6).forEach(r=>{ const k=A.classes[r.hc]; console.log('  ',r.method,r.path,'->',k.name+(k.fn?'::':'.')+k.methods[r.hm],'line',r.line); }); R.filter(r=>r.hc==null).slice(0,+process.env.NOH||4).forEach(r=>console.log('   NOHANDLER',r.method,r.path,r.file.split('/').pop()+':'+r.line)); const mt=A.classes.filter(k=>k.mm&&k.mm.some(x=>x.length)); console.log('MODELS',A.models.length,'units touching models',mt.length); mt.slice(0,5).forEach(k=>console.log('  ',k.name,k.mm.map((x,i)=>x.length?k.methods[i]+':'+x.map(m=>A.models[m].name).join('/'):'').filter(Boolean).slice(0,3).join(' '))); }
  if (process.env.MODELS) { A.models.forEach((m,i)=>console.log('  M',i,m.name,'['+m.kind+']',(m.fields||[]).map(f=>f[0]+':'+f[1]+(f[2]?'('+f[2]+')':'')).join(', ').slice(0,200))); (A.modelEdges||[]).forEach(e=>console.log('  E',A.models[e[0]].name,'->',A.models[e[1]].name,e[2],e[3])); }
  { const c=A.apiCalls||[]; console.log('APIMATCH',c.filter(x=>x.rt>=0).length+'/'+c.length); }
  A.comps.slice(0,6).forEach(c=>console.log(' ',c.label,c.role,c.files.length));
}).catch(e=>{console.error('FAIL',e);process.exit(1)});
