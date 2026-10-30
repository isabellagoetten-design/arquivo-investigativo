const ENTITIES_URL="https://hoqbkpjwlmkmdvuzinyi.supabase.co";
const ENTITIES_KEY="sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg";
const entityDb=window.supabase.createClient(ENTITIES_URL,ENTITIES_KEY);
const entityEl=id=>document.getElementById(id);
let entityUser=null,entityProfiles=[],entityTopics=[],entityInvestigations=[],entityEvents=[],entityConnections=[],entitySources=[],entityEvidence=[];

const entityTypes={person:"Pessoa",organization:"Organização",place:"Lugar",event:"Acontecimento",concept:"Conceito",other:"Outro"};
function entitySafe(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
function entityMap(rows){return new Map((rows||[]).map(row=>[row.id,row]));}
function entityStatus(id,message){entityEl(id).textContent=message;}

async function startEntities(){
 const {data,error}=await entityDb.auth.getSession();
 if(error||!data.session){location.replace("./index.html");return;}
 entityUser=data.session.user;
 await loadEntityData();
}

async function loadEntityData(){
 entityEl("entity-directory").innerHTML='<p class="entity-empty">Carregando registros e vínculos...</p>';
 const queries=await Promise.all([
  entityDb.from("entity_profiles").select("id,entity_type,canonical_name,summary,aliases,external_identifier,external_source_url,created_at").eq("user_id",entityUser.id).order("canonical_name"),
  entityDb.from("topics").select("id,title,content,entity_type,confidence,investigation_id,entity_profile_id").eq("user_id",entityUser.id).order("title"),
  entityDb.from("investigations").select("id,title").eq("user_id",entityUser.id).order("title"),
  entityDb.from("timeline_events").select("id,title,event_date,date_label,date_precision,description,topic_id,investigation_id").eq("user_id",entityUser.id),
  entityDb.from("connections").select("id,source_topic_id,target_topic_id,label").eq("user_id",entityUser.id),
  entityDb.from("sources").select("id,title,url,topic_id,investigation_id").eq("user_id",entityUser.id),
  entityDb.from("research_evidence_links").select("id,source_id,reference_number,topic_id,timeline_event_id,connection_id,evidence_excerpt,confidence,investigation_id").eq("user_id",entityUser.id)
 ]);
 const firstError=queries.find(result=>result.error);
 if(firstError){
  entityEl("entity-directory").innerHTML='<p class="entity-empty">Não foi possível carregar os dados: '+entitySafe(firstError.error.message)+'</p>';
  return;
 }
 [entityProfiles,entityTopics,entityInvestigations,entityEvents,entityConnections,entitySources,entityEvidence]=queries.map(result=>result.data||[]);
 fillEntitySelectors();
 renderEntityDirectory();
}

function fillEntitySelectors(){
 const profileSelect=entityEl("entity-profile-select"),topicSelect=entityEl("entity-topic-select");
 profileSelect.innerHTML='<option value="">Escolha um perfil</option>'+entityProfiles.map(profile=>'<option value="'+profile.id+'">'+entitySafe(profile.canonical_name)+' · '+entitySafe(entityTypes[profile.entity_type]||"Outro")+'</option>').join("");
 const unlinked=entityTopics.filter(topic=>!topic.entity_profile_id);
 topicSelect.innerHTML='<option value="">Escolha um registro ainda não vinculado</option>'+unlinked.map(topic=>{
  const investigation=entityInvestigations.find(item=>item.id===topic.investigation_id);
  return '<option value="'+topic.id+'">'+entitySafe(topic.title)+' · '+entitySafe(investigation?.title||"Sem investigação")+'</option>';
 }).join("");
 topicSelect.disabled=!unlinked.length;
}

function renderEntityDirectory(){
 const directory=entityEl("entity-directory");
 entityEl("entity-count").textContent=entityProfiles.length+" "+(entityProfiles.length===1?"perfil":"perfis");
 if(!entityProfiles.length){
  directory.innerHTML='<p class="entity-empty">Nenhum perfil mestre cadastrado. Crie o primeiro acima e depois vincule a ele registros das suas investigações.</p>';
  return;
 }
 const topicMap=entityMap(entityTopics),investigationMap=entityMap(entityInvestigations),sourceMap=entityMap(entitySources);
 directory.innerHTML=entityProfiles.map(profile=>{
  const linked=entityTopics.filter(topic=>topic.entity_profile_id===profile.id);
  const linkedIds=new Set(linked.map(topic=>topic.id));
  const events=entityEvents.filter(event=>event.topic_id&&linkedIds.has(event.topic_id));
  const connections=entityConnections.filter(connection=>linkedIds.has(connection.source_topic_id)||linkedIds.has(connection.target_topic_id));
  const sourceIds=new Set(entitySources.filter(source=>source.topic_id&&linkedIds.has(source.topic_id)).map(source=>source.id));
  entityEvidence.filter(item=>item.topic_id&&linkedIds.has(item.topic_id)).forEach(item=>sourceIds.add(item.source_id));
  const sourceCount=sourceIds.size;
  const topicMarkup=linked.length?linked.map(topic=>{
   const investigation=investigationMap.get(topic.investigation_id);
   const relatedEvents=events.filter(event=>event.topic_id===topic.id);
   const relatedSources=entitySources.filter(source=>source.topic_id===topic.id);
   const relatedEvidence=entityEvidence.filter(item=>item.topic_id===topic.id);
   const refs=[...relatedSources.map(source=>({title:source.title,url:source.url})),...relatedEvidence.map(item=>({title:sourceMap.get(item.source_id)?.title||"Fonte associada",url:sourceMap.get(item.source_id)?.url,reference:item.reference_number}))];
   const uniqueRefs=[...new Map(refs.map(ref=>[(ref.title||"")+":"+(ref.reference||""),ref])).values()];
   return '<div class="entity-topic"><strong>'+entitySafe(topic.title)+'</strong><small>'+entitySafe(investigation?.title||"Registro sem investigação vinculada")+' · '+entitySafe(entityTypes[topic.entity_type]||topic.entity_type||"Tipo não definido")+' · confiança '+entitySafe(topic.confidence||"não informada")+'</small>'+(relatedEvents.length?'<small>'+relatedEvents.length+' acontecimento(s) relacionado(s)</small>':'')+(uniqueRefs.length?'<small>'+uniqueRefs.slice(0,5).map(ref=>ref.url&&/^https?:\/\//i.test(ref.url)?'<a href="'+entitySafe(ref.url)+'" target="_blank" rel="noopener noreferrer">'+entitySafe(ref.title)+'</a>':entitySafe(ref.title)).join(" · ")+'</small>':'')+'<div class="entity-topic-actions"><button type="button" data-unlink-topic="'+topic.id+'">Desvincular deste perfil</button></div></div>';
  }).join(""):'<p class="entity-empty">Nenhum registro de investigação vinculado a este perfil.</p>';
  const aliases=Array.isArray(profile.aliases)?profile.aliases.filter(Boolean):[];
  const sourceLink=profile.external_source_url&&/^https?:\/\//i.test(profile.external_source_url)?'<a class="entity-card-source" href="'+entitySafe(profile.external_source_url)+'" target="_blank" rel="noopener noreferrer">Fonte de identificação ↗</a>':"";
  return '<article class="entity-card" data-entity-card="'+profile.id+'"><div class="entity-card-top"><span class="entity-type">'+entitySafe(entityTypes[profile.entity_type]||"Outro")+'</span><span class="entity-type">'+linked.length+' vínculo(s)</span></div><h3>'+entitySafe(profile.canonical_name)+'</h3><p class="entity-card-summary">'+entitySafe(profile.summary||"Sem resumo de identificação.")+'</p>'+(aliases.length?'<small>Também conhecido como: '+aliases.map(entitySafe).join(", ")+'</small>':'')+'<div class="entity-card-stats"><span>'+new Set(linked.map(topic=>topic.investigation_id).filter(Boolean)).size+' investigação(ões)</span><span>'+events.length+' acontecimento(s)</span><span>'+connections.length+' relação(ões)</span><span>'+sourceCount+' fonte(s)</span></div><details><summary>Ver registros, acontecimentos e fontes</summary><div class="entity-topic-list">'+topicMarkup+'</div></details>'+sourceLink+'</article>';
 }).join("");
}

entityEl("entity-create-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
 const name=form.elements.canonical_name.value.trim();
 if(!name){entityStatus("entity-create-status","Informe o nome principal.");return;}
 const rawUrl=form.elements.external_source_url.value.trim();
 if(rawUrl&&!/^https?:\/\//i.test(rawUrl)){entityStatus("entity-create-status","A fonte precisa começar com http:// ou https://.");return;}
 button.disabled=true;entityStatus("entity-create-status","Salvando perfil...");
 const aliases=form.elements.aliases.value.split(";").map(item=>item.trim()).filter(Boolean);
 const {error}=await entityDb.from("entity_profiles").insert({
  user_id:entityUser.id,entity_type:form.elements.entity_type.value,canonical_name:name,
  summary:form.elements.summary.value.trim()||null,aliases,
  external_identifier:form.elements.external_identifier.value.trim()||null,
  external_source_url:rawUrl||null
 });
 button.disabled=false;
 if(error){entityStatus("entity-create-status","Não foi possível criar o perfil: "+error.message);return;}
 form.reset();entityStatus("entity-create-status","Perfil criado. Agora você pode vinculá-lo a registros existentes.");
 await loadEntityData();
});

entityEl("entity-link-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
 const profileId=form.elements.profile_id.value,topicId=form.elements.topic_id.value;
 const profile=entityProfiles.find(item=>item.id===profileId),topic=entityTopics.find(item=>item.id===topicId);
 if(!profile||!topic){entityStatus("entity-link-status","Escolha um perfil e um registro válidos.");return;}
 if(topic.entity_profile_id){entityStatus("entity-link-status","Este registro já está vinculado a outro perfil.");return;}
 button.disabled=true;entityStatus("entity-link-status","Criando vínculo...");
 const {error}=await entityDb.from("topics").update({entity_profile_id:profileId}).eq("id",topicId).eq("user_id",entityUser.id);
 button.disabled=false;
 if(error){entityStatus("entity-link-status","Não foi possível vincular: "+error.message);return;}
 form.reset();entityStatus("entity-link-status","Registro vinculado a "+profile.canonical_name+".");
 await loadEntityData();
});

entityEl("entity-directory").addEventListener("click",async event=>{
 const button=event.target.closest("[data-unlink-topic]");
 if(!button)return;
 const topicId=button.dataset.unlinkTopic;
 const topic=entityTopics.find(item=>item.id===topicId);
 if(!topic||!topic.entity_profile_id)return;
 button.disabled=true;
 const {error}=await entityDb.from("topics").update({entity_profile_id:null}).eq("id",topicId).eq("user_id",entityUser.id);
 if(error){button.disabled=false;entityStatus("entity-link-status","Não foi possível desfazer o vínculo: "+error.message);return;}
 entityStatus("entity-link-status","Vínculo removido. O registro original foi preservado.");
 await loadEntityData();
});

startEntities();