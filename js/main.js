console.log("Arquivo Investigativo carregado!");

const SUPABASE_URL = "https://hoqbkpjwlmkmdvuzinyi.supabase.co";
const SUPABASE_KEY = "sb_publishable_fuFitarIu9yHJ_QPsRUP-Q_xVGJMcbg";

const cliente = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const login = document.getElementById("form-login");
const cadastro = document.getElementById("form-cadastro");
const sair = document.getElementById("btn-sair");

const authForms = document.getElementById("auth-forms");
const accountState = document.getElementById("account-state");
const estado = document.getElementById("estado-conta");
const mensagem = document.getElementById("mensagem-conta");

const titulo = document.getElementById("form-title");
const descricao = document.getElementById("form-description");
const kicker = document.getElementById("form-kicker");

function mostrarMensagem(texto) {
  mensagem.textContent = texto;
}

function mostrarFormulario(tipo) {
  const modoCadastro = tipo === "cadastro";

  login.hidden = modoCadastro;
  cadastro.hidden = !modoCadastro;

  titulo.textContent = modoCadastro ? "Criar conta" : "Entrar";
  descricao.textContent = modoCadastro
    ? "Cadastre seu e-mail e crie uma senha."
    : "Acesse sua conta.";
  kicker.textContent = modoCadastro ? "NOVO CADASTRO" : "ÁREA PESSOAL";

  mostrarMensagem("");
}

async function atualizarTela() {
  const { data, error } = await cliente.auth.getSession();

  if (error) {
    mostrarMensagem("Erro ao verificar a sessão: " + error.message);
    return;
  }

  const usuario = data.session?.user;

  if (usuario) {
    window.location.replace("./inicio.html");
    return;
    authForms.hidden = true;
    accountState.hidden = false;
    estado.textContent = "Você está conectada: " + usuario.email;
  } else {
    authForms.hidden = false;
    accountState.hidden = true;
    mostrarFormulario("login");
  }
}

// Alternar entre login e cadastro
document.getElementById("btn-ir-cadastro").addEventListener("click", () => {
  mostrarFormulario("cadastro");
});

document.getElementById("btn-ir-login").addEventListener("click", () => {
  mostrarFormulario("login");
});

// Mostrar ou ocultar senha
document.querySelectorAll(".password-toggle").forEach((botao) => {
  botao.addEventListener("click", () => {
    const campo = document.getElementById(botao.dataset.target);
    const mostrar = campo.type === "password";

    campo.type = mostrar ? "text" : "password";
    botao.setAttribute("aria-pressed", String(mostrar));
    botao.setAttribute(
      "aria-label",
      mostrar ? "Ocultar senha" : "Mostrar senha"
    );
  });
});

// Criar conta
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
      "Cadastro iniciado. Confira seu e-mail para confirmar a conta."
    );
  }

  await atualizarTela();
});

// Entrar
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

// Recuperar senha
document.getElementById("btn-recuperar").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();

  if (!email) {
    mostrarMensagem("Digite seu e-mail no campo acima para receber o link de recuperação.");
    document.getElementById("login-email").focus();
    return;
  }

  mostrarMensagem("Enviando instruções de recuperação...");

  const { error } = await cliente.auth.resetPasswordForEmail(email, {
    redirectTo:
      "https://isabellagoetten-design.github.io/arquivo-investigativo/"
  });

  if (error) {
    mostrarMensagem("Não foi possível enviar o e-mail: " + error.message);
    return;
  }

  mostrarMensagem("Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.");
});

// Sair da conta
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

// Atualizar a tela quando a sessão mudar
cliente.auth.onAuthStateChange((evento, sessao) => {
  if (evento === "INITIAL_SESSION") return;

  if (sessao?.user) {
    window.location.replace("./inicio.html");
    return;
    authForms.hidden = true;
    accountState.hidden = false;
    estado.textContent = "Você está conectada: " + sessao.user.email;
  } else {
    authForms.hidden = false;
    accountState.hidden = true;
    mostrarFormulario("login");
  }
});

atualizarTela();

// Registrar o modo offline, se houver suporte
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
