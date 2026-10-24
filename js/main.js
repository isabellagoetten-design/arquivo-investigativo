console.log("Arquivo Investigativo carregado!");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        "../service-worker.js"
      );

      console.log(
        "Modo offline registrado!",
        registration.scope
      );
    } catch (error) {
      console.error(
        "Erro ao ativar o modo offline:",
        error
      );
    }
  });
}
