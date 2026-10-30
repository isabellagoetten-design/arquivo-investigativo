const SUPABASE_URL="https://hoqbkpjwlmkmdvuzinyi.supabase.co";
const SUPABASE_KEY="sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg";
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const toast=document.getElementById("home-toast");
let toastTimer;
function notify(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2600)}
async function protectPage(){
 const {data,error}=await client.auth.getSession();
 if(error||!data.session){window.location.replace("./index.html");return}
 const email=data.session.user.email||"Minha conta";
 document.getElementById("profile-email").textContent=email;
 document.querySelector(".profile-avatar").textContent=email.charAt(0).toUpperCase();
}
document.getElementById("home-logout").addEventListener("click",async()=>{
 const {error}=await client.auth.signOut();
 if(error){notify("Não foi possível sair da conta.");return}
 window.location.replace("./index.html");
});
document.querySelectorAll("[data-coming]").forEach(button=>button.addEventListener("click",event=>{
 event.preventDefault();notify(button.dataset.coming+" será desenvolvido nas próximas etapas.");
}));
document.getElementById("profile-button").addEventListener("click",()=>notify("Área da conta será ampliada em uma próxima etapa."));
client.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"||!session)window.location.replace("./index.html")});
protectPage();
if("serviceWorker"in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.error))}
