(function(root){
 'use strict';
 const bundle=JSON.parse(document.getElementById('accuracy-data').textContent),paper=bundle.paper_comparison;
 const $=id=>document.getElementById(id),pct=v=>v==null?'Not reported':(v*100).toFixed(2)+'%',dec=v=>v==null?'Not reported':v.toFixed(3);
 const state={material:2,route:'steel_fusion',validation:'case'};
 function selected(){const row=paper.rows.find(r=>r.id==='material_current');return {paper:row.by_material[String(state.material)],ours:(bundle.vb_exercise?bundle.vb_exercise.scenarios[bundle.vb_exercise.default].curated_metrics:bundle.metrics)[state.route+':case']};}
 function render(material){
  state.material=Number(material);state.route=state.material===1?'cast_fusion':'steel_fusion';const {paper:p,ours:m}=selected();
  $('paper-headline').innerHTML='<div class="comparison-score"><span>Published current-sensor SVM</span><strong>'+pct(p.accuracy)+'</strong><small>'+(state.material===1?'Cast iron · AC features':'J45 steel · AC + DC features')+'</small></div><div class="comparison-score"><span>Our AC + DC + history fusion</span><strong>'+pct(m.accuracy)+'</strong><small>Ridge healthy reference · Logistic Regression</small><small>'+m.correct+' / '+m.n+' curated targets correct</small></div>';
  $('paper-context').textContent='Paper: Table 7 material-specific current-sensor result. Ours: whole-case predictions scored against curated VB, including estimated targets. Original VB boundaries 0.15 / 0.30 mm are retained here. Both are exploratory NASA results; matching per-material paper matrices are unavailable.';
  $('paper-metric-pair').innerHTML=[['Accuracy',pct(p.accuracy),pct(m.accuracy)],['Macro-F1','Not reported',dec(m.macro_f1)],['AUC','Not reported',dec(m.macro_auc)]].map(r=>'<tr>'+r.map((v,i)=>'<'+(i?'td':'th')+'>'+v+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('');
  $('paper-ours-matrix').innerHTML='<table class="matrix"><thead><tr><th>Curated ↓ / Predicted →</th>'+bundle.labels.map(l=>'<th>'+l+'</th>').join('')+'</tr></thead><tbody>'+m.confusion.map((r,i)=>'<tr><th>'+bundle.labels[i]+'</th>'+r.map((v,j)=>'<td class="'+(i===j?'diagonal':j<i?'under':'over')+'">'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 }
 function csv(){const {paper:p,ours:m}=selected(),rows=[['model','material','accuracy','macro_f1','macro_auc','test_protocol','comparable_protocol'],['Published current-sensor SVM',state.material,p.accuracy,'','','Randomized segmented-data split',false],['Our AC/DC/history ridge LR',state.material,m.accuracy,m.macro_f1,m.macro_auc,'Whole-case holdout; curated VB including estimates',false]];return rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');}
 $('download-paper-comparison').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([csv()],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='NASA_paper_comparison.csv';a.click();URL.revokeObjectURL(url);});
 root.AccuracyPaper={state,render,csv};
})(typeof window!=='undefined'?window:globalThis);
