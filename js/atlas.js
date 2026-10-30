const SUPABASE_URL="https://hoqbkpjwlmkmdvuzinyi.supabase.co",SUPABASE_KEY="sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY),$=id=>document.getElementById(id);
let user=null,topics=[],links=[];
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;',"'":"&#39;"}[c]))}
async function init(){const {data,error}=await db.auth.getSession();if(error||!data.session){location.replace("./index.html");return}user=data.session.user;await loadAtlas()}
async function loadAtlas(){const [t,l]=await Promise.all([db.from("topics").select("id,title,content,color").eq("user_id",user.id).order("created_at",{ascending:false}),db.from("topic_links").select("id,from_topic_id,to_topic_id").eq("user_id",user.id)]);if(t.error||l.error){$("atlas-map").innerHTML='<div class="atlas-empty">Não foi possível carregar o Atlas. '+esc(t.error?.message||l.error?.message)+'</div>';return}topics=t.data||[];links=l.data||[];render()}
function render(){
 $("atlas-concept-count").textContent=topics.length;$("atlas-link-count").textContent=links.length;
 const form=$("link-form"),oldFrom=form.elements.from.value,oldTo=form.elements.to.value;
 for(const name of ["from","to"]){const select=form.elements[name],old=name==="from"?oldFrom:oldTo;select.innerHTML='<option value="">Escolha um conceito</option>'+topics.map(t=>'<option value="'+t.id+'">'+esc(t.title)+'</option>').join("");if(topics.some(t=>t.id===old))select.value=old}
 const degree={};topics.forEach(t=>degree[t.id]=0);links.forEach(l=>{degree[l.from_topic_id]=(degree[l.from_topic_id]||0)+1;degree[l.to_topic_id]=(degree[l.to_topic_id]||0)+1});
 const map=$("atlas-map");
 if(!topics.length){map.innerHTML='<div class="atlas-empty">Seu mapa ainda está vazio. Crie conceitos no Laboratório para começar.</div>'}
 else{
  const pos=topics.map((t,i)=>{if(i===0)return{x:500,y:325};const a=((i-1)/(topics.length-1))*Math.PI*2-Math.PI/2;return{x:500+Math.cos(a)*350,y:325+Math.sin(a)*245}});
  const coords={};topics.forEach((t,i)=>coords[t.id]=pos[i]);
  const lines=links.map(l=>{const a=coords[l.from_topic_id],b=coords[l.to_topic_id];return a&&b?'<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"></line>':""}).join("");
  const cards=topics.map((t,i)=>{const p=pos[i],color=/^#[0-9a-f]{6}$/i.test(t.color||"")?t.color:"#E38792";return '<article class="atlas-node" style="left:'+p.x/10+'%;top:'+p.y/6.5+'%;--node-color:'+color+'"><span class="node-count">'+(degree[t.id]||0)+' conexões</span><h3>'+esc(t.title)+'</h3><p>'+esc((t.content||"").slice(0,125))+'</p></article>'}).join("");
  map.innerHTML='<svg class="atlas-lines" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">'+lines+'</svg><div class="atlas-node-layer">'+cards+'</div>';
 }
 $("atlas-relations-list").innerHTML=links.length?links.map(l=>{const a=topics.find(t=>t.id===l.from_topic_id),b=topics.find(t=>t.id===l.to_topic_id);return a&&b?'<div class="relation-row"><strong>'+esc(a.title)+'</strong><span class="relation-arrow">↔</span><strong>'+esc(b.title)+'</strong><button type="button" data-remove="'+l.id+'">Remover conexão</button></div>':""}).join(""):'<div class="atlas-empty">Nenhuma conexão criada ainda. Escolha dois conceitos acima para ligá-los.</div>';
}
$("link-form").addEventListener("submit",async e=>{e.preventDefault();const from=e.currentTarget.elements.from.value,to=e.currentTarget.elements.to.value;if(!from||!to||from===to){$("atlas-status").textContent="Escolha dois conceitos diferentes.";return}const exists=links.some(l=>(l.from_topic_id===from&&l.to_topic_id===to)||(l.from_topic_id===to&&l.to_topic_id===from));if(exists){$("atlas-status").textContent="Esses conceitos já estão conectados.";return}const {error}=await db.from("topic_links").insert({user_id:user.id,from_topic_id:from,to_topic_id:to});if(error){$("atlas-status").textContent="Não foi possível criar a conexão: "+error.message;return}$("atlas-status").textContent="Conexão criada.";await loadAtlas()});
$("atlas-relations-list").addEventListener("click",async e=>{const btn=e.target.closest("[data-remove]");if(!btn)return;if(!confirm("Remover esta conexão?"))return;const {error}=await db.from("topic_links").delete().eq("id",btn.dataset.remove).eq("user_id",user.id);if(error){$("atlas-message").textContent="Erro ao remover conexão: "+error.message;return}await loadAtlas()});
init();