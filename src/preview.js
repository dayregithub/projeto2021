import {
  cuts,
  drawerDimensions,
  modelById,
  layoutPanels,
  panelOutline,
} from "./geometry.js";
export const FINISHES = {
  natural: { label: "Madeira natural", color: "#e4bb67" },
  walnut: { label: "Nogueira", color: "#a87347" },
  sage: { label: "Verde sálvia", color: "#9eae91" },
  coral: { label: "Terracota", color: "#d78b6b" },
};
export const escapeHTML = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function sceneBoxes(s, { exploded = false, opened = 0.35 } = {}) {
  const { width: w, depth: d, height: h, thickness: t, model, rows, cols } = s,
    boxes = [];
  const sep = exploded ? Math.min(w, d) * 0.15 : 0;
  const add = (x, y, z, a, b, c, kind = "body") =>
    boxes.push({ x, y, z, w: a, d: b, h: c, kind });
  if (model === "drawers") {
    const { cw, ch, dw, dd, dh } = drawerDimensions(s);
    add(0, 0, 0, w, d, t);
    add(0, 0, h - t + sep, w, d, t);
    add(0, -sep, t, w, t, h - 2 * t);
    add(-sep, t, t, t, d - t, h - 2 * t);
    add(w - t + sep, t, t, t, d - t, h - 2 * t);
    for (let r = 1; r < rows; r++) add(t, t, r * (ch + t), w - 2 * t, d - t, t);
    for (let r = 0; r < rows; r++)
      for (let c = 1; c < cols; c++)
        add(c * (cw + t), t, t + r * (ch + t), t, d - t, ch);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = t + c * (cw + t) + s.clearance,
          z = t + r * (ch + t) + s.clearance,
          y = t + s.clearance + opened * dd * (r % 2 === 0 ? 0.5 : 1);
        add(x, y, z, dw, dd, t, "drawer");
        add(x, y, z + t, dw, t, dh - t, "drawer");
        add(x, y + dd - t, z + t, dw, t, dh - t, "drawerfront");
        add(x, y + t, z + t, t, dd - 2 * t, dh - t, "drawer");
        add(x + dw - t, y + t, z + t, t, dd - 2 * t, dh - t, "drawer");
      }
    return boxes;
  }
  add(0, 0, -sep, w, d, t);
  add(0, -sep, t, w, t, h - t);
  add(
    0,
    d - t + sep,
    t,
    w,
    t,
    model === "bin" ? Math.max(15, h * 0.4) - t : h - t,
  );
  add(-sep, t, t, t, d - 2 * t, h - t);
  add(w - t + sep, t, t, t, d - 2 * t, h - t);
  if (["grid", "custom", "printgrid"].includes(model)) {
    const { xs, ys, widths } = cuts(s);
    xs.forEach((x) => add(x, t, t, t, d - 2 * t, h - t, "divider"));
    ys.forEach((y) =>
      add(
        model === "custom" ? xs[0] + t : t,
        y,
        t,
        model === "custom" ? widths[1] : w - 2 * t,
        t,
        h - t,
        "divider",
      ),
    );
  }
  if (model === "lid") {
    const lift = sep + Math.max(18, h * 0.35);
    add(0, 0, h + lift, w, d, t, "lid");
    add(
      t + s.clearance,
      t + s.clearance,
      h + lift - t,
      w - 2 * t - 2 * s.clearance,
      d - 2 * t - 2 * s.clearance,
      t,
      "lid",
    );
  }
  return boxes;
}
function shade(hex, factor) {
  return (
    "#" +
    hex
      .slice(1)
      .match(/../g)
      .map((s) =>
        Math.max(0, Math.min(255, Math.round(parseInt(s, 16) * factor)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
// A BSP painter splits intersecting faces before drawing. This keeps dividers
// inside their walls and gives correct occlusion without a WebGL dependency.
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
function sortedFaces(faces, camera) {
  if (!faces.length) return [];
  const root = faces[0],
    n = root.normal,
    d = dot(n, root.world[0]),
    front = [],
    back = [],
    same = [root],
    eps = 1e-7;
  for (const f of faces.slice(1)) {
    const ds = f.world.map((p) => dot(n, p) - d);
    if (ds.every((v) => Math.abs(v) < eps)) {
      same.push(f);
      continue;
    }
    if (ds.every((v) => v >= -eps)) {
      front.push(f);
      continue;
    }
    if (ds.every((v) => v <= eps)) {
      back.push(f);
      continue;
    }
    const fp = [],
      bp = [];
    f.world.forEach((p, i) => {
      const j = (i + 1) % f.world.length,
        q = f.world[j],
        a = ds[i],
        b = ds[j];
      if (a >= -eps) fp.push(p);
      if (a <= eps) bp.push(p);
      if ((a > eps && b < -eps) || (a < -eps && b > eps)) {
        const t = a / (a - b),
          v = p.map((v, k) => v + (q[k] - v) * t);
        fp.push(v);
        bp.push(v);
      }
    });
    if (fp.length >= 3) front.push({ ...f, world: fp });
    if (bp.length >= 3) back.push({ ...f, world: bp });
  }
  return dot(n, camera) - d >= 0
    ? [...sortedFaces(back, camera), ...same, ...sortedFaces(front, camera)]
    : [...sortedFaces(front, camera), ...same, ...sortedFaces(back, camera)];
}
function originalEdge(a, b, original) {
  return original.some((p, i) => {
    const q = original[(i + 1) % original.length],
      v = q.map((x, k) => x - p[k]),
      len = dot(v, v);
    return [a, b].every((r) => {
      const u = r.map((x, k) => x - p[k]),
        t = dot(u, v) / len;
      return (
        t >= -1e-6 &&
        t <= 1 + 1e-6 &&
        u.every((x, k) => Math.abs(x - t * v[k]) < 1e-5)
      );
    });
  });
}
export function previewSVG(
  s,
  { angle = 35, exploded = false, opened = 0.35, dimensions = false } = {},
) {
  const rad = (angle * Math.PI) / 180,
    sa = Math.sin(rad),
    ca = Math.cos(rad),
    base = FINISHES[s.finish]?.color || FINISHES.natural.color;
  const project = ([x, y, z]) => [
    (x * ca - y * sa) * 1.1,
    (x * sa + y * ca) * 0.48 - z,
  ];
  const faces = [];
  for (const b of sceneBoxes(s, { exploded, opened })) {
    const { x, y, z, w, d, h, kind } = b;
    const vertices = [
      [x, y, z],
      [x + w, y, z],
      [x + w, y + d, z],
      [x, y + d, z],
      [x, y, z + h],
      [x + w, y, z + h],
      [x + w, y + d, z + h],
      [x, y + d, z + h],
    ];
    const defs = [
      [[4, 5, 6, 7], [0, 0, 1], 1.16],
      [[0, 1, 5, 4], [0, -1, 0], 0.84],
      [[1, 2, 6, 5], [1, 0, 0], 0.92],
      [[2, 3, 7, 6], [0, 1, 0], 1],
      [[3, 0, 4, 7], [-1, 0, 0], 0.8],
    ];
    for (const [ids, normal, light] of defs) {
      if (normal[0] * sa + normal[1] * ca + normal[2] * 0.48 <= 0) continue;
      const vs = ids.map((i) => vertices[i]);
      faces.push({
        world: vs,
        original: vs,
        normal,
        fill: shade(base, light),
        stroke: shade(base, 0.66),
        kind,
      });
    }
  }
  const pts = faces.flatMap((f) => f.world.map(project));
  const minX = Math.min(...pts.map((p) => p[0])),
    maxX = Math.max(...pts.map((p) => p[0])),
    minY = Math.min(...pts.map((p) => p[1])),
    maxY = Math.max(...pts.map((p) => p[1]));
  const scale = Math.min(430 / (maxX - minX), 290 / (maxY - minY));
  const tx = 300 - ((minX + maxX) * scale) / 2,
    ty = 197 - ((minY + maxY) * scale) / 2;
  const point = (v) => {
    const p = project(v);
    return `${(p[0] * scale + tx).toFixed(2)},${(p[1] * scale + ty).toFixed(2)}`;
  };
  const ordered = sortedFaces(faces, [sa * 100000, ca * 100000, 0.48 * 100000]);
  const polygons = ordered
    .map((f) => {
      let edge = "";
      f.world.forEach((a, i) => {
        const b = f.world[(i + 1) % f.world.length];
        if (originalEdge(a, b, f.original)) edge += `M${point(a)}L${point(b)}`;
      });
      return `<polygon points="${f.world.map(point).join(" ")}" fill="${f.fill}" stroke="${f.fill}" stroke-width=".3"/>${edge ? `<path d="${edge}" stroke="${f.stroke}" stroke-width=".65" fill="none" stroke-linejoin="round"/>` : ""}`;
    })
    .join("");
  return `<svg viewBox="0 0 600 410" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="300" cy="352" rx="177" ry="16" fill="#293f5a" opacity=".08"/>${polygons}${dimensions ? `<path d="M125 377h350m-350-5v10m350-10v10" fill="none" stroke="#8497aa" stroke-width="1"/><rect x="258" y="365" width="84" height="25" rx="12" fill="#f7fafc"/><text x="300" y="382" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#63788e">${s.width} mm</text>` : ""}</svg>`;
}
export function cutPreviewSVG(s) {
  const l = layoutPanels(s);
  if (!l.items.length) return "";
  return `<svg viewBox="0 0 ${l.width} ${l.height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${l.items
    .map(
      (p, i) =>
        `<g><path d="${panelOutline(p)
          .map((a, j) => `${j ? "L" : "M"}${a[0] + p.x} ${a[1] + p.y}`)
          .join(
            " ",
          )}Z" fill="#e7c17c" stroke="#936d36" stroke-width=".7"/>${p.hole ? `<circle cx="${p.x + p.hole.x}" cy="${p.y + p.hole.y}" r="${p.hole.r}" fill="#eff4f8" stroke="#936d36" stroke-width=".7"/>` : ""}<text x="${p.x + 3}" y="${p.y + Math.min(p.height - 2, 10)}" font-family="sans-serif" font-size="6" fill="#5b482f">${i + 1}</text></g>`,
    )
    .join("")}</svg>`;
}
