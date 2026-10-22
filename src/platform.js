import { setArchiveBackend } from "./download-archive.js";
import {
  connection,
  localMode,
  readLocal,
  writeLocal,
} from "./platform-data.js";
let client = null,
  local = false,
  enabled = false;
export function trackEvent(kind, model = "", format = "", product = null) {
  try {
    if (
      !enabled ||
      localStorage.getItem("papeled-metrics-consent") !== "yes" ||
      navigator.doNotTrack === "1"
    )
      return;
    const event = {
      kind,
      model_id: model,
      format,
      product_id: product,
      created_at: new Date().toISOString(),
    };
    if (local) {
      const data = readLocal();
      data.events.push(event);
      data.events = data.events.slice(-10000);
      writeLocal(data);
      return;
    }
    void client
      .rpc("record_site_event", {
        p_kind: kind,
        p_model: model,
        p_format: format,
        p_product: product,
      })
      .then(({ error }) => {
        if (error) console.warn("Estatística não registrada.");
      });
  } catch {
    /* Statistics must never block the configurator. */
  }
}
export async function initPlatform({ openProject }) {
  local = localMode();
  try {
    client = await connection();
  } catch {
    console.warn("Plataforma indisponível; configurador continua funcionando.");
  }
  if (client) local = false;
  enabled = !!client || local;
  if (!enabled) return;
  setArchiveBackend(client, local);
  const consent = document.getElementById("metrics-consent");
  if (
    !localStorage.getItem("papeled-metrics-consent") &&
    navigator.doNotTrack !== "1"
  )
    consent.hidden = false;
  document.getElementById("metrics-accept").onclick = () => {
    localStorage.setItem("papeled-metrics-consent", "yes");
    consent.hidden = true;
    trackEvent("page_view");
  };
  document.getElementById("metrics-decline").onclick = () => {
    localStorage.setItem("papeled-metrics-consent", "no");
    consent.hidden = true;
  };
  document.getElementById("metrics-preference").hidden = false;
  document.getElementById("metrics-preference").onclick = () => {
    consent.hidden = false;
  };
  trackEvent("page_view");
  window.addEventListener("papeled-file-download", (e) =>
    trackEvent("download", "external", e.detail),
  );
  const form = document.getElementById("platform-quote");
  form.hidden = false;
  form.querySelector("button").onclick = async () => {
    if (!form.reportValidity()) return;
    const status = document.getElementById("platform-quote-status"),
      button = form.querySelector("button");
    button.disabled = true;
    try {
      const q = {
        id: crypto.randomUUID(),
        customer_name: form.elements.customer.value.trim(),
        contact: form.elements.contact.value.trim() || "Não informado",
        message: form.elements.message.value.trim(),
        project: JSON.parse(form.dataset.project || "{}"),
        status: "new",
        created_at: new Date().toISOString(),
      };
      if (local) {
        const data = readLocal();
        data.quotes.unshift(q);
        writeLocal(data);
      } else {
        const { error } = await client.rpc("submit_quote", {
          p_id: q.id,
          p_name: q.customer_name,
          p_contact: q.contact,
          p_message: q.message,
          p_project: q.project,
        });
        if (error) throw error;
      }
      status.textContent = local
        ? "Solicitação salva apenas na prévia deste navegador."
        : "Solicitação recebida pelo estúdio. Você também pode conversar pelo WhatsApp.";
      form.reset();
    } catch {
      status.textContent =
        "Não foi possível registrar. Tente novamente ou envie pelo WhatsApp.";
    } finally {
      button.disabled = false;
    }
  };
  try {
    let products;
    if (local) products = readLocal().products.filter((p) => p.published);
    else {
      const result = await client
        .from("catalog_products")
        .select("*")
        .eq("published", true)
        .order("created_at");
      if (result.error) throw result.error;
      products = result.data;
    }
    const section = document.getElementById("managed-catalog"),
      grid = document.getElementById("managed-products");
    for (const p of products) {
      const article = document.createElement("article");
      article.className = "managed-card";
      const title = document.createElement("h3"),
        description = document.createElement("p"),
        button = document.createElement("button");
      title.textContent = p.title;
      description.textContent = p.description;
      button.textContent = "Personalizar produto";
      button.className = "button secondary";
      button.onclick = () => {
        try {
          openProject({ ...p.settings, name: p.title }, p.id);
        } catch {
          button.textContent = "Produto indisponível";
        }
      };
      if (p.image_url && /^https:\/\//.test(p.image_url)) {
        const image = document.createElement("img");
        image.src = p.image_url;
        image.alt = p.title;
        image.loading = "lazy";
        article.append(image);
      }
      article.append(title, description, button);
      grid.append(article);
    }
    section.hidden = !products.length;
  } catch {
    console.warn("Não foi possível carregar os produtos do painel.");
  }
}
