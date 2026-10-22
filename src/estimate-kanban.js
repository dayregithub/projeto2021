import { brl, calculateEstimate, localDate } from "./estimate-calculations.js";
export const ESTIMATE_STAGES = [
  ["draft", "Orçamento"],
  ["approved", "Aprovados"],
  ["in_progress", "Em execução"],
  ["completed", "Concluídos"],
  ["delivered", "Entregues"],
];
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function renderEstimateKanban(
  root,
  records,
  onChange,
  message,
  onConfirmCancel,
) {
  const stage = (q) =>
    ["sent", "rejected", "cancelled"].includes(q.status) ? "draft" : q.status;
  const expanded = new Set(
    [...root.querySelectorAll("[data-estimate-card]")]
      .filter((card) => card.querySelector("details")?.open)
      .map((card) => card.dataset.estimateCard),
  );
  root.innerHTML = `<div class="estimate-kanban">${ESTIMATE_STAGES.map(
    ([value, label]) => {
      const group = records.filter((q) => !q.archivedAt && stage(q) === value);
      return `<section class="estimate-column" data-stage="${value}" aria-label="${label}"><h3>${label} (${group.length})</h3>${
        group
          .map((q) => {
            let total;
            try {
              total = brl(calculateEstimate(q).total);
            } catch {
              total = "Revisar cálculos";
            }
            return `<article class="card" draggable="true" data-estimate-card="${esc(q.id)}"><h4>${esc(q.customer || "Cliente não informado")}</h4><p class="kanban-project-name">${esc(q.title || q.items?.[0]?.description || "Projeto sem nome")}</p><details ${expanded.has(q.id) ? "open" : ""}><summary>Detalhes e acompanhamento</summary><p>${esc(q.number)} · ${total}${q.status === "rejected" ? " · Não aprovado" : q.status === "cancelled" ? " · Cancelado" : ""}</p><label>Etapa<select data-stage-change="${esc(q.id)}">${ESTIMATE_STAGES.map(([v, l]) => `<option value="${v}" ${v === stage(q) ? "selected" : ""}>${l}</option>`).join("")}</select></label><label>Pagamento<select data-payment-change="${esc(q.id)}"><option value="pending" ${q.paymentStatus !== "paid" ? "selected" : ""}>Pendente</option><option value="paid" ${q.paymentStatus === "paid" ? "selected" : ""}>Realizado</option></select></label><label>Data do pagamento<input data-payment-date="${esc(q.id)}" type="date" value="${esc(q.paymentDate || "")}"></label><div class="kanban-archive-actions"><button class="secondary" data-archive-completed="${esc(q.id)}">Arquivar como concluído</button><button class="secondary" data-archive-cancelled="${esc(q.id)}">Arquivar como cancelado</button></div><div class="actions"><button class="secondary" data-open-estimate="${esc(q.id)}">Abrir</button><button class="secondary" data-open-folder="${esc(q.id)}">Abrir pasta</button><button class="secondary" data-clone-estimate="${esc(q.id)}">Duplicar</button></div></details></article>`;
          })
          .join("") || '<p class="muted">Nenhum orçamento nesta etapa.</p>'
      }</section>`;
    },
  ).join("")}</div>`;
  const apply = async (id, changes) => {
    try {
      await onChange(id, changes);
    } catch (error) {
      message(error.message);
      const previous = records.find((row) => row.id === id);
      if (previous) {
        const stageSelect = root.querySelector(`[data-stage-change="${id}"]`),
          paymentSelect = root.querySelector(`[data-payment-change="${id}"]`),
          dateInput = root.querySelector(`[data-payment-date="${id}"]`);
        if (stageSelect) stageSelect.value = stage(previous);
        if (paymentSelect)
          paymentSelect.value = previous.paymentStatus || "pending";
        if (dateInput) dateInput.value = previous.paymentDate || "";
      }
    }
  };
  root
    .querySelectorAll("[data-stage-change]")
    .forEach(
      (s) =>
        (s.onchange = () => apply(s.dataset.stageChange, { status: s.value })),
    );
  root.querySelectorAll("[data-payment-change]").forEach(
    (s) =>
      (s.onchange = () =>
        apply(s.dataset.paymentChange, {
          paymentStatus: s.value,
          paymentDate: s.value === "paid" ? localDate() : "",
        })),
  );
  root.querySelectorAll("[data-payment-date]").forEach(
    (s) =>
      (s.onchange = () =>
        apply(s.dataset.paymentDate, {
          paymentDate: s.value,
          paymentStatus: s.value ? "paid" : "pending",
        })),
  );
  for (const [attribute, status] of [
    ["archiveCompleted", "completed"],
    ["archiveCancelled", "cancelled"],
  ]) {
    const selector =
      attribute === "archiveCompleted"
        ? "[data-archive-completed]"
        : "[data-archive-cancelled]";
    root.querySelectorAll(selector).forEach(
      (button) =>
        (button.onclick = () =>
          status === "cancelled" && onConfirmCancel
            ? onConfirmCancel(button.dataset[attribute])
            : apply(button.dataset[attribute], {
                status,
                archivedAt: new Date().toISOString(),
                archiveReason: status,
              })),
    );
  }
  root.querySelectorAll("[data-estimate-card]").forEach(
    (card) =>
      (card.ondragstart = (e) => {
        if (e.target.closest("input,select,button")) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("text/plain", card.dataset.estimateCard);
      }),
  );
  root.querySelectorAll("[data-stage]").forEach((column) => {
    column.ondragover = (e) => {
      e.preventDefault();
    };
    column.ondrop = (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      if (records.some((q) => q.id === id))
        void apply(id, { status: column.dataset.stage });
    };
  });
}
