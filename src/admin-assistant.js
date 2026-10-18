import {
  proposalsFrom,
  applyProposal,
  auditProducts,
} from "./assistant-actions.js";
export function initAdminAssistant({
  getState,
  reload,
  navigate,
  editProduct,
}) {
  const $ = (id) => document.getElementById(id);
  let history = [],
    generation = 0;
  const status = (text) => {
    $("assistant-status").textContent = text;
  };
  const clear = () => {
    $("assistant-proposals").replaceChildren();
    $("assistant-result").textContent = "";
  };
  function show(plan) {
    const { products, quotes } = getState();
    const proposals = proposalsFrom(plan, { products, quotes });
    $("assistant-result").textContent = plan.reply;
    history.push({ role: "assistant", text: plan.reply });
    history = history.slice(-8);
    for (const proposal of proposals) {
      const article = document.createElement("article");
      article.className = "card";
      const title = document.createElement("h3");
      title.textContent = proposal.label;
      article.append(title);
      const changes = document.createElement("dl");
      for (const change of proposal.changes) {
        const dt = document.createElement("dt"),
          dd = document.createElement("dd");
        dt.textContent = change.field;
        const display = (value) =>
          typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value);
        dd.textContent = `${display(change.from)} → ${display(change.to)}`;
        changes.append(dt, dd);
      }
      article.append(changes);
      const button = document.createElement("button");
      button.textContent =
        proposal.kind === "create_product"
          ? "Criar este rascunho"
          : proposal.kind === "navigate"
            ? "Abrir seção"
            : "Aplicar estas alterações";
      article.append(button);
      const result = document.createElement("p");
      result.setAttribute("role", "status");
      article.append(result);
      button.onclick = async () => {
        button.disabled = true;
        try {
          if (proposal.kind === "navigate") navigate(proposal.view);
          else {
            await applyProposal(proposal, getState());
            await reload();
          }
          result.textContent = "Alteração aplicada.";
          button.textContent = "Aplicado";
          if (
            proposal.kind === "create_product" ||
            proposal.kind === "update_product"
          ) {
            const edit = document.createElement("button");
            edit.textContent = "Abrir produto no formulário";
            edit.className = "secondary";
            edit.onclick = () => {
              navigate("products");
              editProduct(
                getState().products.find((p) => p.id === proposal.after.id) ||
                  proposal.after,
              );
            };
            article.append(edit);
          }
        } catch (error) {
          result.textContent = error.message;
          button.disabled = false;
        }
      };
      $("assistant-proposals").append(article);
    }
  }
  $("ask-assistant").onclick = async () => {
    const prompt = $("assistant-prompt").value.trim();
    if (!prompt) return;
    const { client, local } = getState();
    clear();
    if (local) {
      status(
        "A IA precisa da conexão Supabase e da função maker-assistant configurada com a chave no servidor. A prévia local não faz chamadas de IA. Você pode testar uma proposta local abaixo.",
      );
      return;
    }
    const job = ++generation;
    const button = $("ask-assistant");
    button.disabled = true;
    status("Analisando o contexto e preparando a resposta…");
    try {
      const { data, error } = await client.functions.invoke("maker-assistant", {
        body: {
          prompt,
          productId: $("assistant-product").value || null,
          history: history.slice(-4),
        },
      });
      if (job !== generation) return;
      if (error) throw error;
      history.push({ role: "user", text: prompt });
      if (data.version !== 2) {
        $("assistant-result").textContent =
          data.text || "A função precisa ser atualizada.";
        status(
          "Versão anterior do assistente. Atualize a função para habilitar propostas de ações.",
        );
        return;
      }
      try {
        show(data);
      } catch (validationError) {
        $("assistant-result").textContent = data.reply;
        history.push({
          role: "assistant",
          text: "Proposta rejeitada pela validação: " + validationError.message,
        });
        status(
          "Proposta não aplicada: " +
            validationError.message +
            " Peça um ajuste antes de continuar.",
        );
        return;
      }
      status(
        data.actions.length
          ? "Confira cada proposta e clique para aplicar somente as alterações desejadas."
          : "Resposta pronta. Você pode continuar a conversa.",
      );
    } catch (error) {
      if (job !== generation) return;
      let detail = "";
      try {
        const response = await error.context?.clone().json();
        if (response?.error === "Assistant not configured")
          detail = " Cadastre OPENAI_API_KEY nos Secrets do Supabase.";
      } catch {}
      status(
        "Assistente indisponível. Verifique a configuração da função maker-assistant." +
          detail,
      );
    } finally {
      if (job === generation) button.disabled = false;
    }
  };
  $("assistant-copy").onclick = async () => {
    const reply = $("assistant-result").textContent;
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      status("Resposta copiada.");
    } catch {
      status("Selecione e copie o texto da resposta.");
    }
  };
  $("assistant-health").onclick = async () => {
    const { client, local } = getState();
    if (local) {
      status(
        "A IA precisa da conexão Supabase. A prévia local permite testar propostas sem chamar a IA.",
      );
      return;
    }
    status("Verificando a função no Supabase…");
    try {
      const { data, error } = await client.functions.invoke("maker-assistant", {
        body: { mode: "health" },
      });
      if (error) throw error;
      status(
        data.version !== 2
          ? "A função precisa ser atualizada para a versão 2."
          : data.ready
            ? `Função versão 2 disponível. Modelo: ${data.model}.`
            : "A função está publicada, mas falta cadastrar OPENAI_API_KEY nos Secrets do Supabase.",
      );
    } catch {
      status(
        "Não foi possível verificar a função. Confira se maker-assistant foi publicada na versão atual e se seu usuário é administrador.",
      );
    }
  };
  $("assistant-audit").onclick = () => {
    const findings = auditProducts(getState().products);
    const container = $("assistant-audit-result");
    container.replaceChildren();
    const title = document.createElement("h3");
    title.textContent = "Revisão dos cadastros";
    container.append(title);
    if (!findings.length) {
      const p = document.createElement("p");
      p.textContent = "Nenhum problema encontrado nos cadastros atuais.";
      container.append(p);
      return;
    }
    for (const finding of findings) {
      const p = document.createElement("p");
      p.textContent = `${finding.title}: ${finding.message}`;
      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = "Usar como referência";
      button.onclick = () => {
        $("assistant-product").value = finding.id;
        $("assistant-prompt").value =
          `Revise o produto de referência e proponha uma correção para: ${finding.message}. Não invente endereços de fotos.`;
      };
      container.append(p, button);
    }
  };
  document.querySelectorAll("[data-assistant-prompt]").forEach(
    (button) =>
      (button.onclick = () => {
        $("assistant-prompt").value = button.dataset.assistantPrompt;
        $("assistant-prompt").focus();
      }),
  );
  $("assistant-new-chat").onclick = () => {
    generation++;
    history = [];
    clear();
    $("assistant-prompt").value = "";
    $("ask-assistant").disabled = false;
    status("Nova conversa.");
  };
  $("assistant-demo").onclick = () => {
    clear();
    show({
      reply:
        "Demonstração local, sem chamada de IA: esta proposta cria um rascunho de organizador 3D. Confira e aplique para experimentar.",
      actions: [
        {
          kind: "create_product",
          model: "printgrid",
          title: "Organizador 3D de bancada",
          description:
            "Quatro compartimentos para organizar pequenos acessórios na bancada.",
          settings_patch: [
            { key: "cols", value: 2 },
            { key: "rows", value: 2 },
            { key: "width", value: 120 },
            { key: "depth", value: 120 },
          ],
          published: false,
        },
      ],
    });
    status(
      "Esta é uma proposta de demonstração local, não uma resposta da IA.",
    );
  };
  return function refresh() {
    const state = getState(),
      value = $("assistant-product").value;
    $("assistant-product").replaceChildren(
      new Option("Catálogo geral", ""),
      ...state.products.map((p) => new Option(p.title, p.id)),
    );
    if (state.products.some((p) => p.id === value))
      $("assistant-product").value = value;
    $("assistant-demo").hidden = !state.local;
  };
}
