import clipping from "polygon-clipping";
import { modelById } from "./models.js";
import { makePanel, reshape, rectangle, rectanglePose } from "./joinery.js";

export const TOY_THEMES = {
  fish: "Peixe",
  turtle: "Tartaruga",
  butterfly: "Borboleta",
};
export const isEducational = (s) => modelById(s.model)?.family === "education";
export const educationalKind = (s) => modelById(s.model)?.toyKind;
const area = (r) =>
  r.reduce((a, p, i) => {
    const q = r[(i + 1) % r.length];
    return a + p[0] * q[1] - p[1] * q[0];
  }, 0) / 2;
const ringShape = (r) => [[r]];
const ellipse = (x, y, rx, ry, n = 64) =>
  Array.from({ length: n }, (_, i) => [
    x + rx * Math.cos((i * 2 * Math.PI) / n),
    y + ry * Math.sin((i * 2 * Math.PI) / n),
  ]);
const closed = (r) => [...r, r[0]];
// Parallel inset of convex contours: the entered clearance applies to every
// edge, rather than shrinking only the bounding box of a triangle or polygon.
export function insetConvex(r, distance) {
  const sign = Math.sign(area(r));
  const edges = r.map((p, i) => {
    const q = r[(i + 1) % r.length],
      dx = q[0] - p[0],
      dy = q[1] - p[1],
      len = Math.hypot(dx, dy);
    return {
      p: [
        p[0] - ((sign * dy) / len) * distance,
        p[1] + ((sign * dx) / len) * distance,
      ],
      v: [dx, dy],
    };
  });
  return edges.map((b, i) => {
    const a = edges[(i + edges.length - 1) % edges.length],
      det = a.v[0] * b.v[1] - a.v[1] * b.v[0];
    const d = [b.p[0] - a.p[0], b.p[1] - a.p[1]],
      t = (d[0] * b.v[1] - d[1] * b.v[0]) / det;
    return [a.p[0] + t * a.v[0], a.p[1] + t * a.v[1]];
  });
}
export const TANGRAM = [
  {
    name: "Triângulo grande 1",
    points: [
      [0, 0],
      [4, 0],
      [2, 2],
    ],
  },
  {
    name: "Triângulo grande 2",
    points: [
      [0, 0],
      [2, 2],
      [0, 4],
    ],
  },
  {
    name: "Triângulo médio",
    points: [
      [4, 2],
      [4, 4],
      [2, 4],
    ],
  },
  {
    name: "Triângulo pequeno 1",
    points: [
      [2, 2],
      [3, 1],
      [3, 3],
    ],
  },
  {
    name: "Quadrado",
    points: [
      [2, 2],
      [3, 3],
      [2, 4],
      [1, 3],
    ],
  },
  {
    name: "Triângulo pequeno 2",
    points: [
      [0, 4],
      [1, 3],
      [2, 4],
    ],
  },
  {
    name: "Paralelogramo",
    points: [
      [4, 0],
      [4, 2],
      [3, 3],
      [3, 1],
    ],
  },
];
export function toyMetrics(s) {
  const margin = Math.max(12, 3 * s.thickness),
    kind = educationalKind(s);
  const innerWidth = s.width - 2 * margin,
    innerDepth = s.depth - 2 * margin;
  const cols =
    kind === "picture"
      ? s.toyCols
      : kind === "shapes"
        ? Math.ceil(Math.sqrt(s.toyShapeCount))
        : 1;
  const rows =
    kind === "picture"
      ? s.toyRows
      : kind === "shapes"
        ? Math.ceil(s.toyShapeCount / cols)
        : 1;
  return {
    margin,
    innerWidth,
    innerDepth,
    cols,
    rows,
    pieceWidth: innerWidth / cols,
    pieceDepth: innerDepth / rows,
    count:
      kind === "picture"
        ? cols * rows
        : kind === "shapes"
          ? s.toyShapeCount
          : 7,
    totalHeight: 2 * s.thickness,
  };
}
export function validateEducational(s) {
  const errors = [];
  for (const [key, label, min, max] of [
    ["width", "Largura", 100, 600],
    ["depth", "Profundidade", 100, 600],
    ["thickness", "Espessura", 2, 6],
    ["toyGap", "Folga por borda", 0.1, 1.5],
    ["toyLift", "Elevação na prévia", 0, 50],
  ])
    if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max)
      errors.push(`${label}: use de ${min} a ${max} mm.`);
  if (s.height !== 2 * s.thickness)
    errors.push(
      "A altura da base montada deve corresponder a duas camadas da chapa.",
    );
  if (
    !Number.isInteger(s.toyCols) ||
    s.toyCols < 2 ||
    s.toyCols > 4 ||
    !Number.isInteger(s.toyRows) ||
    s.toyRows < 2 ||
    s.toyRows > 4
  )
    errors.push("Quebra-cabeça: use de 2 a 4 linhas e colunas.");
  if (
    !Number.isInteger(s.toyShapeCount) ||
    s.toyShapeCount < 3 ||
    s.toyShapeCount > 6
  )
    errors.push("Encaixe: escolha de 3 a 6 formas.");
  if (!Object.hasOwn(TOY_THEMES, s.toyTheme))
    errors.push("Escolha uma figura disponível.");
  if (typeof s.toyGuide !== "boolean")
    errors.push("Escolha se deseja gravar o guia na base.");
  if (errors.length) return errors;
  const m = toyMetrics(s),
    kind = educationalKind(s);
  if (
    kind === "picture" &&
    Math.min(m.pieceWidth, m.pieceDepth) - 2 * s.toyGap < 35
  )
    errors.push(
      "Cada peça deve ter pelo menos 35 mm. Aumente a base ou reduza linhas e colunas.",
    );
  if (
    kind === "shapes" &&
    Math.min(m.pieceWidth, m.pieceDepth) * 0.46 - 2 * s.toyGap < 35
  )
    errors.push(
      "As formas ficaram pequenas. Aumente a base ou reduza a quantidade.",
    );
  if (
    kind === "tangram" &&
    Math.min(m.innerWidth, m.innerDepth) / 4 - 2 * s.toyGap < 25
  )
    errors.push("Aumente a base do tangram para preservar as sete peças.");
  return errors;
}
function illustration(theme) {
  if (theme === "fish")
    return [
      closed([
        [15, 50],
        [3, 28],
        [3, 72],
        [15, 50],
        [30, 25],
        [65, 25],
        [88, 50],
        [65, 75],
        [30, 75],
        [15, 50],
      ]),
      closed(ellipse(68, 43, 3, 3)),
      [
        [40, 28],
        [47, 50],
        [40, 72],
      ],
      [
        [33, 37],
        [25, 50],
        [33, 63],
      ],
      [
        [51, 34],
        [58, 50],
        [51, 66],
      ],
    ];
  if (theme === "turtle")
    return [
      closed(ellipse(50, 52, 29, 30)),
      closed(ellipse(50, 12, 10, 9)),
      closed(ellipse(15, 32, 9, 6)),
      closed(ellipse(15, 75, 9, 6)),
      closed(ellipse(85, 32, 9, 6)),
      closed(ellipse(85, 75, 9, 6)),
      [
        [47, 83],
        [50, 95],
        [53, 83],
      ],
      closed([
        [40, 37],
        [60, 37],
        [67, 53],
        [60, 68],
        [40, 68],
        [33, 53],
      ]),
      [
        [40, 37],
        [32, 26],
      ],
      [
        [60, 37],
        [68, 26],
      ],
      [
        [67, 53],
        [79, 53],
      ],
      [
        [60, 68],
        [68, 78],
      ],
      [
        [40, 68],
        [32, 78],
      ],
      [
        [33, 53],
        [21, 53],
      ],
    ];
  return [
    closed(ellipse(28, 32, 22, 26)),
    closed(ellipse(72, 32, 22, 26)),
    closed(ellipse(30, 73, 19, 20)),
    closed(ellipse(70, 73, 19, 20)),
    closed(ellipse(50, 55, 5, 35)),
    [
      [48, 20],
      [40, 7],
      [35, 5],
    ],
    [
      [52, 20],
      [60, 7],
      [65, 5],
    ],
    closed(ellipse(27, 31, 9, 12)),
    closed(ellipse(73, 31, 9, 12)),
    closed(ellipse(30, 73, 7, 8)),
    closed(ellipse(70, 73, 7, 8)),
  ];
}
const insideRing = (p, r) => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if (
      r[i][1] > p[1] !== r[j][1] > p[1] &&
      p[0] <
        ((r[j][0] - r[i][0]) * (p[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
    )
      inside = !inside;
  return inside;
};
const inside = (p, shape) =>
  shape.some(
    (poly) =>
      insideRing(p, poly[0]) && !poly.slice(1).some((r) => insideRing(p, r)),
  );
// Clip engraving segments against the actual cut contour (including the grip
// notch). No blue engraving segment is allowed to cross outside a loose tile.
export function clipToyEngraving(paths, shape) {
  const result = [];
  for (const path of paths)
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i],
        v = [b[0] - a[0], b[1] - a[1]],
        ts = [0, 1];
      for (const ring of shape.flat())
        for (let j = 0; j < ring.length; j++) {
          const c = ring[j],
            d = ring[(j + 1) % ring.length],
            w = [d[0] - c[0], d[1] - c[1]],
            det = v[0] * w[1] - v[1] * w[0];
          if (Math.abs(det) < 1e-10) continue;
          const q = [c[0] - a[0], c[1] - a[1]],
            t = (q[0] * w[1] - q[1] * w[0]) / det,
            u = (q[0] * v[1] - q[1] * v[0]) / det;
          if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
        }
      ts.sort((x, y) => x - y);
      for (let j = 1; j < ts.length; j++) {
        const p = (t) => [a[0] + v[0] * t, a[1] + v[1] * t];
        if (
          ts[j] - ts[j - 1] > 1e-8 &&
          inside(p((ts[j] + ts[j - 1]) / 2), shape)
        )
          result.push([p(ts[j - 1]), p(ts[j])]);
      }
    }
  return result;
}
export function buildEducationalPanels(s) {
  const m = toyMetrics(s),
    kind = educationalKind(s),
    t = s.thickness,
    c = s.toyGap;
  const frame = makePanel(
    "Moldura · colar sobre a base",
    s.width,
    s.depth,
    rectanglePose(0, 0, t),
    { group: "toy-frame" },
  );
  const base = makePanel(
    "Base · camada inferior",
    s.width,
    s.depth,
    rectanglePose(0, 0, 0),
    { role: "base" },
  );
  const parts = [base, frame],
    guides = [];
  const addPiece = (name, shape, engraving = []) => {
    const p = reshape(
      makePanel(name, 1, 1, rectanglePose(0, 0, t), { group: "toy-piece" }),
      shape,
    );
    p.engravingPaths = engraving.map((path) =>
      path.map(([x, y]) => [x - p.pose.origin[0], y - p.pose.origin[1]]),
    );
    parts.push(p);
  };
  const remove = (shape) =>
    reshape(frame, clipping.difference(frame.shape, shape));
  const grip = (x, y, r = 5) => ringShape(ellipse(x, y, r, r, 32));
  if (kind === "picture") {
    const image = illustration(s.toyTheme).map((path) =>
      path.map(([x, y]) => [
        m.margin + (x / 100) * m.innerWidth,
        m.margin + (y / 100) * m.innerDepth,
      ]),
    );
    remove(rectangle(m.margin, m.margin, m.innerWidth, m.innerDepth));
    for (let row = 0; row < m.rows; row++)
      for (let col = 0; col < m.cols; col++) {
        const x = m.margin + col * m.pieceWidth + c,
          y = m.margin + row * m.pieceDepth + c,
          w = m.pieceWidth - 2 * c,
          h = m.pieceDepth - 2 * c;
        const shape = clipping.difference(
          rectangle(x, y, w, h),
          grip(x + w / 2, y),
        );
        addPiece(
          `Figura · linha ${row + 1}, coluna ${col + 1}`,
          shape,
          clipToyEngraving(image, shape),
        );
      }
    guides.push(...image);
  } else if (kind === "tangram") {
    const side = Math.min(m.innerWidth, m.innerDepth),
      x = (s.width - side) / 2,
      y = (s.depth - side) / 2;
    remove(clipping.union(rectangle(x, y, side, side), grip(x + side / 2, y)));
    for (const piece of TANGRAM) {
      const ring = piece.points.map(([u, v]) => [
        x + (u * side) / 4,
        y + (v * side) / 4,
      ]);
      addPiece(piece.name, ringShape(insetConvex(ring, c)));
      guides.push(closed(ring));
    }
  } else {
    const names = [
      "Círculo",
      "Quadrado",
      "Triângulo",
      "Hexágono",
      "Pentágono",
      "Elipse",
    ];
    for (let i = 0; i < s.toyShapeCount; i++) {
      const cx = m.margin + ((i % m.cols) + 0.5) * m.pieceWidth,
        cy = m.margin + (Math.floor(i / m.cols) + 0.5) * m.pieceDepth,
        r = Math.min(m.pieceWidth, m.pieceDepth) * 0.32;
      const ring =
        i === 0
          ? ellipse(cx, cy, r, r)
          : i === 1
            ? [
                [cx - r, cy - r],
                [cx + r, cy - r],
                [cx + r, cy + r],
                [cx - r, cy + r],
              ]
            : i === 5
              ? ellipse(cx, cy, r, r * 0.72)
              : Array.from(
                  { length: i === 2 ? 3 : i === 3 ? 6 : 5 },
                  (_, j) => [
                    cx +
                      r *
                        Math.cos(
                          -Math.PI / 2 +
                            (j * 2 * Math.PI) / (i === 2 ? 3 : i === 3 ? 6 : 5),
                        ),
                    cy +
                      r *
                        Math.sin(
                          -Math.PI / 2 +
                            (j * 2 * Math.PI) / (i === 2 ? 3 : i === 3 ? 6 : 5),
                        ),
                  ],
                );
      const top = ring.reduce((a, b) => (a[1] < b[1] ? a : b));
      remove(clipping.union(ringShape(ring), grip(top[0], top[1])));
      addPiece(`Forma ${i + 1} · ${names[i]}`, ringShape(insetConvex(ring, c)));
      guides.push(closed(ring));
    }
  }
  if (s.toyGuide) base.engravingPaths = guides;
  return parts;
}
export function educationalNotes(s) {
  return `Duas camadas de ${s.thickness} mm: cole somente a moldura na base; mantenha as ${toyMetrics(s).count} peças soltas. ${educationalKind(s) === "picture" ? "Figura gravada em peças retas, com recortes para retirada. " : ""}Vermelho = corte; azul = gravação. Folga de ${s.toyGap} mm por borda, sem compensação automática do kerf. Faça um teste de corte e ajuste a folga. Arredonde/lixe arestas e valide o material e o acabamento antes do uso infantil. Protótipo sem certificação de brinquedo; contém peças soltas, não destinado a menores de 3 anos. Supervisão de adulto.`;
}
