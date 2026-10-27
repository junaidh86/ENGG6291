(function(root){
  'use strict';
  const labels=['Fresh','Worn','Failed'];
  function number(v,name,positive=false){
    if(typeof v!=='number'||!Number.isFinite(v)||(positive?v<=0:v<0))throw new Error(name+' needs a '+(positive?'positive':'nonnegative')+' number.');
    return v;
  }
  function eligible(bundle,material,sensors){
    return Object.values(bundle.routes).filter(r=>r.material===Number(material)&&r.sensors.every(ch=>sensors.includes(ch)))
      .sort((a,b)=>bundle.metrics[b.id+':case'].accuracy-bundle.metrics[a.id+':case'].accuracy||bundle.metrics[b.id+':case'].macro_f1-bundle.metrics[a.id+':case'].macro_f1);
  }
  function choose(bundle,material,sensors,preferred='auto'){
    const routes=eligible(bundle,material,sensors);
    const selected=preferred==='auto'?routes[0]:routes.find(r=>r.id===preferred);
    if(!selected)throw new Error('This model needs inputs that are not available.');
    return selected;
  }
  function features(model,input){
    const f=number(input.feed,'Feed',true),d=number(input.DOC,'DOC',true),t=number(input.time,'Recorded time');
    const v={age:Math.log1p(t),dose:Math.log1p(t*f*d),feed_c:Math.log(f/.3535533905932738),DOC_c:Math.log(d/1.0606601717798212)};
    const refs={};
    if(model.columns.includes('CV'))v.CV=number(input.CV,'AC variability');
    if(model.columns.includes('DC_cv_0'))v.DC_cv_0=number(input.DC_cv_0,'DC variability');
    for(const [channel,r]of Object.entries(model.references)){
      const measured=number(input[channel==='AC'?'AC_RMS':'DC_0'],channel+' load',true);
      const exact=r.settings.find(s=>Math.abs(s.feed-f)<1e-12&&Math.abs(s.DOC-d)<1e-12);
      const L0=r.kind==='standard'&&exact?exact.L0:r.coefficients[0]+r.coefficients[1]*f*d/r.q_scale;
      if(!Number.isFinite(L0)||L0<=0)throw new Error('No usable healthy reference.');
      const excess=(measured-L0)/L0;v[channel==='AC'?'CNALR':'Z_DC']=excess;
      refs[channel]={L0,measured,excess,kind:r.kind,healthy_cases:r.kind==='standard'&&exact?exact.source_cases:r.healthy_cases,
        healthy_run_count:r.kind==='standard'&&exact?exact.healthy_run_count:r.healthy_run_count,
        matching_cases:exact?exact.healthy_case_count:0,matching_runs:exact?exact.healthy_run_count:0};
    }
    const x=model.columns.map(c=>v[c]);if(!x.every(Number.isFinite))throw new Error('The inputs exceed this model’s numeric range.');
    return {x,values:Object.fromEntries(model.columns.map((c,i)=>[c,x[i]])),references:refs};
  }
  function predict(model,input){
    if(Number(input.material)!==model.material)throw new Error('The model belongs to a different material.');
    if(model.sensors.length&&input.sensor_eligible===false)throw new Error('This recording is excluded from sensor prediction.');
    if(input.rpm!==undefined&&input.rpm!==826)throw new Error('This prototype covers the NASA 826 rpm setup.');
    const a=features(model,input);
    if(!model.domain.settings.some(s=>Math.abs(s.feed-input.feed)<1e-12&&Math.abs(s.DOC-input.DOC)<1e-12))throw new Error('Choose one of the four NASA feed/DOC settings.');
    const z=a.x.map((v,i)=>(v-model.scaler.mean[i])/model.scaler.scale[i]);
    if(!z.every(Number.isFinite))throw new Error('The inputs exceed this model’s numeric range.');
    let p;
    if(model.classifier.kind==='LR'){
      const scores=model.classifier.weights.map((w,i)=>w.reduce((s,v,j)=>s+v*z[j],model.classifier.intercepts[i]));
      if(!scores.every(Number.isFinite))throw new Error('The inputs exceed this model’s numeric range.');
      const mx=Math.max(...scores),ex=scores.map(v=>Math.exp(v-mx)),sum=ex.reduce((a,b)=>a+b,0);p=ex.map(v=>v/sum);
    }else{
      // scikit-learn decision trees cast prediction inputs to float32.
      const t=z.map(Math.fround);if(!t.every(Number.isFinite))throw new Error('The inputs exceed this model’s numeric range.');
      p=[0,0,0];
      for(const tree of model.classifier.trees){
        let n=0;while(tree.left[n]!==-1)n=t[tree.feature[n]]<=tree.threshold[n]?tree.left[n]:tree.right[n];
        for(let k=0;k<3;k++)p[k]+=tree.value[n][k]/model.classifier.trees.length;
      }
    }
    if(!p.every(Number.isFinite))throw new Error('The prediction is not finite.');
    const pred=p.indexOf(Math.max(...p));
    const outside=Object.entries(model.domain.ranges).filter(([k,r])=>input[k]<r[0]-1e-12||input[k]>r[1]+1e-12).map(([k])=>k);
    return {pred,state:labels[pred],scores:p,features:a.values,references:a.references,outside};
  }
  function measuredClass(v,bounds=[.15,.30]){return v===null||v===undefined?null:v<bounds[0]?0:v<bounds[1]?1:2;}
  const api={labels,eligible,choose,features,predict,measuredClass};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AccuracyEngine=api;
})(typeof window!=='undefined'?window:globalThis);
