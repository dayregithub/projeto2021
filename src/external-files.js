import {
  deliveryZip,
  deliveryEmail,
  downloadDelivery,
} from "./file-delivery.js";
// Files stay in browser memory. Delivery happens only in the visitor's chosen
// application; wa.me and mailto links carry text, never attachments.
export function initExternalFiles({ captureCustomer = async () => true } = {}) {
  const $ = (id) => document.getElementById(id),
    dialog = $("external-files-dialog"),
    input = $("external-files"),
    details = $("external-details"),
    name = $("external-name"),
    list = $("external-file-list"),
    links = $("external-contact-links"),
    share = $("external-share"),
    status = $("external-status");
  let files = [],
    contents = [],
    archive = null,
    generation = 0;
  const size = (n) =>
    n < 1024
      ? `${n} B`
      : n < 1024 * 1024
        ? `${(n / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`
        : `${(n / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  function message() {
    return `Olá, Papeled Maker! Tenho uma criação própria e gostaria de produzir.\n\n${name.value.trim() ? `Projeto: ${name.value.trim()}\n` : ""}Arquivos que vou anexar:\n${files.map((f) => `• ${f.name} (${size(f.size)})`).join("\n")}\n\n${details.value.trim() || "Quantidade, medidas e material: a combinar."}`;
  }
  function shareFiles() {
    if (canShare(files)) return files;
    if (archive && canShare([archive])) return [archive];
    return null;
  }
  function canShare(selected) {
    try {
      return (
        selected.length > 0 &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: selected })
      );
    } catch {
      return false;
    }
  }
  function update() {
    const text = message();
    links.hidden = !files.length;
    const selected = archive ? shareFiles() : null;
    share.hidden = !selected;
    share.disabled = !archive;
    $("external-download").disabled = $("external-email-file").disabled =
      !archive;
    $("external-delivery-note").textContent = !files.length
      ? ""
      : !archive
        ? "Preparando os anexos…"
        : selected
          ? "Envie com os anexos: toque no botão acima, escolha WhatsApp ou e-mail e selecione o contato Papeled Maker. Se o formato original não for aceito, enviamos um ZIP com os mesmos arquivos."
          : "Este navegador não permite levar anexos direto ao aplicativo. Baixe o ZIP para anexar no WhatsApp ou baixe o e-mail .eml, que já contém os arquivos.";
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
        prepare();
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
  async function prepare() {
    const version = ++generation,
      selected = [...files];
    archive = null;
    contents = [];
    update();
    if (!selected.length) return;
    try {
      const bytes = await Promise.all(
        selected.map(async (f) => new Uint8Array(await f.arrayBuffer())),
      );
      if (version !== generation) return;
      contents = bytes;
      archive = deliveryZip(selected, bytes);
      update();
    } catch {
      if (version === generation)
        status.textContent =
          "Não foi possível preparar os anexos. Selecione os arquivos novamente.";
    }
  }
  const captureExternal = () =>
    captureCustomer("export", {
      model: "external",
      name: name.value.trim() || "Criação própria",
      files: files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      })),
      details: details.value.trim(),
    });
  $("external-download").onclick = async () => {
    if (!archive || !(await captureExternal())) return;
    downloadDelivery(archive);
    status.textContent =
      "ZIP baixado com os arquivos. No WhatsApp ou e-mail, use o clipe para anexar o pacote antes de enviar.";
  };
  $("external-email-file").onclick = async () => {
    if (!archive || !(await captureExternal())) return;
    downloadDelivery(
      deliveryEmail(files, contents, {
        name: name.value.trim(),
        text: message(),
      }),
    );
    status.textContent =
      "E-mail baixado com os arquivos anexados. Abra o .eml em um aplicativo de e-mail compatível, revise e envie para papeledmaker@gmail.com.";
  };
  input.onchange = () => {
    if (input.files.length) {
      files = [...input.files];
      input.value = "";
      render();
      prepare();
    }
  };
  name.oninput = details.oninput = update;
  share.onclick = async () => {
    if (!files.length) return;
    const selected = shareFiles();
    if (!selected || !archive) return;
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
      share.disabled = !archive;
    }
  };
  for (const id of ["external-whatsapp", "external-email"])
    $(id).addEventListener("click", () => {
      status.textContent =
        "No aplicativo que abrir, anexe os arquivos selecionados antes de enviar a mensagem.";
    });
  dialog.addEventListener("close", () => {
    generation++;
    archive = null;
    contents = [];
    files = [];
    input.value = "";
    render();
  });
  render();
}
