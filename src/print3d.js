import { brushDrainage, brushCoverDimensions } from "./brush-features.js";
import { letterContours } from "./lettering.js";
import Module from "manifold-3d";
import { familyFor } from "./models.js";
const wasmUrl = new URL(
  "../node_modules/manifold-3d/manifold.wasm",
  import.meta.url,
);
const runtime = await Module({
  locateFile: () =>
    wasmUrl.protocol === "file:"
      ? decodeURIComponent(wasmUrl.pathname)
      : wasmUrl.href,
});
runtime.setup();
const { Manifold, CrossSection } = runtime;
let allocated = [];
const keep = (obj) => {
  allocated.push(obj);
  return obj;
};
const union = (...xs) =>
  keep((xs[0] instanceof CrossSection ? CrossSection : Manifold).union(xs));
const subtract = (...xs) =>
  keep(
    (xs[0] instanceof CrossSection ? CrossSection : Manifold).difference(xs),
  );
const intersect = (...xs) =>
  keep(
    (xs[0] instanceof CrossSection ? CrossSection : Manifold).intersection(xs),
  );
const translate = (v, obj) => keep(obj.translate(v));
const rectangle = ({ size, center }) =>
  translate(
    [center[0] - size[0] / 2, center[1] - size[1] / 2],
    keep(CrossSection.square(size)),
  );
export const PRINT_LIDS = {
  none: "Sem tampa",
  inner: "Encaixe interno",
  outer: "Encaixe externo (cobre a caixa)",
  hinged: "Dobradiça com pino imprimível",
};
export function printDimensions(s) {
  const t = s.thickness,
    c = s.clearance,
    lip = Math.min(2 * t + 2, s.height / 3),
    pinRadius = Math.max(0.8, t * 0.45),
    holeRadius = pinRadius + c / 2,
    barrelRadius = holeRadius + Math.max(t, 1.2);
  return {
    lip,
    pinRadius,
    holeRadius,
    barrelRadius,
    hingeY: -barrelRadius - c,
    hingeZ: s.height,
    floorLift: familyFor(s) === "toothbrush" ? brushDrainage(s).lift : 0,
    dividerTop: s.printLid === "inner" ? s.height - lip - c : s.height,
  };
}
const box = (x, y, z, w, d, h) =>
  translate([x, y, z], keep(Manifold.cube([w, d, h])));
export function outlinePoints(w, d, r, x = 0, y = 0) {
  if (r < 0.001)
    return [
      [x, y],
      [x + w, y],
      [x + w, y + d],
      [x, y + d],
    ];
  r = Math.min(r, Math.min(w, d) / 2 - 0.001);
  const out = [];
  for (const [cx, cy, a] of [
    [w - r, r, -90],
    [w - r, d - r, 0],
    [r, d - r, 90],
    [r, r, 180],
  ])
    for (let j = 0; j <= 8; j++) {
      const angle = ((a + (j * 90) / 8) * Math.PI) / 180;
      out.push([x + cx + r * Math.cos(angle), y + cy + r * Math.sin(angle)]);
    }
  return out;
}
export function roundedOutline(w, d, r, x = 0, y = 0) {
  return keep(new CrossSection([outlinePoints(w, d, r, x, y)]));
}
const slab = (shape, z, h) => translate([0, 0, z], keep(shape.extrude(h)));
const tube = (x, len, y, z, r) =>
  translate(
    [x, y, z],
    keep(keep(Manifold.cylinder(len, r, r, 32)).rotate([0, 90, 0])),
  );
export function meshTriangles(geometry) {
  const simplified = geometry.simplify(0.0001);
  const mesh = simplified.getMesh(),
    out = [];
  for (let i = 0; i < mesh.triVerts.length; i += 3)
    out.push(
      [0, 1, 2].map((j) => {
        const index = mesh.triVerts[i + j] * mesh.numProp;
        return [0, 1, 2].map((k) => mesh.vertProperties[index + k]);
      }),
    );
  simplified.delete();
  return out;
}
export function extrudedTriangles(polygons, height) {
  const cross = new CrossSection(polygons.flat(), "EvenOdd");
  let solid;
  try {
    solid = cross.extrude(height);
    return meshTriangles(solid);
  } finally {
    solid?.delete();
    cross.delete();
  }
}
export function brushOpenings(s) {
  const count = s.brushHoles,
    inside = s.width / 2 - s.thickness - s.clearance,
    orbit = count > 1 ? inside * 0.55 : 0;
  const maxRadius = Math.min(
    inside - orbit - s.thickness,
    count > 1
      ? orbit * Math.sin(Math.PI / count) - s.thickness / 2
      : inside - s.thickness,
    15,
  );
  const radius = Math.min(s.brushHoleDiameter / 2, maxRadius);
  return {
    radius,
    maxDiameter: 2 * maxRadius,
    centers: Array.from({ length: count }, (_, i) => [
      s.width / 2 + orbit * Math.cos((2 * Math.PI * i) / count + Math.PI / 4),
      s.depth / 2 + orbit * Math.sin((2 * Math.PI * i) / count + Math.PI / 4),
    ]),
  };
}
const shiftedCircle = (p, r) => translate(p, keep(CrossSection.circle(r, 12)));
function connectProfile(shape, width = 1.2) {
  const components = shape.decompose().map(keep);
  if (components.length < 2) return shape;
  const points = components.map((c) => c.toPolygons().flat()),
    edges = [];
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      let best = Infinity,
        a,
        b;
      for (const p of points[i])
        for (const q of points[j]) {
          const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
          if (d < best) {
            best = d;
            a = p;
            b = q;
          }
        }
      edges.push({ i, j, best, a, b });
    }
  const parent = components.map((_, i) => i),
    root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i]))),
    bridges = [];
  for (const e of edges.sort((a, b) => a.best - b.best)) {
    const a = root(e.i),
      b = root(e.j);
    if (a === b) continue;
    parent[b] = a;
    bridges.push(
      keep(
        CrossSection.hull([
          shiftedCircle(e.a, width / 2),
          shiftedCircle(e.b, width / 2),
        ]),
      ),
    );
  }
  return union(shape, ...bridges);
}
function signProfile(s) {
  const { glyphs } = letterContours(s);
  let shapes = glyphs.map((rs) => keep(new CrossSection(rs, "EvenOdd")));
  if (s.signOrientation === "standing")
    shapes = shapes.map((shape) => connectProfile(shape));
  let text = union(...shapes);
  if (s.signJoin) text = connectProfile(text);
  return text;
}
export function signProfileRings(s) {
  const before = allocated;
  allocated = [];
  try {
    return signProfile(s).toPolygons();
  } finally {
    for (const obj of allocated) obj.delete();
    allocated = before;
  }
}
function signParts(s) {
  let text = signProfile(s),
    solid;
  if (s.signOrientation === "standing") {
    const maxY = Math.max(
        ...text
          .toPolygons()
          .flat()
          .map((p) => p[1]),
      ),
      supports = [];
    // Each glyph/island reaches the base; this supports descenders and accents.
    for (const component of text.decompose().map(keep)) {
      const points = component.toPolygons().flat(),
        p = points.reduce((a, b) => (a[1] > b[1] ? a : b));
      supports.push(
        keep(
          CrossSection.hull([
            shiftedCircle(p, 0.6),
            shiftedCircle([p[0], maxY + 0.3], 0.6),
          ]),
        ),
      );
    }
    text = union(text, ...supports);
    solid = translate(
      [0, (s.depth - s.height) / 2, s.thickness + maxY],
      keep(slab(text, 0, s.height).rotate([-90, 0, 0])),
    );
    solid = union(
      solid,
      slab(
        roundedOutline(s.width, s.depth, Math.min(3, s.depth / 8)),
        0,
        s.thickness,
      ),
    );
  } else {
    const baseZ = s.signBase ? s.thickness : 0;
    solid = slab(
      text,
      baseZ - (s.signBase ? 0.03 : 0),
      s.height - baseZ + (s.signBase ? 0.03 : 0),
    );
    if (s.signBase)
      solid = union(
        solid,
        slab(
          roundedOutline(s.width, s.depth, Math.min(3, s.depth / 8)),
          0,
          s.thickness,
        ),
      );
  }
  const pieces = solid.decompose(),
    part = {
      id: "letreiro",
      name:
        s.signOrientation === "standing"
          ? "Letreiro em pé"
          : s.signBase
            ? "Letreiro com base"
            : "Letras sem base",
      triangles: meshTriangles(solid),
      volume: solid.volume(),
      componentCount: pieces.length,
    };
  for (const p of pieces) p.delete();
  return [part];
}
function brushTexture(s, body, profile, r) {
  if (s.brushTexture === "none") return body;
  const t = s.thickness,
    w = s.width,
    d = s.depth,
    lift = brushDrainage(s).lift,
    lip = Math.min(2 * t + 2, s.height / 3),
    z0 = lift + t + 2,
    z1 = s.height - lip - 3,
    A = Math.min(1.2, t * 0.5 + 0.3);
  if (z1 <= z0) return body;
  const points = [];
  if (s.brushShape === "round") {
    for (let i = 0; i < 24; i++) {
      const a = (i * 2 * Math.PI) / 24;
      points.push([
        w / 2 + (w / 2 - A * 0.5) * Math.cos(a),
        d / 2 + (w / 2 - A * 0.5) * Math.sin(a),
      ]);
    }
  } else {
    const m = Math.min(w / 2, Math.max(r + 2, 4));
    for (let i = 0; i < 6; i++) {
      const p = m + ((w - 2 * m) * i) / 5;
      points.push(
        [p, A * 0.5],
        [p, d - A * 0.5],
        [A * 0.5, p],
        [w - A * 0.5, p],
      );
    }
  }
  const detail = [];
  if (s.brushTexture === "ribbed")
    for (const [x, y] of points)
      detail.push(
        translate([x, y, z0], keep(Manifold.cylinder(z1 - z0, A, A, 12))),
      );
  if (s.brushTexture === "rings") {
    const ring = subtract(
      profile(w + 2 * A, d + 2 * A, r + A, -A, -A),
      profile(w - 0.4, d - 0.4, Math.max(0, r - 0.2), 0.2, 0.2),
    );
    for (let z = z0; z < z1; z += Math.max(8, (z1 - z0) / 16))
      detail.push(slab(ring, z, Math.min(1.5, z1 - z)));
  }
  if (s.brushTexture === "dots")
    for (let row = 0; row < 4; row++)
      for (const [x, y] of points)
        detail.push(
          translate(
            [x, y, z0 + ((z1 - z0) * (row + 0.5)) / 4],
            keep(Manifold.sphere(A, 12)),
          ),
        );
  return detail.length ? union(body, ...detail) : body;
}
function drainBrush(s, body, outer) {
  if (!s.brushDrain) return body;
  const drainage = brushDrainage(s),
    R = Math.min(3, s.thickness + 1),
    orbit = s.width / 2 - R - 0.5,
    feet = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    feet.push(
      shiftedCircle(
        [s.width / 2 + orbit * Math.cos(a), s.depth / 2 + orbit * Math.sin(a)],
        R,
      ),
    );
  }
  body = subtract(
    body,
    slab(subtract(outer, union(...feet)), -0.1, drainage.lift + 0.1),
  );
  for (const [x, y] of drainage.centers)
    body = subtract(
      body,
      translate(
        [x, y, drainage.lift - 0.1],
        keep(
          Manifold.cylinder(
            s.thickness + 0.2,
            drainage.radius,
            drainage.radius,
            24,
          ),
        ),
      ),
    );
  return body;
}
function makeBrushCover(s, profile, r) {
  const {
      innerOffset: inside,
      outerOffset: outside,
      bottom,
      stopZ,
      top,
    } = brushCoverDimensions(s),
    t = s.thickness,
    w = s.width,
    d = s.depth;
  const shell = profile(
      w + 2 * outside,
      d + 2 * outside,
      r + outside,
      -outside,
      -outside,
    ),
    hollow = profile(
      w + 2 * inside,
      d + 2 * inside,
      r + inside,
      -inside,
      -inside,
    );

  const shoulderInset = inside - s.clearance - Math.min(t / 2, 1.2),
    opening = profile(
      w + 2 * shoulderInset,
      d + 2 * shoulderInset,
      Math.max(0, r + shoulderInset),
      -shoulderInset,
      -shoulderInset,
    );
  return subtract(
    slab(shell, bottom, top - bottom),
    slab(hollow, bottom - 0.1, stopZ - bottom + 0.1),
    slab(hollow, stopZ + t, top - 2 * t - stopZ),
    slab(opening, bottom - 0.1, top - t - bottom + 0.1),
  );
}
const cache = new Map();
export function printParts(s) {
  const key = JSON.stringify([
    s.model,
    s.width,
    s.depth,
    s.height,
    s.thickness,
    s.cols,
    s.rows,
    s.clearance,
    s.cornerRadius,
    s.printLid,
    s.brushShape,
    s.brushHoles,
    s.brushHoleDiameter,
    s.signText,
    s.signFont,
    s.signTextHeight,
    s.signBase,
    s.signOrientation,
    s.signSpacing,
    s.signJoin,
    s.brushCover,
    s.brushCoverHeight,
    s.brushTexture,
    s.brushDrain,
    s.brushDrainDiameter,
  ]);
  if (cache.has(key)) return cache.get(key);
  allocated = [];
  try {
    if (familyFor(s) === "lettering") {
      const parts = signParts(s);
      cache.set(key, parts);
      if (cache.size > 8) cache.delete(cache.keys().next().value);
      return parts;
    }
    const { width: w, depth: d, height: h, thickness: t, clearance: c } = s,
      r =
        familyFor(s) === "toothbrush" && s.brushShape === "round"
          ? w / 2 - 0.001
          : s.cornerRadius,
      kind = s.printLid,
      {
        lip,
        pinRadius,
        holeRadius,
        barrelRadius: R,
        hingeY: hy,
        dividerTop,
      } = printDimensions(s);
    const profile = (width, depth, radius, x = 0, y = 0) =>
      familyFor(s) === "toothbrush" && s.brushShape === "round"
        ? translate(
            [x + width / 2, y + depth / 2],
            keep(CrossSection.circle(width / 2, 96)),
          )
        : roundedOutline(width, depth, radius, x, y);
    const outer = profile(w, d, r),
      inner = profile(w - 2 * t, d - 2 * t, Math.max(0, r - t), t, t);
    let body = slab(outer, 0, h),
      lid = null,
      pin = null;
    if (familyFor(s) === "printgrid") {
      const cw = (w - (s.cols + 1) * t) / s.cols,
        cd = (d - (s.rows + 1) * t) / s.rows,
        voids = [];
      for (let col = 0; col < s.cols; col++)
        for (let row = 0; row < s.rows; row++) {
          const cell = intersect(
            inner,
            rectangle({
              size: [cw, cd],
              center: [
                t + col * (cw + t) + cw / 2,
                t + row * (cd + t) + cd / 2,
              ],
            }),
          );
          voids.push(slab(cell, t, h));
        }
      body = subtract(body, ...voids);
      if (dividerTop < h)
        body = subtract(body, slab(inner, dividerTop, h - dividerTop + 0.1));
    } else
      body = subtract(
        body,
        slab(
          inner,
          t + (familyFor(s) === "toothbrush" ? brushDrainage(s).lift : 0),
          h,
        ),
      );
    if (familyFor(s) === "toothbrush") {
      body = drainBrush(s, body, outer);
      body = brushTexture(s, body, profile, r);
    }
    if (kind === "inner") {
      const guideOuter = profile(
        w - 2 * t - 2 * c,
        d - 2 * t - 2 * c,
        Math.max(0, r - t - c),
        t + c,
        t + c,
      );
      const guideInner = profile(
        w - 4 * t - 2 * c,
        d - 4 * t - 2 * c,
        Math.max(0, r - 2 * t - c),
        2 * t + c,
        2 * t + c,
      );
      lid = union(
        slab(outer, h + c, t),
        slab(subtract(guideOuter, guideInner), h + c - lip, lip + 0.05),
      );
    }
    if (kind === "outer") {
      const capOuter = profile(
        w + 2 * (c + t),
        d + 2 * (c + t),
        r + c + t,
        -c - t,
        -c - t,
      );
      const capInner = profile(w + 2 * c, d + 2 * c, r + c, -c, -c);
      lid = union(
        slab(capOuter, h + c, t),
        slab(subtract(capOuter, capInner), h + c - lip, lip + 0.05),
      );
    }
    if (familyFor(s) === "toothbrush" && lid && s.brushHoles > 0) {
      const openings = brushOpenings(s);
      for (const [x, y] of openings.centers) {
        const hole = translate(
          [x, y, h + c - 0.1],
          keep(
            Manifold.cylinder(t + 0.2, openings.radius, openings.radius, 32),
          ),
        );
        lid = subtract(lid, hole);
      }
    }
    if (kind === "hinged") {
      const middleX = w * 0.35,
        middleLen = w * 0.3;
      body = union(
        body,
        tube(middleX, middleLen, hy, h, R),
        box(middleX, hy, h - R, middleLen, t - hy, R),
      );
      body = subtract(
        body,
        tube(middleX - 0.1, middleLen + 0.2, hy, h, holeRadius),
      );
      lid = slab(outer, h + c, t);
      for (const [x, len] of [
        [w * 0.12, w * 0.18],
        [w * 0.7, w * 0.18],
      ]) {
        const barrel = union(
          tube(x, len, hy, h, R),
          box(x, hy, h + c, len, Math.max(t, r + t) - hy, t),
        );
        lid = union(
          lid,
          subtract(barrel, tube(x - 0.1, len + 0.2, hy, h, holeRadius)),
        );
      }
      const start = w * 0.12 - c,
        end = w * 0.88 + c;
      pin = union(
        tube(start, end - start, hy, h, pinRadius),
        tube(start - t, t, hy, h, pinRadius + t * 0.65),
      );
    }
    const bodyComponents = body.decompose();
    const componentCount = bodyComponents.length;
    for (const component of bodyComponents) component.delete();
    const parts = [
      {
        id: "corpo",
        name: "Corpo em peça única",
        triangles: meshTriangles(body),
        volume: body.volume(),
        componentCount,
      },
    ];
    const interference = lid ? intersect(body, lid).volume() : 0;
    parts[0].lidInterference = interference;
    if (lid) {
      const components = lid.decompose();
      parts.push({
        id: "tampa",
        name: PRINT_LIDS[kind],
        triangles: meshTriangles(lid),
        componentCount: components.length,
      });
      for (const component of components) component.delete();
    }
    if (pin)
      parts.push({
        id: "pino",
        name: "Pino imprimível da dobradiça",
        triangles: meshTriangles(pin),
      });
    if (familyFor(s) === "toothbrush" && s.brushCover) {
      const cover = makeBrushCover(s, profile, r),
        components = cover.decompose();
      parts.push({
        id: "cobertura",
        name: "Cobertura alta para escovas",
        triangles: meshTriangles(cover),
        componentCount: components.length,
        bodyInterference: intersect(body, cover).volume(),
        lidInterference: lid ? intersect(lid, cover).volume() : 0,
      });
      for (const p of components) p.delete();
    }
    cache.set(key, parts);
    if (cache.size > 8) cache.delete(cache.keys().next().value);
    return parts;
  } finally {
    for (const obj of allocated) obj.delete();
    allocated = [];
  }
}
export function printLayout(s) {
  let x = 0;
  return printParts(s).map((p) => {
    const points = p.triangles.flat(),
      min = [0, 1, 2].map((i) => Math.min(...points.map((v) => v[i]))),
      max = [0, 1, 2].map((i) => Math.max(...points.map((v) => v[i])));
    const dx = x - min[0];
    x += max[0] - min[0] + 15;
    return {
      ...p,
      triangles: p.triangles.map((tri) =>
        tri.map((v) => [v[0] + dx, v[1] - min[1], v[2] - min[2]]),
      ),
    };
  });
}
export function trianglesSTL(triangles, name = "papeled_maker") {
  return (
    `solid ${name}\n` +
    triangles
      .map((v) => {
        const a = v[1].map((n, i) => n - v[0][i]),
          b = v[2].map((n, i) => n - v[0][i]),
          n = [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
          ],
          len = Math.hypot(...n);
        return `facet normal ${n.map((n) => n / len).join(" ")}\nouter loop\n${v.map((v) => "vertex " + v.join(" ")).join("\n")}\nendloop\nendfacet`;
      })
      .join("\n") +
    `\nendsolid ${name}`
  );
}
