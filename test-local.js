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
analyzeRepo(null,{local:{name:path.basename(root),files,branch:'main'},budget:300},()=>{}).then(A=>{
  console.log('repo',JSON.stringify({name:A.repo.name,local:A.repo.local,branch:A.repo.branch,url:A.repo.url}));
  console.log('files',files.length,'scanned',A.stats.scanned,'comps',A.comps.length,'classes',A.classes.length,'calls',A.calls.length);
  A.comps.slice(0,6).forEach(c=>console.log(' ',c.label,c.role,c.files.length));
}).catch(e=>{console.error('FAIL',e);process.exit(1)});
