import {
  buildBoxPanels,
  circle,
  supportsConstruction,
  lidType,
  jointType,
  wallInset,
  shellMetrics,
  JOINTS,
  LIDS,
  constructionNotes,
} from "./construction.js";
export { MODELS, modelById, defaults } from "./models.js";
import { MODELS, modelById, defaults, familyFor } from "./models.js";
export function compartmentCount(s) {
  return familyFor(s) === "custom"
    ? 1 + s.rows
    : supportsGrid(s)
      ? s.rows * s.cols
      : 1;
}
export function supportsGrid(s) {
  return ["grid", "custom", "drawers", "printgrid"].includes(familyFor(s));
}
export function cuts(s) {
  const { width: w, depth: d, thickness: t, cols, rows } = s;
  const iw = w - 2 * (t + wallInset(s)),
    id = d - 2 * t;
  const widths =
    familyFor(s) === "custom"
      ? [((iw - t) * s.ratio) / 100, (iw - t) * (1 - s.ratio / 100)]
      : Array.from({ length: cols }, () => (iw - (cols - 1) * t) / cols);
  const depths = Array.from(
    { length: rows },
    () => (id - (rows - 1) * t) / rows,
  );
  let x = t + wallInset(s),
    y = t;
  const xs = widths.slice(0, -1).map((v) => {
    x += v;
    const a = x;
    x += t;
    return a;
  });
  const ys = depths.slice(0, -1).map((v) => {
    y += v;
    const a = y;
    y += t;
    return a;
  });
  return { widths, depths, xs, ys };
}
export function validate(s) {
  const errors = [];
  if (!modelById(s.model)) return ["Modelo desconhecido."];
  for (const [k, label, min, max] of [
    ["width", "Largura", 40, 1000],
    ["depth", "Profundidade", 40, 1000],
    ["height", "Altura", 15, 700],
    ["thickness", "Espessura", 1, 12],
    ["cols", "Colunas", 1, 5],
    ["rows", "Linhas", 1, 5],
    ["ratio", "Proporção", 20, 80],
    ["clearance", "Folga", 0.2, 2],
  ])
    if (!Number.isFinite(s[k]) || s[k] < min || s[k] > max)
      errors.push(`${label}: use um valor entre ${min} e ${max}.`);
  if (!Number.isInteger(s.cols) || !Number.isInteger(s.rows))
    errors.push("Linhas e colunas precisam ser números inteiros.");
  for (const [key, min, max] of [
    ["fingerSize", 3, 60],
    ["lidHeight", 3, 40],
    ["pivotDiameter", 3, 12],
    ["lidOpening", 0, 110],
  ])
    if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max)
      errors.push(
        `${{ fingerSize: "Tamanho do dedo", lidHeight: "Altura da aba", pivotDiameter: "Diâmetro do pivô", lidOpening: "Abertura da tampa" }[key]}: use um valor entre ${min} e ${max}.`,
      );
  if (!Object.hasOwn(JOINTS, s.joint) || !Object.hasOwn(LIDS, s.lidType))
    errors.push("Escolha um tipo de união e de tampa válido.");
  if (
    !supportsConstruction(s) &&
    (s.joint !== "straight" || s.lidType !== "none")
  )
    errors.push(
      "Tampas e uniões são opções dos modelos de caixa a laser; gaveteiros e impressão 3D usam sua própria construção.",
    );
  if (errors.length) return errors;
  const metrics = shellMetrics(s),
    span = metrics.frontHeight - s.thickness;
  if (supportsConstruction(s) && metrics.innerWidth < 15)
    errors.push(
      "A união escolhida deixou menos de 15 mm livres na largura. Aumente a caixa.",
    );
  if (
    jointType(s) === "finger" &&
    (span < 3 * s.thickness ||
      s.width - 2 * s.thickness < 3 * s.thickness ||
      s.depth - 2 * s.thickness < 3 * s.thickness)
  )
    errors.push(
      "Encaixes de dedo precisam de mais espaço. Aumente as medidas ou reduza a espessura.",
    );
  if (
    jointType(s) === "tslot" &&
    (span < 4 * (s.thickness + 4) || s.depth - 2 * s.thickness < 32.8)
  )
    errors.push(
      "A união T precisa de espaço para abas, parafusos e porcas. Aumente altura/profundidade ou reduza a espessura.",
    );
  if (lidType(s) !== "hinged" && s.lidOpening > 100)
    errors.push(
      "A abertura da tampa removível/deslizante deve ficar entre 0 e 100%.",
    );
  if (
    lidType(s) === "sliding" &&
    (s.height < 5 * s.thickness + 2 * s.clearance ||
      metrics.innerWidth < 4 * s.thickness + 2 * s.clearance)
  )
    errors.push(
      "A tampa deslizante precisa de espaço para os dois níveis de trilhos. Aumente a caixa ou reduza a espessura.",
    );
  if (lidType(s) === "hinged" && s.lidHeight < s.thickness)
    errors.push(
      "A altura da aba da tampa deve ser pelo menos igual à espessura.",
    );
  if (2 * s.thickness >= Math.min(s.width, s.depth, s.height))
    errors.push("A espessura precisa deixar espaço livre no interior.");
  if (supportsGrid(s)) {
    const c = cuts(s);
    if (Math.min(...c.widths, ...c.depths) < 15)
      errors.push(
        "Cada compartimento precisa de pelo menos 15 mm livres. Reduza as divisões ou aumente a caixa.",
      );
  }
  if (familyFor(s) === "custom" && s.cols !== 2)
    errors.push("A divisão assimétrica utiliza duas colunas.");
  if (familyFor(s) === "drawers") {
    const g = drawerDimensions(s);
    if (
      g.dw - 2 * s.thickness < 20 ||
      g.dd - 2 * s.thickness < 20 ||
      g.dh - s.thickness < 22
    )
      errors.push(
        "As gavetas ficaram pequenas demais. Aumente a caixa ou reduza linhas, colunas ou espessura.",
      );
  }
  return errors;
}
export function drawerDimensions(s) {
  const {
    width: w,
    depth: d,
    height: h,
    thickness: t,
    cols,
    rows,
    clearance: c,
  } = s;
  return {
    cw: (w - (cols + 1) * t) / cols,
    ch: (h - (rows + 1) * t) / rows,
    dd: d - t - 2 * c,
    dw: (w - (cols + 1) * t) / cols - 2 * c,
    dh: (h - (rows + 1) * t) / rows - 2 * c,
  };
}
// All dimensions are external. Laser panels are butt joints, assembled with glue.
export function panels(s) {
  if (modelById(s.model)?.category === "print" || validate(s).length) return [];
  const { width: w, depth: d, height: h, thickness: t, rows, cols } = s;
  const list = [];
  const add = (name, width, height, extra = {}) =>
    list.push({ name, width, height, slots: [], ...extra });
  if (familyFor(s) === "drawers") {
    const { cw, ch, dw, dd, dh } = drawerDimensions(s);
    add("Estrutura · base", w, d);
    add("Estrutura · topo", w, d);
    add("Estrutura · fundo", w, h - 2 * t);
    for (let i = 0; i < 2; i++)
      add(`Estrutura · lateral ${i + 1}`, d - t, h - 2 * t);
    for (let r = 1; r < rows; r++) add(`Prateleira ${r}`, w - 2 * t, d - t);
    for (let r = 0; r < rows; r++)
      for (let c = 1; c < cols; c++)
        add(`Separador · nível ${r + 1} / ${c}`, d - t, ch);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const prefix = `Gaveta ${r + 1}.${c + 1}`;
        add(`${prefix} · base`, dw, dd);
        add(`${prefix} · frente`, dw, dh - t, {
          hole: {
            x: dw / 2,
            y: Math.min(12, (dh - t) / 2),
            r: Math.min(5, (dh - t) / 5),
          },
        });
        add(`${prefix} · traseira`, dw, dh - t);
        add(`${prefix} · lateral A`, dd - 2 * t, dh - t);
        add(`${prefix} · lateral B`, dd - 2 * t, dh - t);
      }
    return list;
  }
  const listBody = buildBoxPanels(s);
  const { inset, innerWidth, dividerTop } = shellMetrics(s);
  if (["grid", "custom"].includes(familyFor(s))) {
    const { xs, ys, widths } = cuts(s);
    const ih = dividerTop - t;
    const make = (name, width, slots, pose) => ({
      name,
      width,
      height: ih,
      slots,
      pose,
    });
    if (familyFor(s) === "custom") {
      listBody.push(
        make("Divisória longitudinal", d - 2 * t, [], {
          origin: [xs[0], t, dividerTop],
          u: [0, 1, 0],
          v: [0, 0, -1],
          normal: [1, 0, 0],
        }),
      );
      ys.forEach((y, i) =>
        listBody.push(
          make(`Divisória à direita ${i + 1}`, widths[1], [], {
            origin: [xs[0] + t, y, dividerTop],
            u: [1, 0, 0],
            v: [0, 0, -1],
            normal: [0, 1, 0],
          }),
        ),
      );
    } else {
      xs.forEach((x, i) =>
        listBody.push(
          make(
            `Divisória longitudinal ${i + 1}`,
            d - 2 * t,
            ys.map((y) => ({ x: y - t, width: t, from: "top", depth: ih / 2 })),
            {
              origin: [x, t, dividerTop],
              u: [0, 1, 0],
              v: [0, 0, -1],
              normal: [1, 0, 0],
            },
          ),
        ),
      );
      ys.forEach((y, i) =>
        listBody.push(
          make(
            `Divisória transversal ${i + 1}`,
            innerWidth,
            xs.map((x) => ({
              x: x - t - inset,
              width: t,
              from: "bottom",
              depth: ih / 2,
            })),
            {
              origin: [inset + t, y, dividerTop],
              u: [1, 0, 0],
              v: [0, 0, -1],
              normal: [0, 1, 0],
            },
          ),
        ),
      );
    }
  }
  return listBody;
}

export function panelOutline(p) {
  if (p.shape) return p.shape[0][0];
  const a = [[0, 0]];
  const slots = [...p.slots].sort((a, b) => a.x - b.x);
  for (const s of slots.filter((s) => s.from === "top"))
    a.push(
      [s.x, 0],
      [s.x, s.depth],
      [s.x + s.width, s.depth],
      [s.x + s.width, 0],
    );
  a.push([p.width, 0], [p.width, p.height]);
  for (const s of slots.filter((s) => s.from === "bottom").reverse())
    a.push(
      [s.x + s.width, p.height],
      [s.x + s.width, p.height - s.depth],
      [s.x, p.height - s.depth],
      [s.x, p.height],
    );
  a.push([0, p.height]);
  return a;
}
export function panelPolygons(p) {
  return (
    p.shape || [
      [
        panelOutline(p),
        ...(p.hole ? circle(p.hole.x, p.hole.y, p.hole.r) : []),
      ],
    ]
  );
}
export function panelContours(p) {
  return panelPolygons(p).flat();
}
export function layoutPanels(s) {
  const items = panels(s);
  const maxWidth = Math.max(600, ...items.map((p) => p.width + 20));
  let x = 10,
    y = 10,
    rowHeight = 0;
  const placed = items.map((p) => {
    if (x + p.width + 10 > maxWidth) {
      x = 10;
      y += rowHeight + 22;
      rowHeight = 0;
    }
    const r = { ...p, x, y };
    x += p.width + 10;
    rowHeight = Math.max(rowHeight, p.height);
    return r;
  });
  return { items: placed, width: maxWidth, height: y + rowHeight + 12 };
}
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function exportSVG(s) {
  const l = layoutPanels(s);
  if (!l.items.length) throw Error("Sem peças para exportar.");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${l.width}mm" height="${l.height}mm" viewBox="0 0 ${l.width} ${l.height}"><title>${esc(s.name)} — Papeled Maker</title><desc>${esc(constructionNotes(s))} Milímetros. Contornos de corte, sem compensação de kerf.</desc><g fill="none" stroke="#ff0000" stroke-width="0.1">${l.items
    .map(
      (p) =>
        `<g><title>${esc(p.name)}</title>${panelContours(p)
          .map(
            (ring) =>
              `<path d="${ring.map((v, i) => `${i ? "L" : "M"}${+(v[0] + p.x).toFixed(4)} ${+(v[1] + p.y).toFixed(4)}`).join(" ")}Z"/>`,
          )
          .join("")}</g>`,
    )
    .join("")}</g></svg>`;
}
export function exportDXF(s) {
  const l = layoutPanels(s);
  if (!l.items.length) throw Error("Sem peças para exportar.");
  const out = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1015",
    "9",
    "$INSUNITS",
    "70",
    "4",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
  ];
  for (const p of l.items)
    for (const pts of panelContours(p)) {
      out.push(
        "0",
        "LWPOLYLINE",
        "100",
        "AcDbEntity",
        "8",
        "CUT",
        "100",
        "AcDbPolyline",
        "90",
        String(pts.length),
        "70",
        "1",
      );
      for (const [x, y] of pts)
        out.push("10", String(x + p.x), "20", String(l.height - y - p.y));
    }
  out.push("0", "ENDSEC", "0", "EOF");
  return out.join("\n");
}
// Rectilinear voxel boundary extraction produces one watertight solid, including dividers.
export function stlTriangles(s) {
  if (validate(s).length || modelById(s.model).category !== "print")
    throw Error("Projeto 3D inválido.");
  const { width: w, depth: d, height: h, thickness: t } = s;
  const { xs, ys } = cuts(s);
  const vertical = familyFor(s) === "printgrid" ? xs : [],
    horizontal = familyFor(s) === "printgrid" ? ys : [];
  const x = [
      ...new Set([0, t, ...vertical.flatMap((v) => [v, v + t]), w - t, w]),
    ].sort((a, b) => a - b),
    y = [
      ...new Set([0, t, ...horizontal.flatMap((v) => [v, v + t]), d - t, d]),
    ].sort((a, b) => a - b),
    z = [0, t, h];
  const occupied = (i, j, k) => {
    if (
      i < 0 ||
      j < 0 ||
      k < 0 ||
      i >= x.length - 1 ||
      j >= y.length - 1 ||
      k > 1
    )
      return false;
    if (k === 0) return true;
    const a = (x[i] + x[i + 1]) / 2,
      b = (y[j] + y[j + 1]) / 2;
    return (
      a < t ||
      a > w - t ||
      b < t ||
      b > d - t ||
      vertical.some((v) => a > v && a < v + t) ||
      horizontal.some((v) => b > v && b < v + t)
    );
  };
  const triangles = [];
  const quad = (v) => {
    triangles.push([v[0], v[1], v[2]], [v[0], v[2], v[3]]);
  };
  for (let i = 0; i < x.length - 1; i++)
    for (let j = 0; j < y.length - 1; j++)
      for (let k = 0; k < 2; k++) {
        if (!occupied(i, j, k)) continue;
        const a = x[i],
          b = x[i + 1],
          c = y[j],
          e = y[j + 1],
          f = z[k],
          g = z[k + 1];
        if (!occupied(i - 1, j, k))
          quad([
            [a, c, f],
            [a, c, g],
            [a, e, g],
            [a, e, f],
          ]);
        if (!occupied(i + 1, j, k))
          quad([
            [b, c, f],
            [b, e, f],
            [b, e, g],
            [b, c, g],
          ]);
        if (!occupied(i, j - 1, k))
          quad([
            [a, c, f],
            [b, c, f],
            [b, c, g],
            [a, c, g],
          ]);
        if (!occupied(i, j + 1, k))
          quad([
            [a, e, f],
            [a, e, g],
            [b, e, g],
            [b, e, f],
          ]);
        if (!occupied(i, j, k - 1))
          quad([
            [a, c, f],
            [a, e, f],
            [b, e, f],
            [b, c, f],
          ]);
        if (!occupied(i, j, k + 1))
          quad([
            [a, c, g],
            [b, c, g],
            [b, e, g],
            [a, e, g],
          ]);
      }
  return triangles;
}
export function exportSTL(s) {
  return (
    "solid papeled_maker\n" +
    stlTriangles(s)
      .map((v) => {
        const u = v[1].map((a, i) => a - v[0][i]),
          w = v[2].map((a, i) => a - v[0][i]),
          n = [
            u[1] * w[2] - u[2] * w[1],
            u[2] * w[0] - u[0] * w[2],
            u[0] * w[1] - u[1] * w[0],
          ],
          len = Math.hypot(...n);
        return `facet normal ${n.map((a) => a / len).join(" ")}\nouter loop\n${v.map((a) => "vertex " + a.join(" ")).join("\n")}\nendloop\nendfacet`;
      })
      .join("\n") +
    "\nendsolid papeled_maker"
  );
}
export function readProject(input) {
  let raw = typeof input === "string" ? JSON.parse(input) : input;
  if (raw?.model === "bin") raw = { ...raw, model: "open" };
  if (!raw || raw.version !== 1 || !modelById(raw.model))
    throw Error(
      "Use um arquivo de projeto .papeled.json exportado por este estúdio.",
    );
  const s = defaults(raw.model);
  for (const k of Object.keys(s)) if (k in raw) s[k] = raw[k];
  if (typeof s.name !== "string" || !s.name.trim() || s.name.length > 80)
    throw Error("Nome do projeto inválido.");
  if (!["natural", "walnut", "sage", "coral"].includes(s.finish))
    throw Error("Acabamento inválido.");
  const errors = validate(s);
  if (errors.length) throw Error(errors[0]);
  return s;
}
