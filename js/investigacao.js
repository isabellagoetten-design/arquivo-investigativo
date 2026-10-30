const client=window.supabase.createClient("https://hoqbkpjwlmkmdvuzinyi.supabase.co","sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg");const id=new URLSearchParams(location.search).get("id");const $=s=>document.querySelector(s);let uid;const recordStore={};const say=t=>$("#case-status").textContent=t;async function init(){if(!id){location.href="./inicio.html";return}const s=await client.auth.getSession();if(!s.data.session){location.href="./index.html";return}uid=s.data.session.user.id;const r=await client.from("investigations").select("id,title,subject,category,description,created_at").eq("id",id).eq("user_id",uid).single();if(r.error){$("#case-loading h1").textContent="Não foi possível abrir o registro.";$("#case-loading p").textContent=r.error.message;return}const v=r.data;$("#case-loading").hidden=true;$("#case-content").hidden=false;$("#case-title").textContent=v.title;$("#case-subject").textContent=v.subject||"Sem assunto principal definido";$("#case-date").textContent=new Date(v.created_at).toLocaleDateString("pt-BR");$("#edit-title").value=v.title;$("#edit-subject").value=v.subject||"";$("#edit-category").value=v.category;$("#edit-description").value=v.description||""}$("#save-case").onclick=async()=>{const p={title:$("#edit-title").value.trim(),subject:$("#edit-subject").value.trim()||null,category:$("#edit-category").value,description:$("#edit-description").value.trim()||null};if(!p.title){say("O título é obrigatório.");return}const b=$("#save-case");b.disabled=true;say("Salvando...");const r=await client.from("investigations").update(p).eq("id",id).eq("user_id",uid);b.disabled=false;if(r.error){say("Erro: "+r.error.message);return}$("#case-title").textContent=p.title;$("#case-subject").textContent=p.subject||"Sem assunto principal definido";say("Alterações salvas.")};$("#back-case").onclick=()=>location.href="./inicio.html";$("#delete-case").onclick=async()=>{if(!window.confirm("Excluir esta investigação permanentemente?"))return;const r=await client.from("investigations").delete().eq("id",id).eq("user_id",uid);if(r.error){say("Erro: "+r.error.message);return}location.href="./inicio.html"};async function loadRecords(){
 const [notes,sources]=await Promise.all([
  client.from("notes").select("id,title,content,created_at").eq("user_id",uid).eq("investigation_id",id).order("created_at",{ascending:false}),
  client.from("sources").select("id,title,url,author,notes,source_type,created_at").eq("user_id",uid).eq("investigation_id",id).order("created_at",{ascending:false})
 ]);
 renderRecords("notes-list",notes.data||[],notes.error,"note");
 renderRecords("sources-list",sources.data||[],sources.error,"source");
 const topics=await client.from("topics").select("id,title,content,color,created_at").eq("user_id",uid).eq("investigation_id",id).order("created_at",{ascending:false});
 renderRecords("topics-list",topics.data||[],topics.error,"topic");
 filterDossierRecords();
}
function safeText(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderRecords(target,items,error,type){
 recordStore[target]={items,error,type};
 const el=$("#"+target);
 if(error){el.textContent="Não foi possível carregar. "+error.message;return}
 if(!items.length){el.innerHTML='<p class="record-empty">Nenhum registro adicionado ainda.</p>';return}
 el.innerHTML=items.map(item=>{
  const details=type==="note"||type==="topic"?safeText(item.content):[item.author,item.notes].filter(Boolean).map(safeText).join(" · ");
  const date=item.created_at?new Date(item.created_at).toLocaleDateString("pt-BR"):"";
  const link=type==="source"&&item.url&&(item.url.startsWith("https://")||item.url.startsWith("http://"))?'<a href="'+safeText(item.url)+'" target="_blank" rel="noopener noreferrer">Abrir fonte ↗</a>':"";
  return '<article class="record-card"><div><h4>'+safeText(item.title)+'</h4><small class="record-date">'+safeText(date)+'</small><p>'+details+'</p>'+link+'</div><div class="record-actions"><button type="button" class="record-edit" data-record-type="'+type+'" data-record-id="'+safeText(item.id)+'">Editar</button><button type="button" class="record-delete" data-record-type="'+type+'" data-record-id="'+safeText(item.id)+'">Excluir</button></div></article>';
 }).join("");
 el.querySelectorAll(".record-delete").forEach(btn=>btn.addEventListener("click",()=>deleteRecord(btn.dataset.recordType,btn.dataset.recordId)));
 el.querySelectorAll(".record-edit").forEach(btn=>btn.addEventListener("click",()=>editRecord(btn.dataset.recordType,btn.dataset.recordId,items)));
}
function filterDossierRecords(){const term=$("#record-search-input")?.value.trim().toLocaleLowerCase("pt-BR")||"";let shown=0;Object.entries(recordStore).forEach(([target,data])=>{const filtered=data.items.filter(item=>!term||[item.title,item.content,item.author,item.notes,item.url].some(value=>String(value||"").toLocaleLowerCase("pt-BR").includes(term)));shown+=filtered.length;renderRecords(target,filtered,data.error,data.type);});$("#record-search-count").textContent=term?shown+" registro(s) encontrado(s)":shown+" registro(s) no dossiê";}
$("#record-search-input")?.addEventListener("input",filterDossierRecords);
async function editRecord(type,recordId,items){
 const item=items.find(entry=>entry.id===recordId);if(!item)return;
 const title=prompt("Título:",item.title);if(title===null)return;if(!title.trim()){say("O título não pode ficar vazio.");return}
 let changes={title:title.trim()};
 if(type==="note"||type==="topic"){const content=prompt("Conteúdo:",item.content||"");if(content===null)return;changes.content=content}
 else{const url=prompt("Link da fonte:",item.url||"");if(url===null)return;if(url.trim()&&!(url.trim().startsWith("https://")||url.trim().startsWith("http://"))){say("O link precisa começar com http:// ou https://.");return}const author=prompt("Autor ou instituição:",item.author||"");if(author===null)return;const notes=prompt("Observações:",item.notes||"");if(notes===null)return;changes.url=url.trim()||null;changes.author=author.trim()||null;changes.notes=notes.trim()||null}
 const table=type==="note"?"notes":type==="topic"?"topics":"sources";
 const result=await client.from(table).update(changes).eq("id",recordId).eq("user_id",uid).eq("investigation_id",id);
 if(result.error){say("Erro ao editar: "+result.error.message);return}say("Registro atualizado.");await loadRecords();
}
async function deleteRecord(type,recordId){
 if(!confirm("Excluir este registro?"))return;
 const table=type==="note"?"notes":type==="topic"?"topics":"sources";
 const result=await client.from(table).delete().eq("id",recordId).eq("user_id",uid).eq("investigation_id",id);
 if(result.error){say("Não foi possível excluir: "+result.error.message);return}
 await loadRecords();
}
$("#note-form").addEventListener("submit",async event=>{
 event.preventDefault();const status=$("#note-status");const button=event.currentTarget.querySelector("button");button.disabled=true;status.textContent="Salvando...";
 const result=await client.from("notes").insert({user_id:uid,investigation_id:id,title:$("#note-title").value.trim(),content:$("#note-content").value.trim()});
 button.disabled=false;if(result.error){status.textContent="Erro: "+result.error.message;return}
 event.currentTarget.reset();status.textContent="Anotação salva.";await loadRecords();
});
$("#topic-form").addEventListener("submit",async event=>{
 event.preventDefault();const status=$("#topic-status");const button=event.currentTarget.querySelector("button");button.disabled=true;status.textContent="Salvando...";
 const result=await client.from("topics").insert({user_id:uid,investigation_id:id,title:$("#topic-title").value.trim(),content:$("#topic-content").value.trim()||null,color:"#E38792",position:{x:0,y:0}});
 button.disabled=false;if(result.error){status.textContent="Erro: "+result.error.message;return}event.currentTarget.reset();status.textContent="Conceito adicionado.";await loadRecords();
});
$("#source-form").addEventListener("submit",async event=>{
 event.preventDefault();const status=$("#source-status");const button=event.currentTarget.querySelector("button");button.disabled=true;status.textContent="Salvando...";
 const raw=$("#source-url").value.trim();if(raw&&!(raw.startsWith("https://")||raw.startsWith("http://"))){button.disabled=false;status.textContent="Use um link iniciado por http:// ou https://.";return}
 const result=await client.from("sources").insert({user_id:uid,investigation_id:id,title:$("#source-title").value.trim(),url:raw||null,author:$("#source-author").value.trim()||null,notes:$("#source-notes").value.trim()||null,source_type:"site"});
 button.disabled=false;if(result.error){status.textContent="Erro: "+result.error.message;return}
 event.currentTarget.reset();status.textContent="Fonte adicionada.";await loadRecords();
});
async function loadPdfDocuments(){
 const list=$("#pdf-documents-list"),select=$("#pdf-document-select"),count=$("#pdf-count");
 list.innerHTML='<p class="record-empty">Carregando documentos...</p>';
 const result=await client.from("library_documents").select("id,title,author,page_count,file_size,storage_path,created_at,processing_status,investigation_id").eq("user_id",uid).order("created_at",{ascending:false});
 if(result.error){list.textContent="Não foi possível carregar os PDFs: "+result.error.message;count.textContent="Erro";return}
 const docs=result.data||[],attached=docs.filter(d=>d.investigation_id===id),available=docs.filter(d=>!d.investigation_id);
 count.textContent=attached.length+" vinculado(s)";
 select.innerHTML='<option value="">Selecione um PDF...</option>'+available.map(d=>'<option value="'+safeText(d.id)+'">'+safeText(d.title)+'</option>').join("");
 if(!attached.length){list.innerHTML='<p class="record-empty">Nenhum PDF vinculado a esta investigação.</p>';return}
 list.innerHTML=attached.map(d=>'<article class="record-card pdf-record"><div><h4>'+safeText(d.title)+'</h4><small class="record-date">'+safeText(d.author||"Autor não informado")+' · '+(d.page_count||"—")+' páginas · '+safeText(d.processing_status)+'</small></div><div class="record-actions"><button type="button" class="pdf-open" data-path="'+safeText(d.storage_path)+'">Abrir PDF ↗</button><button type="button" class="pdf-unlink" data-id="'+safeText(d.id)+'">Desvincular</button></div></article>').join("");
 list.querySelectorAll(".pdf-open").forEach(b=>b.addEventListener("click",()=>openLibraryPdf(b.dataset.path,b)));
 list.querySelectorAll(".pdf-unlink").forEach(b=>b.addEventListener("click",()=>unlinkPdf(b.dataset.id)));
}
async function openLibraryPdf(path,button){
 const tab=window.open("about:blank","_blank");
 if(!tab){$("#pdf-status").textContent="O navegador bloqueou a nova aba. Permita pop-ups para abrir o PDF.";return;}
 const old=button.textContent;button.disabled=true;button.textContent="Abrindo...";
 const result=await client.storage.from("library-private").createSignedUrl(path,300);
 button.disabled=false;button.textContent=old;
 if(result.error){tab.close();$("#pdf-status").textContent="Não foi possível abrir: "+result.error.message;return}
 tab.location.href=result.data.signedUrl;
}
async function unlinkPdf(documentId){
 if(!confirm("Desvincular este PDF? Ele continuará salvo na Biblioteca."))return;
 const result=await client.from("library_documents").update({investigation_id:null}).eq("id",documentId).eq("user_id",uid).eq("investigation_id",id);
 if(result.error){$("#pdf-status").textContent="Erro ao desvincular: "+result.error.message;return}
 $("#pdf-status").textContent="PDF desvinculado. O arquivo continua na Biblioteca.";
 await loadPdfDocuments();
}
$("#pdf-assign-form").addEventListener("submit",async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector("button"),status=$("#pdf-status"),documentId=$("#pdf-document-select").value;
 if(!documentId)return;button.disabled=true;status.textContent="Vinculando...";
 const result=await client.from("library_documents").update({investigation_id:id}).eq("id",documentId).eq("user_id",uid).is("investigation_id",null);
 button.disabled=false;
 if(result.error){status.textContent="Não foi possível vincular: "+result.error.message;return}
 status.textContent="PDF vinculado à investigação.";await loadPdfDocuments();
});

let latestResearch=null,latestStructure=null,knownEntityProfiles=[];
function proposalNameKey(value){return String(value??"").trim().toLocaleLowerCase("pt-BR");}
function renderEntityProposal(item,index){
 const key=proposalNameKey(item.name);
 const matches=knownEntityProfiles.filter(profile=>[profile.canonical_name,...(profile.aliases||[])].some(alias=>proposalNameKey(alias)===key));
 const options=matches.map(profile=>'<option value="'+safeText(profile.id)+'">'+safeText(profile.canonical_name)+' · '+safeText(profile.entity_type)+' · '+safeText((profile.summary||"sem resumo").slice(0,65))+'</option>').join("");
 const evidenceRefs=(item.evidence_refs||[]).map(n=>"["+n+"]").join(" ")||"não indicadas";
 return '<article class="proposal-entity-card"><label class="proposal-item"><input type="checkbox" data-proposal-type="entity" data-proposal-index="'+index+'"><span><strong>'+safeText(item.name)+'</strong><small>'+safeText(item.entity_type+" · "+(item.description||"Sem descrição"))+'</small><small class="proposal-meta">Confiança: '+safeText(item.confidence||"low")+' · Evidências: '+safeText(evidenceRefs)+'</small></span></label><div class="proposal-profile-match"><label for="proposal-profile-'+index+'">Vincular a perfil mestre existente (opcional)</label><select id="proposal-profile-'+index+'" data-profile-proposal-index="'+index+'"><option value="">Manter como registro separado</option>'+options+'</select><small>'+(matches.length?matches.length+" correspondência(s) exata(s) por nome ou alias. Confirme a identidade antes de vincular.":"Nenhuma correspondência exata encontrada. Você poderá associar depois em Entidades.")+'</small></div></article>';
}

const researchForm=$("#research-form");
function renderResearchCitations(citations){
 const list=$("#research-citations");
 list.innerHTML=(citations||[]).length?citations.map(c=>'<li><a href="'+safeText(c.url)+'" target="_blank" rel="noopener noreferrer">['+safeText(c.ref)+'] '+safeText(c.title)+'</a></li>').join(""):'<li>Nenhuma referência verificável foi retornada.</li>';
}
researchForm?.addEventListener("submit",async event=>{
 event.preventDefault();
 const query=$("#research-query").value.trim(),depth=$("#research-depth").value,button=$("#research-submit");
 if(query.length<5){$("#research-status").textContent="Escreva uma consulta com pelo menos 5 caracteres.";return;}
 button.disabled=true;$("#research-status").textContent="Pesquisando fontes externas...";
 $("#research-output").hidden=true;$("#structure-output").hidden=true;latestResearch=null;latestStructure=null;
 const {data,error}=await client.functions.invoke("research-assistant",{body:{query,investigation_id:id,research_depth:depth}});
 button.disabled=false;
 if(error||!data?.answer){$("#research-status").textContent="Não foi possível concluir a pesquisa: "+(data?.error||error?.message||"resposta inválida");return;}
 latestResearch=data;
 $("#research-answer").textContent=data.answer;
 renderResearchCitations(data.citations);
 $("#research-grounding").textContent=data.grounded
  ?"Pesquisa acompanhada por "+(data.citations?.length||0)+" referência(s)."
  :"A pesquisa não retornou referências verificáveis. Trate o conteúdo como não confirmado.";
 $("#research-saved").textContent=(data.saved_sources||0)+" nova(s) fonte(s) salva(s) neste dossiê.";
 $("#research-output").hidden=false;
 $("#research-status").textContent="Pesquisa concluída.";
});
$("#structure-research")?.addEventListener("click",async()=>{
 if(!latestResearch)return;
 const button=$("#structure-research");button.disabled=true;$("#structure-status").textContent="Identificando entidades, acontecimentos e relações...";
 $("#structure-output").hidden=true;latestStructure=null;
 const {data,error}=await client.functions.invoke("research-structure",{body:{
  research_text:latestResearch.answer,citations:latestResearch.citations||[],investigation_id:id
 }});
 button.disabled=false;
 if(error||!data?.proposals_only){$("#structure-status").textContent="Não foi possível estruturar a pesquisa: "+(data?.error||error?.message||"resposta inválida");return;}
 latestStructure=data;
 const profileResult=await client.from("entity_profiles").select("id,entity_type,canonical_name,aliases,summary").eq("user_id",uid).order("canonical_name");
 knownEntityProfiles=profileResult.data||[];
 const entities=data.entities||[],events=data.events||[],relations=data.relationships||[];
 const refs=item=>(item.evidence_refs||[]).map(n=>"["+n+"]").join(" ");
 const card=(type,item,index,title,description)=>'<label class="proposal-item"><input type="checkbox" data-proposal-type="'+type+'" data-proposal-index="'+index+'"><span><strong>'+safeText(title)+'</strong><small>'+safeText(description||"Sem descrição")+'</small><small class="proposal-meta">Confiança: '+safeText(item.confidence||"low")+' · Evidências: '+safeText(refs(item)||"não indicadas")+'</small></span></label>';
 $("#proposal-entities").innerHTML=entities.length?entities.map((x,i)=>renderEntityProposal(x,i)).join(""):'<p class="record-empty">Nenhuma entidade identificada.</p>';
 $("#proposal-events").innerHTML=events.length?events.map((x,i)=>card("event",x,i,x.title,(x.date||"Data não determinada")+" · "+x.description)).join(""):'<p class="record-empty">Nenhum acontecimento identificado.</p>';
 $("#proposal-relations").innerHTML=relations.length?relations.map((x,i)=>card("relationship",x,i,x.source_entity+" — "+x.relation+" → "+x.target_entity,"Relação proposta entre entidades")).join(""):'<p class="record-empty">Nenhuma relação identificada.</p>';
 $("#proposal-questions").textContent=(data.open_questions||[]).length?(data.open_questions||[]).map(q=>"• "+q).join("\n"):"Nenhuma questão em aberto retornada.";
 $("#structure-output").hidden=false;
 $("#structure-status").textContent="Propostas prontas para revisão. Nada foi salvo no Atlas ou na linha do tempo.";
});
$("#save-proposals")?.addEventListener("click",async()=>{
 if(!latestResearch||!latestStructure)return;
 const selected=type=>[...$("#structure-output").querySelectorAll('[data-proposal-type="'+type+'"]:checked')].map(el=>latestStructure[{entity:"entities",event:"events",relationship:"relationships"}[type]][Number(el.dataset.proposalIndex)]);
 const entities=selected("entity"),events=selected("event"),acceptedNames=new Set(entities.map(x=>String(x.name).toLocaleLowerCase("pt-BR")));
 const relationships=selected("relationship").filter(x=>acceptedNames.has(String(x.source_entity).toLocaleLowerCase("pt-BR"))&&acceptedNames.has(String(x.target_entity).toLocaleLowerCase("pt-BR")));
 if(!entities.length&&!events.length&&!relationships.length){$("#structure-status").textContent="Marque ao menos uma proposta para salvar.";return;}
 const profileSelections=[...$("#structure-output").querySelectorAll("[data-profile-proposal-index]")].map(select=>({index:Number(select.dataset.profileProposalIndex),profileId:select.value})).filter(item=>item.profileId);
 const button=$("#save-proposals");button.disabled=true;$("#structure-status").textContent="Salvando propostas aprovadas...";
 const {data,error}=await client.rpc("accept_research_proposals",{
  p_investigation_id:id,p_citations:latestResearch.citations||[],
  p_entities:entities,p_events:events,p_relationships:relationships
 });
 button.disabled=false;
 if(error){$("#structure-status").textContent="Não foi possível salvar: "+error.message;return;}
 const topicMap=data.saved_entity_topic_map||{};let linkedProfiles=0,linkFailures=0;
 for(const selection of profileSelections){
  const proposal=entities[selection.index];if(!proposal)continue;
  const topicId=topicMap[proposalNameKey(proposal.name)];if(!topicId)continue;
  const linked=await client.from("topics").update({entity_profile_id:selection.profileId}).eq("id",topicId).eq("user_id",uid).eq("investigation_id",id).select("id").maybeSingle();
  if(linked.error||!linked.data)linkFailures++;else linkedProfiles++;
 }
 const summary="Salvo: "+data.saved_entities+" entidade(s), "+data.saved_events+" acontecimento(s), "+data.saved_relationships+" relação(ões) e "+data.saved_evidence_links+" vínculo(s) de evidência.";
 $("#structure-status").textContent=summary+(linkedProfiles?" "+linkedProfiles+" entidade(s) vinculada(s) a perfis mestres.":"")+(linkFailures?" Atenção: "+linkFailures+" vínculo(s) com perfis não foram concluídos; revise em Entidades.":"");
 await loadRecords();
});



async function loadEvidenceRegister(){
 const status=$("#evidence-register-status"),list=$("#evidence-register-list"),button=$("#load-evidence-register");
 if(button)button.disabled=true;
 if(status)status.textContent="Carregando vínculos de evidência...";
 const {data:links,error}=await client.from("research_evidence_links")
  .select("id,source_id,reference_number,topic_id,timeline_event_id,connection_id,entity_profile_id,evidence_excerpt,confidence,created_at")
  .eq("user_id",uid).eq("investigation_id",id).order("created_at",{ascending:false}).limit(250);
 if(button)button.disabled=false;
 if(error){status.textContent="Não foi possível carregar as evidências: "+error.message;return;}
 if(!links?.length){list.innerHTML='<p class="record-empty">Ainda não há evidências vinculadas. Aprove propostas com referências para começar a formar este histórico.</p>';status.textContent="0 vínculos registrados.";return;}
 const sourceIds=[...new Set(links.map(x=>x.source_id))],topicIds=[...new Set(links.map(x=>x.topic_id).filter(Boolean))],eventIds=[...new Set(links.map(x=>x.timeline_event_id).filter(Boolean))],connectionIds=[...new Set(links.map(x=>x.connection_id).filter(Boolean))],entityIds=[...new Set(links.map(x=>x.entity_profile_id).filter(Boolean))];
 const [sources,topics,events,connections]=await Promise.all([
  client.from("sources").select("id,title,url").eq("user_id",uid).eq("investigation_id",id).in("id",sourceIds),
  topicIds.length?client.from("topics").select("id,title").eq("user_id",uid).eq("investigation_id",id).in("id",topicIds):Promise.resolve({data:[],error:null}),
  eventIds.length?client.from("timeline_events").select("id,title").eq("user_id",uid).eq("investigation_id",id).in("id",eventIds):Promise.resolve({data:[],error:null}),
  connectionIds.length?client.from("connections").select("id,source_topic_id,target_topic_id,label").eq("user_id",uid).in("id",connectionIds):Promise.resolve({data:[],error:null}),
  entityIds.length?client.from("entity_profiles").select("id,canonical_name").eq("user_id",uid).in("id",entityIds):Promise.resolve({data:[],error:null})
 ]);
 const err=sources.error||topics.error||events.error||connections.error||entityProfiles.error;
 if(err){status.textContent="Não foi possível carregar o contexto das evidências: "+err.message;return;}
 const relatedTopicIds=[...new Set([...topicIds,...(connections.data||[]).flatMap(x=>[x.source_topic_id,x.target_topic_id])])];
 const relatedTopics=relatedTopicIds.length?await client.from("topics").select("id,title").eq("user_id",uid).eq("investigation_id",id).in("id",relatedTopicIds):{data:[],error:null};
 if(relatedTopics.error){status.textContent="Não foi possível carregar as entidades relacionadas.";return;}
 const map=rows=>new Map((rows||[]).map(x=>[x.id,x]));
 const sourceMap=map(sources.data),topicMap=map(relatedTopics.data),eventMap=map(events.data),connectionMap=map(connections.data),profileMap=map(entityProfiles.data);
 const cards=links.map(item=>{
  const source=sourceMap.get(item.source_id);
  let target="Registro sem destino disponível";
  if(item.topic_id)target="Entidade: "+(topicMap.get(item.topic_id)?.title||"não encontrada");
  else if(item.timeline_event_id)target="Acontecimento: "+(eventMap.get(item.timeline_event_id)?.title||"não encontrado");
  else if(item.connection_id){const c=connectionMap.get(item.connection_id);target=c?"Relação: "+(topicMap.get(c.source_topic_id)?.title||"entidade")+" — "+(c.label||"relação")+" → "+(topicMap.get(c.target_topic_id)?.title||"entidade"):"Relação não encontrada";}
  else if(item.entity_profile_id)target="Perfil mestre: "+(profileMap.get(item.entity_profile_id)?.canonical_name||"não encontrado");
  const sourceLink=source?.url&&/^https?:\/\//i.test(source.url)?'<a href="'+safeText(source.url)+'" target="_blank" rel="noopener noreferrer">'+safeText(source.title)+'</a>':safeText(source?.title||"Fonte não encontrada");
  const date=item.created_at?new Date(item.created_at).toLocaleDateString("pt-BR"):"";
  return '<article class="evidence-register-card"><div class="evidence-register-head"><strong>'+sourceLink+'</strong><span class="audit-type">['+safeText(item.reference_number)+']</span></div><small>'+safeText(target)+' · Confiança: '+safeText(item.confidence)+' · '+safeText(date)+'</small><p><strong>Resumo associado pela IA:</strong> '+safeText(item.evidence_excerpt||"Sem resumo.")+'</p></article>';
 }).join("");
 list.innerHTML=cards;
 status.textContent=links.length+" vínculo(s) de evidência carregado(s).";
}
$("#load-evidence-register")?.addEventListener("click",loadEvidenceRegister);

const auditTypeLabels={direct_contradiction:"Contradição direta",factual_discrepancy:"Divergência factual",chronology_inconsistency:"Inconsistência cronológica",unsupported_claim:"Afirmação sem apoio suficiente",corroboration:"Corroboração",source_dependence:"Possível dependência entre fontes"};
const auditEvidenceById=new Map();
function renderEvidenceAudit(data){
 const root=$("#evidence-audit-results");
 if(data.status==="insufficient_evidence"){
  root.hidden=true;
  $("#evidence-audit-status").textContent=data.message+" ("+(data.evidence_count||0)+" vínculo(s), "+(data.source_count||0)+" fonte(s)).";
  return;
 }
 auditEvidenceById.clear();
 (data.evidence_index||[]).forEach(item=>auditEvidenceById.set(item.evidence_id,item));
 $("#evidence-audit-summary").textContent=data.overall_summary||"A comparação não retornou uma síntese.";
 const issues=data.possible_conflicts||[];
 $("#evidence-audit-issues").innerHTML=issues.length?issues.map(item=>{
  const refs=(item.evidence_ids||[]).map(id=>{
   const ev=auditEvidenceById.get(id);if(!ev)return "";
   const link=ev.source_url&&/^https?:\/\//i.test(ev.source_url)?'<a href="'+safeText(ev.source_url)+'" target="_blank" rel="noopener noreferrer">'+safeText(ev.source_title)+'</a>':safeText(ev.source_title);
   return '<div class="audit-evidence"><strong>'+link+'</strong><small>'+safeText(ev.target||"Registro relacionado")+' · Referência ['+safeText(ev.reference_number)+']</small><p>'+safeText(ev.evidence_summary||"Sem resumo associado.")+'</p></div>';
  }).join("");
  return '<article class="audit-issue"><div class="audit-issue-head"><span class="audit-type">'+safeText(auditTypeLabels[item.issue_type]||"Ponto para revisão")+'</span><span class="audit-type audit-severity-'+safeText(item.severity)+'">'+safeText(item.severity)+'</span><strong>'+safeText(item.title)+'</strong></div><p>'+safeText(item.explanation)+'</p>'+refs+'<p><strong>Próxima verificação:</strong> '+safeText(item.next_step)+'</p></article>';
 }).join(""):'<p class="record-empty">Nenhum conflito ou divergência foi sinalizado nos resumos analisados. Isso não prova que as fontes concordem integralmente.</p>';
 const renderList=(selector,title,items)=>{const el=$(selector);el.innerHTML=items?.length?'<h5>'+title+'</h5><ul>'+items.map(x=>'<li>'+safeText(x)+'</li>').join("")+'</ul>':"";};
 renderList("#evidence-audit-corroborations","Possíveis corroborações",data.corroborations||[]);
 renderList("#evidence-audit-gaps","Lacunas de cobertura",data.coverage_gaps||[]);
 root.hidden=false;
 $("#evidence-audit-status").textContent="Comparação concluída com "+data.evidence_count+" vínculo(s) de evidência e "+data.source_count+" fonte(s). Revisão humana obrigatória.";
}
$("#run-evidence-audit")?.addEventListener("click",async()=>{
 const button=$("#run-evidence-audit");button.disabled=true;
 $("#evidence-audit-status").textContent="Comparando as evidências já salvas...";
 $("#evidence-audit-results").hidden=true;
 const {data,error}=await client.functions.invoke("evidence-audit",{body:{investigation_id:id}});
 button.disabled=false;
 if(error||!data){$("#evidence-audit-status").textContent="Não foi possível comparar as evidências: "+(data?.error||error?.message||"resposta inválida");return;}
 if(data.error){$("#evidence-audit-status").textContent=data.error;return;}
 renderEvidenceAudit(data);
});

init().then(async()=>{if(uid){await loadRecords();await loadPdfDocuments();await loadEvidenceRegister();}});