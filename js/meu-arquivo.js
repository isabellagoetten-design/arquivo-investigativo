const SUPABASE_URL="https://hoqbkpjwlmkmdvuzinyi.supabase.co";
const SUPABASE_KEY="sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
let records=[];
function esc(v){return String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function date(v){if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"});}
async function loadTable(table,fields,userId,type){const result=await db.from(table).select(fields).eq("user_id",userId);if(result.error){console.warn("Erro em "+table,result.error.message);return [];}return (result.data||[]).map(item=>({...item,type}));}
async function init(){
 const session=await db.auth.getSession();
 if(session.error||!session.data.session){location.replace("./index.html");return;}
 const uid=session.data.session.user.id;
 const groups=await Promise.all([
  loadTable("investigations","id,title,subject,category,description,created_at",uid,"investigation"),
  loadTable("notes","id,title,content,created_at,investigation_id",uid,"note"),
  loadTable("sources","id,title,url,author,notes,created_at,investigation_id",uid,"source"),
  loadTable("topics","id,title,content,color,created_at,investigation_id",uid,"topic"),
  loadTable("timeline_events","id,title,event_date,description,category,source_url,created_at",uid,"event")
 ]);
 records=groups.flat();
 ["investigations","notes","sources","topics","events"].forEach((key,i)=>$( "count-"+key).textContent=groups[i].length);
 $("archive-status").textContent=records.length+" registros encontrados no seu acervo.";
 render();
}
function render(){
 const term=$("archive-search").value.trim().toLocaleLowerCase("pt-BR");
 const filter=$("archive-filter").value;
 const list=records.filter(r=>(filter==="all"||r.type===filter)&&[r.title,r.subject,r.category,r.description,r.content,r.author,r.notes].join(" ").toLocaleLowerCase("pt-BR").includes(term));
 list.sort((a,b)=>new Date(b.created_at||b.event_date||0)-new Date(a.created_at||a.event_date||0));
 const labels={investigation:"Investigação",note:"Anotação",source:"Fonte",topic:"Conceito",event:"Acontecimento"};
 $("archive-list").innerHTML=list.length?list.map(r=>{
  const summary=r.description||r.content||r.notes||r.subject||r.author||"";
  const stamp=date(r.event_date||r.created_at);
  let href="",label="";
  if(r.type==="investigation"){href="./investigacao.html?id="+encodeURIComponent(r.id);label="Abrir investigação ↗";}
  else if(r.type==="source"&&/^https?:\/\//i.test(r.url||"")){href=r.url;label="Consultar fonte ↗";}
  else if(r.type==="event"&&/^https?:\/\//i.test(r.source_url||"")){href=r.source_url;label="Consultar fonte ↗";}
  else if(r.investigation_id){href="./investigacao.html?id="+encodeURIComponent(r.investigation_id);label="Ver investigação relacionada ↗";}
  return '<article class="archive-card"><div class="archive-card-top"><span class="archive-type">'+labels[r.type]+'</span><span class="archive-date">'+esc(stamp)+'</span></div><h2>'+esc(r.title)+'</h2>'+(summary?'<p>'+esc(summary)+'</p>':'')+(r.category?'<p class="archive-date">Categoria: '+esc(r.category)+'</p>':'')+(href?'<a class="archive-card-link" href="'+esc(href)+'" '+(href.startsWith("http")?'target="_blank" rel="noopener noreferrer"':'')+'>'+label+'</a>':'')+'</article>';
 }).join(""):'<div class="archive-empty">'+(records.length?"Nenhum registro corresponde à busca.":"Seu acervo ainda está vazio. Crie uma investigação, salve uma fonte ou registre uma ideia para começar.")+'</div>';
}
$("archive-search").addEventListener("input",render);
$("archive-filter").addEventListener("change",render);
init();