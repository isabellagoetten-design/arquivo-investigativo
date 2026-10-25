
console.log("Arquivo Investigativo carregado!");

const SUPABASE_URL = "https://hoqbkpjwlmkmdvuzinyi.supabase.co";
const SUPABASE_KEY = "sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg";

const cliente = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const cadastro = document.getElementById("form-cadastro");
const login = document.getElementById("form-login");
const sair = document.getElementById("btn-sair");
const mensagem = document.getElementById("mensagem-conta");
const estado = document.getElementById("estado-conta");

function mostrarMensagem(texto) {
  mensagem.textContent = texto;
}

async function atualizarTela() {
  const { data, error } = await cliente.auth.getSession();

  if (error) {
    mostrarMensagem("Erro ao verificar a sessão: " + error.message);
    return;
  }

  const usuario = data.session?.user;

  if (usuario) {
    estado.textContent = "Você está conectada: " + usuario.email;
    cadastro.hidden = true;
    login.hidden = true;
    sair.hidden = false;
  } else {
    estado.textContent = "Você não está conectada.";
    cadastro.hidden = false;
    login.hidden = false;
    sair.hidden = true;
  }
}

cadastro.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarMensagem("Criando sua conta...");

  const email = document.getElementById("cadastro-email").value.trim();
  const senha = document.getElementById("cadastro-senha").value;

  const { data, error } = await cliente.auth.signUp({
  email,
  password: senha,
  options: {
    emailRedirectTo:
      "https://isabellagoetten-design.github.io/arquivo-investigativo/"
  }
});

  if (error) {
    mostrarMensagem("Erro ao criar conta: " + error.message);
    return;
  }

  if (data.session) {
    mostrarMensagem("Conta criada! Você já está conectada.");
  } else {
    mostrarMensagem(
      "Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar."
    );
  }

  await atualizarTela();
});

login.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarMensagem("Entrando na sua conta...");

  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value;

  const { error } = await cliente.auth.signInWithPassword({
    email,
    password: senha
  });

  if (error) {
    mostrarMensagem("Não foi possível entrar: " + error.message);
    return;
  }

  mostrarMensagem("Login realizado com sucesso!");
  await atualizarTela();
});

sair.addEventListener("click", async () => {
  mostrarMensagem("Saindo da conta...");

  const { error } = await cliente.auth.signOut();

  if (error) {
    mostrarMensagem("Erro ao sair: " + error.message);
    return;
  }

  mostrarMensagem("Você saiu da sua conta.");
  await atualizarTela();
});

cliente.auth.onAuthStateChange(() => {
  atualizarTela();
});

atualizarTela();

// Mantém o registro do modo offline
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
      console.log("Modo offline registrado!");
    } catch (error) {
      console.error("Erro no modo offline:", error);
    }
  });
}
