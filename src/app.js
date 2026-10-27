(function(){
  'use strict';
  const bundle=JSON.parse(document.getElementById('accuracy-data').textContent),E=window.AccuracyEngine;
  const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=v=>(v*100).toFixed(2)+'%',fmt=(v,n=3)=>v===null||v===undefined?'—':Number(v).toFixed(n);
  const featureNames={CNALR:'AC relative load (CNALR)',CV:'AC block-RMS variability',Z_DC:'DC relative mean',DC_cv_0:'DC sample variability',age:'History: log time',dose:'History: log exposure',feed_c:'Log feed setting',DOC_c:'Log DOC setting'};
  const calibrationNames={none:'No healthy reference · metadata only',standard:'Exact-setting L₀; fitted fallback',smooth:'Smooth L₀ · nonnegative load fit',ridge:'Regularized L₀ · ridge load fit'};
  const state={mode:'review',material:2,sensors:['AC','DC'],preferred:'auto',validation:'case',caseFilter:'all',record:109,freshUpper:.15,failedLower:.30};let selected;
  const baseline={metrics:bundle.metrics,predictions:bundle.predictions};
  function wearClass(v){return E.measuredClass(v,[state.freshUpper,state.failedLower]);}
  function updateExercise(){
    const a=Number($('fresh-upper').value),b=Number($('failed-lower').value);
    const id=a.toFixed(2)+'_'+b.toFixed(2),exercise=bundle.vb_exercise.scenarios[id];
    if(!exercise){$('fresh-upper').value=state.freshUpper.toFixed(2);$('failed-lower').value=state.failedLower.toFixed(2);$('vb-rule').textContent='Choose a supported pair: first value 0.10, 0.15 or 0.20; second value 0.25, 0.30 or 0.35 mm. Previous results retained.';return false;}
    state.freshUpper=a;state.failedLower=b;
    bundle.metrics={...baseline.metrics,...exercise.curated_metrics};bundle.predictions={...baseline.predictions,...exercise.predictions};
    $('vb-rule').textContent='Two boundary values define all three ranges. Scores below compare predictions with curated VB.';
    $('vb-range-display').innerHTML='<div><b>Fresh</b><span>0 ≤ VB &lt; '+state.freshUpper.toFixed(2)+' mm</span></div><div><b>Worn</b><span>'+state.freshUpper.toFixed(2)+' ≤ VB &lt; '+state.failedLower.toFixed(2)+' mm</span></div><div><b>Failed</b><span>VB ≥ '+state.failedLower.toFixed(2)+' mm</span></div>';
    return true;
  }
  function activeRecords(){return bundle.records.filter(r=>r.material===state.material&&(state.caseFilter==='all'||String(r.case)===state.caseFilter));}
  function prediction(r){return bundle.predictions[selected.id+':case:'+r.record];}
  function className(v){return v===null?'Not measured':E.labels[v];}
  function status(r){return {'original kept':'Original kept','interpolated':'Interpolated','extrapolated':'Extrapolated','reversed as VB was decreasing':'Decreasing VB adjusted'}[r.VB_curated_status]||r.VB_curated_status;}
  function matrix(c){return '<table class="matrix"><thead><tr><th>Curated ↓<br>Predicted →</th>'+E.labels.map(s=>'<th>'+s+'</th>').join('')+'</tr></thead><tbody>'+c.map((row,i)=>'<tr><th>'+E.labels[i]+'</th>'+row.map((v,j)=>'<td class="'+(i===j?'diagonal':j<i?'under':'over')+'">'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table><div class="legend"><span>Green: correct</span><span>Pink: underestimated</span><span>Yellow: overestimated</span></div>';}
  function referenceMarkup(refs){
    const entries=Object.entries(refs);if(!entries.length)return '<p class="hint">This metadata-only route uses time, feed, DOC and an exposure proxy. It has no healthy-load reference.</p>';
    return entries.map(([ch,r])=>'<div class="ref"><h3>'+ch+' healthy reference</h3><p class="mini">Load '+fmt(r.measured)+' · L₀ '+fmt(r.L0)+' · relative departure '+fmt(r.excess)+'</p><p class="mini">Healthy training sources (original VB &lt; 0.15 mm): cases '+r.healthy_cases.join(', ')+' ('+r.healthy_run_count+' recordings).</p></div>').join('');
  }
  function setMode(mode){state.mode=mode==='paper'?'paper':'review';for(const id of ['review','paper']){$(id+'-view').hidden=id!==state.mode;$(id+'-tab').setAttribute('aria-selected',String(id===state.mode));}$('model-card').hidden=state.mode==='paper';$('route-controls').hidden=state.mode==='paper';$('comparison-side-note').hidden=state.mode!=='paper';if(state.mode==='paper')window.AccuracyPaper.render(state.material);}
  function renderCatalogue(){
    $('catalogue-note').textContent='Current VB exercise · whole-case predictions scored against curated VB (including estimates). Routes use different features, classifiers and healthy-reference methods.';
    $('route-catalogue').innerHTML=Object.values(bundle.routes).filter(r=>r.material===state.material).map(r=>{const m=bundle.metrics[r.id+':case'],available=r.sensors.every(ch=>state.sensors.includes(ch));return '<tr'+(r.id===selected.id?' class="selected"':'')+'><td><b>'+esc(r.name)+'</b><div class="mini">'+r.columns.length+' features: '+r.columns.map(c=>esc(featureNames[c]||c)).join(' + ')+'</div></td><td>'+esc(r.kind==='LR'?'Logistic Regression':'Random Forest')+'</td><td>'+esc(calibrationNames[r.calibration])+'</td><td>'+pct(m.accuracy)+'</td><td>'+m.macro_f1.toFixed(3)+'</td><td>'+m.macro_auc.toFixed(3)+'</td><td>'+(available?'Available':'Needs '+r.sensors.filter(ch=>!state.sensors.includes(ch)).join(' + '))+'</td></tr>';}).join('');
  }
  function refresh(){
    if(!updateExercise())return;
    state.material=Number($('material').value);state.sensors=['AC','DC'].filter(ch=>$(ch==='AC'?'has-ac':'has-dc').checked);state.validation='case';
    const available=E.eligible(bundle,state.material,state.sensors);let preferred=$('route').value||'auto';if(preferred!=='auto'&&!available.some(r=>r.id===preferred))preferred='auto';
    $('route').innerHTML='<option value="auto">Auto · best recorded case score</option>'+available.map(r=>'<option value="'+r.id+'">'+esc(r.name)+'</option>').join('');$('route').value=preferred;state.preferred=preferred;selected=E.choose(bundle,state.material,state.sensors,preferred);
    const cases=[...new Set(bundle.records.filter(r=>r.material===state.material).map(r=>r.case))].sort((a,b)=>a-b);let filter=$('case-filter').value||'all';if(filter!=='all'&&!cases.includes(Number(filter)))filter='all';
    $('case-filter').innerHTML='<option value="all">All cases</option>'+cases.map(c=>'<option value="'+c+'">Case '+c+'</option>').join('');$('case-filter').value=filter;state.caseFilter=filter;
    if(!activeRecords().some(r=>r.record===state.record))state.record=activeRecords()[0].record;
    const m=bundle.metrics[selected.id+':case'];
    $('route-note').textContent=selected.sensors.length?'Uses '+selected.sensors.join(' + ')+' current signals and machining history.':'Uses history + settings only; AC and DC are not inputs.';
    $('model-card').innerHTML='<div class="route-badge">'+(preferred==='auto'?'Best recorded case score among available routes':'Selected model')+'</div><div class="route-name">'+esc(selected.name)+'</div><div class="metric"><strong>'+pct(m.accuracy)+'</strong><span>'+m.correct+' of '+m.n+' curated runs correct · complete tool cases held out</span></div><p class="hint">VB boundaries: '+state.freshUpper.toFixed(2)+' / '+state.failedLower.toFixed(2)+' mm. This is overall test performance, not the confidence of the selected run. Scores use reviewed, adjusted and estimated VB targets; they are not measured-only accuracy.</p>';
    $('validation-note').textContent='Each test tool life was completely excluded from reference fitting, scaling and training.';
    $('matrix').innerHTML=matrix(m.confusion);$('validation-stats').innerHTML='<span>Macro-F1 <b>'+m.macro_f1.toFixed(3)+'</b></span><span>AUC <b>'+m.macro_auc.toFixed(3)+'</b></span><span>Underestimation <b>'+pct(m.UER)+'</b></span><span>Failed recall <b>'+pct(m.failed_recall)+'</b></span><span>Failed → Fresh <b>'+m.failed_to_fresh+'/'+m.failed_n+'</b></span>';
    renderCatalogue();renderRows();renderDetail();window.AccuracyPaper.render(state.material);
  }
  function renderRows(){
    const rows=activeRecords();$('run-count').textContent=rows.length+' runs shown · curated VB and its source status are visible for every run. Overall scores use all eligible curated targets for this material.';
    $('run-rows').innerHTML=rows.map(r=>{const p=prediction(r),y=wearClass(r.VB_curated),cur=wearClass(r.VB_curated),comparison=!p?'Signal excluded':y===null?'Not scored':p.pred===y?'Correct':p.pred<y?'Underestimated':'Overestimated';return '<tr class="'+(state.record===r.record?'selected':'')+'"><td><button type="button" data-record="'+r.record+'">Case '+r.case+' / Run '+r.run+'</button></td><td>'+fmt(r.time,1)+'</td><td>'+fmt(r.feed,2)+'</td><td>'+fmt(r.DOC,2)+'</td><td><b>'+fmt(r.VB_curated)+'</b></td><td>'+className(cur)+'</td><td>'+esc(status(r))+'</td><td>'+fmt(r.VB_measured)+'</td><td>'+(p?className(p.pred):'Unavailable')+'</td><td>'+comparison+'</td></tr>';}).join('');
  }
  function renderDetail(){
    const r=bundle.records.find(r=>r.record===state.record),p=prediction(r),y=wearClass(r.VB_curated),cur=wearClass(r.VB_curated);
    let markup='<h2>Case '+r.case+' · Run '+r.run+'</h2><p class="mini">Time '+fmt(r.time,1)+' · Feed '+fmt(r.feed,2)+' · DOC '+fmt(r.DOC,2)+'</p><div class="state-pair"><div class="state-box"><small>Curated wear record</small><div class="state">'+className(cur)+'</div><small>VB '+fmt(r.VB_curated)+' mm · '+esc(status(r))+'</small></div><div class="state-box"><small>Held-out model prediction</small><div class="state">'+(p?className(p.pred):'Unavailable')+'</div><small>'+(p?'Whole-case model':'Sensor recording excluded')+'</small></div></div>';
    markup+='<p class="mini">Original measured VB: '+fmt(r.VB_measured)+' mm · '+className(wearClass(r.VB_measured))+'. Displayed scoring uses curated VB.</p>';
    if(!p){$('run-detail').innerHTML=markup+'<div class="notice">Near-silent recording: excluded from sensor models, retained in the database.</div>';return;}
    if(r.VB_measured===null)markup+='<div class="notice">Original VB is missing. This run is scored against its estimated curated target, not an independent measurement.</div>';
    markup+='<p><b>Curated comparison: '+(p.pred===y?'Correct':p.pred<y?'Wear underestimated':'Wear overestimated')+'</b></p>';
    const fold=bundle.folds[p.fold],ex=E.features(fold,r);
    if(selected.sensors.includes('DC')&&r.DC_ceiling_0>.01)markup+='<div class="notice">DC quality advisory: '+pct(r.DC_ceiling_0)+' at the recorded ceiling. Clipping can hide current variation.</div>';
    markup+='<div class="scores">'+p.scores.map((v,i)=>'<div><small>'+E.labels[i]+'</small><b>'+pct(v)+'</b><div class="bar"><span style="width:'+(100*v)+'%"></span></div></div>').join('')+'</div><p class="mini">Model probabilities are not independently calibrated confidence.</p>';
    markup+='<details><summary>How this prediction was calculated</summary><p class="mini">Excluded from training: '+fold.excluded_cases.map(c=>'Case '+c).join(', ')+'.</p>'+referenceMarkup(ex.references)+'<table class="feature-table">'+Object.entries(ex.values).map(([k,v])=>'<tr><td>'+esc(featureNames[k]||k)+'</td><td>'+fmt(v,5)+'</td></tr>').join('')+'</table></details>';$('run-detail').innerHTML=markup;
  }
  function selectRecord(record){state.record=Number(record);renderRows();renderDetail();}
  function csv(){const rows=[['case','run','material','feed','DOC','time','VB_curated_mm','curated_state','VB_curated_status','VB_measured_mm','measured_state','predicted_state','curated_comparison','route','fresh_worn_boundary_mm','worn_failed_boundary_mm','scored']];for(const r of activeRecords()){const p=prediction(r),y=wearClass(r.VB_curated);rows.push([r.case,r.run,r.material,r.feed,r.DOC,r.time,r.VB_curated,className(wearClass(r.VB_curated)),r.VB_curated_status,r.VB_measured??'',className(wearClass(r.VB_measured)),p?className(p.pred):'',!p?'Signal excluded':y===null?'Not scored':p.pred===y?'Correct':p.pred<y?'Underestimated':'Overestimated',selected.id,state.freshUpper,state.failedLower,Boolean(p&&y!==null)]);}return rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');}
  $('reset-vb').addEventListener('click',()=>{$('fresh-upper').value='0.15';$('failed-lower').value='0.30';refresh();});
  $('paper-tab').addEventListener('click',()=>setMode('paper'));$('review-tab').addEventListener('click',()=>setMode('review'));
  for(const id of ['material','has-ac','has-dc','route','case-filter','fresh-upper','failed-lower'])$(id).addEventListener('change',refresh);
  $('run-rows').addEventListener('click',event=>{const b=event.target.closest('button[data-record]');if(b)selectRecord(b.dataset.record);});
  $('download-runs').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([csv()],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='NASA_curated_runs_'+selected.id+'.csv';a.click();URL.revokeObjectURL(url);});
  window.AccuracyApp={state,refresh,selectRecord,setMode,csv};refresh();if(window.location&&window.location.hash==='#paper')setMode('paper');
})();
