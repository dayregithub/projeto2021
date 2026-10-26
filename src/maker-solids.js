import { familyFor } from "./models.js";
import {
  makerOutline,
  makerHoleCenter,
  makerArt,
  gearMetrics,
  gearOutline,
} from "./maker-products.js";
export function buildMakerParts(
  s,
  {
    Manifold,
    CrossSection,
    keep,
    union,
    subtract,
    intersect,
    translate,
    slab,
    box,
    meshTriangles,
    roundedOutline,
  },
) {
  const kind = familyFor(s),
    parts = [];
  const section = (rings) => keep(new CrossSection(rings, "EvenOdd"));
  const circle = (r, x = 0, y = 0, n = 48) =>
    translate([x, y], keep(CrossSection.circle(r, n)));
  const part = (id, name, solid, extra = {}) => {
    const components = solid.decompose().map(keep);
    if (solid.isEmpty() || solid.volume() <= 0)
      throw Error("A geometria ficou vazia. Ajuste as medidas.");
    parts.push({
      id,
      name,
      triangles: meshTriangles(solid),
      previewTriangles: meshTriangles(keep(solid.simplify(0.12))),
      volume: solid.volume(),
      componentCount: components.length,
      ...extra,
    });
  };
  if (kind === "gears") {
    const m = gearMetrics(s),
      z = s.makerGearBase ? s.thickness + s.clearance : 0;
    if (s.makerGearBase) {
      const base = slab(roundedOutline(m.width, m.depth, 5), 0, s.thickness);
      const pins = m.centers.map(([x, y]) =>
        slab(
          circle(m.shaftRadius, x, y),
          s.thickness - 0.03,
          s.height + s.clearance + 1.03,
        ),
      );
      part("base-eixos", "Base com eixos fixos", union(base, ...pins));
    }
    for (let i = 0; i < m.teeth.length; i++) {
      const profile = subtract(
        section([
          gearOutline(
            m.teeth[i],
            s.makerGearModule,
            s.makerGearBacklash,
            m.phases[i],
          ),
        ]),
        circle(s.makerBoreDiameter / 2),
      );
      const gear = translate(
        [m.centers[i][0], m.centers[i][1], 0],
        slab(profile, z, s.height),
      );
      part(
        "engrenagem-" + (i + 1),
        `Engrenagem ${i + 1} · ${m.teeth[i]} dentes`,
        gear,
        {
          gearCenter: m.centers[i],
          gearRatio: ((i % 2 ? -1 : 1) * m.teeth[0]) / m.teeth[i],
        },
      );
    }
    return parts;
  }
  if (kind === "roller") {
    const radius = s.depth / 2,
      outer = radius + s.makerRelief,
      circ = 2 * Math.PI * radius,
      pitch = s.makerPatternSpacing;
    const nx = Math.max(1, Math.floor(s.width / pitch)),
      ny = Math.max(6, Math.floor(circ / pitch)),
      motifs = [];
    const heart = () =>
      Array.from({ length: 40 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 40;
        return [
          (16 * Math.sin(a) ** 3) / 16,
          -(
            13 * Math.cos(a) -
            5 * Math.cos(2 * a) -
            2 * Math.cos(3 * a) -
            Math.cos(4 * a)
          ) / 16,
        ];
      });
    if (s.makerPattern === "stripes") {
      for (let j = 0; j < ny; j++)
        motifs.push(
          translate(
            [0, ((j + 0.5) * circ) / ny - pitch * 0.09],
            keep(CrossSection.square([s.width, pitch * 0.18])),
          ),
        );
    } else
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < ny; j++) {
          const x = ((i + 0.5) * s.width) / nx,
            y = ((j + 0.5) * circ) / ny;
          let shape;
          if (s.makerPattern === "dots")
            shape = keep(CrossSection.circle(pitch * 0.18, 24));
          else if (s.makerPattern === "hearts")
            shape = section([
              heart().map(([u, v]) => [u * pitch * 0.23, v * pitch * 0.23]),
            ]);
          else
            shape = section([
              [
                [-0.3, -0.23],
                [0, 0.08],
                [0.3, -0.23],
                [0.3, -0.02],
                [0, 0.3],
                [-0.3, -0.02],
              ].map(([u, v]) => [u * pitch, v * pitch]),
            ]);
          motifs.push(translate([x, y], shape));
        }
    const flat = slab(union(...motifs), -0.25, s.makerRelief + 0.25);
    const refined = keep(flat.refineToLength(1.5));
    const wrapped = keep(
      refined.warp((v) => {
        const a = v[1] / radius,
          r = radius + v[2];
        v[1] = r * Math.sin(a);
        v[2] = r * Math.cos(a);
      }),
    );
    let core = keep(
      keep(Manifold.cylinder(s.width, radius, radius, 72)).rotate([0, 90, 0]),
    );
    let solid = union(core, wrapped);
    if (s.makerHole)
      solid = subtract(
        solid,
        translate(
          [-1, 0, 0],
          keep(
            keep(
              Manifold.cylinder(
                s.width + 2,
                s.makerBoreDiameter / 2,
                s.makerBoreDiameter / 2,
                48,
              ),
            ).rotate([0, 90, 0]),
          ),
        ),
      );
    solid = translate([0, outer, outer], solid);
    part("rolo", "Rolo de textura", solid);
    parts[0].printTriangles = parts[0].triangles.map((tri) =>
      tri.map(([x, y, z]) => [-z, y, x]),
    );
    return parts;
  }
  const profile = section([makerOutline(s)]),
    art = makerArt(s),
    features = [];
  for (const glyph of art.glyphs) features.push(section(glyph));
  if (art.areas.length) features.push(section(art.areas.flat()));
  let relief = intersect(union(...features), profile);
  if (kind === "stamp" && s.makerMirror)
    relief = translate([s.width, 0], keep(relief.mirror([1, 0])));
  if (s.makerBorder) {
    const inner = keep(profile.offset(-s.makerBorderWidth));
    relief = union(relief, subtract(profile, inner));
  }
  let solid = union(
    slab(profile, 0, s.height),
    slab(relief, s.height - 0.03, s.makerRelief + 0.03),
  );
  if (kind === "relief" && s.makerHole) {
    const [x, y] = makerHoleCenter(s);
    solid = subtract(
      solid,
      slab(
        circle(s.makerBoreDiameter / 2, x, y),
        -1,
        s.height + s.makerRelief + 2,
      ),
    );
  }
  part(
    kind === "stamp" ? "matriz" : "plaquinha",
    kind === "stamp"
      ? s.makerMirror
        ? "Matriz espelhada do carimbo"
        : "Matriz do carimbo"
      : "Plaquinha em relevo",
    solid,
  );
  if (kind === "stamp" && s.makerHandle) {
    const w = Math.min(32, s.width * 0.55),
      d = Math.min(24, s.depth * 0.7),
      x = s.width + 15;
    const pedestal = slab(roundedOutline(w, d, 3, x, 0), 0, 3);
    const stem = slab(
      circle(Math.min(w, d) * 0.3, x + w / 2, d / 2),
      2.97,
      s.makerHandleHeight,
    );
    part("cabo", "Cabo para colar no verso", union(pedestal, stem));
  }
  return parts;
}
