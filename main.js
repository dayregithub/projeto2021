import {
  isMakerProduct,
  normalizeMakerDimensions,
  makerDetails,
  gearMetrics,
  TOY_FIGURES,
} from "./src/maker-products.js";
import {
  isEducational,
  isBlankPuzzle,
  educationalKind,
  toyMetrics,
  educationalNotes,
  TOY_THEMES,
  pictureArtSVG,
} from "./src/educational.js";
import { initCustomerCapture } from "./src/customer-projects.js";
import { initWorkspaceCloud } from "./src/workspace-cloud.js";
import {
  connection as workspaceConnection,
  localMode as workspaceLocalMode,
} from "./src/platform-data.js";
import { editingProject, returnToAdmin } from "./src/admin-editor.js";
import { archiveDownload } from "./src/download-archive.js";
import { initPlatform, trackEvent } from "./src/platform.js";
import { finishKeys } from "./src/finishes.js";
import { BRUSH_TEXTURES, brushDrainage } from "./src/brush-features.js";
import { initExternalFiles } from "./src/external-files.js";
import { LETTER_FONTS, letterContours, signMetrics } from "./src/lettering.js";
import { brushOpenings } from "./src/print3d.js";
import { drawerGripDimensions } from "./src/assemblies.js";
import { createViewport } from "./src/viewport.js";
import { PRINT_LIDS, printDimensions, printParts } from "./src/print3d.js";
import { DECORATIONS } from "./src/decoration.js";
import { JOINT_GROUPS, resolvedJoint } from "./src/joinery.js";
import {
  familyFor,
  USAGES,
  CATALOG_GROUPS,
  catalogGroupFor,
  variationsFor,
  findCatalogGroups,
} from "./src/models.js";
import {
  HINGES,
  hingeType,
  hingeDimensions,
  JOINTS,
  LIDS,
  lidType,
  jointType,
  supportsConstruction,
  supportsJoinery,
  shellMetrics,
  constructionNotes,
} from "./src/construction.js";
import {
  defaults,
  modelById,
  supportsGrid,
  compartmentCount,
  cuts,
  validate,
  panels,
  drawerDimensions,
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
$("#sign-font").innerHTML = [...new Set(LETTER_FONTS.map((f) => f.group))]
  .map(
    (group) =>
      `<optgroup label="${group}">${LETTER_FONTS.filter(
        (f) => f.group === group,
      )
        .map((f) => `<option value="${f.id}">${f.label}</option>`)
        .join("")}</optgroup>`,
  )
  .join("");
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
const viewport = createViewport({
  element: $("#preview"),
  getView: () => view,
  onRotate: (delta) => {
    angle += delta;
    renderEditor();
  },
  onChange: (zoom) => {
    $("#zoom-reset").textContent = Math.round(zoom * 100) + "%";
    $("#zoom-out").disabled = zoom <= 0.5;
    $("#zoom-in").disabled = zoom >= 4;
  },
});
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
    ? values
        .filter((p) => {
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
        .map((p) => ({ ...p, project: readProject(p.project) }))
    : [];
}
function updateSavedCount() {
  $("#saved-count").textContent = getSaved().length;
}
const thumbnailCache = new Map();
const svgImage = (svg) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
function thumbnail(m) {
  if (!thumbnailCache.has(m.id))
    thumbnailCache.set(
      m.id,
      svgImage(previewSVG(defaults(m.id), { opened: 0.25 })),
    );
  return thumbnailCache.get(m.id);
}
function renderCatalog() {
  const found = findCatalogGroups({
    term: $("#search").value,
    category: filter,
    usage: $("#use-filter").value,
  });
  const count = found.reduce((n, g) => n + g.matches.length, 0);
  $("#model-count").textContent =
    `${found.length} ${found.length === 1 ? "grupo" : "grupos"} · ${count} ${count === 1 ? "variação" : "variações"}`;
  $("#model-grid").innerHTML = found.length
    ? found
        .map((group) => {
          const preferred =
            group.matches.find((m) => m.id === group.defaultModel) ||
            group.matches[0];
          return `<button class="model-card" data-group="${group.id}" data-model="${preferred.id}"><div class="model-image ${group.category === "print" ? "print-image" : ""}"><span class="model-badge">${group.tag}</span><img src="${thumbnail(preferred)}" alt="" loading="lazy" decoding="async" width="600" height="410"><span class="card-open">${icon("arrow-up-right")}</span></div><div class="model-card-info"><h3>${group.name}</h3><p>${group.description}</p><span class="product-size">${group.matches.length} variações${group.matches.length !== variationsFor(group).length ? " encontradas" : ""} · medidas ajustáveis</span><span class="process-chip">${icon(group.category === "print" ? "box" : "sparkles")}${group.category === "print" ? "Impressão 3D" : "Corte a laser"}<span>·</span>Escolher variação</span></div></button>`;
        })
        .join("")
    : `<div class="empty-state">${icon("search")}<h3>Nenhum modelo por aqui.</h3><p>Tente outro nome ou limpe os filtros.</p><button class="button secondary" id="clear-search">Limpar busca</button></div>`;
  $$("[data-model]").forEach(
    (b) => (b.onclick = () => openModel(b.dataset.model)),
  );
  $("#clear-search")?.addEventListener("click", () => {
    $("#search").value = "";
    $("#use-filter").value = "all";
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
let activeProductId = null;
let adminEdit = null;
function openProject(project, id = null, productId = null) {
  activeProductId = productId;
  clearTimeout(saveTimer);
  state = { ...project };
  trackEvent("model_view", state.model, "", activeProductId);
  savedId = id;
  angle = 35;
  view = "3d";
  viewport.reset(true);
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
  const group = catalogGroupFor(state);
  $("#model-variation").innerHTML = variationsFor(group)
    .map((m) => `<option value="${m.id}">${esc(m.name)}</option>`)
    .join("");
  $("#model-variation").value = state.model;
  $("#variation-group").textContent = group.name;

  for (const k of [
    "width",
    "depth",
    "height",
    "thickness",
    "slotWidth",
    "cols",
    "rows",
    "ratio",
    "makerTextHeight",
    "makerRelief",
    "makerStroke",
    "makerBorderWidth",
    "makerHandleHeight",
    "makerBoreDiameter",
    "makerPatternSpacing",
    "makerGearCount",
    "makerGearTeeth",
    "makerGearTeeth2",
    "makerGearModule",
    "makerGearBacklash",
    "makerTurn",
    "toyCols",
    "toyRows",
    "toyGap",
    "toyBorderWidth",
    "toyImageScale",
    "toyImageX",
    "toyImageY",
    "toyLift",
    "clearance",
    "fingerSize",
    "drawerGripWidth",
    "lidHeight",
    "pivotDiameter",
    "lidOpening",
    "decorationSize",
    "engraveSize",
    "cornerRadius",
    "printOpening",
    "brushHoles",
    "brushHoleDiameter",
    "signTextHeight",
    "brushCoverHeight",
    "brushDrainDiameter",
    "signSpacing",
  ])
    $("#" + k).value =
      k === "slotWidth" ? (state.slotWidth ?? state.thickness) : state[k];
  $("#makerText").value = state.makerText;
  $("#maker-clearance").value = state.clearance;
  for (const [id, key, bool] of [
    ["maker-font", "makerFont"],
    ["maker-figure", "makerFigure"],
    ["maker-shape", "makerShape"],
    ["maker-content", "makerContent"],
    ["maker-pattern", "makerPattern"],
    ["maker-hole-position", "makerHolePosition"],
    ["maker-border", "makerBorder", true],
    ["maker-mirror", "makerMirror", true],
    ["maker-handle", "makerHandle", true],
    ["maker-hole", "makerHole", true],
    ["maker-gear-base", "makerGearBase", true],
  ])
    $("#" + id).value = bool ? (state[key] ? "yes" : "no") : state[key];
  $("#toy-theme").value = state.toyTheme;
  $("#toy-piece-style").value = state.toyPieceStyle;
  $("#toy-engraving").value = state.toyEngraving;
  $("#toy-shape-count").value = state.toyShapeCount;
  $("#toy-guide").value = state.toyGuide ? "yes" : "no";
  $("#lid-type").value = state.lidType;
  $("#print-lid").value = state.printLid;
  $("#brush-shape").value = state.brushShape;
  $("#brush-cover").value = state.brushCover ? "yes" : "no";
  $("#brush-drain").value = state.brushDrain ? "yes" : "no";
  $("#brush-texture").value = state.brushTexture;
  $("#sign-orientation").value = state.signOrientation;
  $("#sign-join").value = state.signJoin ? "yes" : "no";
  $("#signText").value = state.signText;
  $("#sign-font").value = state.signFont;
  $("#sign-base").value = state.signBase ? "yes" : "no";
  $("#hinge-type").value = state.hingeType;
  for (const key of ["lidJoint", "dividerJoint", "railJoint", "drawerJoint"])
    $("#" + key).value = state[key];
  $("#lid-cutout").value = state.lidCutout;
  $("#engraveName").value = state.engraveName;
  $("#project-name").value = state.name;
  $("#finish-name").textContent = FINISHES[state.finish].label;
  $("#finishes").innerHTML = finishKeys(state)
    .map((key) => [key, FINISHES[key]])
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
  const isMaker = isMakerProduct(state),
    makerKind = familyFor(state);
  $("#maker-options").hidden = !isMaker;
  $("#maker-decoration-controls").hidden = !["stamp", "relief"].includes(
    makerKind,
  );
  $("#maker-stamp-controls").hidden = makerKind !== "stamp";
  $("#maker-roller-controls").hidden = makerKind !== "roller";
  $("#maker-gears-controls").hidden = makerKind !== "gears";
  $("#maker-hole-controls").hidden = !["relief", "roller", "gears"].includes(
    makerKind,
  );
  $("#maker-hole-position-control").hidden = makerKind !== "relief";
  $("#maker-hole").closest("label").hidden = makerKind === "gears";
  $("#maker-relief-control").hidden = makerKind === "gears";
  $("#maker-text-controls").hidden = state.makerContent === "figure";
  $("#maker-figure-control").hidden = state.makerContent === "text";
  $("#maker-turn-value").textContent = state.makerTurn + "°";
  $("#makerBoreDiameter").min = makerKind === "relief" ? 3 : 4;
  $("#makerBoreDiameter").max =
    makerKind === "gears" ? 10 : makerKind === "roller" ? 12 : 8;
  $("#maker-hint").textContent =
    isMaker && valid
      ? makerDetails(state).join(" ") +
        " Confira o STL no fatiador e teste encaixes e material antes do uso. Partes soltas exigem supervisão no uso infantil."
      : "";
  const isToy = isEducational(state),
    blankPuzzle = isBlankPuzzle(state);
  $("#toy-options").hidden = !isToy;
  $("#toy-picture-controls").hidden = educationalKind(state) !== "picture";
  $("#toy-shapes-control").hidden = educationalKind(state) !== "shapes";
  $("#toy-lift-value").textContent = state.toyLift + " mm";
  $("#toy-art-preview").closest("figure").hidden = blankPuzzle;
  $("#toy-image-controls").hidden = blankPuzzle;
  updateToyImageControls();
  $('label[for="toy-engraving"]').hidden = blankPuzzle;
  $("#toy-engraving").hidden = blankPuzzle;
  $("#toy-guide").closest("label").hidden = blankPuzzle;
  $("#toy-blank-note").hidden = !blankPuzzle;
  if (blankPuzzle)
    $("#toy-blank-note").textContent =
      `Somente corte, sem gravação nas peças ou na base. Área para a imagem: ${fmt(toyMetrics(state).innerWidth)} × ${fmt(toyMetrics(state).innerDepth)} mm. Para adesivar uma imagem inteira antes do corte, use “Corte da imagem montada” na exportação. Use material adesivo próprio para laser; não use PVC/vinil com cloro.`;
  if (isToy && educationalKind(state) === "picture" && !blankPuzzle && valid)
    $("#toy-art-preview").src = svgImage(pictureArtSVG(state));
  $("#toy-border-control").hidden =
    blankPuzzle || state.toyEngraving === "line";
  $("#toy-border-hint").hidden = blankPuzzle || state.toyEngraving === "line";
  $("#toy-hint").textContent = isToy
    ? `${toyMetrics(state).count} peças removíveis. Cole a moldura sobre a base; não cole as peças do jogo. A elevação só altera a prévia, não os arquivos.`
    : "";
  $("#height").disabled = isToy || makerKind === "roller";
  $("#height").step = isMaker ? 0.1 : 1;
  $("#width").min = isMaker
    ? makerKind === "roller"
      ? 40
      : 30
    : isToy
      ? 100
      : 40;
  $("#depth").min = isMaker ? 20 : isToy ? 100 : 40;
  $("#thickness").min = isToy ? 2 : 1;
  $("#thickness").max = isToy ? 6 : 12;
  $("#dimension-hint").textContent = isMaker
    ? makerKind === "gears"
      ? "As medidas da base acompanham a quantidade, os dentes e o módulo."
      : makerKind === "roller"
        ? "Comprimento e diâmetro do corpo; a textura é somada ao diâmetro externo."
        : "Medidas da base; o relevo é somado à espessura."
    : isToy
      ? "Medidas externas da base. Altura montada = duas camadas da espessura escolhida."
      : "Medidas externas do corpo. A tampa e os suportes podem ampliar as dimensões finais.";
  const isBrush = familyFor(state) === "toothbrush",
    isSign = familyFor(state) === "lettering";
  $("#brush-options").hidden = !isBrush;
  $("#sign-options").hidden = !isSign;
  $("#brush-lid-options").hidden = !isBrush || state.printLid === "none";
  $("#depth").disabled =
    isBrush ||
    makerKind === "gears" ||
    (isMaker &&
      ["stamp", "relief"].includes(makerKind) &&
      state.makerShape === "round");
  $("#width").disabled = makerKind === "gears";
  $("#depth-title").textContent =
    makerKind === "roller" ? "Diâmetro do corpo" : "Profundidade";
  $("#width-title").textContent =
    makerKind === "roller"
      ? "Comprimento"
      : isBrush
        ? state.brushShape === "round"
          ? "Diâmetro"
          : "Lado"
        : "Largura";
  $("#height-title").textContent = isMaker
    ? {
        stamp: "Espessura da matriz",
        relief: "Espessura da base",
        roller: "Diâmetro com textura",
        gears: "Espessura das engrenagens",
      }[makerKind]
    : isToy
      ? "Altura montada"
      : isSign
        ? state.signOrientation === "standing"
          ? "Espessura das letras"
          : "Altura total"
        : lidType(state) === "hinged" && hingeType(state) === "reference"
          ? "Altura total com tampa"
          : "Altura";
  $("#height").min = isMaker ? 2 : isToy ? 4 : isSign ? 3 : 15;
  for (const option of $("#print-lid").options)
    option.disabled = option.hidden =
      isBrush && !["none", "outer"].includes(option.value);
  $("#brushCoverHeight").disabled = !state.brushCover;
  $("#brushDrainDiameter").disabled = !state.brushDrain;
  $("#sign-base").querySelector('[value="no"]').disabled =
    state.signOrientation === "standing";
  $("#sign-spacing-value").textContent = state.signSpacing + "%";
  $("#sign-text-height-value").textContent = state.signTextHeight + " mm";
  $('label[for="cornerRadius"]').hidden =
    isBrush && state.brushShape === "round";
  $("#cornerRadius").hidden = isBrush && state.brushShape === "round";
  if (isBrush && valid) {
    const holes = brushOpenings(state);
    $("#brush-hole-value").textContent =
      fmt(Math.max(0, holes.radius * 2)) + " mm";
  }
  if (isSign && valid) {
    const letters = signMetrics(state);
    $("#sign-hint").textContent =
      `Texto final: ${fmt(letters.width)} × ${fmt(letters.height)} mm. Ajuste automático para caber na área. ` +
      (state.signBase
        ? "A base conecta letras e acentos numa peça. Em pé, detalhes soltos recebem pequenos apoios."
        : "Sem base, letras e acentos podem ser peças independentes; organize no fatiador.");
  }

  if (isSign && state.signJoin)
    $("#sign-hint").textContent =
      `Texto final: ${fmt(signMetrics(state).width)} × ${fmt(signMetrics(state).height)} mm. Ligações de 1,2 mm unem letras e acentos no arquivo de impressão. ${state.signOrientation === "standing" ? "Em pé, pequenos apoios conectam as letras à base." : ""}`;
  $("#editor-model-title").textContent = model.name;
  $("#canvas-process").textContent = isPrint ? "IMPRESSÃO 3D" : "CORTE A LASER";
  $("#division-fields").hidden = !supportsGrid(state);
  $("#division-fields").closest(".control-section").hidden =
    isBrush || isSign || isToy;
  $("#no-divisions").hidden =
    supportsGrid(state) || familyFor(state) === "drawers" || isBrush || isSign;
  $("#cols-label").hidden = familyFor(state) === "custom";
  $("#ratio-label").hidden = familyFor(state) !== "custom";
  $("#rows-title").textContent =
    familyFor(state) === "custom" ? "Linhas à direita" : "Linhas";
  $("#ratio-value").textContent = state.ratio + "%";
  $("#drawer-open-label").hidden = familyFor(state) !== "drawers";
  $("#drawer-grip-controls").hidden = familyFor(state) !== "drawers";
  if (familyFor(state) === "drawers" && valid) {
    const grip = drawerGripDimensions(state, drawerDimensions(state));
    $("#drawerGripWidth").max = grip.maxWidth;
    $("#drawerGripWidth").value = grip.width;
    $("#drawer-grip-value").textContent = fmt(grip.width) + " mm";
    $("#drawer-grip-hint").textContent =
      `Profundidade do recorte: ${fmt(grip.depth)} mm. Aplicado a todas as gavetas; a largura máxima acompanha as medidas da frente.`;
  }

  const construction = supportsConstruction(state),
    lid = lidType(state);
  const canJoin = supportsJoinery(state);
  $("#construction-section").hidden = !canJoin;
  $("#print-options").hidden = !isPrint || isSign || isMaker;
  $("#print-opening-label").hidden =
    !isPrint || (state.printLid === "none" && !(isBrush && state.brushCover));
  $("#print-opening-value").textContent =
    state.printOpening + (state.printLid === "hinged" ? "°" : "%");
  $("#printOpening").max = state.printLid === "hinged" ? 110 : 100;
  $("#print-hint").textContent =
    state.printLid === "none"
      ? "Corpo em peça única, com fundo e divisórias integrados."
      : state.printLid === "hinged"
        ? "Corpo, tampa e pino são imprimíveis e exportados separadamente. Monte o pino nos alojamentos após imprimir; teste a folga no seu material."
        : "Tampa separada, com guia interna ou saia externa. A folga é aplicada por lado; teste o encaixe na impressora.";

  if (isBrush && state.brushCover)
    $("#print-hint").textContent +=
      " A cobertura alta também é exportada em STL separado.";
  $("#lid-joint-label").hidden =
    lid === "none" || (lid === "hinged" && hingeType(state) === "tabbed");
  $("#divider-joint-label").hidden = !supportsGrid(state);
  $("#rail-joint-label").hidden = lid !== "sliding";
  $("#drawer-joint-label").hidden = familyFor(state) !== "drawers";
  $("#decoration-section").hidden = lid === "none";
  $("#decoration-size-label").hidden = state.lidCutout === "none";
  $("#decoration-size-value").textContent = state.decorationSize + "%";
  $("#engrave-size-value").textContent = state.engraveSize + " mm";
  $("#lid-section").hidden = !construction;
  $("#finger-size-label").hidden = ![
    state.joint,
    ...["lidJoint", "dividerJoint", "railJoint", "drawerJoint"].map((k) =>
      resolvedJoint(state, k),
    ),
  ].includes("finger");
  $("#lid-height-title").textContent =
    hingeType(state) === "reference"
      ? "Altura da moldura (mm)"
      : "Altura da aba (mm)";
  $("#lidHeight").closest("label").hidden = hingeType(state) === "tabbed";
  $("#finger-size-value").textContent = state.fingerSize + " mm";
  $$("[data-joint]").forEach((b) => {
    const active = b.dataset.joint === jointType(state);
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", active);
  });
  $("#joint-hint").textContent = {
    straight: "Bordas retas para montagem por colagem.",
    finger:
      "Dentes complementares na base e quinas. O passo se ajusta para fechar cada borda.",
    tslot:
      "Abas e canais T com conjuntos M3 nas ligações. Veja a quantidade calculada no resumo. Ajuste o comprimento dos parafusos à chapa e aos canais.",
  }[jointType(state)];
  $("#hinge-fields").hidden = lid !== "hinged";
  $("#hinge-mechanism").hidden = lid !== "hinged";
  $("#hinge-guide").hidden =
    lid !== "hinged" ||
    !["laser", "profile", "reference"].includes(hingeType(state));
  $("#reference-guide").hidden =
    lid !== "hinged" || hingeType(state) !== "reference";
  $("#profile-guide").hidden =
    lid !== "hinged" || hingeType(state) !== "profile";
  $("#integral-guide").hidden =
    lid !== "hinged" || hingeType(state) !== "tabbed";
  $("#pivot-label").textContent = ["laser", "profile"].includes(
    hingeType(state),
  )
    ? "Ø do disco-pivô (mm)"
    : hingeType(state) === "tabbed"
      ? "Ø do alojamento (mm)"
      : "Ø do eixo externo (mm)";
  $("#lid-opening-label").hidden = lid === "none";
  $("#toggle-lid").hidden = lid === "none";
  $("#lid-opening-value").textContent =
    state.lidOpening + (lid === "hinged" ? "°" : "%");
  $("#lidOpening").max =
    lid === "hinged" && !["profile", "reference"].includes(hingeType(state))
      ? 110
      : 100;
  $("#toggle-lid").textContent =
    state.lidOpening > 0 ? "Fechar tampa" : "Abrir tampa";
  $("#lid-hint").textContent = {
    none: "Adicione uma tampa à sua caixa, inclusive aos modelos com divisórias.",
    removable:
      "Tampa solta com guia inferior. As divisórias são rebaixadas para fechar sem colisão.",
    sliding:
      "Inclui quatro trilhos internos com a união selecionada e frente rebaixada. A tampa desliza para a frente.",
    hinged:
      "Suportes e braços recortados nas próprias peças. Usa dois eixos/pinos com retenção; não requer dobradiça metálica separada. Altura informada é a do corpo, sem tampa e suportes.",
  }[lid];
  if (lid === "hinged" && hingeType(state) === "tabbed")
    $("#lid-hint").textContent =
      "A haste está integrada ao contorno da tampa e gira nas laterais, como no novo SVG de referência. Sem discos, eixos separados ou parafusos.";
  if (lid === "hinged" && hingeType(state) === "reference") {
    const hd = hingeDimensions(state);
    $("#lid-hint").textContent =
      `Modelo do SVG: altura total ${fmt(state.height)} mm = corpo ${fmt(hd.bodyHeight)} mm + moldura ${fmt(state.lidHeight)} mm. Braços por fora das paredes, tampa completa e faixa traseira curta de ${fmt(hd.rearStripHeight)} mm. Sem recortes nos cantos da traseira e sem eixo comprado.`;
  }
  if (lid === "hinged" && hingeType(state) === "profile")
    $("#lid-hint").textContent =
      "Pivô alinhado ao perfil lateral, sem orelhas traseiras e com braços internos. A tampa acompanha a largura da caixa. Abertura na prévia até 100°; preserva discos e eixos recortados, sem parafusos.";
  if (lid === "hinged" && hingeType(state) === "laser")
    $("#lid-hint").textContent =
      "Sem eixos comprados: dois discos e dois eixos retangulares são recortados na chapa. Os braços giram ao redor dos discos. Consulte a montagem abaixo.";
  $("#slot-width-label").hidden = isPrint || isToy || isMaker;
  $("#clearance-label").hidden =
    familyFor(state) !== "drawers" &&
    lid === "none" &&
    !(isPrint && (state.printLid !== "none" || (isBrush && state.brushCover)));
  $("#thickness-title").textContent =
    makerKind === "gears"
      ? "Espessura da base (mm)"
      : isSign
        ? "Espessura da base (mm)"
        : "Espessura (mm)";
  $("#thickness").closest("label").hidden =
    (isSign && !state.signBase) || (isMaker && makerKind !== "gears");
  $("#material-hint").textContent = isMaker
    ? "STL em milímetros. Relevo, base e furos são calculados separadamente; confira medidas, material e orientação no fatiador."
    : isSign
      ? state.signOrientation === "standing"
        ? "A espessura define a profundidade das letras em pé. A altura das letras é ajustada abaixo."
        : "A altura total inclui base e relevo do texto. Sem base, define a espessura das letras."
      : isPrint
        ? "Espessura aplicada às paredes, divisórias e fundo. Cor apenas ilustrativa."
        : "Use a espessura real da chapa. Cor apenas ilustrativa.";
  $("#finish-name").textContent = FINISHES[state.finish].label;
  if (supportsGrid(state) && valid) {
    if (familyFor(state) === "drawers") {
      const g = drawerDimensions(state),
        inset =
          resolvedJoint(state, "drawerJoint") === "tslot"
            ? Math.max(2 * state.thickness, 6.4)
            : 0;
      $("#compartment-info").textContent =
        `${state.rows * state.cols} gavetas · interior útil de cada uma: ${fmt(g.dw - 2 * (state.thickness + inset))} × ${fmt(g.dd - 2 * (state.thickness + inset))} × ${fmt(g.dh - state.thickness)} mm.`;
    } else {
      const c = cuts(state);
      $("#compartment-info").textContent =
        familyFor(state) === "custom"
          ? `${1 + state.rows} compartimentos · vão esquerdo de ${fmt(c.widths[0])} × ${fmt(state.depth - 2 * state.thickness)} mm e ${state.rows} vãos à direita de ${fmt(c.widths[1])} × ${fmt(c.depths[0])} mm.`
          : `${state.cols * state.rows} compartimentos · vãos de ${c.widths.map(fmt).join(" / ")} × ${fmt(c.depths[0])} mm.`;
    }
  }
  $("#validation").hidden = valid;
  $("#validation").textContent = errors.join(" ");
  $("#export-project").disabled = !valid || !state.name.trim();
  $("#save-project").disabled = !valid || !state.name.trim();
  $("#return-admin").disabled = !valid || !state.name.trim();
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
      ? `${icon("move")} Arraste para mover · amplie para ver os detalhes`
      : `${icon("move")} Arraste para girar · Shift para mover`;
  $("#rotate-left").hidden = $("#rotate-right").hidden = view === "2d";
  $("#preview").innerHTML = valid
    ? view === "2d"
      ? cutPreviewSVG(state)
      : previewSVG(state, { angle, exploded, opened, dimensions: true })
    : `<div class="invalid-preview">${icon("ruler")}<h3>Vamos ajustar essas medidas?</h3><p>Confira os campos ao lado para continuar.</p></div>`;
  viewport.apply();
  $("#preview").setAttribute(
    "aria-label",
    `Prévia ${view === "2d" ? "das peças" : "da montagem"}: ${state.name}, ${state.width} por ${state.depth} por ${state.height} milímetros`,
  );
  const cells = compartmentCount(state);
  $("#project-stats").innerHTML =
    `<div>${icon("ruler")}<span><strong>${state.width} × ${state.depth} × ${state.height}</strong><small>dimensões externas · mm</small></span></div><div>${icon("layers")}<span><strong>${isPrint ? (isBrush && state.brushCover ? "Corpo + cobertura" + (state.printLid !== "none" ? " + tampa" : "") : state.printLid === "none" ? "Peça única" : state.printLid === "hinged" ? "Corpo + tampa + pino" : "Corpo + tampa") : parts.length + " peças"}</strong><small>${isPrint ? (state.printLid === "none" && !(isBrush && state.brushCover) ? "impressão em um sólido" : "peças separadas para impressão") : "para corte e montagem"}</small></span></div><div>${icon("grid")}<span><strong>${cells} ${familyFor(state) === "drawers" ? "gavetas" : cells === 1 ? "espaço" : "compartimentos"}</strong><small>organização do seu jeito</small></span></div>`;
  $("#assembly-title").textContent = isPrint
    ? isBrush && state.brushCover
      ? "Cobertura removível para as escovas"
      : state.printLid === "none"
        ? "Peça única, pronta para o fatiador."
        : PRINT_LIDS[state.printLid]
    : `${JOINTS[jointType(state)]} · ${LIDS[lidType(state)]}`;
  $("#assembly-text").textContent = isPrint
    ? "STL em milímetros. Corpo em peça única; tampas são peças separadas. Confira os encaixes e a área da impressora no fatiador."
    : constructionNotes(state);
  if (!valid) {
    $("#summary-metrics").innerHTML =
      '<p class="field-hint">Ajuste as medidas para calcular o projeto.</p>';
    $("#parts-list").innerHTML = "";
    $("#part-count").textContent = "";
    return;
  }
  const iw = shellMetrics(state).innerWidth,
    id = state.depth - 2 * state.thickness,
    ih =
      (isPrint
        ? printDimensions(state).dividerTop
        : shellMetrics(state).dividerTop) -
      state.thickness -
      (isPrint ? printDimensions(state).floorLift : 0);
  const fasteners = parts.reduce((n, p) => n + (p.m3Fasteners || 0), 0);
  const area = parts.reduce((sum, p) => sum + p.width * p.height, 0) / 1e6;
  $("#summary-metrics").innerHTML =
    `<dl><div><dt>Fabricação</dt><dd>${isPrint ? "Impressão 3D" : "Corte a laser"}</dd></div><div><dt>Espessura</dt><dd>${fmt(state.thickness)} mm</dd></div>${familyFor(state) === "drawers" ? `<div><dt>Folga por lado</dt><dd>${fmt(state.clearance)} mm</dd></div>` : `<div><dt>Interior útil</dt><dd>${fmt(iw)} × ${fmt(id)} × ${fmt(ih)} mm</dd></div>`}${canJoin ? `<div><dt>Fixação T</dt><dd>${fasteners} conjuntos M3</dd></div><div><dt>União</dt><dd>${JOINTS[jointType(state)]}</dd></div><div><dt>Tampa</dt><dd>${LIDS[lidType(state)]}</dd></div>` : ""}${isPrint ? "" : `<div><dt>Área das peças</dt><dd>${area.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} m²</dd></div>`}</dl>`;
  $("#parts-title").textContent = isPrint
    ? "Sobre o arquivo"
    : "Lista de peças";
  $("#part-count").textContent = isPrint ? "STL" : parts.length;
  $("#parts-list").innerHTML = isPrint
    ? `<li class="print-summary">${icon("box")}<strong>${isBrush && state.brushCover ? "Corpo e cobertura imprimíveis" : state.printLid === "none" ? "Um único sólido fechado" : "Corpo e tampa imprimíveis"}</strong><p>Fundo, paredes${familyFor(state) === "printgrid" ? " e divisórias integradas" : ""}. Abra o STL no seu fatiador para estimar tempo e material.</p><small>Medidas do corpo: ${state.width} × ${state.depth} × ${state.height} mm.</small></li>`
    : parts
        .map(
          (p, i) =>
            `<li><span class="part-index">${i + 1}</span><div><strong>${esc(p.name)}</strong><small>${fmt(p.width)} × ${fmt(p.height)} mm</small></div><span>1×</span></li>`,
        )
        .join("");
  if (isMaker) {
    const pieces = printParts(state),
      volume = pieces.reduce((sum, p) => sum + p.volume, 0) / 1000;
    $("#summary-metrics").innerHTML =
      `<dl><div><dt>Fabricação</dt><dd>Impressão 3D</dd></div><div><dt>Arquivos de peças</dt><dd>${pieces.length}</dd></div><div><dt>Volume estimado</dt><dd>${fmt(volume)} cm³</dd></div><div><dt>Cor de referência</dt><dd>${FINISHES[state.finish].label}</dd></div></dl>`;
    $("#project-stats").innerHTML =
      `<div><strong>${fmt(state.width)} × ${fmt(state.depth)} mm</strong><small>dimensões nominais</small></div><div><strong>${pieces.length} peças</strong><small>STLs separados no ZIP</small></div><div><strong>${fmt(volume)} cm³</strong><small>volume sólido, sem infill</small></div>`;
    $("#assembly-title").textContent = model.name;
    $("#assembly-text").textContent = makerDetails(state).join(" ");
    $("#parts-title").textContent = "Peças para imprimir";
    $("#part-count").textContent = pieces.length;
    $("#parts-list").innerHTML = pieces
      .map(
        (p, i) =>
          `<li><span class="part-index">${i + 1}</span><div><strong>${esc(p.name)}</strong><small>${fmt(p.volume / 1000)} cm³ · STL individual</small></div></li>`,
      )
      .join("");
  }
  if (isToy) {
    const m = toyMetrics(state);
    $("#project-stats").innerHTML =
      `<div><strong>${state.width} × ${state.depth} mm</strong><small>base do jogo</small></div><div><strong>${m.count} peças</strong><small>removíveis</small></div><div><strong>${m.totalHeight} mm</strong><small>duas camadas montadas</small></div>`;
    $("#summary-metrics").innerHTML =
      `<dl><div><dt>Fabricação</dt><dd>${blankPuzzle ? "Somente corte a laser" : "Corte e gravação a laser"}</dd></div><div><dt>Peças removíveis</dt><dd>${m.count}</dd></div><div><dt>Espessura da chapa</dt><dd>${state.thickness} mm</dd></div><div><dt>Folga por borda</dt><dd>${state.toyGap} mm</dd></div><div><dt>Guia na base</dt><dd>${state.toyGuide && !blankPuzzle ? "Gravado" : "Sem gravação"}</dd></div><div><dt>Área das peças</dt><dd>${area.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} m²</dd></div></dl>`;
    $("#assembly-title").textContent = "Base + moldura colada + peças soltas";
    $("#assembly-text").textContent = educationalNotes(state);
  }
  if (isSign) {
    const letters = signMetrics(state);
    $("#summary-metrics").innerHTML =
      `<dl><div><dt>Texto</dt><dd>${esc(state.signText)}</dd></div><div><dt>Fonte</dt><dd>${LETTER_FONTS.find((f) => f.id === state.signFont).label}</dd></div><div><dt>Texto final</dt><dd>${fmt(letters.width)} × ${fmt(letters.height)} mm</dd></div><div><dt>Altura total</dt><dd>${fmt(signMetrics(state).totalHeight)} mm</dd></div><div><dt>Base</dt><dd>${state.signBase ? "Sim · " + state.thickness + " mm" : "Sem base"}</dd></div></dl>`;
    $("#assembly-title").textContent = "Seu texto, em volume.";
    $("#assembly-text").textContent =
      "A fonte escolhida também define os contornos do STL. Confira os detalhes finos no fatiador.";
    $("#parts-list").innerHTML =
      `<li class="print-summary"><strong>${state.signBase ? "Letreiro unido à base" : state.signJoin ? "Letras unidas em uma peça" : "Letras e detalhes separados"}</strong><p>${state.signBase ? "Base e texto em uma peça imprimível." : state.signJoin ? "As ligações entre letras e acentos também estão no STL." : "O STL pode conter várias peças, incluindo pontos e acentos."}</p></li>`;
    $("#project-stats").innerHTML =
      `<div><strong>${fmt(letters.width)} × ${fmt(letters.height)} mm</strong><small>texto final</small></div><div><strong>${fmt(letters.totalHeight)} mm</strong><small>altura total</small></div><div><strong>${LETTER_FONTS.find((f) => f.id === state.signFont).label}</strong><small>fonte do letreiro</small></div>`;
  }
}
function download(content, filename, type) {
  const file = new File([content], filename, { type });
  const url = URL.createObjectURL(file);
  void archiveDownload(file, { model: state.model, product: activeProductId });
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  trackEvent(
    "download",
    state.model,
    filename.split(".").pop(),
    activeProductId,
  );
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
let packageModulePromise;
const packageModule = () =>
  (packageModulePromise ??= import("./src/package.js"));
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
  if (isPrint)
    options.push(
      [
        "svg",
        "SVG — vistas de referência",
        "Vista superior e frontal; não é arquivo de corte.",
        "layout",
      ],
      [
        "dxf",
        "DXF — vistas de referência",
        "Referência dimensional para conferir o projeto.",
        "ruler",
      ],
    );
  else
    options.push([
      "stl",
      "STL da montagem",
      "Referência 3D; não é uma peça única para impressão.",
      "box",
    ]);
  options.push(
    [
      "pdf",
      "PDF",
      isPrint
        ? "Ficha do projeto com medidas."
        : "Peças em escala 1:1, uma por página.",
      "file",
    ],
    [
      "zip",
      "Pacote completo ZIP",
      "SVG, DXF, PDF, STL e projeto editável.",
      "download",
    ],
  );
  if (isBlankPuzzle(state))
    options.push(
      [
        "sticker-svg",
        "Corte da imagem montada · SVG",
        "Somente peças na posição da imagem, escala 1:1; sem gravação.",
        "file",
      ],
      [
        "sticker-dxf",
        "Corte da imagem montada · DXF",
        "Mesmas posições e folgas do projeto, em milímetros.",
        "file",
      ],
    );
  options.push([
    "json",
    "Projeto Papeled",
    "Guarde as medidas e continue criando depois.",
    "file",
  ]);
  $("#export-options").innerHTML = options
    .map(
      ([format, label, desc, img]) =>
        `<button class="export-option" data-export="${format}">${icon(img)}<span><strong>${label}</strong><small>${desc}</small></span><span class="extension">.${format.replace("sticker-", "")}</span>${icon("download")}</button>`,
    )
    .join("");
  $("#export-note").textContent = isPrint
    ? "STL usa milímetros por convenção. Selecione mm ao importar e confirme a escala e a área da sua impressora."
    : constructionNotes(state) +
      " A disposição das peças não é um aproveitamento otimizado de chapa.";
  $$("[data-export]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          const kind = b.dataset.export,
            name = filename();
          if (kind === "sticker-svg")
            download(
              (await packageModule()).stickerSVG(state),
              name + "-imagem-montada-corte.svg",
              "image/svg+xml",
            );
          if (kind === "sticker-dxf")
            download(
              (await packageModule()).stickerDXF(state),
              name + "-imagem-montada-corte.dxf",
              "application/dxf",
            );
          if (kind === "svg")
            download(
              (await packageModule()).projectSVG(state),
              name + ".svg",
              "image/svg+xml",
            );
          if (kind === "dxf")
            download(
              (await packageModule()).projectDXF(state),
              name + ".dxf",
              "application/dxf",
            );
          if (kind === "stl")
            download(
              (await packageModule()).projectSTL(state),
              name + ".stl",
              "model/stl",
            );
          if (kind === "pdf")
            download(
              (await packageModule()).projectPDF(state),
              name + ".pdf",
              "application/pdf",
            );
          if (kind === "zip") {
            const bundle = (await packageModule()).projectPackage(state);
            download(bundle.data, bundle.name, "application/zip");
          }
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
let quoteFile = null,
  quoteURL = null,
  quoteJob = 0;
$("#quote-share").onclick = async () => {
  if (!quoteFile) return;
  try {
    await navigator.share({
      files: [quoteFile],
      title: "Projeto Papeled Maker",
      text: $("#quote-message").value,
    });
  } catch (e) {
    if (e.name !== "AbortError")
      toast("Não foi possível compartilhar. Baixe o ZIP e anexe na conversa.");
  }
};
const captureCustomer = initCustomerCapture();
$("#quote-project").onclick = async () => {
  const customer = await captureCustomer("quote", state);
  if (!customer) return;
  $("#platform-quote").dataset.project = JSON.stringify({
    ...state,
    customerProjectId: customer.id,
  });
  if (customer.name)
    $("#platform-quote").elements.customer.value = customer.name;
  if (customer.phone || customer.email)
    $("#platform-quote").elements.contact.value = [
      customer.phone,
      customer.email,
    ]
      .filter(Boolean)
      .join(" · ");
  const m = modelById(state.model);
  $("#quote-message").value =
    `Olá, Papeled Maker! Quero um orçamento para este projeto:\n\n${state.name}\nModelo: ${m.name}\nMedidas externas: ${state.width} × ${state.depth} × ${state.height} mm\nEspessura: ${state.thickness} mm\n${m.category === "laser" && !isEducational(state) ? `Encaixes: ${state.slotWidth ?? state.thickness} mm\n` : ""}${supportsGrid(state) ? `${state.cols} colunas × ${state.rows} linhas\n` : ""}${familyFor(state) === "custom" ? `Primeiro compartimento: ${state.ratio}%\n` : ""}${familyFor(state) === "drawers" || lidType(state) !== "none" || (m.category === "print" && state.printLid !== "none") ? `Folga: ${state.clearance} mm por lado\n` : ""}Fabricação: ${m.category === "print" ? "Impressão 3D" : "Corte a laser"}\n${m.category === "print" && !isMakerProduct(state) ? `Cantos: raio ${state.cornerRadius} mm\nTampa: ${PRINT_LIDS[state.printLid]}\n` : ""}${m.category === "laser" && !isEducational(state) ? `União: ${JOINTS[jointType(state)]}\nTampa: ${LIDS[lidType(state)]}\n${jointType(state) === "finger" ? `Dedo alvo: ${state.fingerSize} mm\n` : ""}${lidType(state) === "hinged" ? `Mecanismo: ${HINGES[hingeType(state)]}\nAba: ${state.lidHeight} mm · pivô: Ø${state.pivotDiameter} mm\n` : ""}` : ""}\n${supportsJoinery(state) ? `Uniões por conjunto: tampa ${JOINT_GROUPS[resolvedJoint(state, "lidJoint")] || "Cruzada"}, divisórias ${JOINT_GROUPS[resolvedJoint(state, "dividerJoint")] || "Cruzada"}, trilhos ${JOINT_GROUPS[resolvedJoint(state, "railJoint")] || "Cruzada"}, gavetas ${JOINT_GROUPS[resolvedJoint(state, "drawerJoint")] || "Cruzada"}\n` : ""}${state.lidCutout !== "none" ? `Recorte: ${DECORATIONS[state.lidCutout]}\n` : ""}${state.engraveName ? `Gravação: ${state.engraveName} (traço simples)\n` : ""}${familyFor(state) === "drawers" ? `Puxador: recorte superior com ${fmt(drawerGripDimensions(state, drawerDimensions(state)).width)} mm de largura\n` : ""}${familyFor(state) === "toothbrush" ? `Porta-escovas: ${state.brushShape === "round" ? "redondo" : "quadrado"}; aberturas na tampa: ${state.printLid === "none" ? "sem tampa" : state.brushHoles === 0 ? "tampa fechada" : state.brushHoles + " aberturas de " + fmt(brushOpenings(state).radius * 2) + " mm"}\n` : ""}${familyFor(state) === "lettering" ? `Texto: ${state.signText}\nFonte: ${LETTER_FONTS.find((f) => f.id === state.signFont).label}\nTexto final: ${fmt(letterContours(state).width)} × ${fmt(letterContours(state).height)} mm\nBase: ${state.signBase ? "sim" : "não"}\n` : ""}${extraProductQuote(state)}Referência de cor: ${FINISHES[state.finish].label}\n\nQuantidade: \nComo vou usar: `;
  updateQuote();
  $("#quote-package-status").textContent = "Preparando arquivos do projeto…";
  $("#quote-package").hidden = true;
  $("#quote-share").hidden = true;
  $("#quote-dialog").showModal();
  const snapshot = { ...state },
    job = ++quoteJob,
    message = $("#quote-message").value;
  quoteFile = null;
  try {
    const module = await packageModule();
    if (job !== quoteJob) return;
    const bundle = module.projectPackage(snapshot, message);
    quoteFile = new File([bundle.data], bundle.name, {
      type: "application/zip",
    });
    if (quoteURL) URL.revokeObjectURL(quoteURL);
    quoteURL = URL.createObjectURL(quoteFile);
    const link = $("#quote-package");
    link.onclick = () => {
      trackEvent("download", snapshot.model, "zip", activeProductId);
      void archiveDownload(quoteFile, {
        model: snapshot.model,
        product: activeProductId,
        checkbox: "archive-quote",
        status: "archive-quote-status",
      });
    };
    link.href = quoteURL;
    link.download = bundle.name;
    link.hidden = false;
    link.textContent = "Baixar " + bundle.name;
    $("#quote-package-status").textContent =
      "ZIP pronto: SVG, DXF, PDF, STL e projeto editável. O download começa automaticamente; depois, anexe o ZIP na conversa.";
    $("#quote-share").hidden = !(
      navigator.canShare && navigator.canShare({ files: [quoteFile] })
    );
    if ($("#quote-dialog").open) link.click();
  } catch (e) {
    $("#quote-package-status").textContent =
      "Não foi possível gerar o ZIP: " + e.message;
  }
};
$("#quote-message").oninput = updateQuote;
for (const key of [
  "width",
  "depth",
  "height",
  "thickness",
  "slotWidth",
  "cols",
  "rows",
  "ratio",
  "clearance",
  "fingerSize",
  "drawerGripWidth",
  "lidHeight",
  "pivotDiameter",
  "lidOpening",
  "decorationSize",
  "engraveSize",
  "cornerRadius",
  "printOpening",
  "brushHoles",
  "brushHoleDiameter",
  "signTextHeight",
  "brushCoverHeight",
  "brushDrainDiameter",
  "signSpacing",
  "makerTextHeight",
  "makerRelief",
  "makerStroke",
  "makerBorderWidth",
  "makerHandleHeight",
  "makerBoreDiameter",
  "makerPatternSpacing",
  "makerGearCount",
  "makerGearTeeth",
  "makerGearTeeth2",
  "makerGearModule",
  "makerGearBacklash",
  "makerTurn",
  "toyCols",
  "toyRows",
  "toyGap",
  "toyBorderWidth",
  "toyImageScale",
  "toyImageX",
  "toyImageY",
  "toyLift",
])
  $("#" + key).addEventListener("input", (e) => {
    state[key] = e.target.value === "" ? NaN : Number(e.target.value);
    if (isMakerProduct(state)) {
      normalizeMakerDimensions(state);
      for (const k of ["width", "depth", "height"]) $("#" + k).value = state[k];
    }
    if (key === "thickness" && isEducational(state)) {
      state.height = 2 * state.thickness;
      $("#height").value = state.height;
    }
    if (key === "thickness" && state.slotWidth == null)
      $("#slotWidth").value = state.thickness;
    if (key === "width" && familyFor(state) === "toothbrush") {
      state.depth = state.width;
      $("#depth").value = state.depth;
    }
    if (["decorationSize", "engraveSize"].includes(key)) {
      state.lidOpening = 0;
      $("#lidOpening").value = 0;
    }
    renderEditor();
    persistDraft();
  });
$$("[data-joint]").forEach(
  (b) =>
    (b.onclick = () => {
      state.joint = b.dataset.joint;
      ensureJoinSizes();
      renderEditor();
      persistDraft();
    }),
);
for (const [id, key, boolean] of [
  ["brush-cover", "brushCover", true],
  ["brush-drain", "brushDrain", true],
  ["brush-texture", "brushTexture", false],
  ["sign-orientation", "signOrientation", false],
  ["sign-join", "signJoin", true],
])
  $("#" + id).onchange = (e) => {
    state[key] = boolean ? e.target.value === "yes" : e.target.value;
    if (key === "brushCover" && state.brushCover) state.printOpening = 0;
    if (state.signOrientation === "standing") state.signBase = true;
    if (key === "signJoin" && state.signJoin && state.signSpacing >= 0)
      state.signSpacing = -10;
    syncFields();
    renderEditor();
    persistDraft();
  };
for (const [id, key] of [
  ["toy-theme", "toyTheme"],
  ["toy-piece-style", "toyPieceStyle"],
  ["toy-engraving", "toyEngraving"],
  ["toy-shape-count", "toyShapeCount"],
  ["toy-guide", "toyGuide"],
])
  $("#" + id).onchange = (e) => {
    state[key] =
      key === "toyShapeCount"
        ? Number(e.target.value)
        : key === "toyGuide"
          ? e.target.value === "yes"
          : e.target.value;
    renderEditor();
    persistDraft();
  };
for (const [id, key, bool] of [
  ["maker-font", "makerFont"],
  ["maker-figure", "makerFigure"],
  ["maker-shape", "makerShape"],
  ["maker-content", "makerContent"],
  ["maker-pattern", "makerPattern"],
  ["maker-hole-position", "makerHolePosition"],
  ["maker-border", "makerBorder", true],
  ["maker-mirror", "makerMirror", true],
  ["maker-handle", "makerHandle", true],
  ["maker-hole", "makerHole", true],
  ["maker-gear-base", "makerGearBase", true],
])
  $("#" + id).onchange = (e) => {
    state[key] = bool ? e.target.value === "yes" : e.target.value;
    normalizeMakerDimensions(state);
    syncFields();
    renderEditor();
    persistDraft();
  };
$("#makerText").oninput = (e) => {
  state.makerText = e.target.value;
  renderEditor();
  persistDraft();
};
$("#maker-clearance").oninput = (e) => {
  state.clearance = Number(e.target.value);
  renderEditor();
  persistDraft();
};
$("#maker-gear-step").onclick = () => {
  state.makerTurn = (state.makerTurn + 15) % 360;
  $("#makerTurn").value = state.makerTurn;
  renderEditor();
  persistDraft();
};
function updateToyImageControls() {
  const m = toyMetrics(state);
  $("#toy-image-scale-value").textContent = state.toyImageScale + "%";
  $("#toy-image-x-value").textContent =
    fmt((m.innerWidth * state.toyImageX) / 100) + " mm";
  $("#toy-image-y-value").textContent =
    fmt((m.innerDepth * state.toyImageY) / 100) + " mm";
}
$("#toy-image-reset").onclick = () => {
  state.toyImageScale = 100;
  state.toyImageX = state.toyImageY = 0;
  syncFields();
  renderEditor();
  persistDraft();
};
const toyImage = $("#toy-art-preview");
let toyImageDrag = null,
  toyImageFrame = 0;
const toyPosition = (n) => Math.max(-50, Math.min(50, Math.round(n * 10) / 10));
toyImage.onpointerdown = (e) => {
  if (e.button !== 0 || isBlankPuzzle(state)) return;
  const box = toyImage.getBoundingClientRect(),
    m = toyMetrics(state),
    scale = Math.min(box.width / m.innerWidth, box.height / m.innerDepth);
  toyImageDrag = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    initialX: state.toyImageX,
    initialY: state.toyImageY,
    width: m.innerWidth * scale,
    height: m.innerDepth * scale,
  };
  toyImage.setPointerCapture(e.pointerId);
  toyImage.classList.add("dragging");
  e.preventDefault();
};
toyImage.onpointermove = (e) => {
  if (!toyImageDrag || toyImageDrag.id !== e.pointerId) return;
  const d = toyImageDrag;
  state.toyImageX = toyPosition(
    d.initialX + ((e.clientX - d.x) / d.width) * 100,
  );
  state.toyImageY = toyPosition(
    d.initialY + ((e.clientY - d.y) / d.height) * 100,
  );
  $("#toyImageX").value = state.toyImageX;
  $("#toyImageY").value = state.toyImageY;
  if (!toyImageFrame)
    toyImageFrame = requestAnimationFrame(() => {
      toyImageFrame = 0;
      updateToyImageControls();
      if (!validate(state).length)
        toyImage.src = svgImage(pictureArtSVG(state));
    });
};
const finishToyImageDrag = (e) => {
  if (!toyImageDrag || toyImageDrag.id !== e.pointerId) return;
  toyImageDrag = null;
  cancelAnimationFrame(toyImageFrame);
  toyImageFrame = 0;
  toyImage.classList.remove("dragging");
  renderEditor();
  persistDraft();
};
toyImage.onpointerup =
  toyImage.onpointercancel =
  toyImage.onlostpointercapture =
    finishToyImageDrag;
toyImage.onkeydown = (e) => {
  const direction = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }[e.key];
  if (!direction) return;
  e.preventDefault();
  const step = e.shiftKey ? 5 : 1;
  state.toyImageX = toyPosition(state.toyImageX + direction[0] * step);
  state.toyImageY = toyPosition(state.toyImageY + direction[1] * step);
  $("#toyImageX").value = state.toyImageX;
  $("#toyImageY").value = state.toyImageY;
  renderEditor();
  persistDraft();
};
$("#brush-shape").onchange = (e) => {
  state.brushShape = e.target.value;
  renderEditor();
  persistDraft();
};
$("#signText").oninput = (e) => {
  state.signText = e.target.value;
  renderEditor();
  persistDraft();
};
$("#sign-font").onchange = (e) => {
  state.signFont = e.target.value;
  renderEditor();
  persistDraft();
};
$("#sign-base").onchange = (e) => {
  state.signBase = e.target.value === "yes";
  renderEditor();
  persistDraft();
};
$("#print-lid").onchange = (e) => {
  state.printLid = e.target.value;
  state.printOpening = state.printLid === "hinged" ? 70 : 55;
  syncFields();
  renderEditor();
  persistDraft();
};
$("#lid-type").onchange = (e) => {
  state.lidType = e.target.value;
  if (state.lidType === "hinged") state.lidOpening = 100;
  else state.lidOpening = 55;
  if (state.lidType === "none") {
    state.lidCutout = "none";
    state.engraveName = "";
  }
  ensureJoinSizes();
  syncFields();
  renderEditor();
  persistDraft();
};
$("#toggle-lid").onclick = () => {
  state.lidOpening =
    state.lidOpening > 0 ? 0 : lidType(state) === "hinged" ? 100 : 75;
  $("#lidOpening").value = state.lidOpening;
  renderEditor();
  persistDraft();
};
$("#hinge-type").onchange = (e) => {
  state.hingeType = e.target.value;
  if (["profile", "reference"].includes(state.hingeType))
    state.lidOpening = Math.min(100, state.lidOpening);
  ensureJoinSizes();
  if (state.hingeType === "tabbed")
    state.pivotDiameter =
      Math.ceil((Math.SQRT2 * state.thickness + state.clearance + 0.05) * 10) /
      10;
  syncFields();
  renderEditor();
  persistDraft();
};
function ensureJoinSizes() {
  if (
    lidType(state) === "hinged" &&
    hingeType(state) === "reference" &&
    resolvedJoint(state, "lidJoint") === "tslot"
  ) {
    const hd = hingeDimensions(state);
    if (hd.rearStripHeight < 15)
      state.lidHeight =
        Math.ceil((state.lidHeight + 15 - hd.rearStripHeight) * 2) / 2;
    $("#lidHeight").value = state.lidHeight;
  }
  if (
    lidType(state) === "hinged" &&
    hingeType(state) !== "tabbed" &&
    resolvedJoint(state, "lidJoint") === "tslot" &&
    state.lidHeight < 18
  ) {
    state.lidHeight = 18;
    $("#lidHeight").value = 18;
  }
}
for (const key of ["lidJoint", "dividerJoint", "railJoint", "drawerJoint"])
  $("#" + key).onchange = (e) => {
    state[key] = e.target.value;
    ensureJoinSizes();
    renderEditor();
    persistDraft();
  };
$("#inherit-all-joints").onclick = () => {
  for (const key of ["lidJoint", "dividerJoint", "railJoint", "drawerJoint"])
    state[key] = "inherit";
  ensureJoinSizes();
  syncFields();
  renderEditor();
  persistDraft();
};
$("#lid-cutout").onchange = (e) => {
  state.lidCutout = e.target.value;
  state.lidOpening = 0;
  $("#lidOpening").value = 0;
  renderEditor();
  persistDraft();
};
$("#engraveName").oninput = (e) => {
  state.engraveName = e.target.value;
  state.lidOpening = 0;
  $("#lidOpening").value = 0;
  renderEditor();
  persistDraft();
};
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
  state.model = familyFor(state) === "print" ? "printgrid" : "grid";
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
$("#save-project").onclick = async () => {
  if (await captureCustomer("save", state)) saveProject();
};
$("#export-project").onclick = async () => {
  if (await captureCustomer("export", state)) exportDialog();
};
$("#back-models").onclick = () => (location.hash = "modelos");
$("#new-project").onclick = () => (location.hash = "modelos");
$("#start-project").onclick = () => openModel("grid");
$("#how-button").onclick = () => $("#help-dialog").showModal();
$("#confirm-cancel").onclick = () => $("#confirm-dialog").close();
$$("[data-filter]").forEach(
  (b) => (b.onclick = () => setFilter(b.dataset.filter)),
);
$("#search").oninput = renderCatalog;
$("#use-filter").onchange = renderCatalog;
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
$("#zoom-in").onclick = () => viewport.zoomBy(1.25);
$("#zoom-out").onclick = () => viewport.zoomBy(0.8);
$("#zoom-reset").onclick = () => viewport.reset();
$("#model-variation").onchange = (e) => {
  openModel(e.target.value);
  persistDraft();
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
  viewport.reset();
  renderEditor();
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
$("#use-filter").innerHTML =
  '<option value="all">Todos os usos</option>' +
  Object.entries(USAGES)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
for (const key of ["lidJoint", "dividerJoint", "railJoint", "drawerJoint"])
  $("#" + key).innerHTML =
    Object.entries(JOINT_GROUPS)
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join("") +
    (key === "dividerJoint"
      ? '<option value="cross">Meio encaixe (projeto anterior)</option>'
      : "");
$("#maker-font").innerHTML = LETTER_FONTS.map(
  (f) => `<option value="${f.id}">${f.label}</option>`,
).join("");
$("#maker-figure").innerHTML = Object.entries(TOY_FIGURES)
  .map(([id, name]) => `<option value="${id}">${name}</option>`)
  .join("");
initExternalFiles({ captureCustomer });
mountIcons();
$('[data-filter="all"] span').textContent = CATALOG_GROUPS.length;
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

function extraProductQuote(s) {
  if (isMakerProduct(s)) return makerDetails(s).join("\n") + "\n";
  if (isEducational(s))
    return `Brinquedo pedagógico: ${toyMetrics(s).count} peças removíveis\n${educationalKind(s) === "picture" ? `Figura: ${TOY_THEMES[s.toyTheme]} · ${s.toyCols} colunas × ${s.toyRows} linhas\nEncaixe: ${s.toyPieceStyle === "jigsaw" ? "tradicional" : "reto"}\nGravação: ${isBlankPuzzle(s) ? "nenhuma · para adesivar" : s.toyEngraving === "line" ? "linha simples" : `borda dupla ${s.toyBorderWidth} mm${s.toyEngraving === "fill" ? " preenchida" : ""}`}\n` : ""}Folga por borda: ${s.toyGap} mm\n${!isBlankPuzzle(s) && educationalKind(s) === "picture" ? `Figura: ${s.toyImageScale}% · posição ${s.toyImageX}% / ${s.toyImageY}%\n` : ""}Guia gravado: ${s.toyGuide && !isBlankPuzzle(s) ? "sim" : "não"}\n${isBlankPuzzle(s) ? `Área da imagem para adesivar: ${toyMetrics(s).innerWidth} × ${toyMetrics(s).innerDepth} mm\n` : ""}Montagem: base e moldura coladas; peças soltas.\n`;
  if (familyFor(s) === "toothbrush")
    return `Cobertura alta: ${s.brushCover ? s.brushCoverHeight + " mm acima da borda" : "não"}\nTextura: ${BRUSH_TEXTURES[s.brushTexture]}\nDrenagem: ${s.brushDrain ? "5 furos de " + fmt(brushDrainage(s).radius * 2) + " mm e pés de 2 mm" : "não"}\n`;
  if (familyFor(s) === "lettering")
    return `Posição: ${s.signOrientation === "standing" ? "em pé sobre a base; espessura das letras " + s.height + " mm; altura montada " + fmt(signMetrics(s).totalHeight) + " mm" : "deitadas"}\nLetras unidas: ${s.signJoin ? "sim" : "não"}\nEspaçamento: ${s.signSpacing}%\n`;
  return "";
}

void initPlatform({
  openProject: (project, productId) =>
    openProject(readProject(project), null, productId),
}).catch(() => console.warn("Plataforma indisponível."));

try {
  adminEdit = editingProject();
  if (adminEdit) {
    $("#admin-edit-banner").hidden = false;
    openProject(adminEdit.project);
  }
} catch (error) {
  toast(error.message);
}
$("#return-admin").onclick = () => {
  try {
    returnToAdmin(adminEdit.token, state);
  } catch (error) {
    toast(error.message);
  }
};

void (async () => {
  const client = await workspaceConnection();
  await initWorkspaceCloud({
    client,
    local: workspaceLocalMode(),
    status: (message) => {
      const element = document.getElementById("workspace-cloud-status");
      if (element) element.textContent = message;
    },
  });
})().catch(() => {});
