const SUPABASE_URL="https://hoqbkpjwlmkmdvuzinyi.supabase.co",SUPABASE_KEY="sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY),$=id=>document.getElementById(id);let user=null,events=[],editingId=null;
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function dateLabel(value){const [y,m,d]=value.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"})}
function openEditor(item){editingId=item?.id||null;$("event-form").reset();$("editor-title").textContent=item?"Editar acontecimento":"Adicionar acontecimento";const f=$("event-form").elements;if(item){f.title.value=item.title;f.event_date.value=item.event_date;f.category.value=item.category||"";f.description.value=item.description||"";f.source_url.value=item.source_url||""} $("event-editor").hidden=false;f.title.focus()}
function closeEditor(){$("event-editor").hidden=true;editingId=null;$("event-form").reset();$("event-status").textContent=""}
async function init(){const {data,error}=await db.auth.getSession();if(error||!data.session){location.replace("./index.html");return}user=data.session.user;await loadEvents()}
async function loadEvents(){const {data,error}=await db.from("timeline_events").select("id,title,event_date,description,category,source_url,created_at").eq("user_id",user.id).order("event_date",{ascending:true});if(error){$("timeline-list").innerHTML='<div class="timeline-empty">Não foi possível carregar: '+esc(error.message)+'</div>';return}events=data||[];render()}
function render(){const q=$("event-search").value.trim().toLocaleLowerCase("pt-BR"),dir=$("sort-order").value;const list=events.filter(e=>(e.title+" "+(e.description||"")+" "+(e.category||"")).toLocaleLowerCase("pt-BR").includes(q)).sort((a,b)=>dir==="asc"?a.event_date.localeCompare(b.event_date):b.event_date.localeCompare(a.event_date));$("event-count").textContent=events.length+" "+(events.length===1?"acontecimento":"acontecimentos");$("timeline-list").innerHTML=list.length?list.map(e=>'<article class="timeline-item"><span class="timeline-date">'+esc(dateLabel(e.event_date))+'</span><h3>'+esc(e.title)+'</h3>'+(e.description?'<p>'+esc(e.description)+'</p>':'')+'<div class="timeline-meta"><span>'+esc(e.category||"Geral")+'</span>'+(e.source_url&&/^https?:\/\//i.test(e.source_url)?'<a href="'+esc(e.source_url)+'" target="_blank" rel="noopener noreferrer">Consultar fonte ↗</a>':'')+'</div><div class="timeline-actions"><button type="button" data-edit="'+e.id+'">Editar</button><button type="button" data-delete="'+e.id+'">Excluir</button></div></article>').join(""):'<div class="timeline-empty">'+(events.length?"Nenhum acontecimento encontrado.":"Sua linha do tempo está vazia. Adicione o primeiro acontecimento.")+'</div>'}
$("add-event").addEventListener("click",()=>openEditor());$("close-editor").addEventListener("click",closeEditor);$("event-search").addEventListener("input",render);$("sort-order").addEventListener("change",render);
$("event-form").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget.elements;const payload={user_id:user.id,title:f.title.value.trim(),event_date:f.event_date.value,category:f.category.value.trim()||"Geral",description:f.description.value.trim(),source_url:f.source_url.value.trim()||null};if(payload.source_url&&!/^https?:\/\//i.test(payload.source_url)){ $("event-status").textContent="Use um endereço iniciado por http:// ou https://.";return}const wasEditing=Boolean(editingId);$("event-status").textContent="Salvando...";const result=wasEditing?await db.from("timeline_events").update(payload).eq("id",editingId).eq("user_id",user.id):await db.from("timeline_events").insert(payload);if(result.error){$("event-status").textContent="Erro: "+result.error.message;return}closeEditor();$("time-message").textContent=wasEditing?"Acontecimento atualizado.":"Acontecimento salvo.";await loadEvents()});
$("timeline-list").addEventListener("click",async e=>{const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");if(edit){const item=events.find(x=>x.id===edit.dataset.edit);if(item)openEditor(item)}if(del){if(!confirm("Excluir este acontecimento?"))return;const {error}=await db.from("timeline_events").delete().eq("id",del.dataset.delete).eq("user_id",user.id);if(error){$("time-message").textContent="Erro ao excluir: "+error.message;return}$("time-message").textContent="Acontecimento excluído.";await loadEvents()}});
init();
const timelineKnowledgeForm=document.getElementById("timeline-knowledge-form");
if(timelineKnowledgeForm){
 timelineKnowledgeForm.addEventListener("submit",async event=>{
  event.preventDefault();
  const query=timelineKnowledgeForm.elements.query.value.trim(),box=document.getElementById("timeline-knowledge-results"),status=document.getElementById("timeline-knowledge-status");
  status.textContent="Consultando a memória compartilhada...";box.innerHTML="";
  const {data,error}=await db.from("knowledge_records").select("id,label,description,payload,wikidata_url,wikipedia_url").ilike("label","%"+query.replace(/[%_]/g,"\\\\$&")+"%").limit(12);
  if(error){status.textContent="Erro ao consultar: "+error.message;return;}
  if(!data?.length){status.textContent="Nenhum registro encontrado. Pesquise primeiro na página Conhecimento.";return;}
  box.innerHTML=data.map(item=>'<article class="timeline-knowledge-card"><div><strong>'+esc(item.label)+'</strong><p>'+esc(item.description||item.payload?.summary||"Registro compartilhado")+'</p></div><button type="button" data-add-knowledge-event="'+esc(item.id)+'">Adicionar à linha do tempo ＋</button><a href="'+esc(item.wikipedia_url||item.wikidata_url)+'" target="_blank" rel="noopener noreferrer">Fonte ↗</a></article>').join("");
  status.textContent=data.length+" registros encontrados.";
 });
 document.getElementById("timeline-knowledge-results").addEventListener("click",async event=>{
  const button=event.target.closest("[data-add-knowledge-event]");if(!button)return;
  const {data,error}=await db.from("knowledge_records").select("label,description,payload,wikidata_url,wikipedia_url").eq("id",button.dataset.addKnowledgeEvent).maybeSingle();
  if(error||!data){document.getElementById("timeline-knowledge-status").textContent="Registro não encontrado.";return;}
  const summary=String(data.payload?.summary||"");
  const match=summary.match(/(?:em|no dia|aos?)\s+(\d{1,2} de [a-zç]+ de \d{3,4}|\d{4})/i);
  if(!match){document.getElementById("timeline-knowledge-status").textContent="Este resumo não apresenta uma data identificável. Para evitar inventar datas, confira a fonte e registre manualmente.";return;}
  let date=match[1].match(/^\d{4}$/)?match[1]+"-01-01":null;
  if(!date){const months={janeiro:"01",fevereiro:"02",março:"03",abril:"04",maio:"05",junho:"06",julho:"07",agosto:"08",setembro:"09",outubro:"10",novembro:"11",dezembro:"12"};const p=match[1].match(/(\d{1,2}) de ([a-zç]+) de (\d{3,4})/i);if(p&&months[p[2].toLocaleLowerCase("pt-BR")])date=p[3]+"-"+months[p[2].toLocaleLowerCase("pt-BR")]+"-"+p[1].padStart(2,"0");}
  if(!date){document.getElementById("timeline-knowledge-status").textContent="Data não interpretada com segurança. Confira a fonte e registre manualmente.";return;}
  const {error:saveError}=await db.from("timeline_events").insert({user_id:user.id,title:data.label,event_date:date,category:"História",description:[data.description,summary].filter(Boolean).join("\\n\\n").slice(0,4000),source_url:data.wikipedia_url||data.wikidata_url});
  if(saveError){document.getElementById("timeline-knowledge-status").textContent="Erro ao salvar: "+saveError.message;return;}
  button.disabled=true;button.textContent="Adicionado ✓";document.getElementById("timeline-knowledge-status").textContent="Acontecimento adicionado. Confira a data na fonte original.";await loadEvents();
 });
}
