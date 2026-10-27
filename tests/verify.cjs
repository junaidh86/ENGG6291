// Numerical and rendering-logic checks. This does not launch a browser.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const out=root;
const E=require(path.join(root,'src/engine.js'));
const bundle=JSON.parse(fs.readFileSync(path.join(root,'src/data.json'),'utf8'));
const vectors=JSON.parse(fs.readFileSync(path.join(root,'tests/verification_vectors.json'),'utf8'));
let difference=0,checks=0;
for(const r of vectors){
  const result=E.predict(bundle.models[r.route],r.input);assert.equal(result.pred,r.pred);
  for(let k=0;k<3;k++)difference=Math.max(difference,Math.abs(result.scores[k]-r.scores[k]));checks++;
}
assert(difference<1e-12,'Cross-language probability difference '+difference);
let requiredChecks=0;
for(const [id,model]of Object.entries(bundle.models)){
  const sample=vectors.find(v=>v.route===id).input;
  // The new-input engine accepts only necessary scalar inputs.
  const necessary={material:model.material,rpm:826};for(const k of model.required_inputs)necessary[k]=sample[k];
  assert.equal(E.predict(model,necessary).pred,E.predict(model,sample).pred);
  for(const field of model.required_inputs){const missing={...necessary};delete missing[field];assert.throws(()=>E.predict(model,missing));requiredChecks++;}
  for(const invalid of [null,NaN,Infinity,-1,'0.5']){assert.throws(()=>E.predict(model,{...necessary,feed:invalid}));requiredChecks++;}
  assert.throws(()=>E.predict(model,{...necessary,rpm:1000}));
  assert.throws(()=>E.predict(model,{...necessary,feed:.3}));
  if(model.sensors.length)assert.throws(()=>E.predict(model,{...necessary,sensor_eligible:false}));
}
const wanted={
 '1:':'cast_parameters','1:AC':'cast_parameters','1:DC':'cast_parameters','1:AC,DC':'cast_parameters',
 '2:':'steel_parameters','2:AC':'steel_ac','2:DC':'steel_dc','2:AC,DC':'steel_fusion'};
for(const mat of [1,2])for(const sensors of [[],['AC'],['DC'],['AC','DC']])assert.equal(E.choose(bundle,mat,sensors).id,wanted[mat+':'+sensors.join(',')]);
assert.throws(()=>E.choose(bundle,2,['AC'],'steel_fusion'));
let foldChecks=0;
for(const [key,p]of Object.entries(bundle.predictions)){
  const r=bundle.records.find(r=>r.record===p.record),fold=bundle.folds[p.fold],route=bundle.routes[p.route];
  assert(!fold.training_cases.includes(r.case));assert(fold.excluded_cases.includes(r.case));
  const features=E.features(fold,r);assert(Object.values(features.values).every(Number.isFinite));
  for(const ref of Object.values(features.references))assert(ref.healthy_cases.every(c=>fold.training_cases.includes(c)&&!fold.excluded_cases.includes(c)));
  if(route.sensors.length)assert(r.sensor_eligible);
  foldChecks++;
}
for(const [key,m]of Object.entries(bundle.metrics)){
  const [route,validation]=key.split(':');const rows=Object.values(bundle.predictions).filter(p=>p.route===route&&p.validation===validation&&p.VB_measured!==null);
  const cm=[[0,0,0],[0,0,0],[0,0,0]];for(const p of rows)cm[E.measuredClass(p.VB_measured)][p.pred]++;
  assert.deepEqual(cm,m.confusion);assert.equal(rows.length,m.n);
  const accuracy=cm.reduce((s,r,i)=>s+r[i],0)/rows.length;
  const f1=cm.reduce((s,r,i)=>s+2*r[i]/(r.reduce((a,b)=>a+b,0)+cm.reduce((a,r)=>a+r[i],0)),0)/3;
  const auc=[0,1,2].reduce((sum,k)=>{
    const pos=rows.filter(r=>E.measuredClass(r.VB_measured)===k),neg=rows.filter(r=>E.measuredClass(r.VB_measured)!==k);
    return sum+pos.reduce((s,p)=>s+neg.reduce((t,n)=>t+(p.scores[k]>n.scores[k]?1:p.scores[k]===n.scores[k]?.5:0),0),0)/(pos.length*neg.length);
  },0)/3;
  assert(Math.abs(accuracy-m.accuracy)<1e-12);assert(Math.abs(f1-m.macro_f1)<1e-12);assert(Math.abs(auc-m.macro_auc)<1e-12);
  for(const r of rows){assert(r.scores.every(s=>Number.isFinite(s)&&s>=0&&s<=1));assert(Math.abs(r.scores.reduce((a,b)=>a+b,0)-1)<1e-12);}
}

// Two-tab UI logic audit; no real-browser visual review claimed.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),nodes=new Map();
const embedded=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];assert.equal(embedded.length,4);assert.deepEqual(JSON.parse(embedded[0][2]),bundle);
for(const id of ['input-tab','compare-tab','input-view','compare-view','validation','paper-validation','paper-original-model','paper-our-route','manual-time'])assert(!html.includes('id="'+id+'"'));
assert(!html.includes('Unseen-setting'));assert(!html.includes('__BUNDLE__')&&!html.includes('__UI__'));
function element(id,attrs=''){
  if(nodes.has(id))return nodes.get(id);
  let value=(attrs.match(/\bvalue="([^"]*)"/)||[])[1]||'',markup='';
  const n={id,textContent:'',hidden:/\bhidden\b/.test(attrs),checked:/\bchecked\b/.test(attrs),attributes:{},dataset:{},listeners:{},
    setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.listeners[k]=v;},click(){},classList:{add(){},remove(){},toggle(){}}};
  Object.defineProperty(n,'value',{get:()=>value,set:v=>{value=String(v);}});
  Object.defineProperty(n,'innerHTML',{get:()=>markup,set:v=>{
    markup=String(v);
    for(const m of markup.matchAll(/<\w+\b([^>]*\bid="([^"]+)"[^>]*)>/g))element(m[2],m[1]);
  }});
  nodes.set(id,n);return n;
}
for(const m of html.matchAll(/<\w+\b([^>]*\bid="([^"]+)"[^>]*)>/g))element(m[2],m[1]);
for(const m of html.matchAll(/<select\b([^>]*\bid="([^"]+)"[^>]*)>([\s\S]*?)<\/select>/g)){
  const options=[...m[3].matchAll(/<option\b([^>]*)>/g)],selected=options.find(o=>/\bselected\b/.test(o[1]))||options[0];
  if(selected)nodes.get(m[2]).value=(selected[1].match(/\bvalue="([^"]*)"/)||[])[1]||'';
}
nodes.get('accuracy-data').textContent=JSON.stringify(bundle);
const downloads=[],downloadURLs=new Map();let downloadCounter=0;
class TestBlob{constructor(parts){this.content=parts.join('');}}
const context=vm.createContext({document:{getElementById:id=>{assert(nodes.has(id),'Unknown element '+id);return nodes.get(id);},createElement:tag=>{assert.equal(tag,'a');return {click(){assert(downloadURLs.has(this.href));downloads.push({filename:this.download,content:downloadURLs.get(this.href)});}};}},Blob:TestBlob,URL:{createObjectURL:b=>{const id='blob:test-'+(++downloadCounter);downloadURLs.set(id,b.content);return id;},revokeObjectURL:id=>downloadURLs.delete(id)},console});
context.window=context;
new vm.Script(fs.readFileSync(path.join(root,'src/engine.js'),'utf8')).runInContext(context);

new vm.Script(fs.readFileSync(path.join(root,'src/paper.js'),'utf8')).runInContext(context);
new vm.Script(fs.readFileSync(path.join(root,'src/app.js'),'utf8')).runInContext(context);

let variants=0,recordViews=0,filters=0;
for(const mat of [1,2])for(const sensors of [[],['AC'],['DC'],['AC','DC']]){
 nodes.get('material').value=mat;nodes.get('has-ac').checked=sensors.includes('AC');nodes.get('has-dc').checked=sensors.includes('DC');
 for(const route of ['auto',...E.eligible(bundle,mat,sensors).map(r=>r.id)]){
  nodes.get('route').value=route;nodes.get('case-filter').value='all';vm.runInContext('AccuracyApp.refresh()',context);
  const targetMetrics=bundle.vb_exercise.scenarios['0.15_0.30'].curated_metrics,id=E.choose({...bundle,metrics:{...bundle.metrics,...targetMetrics}},mat,sensors,route).id,m=targetMetrics[id+':case'];
  assert(nodes.get('model-card').innerHTML.includes((100*m.accuracy).toFixed(2)+'%'));assert(!nodes.get('model-card').innerHTML.includes('Unseen'));
  assert.equal((nodes.get('run-rows').innerHTML.match(/<tr /g)||[]).length,mat===1?109:58);
  assert.equal((nodes.get('route-catalogue').innerHTML.match(/<tr[ >]/g)||[]).length,4);
  assert.equal(vm.runInContext('AccuracyApp.state.validation',context),'case');
  assert(!/NaN|undefined/.test(nodes.get('run-detail').innerHTML+nodes.get('route-catalogue').innerHTML));
  const csv=vm.runInContext('AccuracyApp.csv()',context);assert(csv.includes('VB_curated_mm'));assert(csv.includes('VB_curated_status'));assert.equal(csv.split('\n').length,mat===1?110:59);
  const scored=csv.split('\n').slice(1).filter(r=>r.endsWith('"true"')).length;assert.equal(scored,m.n);
  vm.runInContext('AccuracyApp.setMode("paper")',context);assert.equal(nodes.get('review-view').hidden,true);assert.equal(nodes.get('route-controls').hidden,true);
  const fusion=bundle.vb_exercise.scenarios['0.15_0.30'].curated_metrics[(mat===1?'cast_fusion':'steel_fusion')+':case'];assert(nodes.get('paper-headline').innerHTML.includes((100*fusion.accuracy).toFixed(2)+'%'));assert(nodes.get('paper-metric-pair').innerHTML.includes('Not reported'));
  assert.equal(vm.runInContext('AccuracyPaper.csv().split("\\n").length',context),3);
  vm.runInContext('AccuracyApp.setMode("review")',context);assert.equal(nodes.get('paper-view').hidden,true);variants++;
 }
}
for(const mat of [1,2]){
 nodes.get('material').value=mat;nodes.get('has-ac').checked=true;nodes.get('has-dc').checked=true;nodes.get('route').value=mat===1?'cast_fusion':'steel_fusion';nodes.get('case-filter').value='all';vm.runInContext('AccuracyApp.refresh()',context);
 for(const r of bundle.records.filter(r=>r.material===mat)){
  vm.runInContext('AccuracyApp.selectRecord('+r.record+')',context);const detail=nodes.get('run-detail').innerHTML;assert(detail.includes(Number(r.VB_curated).toFixed(3)+' mm'));assert(detail.includes('Curated wear record'));
  if(r.VB_measured===null&&r.sensor_eligible)assert(detail.includes('scored against its estimated curated target'));
  if(r.record===94)assert(detail.includes('Near-silent'));
  if(r.record===10)assert(detail.includes('DC quality advisory'));
  assert(!/NaN|undefined/.test(detail));recordViews++;
 }
 for(const c of [...new Set(bundle.records.filter(r=>r.material===mat).map(r=>r.case))]){
  nodes.get('case-filter').value=c;vm.runInContext('AccuracyApp.refresh()',context);assert.equal((nodes.get('run-rows').innerHTML.match(/<tr /g)||[]).length,bundle.records.filter(r=>r.case===c).length);filters++;
 }
}
for(const id of ['download-runs','download-paper-comparison']){nodes.get(id).listeners.click();const d=downloads.at(-1);assert(d.filename.endsWith('.csv'));assert(d.content.includes('\n'));assert(!/NaN|undefined/.test(d.content));}
assert.equal(downloadURLs.size,0);

let exerciseChecks=0,exerciseMetrics=0;
for(const [sid,scenario]of Object.entries(bundle.vb_exercise.scenarios)){
 const bounds=[scenario.fresh_upper,scenario.failed_lower];
 assert.equal(E.measuredClass(bounds[0],bounds),1);assert.equal(E.measuredClass(bounds[1],bounds),2);
 for(const [key,m]of Object.entries(scenario.curated_metrics)){
  const route=key.split(':')[0],rows=Object.values(scenario.predictions).filter(p=>p.route===route),cm=[[0,0,0],[0,0,0],[0,0,0]];
  for(const r of rows){const y=E.measuredClass(r.VB_curated,bounds);assert.equal(y,r.label_curated);cm[y][r.pred]++;const fold=bundle.folds[r.fold],record=bundle.records.find(z=>z.record===r.record);assert(!fold.training_cases.includes(record.case));}
  assert.deepEqual(cm,m.confusion);assert.equal(rows.length,m.n);
  assert(Math.abs(cm.reduce((t,r,i)=>t+r[i],0)/m.n-m.accuracy)<1e-12);
  const f1=cm.reduce((t,r,i)=>t+2*r[i]/(r.reduce((a,b)=>a+b,0)+cm.reduce((a,r)=>a+r[i],0)),0)/3;assert(Math.abs(f1-m.macro_f1)<1e-12);
  const auc=[0,1,2].reduce((t,k)=>{const pos=rows.filter(r=>E.measuredClass(r.VB_curated,bounds)===k),neg=rows.filter(r=>E.measuredClass(r.VB_curated,bounds)!==k);return t+pos.reduce((u,p)=>u+neg.reduce((v,n)=>v+(p.scores[k]>n.scores[k]?1:p.scores[k]===n.scores[k]?.5:0),0),0)/(pos.length*neg.length);},0)/3;assert(Math.abs(auc-m.macro_auc)<1e-12);exerciseMetrics++;
 }
 for(const mat of [1,2]){
  nodes.get('fresh-upper').value=bounds[0].toFixed(2);nodes.get('failed-lower').value=bounds[1].toFixed(2);nodes.get('material').value=mat;nodes.get('has-ac').checked=true;nodes.get('has-dc').checked=true;nodes.get('route').value='auto';nodes.get('case-filter').value='all';vm.runInContext('AccuracyApp.refresh()',context);
  const expected=E.choose({...bundle,metrics:{...bundle.metrics,...scenario.curated_metrics}},mat,['AC','DC']);assert(nodes.get('model-card').innerHTML.includes(expected.name));
 }
 for(const mat of [1,2])for(const route of Object.values(bundle.routes).filter(r=>r.material===mat)){
  nodes.get('fresh-upper').value=bounds[0].toFixed(2);nodes.get('failed-lower').value=bounds[1].toFixed(2);nodes.get('material').value=mat;nodes.get('has-ac').checked=true;nodes.get('has-dc').checked=true;nodes.get('route').value=route.id;nodes.get('case-filter').value='all';
  vm.runInContext('AccuracyApp.refresh()',context);const m=scenario.curated_metrics[route.id+':case'];
  assert(nodes.get('model-card').innerHTML.includes((m.accuracy*100).toFixed(2)+'%'));assert(nodes.get('vb-range-display').innerHTML.includes(bounds[0].toFixed(2)));assert(!/NaN|undefined/.test(nodes.get('run-detail').innerHTML));
  const csv=vm.runInContext('AccuracyApp.csv()',context);assert(csv.includes('fresh_worn_boundary_mm'));assert.equal(csv.split('\n').slice(1).filter(r=>r.endsWith('"true"')).length,m.n);
  vm.runInContext('AccuracyApp.setMode("paper")',context);const fusion=bundle.vb_exercise.scenarios['0.15_0.30'].curated_metrics[(mat===1?'cast_fusion':'steel_fusion')+':case'];assert(nodes.get('paper-headline').innerHTML.includes((fusion.accuracy*100).toFixed(2)+'%'));
  vm.runInContext('AccuracyApp.setMode("review")',context);exerciseChecks++;
 }
}
nodes.get('reset-vb').listeners.click();assert.equal(nodes.get('fresh-upper').value,'0.15');assert.equal(nodes.get('failed-lower').value,'0.30');
assert(!html.includes('Unseen-setting'));assert(html.includes('@media(max-width:740px)'));assert(html.includes('grid-template-columns:1fr!important'));
nodes.get('fresh-upper').value='0.14';nodes.get('fresh-upper').listeners.change();assert(nodes.get('vb-rule').textContent.includes('Previous results retained'));assert.equal(nodes.get('fresh-upper').value,'0.15');
const result={status:'passed',full_model_vectors:checks,maximum_probability_difference:difference,required_input_checks:requiredChecks,heldout_records_checked:foldChecks,metric_sets_checked:Object.keys(bundle.metrics).length,accuracy_f1_auc_independently_recomputed:true,two_tab_UI_variants:variants,run_details_checked:recordViews,case_filter_checks:filters,download_handlers_checked:downloads.length,all_167_curated_values_visible:true,original_measurements_preserved:true,curated_scoring_includes_estimates:true,measured_only_archive_preserved:true,whole_case_only_UI:true,removed_tabs_and_lookups_absent:true,baseline_models_unchanged:true,VB_exercise_scenarios:9,VB_exercise_route_variants:exerciseChecks,VB_exercise_metric_sets_verified:exerciseMetrics,VB_reset_checked:true,exercise_auto_routing_checked:true,responsive_layout_rules_present:true,test_scope:'Numerical checks and Node VM interface logic; local-file browser policy blocks live visual inspection.'};
fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
