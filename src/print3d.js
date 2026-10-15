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
export function signProfileRings(s) {
  const glyphs = letterContours(s).glyphs.map(
    (rs) => new CrossSection(rs, "EvenOdd"),
  );
  let profile;
  try {
    profile = CrossSection.union(glyphs);
    return profile.toPolygons();
  } finally {
    profile?.delete();
    for (const glyph of glyphs) glyph.delete();
  }
}
function signParts(s) {
  const { glyphs } = letterContours(s),
    glyphShapes = glyphs.map((rs) => keep(new CrossSection(rs, "EvenOdd"))),
    text = union(...glyphShapes),
    baseZ = s.signBase ? s.thickness : 0;
  let solid = slab(
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
  const pieces = solid.decompose(),
    part = {
      id: "letreiro",
      name: s.signBase ? "Letreiro com base" : "Letras sem base",
      triangles: meshTriangles(solid),
      volume: solid.volume(),
      componentCount: pieces.length,
    };
  for (const p of pieces) p.delete();
  return [part];
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
    } else body = subtract(body, slab(inner, t, h));
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
