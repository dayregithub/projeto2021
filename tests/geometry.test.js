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
test("legacy grid dividers intersect at matching half-depth slots and preserve compartment widths", () => {
  const s = { ...defaults("grid"), dividerJoint: "cross" },
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
  assert.ok(p.find((p) => p.name === "Gaveta 1.1 · frente").grip);
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
      const s = { ...defaults("grid"), joint, lidType, lidHeight: 20 };
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
  const s = {
      ...defaults("hinged"),
      hingeType: "hardware",
      lidJoint: "straight",
      pivotDiameter: 6,
    },
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
  assert.ok(
    panels(jewelry).some((p) => p.name === "Divisória transversal 2 · vão 2"),
  );
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

test("all laser assemblies have connected plates and no sampled material collisions at shared joints", () => {
  let seed = 8913;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const bounds = (p, t) => {
    const pts = p.shape
      .flat(2)
      .flatMap(([x, y]) =>
        [0, t].map((z) =>
          p.pose.origin.map(
            (v, i) =>
              v + p.pose.u[i] * x + p.pose.v[i] * y + p.pose.normal[i] * z,
          ),
        ),
      );
    return [0, 1, 2].map((i) => [
      Math.min(...pts.map((p) => p[i])),
      Math.max(...pts.map((p) => p[i])),
    ]);
  };
  for (const id of [
    "grid",
    "custom",
    "drawers",
    "lid",
    "sliding",
    "hinged",
    "heartbox",
  ])
    for (const joint of ["straight", "finger", "tslot"]) {
      const s = { ...defaults(id), joint, lidHeight: 20 };
      assert.deepEqual(validate(s), []);
      const ps = panels(s),
        t = s.thickness;
      for (const p of ps)
        assert.equal(p.shape.length, 1, `${id}/${joint}/${p.name} detached`);
      const bs = ps.map((p) => bounds(p, t));
      for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++) {
          const range = bs[i].map((p, k) => [
            Math.max(p[0], bs[j][k][0]),
            Math.min(p[1], bs[j][k][1]),
          ]);
          if (range.some(([lo, hi]) => hi - lo < 1e-5)) continue;
          for (let k = 0; k < 200; k++) {
            const point = range.map(
              ([lo, hi]) => lo + (0.001 + 0.998 * random()) * (hi - lo),
            );
            assert.ok(
              !(insidePanel(ps[i], point, t) && insidePanel(ps[j], point, t)),
              `${id}/${joint}: ${ps[i].name} overlaps ${ps[j].name} at ${point}`,
            );
          }
        }
    }
});

test("cut-out pivots fill keyed mortises, clear circular bearings and require no external shaft", () => {
  const s = defaults("compacthinge"),
    p = panels(s),
    t = s.thickness,
    hd = hingeDimensions(s);
  assert.equal(s.hingeType, "laser");
  assert.equal(p.filter((p) => p.role === "pivot-disc").length, 2);
  assert.equal(p.filter((p) => p.role === "pivot-key").length, 2);
  assert.equal(p.filter((p) => p.group === "hinge-hardware").length, 0);
  for (const key of p.filter((p) => p.role === "pivot-key")) {
    near(key.width, 2 * t + s.clearance);
    near(key.height, hd.keyHeight);
    const mid = key.pose.origin.map(
      (v, i) =>
        v +
        (key.pose.u[i] * key.width) / 2 +
        (key.pose.v[i] * key.height) / 2 +
        (key.pose.normal[i] * t) / 2,
    );
    assert.ok(insidePanel(key, mid, t));
    for (const fixed of p.filter(
      (p) =>
        p.role === "pivot-disc" ||
        p.role === "side" ||
        p.role?.startsWith("lid-"),
    ))
      assert.equal(
        insidePanel(fixed, mid, t),
        false,
        `${fixed.name} blocks the rectangular key`,
      );
  }
  assert.match(exportSVG(s), /2 discos-pivô e 2 eixos retangulares/);
});

test("integral lid shaft spans bearing centers and square section fits the circular bore", () => {
  const s = defaults("heartbox"),
    p = panels(s),
    hd = hingeDimensions(s),
    lid = p.find((p) => p.role === "lid-panel");
  assert.equal(p.length, 6);
  assert.ok(s.pivotDiameter > Math.SQRT2 * s.thickness + s.clearance);
  for (const x of [s.thickness / 2, s.width - s.thickness / 2]) {
    assert.ok(insidePanel(lid, [x, hd.y, hd.z], s.thickness));
    assert.ok(
      !p
        .filter((p) => p.role === "side")
        .some((p) => insidePanel(p, [x, hd.y, hd.z], s.thickness)),
    );
  }
  assert.ok(validate({ ...s, pivotDiameter: 3 }).length);
});

test("decorative cutouts stay inside connected lids and engraving exports as open vector paths on separate layers", () => {
  for (const lidType of ["removable", "sliding", "hinged"])
    for (const lidCutout of ["heart", "circle", "star", "flower"]) {
      const s = {
          ...defaults("open"),
          lidType,
          lidCutout,
          engraveName: "João & Ana",
          lidOpening: 0,
        },
        lid = panels(s).find((p) => p.role === "lid-panel");
      assert.deepEqual(validate(s), []);
      assert.equal(lid.shape.length, 1);
      assert.ok(lid.shape[0].length >= 2);
      assert.ok(lid.engravingPaths.length > 10);
      for (const line of lid.engravingPaths)
        for (const point of line)
          assert.ok(
            inRing(point, lid.shape[0][0]) &&
              !lid.shape[0].slice(1).some((r) => inRing(point, r)),
            "engraving crosses cutout or outer edge",
          );
      const svg = exportSVG(s),
        engrave = svg.split('id="ENGRAVE"')[1];
      assert.match(svg, /id="CUT"/);
      assert.match(engrave, /<path d="M/);
      assert.doesNotMatch(engrave, /Z|<text/);
      const dxf = exportDXF(s);
      assert.match(dxf, /8\nENGRAVE\n62\n5/);
      assert.match(dxf, /70\n0/);
      const restored = readProject({ ...s });
      assert.equal(restored.engraveName, s.engraveName);
      assert.equal(restored.lidCutout, lidCutout);
    }
  assert.ok(
    validate({ ...defaults("heartbox"), engraveName: "<script>" }).length,
  );
});

test("per-assembly overrides change real plates while printed solids retain their single-piece construction", () => {
  for (const [id, key] of [
    ["grid", "dividerJoint"],
    ["lid", "lidJoint"],
    ["sliding", "railJoint"],
    ["drawers", "drawerJoint"],
  ]) {
    const s = {
      ...defaults(id),
      joint: "straight",
      height: 240,
      lidHeight: 20,
    };
    const a = JSON.stringify(panels(s));
    for (const style of ["finger", "tslot"]) {
      const b = { ...s, [key]: style };
      assert.deepEqual(validate(b), []);
      assert.notEqual(JSON.stringify(panels(b)), a);
    }
  }
  for (const id of MODELS.filter((m) => m.category === "print").map(
    (m) => m.id,
  )) {
    const s = defaults(id);
    assert.equal(s.joint, "straight");
    assert.equal(s.lidType, "none");
    assert.ok(validate({ ...s, joint: "finger" }).length);
  }
});

test("sliding pull stays flush with the body rim for every joint and thickness, with real lid contacts", () => {
  for (const thickness of [1, 2, 3, 5, 8, 12])
    for (const lidJoint of ["straight", "finger", "tslot"]) {
      const s = {
        ...defaults("sliding"),
        width: 220,
        depth: 200,
        height: 120,
        thickness,
        lidJoint,
      };
      assert.deepEqual(validate(s), []);
      const p = panels(s),
        handle = p.find((p) => p.role === "lid-handle"),
        lid = p.find((p) => p.role === "lid-panel"),
        front = p.find((p) => p.role === "front");
      const zs = handle.shape
        .flat(2)
        .map(
          ([x, y]) =>
            handle.pose.origin[2] + handle.pose.u[2] * x + handle.pose.v[2] * y,
        );
      near(Math.max(...zs), s.height);
      assert.ok(
        Math.min(...zs) >= front.pose.origin[2] + s.clearance - 1e-6,
        "pull hits front wall",
      );
      assert.equal(handle.shape.length, 1);
      assert.equal(lid.shape.length, 1);
      if (lidJoint === "finger")
        assert.ok(
          handle.shape[0][0].length > 4 && lid.shape[0][0].length > 4,
          "pull needs edge notches matching lid fingers",
        );
      if (lidJoint === "tslot") {
        assert.equal(handle.m3Fasteners, 1);
        assert.ok(
          handle.shape[0].some((r) => r.length > 20),
          "pull needs a closed M3 hole",
        );
      }
      assert.ok(lid.pose.origin[1] + lid.height <= s.depth + 1e-6);
    }
});

test("integral laser lid reaches the shaft without an open window", () => {
  const s = defaults("heartbox"),
    lid = panels(s).find((p) => p.role === "lid-panel"),
    hd = hingeDimensions(s);
  for (const x of [s.width * 0.25, s.width * 0.5, s.width * 0.75])
    for (const y of [hd.y + s.thickness, s.thickness / 2])
      assert.ok(
        insidePanel(lid, [x, y, s.height], s.thickness),
        "gap remains behind the decorative panel",
      );
});

test("every drawer has an open-top finger pull in real cut geometry", () => {
  for (const id of ["drawers", "deskdrawers"])
    for (const joint of ["straight", "finger", "tslot"]) {
      const s = { ...defaults(id), joint };
      assert.deepEqual(validate(s), []);
      const fronts = panels(s).filter(
        (p) => p.group === "drawer" && p.role === "front",
      );
      assert.equal(fronts.length, s.rows * s.cols);
      for (const p of fronts) {
        assert.ok(p.grip);
        assert.equal(p.grip.y, 0);
        const z = p.pose.origin[2] - 0.5,
          y = p.pose.origin[1] + s.thickness / 2,
          x = p.pose.origin[0] + p.grip.x;
        assert.equal(insidePanel(p, [x, y, z], s.thickness), false);
        assert.ok(insidePanel(p, [x + p.grip.r + 2, y, z], s.thickness));
        assert.equal(p.shape.length, 1);
      }
    }
});

import { printParts, printLayout } from "../src/print3d.js";
test("rounded printed bodies and all three lids are watertight, connected and clear of the body", () => {
  for (const model of ["print", "printgrid"])
    for (const cornerRadius of [0, 8, 40])
      for (const printLid of ["none", "inner", "outer", "hinged"]) {
        const s = { ...defaults(model), cornerRadius, printLid },
          parts = printParts(s);
        assert.deepEqual(validate(s), []);
        assert.equal(
          parts.length,
          printLid === "none" ? 1 : printLid === "hinged" ? 3 : 2,
        );
        for (const p of parts) {
          assert.ok(
            checkManifold(p.triangles) > 0,
            `${model}/${cornerRadius}/${printLid}/${p.id}`,
          );
          if (p.id !== "pino") assert.equal(p.componentCount, 1);
        }
        near(parts[0].lidInterference, 0);
        for (const p of printLayout(s)) {
          const points = p.triangles.flat();
          near(Math.min(...points.map((v) => v[2])), 0);
        }
        const restored = readProject(s);
        assert.equal(restored.cornerRadius, cornerRadius);
        assert.equal(restored.printLid, printLid);
      }
  assert.ok(validate({ ...defaults("print"), cornerRadius: 999 }).length);
});

import { projectPackage, projectPDF, projectSTL } from "../src/package.js";
import { unzipSync, strFromU8 } from "fflate";
test("quote ZIP includes all formats with valid PDF, editable parameters and individual printed parts", () => {
  for (const id of ["heartbox", "printgrid"]) {
    const s = {
        ...defaults(id),
        cornerRadius: 8,
        printLid: id === "printgrid" ? "hinged" : "none",
      },
      bundle = projectPackage(s, "Quantidade: 3"),
      files = unzipSync(bundle.data),
      names = Object.keys(files);
    for (const extension of [".svg", ".dxf", ".pdf", ".stl", ".papeled.json"])
      assert.ok(
        names.some((n) => n.endsWith(extension)),
        extension,
      );
    const pdf = files[names.find((n) => n.endsWith(".pdf"))];
    assert.ok(strFromU8(pdf.slice(0, 5)).startsWith("%PDF-"));
    assert.ok(strFromU8(pdf).includes("%%EOF"));
    assert.equal(
      JSON.parse(strFromU8(files[names.find((n) => n.endsWith(".json"))]))
        .model,
      id,
    );
    assert.equal(strFromU8(files["pedido-de-orcamento.txt"]), "Quantidade: 3");
    assert.match(
      strFromU8(files[names.find((n) => n.endsWith(".stl"))]),
      /facet normal/,
    );
    if (id === "printgrid") {
      assert.equal(names.filter((n) => n.startsWith("pecas/")).length, 3);
      assert.match(
        strFromU8(files[names.find((n) => n.endsWith(".svg"))]),
        /REFERENCE/,
      );
    } else {
      const pdfText = strFromU8(pdf);
      assert.match(pdfText, /\/MediaBox/);
      assert.match(
        strFromU8(files[names.find((n) => n.endsWith(".svg"))]),
        /id="CUT"/,
      );
    }
  }
});

import {
  CATALOG_GROUPS,
  catalogGroupFor,
  variationsFor,
  findCatalogGroups,
} from "../src/models.js";
test("catalog groups share construction and preserve every distinct preset ID", () => {
  assert.equal(CATALOG_GROUPS.length, 5);
  assert.equal(variationsFor("laser-boxes").length, 15);
  assert.equal(variationsFor("laser-drawers").length, 2);
  assert.equal(variationsFor("printed-boxes").length, 3);
  const members = CATALOG_GROUPS.flatMap((g) =>
    variationsFor(g).map((m) => m.id),
  );
  assert.equal(new Set(members).size, MODELS.length);
  for (const m of MODELS) {
    assert.ok(catalogGroupFor(m.id));
    assert.equal(readProject(defaults(m.id)).model, m.id);
  }
  assert.equal(
    findCatalogGroups({ term: "coração" })[0].matches[0].id,
    "heartbox",
  );
  assert.equal(findCatalogGroups({ category: "print" }).length, 3);
  assert.equal(findCatalogGroups({ term: "xyzsemresultado" }).length, 0);
});

import { drawerGripDimensions } from "../src/assemblies.js";
test("drawer pull width changes every notch, respects panel limits and survives project import", () => {
  for (const id of ["drawers", "deskdrawers"])
    for (const joint of ["straight", "finger", "tslot"]) {
      let previous = "";
      for (const drawerGripWidth of [4, 12, 24, 80]) {
        const s = { ...defaults(id), joint, drawerGripWidth },
          g = drawerDimensions(s),
          grip = drawerGripDimensions(s, g),
          p = panels(s);
        assert.deepEqual(validate(s), []);
        assert.ok(
          grip.width <= g.dw / 3 && grip.depth <= (g.dh - s.thickness) / 4,
        );
        for (const front of p.filter(
          (p) => p.group === "drawer" && p.role === "front",
        )) {
          near(front.grip.r, grip.width / 2);
          assert.equal(front.shape.length, 1);
          const center = [
            front.pose.origin[0] + front.grip.x,
            front.pose.origin[1] + s.thickness / 2,
            front.pose.origin[2] - grip.depth * 0.8,
          ];
          assert.equal(insidePanel(front, center, s.thickness), false);
        }
        const svg = exportSVG(s);
        if (drawerGripWidth <= 24) assert.notEqual(svg, previous);
        previous = svg;
        assert.equal(readProject(s).drawerGripWidth, drawerGripWidth);
      }
    }
  const old = defaults("drawers");
  delete old.drawerGripWidth;
  assert.equal(readProject(old).drawerGripWidth, 18);
  for (const drawerGripWidth of [NaN, 0, 81, "20"])
    assert.ok(validate({ ...defaults("drawers"), drawerGripWidth }).length);
});

import { LETTER_FONTS, letterContours } from "../src/lettering.js";
import { brushOpenings } from "../src/print3d.js";
test("toothbrush holder supports both shapes and closed or perforated fitted lids", () => {
  for (const brushShape of ["round", "square"])
    for (const printLid of ["none", "outer"])
      for (const brushHoles of [0, 1, 4, 6]) {
        const s = {
            ...defaults("toothbrush"),
            brushShape,
            printLid,
            brushHoles,
          },
          parts = printParts(s);
        assert.deepEqual(validate(s), []);
        assert.equal(parts.length, printLid === "none" ? 1 : 2);
        for (const p of parts) {
          assert.equal(p.componentCount, 1);
          assert.ok(checkManifold(p.triangles) > 0);
        }
        near(parts[0].lidInterference, 0);
        if (printLid === "outer" && brushHoles)
          assert.ok(brushOpenings(s).radius >= 2);
        const read = readProject(s);
        assert.equal(read.brushShape, brushShape);
        assert.equal(read.brushHoles, brushHoles);
      }
  assert.ok(
    validate({ ...defaults("toothbrush"), brushShape: "triangle" }).length,
  );
  assert.ok(validate({ ...defaults("toothbrush"), depth: 80 }).length);
});
test("all ten real lettering fonts produce distinct, watertight text with preserved counters and accents", () => {
  assert.equal(LETTER_FONTS.length, 10);
  const volumes = [];
  for (const font of LETTER_FONTS) {
    const s = {
        ...defaults("lettering"),
        signText: "O",
        signFont: font.id,
        signBase: false,
      },
      p = printParts(s)[0],
      rings = letterContours(s).glyphs.flat(),
      area = (r) =>
        r.reduce((n, a, i) => {
          const b = r[(i + 1) % r.length];
          return n + a[0] * b[1] - b[0] * a[1];
        }, 0) / 2;
    assert.deepEqual(validate(s), []);
    const volume = checkManifold(p.triangles);
    assert.ok(
      Math.abs(
        volume - Math.abs(rings.reduce((n, r) => n + area(r), 0)) * s.height,
      ) < 0.05,
      font.id + " counter area mismatch",
    );
    volumes.push(volume.toFixed(1));
    const name = { ...s, signText: "João & Ana", signBase: true },
      parts = printParts(name);
    assert.equal(parts[0].componentCount, 1);
    assert.ok(checkManifold(parts[0].triangles) > 0);
    assert.equal(readProject(name).signFont, font.id);
  }
  assert.equal(new Set(volumes).size, 10);
  for (const signText of ["", "   ", "🚀", "<script>"])
    assert.ok(validate({ ...defaults("lettering"), signText }).length);
  assert.ok(validate({ ...defaults("lettering"), signFont: "unknown" }).length);
});

test("brush cover clears both lid options; all three textures and drainage remain solid and printable", () => {
  for (const brushShape of ["round", "square"])
    for (const brushTexture of ["ribbed", "rings", "dots"])
      for (const printLid of ["none", "outer"]) {
        const s = {
          ...defaults("toothbrush"),
          brushShape,
          brushTexture,
          printLid,
          brushCover: true,
        };
        assert.deepEqual(validate(s), []);
        const parts = printParts(s),
          cover = parts.find((p) => p.id === "cobertura");
        assert.equal(parts.length, printLid === "none" ? 2 : 3);
        near(cover.bodyInterference, 0);
        near(cover.lidInterference, 0);
        for (const part of parts) {
          assert.equal(part.componentCount, 1);
          assert.ok(checkManifold(part.triangles) > 0);
        }
        assert.deepEqual(readProject(s), s);
      }
  const s = defaults("toothbrush"),
    drained = printParts(s)[0];
  assert.ok(drained.volume < printParts({ ...s, brushDrain: false })[0].volume);
  // A vertical ray through the center drain must not hit the bottom at all.
  const x = s.width / 2,
    y = s.depth / 2;
  for (const tri of drained.triangles) {
    const [a, b, c] = tri,
      denominator =
        (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(denominator) < 1e-9) continue;
    const u =
      ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator;
    const v =
      ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator;
    assert.ok(!(u >= 0 && v >= 0 && u + v <= 1), "center drainage blocked");
  }
  const old = { ...s };
  delete old.brushDrain;
  assert.equal(readProject(old).brushDrain, false);
  for (const patch of [
    { brushTexture: "invalid" },
    { brushCoverHeight: 0 },
    { brushDrainDiameter: NaN },
  ])
    assert.ok(validate({ ...s, ...patch }).length);
});

test("standing letters support accents on their base and joined letters form a single solid even without a base", () => {
  for (const { id } of LETTER_FONTS) {
    for (const signOrientation of ["flat", "standing"]) {
      const s = {
        ...defaults("lettering"),
        signText: "João & Ana",
        signFont: id,
        signOrientation,
        signJoin: true,
        signSpacing: -10,
        signBase: signOrientation === "standing",
      };
      assert.deepEqual(validate(s), []);
      const p = printParts(s)[0];
      assert.equal(p.componentCount, 1, id + " " + signOrientation);
      assert.ok(checkManifold(p.triangles) > 0);
      near(Math.min(...p.triangles.flat().map((v) => v[2])), 0);
      assert.deepEqual(readProject(s), s);
    }
  }
  assert.ok(
    validate({
      ...defaults("lettering"),
      signOrientation: "standing",
      signBase: false,
    }).length,
  );
  assert.ok(validate({ ...defaults("lettering"), signSpacing: -90 }).length);
  const s = { ...defaults("lettering"), width: 500, signText: "Ana" };
  assert.ok(
    letterContours({ ...s, signSpacing: -20 }).width < letterContours(s).width,
  );
});

test("laser fit width adjusts only finger and T receivers, preserving cross slots and pivot holes", async () => {
  const { fitWidth } = await import("../src/joinery.js");
  const grid = { ...defaults("grid"), dividerJoint: "cross", slotWidth: 2.8 };
  assert.deepEqual(validate(grid), []);
  const slots = panels(grid).flatMap((p) => p.slots);
  assert.ok(slots.length > 0);
  slots.forEach((s) => near(s.width, 3));
  assert.equal(grid.thickness, 3);
  assert.equal(readProject({ ...grid, version: 1 }).slotWidth, 2.8);
  const old = { ...grid };
  delete old.slotWidth;
  assert.equal(fitWidth(readProject(old)), 3);
  assert.ok(validate({ ...grid, slotWidth: 0 }).length);
  assert.ok(validate({ ...grid, slotWidth: 5 }).length);
  for (const m of MODELS.filter((m) => m.category === "laser")) {
    const s = { ...defaults(m.id), slotWidth: 2.9 };
    assert.deepEqual(validate(s), [], m.id);
    assert.ok(panels(s).length >= 5, m.id);
    assert.match(exportSVG(s), /2.9 mm para chapa/);
  }
  const hinged = { ...defaults("hinged"), hingeType: "laser", slotWidth: 2.8 };
  const disc = panels(hinged).find((p) => p.role === "pivot-disc");
  assert.ok(disc);
  const hole = disc.shape[0][1];
  near(
    Math.max(...hole.map((v) => v[0])) - Math.min(...hole.map((v) => v[0])),
    3,
  );
  const { joinContact, makePanel, rectanglePose } =
    await import("../src/joinery.js");
  for (const joint of ["finger", "tslot"]) {
    const receiver = makePanel("Receptor", 100, 100, rectanglePose(0, 0, 0));
    const male = makePanel(
      "Aba",
      100,
      30,
      rectanglePose(0, 50, 30, [1, 0, 0], [0, 0, -1], [0, 1, 0]),
    );
    joinContact(receiver, male, [0, 50, 0], [100, 50, 0], [0, 0, -1], joint, {
      ...grid,
      joint,
    });
    const holes = receiver.shape.flatMap((poly) => poly.slice(1));
    assert.ok(
      holes.some(
        (h) =>
          Math.abs(
            Math.max(...h.map((v) => v[1])) -
              Math.min(...h.map((v) => v[1])) -
              2.8,
          ) < 1e-6,
      ),
    );
  }
});

test("profile hinge stays inside the closed box footprint and exports keyed pivots", () => {
  for (const [joint, lidJoint] of ["straight", "finger", "tslot"].flatMap(
    (joint) =>
      ["straight", "finger", "tslot"].map((lidJoint) => [joint, lidJoint]),
  )) {
    const s = {
      ...defaults("compacthinge"),
      hingeType: "profile",
      joint,
      lidJoint,
      lidHeight: 18,
      height: 65,
      lidOpening: 0,
    };
    assert.deepEqual(validate(s), []);
    const ps = panels(s),
      hd = hingeDimensions(s),
      t = s.thickness;
    assert.ok(hd.y - hd.radius >= t);
    assert.ok(hd.z + hd.radius <= s.height);
    assert.equal(ps.filter((p) => p.role === "pivot-disc").length, 2);
    assert.equal(ps.filter((p) => p.role === "pivot-key").length, 2);
    assert.equal(ps.filter((p) => p.group === "hinge-hardware").length, 0);
    for (const p of ps) {
      assert.equal(p.shape.length, 1, `${joint}/${p.name} detached`);
      if (joint === "tslot" && p.group !== "lid" && p.group !== "hinge-cut")
        continue;
      for (const [u, v] of panelPolygons(p).flat(2))
        for (const level of [0, t]) {
          const xyz = p.pose.origin.map(
            (n, i) =>
              n + p.pose.u[i] * u + p.pose.v[i] * v + p.pose.normal[i] * level,
          );
          assert.ok(
            xyz[0] >= -1e-6 && xyz[0] <= s.width + 1e-6,
            `${joint}/${p.name} exceeds width ${xyz}`,
          );
          assert.ok(
            xyz[1] >= -1e-6 && xyz[1] <= s.depth + 1e-6,
            `${joint}/${p.name} exceeds depth ${xyz}`,
          );
        }
    }
    assert.match(exportSVG(s), /Tampa articulada alinhada ao perfil/);
    assert.equal(readProject(JSON.stringify(s)).hingeType, "profile");
    assert.ok(validate({ ...s, height: 20 }).length);
    assert.ok(validate({ ...s, lidOpening: 110 }).length);
  }
});
test("profile hinge moving lid clears body and lowered dividers throughout its preview travel", () => {
  for (const [joint, lidJoint] of ["straight", "finger", "tslot"].flatMap(
    (joint) =>
      ["straight", "finger", "tslot"].map((lidJoint) => [joint, lidJoint]),
  )) {
    const s = {
      ...defaults("grid"),
      lidType: "hinged",
      hingeType: "profile",
      joint,
      lidJoint,
      lidHeight: 18,
      height: 80,
    };
    assert.deepEqual(validate(s), []);
    const hd = hingeDimensions(s),
      t = s.thickness,
      ps = panels(s);
    for (const degrees of [0, 10, 30, 50, 70, 90, 100]) {
      const a = (degrees * Math.PI) / 180;
      const rotate = (v, point = false) => {
        const dy = v[1] - (point ? hd.y : 0),
          dz = v[2] - (point ? hd.z : 0);
        return [
          v[0],
          (point ? hd.y : 0) + dy * Math.cos(a) - dz * Math.sin(a),
          (point ? hd.z : 0) + dy * Math.sin(a) + dz * Math.cos(a),
        ];
      };
      const parts = ps.map((p) =>
        p.group === "lid"
          ? {
              ...p,
              pose: {
                origin: rotate(p.pose.origin, true),
                u: rotate(p.pose.u),
                v: rotate(p.pose.v),
                normal: rotate(p.pose.normal),
              },
            }
          : p,
      );
      const bounds = parts.map((p) => {
        const vertices = panelPolygons(p)
          .flat(2)
          .flatMap(([u, v]) =>
            [0, t].map((level) =>
              p.pose.origin.map(
                (n, i) =>
                  n +
                  p.pose.u[i] * u +
                  p.pose.v[i] * v +
                  p.pose.normal[i] * level,
              ),
            ),
          );
        return [0, 1, 2].map((i) => [
          Math.min(...vertices.map((v) => v[i])),
          Math.max(...vertices.map((v) => v[i])),
        ]);
      });
      let seed = 12345;
      const random = () =>
        (seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32;
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++) {
          if (parts[i].group !== "lid" && parts[j].group !== "lid") continue;
          const range = bounds[i].map((r, k) => [
            Math.max(r[0], bounds[j][k][0]),
            Math.min(r[1], bounds[j][k][1]),
          ]);
          if (range.some(([lo, hi]) => hi - lo < 1e-5)) continue;
          for (let sample = 0; sample < 400; sample++) {
            const point = range.map(
              ([lo, hi]) => lo + (0.001 + 0.998 * random()) * (hi - lo),
            );
            assert.ok(
              !(
                insidePanel(parts[i], point, t) &&
                insidePanel(parts[j], point, t)
              ),
              `${joint}/${degrees}: ${parts[i].name} overlaps ${parts[j].name} at ${point}`,
            );
          }
        }
    }
  }
});
