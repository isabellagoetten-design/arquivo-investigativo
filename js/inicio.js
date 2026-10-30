const SUPABASE_URL="https://hoqbkpjwlmkmdvuzinyi.supabase.co";
const SUPABASE_KEY="sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg";
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const toast=document.getElementById("home-toast");
const modal=document.getElementById("investigation-modal");
const form=document.getElementById("investigation-form");
let toastTimer;
let currentUser=null;
function notify(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2600)}
async function protectPage(){
 const {data,error}=await client.auth.getSession();
 if(error||!data.session){window.location.replace("./index.html");return}
 currentUser=data.session.user;
 const email=currentUser.email||"Minha conta";
 document.getElementById("profile-email").textContent=email;
 document.querySelector(".profile-avatar").textContent=email.charAt(0).toUpperCase();
 await loadInvestigations();
}
function openInvestigationModal(){modal.hidden=false;document.getElementById("investigation-name").focus()}
function closeInvestigationModal(){modal.hidden=true;form.reset();document.getElementById("investigation-status").textContent=""}
document.querySelectorAll('[data-coming="Nova investigação"]').forEach(button=>button.addEventListener("click",event=>{event.preventDefault();openInvestigationModal()}));
document.getElementById("close-investigation").addEventListener("click",closeInvestigationModal);
document.getElementById("cancel-investigation").addEventListener("click",closeInvestigationModal);
modal.addEventListener("click",event=>{if(event.target===modal)closeInvestigationModal()});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!modal.hidden)closeInvestigationModal()});
form.addEventListener("submit",async event=>{
 event.preventDefault();
 if(!currentUser){notify("Sua sessão expirou. Entre novamente.");return}
 const submit=document.getElementById("save-investigation");
 const status=document.getElementById("investigation-status");
 const values=new FormData(form);
 const record={user_id:currentUser.id,title:String(values.get("title")).trim(),subject:String(values.get("subject")||"").trim()||null,category:String(values.get("category")),description:String(values.get("description")||"").trim()||null};
 if(!record.title||!record.category){status.textContent="Preencha o título e a categoria.";return}
 submit.disabled=true;submit.textContent="Salvando...";
 status.textContent="Salvando sua investigação...";
 let error=null;
 try{
  const result=await client.from("investigations").insert(record);
  error=result.error;
 }catch(requestError){
  error=requestError;
 }
 submit.disabled=false;submit.innerHTML='Salvar investigação <span>↗</span>';
 if(error){
  console.error("Erro ao salvar investigação:",error);
  const details=[error.message,error.code?("Código: "+error.code):null,error.details,error.hint].filter(Boolean).join(" | ");
  status.textContent="Falha ao salvar: "+(details||"erro inesperado. Tente novamente.");
  return;
 }
 closeInvestigationModal();notify("Investigação salva no seu arquivo.");await loadInvestigations();
});
async function loadInvestigations(){
 if(!currentUser)return;
 const {data,error}=await client.from("investigations").select("id,title,subject,category,description,created_at").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(6);
 if(error){console.error("Erro ao carregar investigações:",error);return}
 const container=document.querySelector(".empty-investigation");
 if(!container)return;
 if(!data||data.length===0){return}
 container.innerHTML=data.map(item=>`<button class="investigation-item" type="button" data-investigation-id="${escapeHtml(item.id)}"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description||item.subject||"Investigação em andamento.")}</p><span class="investigation-meta"><span>${escapeHtml(item.category)}</span><span>${new Date(item.created_at).toLocaleDateString("pt-BR")}</span></span><span class="item-open">Abrir investigação ↗</span></button>`).join("");
 container.querySelectorAll("[data-investigation-id]").forEach(button=>button.addEventListener("click",()=>{window.location.href="./investigacao.html?id="+encodeURIComponent(button.dataset.investigationId)}));
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
document.getElementById("home-logout").addEventListener("click",async()=>{
 const {error}=await client.auth.signOut();
 if(error){notify("Não foi possível sair da conta.");return}
 window.location.replace("./index.html");
});
client.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"||!session)window.location.replace("./index.html")});
protectPage();
if("serviceWorker"in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.error))}

document.getElementById("quick-add-source")?.addEventListener("click",()=>{window.location.href="./biblioteca.html"});
