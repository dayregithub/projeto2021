export const MODELS = [
  {
    id: "open",
    name: "Caixa aberta",
    tag: "ESSENCIAL",
    category: "laser",
    description: "Uma base versátil para guardar, presentear e criar.",
    w: 200,
    d: 150,
    h: 80,
    cols: 1,
    rows: 1,
  },
  {
    id: "grid",
    name: "Divisórias em grade",
    tag: "ORGANIZAÇÃO",
    category: "laser",
    description: "Cada peça no seu lugar. Defina linhas e colunas.",
    w: 240,
    d: 180,
    h: 65,
    cols: 3,
    rows: 2,
  },
  {
    id: "custom",
    name: "Divisórias assimétricas",
    tag: "DO SEU JEITO",
    category: "laser",
    description: "Um espaço maior e outros menores, na proporção certa.",
    w: 260,
    d: 180,
    h: 70,
    cols: 2,
    rows: 2,
  },
  {
    id: "lid",
    name: "Caixa com tampa",
    tag: "PROTEÇÃO",
    category: "laser",
    description: "Tampa removível com guia interna para manter tudo protegido.",
    w: 200,
    d: 160,
    h: 90,
    cols: 1,
    rows: 1,
  },
  {
    id: "drawers",
    name: "Gaveteiro modular",
    tag: "OFICINA",
    category: "laser",
    description: "Gavetas independentes para ferramentas e pequenas peças.",
    w: 280,
    d: 200,
    h: 240,
    cols: 2,
    rows: 3,
  },
  {
    id: "bin",
    name: "Caixa de acesso fácil",
    tag: "BANCADA",
    category: "laser",
    description: "Frente rebaixada para encontrar e pegar sem esforço.",
    w: 220,
    d: 180,
    h: 110,
    cols: 1,
    rows: 1,
  },
  {
    id: "print",
    name: "Bandeja 3D",
    tag: "IMPRESSÃO 3D",
    category: "print",
    description: "Uma peça só, com paredes e fundo ajustáveis.",
    w: 140,
    d: 100,
    h: 35,
    cols: 1,
    rows: 1,
  },
  {
    id: "printgrid",
    name: "Organizador 3D",
    tag: "IMPRESSÃO 3D",
    category: "print",
    description: "Compartimentos integrados, prontos para levar ao fatiador.",
    w: 160,
    d: 120,
    h: 35,
    cols: 3,
    rows: 2,
  },
];
export const modelById = (id) => MODELS.find((m) => m.id === id);
export function defaults(id = "grid") {
  const m = modelById(id);
  return {
    version: 1,
    model: id,
    name: m.name,
    width: m.w,
    depth: m.d,
    height: m.h,
    thickness: m.category === "print" ? 2 : 3,
    cols: m.cols,
    rows: m.rows,
    ratio: 60,
    clearance: 0.6,
    finish: m.category === "print" ? "sage" : "natural",
  };
}
export function compartmentCount(s) {
  return s.model === "custom"
    ? 1 + s.rows
    : supportsGrid(s)
      ? s.rows * s.cols
      : 1;
}
export function supportsGrid(s) {
  return ["grid", "custom", "drawers", "printgrid"].includes(s.model);
}
export function cuts(s) {
  const { width: w, depth: d, thickness: t, cols, rows } = s;
  const iw = w - 2 * t,
    id = d - 2 * t;
  const widths =
    s.model === "custom"
      ? [((iw - t) * s.ratio) / 100, (iw - t) * (1 - s.ratio / 100)]
      : Array.from({ length: cols }, () => (iw - (cols - 1) * t) / cols);
  const depths = Array.from(
    { length: rows },
    () => (id - (rows - 1) * t) / rows,
  );
  let x = t,
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
  if (errors.length) return errors;
  if (2 * s.thickness >= Math.min(s.width, s.depth, s.height))
    errors.push("A espessura precisa deixar espaço livre no interior.");
  if (supportsGrid(s)) {
    const c = cuts(s);
    if (Math.min(...c.widths, ...c.depths) < 15)
      errors.push(
        "Cada compartimento precisa de pelo menos 15 mm livres. Reduza as divisões ou aumente a caixa.",
      );
  }
  if (s.model === "custom" && s.cols !== 2)
    errors.push("A divisão assimétrica utiliza duas colunas.");
  if (s.model === "drawers") {
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
  if (s.model === "drawers") {
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
  add("Base", w, d);
  add("Frente", w, s.model === "bin" ? Math.max(15, h * 0.4) - t : h - t);
  add("Traseira", w, h - t);
  add("Lateral esquerda", d - 2 * t, h - t);
  add("Lateral direita", d - 2 * t, h - t);
  if (["grid", "custom"].includes(s.model)) {
    const { xs, ys, widths } = cuts(s);
    const ih = h - t;
    if (s.model === "custom") {
      add("Divisória longitudinal", d - 2 * t, ih);
      ys.forEach((y, i) => add(`Divisória à direita ${i + 1}`, widths[1], ih));
    } else {
      xs.forEach((x, i) =>
        add(`Divisória longitudinal ${i + 1}`, d - 2 * t, ih, {
          slots: ys.map((y) => ({
            x: y - t,
            width: t,
            from: "top",
            depth: ih / 2,
          })),
        }),
      );
      ys.forEach((y, i) =>
        add(`Divisória transversal ${i + 1}`, w - 2 * t, ih, {
          slots: xs.map((x) => ({
            x: x - t,
            width: t,
            from: "bottom",
            depth: ih / 2,
          })),
        }),
      );
    }
  }
  if (s.model === "lid") {
    add("Tampa removível", w, d);
    add(
      "Guia da tampa",
      w - 2 * t - 2 * s.clearance,
      d - 2 * t - 2 * s.clearance,
    );
  }
  return list;
}
export function panelOutline(p) {
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
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${l.width}mm" height="${l.height}mm" viewBox="0 0 ${l.width} ${l.height}"><title>${esc(s.name)} — Papeled Maker</title><desc>Milímetros. Dimensões externas. Montagem por colagem; divisórias com meio encaixe. Sem compensação de kerf. Confirme espessura real e faça teste de corte. A ordem das peças é a mesma da lista no projeto.</desc><g fill="none" stroke="#ff0000" stroke-width="0.1">${l.items
    .map(
      (p) =>
        `<g><title>${esc(p.name)}</title><path d="${panelOutline(p)
          .map(
            (a, i) =>
              `${i ? "L" : "M"}${+(a[0] + p.x).toFixed(4)} ${+(a[1] + p.y).toFixed(4)}`,
          )
          .join(
            " ",
          )}Z"/>${p.hole ? `<circle cx="${p.x + p.hole.x}" cy="${p.y + p.hole.y}" r="${p.hole.r}"/>` : ""}</g>`,
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
  for (const p of l.items) {
    const pts = panelOutline(p);
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
    if (p.hole)
      out.push(
        "0",
        "CIRCLE",
        "100",
        "AcDbEntity",
        "8",
        "CUT",
        "100",
        "AcDbCircle",
        "10",
        String(p.x + p.hole.x),
        "20",
        String(l.height - p.y - p.hole.y),
        "30",
        "0",
        "40",
        String(p.hole.r),
      );
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
  const vertical = s.model === "printgrid" ? xs : [],
    horizontal = s.model === "printgrid" ? ys : [];
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
  const raw = typeof input === "string" ? JSON.parse(input) : input;
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
