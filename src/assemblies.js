import clipping from "polygon-clipping";
import { familyFor } from "./models.js";
import {
  makePanel,
  rectanglePose as pose,
  joinContact,
  shellContacts,
  resolvedJoint,
  disk,
  reshape,
} from "./joinery.js";
import { wallInset, shellMetrics } from "./construction.js";
const front = (x, y, z) => pose(x, y, z, [1, 0, 0], [0, 0, -1], [0, 1, 0]);
const side = (x, y, z) => pose(x, y, z, [0, 1, 0], [0, 0, -1], [1, 0, 0]);
export function buildDrawerCabinet(s, g) {
  const { width: w, depth: d, height: h, thickness: t, rows, cols } = s,
    { cw, ch, dw, dd, dh } = g,
    outer = s.joint,
    inner = resolvedJoint(s, "dividerJoint"),
    drawer = resolvedJoint(s, "drawerJoint"),
    m = outer === "tslot" ? Math.max(2 * t, 6.4) : 0,
    parts = [];
  const add = (name, a, b, where, extra = {}) => {
    const p = makePanel(name, a, b, where, extra);
    parts.push(p);
    return p;
  };
  const base = add("Estrutura · base", w, d, pose(0, 0, 0), { role: "base" }),
    top = add("Estrutura · topo", w, d, pose(0, 0, h - t), { role: "top" }),
    back = add("Estrutura · fundo", w, h - 2 * t, front(0, m, h - t), {
      role: "back",
    }),
    left = add(
      "Estrutura · lateral 1",
      d - m - t,
      h - 2 * t,
      side(m, m + t, h - t),
      { role: "left" },
    ),
    right = add(
      "Estrutura · lateral 2",
      d - m - t,
      h - 2 * t,
      side(w - m - t, m + t, h - t),
      { role: "right" },
    );
  const frame = { ...s, thickness: t };
  // Contacts use the wall center planes, including the inset required by T nuts.
  for (const [wall, x] of [
    [left, m + t / 2],
    [right, w - m - t / 2],
  ]) {
    joinContact(base, wall, [x, m + t, t], [x, d, t], [0, 0, -1], outer, frame);
    joinContact(
      top,
      wall,
      [x, m + t, h - t],
      [x, d, h - t],
      [0, 0, 1],
      outer,
      frame,
    );
    joinContact(
      back,
      wall,
      [x, m + t, t],
      [x, m + t, h - t],
      [0, -1, 0],
      outer,
      frame,
    );
  }
  joinContact(
    base,
    back,
    [0, m + t / 2, t],
    [w, m + t / 2, t],
    [0, 0, -1],
    outer,
    frame,
  );
  joinContact(
    top,
    back,
    [0, m + t / 2, h - t],
    [w, m + t / 2, h - t],
    [0, 0, 1],
    outer,
    frame,
  );
  const shelves = [];
  for (let r = 1; r < rows; r++) {
    const z = r * (ch + t),
      p = add(
        `Prateleira ${r}`,
        w - 2 * (m + t),
        d - m - t,
        pose(m + t, m + t, z),
        { role: "shelf" },
      );
    shelves.push(p);
    joinContact(
      left,
      p,
      [m + t, m + t, z + t / 2],
      [m + t, d, z + t / 2],
      [-1, 0, 0],
      inner,
      s,
    );
    joinContact(
      right,
      p,
      [w - m - t, m + t, z + t / 2],
      [w - m - t, d, z + t / 2],
      [1, 0, 0],
      inner,
      s,
    );
    joinContact(
      back,
      p,
      [m + t, m + t, z + t / 2],
      [w - m - t, m + t, z + t / 2],
      [0, -1, 0],
      inner,
      s,
    );
  }
  for (let r = 0; r < rows; r++)
    for (let c = 1; c < cols; c++) {
      const x = m + c * (cw + t),
        z = t + r * (ch + t),
        p = add(
          `Separador · nível ${r + 1} / ${c}`,
          d - m - t,
          ch,
          side(x, m + t, z + ch),
          { role: "divider" },
        ),
        lower = r === 0 ? base : shelves[r - 1],
        upper = r === rows - 1 ? top : shelves[r];
      joinContact(
        lower,
        p,
        [x + t / 2, m + t, z],
        [x + t / 2, d, z],
        [0, 0, -1],
        inner,
        s,
      );
      joinContact(
        upper,
        p,
        [x + t / 2, m + t, z + ch],
        [x + t / 2, d, z + ch],
        [0, 0, 1],
        inner,
        s,
      );
      joinContact(
        back,
        p,
        [x + t / 2, m + t, z],
        [x + t / 2, m + t, z + ch],
        [0, -1, 0],
        inner,
        s,
      );
    }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = m + t + c * (cw + t) + s.clearance,
        y = m + t + s.clearance,
        z = t + r * (ch + t) + s.clearance,
        k = drawer === "tslot" ? Math.max(2 * t, 6.4) : 0,
        prefix = `Gaveta ${r + 1}.${c + 1}`,
        group = { group: "drawer", drawerRow: r };
      const b = add(`${prefix} · base`, dw, dd, pose(x, y, z), {
          ...group,
          role: "base",
        }),
        f = add(
          `${prefix} · frente`,
          dw,
          dh - t,
          front(x, y + dd - k - t, z + dh),
          {
            ...group,
            role: "front",
            hole: {
              x: dw / 2,
              y: Math.min(12, (dh - t) / 2),
              r: Math.min(5, (dh - t) / 5),
            },
          },
        ),
        rear = add(
          `${prefix} · traseira`,
          dw,
          dh - t,
          front(x, y + k, z + dh),
          { ...group, role: "back" },
        ),
        l = add(
          `${prefix} · lateral A`,
          dd - 2 * k - 2 * t,
          dh - t,
          side(x + k, y + k + t, z + dh),
          { ...group, role: "left" },
        ),
        rr = add(
          `${prefix} · lateral B`,
          dd - 2 * k - 2 * t,
          dh - t,
          side(x + dw - k - t, y + k + t, z + dh),
          { ...group, role: "right" },
        );
      // Make the grip a real cut in the same polygon data used by preview and export.
      if (f.hole)
        reshape(
          f,
          clipping.difference(f.shape, disk(f.hole.x, f.hole.y, f.hole.r)),
        );
      for (const [wall, cx] of [
        [l, x + k + t / 2],
        [rr, x + dw - k - t / 2],
      ]) {
        joinContact(
          b,
          wall,
          [cx, y + k + t, z + t],
          [cx, y + dd - k - t, z + t],
          [0, 0, -1],
          drawer,
          s,
        );
        joinContact(
          rear,
          wall,
          [cx, y + k + t, z + t],
          [cx, y + k + t, z + dh],
          [0, -1, 0],
          drawer,
          s,
        );
        joinContact(
          f,
          wall,
          [cx, y + dd - k - t, z + t],
          [cx, y + dd - k - t, z + dh],
          [0, 1, 0],
          drawer,
          s,
        );
      }
      joinContact(
        b,
        rear,
        [x, y + k + t / 2, z + t],
        [x + dw, y + k + t / 2, z + t],
        [0, 0, -1],
        drawer,
        s,
      );
      joinContact(
        b,
        f,
        [x, y + dd - k - t / 2, z + t],
        [x + dw, y + dd - k - t / 2, z + t],
        [0, 0, -1],
        drawer,
        s,
      );
    }
  return parts;
}
export function attachDividers(s, body, cells) {
  const t = s.thickness,
    { inset: m, innerWidth, dividerTop: top } = shellMetrics(s),
    joint = resolvedJoint(s, "dividerJoint"),
    ih = top - t,
    base = body.find((p) => p.role === "base"),
    frontWall = body.find((p) => p.role === "front"),
    back = body.find((p) => p.role === "back"),
    sides = body.filter((p) => p.role === "side"),
    long = [];
  const { xs, ys, widths, depths } = cells;
  const add = (name, w, where) => {
    const p = makePanel(name, w, ih, where, { role: "divider" });
    body.push(p);
    return p;
  };
  for (const [i, x] of xs.entries()) {
    const p = add(
      `Divisória longitudinal ${i + 1}`,
      s.depth - 2 * t,
      side(x, t, top),
    );
    long.push(p);
    joinContact(
      base,
      p,
      [x + t / 2, t, t],
      [x + t / 2, s.depth - t, t],
      [0, 0, -1],
      joint,
      s,
    );
    joinContact(
      back,
      p,
      [x + t / 2, t, t],
      [x + t / 2, t, top],
      [0, -1, 0],
      joint,
      s,
    );
    joinContact(
      frontWall,
      p,
      [x + t / 2, s.depth - t, t],
      [x + t / 2, s.depth - t, top],
      [0, 1, 0],
      joint,
      s,
    );
  }
  let start = m + t;
  const positions = widths.map((w) => {
    const x = start;
    start += w + t;
    return x;
  });
  for (const [r, y] of ys.entries())
    for (
      let col = familyFor(s) === "custom" ? 1 : 0;
      col < widths.length;
      col++
    ) {
      const x = positions[col],
        w = widths[col],
        p = add(
          `Divisória transversal ${r + 1} · vão ${col + 1}`,
          w,
          front(x, y, top),
        ),
        left = col === 0 ? sides[0] : long[col - 1],
        right = col === widths.length - 1 ? sides[1] : long[col];
      joinContact(
        base,
        p,
        [x, y + t / 2, t],
        [x + w, y + t / 2, t],
        [0, 0, -1],
        joint,
        s,
      );
      joinContact(
        left,
        p,
        [x, y + t / 2, t],
        [x, y + t / 2, top],
        [-1, 0, 0],
        joint,
        s,
      );
      joinContact(
        right,
        p,
        [x + w, y + t / 2, t],
        [x + w, y + t / 2, top],
        [1, 0, 0],
        joint,
        s,
      );
    }
  return body;
}
