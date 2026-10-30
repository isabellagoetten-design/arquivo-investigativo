const client=window.supabase.createClient("https://hoqbkpjwlmkmdvuzinyi.supabase.co","sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg");const id=new URLSearchParams(location.search).get("id");const $=s=>document.querySelector(s);let uid;const say=t=>$("#case-status").textContent=t;async function init(){if(!id){location.href="./inicio.html";return}const s=await client.auth.getSession();if(!s.data.session){location.href="./index.html";return}uid=s.data.session.user.id;const r=await client.from("investigations").select("id,title,subject,category,description,created_at").eq("id",id).eq("user_id",uid).single();if(r.error){$("#case-loading h1").textContent="Não foi possível abrir o registro.";$("#case-loading p").textContent=r.error.message;return}const v=r.data;$("#case-loading").hidden=true;$("#case-content").hidden=false;$("#case-title").textContent=v.title;$("#case-subject").textContent=v.subject||"Sem assunto principal definido";$("#case-date").textContent=new Date(v.created_at).toLocaleDateString("pt-BR");$("#edit-title").value=v.title;$("#edit-subject").value=v.subject||"";$("#edit-category").value=v.category;$("#edit-description").value=v.description||""}$("#save-case").onclick=async()=>{const p={title:$("#edit-title").value.trim(),subject:$("#edit-subject").value.trim()||null,category:$("#edit-category").value,description:$("#edit-description").value.trim()||null};if(!p.title){say("O título é obrigatório.");return}const b=$("#save-case");b.disabled=true;say("Salvando...");const r=await client.from("investigations").update(p).eq("id",id).eq("user_id",uid);b.disabled=false;if(r.error){say("Erro: "+r.error.message);return}$("#case-title").textContent=p.title;$("#case-subject").textContent=p.subject||"Sem assunto principal definido";say("Alterações salvas.")};$("#back-case").onclick=()=>location.href="./inicio.html";$("#delete-case").onclick=async()=>{if(!window.confirm("Excluir esta investigação permanentemente?"))return;const r=await client.from("investigations").delete().eq("id",id).eq("user_id",uid);if(r.error){say("Erro: "+r.error.message);return}location.href="./inicio.html"};async function loadRecords(){
 const [notes,sources]=await Promise.all([
  client.from("notes").select("id,title,content,created_at").eq("user_id",uid).eq("investigation_id",id).order("created_at",{ascending:false}),
  client.from("sources").select("id,title,url,author,notes,source_type,created_at").eq("user_id",uid).eq("investigation_id",id).order("created_at",{ascending:false})
 ]);
 renderRecords("notes-list",notes.data||[],notes.error,"note");
 renderRecords("sources-list",sources.data||[],sources.error,"source");
}
function safeText(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderRecords(target,items,error,type){
 const el=$("#"+target);
 if(error){el.textContent="Não foi possível carregar. "+error.message;return}
 if(!items.length){el.innerHTML='<p class="record-empty">Nenhum registro adicionado ainda.</p>';return}
 el.innerHTML=items.map(item=>{
  const details=type==="note"?safeText(item.content):[item.author,item.notes].filter(Boolean).map(safeText).join(" · ");
  const link=type==="source"&&item.url&&/^https?:\\/\\//i.test(item.url)?'<a href="'+safeText(item.url)+'" target="_blank" rel="noopener noreferrer">Abrir fonte ↗</a>':"";
  return '<article class="record-card"><div><h4>'+safeText(item.title)+'</h4><p>'+details+'</p>'+link+'</div><button type="button" class="record-delete" data-record-type="'+type+'" data-record-id="'+safeText(item.id)+'">Excluir</button></article>';
 }).join("");
 el.querySelectorAll(".record-delete").forEach(btn=>btn.addEventListener("click",()=>deleteRecord(btn.dataset.recordType,btn.dataset.recordId)));
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
$("#source-form").addEventListener("submit",async event=>{
 event.preventDefault();const status=$("#source-status");const button=event.currentTarget.querySelector("button");button.disabled=true;status.textContent="Salvando...";
 const raw=$("#source-url").value.trim();if(raw&&!/^https?:\\/\\//i.test(raw)){button.disabled=false;status.textContent="Use um link iniciado por http:// ou https://.";return}
 const result=await client.from("sources").insert({user_id:uid,investigation_id:id,title:$("#source-title").value.trim(),url:raw||null,author:$("#source-author").value.trim()||null,notes:$("#source-notes").value.trim()||null,source_type:"site"});
 button.disabled=false;if(result.error){status.textContent="Erro: "+result.error.message;return}
 event.currentTarget.reset();status.textContent="Fonte adicionada.";await loadRecords();
});
init().then(loadRecords);