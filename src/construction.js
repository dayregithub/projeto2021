import clipping from "polygon-clipping";
export const JOINTS = {
  straight: "Reta",
  finger: "Dedo",
  tslot: "T (parafuso e porca)",
};
export const LIDS = {
  none: "Sem tampa",
  removable: "Removível com guia",
  sliding: "Deslizante",
  hinged: "Dobradiça integrada",
};
export const supportsConstruction = (s) =>
  !["drawers", "print", "printgrid"].includes(s.model);
export const lidType = (s) =>
  supportsConstruction(s)
    ? (s.lidType ??
      (["lid", "sliding", "hinged"].includes(s.model)
        ? { lid: "removable", sliding: "sliding", hinged: "hinged" }[s.model]
        : "none"))
    : "none";
export const jointType = (s) =>
  supportsConstruction(s) ? (s.joint ?? "straight") : "straight";
export const wallInset = (s) =>
  jointType(s) === "tslot" ? Math.max(2 * s.thickness, 6.4) : 0;
export function shellMetrics(s) {
  const t = s.thickness,
    c = s.clearance,
    type = lidType(s),
    inset = wallInset(s);
  return {
    inset,
    innerWidth: s.width - 2 * (t + inset),
    innerDepth: s.depth - 2 * t,
    frontHeight: type === "sliding" ? s.height - 2 * t - 2 * c : s.height,
    dividerTop:
      type === "sliding"
        ? s.height - 3 * t - 3 * c
        : type === "removable"
          ? s.height - t - c
          : s.height,
  };
}
export function hingeDimensions(s) {
  const radius = s.pivotDiameter / 2 + 2 * s.thickness;
  return {
    radius,
    y: -radius,
    z: s.height,
    holeRadius: (s.pivotDiameter + s.clearance) / 2,
  };
}
const rect = (x, y, w, h) => [
  [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y],
  ],
];
export const circle = (x, y, r, n = 64) => [
  Array.from({ length: n + 1 }, (_, i) => [
    x + r * Math.cos((i * 2 * Math.PI) / n),
    y + r * Math.sin((i * 2 * Math.PI) / n),
  ]),
];
const diff = (shape, ...holes) =>
  holes.length ? clipping.difference(shape, ...holes) : shape;
const union = (...shapes) => clipping.union(...shapes);
export function toothIntervals(start, end, target) {
  let count = Math.max(3, Math.round((end - start) / target));
  if (count % 2 === 0) count++;
  return Array.from({ length: count }, (_, i) => ({
    start: start + ((end - start) * i) / count,
    end: start + ((end - start) * (i + 1)) / count,
    tab: i % 2 === 1,
  }));
}
function normalizePanel(name, shape, pose, extra = {}) {
  if (typeof shape[0][0][0] === "number") shape = [shape];
  const ps = shape.flat(2),
    minX = Math.min(...ps.map((p) => p[0])),
    minY = Math.min(...ps.map((p) => p[1])),
    maxX = Math.max(...ps.map((p) => p[0])),
    maxY = Math.max(...ps.map((p) => p[1]));
  return {
    name,
    width: maxX - minX,
    height: maxY - minY,
    slots: [],
    shape: shape.map((poly) =>
      poly.map((ring) =>
        ring.slice(0, -1).map(([x, y]) => [x - minX, y - minY]),
      ),
    ),
    pose: {
      ...pose,
      origin: pose.origin.map(
        (v, i) => v + pose.u[i] * minX + pose.v[i] * minY,
      ),
    },
    ...extra,
  };
}
const basePose = (x, y, z) => ({
  origin: [x, y, z],
  u: [1, 0, 0],
  v: [0, 1, 0],
  normal: [0, 0, 1],
});
const frontPose = (x, y, z) => ({
  origin: [x, y, z],
  u: [1, 0, 0],
  v: [0, 0, -1],
  normal: [0, 1, 0],
});
const sidePose = (x, y, z) => ({
  origin: [x, y, z],
  u: [0, 1, 0],
  v: [0, 0, -1],
  normal: [1, 0, 0],
});
export function buildBoxPanels(s) {
  const { width: w, depth: d, height: h, thickness: t, clearance: c } = s,
    type = lidType(s),
    joint = jointType(s),
    m = shellMetrics(s),
    fh = m.frontHeight,
    body = [];
  let base = rect(0, 0, w, d),
    front = rect(0, 0, w, fh - t),
    back = rect(0, 0, w, h - t),
    left = rect(t, 0, d - 2 * t, h - t),
    right = left;
  if (joint === "finger") {
    const bottomX = toothIntervals(t, w - t, s.fingerSize),
      bottomY = toothIntervals(t, d - t, s.fingerSize);
    base = diff(
      base,
      ...bottomX
        .filter((i) => i.tab)
        .flatMap((i) => [
          rect(i.start, 0, i.end - i.start, t),
          rect(i.start, d - t, i.end - i.start, t),
        ]),
      ...bottomY
        .filter((i) => i.tab)
        .flatMap((i) => [
          rect(0, i.start, t, i.end - i.start),
          rect(w - t, i.start, t, i.end - i.start),
        ]),
    );
    const frontShape = (height) => {
      let shape = rect(0, 0, w, height);
      const holes = toothIntervals(t, height, s.fingerSize)
        .filter((i) => i.tab)
        .flatMap((i) => [
          rect(0, height - i.end, t, i.end - i.start),
          rect(w - t, height - i.end, t, i.end - i.start),
        ]);
      shape = diff(shape, ...holes, rect(0, height - t, w, t));
      return union(
        shape,
        ...bottomX
          .filter((i) => i.tab)
          .map((i) => rect(i.start, height - t, i.end - i.start, t)),
      );
    };
    front = frontShape(fh);
    back = frontShape(h);
    let side = rect(0, 0, d, h);
    const holes = [];
    for (const [at, height] of [
      [0, h],
      [d - t, fh],
    ])
      for (const i of toothIntervals(t, height, s.fingerSize).filter(
        (i) => !i.tab,
      ))
        holes.push(rect(at, h - i.end, t, i.end - i.start));
    // Above the lowered sliding front, the side wall continues to the full height.
    side = diff(side, ...holes, rect(0, h - t, d, t));
    side = union(
      side,
      ...bottomY
        .filter((i) => i.tab)
        .map((i) => rect(i.start, h - t, i.end - i.start, t)),
    );
    left = right = side;
  }
  if (joint === "tslot") {
    const makeFront = (height) => {
      const z0 = t,
        span = height - t,
        holes = [];
      for (const x of [m.inset, m.inset + t + m.innerWidth]) {
        for (const q of [0.25, 0.75])
          holes.push(rect(x, span - (span * q + t), t, 2 * t));
        holes.push(circle(x + t / 2, span / 2, 1.6));
      }
      return diff(rect(0, 0, w, span), ...holes);
    };
    front = makeFront(fh);
    back = makeFront(h);
    let side = rect(t, 0, d - 2 * t, h - t);
    const reach = 12;
    for (const [rear, height] of [
      [true, h],
      [false, fh],
    ]) {
      const span = height - t,
        center = h - t - span / 2;
      const neckY = rear ? t : d - t - reach - 2.4,
        pocketY = rear ? t + reach - 2.4 : d - t - reach;
      side = union(
        side,
        ...[0.25, 0.75].map((q) =>
          rect(rear ? 0 : d - t, h - t - (span * q + t), t, 2 * t),
        ),
      );
      side = diff(
        side,
        rect(neckY, center - 1.6, reach + 2.4, 3.2),
        rect(pocketY, center - 2.9, 2.4, 5.8),
      );
    }
    left = right = side;
  }
  if (type === "hinged") {
    const { radius: r, holeRadius } = hingeDimensions(s);
    const ear = union(circle(-r, 0, r), rect(-r, 0, r + t, r));
    left = diff(union(left, ear), circle(-r, 0, holeRadius));
    right = left;
  }
  body.push(normalizePanel("Base", base, basePose(0, 0, 0), { role: "base" }));
  body.push(
    normalizePanel("Frente", front, frontPose(0, d - t, fh), { role: "front" }),
  );
  body.push(
    normalizePanel("Traseira", back, frontPose(0, 0, h), { role: "back" }),
  );
  body.push(
    normalizePanel("Lateral esquerda", left, sidePose(m.inset, 0, h), {
      role: "side",
    }),
  );
  body.push(
    normalizePanel("Lateral direita", right, sidePose(w - m.inset - t, 0, h), {
      role: "side",
    }),
  );
  const add = (name, shape, pose, extra = {}) =>
    body.push(normalizePanel(name, shape, pose, extra));
  if (type === "removable") {
    add("Tampa removível", rect(0, 0, w, d), basePose(0, 0, h), {
      group: "lid",
    });
    add(
      "Guia da tampa",
      rect(0, 0, m.innerWidth - 2 * c, d - 2 * t - 2 * c),
      basePose(m.inset + t + c, t + c, h - t),
      { group: "lid" },
    );
  }
  if (type === "sliding") {
    for (const [side, x] of [
      ["esquerda", m.inset + t],
      ["direita", w - m.inset - 2 * t],
    ])
      for (const [level, z] of [
        ["inferior", h - 3 * t - 2 * c],
        ["superior", h - t],
      ])
        add(
          `Trilho ${side} · ${level}`,
          rect(0, 0, d - 2 * t, t),
          { origin: [x, t, z], u: [0, 1, 0], v: [1, 0, 0], normal: [0, 0, 1] },
          { role: "rail" },
        );
    add(
      "Tampa deslizante",
      rect(0, 0, m.innerWidth - 2 * c, d - t - c),
      basePose(m.inset + t + c, t + c, h - 2 * t - c),
      { group: "lid" },
    );
  }
  if (type === "hinged") {
    const { radius: r, holeRadius } = hingeDimensions(s),
      lh = s.lidHeight;
    const rail = diff(
      union(
        rect(0, -c - lh, d - t, lh),
        circle(-r, 0, r),
        rect(-r, -c - lh, r + t, c + lh + r),
      ),
      circle(-r, 0, holeRadius),
    );
    const lidWidth = w + 2 * (t + c);
    add(
      "Tampa articulada · painel",
      rect(0, 0, lidWidth, d),
      basePose(-t - c, 0, h + c + lh),
      { group: "lid" },
    );
    add(
      "Tampa articulada · aba frontal",
      rect(0, 0, lidWidth, lh),
      frontPose(-t - c, d - t, h + c + lh),
      { group: "lid" },
    );
    for (const [label, x] of [
      ["esquerdo", m.inset - t - c],
      ["direito", w - m.inset + c],
    ])
      add(`Braço articulado ${label}`, rail, sidePose(x, 0, h), {
        group: "lid",
      });
    for (let i = 0; i < 2; i++)
      add(
        `Arruela do pivô ${i + 1}`,
        diff(circle(0, 0, r), circle(0, 0, holeRadius)),
        sidePose(i === 0 ? m.inset - 2 * t - c : w - m.inset + c + t, -r, h),
        { group: "hinge-hardware" },
      );
  }
  return body;
}
export function constructionNotes(s) {
  if (!supportsConstruction(s))
    return "Gaveteiro com junções retas e colagem. As novas uniões e tampas estão disponíveis nos modelos de caixa.";
  const joints = {
    straight: "União reta com colagem.",
    finger:
      "Encaixes de dedo na base e nas quinas. Use cola após conferir o ajuste.",
    tslot:
      "União T nas quinas: 4 parafusos M3 e 4 porcas M3 (canal de 14,4 mm; ajuste o comprimento à chapa); a base e as divisórias são coladas.",
  };
  const lids = {
    none: "",
    removable:
      " A guia é colada sob a tampa; divisórias são rebaixadas para permitir o fechamento.",
    sliding:
      " Cole os quatro trilhos nas laterais internas. A tampa entra pela frente; as divisórias ficam abaixo do canal.",
    hinged: ` Dobradiça recortada nas laterais e braços da tampa. Monte com 2 pinos ou parafusos de Ø${s.pivotDiameter} mm e retenção. Comprimento útil mínimo do eixo: ${Number((3 * s.thickness + s.clearance).toFixed(1))} mm, mais a fixação. Não cole a articulação.`,
  };
  return (
    joints[jointType(s)] +
    lids[lidType(s)] +
    " Sem compensação de kerf; teste uma amostra na espessura real antes da fabricação."
  );
}
