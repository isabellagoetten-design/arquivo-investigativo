const SUPABASE_URL="https://hoqbkpjwlmkmdvuzinyi.supabase.co";
const SUPABASE_KEY="sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
let user=null,topics=[],links=[],selectedTopic=null;

function esc(value){
 return String(value??"").replace(/[&<>"']/g,char=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
 }[char]));
}
async function init(){
 const result=await db.auth.getSession();
 if(result.error||!result.data.session){location.replace("./index.html");return;}
 user=result.data.session.user;
 await loadAtlas();
}
async function loadAtlas(){
 const results=await Promise.all([
  db.from("topics").select("id,title,content,color,entity_type,confidence").eq("user_id",user.id).order("created_at",{ascending:false}),
  db.from("topic_links").select("id,from_topic_id,to_topic_id").eq("user_id",user.id),
  db.from("connections").select("id,source_topic_id,target_topic_id,label").eq("user_id",user.id)
 ]);
 const t=results[0],l=results[1],c=results[2];
 if(t.error||l.error||c.error){
  $("atlas-map").innerHTML='<div class="atlas-empty">Erro ao carregar: '+esc(t.error?.message||l.error?.message||c.error?.message)+'</div>';
  return;
 }
 topics=t.data||[];
 links=[
  ...(l.data||[]).map(link=>({...link,table:"topic_links",label:""})),
  ...(c.data||[]).map(link=>({id:link.id,from_topic_id:link.source_topic_id,to_topic_id:link.target_topic_id,label:link.label||"",table:"connections"}))
 ];
 render();
}
function render(){
 $("atlas-concept-count").textContent=topics.length;
 $("atlas-link-count").textContent=links.length;
 const linkForm=$("link-form");
 for(const field of ["from","to"]){
  const select=linkForm.elements[field],previous=select.value;
  select.innerHTML='<option value="">Escolha um conceito</option>'+topics.map(topic=>'<option value="'+topic.id+'">'+esc(topic.title)+'</option>').join("");
  if(topics.some(topic=>topic.id===previous))select.value=previous;
 }
 const degree={};
 topics.forEach(topic=>degree[topic.id]=0);
 links.forEach(link=>{
  degree[link.from_topic_id]=(degree[link.from_topic_id]||0)+1;
  degree[link.to_topic_id]=(degree[link.to_topic_id]||0)+1;
 });
 const map=$("atlas-map");
 if(!topics.length){
  map.innerHTML='<div class="atlas-empty">Seu mapa ainda esta vazio. Adicione seu primeiro conceito no formulario acima.</div>';
 }else{
  const positions=topics.map((topic,index)=>{
   if(index===0)return {x:500,y:325};
   const angle=((index-1)/(topics.length-1))*Math.PI*2-Math.PI/2;
   return {x:500+Math.cos(angle)*350,y:325+Math.sin(angle)*245};
  });
  const coords={};
  topics.forEach((topic,index)=>coords[topic.id]=positions[index]);
  const lines=links.map(link=>{
   const a=coords[link.from_topic_id],b=coords[link.to_topic_id];
   return a&&b?'<line data-a="'+link.from_topic_id+'" data-b="'+link.to_topic_id+'" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"></line>':"";
  }).join("");
  const cards=topics.map((topic,index)=>{
   const p=positions[index],color=/^#[0-9a-f]{6}$/i.test(topic.color||"")?topic.color:"#E38792";
   return '<article class="atlas-node" tabindex="0" role="button" data-topic="'+topic.id+'" aria-label="Selecionar conceito '+esc(topic.title)+'" style="left:'+p.x/10+'%;top:'+p.y/6.5+'%;--node-color:'+color+'"><span class="node-count">'+(degree[topic.id]||0)+' conexoes</span><h3>'+esc(topic.title)+'</h3><p>'+esc((topic.content||"").slice(0,125))+'</p><button type="button" class="delete-concept" data-delete-topic="'+topic.id+'" aria-label="Excluir '+esc(topic.title)+'">Excluir</button></article>';
  }).join("");
  map.innerHTML='<svg class="atlas-lines" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">'+lines+'</svg><div class="atlas-node-layer">'+cards+'</div>';
 }
 $("atlas-relations-list").innerHTML=links.length?links.map(link=>{
  const a=topics.find(topic=>topic.id===link.from_topic_id),b=topics.find(topic=>topic.id===link.to_topic_id);
  return a&&b?'<div class="relation-row"><strong>'+esc(a.title)+'</strong><span class="relation-arrow">↔</span><strong>'+esc(b.title)+'</strong>'+(link.label?'<small>'+esc(link.label)+'</small>':'')+'<button type="button" data-remove="'+link.id+'" data-remove-table="'+link.table+'">Remover conexao</button></div>':"";
 }).join(""):'<div class="atlas-empty">Nenhuma conexao criada ainda.</div>';
}
$("concept-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const form=event.currentTarget,title=form.elements.title.value.trim(),content=form.elements.content.value.trim();
 if(!title){$("concept-status").textContent="Digite o nome do conceito.";return;}
 $("concept-status").textContent="Salvando...";
 const result=await db.from("topics").insert({user_id:user.id,title,content,color:"#E38792",position:{x:0,y:0}});
 if(result.error){$("concept-status").textContent="Nao foi possivel adicionar: "+result.error.message;return;}
 form.reset();$("concept-status").textContent="Conceito adicionado ao Atlas.";
 await loadAtlas();
});
const importForm=$("knowledge-import-form");
importForm.addEventListener("submit",async event=>{
 event.preventDefault();
 const query=importForm.elements.query.value.trim();
 const box=$("knowledge-import-results");
 $("knowledge-import-status").textContent="Consultando a memória compartilhada...";
 box.innerHTML="";
 const {data,error}=await db.from("knowledge_records").select("id,label,description,payload,wikidata_url,wikipedia_url").ilike("label","%"+query+"%").order("label").limit(12);
 if(error){$("knowledge-import-status").textContent="Não foi possível consultar: "+error.message;return;}
 if(!data?.length){$("knowledge-import-status").textContent="Nenhum registro salvo corresponde a essa busca. Pesquise primeiro na página Conhecimento.";return;}
 box.innerHTML=data.map(item=>'<article class="knowledge-import-card"><div><strong>'+esc(item.label)+'</strong><p>'+esc(item.description||item.payload?.summary||"Registro da base compartilhada")+'</p></div><button type="button" data-import-knowledge="'+esc(item.id)+'">Adicionar ao Atlas ＋</button><a href="'+esc(item.wikipedia_url||item.wikidata_url)+'" target="_blank" rel="noopener noreferrer">Fonte ↗</a></article>').join("");
 $("knowledge-import-status").textContent=data.length+" registros encontrados.";
});
$("knowledge-import-results").addEventListener("click",async event=>{
 const button=event.target.closest("[data-import-knowledge]");
 if(!button)return;
 const id=button.dataset.importKnowledge;
 const {data,error}=await db.from("knowledge_records").select("id,label,description,payload,wikidata_url,wikipedia_url").eq("id",id).maybeSingle();
 if(error||!data){$("knowledge-import-status").textContent="Registro não encontrado.";return;}
 const exists=topics.some(topic=>topic.title.toLocaleLowerCase("pt-BR")===data.label.toLocaleLowerCase("pt-BR"));
 if(exists){$("knowledge-import-status").textContent="Esse conceito já existe no seu Atlas.";return;}
 const description=[data.description,data.payload?.summary].filter(Boolean).join("\n\n").slice(0,5000);
 const saved=await db.from("topics").insert({user_id:user.id,title:data.label,content:description,color:"#9DAD71",position:{x:0,y:0}});
 if(saved.error){$("knowledge-import-status").textContent="Erro ao adicionar: "+saved.error.message;return;}
 button.disabled=true;button.textContent="Adicionado ✓";
 $("knowledge-import-status").textContent="Conceito importado para seu Atlas.";
 await loadAtlas();
});
function updateSelection(){
 const map=$("atlas-map"),connected=new Set();
 links.forEach(link=>{
  if(link.from_topic_id===selectedTopic)connected.add(link.to_topic_id);
  if(link.to_topic_id===selectedTopic)connected.add(link.from_topic_id);
 });
 map.querySelectorAll("[data-topic]").forEach(node=>{
  node.classList.toggle("is-selected",node.dataset.topic===selectedTopic);
  node.classList.toggle("is-related",!!selectedTopic&&connected.has(node.dataset.topic));
  node.classList.toggle("is-muted",!!selectedTopic&&node.dataset.topic!==selectedTopic&&!connected.has(node.dataset.topic));
 });
 map.querySelectorAll("line[data-a]").forEach(line=>line.classList.toggle("is-active",!!selectedTopic&&(line.dataset.a===selectedTopic||line.dataset.b===selectedTopic)));
 $("atlas-message").textContent=selectedTopic?"Conceito selecionado: "+(topics.find(topic=>topic.id===selectedTopic)?.title||"")+". Toque novamente para limpar.":"Selecao limpa.";
}
$("atlas-map").addEventListener("click",event=>{
 const node=event.target.closest("[data-topic]");
 if(!node)return;
 selectedTopic=selectedTopic===node.dataset.topic?null:node.dataset.topic;
 updateSelection();
});
$("atlas-map").addEventListener("keydown",event=>{
 if((event.key==="Enter"||event.key===" ")&&event.target.matches("[data-topic]")){
  event.preventDefault();
  selectedTopic=selectedTopic===event.target.dataset.topic?null:event.target.dataset.topic;
  updateSelection();
 }
});
$("link-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const from=event.currentTarget.elements.from.value,to=event.currentTarget.elements.to.value;
 if(!from||!to||from===to){$("atlas-status").textContent="Escolha dois conceitos diferentes.";return;}
 const exists=links.some(link=>(link.from_topic_id===from&&link.to_topic_id===to)||(link.from_topic_id===to&&link.to_topic_id===from));
 if(exists){$("atlas-status").textContent="Esses conceitos ja estao conectados.";return;}
 const result=await db.from("topic_links").insert({user_id:user.id,from_topic_id:from,to_topic_id:to});
 if(result.error){$("atlas-status").textContent="Erro: "+result.error.message;return;}
 $("atlas-status").textContent="Conexao criada.";
 await loadAtlas();
});
$("atlas-relations-list").addEventListener("click",async event=>{
 const button=event.target.closest("[data-remove]");
 if(!button)return;
 if(!confirm("Remover esta conexao?"))return;
 const table=button.dataset.removeTable==="connections"?"connections":"topic_links";
 const result=await db.from(table).delete().eq("id",button.dataset.remove).eq("user_id",user.id);
 if(result.error){$("atlas-message").textContent="Erro ao remover: "+result.error.message;return;}
 await loadAtlas();
});
init();
