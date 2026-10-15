// Files stay in browser memory. Delivery happens only in the visitor's chosen
// application; wa.me and mailto links carry text, never attachments.
export function initExternalFiles() {
  const $ = (id) => document.getElementById(id),
    dialog = $("external-files-dialog"),
    input = $("external-files"),
    details = $("external-details"),
    name = $("external-name"),
    list = $("external-file-list"),
    links = $("external-contact-links"),
    share = $("external-share"),
    status = $("external-status");
  let files = [];
  const size = (n) =>
    n < 1024
      ? `${n} B`
      : n < 1024 * 1024
        ? `${(n / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`
        : `${(n / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  function message() {
    return `Olá, Papeled Maker! Tenho uma criação própria e gostaria de produzir.\n\n${name.value.trim() ? `Projeto: ${name.value.trim()}\n` : ""}Arquivos que vou anexar:\n${files.map((f) => `• ${f.name} (${size(f.size)})`).join("\n")}\n\n${details.value.trim() || "Quantidade, medidas e material: a combinar."}`;
  }
  function canShare() {
    try {
      return (
        files.length > 0 &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files })
      );
    } catch {
      return false;
    }
  }
  function update() {
    const text = message();
    links.hidden = !files.length;
    share.hidden = !canShare();
    $("external-whatsapp").href =
      "https://wa.me/5561992430051?text=" + encodeURIComponent(text);
    $("external-email").href =
      "mailto:papeledmaker@gmail.com?subject=" +
      encodeURIComponent(
        "Produzir criação própria" +
          (name.value.trim() ? " — " + name.value.trim() : ""),
      ) +
      "&body=" +
      encodeURIComponent(text);
  }
  function render() {
    list.replaceChildren();
    for (const [index, file] of files.entries()) {
      const row = document.createElement("li"),
        label = document.createElement("span"),
        remove = document.createElement("button");
      label.textContent = `${file.name} · ${size(file.size)}`;
      remove.type = "button";
      remove.className = "text-button";
      remove.textContent = "Remover";
      remove.setAttribute("aria-label", "Remover " + file.name);
      remove.onclick = () => {
        files.splice(index, 1);
        render();
      };
      row.append(label, remove);
      list.append(row);
    }
    status.textContent = files.length
      ? `${files.length} ${files.length === 1 ? "arquivo selecionado" : "arquivos selecionados"}. Ainda não enviado${files.length === 1 ? "" : "s"}.`
      : "Escolha um ou mais arquivos para começar.";
    update();
  }
  for (const button of document.querySelectorAll("[data-send-external]"))
    button.onclick = () => {
      render();
      dialog.showModal();
    };
  input.onchange = () => {
    if (input.files.length) {
      files = [...input.files];
      input.value = "";
      render();
    }
  };
  name.oninput = details.oninput = update;
  share.onclick = async () => {
    if (!files.length) return;
    const selected = [...files];
    share.disabled = true;
    try {
      await navigator.share({
        files: selected,
        title: name.value.trim() || "Minha criação — Papeled Maker",
        text: message(),
      });
      status.textContent =
        "Arquivo entregue ao aplicativo escolhido. Confira o contato Papeled Maker e confirme o envio.";
    } catch (error) {
      status.textContent =
        error.name === "AbortError"
          ? "Compartilhamento cancelado. Seus arquivos continuam selecionados."
          : "Não foi possível compartilhar. Abra o WhatsApp ou e-mail abaixo e anexe os arquivos na conversa.";
    } finally {
      share.disabled = false;
    }
  };
  for (const id of ["external-whatsapp", "external-email"])
    $(id).addEventListener("click", () => {
      status.textContent =
        "No aplicativo que abrir, anexe os arquivos selecionados antes de enviar a mensagem.";
    });
  dialog.addEventListener("close", () => {
    files = [];
    input.value = "";
    render();
  });
  render();
}
