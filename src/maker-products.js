import { familyFor } from "./models.js";
import { LETTER_FONTS, letterContours, validSignText } from "./lettering.js";
import { cartoonPaths } from "./toy-art.js";
import { strokeAreas, booleanPolygons } from "./vector-offset.js";
export const MAKER_FAMILIES = ["stamp", "roller", "relief", "gears"];
export const isMakerProduct = (s) => MAKER_FAMILIES.includes(familyFor(s));
export const MAKER_PATTERNS = {
  dots: "Pontos",
  stripes: "Listras",
  chevron: "Zigue-zague",
  hearts: "Corações",
};
export const MAKER_SHAPES = {
  rounded: "Retangular arredondado",
  round: "Redondo",
  oval: "Oval",
  heart: "Coração",
};
const circle = (cx, cy, rx, ry = rx, n = 64) =>
  Array.from({ length: n }, (_, i) => [
    cx + rx * Math.cos((i * 2 * Math.PI) / n),
    cy + ry * Math.sin((i * 2 * Math.PI) / n),
  ]);
export function makerOutline(s) {
  const w = s.width,
    d = s.depth;
  if (s.makerShape === "round" || s.makerShape === "oval")
    return circle(w / 2, d / 2, w / 2, d / 2);
  if (s.makerShape === "heart") {
    const p = Array.from({ length: 96 }, (_, i) => {
      const a = (i * 2 * Math.PI) / 96;
      return [
        16 * Math.sin(a) ** 3,
        -(
          13 * Math.cos(a) -
          5 * Math.cos(2 * a) -
          2 * Math.cos(3 * a) -
          Math.cos(4 * a)
        ),
      ];
    });
    const minY = Math.min(...p.map((v) => v[1])),
      maxY = Math.max(...p.map((v) => v[1]));
    return p.map(([x, y]) => [
      ((x + 16) * w) / 32,
      ((y - minY) * d) / (maxY - minY),
    ]);
  }
  const r = Math.min(6, w / 6, d / 6),
    out = [];
  for (const [cx, cy, a] of [
    [w - r, r, -90],
    [w - r, d - r, 0],
    [r, d - r, 90],
    [r, r, 180],
  ])
    for (let j = 0; j <= 10; j++) {
      const q = ((a + j * 9) * Math.PI) / 180;
      out.push([cx + r * Math.cos(q), cy + r * Math.sin(q)]);
    }
  return out;
}
export function makerHoleCenter(s) {
  const r = s.makerBoreDiameter / 2,
    pad = r + 3.5,
    w = s.width,
    d = s.depth;
  if (s.makerShape === "heart")
    return s.makerHolePosition === "right"
      ? [w * 0.8, d * 0.3]
      : s.makerHolePosition === "top"
        ? [w * 0.25, pad]
        : [w * 0.2, d * 0.3];
  return s.makerHolePosition === "right"
    ? [w - pad, d / 2]
    : s.makerHolePosition === "top"
      ? [w / 2, pad]
      : [pad, d / 2];
}
export function makerArt(s) {
  const reserve =
    familyFor(s) === "relief" && s.makerHole
      ? Math.max(
          s.makerBoreDiameter + 6,
          s.makerShape === "heart" && s.makerHolePosition !== "top"
            ? s.width * 0.32
            : 0,
        )
      : 0;
  const pad = Math.max(4, s.makerBorder ? s.makerBorderWidth + 2.5 : 4);
  const x = pad + (reserve && s.makerHolePosition === "left" ? reserve : 0),
    y = pad + (reserve && s.makerHolePosition === "top" ? reserve : 0);
  const width =
      s.width -
      x -
      pad -
      (reserve && s.makerHolePosition === "right" ? reserve : 0),
    depth = s.depth - y - pad;
  const hasText = s.makerContent === "text" || s.makerContent === "both",
    hasFigure = s.makerContent === "figure" || s.makerContent === "both";
  let glyphs = [],
    textHeight = 0,
    areas = [];
  if (hasText) {
    const regionH = hasFigure ? depth * 0.34 : depth,
      regionY = hasFigure ? y + depth * 0.66 : y;
    const text = letterContours({
      ...s,
      signText: s.makerText,
      signFont: s.makerFont,
      signBase: false,
      signOrientation: "flat",
      signSpacing: 0,
      signTextHeight: s.makerTextHeight,
      width: width + 2,
      depth: regionH + 2,
    });
    textHeight = text.height;
    glyphs = text.glyphs.map((rs) =>
      rs.map((r) => r.map(([u, v]) => [u + x - 1, v + regionY - 1])),
    );
  }
  if (hasFigure) {
    const paths = cartoonPaths(s.makerFigure, {
      width,
      height: hasText ? depth * 0.6 : depth,
      x,
      y,
    });
    areas = strokeAreas(paths, s.makerStroke);
  }
  return { glyphs, areas, textHeight };
}
export function gearMetrics(s) {
  const teeth = Array.from({ length: s.makerGearCount }, (_, i) =>
    i % 2 ? s.makerGearTeeth2 : s.makerGearTeeth,
  );
  const pitch = teeth.map((n) => (n * s.makerGearModule) / 2),
    outer = pitch.map((r) => r + s.makerGearModule),
    margin = 8,
    maxR = Math.max(...outer);
  let x = margin + outer[0];
  const centers = teeth.map((n, i) => {
    if (i) x += pitch[i - 1] + pitch[i];
    return [x, maxR + margin];
  });
  const phases = [];
  for (let i = 0; i < teeth.length; i++)
    phases.push(
      i
        ? Math.PI -
            Math.PI / teeth[i] -
            (phases[i - 1] * teeth[i - 1]) / teeth[i]
        : 0,
    );
  return {
    teeth,
    pitch,
    outer,
    centers,
    phases,
    width: centers.at(-1)[0] + outer.at(-1) + margin,
    depth: 2 * (maxR + margin),
    shaftRadius: s.makerBoreDiameter / 2 - s.clearance,
  };
}
// 20 degree involute spur teeth. Backlash reduces tooth thickness at the
// pitch circle; all gears in the train share module and pressure angle.
export function gearOutline(teeth, module, backlash, phase = 0) {
  const pitch = (teeth * module) / 2,
    base = pitch * Math.cos((20 * Math.PI) / 180),
    tip = pitch + module,
    root = pitch - 1.25 * module;
  const inv = (r) => {
    const t = Math.sqrt(Math.max(0, (r / base) ** 2 - 1));
    return t - Math.atan(t);
  };
  const half = Math.PI / (2 * teeth) - backlash / (2 * pitch),
    angle = (r) => half + inv(pitch) - inv(r),
    out = [];
  const point = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  for (let i = 0; i < teeth; i++) {
    const a = phase + (i * 2 * Math.PI) / teeth,
      b = angle(base),
      top = angle(tip);
    for (let j = 0; j <= 3; j++)
      out.push(
        point(root, a - Math.PI / teeth + ((Math.PI / teeth - b) * j) / 3),
      );
    for (let j = 0; j <= 8; j++) {
      const r = base + ((tip - base) * j) / 8;
      out.push(point(r, a - angle(r)));
    }
    for (let j = 1; j <= 4; j++)
      out.push(point(tip, a - top + (2 * top * j) / 4));
    for (let j = 7; j >= 0; j--) {
      const r = base + ((tip - base) * j) / 8;
      out.push(point(r, a + angle(r)));
    }
    out.push(point(root, a + b));
    for (let j = 1; j <= 3; j++)
      out.push(point(root, a + b + ((Math.PI / teeth - b) * j) / 3));
  }
  return out
    .filter(
      (p, i) =>
        !i || Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 1e-8,
    )
    .filter(
      (p, i, a) =>
        i !== a.length - 1 || Math.hypot(p[0] - a[0][0], p[1] - a[0][1]) > 1e-8,
    );
}
export function validateMaker(s) {
  const errors = [],
    kind = familyFor(s);
  if (s.joint !== "straight" || s.lidType !== "none" || s.printLid !== "none")
    errors.push(
      "Este produto não usa junções de corte laser nem tampas de caixa.",
    );
  const n = (key, min, max) => {
    if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max)
      errors.push(
        `${{ height: "Espessura / diâmetro", thickness: "Espessura da base", width: "Largura / comprimento", depth: "Profundidade / diâmetro", makerRelief: "Relevo", makerGearModule: "Módulo", makerGearCount: "Quantidade de engrenagens", makerGearTeeth: "Dentes da primeira engrenagem", makerGearTeeth2: "Dentes alternados", makerGearBacklash: "Folga entre dentes", makerBoreDiameter: "Diâmetro do furo", clearance: "Folga do eixo", makerTurn: "Rotação", makerPatternSpacing: "Espaçamento da textura", makerStroke: "Largura dos traços", makerTextHeight: "Altura do texto", makerBorderWidth: "Largura da borda", makerHandleHeight: "Altura do cabo" }[key]}: use de ${min} a ${max}.`,
      );
  };
  n("height", kind === "roller" ? 20 : 2, kind === "roller" ? 70 : 12);
  n("makerRelief", 0.6, 3);
  n("thickness", 2, 8);
  if (kind === "gears") {
    n("makerGearModule", 1.2, 3);
    n("makerGearCount", 2, 5);
    n("makerGearTeeth", 18, 36);
    n("makerGearTeeth2", 18, 36);
    n("makerGearBacklash", 0.1, 0.7);
    n("makerBoreDiameter", 4, 10);
    n("clearance", 0.15, 0.6);
    n("makerTurn", 0, 360);
    for (const k of ["makerGearCount", "makerGearTeeth", "makerGearTeeth2"])
      if (!Number.isInteger(s[k]))
        errors.push("Quantidade e dentes precisam ser inteiros.");
    if (typeof s.makerGearBase !== "boolean")
      errors.push("Escolha se deseja base.");
    if (!errors.length) {
      const m = gearMetrics(s);
      for (const z of m.teeth) {
        const r = (z * s.makerGearModule) / 2,
          rb = r * Math.cos(Math.PI / 9),
          tip = r + s.makerGearModule,
          inv = (q) => {
            const t = Math.sqrt((q / rb) ** 2 - 1);
            return t - Math.atan(t);
          };
        if (
          2 *
            tip *
            (Math.PI / (2 * z) -
              s.makerGearBacklash / (2 * r) +
              inv(r) -
              inv(tip)) <
          0.4
        ) {
          errors.push(
            "A ponta do dente ficou fina. Aumente o módulo ou reduza a folga.",
          );
          break;
        }
      }
      if (m.shaftRadius < 1.2)
        errors.push(
          "Aumente o furo ou reduza a folga para preservar os eixos.",
        );
      if (
        Math.abs(s.width - m.width) > 0.01 ||
        Math.abs(s.depth - m.depth) > 0.01
      )
        errors.push("As medidas da base devem acompanhar as engrenagens.");
    }
    return errors;
  }
  n("width", kind === "roller" ? 40 : 30, kind === "roller" ? 180 : 200);
  n("depth", 20, kind === "roller" ? 60 : 140);
  if (kind === "roller") {
    if (!Object.hasOwn(MAKER_PATTERNS, s.makerPattern))
      errors.push("Escolha uma textura.");
    n("makerPatternSpacing", 8, 22);
    n("makerBoreDiameter", 4, 12);
    if (typeof s.makerHole !== "boolean")
      errors.push("Escolha se deseja furo axial.");
    if (s.height !== s.depth + 2 * s.makerRelief)
      errors.push("O diâmetro externo deve acompanhar corpo e textura.");
    if (
      Math.floor(s.width / s.makerPatternSpacing) *
        Math.floor((Math.PI * s.depth) / s.makerPatternSpacing) >
      240
    )
      errors.push(
        "Aumente o espaçamento para usar no máximo 240 elementos de textura.",
      );
    return errors;
  }
  if (!Object.hasOwn(MAKER_SHAPES, s.makerShape))
    errors.push("Escolha um formato.");
  if (s.makerShape === "round" && s.width !== s.depth)
    errors.push("O formato redondo usa largura e profundidade iguais.");
  if (!["text", "figure", "both"].includes(s.makerContent))
    errors.push("Escolha texto, figura ou ambos.");
  if (!Object.hasOwn(TOY_FIGURES, s.makerFigure))
    errors.push("Escolha uma figura disponível.");
  n("makerStroke", 0.8, 3);
  n("makerTextHeight", 5, 35);
  n("makerBorderWidth", 0.8, 3);
  if (
    !LETTER_FONTS.some((f) => f.id === s.makerFont) ||
    (s.makerContent !== "figure" &&
      !validSignText({ ...s, signText: s.makerText, signFont: s.makerFont }))
  )
    errors.push("Use de 1 a 24 caracteres válidos e uma fonte disponível.");
  if (typeof s.makerText !== "string" || s.makerText.length > 24)
    errors.push("Texto: no máximo 24 caracteres.");
  if (
    typeof s.makerBorder !== "boolean" ||
    typeof s.makerHole !== "boolean" ||
    typeof s.makerHandle !== "boolean" ||
    typeof s.makerMirror !== "boolean"
  )
    errors.push("Opções de montagem inválidas.");
  n("makerHandleHeight", 12, 35);
  n("makerBoreDiameter", 3, 8);
  if (!["left", "right", "top"].includes(s.makerHolePosition))
    errors.push("Escolha a posição do furo.");
  if (!errors.length && kind === "relief" && s.makerHole) {
    const [x, y] = makerHoleCenter(s);
    if (
      booleanPolygons(
        [[circle(x, y, s.makerBoreDiameter / 2 + 1.2)]],
        [[makerOutline(s)]],
        "difference",
      ).length
    )
      errors.push(
        "O furo ficou perto da borda. Aumente a peça ou reduza o diâmetro.",
      );
  }
  if (!errors.length) {
    const art = makerArt(s);
    if (s.makerContent !== "figure" && art.textHeight < 4)
      errors.push("O texto ficou pequeno; aumente a peça ou reduza o texto.");
  }
  return errors;
}
export const TOY_FIGURES = {
  fish: "Peixe",
  turtle: "Tartaruga",
  butterfly: "Borboleta",
  owl: "Coruja",
  cat: "Gatinho",
  dog: "Cachorrinho",
  elephant: "Elefante",
  lion: "Leão",
  rabbit: "Coelho",
  dinosaur: "Dinossauro",
};
export function normalizeMakerDimensions(s) {
  if (
    familyFor(s) === "gears" &&
    [
      s.makerGearCount,
      s.makerGearTeeth,
      s.makerGearTeeth2,
      s.makerGearModule,
    ].every(Number.isFinite) &&
    Number.isInteger(s.makerGearCount) &&
    s.makerGearCount >= 2 &&
    s.makerGearCount <= 5
  ) {
    const m = gearMetrics(s);
    s.width = m.width;
    s.depth = m.depth;
  }
  if (familyFor(s) === "roller") s.height = s.depth + 2 * s.makerRelief;
  if (["stamp", "relief"].includes(familyFor(s)) && s.makerShape === "round")
    s.depth = s.width;
}
export function makerDetails(s) {
  const kind = familyFor(s);
  if (kind === "gears") {
    const m = gearMetrics(s);
    return [
      `${s.makerGearCount} engrenagens; dentes ${m.teeth.join(" / ")}; módulo ${s.makerGearModule} mm`,
      `Espessura ${s.height} mm; folga entre dentes ${s.makerGearBacklash} mm`,
      `Furo ${s.makerBoreDiameter} mm; folga radial do eixo ${s.clearance} mm`,
      s.makerGearBase
        ? "Base com eixos fixos; engrenagens removíveis, sem trava."
        : "Sem base; monte em eixos próprios.",
      "Movimento ilustrativo sincronizado; teste as folgas em protótipo.",
    ];
  }
  if (kind === "roller")
    return [
      `Rolo ${s.width} mm; corpo Ø${s.depth} mm; textura ${s.makerRelief} mm`,
      `${MAKER_PATTERNS[s.makerPattern]}; espaçamento ${s.makerPatternSpacing} mm`,
      s.makerHole
        ? `Furo axial Ø${s.makerBoreDiameter} mm para haste própria.`
        : "Sem furo; uso manual.",
      "STL orientado para imprimir pelo lado plano; confira aderência e suporte no fatiador.",
    ];
  return [
    `${kind === "stamp" ? "Matriz de carimbo" : "Plaquinha/chaveiro"} ${s.width} × ${s.depth} mm; base ${s.height} mm`,
    `Conteúdo: ${s.makerContent === "text" ? s.makerText : s.makerContent === "figure" ? TOY_FIGURES[s.makerFigure] : s.makerText + " + " + TOY_FIGURES[s.makerFigure]}`,
    `Relevo ${s.makerRelief} mm; ${s.makerBorder ? "borda de " + s.makerBorderWidth + " mm" : "sem borda"}`,
    kind === "stamp"
      ? `${s.makerMirror ? "Relevo espelhado para carimbar." : "Sem espelhar."} ${s.makerHandle ? "Cabo separado: colar no verso liso da matriz." : "Sem cabo."}`
      : s.makerHole
        ? `Furo Ø${s.makerBoreDiameter} mm; posição ${{ left: "esquerda", right: "direita", top: "superior" }[s.makerHolePosition]}.`
        : "Sem furo.",
  ];
}

export function makerReferenceContours(s) {
  const kind = familyFor(s);
  if (kind === "gears") {
    const m = gearMetrics(s);
    return [
      ...(s.makerGearBase
        ? [
            [
              [0, 0],
              [m.width, 0],
              [m.width, m.depth],
              [0, m.depth],
            ],
          ]
        : []),
      ...m.teeth.flatMap((n, i) => [
        gearOutline(n, s.makerGearModule, s.makerGearBacklash, m.phases[i]).map(
          ([x, y]) => [x + m.centers[i][0], y + m.centers[i][1]],
        ),
        circle(m.centers[i][0], m.centers[i][1], s.makerBoreDiameter / 2),
      ]),
    ];
  }
  if (kind === "roller")
    return [
      [
        [0, 0],
        [s.width, 0],
        [s.width, s.height],
        [0, s.height],
      ],
    ];
  const art = makerArt(s),
    shapes = [...art.glyphs.flat(), ...art.areas.flat()];
  const relief =
    kind === "stamp" && s.makerMirror
      ? shapes.map((r) => r.map(([x, y]) => [s.width - x, y]))
      : shapes;
  return [
    makerOutline(s),
    ...relief,
    ...(kind === "relief" && s.makerHole
      ? [circle(...makerHoleCenter(s), s.makerBoreDiameter / 2)]
      : []),
  ];
}
