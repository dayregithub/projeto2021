import { connection, localMode } from "./platform-data.js";
export function initCustomerCapture() {
  const dialog = document.getElementById("customer-project-dialog"),
    form = dialog.querySelector("form"),
    status = dialog.querySelector('[role="status"]');
  let backend = null;
  // The SQL update enables capture atomically. Existing sites keep working until installed.
  const ready = (async () => {
    if (localMode()) return;
    const client = await connection();
    if (!client) return;
    const result = await client.rpc("customer_capture_enabled");
    if (
      (!result.error && result.data === true) ||
      (result.error && result.error.code !== "PGRST202")
    )
      backend = client;
  })();
  return async function capture(action, project) {
    await ready;
    if (!backend) return { id: null };
    let saved = {};
    try {
      saved = JSON.parse(
        sessionStorage.getItem("papeled-customer-contact") || "{}",
      );
    } catch {}
    for (const key of ["name", "phone", "email"])
      form.elements[key].value = saved[key] || "";
    status.textContent = "";
    dialog.showModal();
    return await new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        form.onsubmit = null;
        dialog.onclose = null;
        resolve(result);
      };
      dialog.onclose = () => finish(null);
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        const customer = {
          name: form.elements.name.value.trim(),
          phone: form.elements.phone.value.trim(),
          email: form.elements.email.value.trim(),
        };
        if (!customer.name) {
          status.textContent = "Informe seu nome.";
          return;
        }
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        status.textContent = "Salvando seus dados e o projeto…";
        const id = crypto.randomUUID();
        try {
          const result = await backend.rpc("register_customer_project", {
            p_id: id,
            p_name: customer.name,
            p_phone: customer.phone,
            p_email: customer.email,
            p_action: action,
            p_project: structuredClone(project),
          });
          if (result.error) throw result.error;
          sessionStorage.setItem(
            "papeled-customer-contact",
            JSON.stringify(customer),
          );
          finish({ id, ...customer });
          dialog.close();
        } catch {
          status.textContent =
            "Não foi possível registrar o projeto. Tente novamente; a ação ainda não foi concluída.";
        } finally {
          button.disabled = false;
        }
      };
    });
  };
}
export function initCustomerProjectsPanel({ getState, onQuote, onOpen }) {
  const list = document.getElementById("customer-project-list"),
    status = document.getElementById("customer-project-status");
  let rows = [];
  async function refresh() {
    const { client, local } = getState();
    list.replaceChildren();
    if (!client || local) {
      status.textContent =
        "Prévia local: os cadastros de clientes aparecem aqui após ativar o banco.";
      return;
    }
    try {
      const result = await client
        .from("customer_projects")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250);
      if (result.error) throw result.error;
      rows = result.data;
      status.textContent = `${rows.length} registros mais recentes. Dados privados do painel.`;
      for (const row of rows) {
        const card = document.createElement("article");
        card.className = "card";
        const title = document.createElement("h3");
        title.textContent = row.customer_name;
        card.append(title);
        const info = document.createElement("p");
        info.textContent = `${row.phone || "Telefone não informado"} · ${row.email || "E-mail não informado"} · ${{ save: "Salvar", export: "Exportar", quote: "Pedir orçamento" }[row.action]} · ${new Date(row.created_at).toLocaleString("pt-BR")}`;
        card.append(info);
        const project = document.createElement("p");
        project.textContent =
          row.project.model === "external"
            ? `${row.project.name} · ${row.project.files?.length || 0} arquivo(s) externo(s)`
            : `${row.project.name || row.project.model} · ${row.project.width} × ${row.project.depth} × ${row.project.height} mm`;
        card.append(project);
        const details = document.createElement("details"),
          summary = document.createElement("summary"),
          parameters = document.createElement("pre");
        summary.textContent = "Configuração completa do projeto";
        parameters.textContent = JSON.stringify(row.project, null, 2);
        parameters.style.whiteSpace = "pre-wrap";
        details.append(summary, parameters);
        card.append(details);
        const select = document.createElement("select");
        select.setAttribute("aria-label", "Situação de " + row.customer_name);
        for (const [value, label] of [
          ["new", "Novo"],
          ["contacted", "Em atendimento"],
          ["quoted", "Orçamento enviado"],
          ["done", "Concluído"],
          ["cancelled", "Cancelado"],
        ]) {
          const option = new Option(label, value);
          select.add(option);
        }
        select.value = row.status;
        select.onchange = async () => {
          const r = await client
            .from("customer_projects")
            .update({ status: select.value })
            .eq("id", row.id);
          if (r.error) {
            select.value = row.status;
            status.textContent = "Não foi possível atualizar a situação.";
          } else {
            row.status = select.value;
            status.textContent = "Situação atualizada.";
          }
        };
        card.append(select);
        for (const [label, handler] of [
          ["Abrir projeto", () => onOpen(row.project)],
          [
            "Preparar orçamento",
            () =>
              onQuote({
                customer_name: row.customer_name,
                contact: [row.phone, row.email].filter(Boolean).join(" · "),
                project: row.project,
                message: "",
                customerProjectId: row.id,
              }),
          ],
        ]) {
          const b = document.createElement("button");
          b.textContent = label;
          b.className = "secondary";
          if (row.project.model === "external" && label === "Abrir projeto") {
            b.disabled = true;
            b.textContent = "Veja arquivos e especificações acima";
          }
          b.onclick = () => {
            try {
              handler();
            } catch {
              status.textContent =
                "Não foi possível abrir este projeto. Confira os parâmetros registrados.";
            }
          };
          card.append(b);
        }
        list.append(card);
      }
    } catch {
      status.textContent =
        "Execute database-update.sql para ativar o cadastro e o histórico de projetos de clientes.";
    }
  }
  document.getElementById("customer-project-refresh").onclick = refresh;
  return { refresh };
}
