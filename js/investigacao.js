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
 const old=button.textContent;button.disabled=true;button.textContent="Abrindo...";
 const result=await client.storage.from("library-private").createSignedUrl(path,300);
 button.disabled=false;button.textContent=old;
 if(result.error){$("#pdf-status").textContent="Não foi possível abrir: "+result.error.message;return}
 window.open(result.data.signedUrl,"_blank","noopener,noreferrer");
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

let latestResearch=null,latestStructure=null;
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
 const entities=data.entities||[],events=data.events||[],relations=data.relationships||[];
 const refs=item=>(item.evidence_refs||[]).map(n=>"["+n+"]").join(" ");
 const card=(type,item,index,title,description)=>'<label class="proposal-item"><input type="checkbox" data-proposal-type="'+type+'" data-proposal-index="'+index+'"><span><strong>'+safeText(title)+'</strong><small>'+safeText(description||"Sem descrição")+'</small><small class="proposal-meta">Confiança: '+safeText(item.confidence||"low")+' · Evidências: '+safeText(refs(item)||"não indicadas")+'</small></span></label>';
 $("#proposal-entities").innerHTML=entities.length?entities.map((x,i)=>card("entity",x,i,x.name,x.entity_type+" · "+x.description)).join(""):'<p class="record-empty">Nenhuma entidade identificada.</p>';
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
 const button=$("#save-proposals");button.disabled=true;$("#structure-status").textContent="Salvando propostas aprovadas...";
 const {data,error}=await client.rpc("accept_research_proposals",{
  p_investigation_id:id,p_citations:latestResearch.citations||[],
  p_entities:entities,p_events:events,p_relationships:relationships
 });
 button.disabled=false;
 if(error){$("#structure-status").textContent="Não foi possível salvar: "+error.message;return;}
 $("#structure-status").textContent="Salvo: "+data.saved_entities+" entidade(s), "+data.saved_events+" acontecimento(s), "+data.saved_relationships+" relação(ões) e "+data.saved_evidence_links+" vínculo(s) de evidência.";
 await loadRecords();
});

init().then(async()=>{if(uid){await loadRecords();await loadPdfDocuments();}});