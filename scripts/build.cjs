// Build the self-contained static page; no packages or network are required.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const data=JSON.parse(read('data.json'));
let html=read('template.html');
for(const [key,value]of Object.entries({__BUNDLE__:JSON.stringify(data).replace(/<\//g,'<\\/'),__ENGINE__:read('engine.js'),__PAPER_UI__:read('paper.js'),__UI__:read('app.js')}))html=html.replace(key,value);
if(/__(?:BUNDLE|ENGINE|PAPER_UI|UI)__/.test(html))throw Error('Unresolved template placeholder');
fs.writeFileSync(path.join(root,'index.html'),html);console.log('Built index.html');
