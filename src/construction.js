import {
  joinContact,
  makePanel,
  rectanglePose,
  resolvedJoint,
} from "./joinery.js";
import { familyFor } from "./models.js";
import clipping from "polygon-clipping";
export const JOINTS = {
  straight: "Reta",
  finger: "Dedo",
  tslot: "T (parafuso e porca)",
};
export const HINGES = {
  laser: "Discos e eixos recortados",
  tabbed: "Haste integrada à tampa",
  hardware: "Eixo externo (projeto anterior)",
};
export const hingeType = (s) => s.hingeType ?? "laser";
export const LIDS = {
  none: "Sem tampa",
  removable: "Removível com guia",
  sliding: "Deslizante",
  hinged: "Dobradiça integrada",
};
export const supportsJoinery = (s) =>
  !["print", "printgrid"].includes(familyFor(s));
export const supportsConstruction = (s) =>
  !["drawers", "print", "printgrid"].includes(familyFor(s));
export const lidType = (s) =>
  supportsConstruction(s)
    ? (s.lidType ??
      (["lid", "sliding", "hinged"].includes(familyFor(s))
        ? { lid: "removable", sliding: "sliding", hinged: "hinged" }[
            familyFor(s)
          ]
        : "none"))
    : "none";
export const jointType = (s) =>
  supportsJoinery(s) ? (s.joint ?? "straight") : "straight";
export const wallInset = (s) =>
  supportsConstruction(s) && jointType(s) === "tslot"
    ? Math.max(2 * s.thickness, 6.4)
    : 0;
export const railWidth = (s) =>
  resolvedJoint(s, "railJoint") === "tslot" ? 18 : s.thickness;
export const guideDepth = (s) =>
  resolvedJoint(s, "lidJoint") === "tslot"
    ? 18
    : resolvedJoint(s, "lidJoint") === "finger"
      ? 2 * s.thickness
      : s.thickness;
// Keep the pull flush with the rim. T bolts run horizontally into the lid,
// leaving material around their holes without a tall vertical pull.
export function slidingDimensions(s) {
  const t = s.thickness,
    c = s.clearance,
    isT = resolvedJoint(s, "lidJoint") === "tslot";
  const drop = Math.max(0, (isT ? 3.2 : 0) - 1.5 * t - c);
  const lidZ = s.height - 2 * t - c - drop,
    midZ = lidZ + t / 2;
  const handleBottom = isT ? Math.min(lidZ, midZ - 3.2) : lidZ;
  return {
    drop,
    lidZ,
    midZ,
    handleBottom,
    handleHeight: s.height - handleBottom,
    frontHeight: Math.min(s.height - 2 * t - 2 * c - drop, handleBottom - c),
  };
}
export function shellMetrics(s) {
  const t = s.thickness,
    c = s.clearance,
    type = lidType(s),
    inset = wallInset(s);
  return {
    inset,
    innerWidth: s.width - 2 * (t + inset),
    innerDepth: s.depth - 2 * t,
    frontHeight:
      type === "sliding" ? slidingDimensions(s).frontHeight : s.height,
    dividerTop:
      type === "sliding"
        ? s.height - 3 * t - 3 * c - slidingDimensions(s).drop
        : type === "removable"
          ? s.height - guideDepth(s) - c
          : type === "hinged" && hingeType(s) === "tabbed"
            ? s.height - t / 2 - c
            : s.height,
  };
}
export function hingeDimensions(s) {
  const radius = s.pivotDiameter / 2 + 2 * s.thickness;
  return {
    radius,
    y: -radius,
    z: s.height,
    holeRadius:
      hingeType(s) === "tabbed"
        ? s.pivotDiameter / 2
        : (s.pivotDiameter + s.clearance) / 2,
    discRadius: s.pivotDiameter / 2,
    keyWidth: s.thickness,
    keyHeight: Math.max(s.thickness, s.pivotDiameter / 2),
    shaftLength: 2 * s.thickness + s.clearance,
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
    const hd = hingeDimensions(s);
    left = diff(
      union(left, ear),
      hingeType(s) === "laser"
        ? rect(
            -r - hd.keyWidth / 2,
            -hd.keyHeight / 2,
            hd.keyWidth,
            hd.keyHeight,
          )
        : circle(-r, 0, holeRadius),
    );
    right = left;
    // Relieve the rear corners where the fixed ears and external arms cross
    // the back plane. Integral bridges also need clearance above the back.
    const notch = m.inset + t + c;
    back = diff(
      back,
      rect(0, 0, notch, r + c),
      rect(w - notch, 0, notch, r + c),
    );
    if (hingeType(s) === "tabbed") back = diff(back, rect(0, 0, w, t / 2 + c));
  }
  body.push(normalizePanel("Base", base, basePose(0, 0, 0), { role: "base" }));
  body.push(
    normalizePanel("Frente", front, frontPose(0, d - t, fh), {
      role: "front",
      m3Fasteners: joint === "tslot" ? 2 : 0,
    }),
  );
  body.push(
    normalizePanel("Traseira", back, frontPose(0, 0, h), {
      role: "back",
      m3Fasteners: joint === "tslot" ? 2 : 0,
    }),
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
  if (joint === "tslot") {
    const basePart = body[0];
    joinContact(
      basePart,
      body[1],
      [0, d - t / 2, t],
      [w, d - t / 2, t],
      [0, 0, -1],
      joint,
      s,
    );
    joinContact(
      basePart,
      body[2],
      [0, t / 2, t],
      [w, t / 2, t],
      [0, 0, -1],
      joint,
      s,
    );
    for (const [p, x] of [
      [body[3], m.inset + t / 2],
      [body[4], w - m.inset - t / 2],
    ])
      joinContact(basePart, p, [x, t, t], [x, d - t, t], [0, 0, -1], joint, s);
  }
  const add = (name, shape, pose, extra = {}) =>
    body.push(normalizePanel(name, shape, pose, extra));
  if (type === "removable") {
    add("Tampa removível", rect(0, 0, w, d), basePose(0, 0, h), {
      group: "lid",
      role: "lid-panel",
      coverArea: { x: 0, y: 0, width: w, height: d },
    });
    if (resolvedJoint(s, "lidJoint") === "straight")
      add(
        "Guia da tampa",
        rect(0, 0, m.innerWidth - 2 * c, d - 2 * t - 2 * c),
        basePose(m.inset + t + c, t + c, h - t),
        { group: "lid" },
      );
  }
  if (type === "removable" && resolvedJoint(s, "lidJoint") !== "straight") {
    const gw = m.innerWidth - 2 * c,
      gd = d - 2 * t - 2 * c,
      gx = m.inset + t + c,
      gy = t + c,
      gh = guideDepth(s),
      k = resolvedJoint(s, "lidJoint") === "tslot" ? Math.max(2 * t, 6.4) : 0;
    add("Guia · frente", rect(0, 0, gw, gh), frontPose(gx, gy + gd - t, h), {
      group: "lid",
      role: "guide-front",
    });
    add("Guia · traseira", rect(0, 0, gw, gh), frontPose(gx, gy, h), {
      group: "lid",
      role: "guide-back",
    });
    add(
      "Guia · lateral esquerda",
      rect(0, 0, gd - 2 * t, gh),
      sidePose(gx + k, gy + t, h),
      { group: "lid", role: "guide-left" },
    );
    add(
      "Guia · lateral direita",
      rect(0, 0, gd - 2 * t, gh),
      sidePose(gx + gw - k - t, gy + t, h),
      { group: "lid", role: "guide-right" },
    );
  }
  if (type === "sliding") {
    for (const [side, x] of [
      ["esquerda", m.inset + t],
      ["direita", w - m.inset - t - railWidth(s)],
    ])
      for (const [level, z] of [
        ["inferior", h - 3 * t - 2 * c - slidingDimensions(s).drop],
        ["superior", h - t - slidingDimensions(s).drop],
      ])
        add(
          `Trilho ${side} · ${level}`,
          rect(0, 0, d - 2 * t, railWidth(s)),
          { origin: [x, t, z], u: [0, 1, 0], v: [1, 0, 0], normal: [0, 0, 1] },
          { role: "rail", railSide: side, railZ: z },
        );
    add(
      "Tampa deslizante",
      rect(0, 0, m.innerWidth - 2 * c, d - 2 * t - c),
      basePose(m.inset + t + c, t + c, slidingDimensions(s).lidZ),
      {
        group: "lid",
        role: "lid-panel",
        coverArea: {
          x: 0,
          y: 0,
          width: m.innerWidth - 2 * c,
          height: d - 2 * t - c,
        },
      },
    );
  }
  if (type === "hinged" && hingeType(s) !== "tabbed") {
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
      {
        group: "lid",
        role: "lid-panel",
        coverArea: { x: 0, y: 0, width: lidWidth, height: d },
      },
    );
    add(
      "Tampa articulada · aba frontal",
      rect(0, 0, lidWidth, lh),
      frontPose(-t - c, d - t, h + c + lh),
      { group: "lid", role: "lid-front" },
    );
    for (const [label, x] of [
      ["esquerdo", m.inset - t - c],
      ["direito", w - m.inset + c],
    ])
      add(`Braço articulado ${label}`, rail, sidePose(x, 0, h), {
        group: "lid",
        role: label === "esquerdo" ? "lid-left" : "lid-right",
      });
    if (hingeType(s) === "laser") {
      const hd = hingeDimensions(s);
      for (const [label, discX, shaftX] of [
        ["esquerdo", m.inset - t - c, m.inset - t - c],
        ["direito", w - m.inset + c, w - m.inset - t],
      ]) {
        add(
          `Disco-pivô ${label}`,
          diff(
            circle(0, 0, hd.discRadius),
            rect(-t / 2, -hd.keyHeight / 2, t, hd.keyHeight),
          ),
          sidePose(discX, -r, h),
          { group: "hinge-cut", role: "pivot-disc" },
        );
        add(
          `Eixo recortado ${label}`,
          rect(0, 0, hd.shaftLength, hd.keyHeight),
          frontPose(shaftX, -r - t / 2, h + hd.keyHeight / 2),
          { group: "hinge-cut", role: "pivot-key" },
        );
      }
    } else {
      for (let i = 0; i < 2; i++)
        add(
          `Arruela do pivô ${i + 1}`,
          diff(circle(0, 0, r), circle(0, 0, holeRadius)),
          sidePose(i === 0 ? m.inset - 2 * t - c : w - m.inset + c + t, -r, h),
          { group: "hinge-hardware" },
        );
    }
  }
  if (type === "hinged" && hingeType(s) === "tabbed") {
    const hd = hingeDimensions(s),
      gx = m.inset + t + c,
      gy = t + c,
      cw = m.innerWidth - 2 * c,
      cd = d - 2 * t - 2 * c,
      bridge = Math.max(2 * t, 5),
      minY = hd.y - t / 2;
    const plate = union(
      rect(gx, gy, cw, cd),
      rect(m.inset, hd.y - t / 2, w - 2 * m.inset, t),
      rect(gx, hd.y + t / 2, bridge, gy - hd.y - t / 2),
      rect(gx + cw - bridge, hd.y + t / 2, bridge, gy - hd.y - t / 2),
    );
    add("Tampa com haste integral", plate, basePose(0, 0, h - t / 2), {
      group: "lid",
      role: "lid-panel",
      coverArea: { x: gx - m.inset, y: gy - minY, width: cw, height: cd },
    });
  }
  applyLidJoinery(s, body);
  return body;
}
function applyLidJoinery(s, parts) {
  const t = s.thickness,
    c = s.clearance,
    w = s.width,
    d = s.depth,
    h = s.height,
    m = shellMetrics(s),
    lid = parts.find((p) => p.role === "lid-panel"),
    type = lidType(s),
    joint = resolvedJoint(s, "lidJoint");
  if (!lid) return;
  const join = (receiver, male, a, b, v, style = joint) =>
    joinContact(receiver, male, a, b, v, style, s);
  if (type === "removable" && joint !== "straight") {
    const gx = m.inset + t + c,
      gy = t + c,
      gw = m.innerWidth - 2 * c,
      gd = d - 2 * t - 2 * c,
      gh = guideDepth(s),
      k = joint === "tslot" ? Math.max(2 * t, 6.4) : 0;
    const front = parts.find((p) => p.role === "guide-front"),
      back = parts.find((p) => p.role === "guide-back"),
      sides = [
        parts.find((p) => p.role === "guide-left"),
        parts.find((p) => p.role === "guide-right"),
      ];
    for (const [p, x] of [
      [sides[0], gx + k + t / 2],
      [sides[1], gx + gw - k - t / 2],
    ]) {
      join(lid, p, [x, gy + t, h], [x, gy + gd - t, h], [0, 0, 1]);
      join(back, p, [x, gy + t, h - gh], [x, gy + t, h], [0, -1, 0]);
      join(front, p, [x, gy + gd - t, h - gh], [x, gy + gd - t, h], [0, 1, 0]);
    }
    join(lid, back, [gx, gy + t / 2, h], [gx + gw, gy + t / 2, h], [0, 0, 1]);
    join(
      lid,
      front,
      [gx, gy + gd - t / 2, h],
      [gx + gw, gy + gd - t / 2, h],
      [0, 0, 1],
    );
  }
  if (type === "hinged" && hingeType(s) !== "tabbed") {
    const z = h + c + s.lidHeight,
      front = parts.find((p) => p.role === "lid-front"),
      left = parts.find((p) => p.role === "lid-left"),
      right = parts.find((p) => p.role === "lid-right");
    for (const [p, x] of [
      [left, m.inset - t / 2 - c],
      [right, w - m.inset + c + t / 2],
    ]) {
      join(lid, p, [x, 0, z], [x, d - t, z], [0, 0, 1]);
      join(front, p, [x, d - t, h + c], [x, d - t, z], [0, 1, 0]);
    }
    join(
      lid,
      front,
      [-t - c, d - t / 2, z],
      [w + t + c, d - t / 2, z],
      [0, 0, 1],
    );
  }
  if (type === "sliding") {
    for (const rail of parts.filter((p) => p.role === "rail")) {
      const left = rail.railSide === "esquerda",
        x = left ? m.inset + t : w - m.inset - t,
        wall = parts.filter((p) => p.role === "side")[left ? 0 : 1];
      join(
        wall,
        rail,
        [x, t, rail.railZ + t / 2],
        [x, d - t, rail.railZ + t / 2],
        left ? [-1, 0, 0] : [1, 0, 0],
        resolvedJoint(s, "railJoint"),
      );
    }
    const { handleHeight: hh, midZ: z } = slidingDimensions(s),
      gx = m.inset + t + c,
      width = m.innerWidth - 2 * c;
    const handle = makePanel(
      "Puxador frontal da tampa",
      width,
      hh,
      frontPose(gx, d - t, h),
      { group: "lid", role: "lid-handle" },
    );
    parts.push(handle);
    join(handle, lid, [gx, d - t, z], [gx + width, d - t, z], [0, 1, 0]);
  }
}
export function constructionNotes(s) {
  if (!supportsConstruction(s))
    return `Estrutura ${JOINTS[jointType(s)]}; prateleiras/separadores ${JOINTS[resolvedJoint(s, "dividerJoint")]}; gavetas ${JOINTS[resolvedJoint(s, "drawerJoint")]}. União T usa conjuntos M3. Confira as peças e a quantidade de fixações no projeto.`;
  const joints = {
    straight: "União reta com colagem.",
    finger:
      "Encaixes de dedo na base e nas quinas. Use cola após conferir o ajuste.",
    tslot:
      "União T nas quinas: parafusos e porcas M3 nas quinas e na base (canal de 14,4 mm; ajuste o comprimento à chapa). A quantidade depende das ligações selecionadas.",
  };
  const lids = {
    none: "",
    removable:
      resolvedJoint(s, "lidJoint") === "straight"
        ? " A guia é colada sob a tampa; divisórias são rebaixadas para permitir o fechamento."
        : ` Moldura inferior com união ${JOINTS[resolvedJoint(s, "lidJoint")]}; divisórias ficam abaixo da guia.`,
    sliding: ` Fixe os quatro trilhos nas laterais internas com união ${JOINTS[resolvedJoint(s, "railJoint")]}. A tampa entra pela frente; as divisórias ficam abaixo do canal.`,
    hinged:
      hingeType(s) === "tabbed"
        ? ` Haste de pivô recortada na própria tampa, apoiada nos furos circulares das laterais. Monte a tampa entre as laterais antes de fechar a caixa; não cole a região de giro. Não precisa de discos separados nem de eixo comprado.`
        : hingeType(s) === "laser"
          ? ` Pivô sem ferragens: corte 2 discos-pivô e 2 eixos retangulares junto com as demais peças. Encaixe os eixos nos rasgos do corpo e dos discos; os braços giram ao redor dos discos. Fixe somente os encaixes retangulares; não cole braços aos discos. Monte e confira o espaçamento da tampa antes de fixar os eixos.`
          : ` Dobradiça recortada nas laterais e braços da tampa. Monte com 2 pinos ou parafusos de Ø${s.pivotDiameter} mm e retenção. Comprimento útil mínimo do eixo: ${Number((3 * s.thickness + s.clearance).toFixed(1))} mm, mais a fixação. Não cole a articulação.`,
  };
  return (
    joints[jointType(s)] +
    lids[lidType(s)] +
    ` Uniões: tampa ${JOINTS[resolvedJoint(s, "lidJoint")]}; divisórias ${JOINTS[resolvedJoint(s, "dividerJoint")] || "Cruzada"}.` +
    " Sem compensação de kerf; teste uma amostra na espessura real antes da fabricação."
  );
}
