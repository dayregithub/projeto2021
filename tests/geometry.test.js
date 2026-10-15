import test from "node:test";
import assert from "node:assert/strict";
import {
  MODELS,
  defaults,
  cuts,
  validate,
  panels,
  panelOutline,
  layoutPanels,
  exportSVG,
  exportDXF,
  stlTriangles,
  readProject,
  drawerDimensions,
} from "../src/geometry.js";
import { sceneBoxes } from "../src/preview.js";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
test("all eight defaults are valid and generate their supported fabrication output", () => {
  for (const m of MODELS) {
    const s = defaults(m.id);
    assert.deepEqual(validate(s), [], m.id);
    if (m.category === "laser") {
      const p = panels(s);
      assert.ok(p.length >= 5);
      assert.match(exportSVG(s), /width="[\d.]+mm"/);
      assert.match(exportDXF(s), /\$INSUNITS\n70\n4/);
      for (const p0 of p) {
        assert.ok(p0.width > 0 && p0.height > 0);
        for (const [x, y] of panelOutline(p0)) {
          assert.ok(x >= 0 && x <= p0.width + 1e-7);
          assert.ok(y >= 0 && y <= p0.height + 1e-7);
        }
      }
    } else assert.ok(stlTriangles(s).length > 20);
  }
});
test("butt-joint box uses external dimensions and subtracts material on inner panels", () => {
  const s = defaults("open");
  s.thickness = 4;
  const p = panels(s);
  assert.equal(p.length, 5);
  assert.deepEqual(
    p.map((p) => [p.width, p.height]),
    [
      [200, 150],
      [200, 76],
      [200, 76],
      [142, 76],
      [142, 76],
    ],
  );
  const b = sceneBoxes(s);
  near(Math.max(...b.map((p) => p.x + p.w)), 200);
  near(Math.max(...b.map((p) => p.y + p.d)), 150);
  near(Math.max(...b.map((p) => p.z + p.h)), 80);
});
test("grid dividers intersect at matching half-depth slots and preserve compartment widths", () => {
  const s = defaults("grid"),
    c = cuts(s),
    p = panels(s);
  near(
    c.widths.reduce((a, b) => a + b, 0) + (s.cols - 1) * s.thickness,
    s.width - 2 * s.thickness,
  );
  near(
    c.depths.reduce((a, b) => a + b, 0) + (s.rows - 1) * s.thickness,
    s.depth - 2 * s.thickness,
  );
  assert.equal(p.length, 8);
  for (const part of p.slice(5))
    for (const slot of part.slots) {
      near(slot.depth, (s.height - s.thickness) / 2);
      assert.equal(slot.width, s.thickness);
    }
  assert.equal(p[5].slots[0].from, "top");
  assert.equal(p.at(-1).slots[0].from, "bottom");
});
test("custom partition ratio changes both geometry and cutting layout", () => {
  const s = defaults("custom"),
    a = cuts(s);
  s.ratio = 75;
  const b = cuts(s);
  assert.ok(b.widths[0] > a.widths[0]);
  assert.ok(b.widths[1] < a.widths[1]);
  near(b.widths[0] / b.widths[1], 3);
  near(panels(s).at(-1).width, b.widths[1]);
  assert.equal(panels(s).at(-1).slots.length, 0);
});
test("drawer carcass and drawers respect per-side clearance and interior dimensions", () => {
  const s = defaults("drawers"),
    g = drawerDimensions(s),
    p = panels(s);
  near(g.dw + 2 * s.clearance, g.cw);
  near(g.dh + 2 * s.clearance, g.ch);
  near(g.cw * s.cols + (s.cols + 1) * s.thickness, s.width);
  near(g.ch * s.rows + (s.rows + 1) * s.thickness, s.height);
  assert.equal(
    p.length,
    5 + (s.rows - 1) + s.rows * (s.cols - 1) + s.rows * s.cols * 5,
  );
  const drawer = p.find((p) => p.name === "Gaveta 1.1 · base");
  near(drawer.width, g.dw);
  near(drawer.height, g.dd);
  assert.ok(p.find((p) => p.name === "Gaveta 1.1 · frente").hole);
});
test("layout never overlaps panels and every contour stays within the export sheet", () => {
  for (const m of MODELS.filter((m) => m.category === "laser")) {
    const l = layoutPanels(defaults(m.id));
    for (let i = 0; i < l.items.length; i++) {
      const p = l.items[i];
      assert.ok(
        p.x >= 0 &&
          p.y >= 0 &&
          p.x + p.width <= l.width &&
          p.y + p.height <= l.height,
      );
      for (const q of l.items.slice(i + 1))
        assert.ok(
          p.x + p.width <= q.x ||
            q.x + q.width <= p.x ||
            p.y + p.height <= q.y ||
            q.y + q.height <= p.y,
        );
    }
  }
});
function checkManifold(tris) {
  const edges = new Map();
  let signedVolume = 0;
  for (const [a, b, c] of tris) {
    const key = (v) => v.map((x) => x.toFixed(6)).join(",");
    for (const [v, w] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const v1 = key(v),
        v2 = key(w),
        k = [v1, v2].sort().join("|");
      if (!edges.has(k)) edges.set(k, []);
      edges.get(k).push(v1 + ">" + v2);
    }
    signedVolume +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;
  }
  for (const [key, v] of edges) {
    assert.equal(v.length, 2, "non-manifold edge " + key);
    assert.notEqual(v[0], v[1], "inconsistent winding " + key);
  }
  return signedVolume;
}
test("STL is watertight, has outward winding and the expected box-minus-cavity volume", () => {
  for (const model of ["print", "printgrid"])
    for (const t of [1.2, 2, 3.5]) {
      const s = defaults(model);
      s.thickness = t;
      const tris = stlTriangles(s),
        vol = checkManifold(tris);
      const c = cuts(s),
        interiorArea =
          model === "print"
            ? (s.width - 2 * t) * (s.depth - 2 * t)
            : c.widths.reduce((a, b) => a + b) *
              c.depths.reduce((a, b) => a + b);
      near(vol, s.width * s.depth * s.height - interiorArea * (s.height - t));
      const points = tris.flat();
      for (const [i, size] of [
        [0, s.width],
        [1, s.depth],
        [2, s.height],
      ]) {
        near(Math.min(...points.map((v) => v[i])), 0);
        near(Math.max(...points.map((v) => v[i])), size);
      }
    }
});
test("invalid dimensions cannot generate cuts and imported project values are validated", () => {
  const s = defaults("drawers");
  s.width = 45;
  s.cols = 5;
  assert.ok(validate(s).length);
  assert.deepEqual(panels(s), []);
  assert.throws(() => readProject(JSON.stringify(s)));
  assert.throws(() => readProject('{"version":2}'));
  assert.throws(() =>
    readProject({ ...defaults(), name: "<script>", thickness: "3" }),
  );
  const a = readProject({ ...defaults("grid"), ignored: "data" });
  assert.equal(a.ignored, undefined);
  assert.deepEqual(readProject(JSON.stringify(a)), a);
});
