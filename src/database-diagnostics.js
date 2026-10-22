export const DATABASE_CHECKS = [
  ["products", "Produtos do site", ""],
  ["quotes", "Solicitações de clientes", ""],
  ["site_events", "Estatísticas", ""],
  ["download_files", "Registros dos arquivos baixados", ""],
  ["issued_quotes", "Orçamentos e pagamentos", "database-update.sql"],
  [
    "pricing_profiles",
    "Materiais, custos e marca da empresa",
    "database-update.sql",
  ],
  ["workspace_backups", "Cópias de trabalho", "database-update.sql"],
  [
    "customer_projects",
    "Projetos identificados de clientes",
    "database-update.sql",
  ],
  ["finance_expenses", "Despesas financeiras", "finance-update.sql"],
];
export function classifyDatabaseError(error) {
  const code = String(error?.code || "");
  if (["PGRST205", "42P01", "PGRST202", "42883"].includes(code))
    return {
      state: "missing",
      status: "Recurso não encontrado",
      detail:
        "A tabela ou função não foi encontrada no banco ou no cache da API.",
    };
  if (["42501", "P0001", "PGRST301", "PGRST302", "PGRST303"].includes(code))
    return {
      state: "permission",
      status: "Acesso não confirmado",
      detail:
        "Verifique o login de administrador e as permissões. Isso não comprova falta de instalação.",
    };
  return {
    state: "unknown",
    status: "Não foi possível verificar",
    detail:
      "Pode haver falha de rede, sessão ou indisponibilidade. Não reinstale tabelas por esse resultado.",
  };
}
function readWithDeadline(query) {
  let timer;
  return Promise.race([
    query,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(Error("Tempo de verificação excedido")),
        15000,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}
export async function checkDatabase(client) {
  const rows = await Promise.all(
    DATABASE_CHECKS.map(async ([table, label, script]) => {
      try {
        const result = await readWithDeadline(
          client.from(table).select("id").limit(0),
        );
        return {
          table,
          label,
          script,
          ...(result.error
            ? {
                ...classifyDatabaseError(result.error),
                code: String(result.error.code || ""),
              }
            : {
                state: "ok",
                status: "Leitura acessível",
                detail: "Tabela acessível nesta sessão. Gravação não testada.",
                code: "",
              }),
        };
      } catch (error) {
        return {
          table,
          label,
          script,
          ...classifyDatabaseError(error),
          code: String(error?.code || ""),
        };
      }
    }),
  );
  try {
    const result = await readWithDeadline(client.rpc("require_admin"));
    rows.unshift({
      label: "Permissão de administrador",
      table: "require_admin",
      script: "",
      ...(result.error
        ? {
            ...classifyDatabaseError(result.error),
            code: String(result.error.code || ""),
          }
        : result.data === true
          ? {
              state: "ok",
              status: "Administrador confirmado",
              detail: "Login autorizado para administrar o painel.",
              code: "",
            }
          : {
              state: "permission",
              status: "Administrador não confirmado",
              detail: "Entre com o usuário cadastrado como administrador.",
              code: "",
            }),
    });
  } catch (error) {
    rows.unshift({
      label: "Permissão de administrador",
      table: "require_admin",
      script: "",
      ...classifyDatabaseError(error),
      code: String(error?.code || ""),
    });
  }
  return rows;
}
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function initDatabaseDiagnostics({ getState }) {
  const $ = (id) => document.getElementById(id);
  let busy = false,
    report = "";
  async function run() {
    if (busy) return;
    const { client, local } = getState();
    if (!client || local) {
      $("database-check-summary").textContent =
        "Prévia local: não é possível avaliar seu banco nesta modalidade. Entre com seu login de administrador para verificar.";
      $("database-check-results").replaceChildren();
      $("database-check-copy").disabled = true;
      return;
    }
    busy = true;
    $("database-check-run").disabled = true;
    $("database-check-copy").disabled = true;
    $("database-check-summary").textContent =
      "Verificando acesso às tabelas com sua sessão. Nenhum registro será alterado…";
    try {
      const rows = await checkDatabase(client),
        missing = rows.filter((r) => r.state === "missing"),
        other = rows.filter((r) => !["ok", "missing"].includes(r.state));
      $("database-check-summary").textContent = missing.length
        ? `${missing.length} recurso(s) não localizado(s): verificar instalação ou cache da API.${other.length ? " Há também acessos que não puderam ser confirmados." : ""}`
        : other.length
          ? "A verificação está incompleta: há permissões ou conexões que precisam de atenção."
          : "Todas as tabelas verificadas estão acessíveis e seu acesso de administrador foi confirmado. O teste é de leitura; o salvamento de um orçamento deve retornar “Orçamento salvo no Supabase”.";
      $("database-check-results").innerHTML = rows
        .map(
          (r) =>
            `<article class="database-check-row"><div><strong>${escape(r.label)}</strong><p class="muted">${escape(r.detail)}${r.code ? ` Código: ${escape(r.code)}.` : ""}</p>${r.state === "missing" && r.script ? `<a href="./${r.script}" target="_blank" rel="noopener">Ver atualização ${escape(r.script)}</a>` : ""}</div><span class="database-check-state" data-state="${r.state}">${escape(r.status)}</span></article>`,
        )
        .join("");
      report = [
        "Diagnóstico de banco · Papeled Maker",
        new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        "Teste somente de leitura; não altera registros.",
        ...rows.map(
          (r) =>
            `${r.label}: ${r.status}${r.code ? ` (${r.code})` : ""}${r.state === "missing" && r.script ? ` · ${r.script}` : ""}`,
        ),
      ].join("\n");
      $("database-check-copy").disabled = false;
    } catch {
      $("database-check-summary").textContent =
        "Não foi possível concluir a verificação. Tente novamente; isso não confirma falta de instalação.";
    } finally {
      busy = false;
      $("database-check-run").disabled = false;
    }
  }
  $("database-check-run").onclick = run;
  $("database-check-copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(report);
      $("database-check-copy-status").textContent =
        "Diagnóstico copiado. Cole na conversa para avaliarmos as pendências.";
    } catch {
      $("database-check-copy-status").textContent =
        "Selecione e copie o texto abaixo.";
      $("database-check-report").hidden = false;
      $("database-check-report").value = report;
    }
  };
  return { run };
}
