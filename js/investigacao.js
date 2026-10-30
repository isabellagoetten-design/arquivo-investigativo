const client=window.supabase.createClient("https://hoqbkpjwlmkmdvuzinyi.supabase.co","sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg");const id=new URLSearchParams(location.search).get("id");const $=s=>document.querySelector(s);let uid;const say=t=>$("#case-status").textContent=t;async function init(){if(!id){location.href="./inicio.html";return}const s=await client.auth.getSession();if(!s.data.session){location.href="./index.html";return}uid=s.data.session.user.id;const r=await client.from("investigations").select("id,title,subject,category,description,created_at").eq("id",id).eq("user_id",uid).single();if(r.error){$("#case-loading h1").textContent="Não foi possível abrir o registro.";$("#case-loading p").textContent=r.error.message;return}const v=r.data;$("#case-loading").hidden=true;$("#case-content").hidden=false;$("#case-title").textContent=v.title;$("#case-subject").textContent=v.subject||"Sem assunto principal definido";$("#case-date").textContent=new Date(v.created_at).toLocaleDateString("pt-BR");$("#edit-title").value=v.title;$("#edit-subject").value=v.subject||"";$("#edit-category").value=v.category;$("#edit-description").value=v.description||""}$("#save-case").onclick=async()=>{const p={title:$("#edit-title").value.trim(),subject:$("#edit-subject").value.trim()||null,category:$("#edit-category").value,description:$("#edit-description").value.trim()||null};if(!p.title){say("O título é obrigatório.");return}const b=$("#save-case");b.disabled=true;say("Salvando...");const r=await client.from("investigations").update(p).eq("id",id).eq("user_id",uid);b.disabled=false;if(r.error){say("Erro: "+r.error.message);return}$("#case-title").textContent=p.title;$("#case-subject").textContent=p.subject||"Sem assunto principal definido";say("Alterações salvas.")};$("#back-case").onclick=()=>location.href="./inicio.html";$("#delete-case").onclick=async()=>{if(!window.confirm("Excluir esta investigação permanentemente?"))return;const r=await client.from("investigations").delete().eq("id",id).eq("user_id",uid);if(r.error){say("Erro: "+r.error.message);return}location.href="./inicio.html"};async function loadRecords(){
 const [notes,sources]=await Promise.all([
  client.from("notes").select("id,title,content,created_at").eq("user_id",uid).eq("investigation_id",id).order("created_at",{ascending:false}),
  client.from("sources").select("id,title,url,author,notes,source_type,created_at").eq("user_id",uid).eq("investigation_id",id).order("created_at",{ascending:false})
 ]);
 renderRecords("notes-list",notes.data||[],notes.error,"note");
 renderRecords("sources-list",sources.data||[],sources.error,"source");
 const topics=await client.from("topics").select("id,title,content,color,created_at").eq("user_id",uid).eq("investigation_id",id).order("created_at",{ascending:false});
 renderRecords("topics-list",topics.data||[],topics.error,"topic");
}
function safeText(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderRecords(target,items,error,type){
 const el=$("#"+target);
 if(error){el.textContent="Não foi possível carregar. "+error.message;return}
 if(!items.length){el.innerHTML='<p class="record-empty">Nenhum registro adicionado ainda.</p>';return}
 el.innerHTML=items.map(item=>{
  const details=type==="note"||type==="topic"?safeText(item.content):[item.author,item.notes].filter(Boolean).map(safeText).join(" · ");
  const link=type==="source"&&item.url&&(item.url.startsWith("https://")||item.url.startsWith("http://"))?'<a href="'+safeText(item.url)+'" target="_blank" rel="noopener noreferrer">Abrir fonte ↗</a>':"";
  return '<article class="record-card"><div><h4>'+safeText(item.title)+'</h4><p>'+details+'</p>'+link+'</div><div class="record-actions"><button type="button" class="record-edit" data-record-type="'+type+'" data-record-id="'+safeText(item.id)+'">Editar</button><button type="button" class="record-delete" data-record-type="'+type+'" data-record-id="'+safeText(item.id)+'">Excluir</button></div></article>';
 }).join("");
 el.querySelectorAll(".record-delete").forEach(btn=>btn.addEventListener("click",()=>deleteRecord(btn.dataset.recordType,btn.dataset.recordId)));
 el.querySelectorAll(".record-edit").forEach(btn=>btn.addEventListener("click",()=>editRecord(btn.dataset.recordType,btn.dataset.recordId,items)));
}
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
 const table=type==="note"?"notes":"sources";
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
init().then(loadRecords);