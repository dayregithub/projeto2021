import {
  MODELS,
  defaults,
  modelById,
  supportsGrid,
  compartmentCount,
  cuts,
  validate,
  panels,
  drawerDimensions,
  exportSVG,
  exportDXF,
  exportSTL,
  readProject,
} from "./src/geometry.js";
import {
  previewSVG,
  cutPreviewSVG,
  FINISHES,
  escapeHTML as esc,
} from "./src/preview.js";
import { icon, mountIcons } from "./src/icons.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const storageKey = "papeled-projects-v1",
  draftKey = "papeled-draft-v1";
let state = defaults(),
  savedId = null,
  filter = "all",
  angle = 35,
  exploded = false,
  view = "3d",
  opened = 0.35,
  toastTimer,
  saveTimer,
  storageWarning = false;
const fmt = (n) => Number(n.toFixed(1)).toLocaleString("pt-BR");
const uuid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 4500);
}
function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    if (!storageWarning) {
      toast(
        "O navegador não permitiu salvar. Exporte o projeto em JSON para guardar uma cópia.",
      );
      storageWarning = true;
    }
    return false;
  }
}
function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function getSaved() {
  const values = load(storageKey, []);
  return Array.isArray(values)
    ? values.filter((p) => {
        try {
          readProject(p.project);
          return (
            typeof p.id === "string" &&
            /^[a-zA-Z0-9-]+$/.test(p.id) &&
            typeof p.updated === "string" &&
            !Number.isNaN(Date.parse(p.updated))
          );
        } catch {
          return false;
        }
      })
    : [];
}
function updateSavedCount() {
  $("#saved-count").textContent = getSaved().length;
}
function card(m) {
  const d = defaults(m.id);
  return `<button class="model-card" data-model="${m.id}"><div class="model-image ${m.category === "print" ? "print-image" : ""}"><span class="model-badge">${m.tag}</span>${previewSVG(d, { opened: 0.25 })}<span class="card-open">${icon("arrow-up-right")}</span></div><div class="model-card-info"><h3>${m.name}</h3><p>${m.description}</p><span class="process-chip">${icon(m.category === "print" ? "box" : "sparkles")}${m.category === "print" ? "Impressão 3D" : "Corte a laser"}<span>·</span>${m.category === "print" ? "STL" : "SVG / DXF"}</span></div></button>`;
}
function renderCatalog() {
  const term = $("#search")
    .value.trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const found = MODELS.filter(
    (m) =>
      (filter === "all" || m.category === filter) &&
      (m.name + " " + m.description)
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(term),
  );
  $("#model-count").textContent =
    `${found.length} ${found.length === 1 ? "modelo disponível" : "modelos disponíveis"}`;
  $("#model-grid").innerHTML = found.length
    ? found.map(card).join("")
    : `<div class="empty-state">${icon("search")}<h3>Nenhum modelo por aqui.</h3><p>Tente outro nome ou limpe os filtros.</p><button class="button secondary" id="clear-search">Limpar busca</button></div>`;
  $$("[data-model]").forEach(
    (b) => (b.onclick = () => openModel(b.dataset.model)),
  );
  $("#clear-search")?.addEventListener("click", () => {
    $("#search").value = "";
    setFilter("all");
  });
  const draft = load(draftKey, null);
  let valid = false;
  try {
    if (draft) {
      readProject(draft);
      valid = true;
    }
  } catch {}
  $("#resume-banner").hidden = !valid;
  if (valid) {
    $("#resume-banner").innerHTML =
      `<span>${icon("clock")} Continuar criando <strong>${esc(draft.name)}</strong></span><button class="text-button" id="resume-draft">Retomar rascunho ${icon("arrow-right")}</button>`;
    $("#resume-draft").onclick = () =>
      openProject(readProject(draft), draft.savedId || null);
  }
}
function setFilter(value) {
  filter = value;
  $$("[data-filter]").forEach((b) => {
    const active = b.dataset.filter === value;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", active);
  });
  renderCatalog();
}
function openModel(id) {
  openProject(defaults(id));
}
function openProject(project, id = null) {
  clearTimeout(saveTimer);
  state = { ...project };
  savedId = id;
  angle = 35;
  view = "3d";
  exploded = false;
  opened = 0.35;
  $("#drawer-open").value = 35;
  syncFields();
  location.hash = "editor";
  showView("editor");
  window.scrollTo({ top: 0, behavior: "instant" });
}
function showView(route) {
  $("#catalog-view").hidden = route !== "modelos";
  $("#editor-view").hidden = route !== "editor";
  $("#saved-view").hidden = route !== "projetos";
  $$("[data-nav]").forEach((a) =>
    a.classList.toggle("active", a.dataset.nav === route),
  );
  if (route === "modelos") renderCatalog();
  if (route === "projetos") renderSaved();
  if (route === "editor") renderEditor();
  updateSavedCount();
}
function route() {
  let name = location.hash.slice(1);
  if (!["modelos", "editor", "projetos"].includes(name)) name = "modelos";
  showView(name);
}
function syncFields() {
  for (const k of [
    "width",
    "depth",
    "height",
    "thickness",
    "cols",
    "rows",
    "ratio",
    "clearance",
  ])
    $("#" + k).value = state[k];
  $("#project-name").value = state.name;
  $("#finish-name").textContent = FINISHES[state.finish].label;
  $("#finishes").innerHTML = Object.entries(FINISHES)
    .map(
      ([key, v]) =>
        `<button class="finish ${state.finish === key ? "selected" : ""}" style="--finish:${v.color}" data-finish="${key}" aria-label="${v.label}" aria-pressed="${state.finish === key}">${state.finish === key ? icon("check") : ""}</button>`,
    )
    .join("");
  $$("[data-finish]").forEach(
    (b) =>
      (b.onclick = () => {
        state.finish = b.dataset.finish;
        syncFields();
        renderEditor();
        persistDraft();
      }),
  );
}
function persistDraft() {
  clearTimeout(saveTimer);
  if (validate(state).length || !state.name.trim()) return;
  const snapshot = { ...state, savedId };
  saveTimer = setTimeout(() => store(draftKey, snapshot), 350);
}
function renderEditor() {
  const model = modelById(state.model),
    isPrint = model.category === "print",
    errors = validate(state),
    valid = !errors.length,
    parts = valid ? panels(state) : [];
  $("#editor-model-title").textContent = model.name;
  $("#canvas-process").textContent = isPrint ? "IMPRESSÃO 3D" : "CORTE A LASER";
  $("#division-fields").hidden = !supportsGrid(state);
  $("#no-divisions").hidden =
    supportsGrid(state) || ["lid", "bin"].includes(state.model);
  $("#cols-label").hidden = state.model === "custom";
  $("#ratio-label").hidden = state.model !== "custom";
  $("#rows-title").textContent =
    state.model === "custom" ? "Linhas à direita" : "Linhas";
  $("#ratio-value").textContent = state.ratio + "%";
  $("#drawer-open-label").hidden = state.model !== "drawers";
  $("#clearance-label").hidden = !["drawers", "lid"].includes(state.model);
  $("#material-hint").textContent = isPrint
    ? "Espessura aplicada às paredes, divisórias e fundo. Cor apenas ilustrativa."
    : "Use a espessura real da chapa. Cor apenas ilustrativa.";
  $("#finish-name").textContent = FINISHES[state.finish].label;
  if (supportsGrid(state) && valid) {
    if (state.model === "drawers") {
      const g = drawerDimensions(state);
      $("#compartment-info").textContent =
        `${state.rows * state.cols} gavetas · interior útil de cada uma: ${fmt(g.dw - 2 * state.thickness)} × ${fmt(g.dd - 2 * state.thickness)} × ${fmt(g.dh - state.thickness)} mm.`;
    } else {
      const c = cuts(state);
      $("#compartment-info").textContent =
        state.model === "custom"
          ? `${1 + state.rows} compartimentos · vão esquerdo de ${fmt(c.widths[0])} × ${fmt(state.depth - 2 * state.thickness)} mm e ${state.rows} vãos à direita de ${fmt(c.widths[1])} × ${fmt(c.depths[0])} mm.`
          : `${state.cols * state.rows} compartimentos · vãos de ${c.widths.map(fmt).join(" / ")} × ${fmt(c.depths[0])} mm.`;
    }
  }
  $("#validation").hidden = valid;
  $("#validation").textContent = errors.join(" ");
  $("#export-project").disabled = !valid || !state.name.trim();
  $("#save-project").disabled = !valid || !state.name.trim();
  $("#quote-project").disabled = !valid;
  $("#explode").hidden = isPrint || view === "2d";
  $("#explode").classList.toggle("selected", exploded);
  $$("[data-view]").forEach((b) => {
    b.disabled = isPrint && b.dataset.view === "2d";
    b.classList.toggle("active", b.dataset.view === view);
    b.setAttribute("aria-pressed", b.dataset.view === view);
  });
  if (isPrint) view = "3d";
  $("#preview").classList.toggle("flat-view", view === "2d");
  $("#canvas-hint").innerHTML =
    view === "2d"
      ? `${icon("layout")} Numeração corresponde à lista de peças`
      : `${icon("move")} Arraste para girar`;
  $(".camera-controls").hidden = view === "2d";
  $("#preview").innerHTML = valid
    ? view === "2d"
      ? cutPreviewSVG(state)
      : previewSVG(state, { angle, exploded, opened, dimensions: true })
    : `<div class="invalid-preview">${icon("ruler")}<h3>Vamos ajustar essas medidas?</h3><p>Confira os campos ao lado para continuar.</p></div>`;
  $("#preview").setAttribute(
    "aria-label",
    `Prévia ${view === "2d" ? "das peças" : "da montagem"}: ${state.name}, ${state.width} por ${state.depth} por ${state.height} milímetros`,
  );
  const cells = compartmentCount(state);
  $("#project-stats").innerHTML =
    `<div>${icon("ruler")}<span><strong>${state.width} × ${state.depth} × ${state.height}</strong><small>dimensões externas · mm</small></span></div><div>${icon("layers")}<span><strong>${isPrint ? "Peça única" : parts.length + " peças"}</strong><small>${isPrint ? "impressão em um sólido" : "para corte e montagem"}</small></span></div><div>${icon("grid")}<span><strong>${cells} ${state.model === "drawers" ? "gavetas" : cells === 1 ? "espaço" : "compartimentos"}</strong><small>organização do seu jeito</small></span></div>`;
  $("#assembly-title").textContent = isPrint
    ? "Peça única, pronta para o fatiador."
    : state.model === "custom"
      ? "Divisórias assimétricas com montagem por colagem."
      : state.model === "grid"
        ? "Montagem por colagem. Divisórias com meio encaixe."
        : "Painéis com montagem por colagem.";
  $("#assembly-text").textContent = isPrint
    ? "STL em milímetros, com fundo fechado. Confira a área útil da sua impressora e as configurações de impressão antes de produzir."
    : "SVG e DXF em milímetros, sem compensação de kerf. Confira a espessura real e teste os encaixes antes de cortar. Tampa e gavetas usam a folga informada.";
  if (!valid) {
    $("#summary-metrics").innerHTML =
      '<p class="field-hint">Ajuste as medidas para calcular o projeto.</p>';
    $("#parts-list").innerHTML = "";
    $("#part-count").textContent = "";
    return;
  }
  const iw = state.width - 2 * state.thickness,
    id = state.depth - 2 * state.thickness,
    ih = state.height - state.thickness;
  const area = parts.reduce((sum, p) => sum + p.width * p.height, 0) / 1e6;
  $("#summary-metrics").innerHTML =
    `<dl><div><dt>Fabricação</dt><dd>${isPrint ? "Impressão 3D" : "Corte a laser"}</dd></div><div><dt>Espessura</dt><dd>${fmt(state.thickness)} mm</dd></div>${state.model === "drawers" ? `<div><dt>Folga por lado</dt><dd>${fmt(state.clearance)} mm</dd></div>` : `<div><dt>Interior útil</dt><dd>${fmt(iw)} × ${fmt(id)} × ${fmt(ih)} mm</dd></div>`}${isPrint ? "" : `<div><dt>Área das peças</dt><dd>${area.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} m²</dd></div>`}</dl>`;
  $("#parts-title").textContent = isPrint
    ? "Sobre o arquivo"
    : "Lista de peças";
  $("#part-count").textContent = isPrint ? "STL" : parts.length;
  $("#parts-list").innerHTML = isPrint
    ? `<li class="print-summary">${icon("box")}<strong>Um único sólido fechado</strong><p>Fundo, paredes${state.model === "printgrid" ? " e divisórias integradas" : ""}. Abra o STL no seu fatiador para estimar tempo e material.</p><small>Medidas do arquivo: ${state.width} × ${state.depth} × ${state.height} mm.</small></li>`
    : parts
        .map(
          (p, i) =>
            `<li><span class="part-index">${i + 1}</span><div><strong>${esc(p.name)}</strong><small>${fmt(p.width)} × ${fmt(p.height)} mm</small></div><span>1×</span></li>`,
        )
        .join("");
}
function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function filename() {
  return (
    state.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "papeled-projeto"
  );
}
function exportDialog() {
  if (validate(state).length) return;
  const isPrint = modelById(state.model).category === "print";
  const options = isPrint
    ? [["stl", "STL", "Leve o sólido 3D para seu fatiador.", "box"]]
    : [
        ["svg", "SVG", "Contornos vetoriais na escala real, em mm.", "layout"],
        [
          "dxf",
          "DXF",
          "Polilinhas e círculos para software de corte.",
          "ruler",
        ],
      ];
  options.push([
    "json",
    "Projeto Papeled",
    "Guarde as medidas e continue criando depois.",
    "file",
  ]);
  $("#export-options").innerHTML = options
    .map(
      ([format, label, desc, img]) =>
        `<button class="export-option" data-export="${format}">${icon(img)}<span><strong>${label}</strong><small>${desc}</small></span><span class="extension">.${format}</span>${icon("download")}</button>`,
    )
    .join("");
  $("#export-note").textContent = isPrint
    ? "STL usa milímetros por convenção. Selecione mm ao importar e confirme a escala e a área da sua impressora."
    : "Montagem por colagem; sem encaixes dentados ou compensação de kerf. As ranhuras das divisórias usam a espessura exata informada. Faça uma amostra antes da produção. A disposição das peças não é um aproveitamento otimizado de chapa.";
  $$("[data-export]").forEach(
    (b) =>
      (b.onclick = () => {
        try {
          const kind = b.dataset.export,
            name = filename();
          if (kind === "svg")
            download(exportSVG(state), name + ".svg", "image/svg+xml");
          if (kind === "dxf")
            download(exportDXF(state), name + ".dxf", "application/dxf");
          if (kind === "stl")
            download(exportSTL(state), name + ".stl", "model/stl");
          if (kind === "json")
            download(
              JSON.stringify(state, null, 2),
              name + ".papeled.json",
              "application/json",
            );
          toast("Arquivo preparado. Confira os downloads do navegador.");
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  $("#export-dialog").showModal();
}
function saveProject() {
  if (validate(state).length || !state.name.trim()) return;
  const all = getSaved(),
    id = savedId || uuid(),
    entry = {
      id,
      project: { ...state, name: state.name.trim() },
      updated: new Date().toISOString(),
    };
  const idx = all.findIndex((p) => p.id === id);
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  if (store(storageKey, all)) {
    savedId = id;
    persistDraft();
    updateSavedCount();
    toast("Projeto salvo neste navegador. Sua ideia tem um lugar por aqui.");
  }
}
function renderSaved() {
  const all = getSaved();
  $("#saved-grid").innerHTML = all.length
    ? all
        .map(
          (p) =>
            `<article class="model-card saved-card"><button class="saved-open" data-saved="${p.id}"><div class="model-image">${previewSVG(p.project)}<span class="card-open">${icon("arrow-up-right")}</span></div><div class="model-card-info"><h3>${esc(p.project.name)}</h3><p>${modelById(p.project.model).name} · ${p.project.width} × ${p.project.depth} × ${p.project.height} mm</p><span class="saved-date">Salvo em ${new Date(p.updated).toLocaleDateString("pt-BR")}</span></div></button><button class="icon-button delete-project" data-delete="${p.id}" aria-label="Excluir ${esc(p.project.name)}">${icon("trash")}</button></article>`,
        )
        .join("")
    : `<div class="empty-state">${icon("folder")}<h2>Suas próximas ideias moram aqui.</h2><p>Crie um projeto e clique em “Salvar projeto”.<br>Ele ficará disponível neste navegador.</p><button class="button primary" id="empty-new">Explorar modelos ${icon("arrow-right")}</button></div>`;
  $$("[data-saved]").forEach(
    (b) =>
      (b.onclick = () => {
        const p = getSaved().find((p) => p.id === b.dataset.saved);
        if (p) openProject(p.project, p.id);
      }),
  );
  $$("[data-delete]").forEach(
    (b) =>
      (b.onclick = () =>
        confirmAction(
          "Excluir este projeto?",
          "O arquivo salvo neste navegador será removido. As cópias exportadas continuam com você.",
          () => {
            store(
              storageKey,
              getSaved().filter((p) => p.id !== b.dataset.delete),
            );
            if (savedId === b.dataset.delete) savedId = null;
            renderSaved();
            updateSavedCount();
            toast("Projeto removido.");
          },
        )),
  );
  $("#empty-new")?.addEventListener("click", () => (location.hash = "modelos"));
}
function confirmAction(title, message, action) {
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;
  $("#confirm-ok").onclick = () => {
    $("#confirm-dialog").close();
    action();
  };
  $("#confirm-dialog").showModal();
}
function updateQuote() {
  const message = $("#quote-message").value;
  $("#quote-whatsapp").href =
    "https://wa.me/5561992430051?text=" + encodeURIComponent(message);
  $("#quote-email").href =
    "mailto:papeledmaker@gmail.com?subject=" +
    encodeURIComponent("Projeto Papeled Maker — " + state.name) +
    "&body=" +
    encodeURIComponent(message);
}
$("#quote-project").onclick = () => {
  const m = modelById(state.model);
  $("#quote-message").value =
    `Olá, Papeled Maker! Quero um orçamento para este projeto:\n\n${state.name}\nModelo: ${m.name}\nMedidas externas: ${state.width} × ${state.depth} × ${state.height} mm\nEspessura: ${state.thickness} mm\n${supportsGrid(state) ? `${state.cols} colunas × ${state.rows} linhas\n` : ""}${state.model === "custom" ? `Primeiro compartimento: ${state.ratio}%\n` : ""}${["drawers", "lid"].includes(state.model) ? `Folga: ${state.clearance} mm por lado\n` : ""}Fabricação: ${m.category === "print" ? "Impressão 3D" : "Corte a laser — montagem por colagem"}\nReferência de cor: ${FINISHES[state.finish].label}\n\nQuantidade: \nComo vou usar: `;
  updateQuote();
  $("#quote-dialog").showModal();
};
$("#quote-message").oninput = updateQuote;
for (const key of [
  "width",
  "depth",
  "height",
  "thickness",
  "cols",
  "rows",
  "ratio",
  "clearance",
])
  $("#" + key).addEventListener("input", (e) => {
    state[key] = e.target.value === "" ? NaN : Number(e.target.value);
    renderEditor();
    persistDraft();
  });
$("#project-name").oninput = (e) => {
  state.name = e.target.value;
  $("#save-project").disabled = !!validate(state).length || !state.name.trim();
  $("#export-project").disabled = $("#save-project").disabled;
  persistDraft();
};
$("#drawer-open").oninput = (e) => {
  opened = Number(e.target.value) / 100;
  $("#drawer-open-value").textContent = e.target.value + "%";
  renderEditor();
};
$("#add-dividers").onclick = () => {
  state.model = state.model === "print" ? "printgrid" : "grid";
  state.cols = 2;
  state.rows = 2;
  if (state.name === modelById(state.model === "grid" ? "open" : "print").name)
    state.name = modelById(state.model).name;
  syncFields();
  renderEditor();
  persistDraft();
};
$("#reset-project").onclick = () =>
  confirmAction(
    "Restaurar este modelo?",
    "As medidas e divisões do rascunho voltarão ao padrão. Os projetos já salvos não serão alterados.",
    () => {
      const id = savedId;
      openProject(defaults(state.model), id);
      persistDraft();
      toast("Medidas restauradas.");
    },
  );
$("#save-project").onclick = saveProject;
$("#export-project").onclick = exportDialog;
$("#back-models").onclick = () => (location.hash = "modelos");
$("#new-project").onclick = () => (location.hash = "modelos");
$("#start-project").onclick = () => openModel("grid");
$("#how-button").onclick = () => $("#help-dialog").showModal();
$("#confirm-cancel").onclick = () => $("#confirm-dialog").close();
$$("[data-filter]").forEach(
  (b) => (b.onclick = () => setFilter(b.dataset.filter)),
);
$("#search").oninput = renderCatalog;
$$("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      view = b.dataset.view;
      renderEditor();
    }),
);
$("#explode").onclick = () => {
  exploded = !exploded;
  renderEditor();
};
$("#rotate-left").onclick = () => {
  angle -= 25;
  renderEditor();
};
$("#rotate-right").onclick = () => {
  angle += 25;
  renderEditor();
};
$("#camera-reset").onclick = () => {
  angle = 35;
  exploded = false;
  renderEditor();
};
let drag = null;
$("#preview").onpointerdown = (e) => {
  if (view !== "3d" || e.button !== 0) return;
  drag = { x: e.clientX, start: angle };
  $("#preview").setPointerCapture(e.pointerId);
  $("#preview").classList.add("dragging");
};
$("#preview").onpointermove = (e) => {
  if (!drag) return;
  angle = drag.start + (e.clientX - drag.x) * 0.5;
  if (!validate(state).length)
    $("#preview").innerHTML = previewSVG(state, {
      angle,
      exploded,
      opened,
      dimensions: true,
    });
};
$("#preview").onpointerup = $("#preview").onpointercancel = () => {
  drag = null;
  $("#preview").classList.remove("dragging");
};
$("#import-button").onclick = () => $("#project-file").click();
$("#project-file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 100000)
      throw Error(
        "Esse arquivo é grande demais. Abra um projeto .papeled.json de até 100 KB.",
      );
    const project = readProject(await file.text());
    openProject(project);
    persistDraft();
    toast("Projeto aberto. Pode continuar criando!");
  } catch (e) {
    toast(
      e instanceof SyntaxError
        ? "Não foi possível ler o arquivo. Use um projeto .papeled.json válido."
        : e.message,
    );
  } finally {
    e.target.value = "";
  }
};
$$("[data-close]").forEach(
  (b) => (b.onclick = () => b.closest("dialog").close()),
);
$$("dialog").forEach(
  (d) =>
    (d.onclick = (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          d.close();
      }
    }),
);
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) &&
    !$("dialog[open]") &&
    !$("#catalog-view").hidden
  ) {
    e.preventDefault();
    $("#search").focus();
  }
});
$("#hero-object").innerHTML = previewSVG(
  { ...defaults("grid"), finish: "natural" },
  { angle: 35 },
);
mountIcons();
try {
  const draft = load(draftKey, null);
  if (draft) {
    state = readProject(draft);
    savedId = draft.savedId || null;
  }
} catch {}
syncFields();
window.addEventListener("hashchange", route);
route();
