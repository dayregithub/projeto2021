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
test("all model defaults are valid and generate their supported fabrication output", () => {
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

// Fabrication regression checks for the configurable box construction.
import { panelContours, panelPolygons } from "../src/geometry.js";
import {
  JOINTS,
  LIDS,
  hingeDimensions,
  shellMetrics,
  toothIntervals,
} from "../src/construction.js";
import clipping from "polygon-clipping";
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function insidePanel(p, point, t) {
  const delta = point.map((v, i) => v - p.pose.origin[i]),
    dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0),
    level = dot(delta, p.pose.normal);
  if (level < 0 || level > t) return false;
  const uv = [dot(delta, p.pose.u), dot(delta, p.pose.v)];
  return panelPolygons(p).some(
    (poly) => inRing(uv, poly[0]) && !poly.slice(1).some((r) => inRing(uv, r)),
  );
}
test("catalog removes access bin, keeps three lid presets and migrates legacy projects", () => {
  assert.ok(!MODELS.some((m) => m.id === "bin"));
  for (const id of ["lid", "sliding", "hinged"])
    assert.ok(MODELS.some((m) => m.id === id));
  const old = defaults("grid");
  for (const key of [
    "joint",
    "fingerSize",
    "lidType",
    "lidHeight",
    "pivotDiameter",
    "lidOpening",
  ])
    delete old[key];
  const result = readProject(old);
  assert.equal(result.joint, "straight");
  assert.equal(result.lidType, "none");
  const bin = readProject({ ...old, model: "bin" });
  assert.equal(bin.model, "open");
  assert.equal(bin.width, old.width);
});
test("every joint and lid combination exports finite, connected, bounded contours and matching DXF paths", () => {
  for (const joint of Object.keys(JOINTS))
    for (const lidType of Object.keys(LIDS)) {
      const s = { ...defaults("grid"), joint, lidType };
      assert.deepEqual(validate(s), [], joint + " " + lidType);
      const p = panels(s);
      let loops = 0;
      for (const panel of p) {
        const poly = panelPolygons(panel);
        assert.equal(
          poly.length,
          1,
          `${joint}/${lidType}: ${panel.name} split into detached pieces`,
        );
        for (const ring of panelContours(panel)) {
          loops++;
          assert.ok(ring.length >= 3);
          for (const [x, y] of ring) {
            assert.ok(Number.isFinite(x) && Number.isFinite(y));
            assert.ok(
              x >= -1e-7 &&
                x <= panel.width + 1e-7 &&
                y >= -1e-7 &&
                y <= panel.height + 1e-7,
            );
          }
        }
        assert.ok(
          clipping.union(poly.map((poly) => poly.map((r) => [...r, r[0]])))
            .length,
        );
      }
      assert.equal((exportSVG(s).match(/<path /g) || []).length, loops);
      assert.equal((exportDXF(s).match(/\nLWPOLYLINE\n/g) || []).length, loops);
    }
});
test("finger box shell partitions its boundary without overlap or gaps at corners and base", () => {
  for (const thickness of [2, 3, 5]) {
    const s = { ...defaults("open"), joint: "finger", thickness },
      p = panels(s),
      t = thickness;
    const samples = (length) => [
      t * 0.37,
      t + 1.13,
      ...toothIntervals(t, length - t, s.fingerSize).map(
        (i) => (i.start + i.end) / 2,
      ),
      length - t - 1.31,
      length - t * 0.37,
    ];
    const xs = samples(s.width),
      ys = samples(s.depth),
      zs = [
        t * 0.37,
        ...toothIntervals(t, s.height, s.fingerSize).map(
          (i) => (i.start + i.end) / 2,
        ),
      ];
    for (const x of xs)
      for (const y of ys)
        for (const z of zs) {
          const expected = Number(
              x < t || x > s.width - t || y < t || y > s.depth - t || z < t,
            ),
            actual = p.filter((p) => insidePanel(p, [x, y, z], t)).length;
          assert.equal(actual, expected, `t=${t} at ${x},${y},${z}`);
        }
  }
});
test("T tabs align with front slots and leave material around M3 holes", () => {
  const s = { ...defaults("open"), joint: "tslot" },
    p = panels(s),
    t = s.thickness,
    m = shellMetrics(s),
    span = s.height - t;
  assert.ok(m.inset >= 6.4);
  near(m.innerWidth, s.width - 2 * (m.inset + t));
  for (const x of [m.inset + t * 0.41, s.width - m.inset - t * 0.59])
    for (const z of [t + span * 0.25, t + span * 0.75]) {
      assert.equal(insidePanel(p[1], [x, s.depth - t * 0.37, z], t), false);
      assert.equal(
        p
          .slice(3, 5)
          .filter((p) => insidePanel(p, [x, s.depth - t * 0.37, z], t)).length,
        1,
      );
    }
  const small = { ...s, height: 20 };
  assert.ok(validate(small).length);
});
test("sliding rails have clearance above partitions and match the lid width and thickness", () => {
  const s = { ...defaults("grid"), lidType: "sliding" },
    p = panels(s),
    m = shellMetrics(s),
    t = s.thickness,
    c = s.clearance;
  const rails = p.filter((p) => p.role === "rail"),
    lid = p.find((p) => p.name === "Tampa deslizante");
  assert.equal(rails.length, 4);
  near(lid.width, m.innerWidth - 2 * c);
  const lower = rails[0],
    upper = rails[1];
  near(upper.pose.origin[2] - (lower.pose.origin[2] + t), t + 2 * c);
  assert.ok(m.dividerTop < lower.pose.origin[2]);
  for (const part of p.filter((p) => p.name.startsWith("Divisória")))
    near(part.height + t, m.dividerTop);
});
test("hinge body and lid use coaxial holes, external cheeks and a variable pin diameter", () => {
  const s = defaults("hinged"),
    p = panels(s),
    hinge = hingeDimensions(s);
  const parts = p.filter(
    (p) => p.role === "side" || p.name.startsWith("Braço"),
  );
  assert.equal(parts.length, 4);
  for (const part of parts) {
    assert.equal(panelPolygons(part)[0].length, 2);
    const ring = panelPolygons(part)[0][1],
      ys = ring.map((v) => part.pose.origin[1] + v[0]),
      zs = ring.map((v) => part.pose.origin[2] - v[1]);
    near((Math.max(...ys) + Math.min(...ys)) / 2, hinge.y);
    near((Math.max(...zs) + Math.min(...zs)) / 2, hinge.z);
    near((Math.max(...ys) - Math.min(...ys)) / 2, hinge.holeRadius);
  }
  s.pivotDiameter = 10;
  assert.ok(hingeDimensions(s).radius > hinge.radius);
  assert.ok(exportSVG(s).includes("Ø10"));
  assert.equal(p.filter((p) => p.group === "hinge-hardware").length, 2);
});
test("new settings survive JSON roundtrip and malformed construction options are blocked", () => {
  const s = {
    ...defaults("custom"),
    joint: "finger",
    fingerSize: 12,
    lidType: "hinged",
    lidHeight: 12,
    pivotDiameter: 8,
    lidOpening: 87,
  };
  assert.deepEqual(readProject(JSON.stringify(s)), s);
  assert.ok(validate({ ...s, pivotDiameter: 0 }).length);
  assert.ok(validate({ ...s, joint: "invalid" }).length);
  assert.ok(validate({ ...defaults("print"), lidType: "hinged" }).length);
});

import { familyFor } from "../src/models.js";
test("ten new product presets keep product identity and valid fabrication parameters", () => {
  const ids = [
    "tea",
    "jewelry",
    "pencilcase",
    "cards",
    "hardware",
    "pencilholder",
    "deskdrawers",
    "painttray",
    "compacthinge",
    "compactslider",
  ];
  for (const id of ids) {
    const s = defaults(id);
    assert.deepEqual(validate(s), [], id);
    assert.deepEqual(readProject(JSON.stringify(s)), s);
    assert.equal(s.model, id);
    assert.ok(familyFor(s));
    if (id === "painttray") {
      assert.equal(panels(s).length, 0);
      assert.ok(stlTriangles(s).length > 200);
    } else assert.ok(panels(s).length >= 5);
  }
  const tea = defaults("tea");
  assert.equal(tea.lidType, "hinged");
  assert.equal(tea.cols * tea.rows, 6);
  assert.ok(panels(tea).some((p) => p.name === "Divisória longitudinal 1"));
  const jewelry = defaults("jewelry");
  assert.equal(familyFor(jewelry), "custom");
  assert.equal(cuts(jewelry).widths.length, 2);
  assert.ok(panels(jewelry).some((p) => p.name === "Divisória à direita 2"));
  const drawer = defaults("deskdrawers");
  assert.equal(drawer.rows, 3);
  assert.equal(drawer.cols, 1);
  assert.equal(
    panels(drawer).filter((p) => p.name.includes("· base")).length,
    4,
  );
  const compact = defaults("compacthinge");
  assert.deepEqual(
    [compact.width, compact.depth, compact.height, compact.thickness],
    [106, 150, 50, 3],
  );
  const slider = defaults("compactslider");
  assert.deepEqual(
    [slider.width, slider.depth, slider.height, slider.thickness],
    [125, 100, 40, 3],
  );
});
test("3D miniature tray remains watertight and has eight integrated compartments", () => {
  const s = defaults("painttray");
  assert.equal(s.cols * s.rows, 8);
  assert.ok(checkManifold(stlTriangles(s)) > 0);
});
