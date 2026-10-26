import { engravingAreasSVG } from "./engraving-areas.js";
import { cartoonPaths } from "./toy-art.js";
import { insetPolygon, strokeAreas } from "./vector-offset.js";
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
  if (educationalKind(s) === "picture") {
    if (!["straight", "jigsaw"].includes(s.toyPieceStyle))
      errors.push("Escolha corte reto ou encaixe tradicional.");
    if (!["line", "double", "fill"].includes(s.toyEngraving))
      errors.push("Escolha o tipo de gravação da figura.");
    if (
      !Number.isFinite(s.toyBorderWidth) ||
      s.toyBorderWidth < 0.3 ||
      s.toyBorderWidth > 3
    )
      errors.push("Distância entre as linhas: use de 0,3 a 3 mm.");
  }
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
  if (
    kind === "picture" &&
    s.toyPieceStyle === "jigsaw" &&
    Math.min(m.pieceWidth, m.pieceDepth) * 0.168 - 2 * s.toyGap <
      Math.max(3, s.thickness)
  )
    errors.push(
      "Os pescoços dos encaixes ficaram estreitos. Aumente a base, reduza a quantidade de peças ou a folga.",
    );
  return errors;
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
const artCache = new Map();
export function pictureArtwork(s) {
  const m = toyMetrics(s),
    key = JSON.stringify([
      s.toyTheme,
      m.margin,
      m.innerWidth,
      m.innerDepth,
      s.toyBorderWidth,
      s.toyEngraving,
    ]);
  if (artCache.has(key)) return artCache.get(key);
  const paths = cartoonPaths(s.toyTheme, {
    width: m.innerWidth - 8,
    height: m.innerDepth - 8,
    x: m.margin + 4,
    y: m.margin + 4,
  });
  const result = {
    paths,
    areas:
      s.toyEngraving === "line" ? [] : strokeAreas(paths, s.toyBorderWidth),
  };
  artCache.set(key, result);
  if (artCache.size > 8) artCache.delete(artCache.keys().next().value);
  return result;
}
// Every tab is one shared contour: union on the male and subtraction on its
// neighbour produce a complementary socket. Only after this partition is
// complete is the material clearance inset on every edge.
export function pictureTileShapes(s) {
  const m = toyMetrics(s),
    tiles = [];
  for (let row = 0; row < m.rows; row++)
    for (let col = 0; col < m.cols; col++)
      tiles.push(
        rectangle(
          m.margin + col * m.pieceWidth,
          m.margin + row * m.pieceDepth,
          m.pieceWidth,
          m.pieceDepth,
        ),
      );
  if (s.toyPieceStyle !== "jigsaw") return tiles;
  const r = Math.min(m.pieceWidth, m.pieceDepth) * 0.14;
  const tab = (a, b, x, y, vertical, sign) => {
    const shape = ringShape(
      ellipse(
        x + (vertical ? sign * 0.8 * r : 0),
        y + (vertical ? 0 : sign * 0.8 * r),
        r,
        r,
        64,
      ),
    );
    const male = sign > 0 ? a : b,
      female = sign > 0 ? b : a;
    tiles[male] = clipping.union(tiles[male], shape);
    tiles[female] = clipping.difference(tiles[female], shape);
  };
  for (let row = 0; row < m.rows; row++)
    for (let col = 0; col < m.cols - 1; col++)
      tab(
        row * m.cols + col,
        row * m.cols + col + 1,
        m.margin + (col + 1) * m.pieceWidth,
        m.margin + (row + 0.5) * m.pieceDepth,
        true,
        (row + col) % 2 ? 1 : -1,
      );
  for (let row = 0; row < m.rows - 1; row++)
    for (let col = 0; col < m.cols; col++)
      tab(
        row * m.cols + col,
        (row + 1) * m.cols + col,
        m.margin + (col + 0.5) * m.pieceWidth,
        m.margin + (row + 1) * m.pieceDepth,
        false,
        (row + col) % 2 ? -1 : 1,
      );
  return tiles;
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
  const addPiece = (name, shape, engraving = [], engravingAreas = []) => {
    const p = reshape(
      makePanel(name, 1, 1, rectanglePose(0, 0, t), { group: "toy-piece" }),
      shape,
    );
    p.engravingPaths = engraving.map((path) =>
      path.map(([x, y]) => [x - p.pose.origin[0], y - p.pose.origin[1]]),
    );
    if (engravingAreas.length) {
      p.engravingAreas = engravingAreas.map((poly) =>
        poly.map((ring) =>
          ring.map(([x, y]) => [x - p.pose.origin[0], y - p.pose.origin[1]]),
        ),
      );
      p.engravingFilled = s.toyEngraving === "fill";
    }
    parts.push(p);
  };
  const remove = (shape) =>
    reshape(frame, clipping.difference(frame.shape, shape));
  const grip = (x, y, r = 5) => ringShape(ellipse(x, y, r, r, 32));
  if (kind === "picture") {
    const art = pictureArtwork(s),
      tiles = pictureTileShapes(s);
    const window = rectangle(m.margin, m.margin, m.innerWidth, m.innerDepth);
    remove(
      s.toyPieceStyle === "jigsaw"
        ? clipping.union(window, grip(m.margin + m.pieceWidth / 2, m.margin))
        : window,
    );
    for (let row = 0; row < m.rows; row++)
      for (let col = 0; col < m.cols; col++) {
        const raw = tiles[row * m.cols + col];
        let shape = insetPolygon(raw, c);
        if (s.toyPieceStyle === "straight") {
          const x = m.margin + col * m.pieceWidth + c,
            y = m.margin + row * m.pieceDepth + c,
            w = m.pieceWidth - 2 * c;
          shape = clipping.difference(shape, grip(x + w / 2, y));
        }
        if (shape.length !== 1)
          throw Error(
            "O encaixe ficou frágil ou desconectado. Aumente as peças ou reduza a folga.",
          );
        addPiece(
          `Figura · linha ${row + 1}, coluna ${col + 1}`,
          shape,
          s.toyEngraving === "line" ? clipToyEngraving(art.paths, shape) : [],
          art.areas.length ? clipping.intersection(art.areas, shape) : [],
        );
      }
    guides.push(...art.paths);
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
  return `Duas camadas de ${s.thickness} mm: cole somente a moldura na base; mantenha as ${toyMetrics(s).count} peças soltas. ${educationalKind(s) === "picture" ? `Figura com ${s.toyPieceStyle === "jigsaw" ? "encaixes tradicionais complementares" : "cortes retos"}. ${s.toyEngraving === "line" ? "Gravação por linha simples." : `Borda dupla com ${s.toyBorderWidth} mm entre as linhas; ${s.toyEngraving === "fill" ? "faixa preenchida" : "contornos fechados para preencher no software do laser"}.`} ` : ""}Vermelho = corte; azul = gravação. As camadas ENGRAVE_FILL e ENGRAVE_OUTLINE são gravação, nunca corte. No DXF, selecione preenchimento da faixa no software do laser; o arquivo fornece contornos fechados. Folga de ${s.toyGap} mm por borda, sem compensação automática do kerf. Faça um teste de corte e ajuste a folga. Arredonde/lixe arestas e valide o material e o acabamento antes do uso infantil. Protótipo sem certificação de brinquedo; contém peças soltas, não destinado a menores de 3 anos. Supervisão de adulto.`;
}

export function pictureArtSVG(s) {
  const m = toyMetrics(s),
    art = pictureArtwork(s),
    content =
      s.toyEngraving === "line"
        ? art.paths
            .map(
              (path) =>
                `<path d="${path.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")}" fill="none" stroke="#684b43" stroke-width=".35" stroke-linejoin="round" stroke-linecap="round"/>`,
            )
            .join("")
        : engravingAreasSVG(
            {
              engravingAreas: art.areas,
              engravingFilled: s.toyEngraving === "fill",
            },
            0,
            0,
            { color: "#684b43", strokeWidth: 0.45 },
          );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m.margin} ${m.margin} ${m.innerWidth} ${m.innerDepth}">${content}</svg>`;
}
