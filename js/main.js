console.log("Arquivo Investigativo carregado!");

const SUPABASE_URL = "https://hoqbkpjwlmkmdvuzinyi.supabase.co";
const SUPABASE_KEY = "sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg";

// Mantém o modo offline
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        "./service-worker.js"
      );
      console.log("Modo offline registrado!", registration.scope);
    } catch (error) {
      console.error("Erro no modo offline:", error);
    }
  });
}

// Testa o Supabase
async function testarSupabase() {
  console.log("Testando conexão com Supabase...");

  try {
    const resposta = await fetch(
      `${SUPABASE_URL}/rest/v1/dossiers?select=id&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    console.log("Resposta do Supabase:", resposta.status);

    if (resposta.ok) {
      console.log("Conexão com Supabase funcionando!");
    } else {
      console.error("Supabase respondeu com erro:", await resposta.text());
    }
  } catch (error) {
    console.error("Falha na conexão:", error);
  }
}

testarSupabase();
