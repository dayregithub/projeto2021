import { isEducational, educationalNotes } from "./educational.js";
import { BRUSH_TEXTURES, brushDrainage } from "./brush-features.js";
import { familyFor } from "./models.js";
import { LETTER_FONTS, signMetrics } from "./lettering.js";
import { brushOpenings, signProfileRings } from "./print3d.js";
import { zipSync, strToU8 } from "fflate";
import { jsPDF } from "jspdf";
import {
  modelById,
  panels,
  panelPolygons,
  panelContours,
  exportSVG,
  exportDXF,
  exportSTL,
  validate,
} from "./geometry.js";
import {
  printLayout,
  trianglesSTL,
  outlinePoints,
  PRINT_LIDS,
  extrudedTriangles,
} from "./print3d.js";
export const projectFilename = (s) =>
  s.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "projeto";
const printed = (s) => modelById(s.model).category === "print";
export function referenceContours(s) {
  if (familyFor(s) === "lettering")
    return [
      ...(s.signBase
        ? [outlinePoints(s.width, s.depth, Math.min(3, s.depth / 8))]
        : []),
      ...signProfileRings(s).map((r) =>
        r.map(([x, y]) => [
          x + (s.signOrientation === "standing" ? s.width + 20 : 0),
          y,
        ]),
      ),
    ];
  if (familyFor(s) === "toothbrush") {
    const r = s.brushShape === "round" ? s.width / 2 - 0.001 : s.cornerRadius;
    return [
      outlinePoints(s.width, s.depth, r),
      outlinePoints(
        s.width - 2 * s.thickness,
        s.depth - 2 * s.thickness,
        Math.max(0, r - s.thickness),
        s.thickness,
        s.thickness,
      ),
      ...(s.printLid !== "none"
        ? brushOpenings(s).centers.map(([x, y]) =>
            Array.from({ length: 32 }, (_, i) => [
              x + brushOpenings(s).radius * Math.cos((i * Math.PI) / 16),
              y + brushOpenings(s).radius * Math.sin((i * Math.PI) / 16),
            ]),
          )
        : []),
    ];
  }

  const t = s.thickness,
    r = s.cornerRadius;
  return [
    outlinePoints(s.width, s.depth, r),
    outlinePoints(s.width - 2 * t, s.depth - 2 * t, Math.max(0, r - t), t, t),
    [
      [s.width + 20, 0],
      [s.width + 20 + s.width, 0],
      [s.width + 20 + s.width, s.height],
      [s.width + 20, s.height],
    ],
  ];
}
const escape = (s) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function projectSVG(s) {
  if (!printed(s)) return exportSVG(s);
  const width = 2 * s.width + 20,
    height = Math.max(
      s.depth,
      s.height,
      familyFor(s) === "lettering" ? signMetrics(s).totalHeight + 5 : 0,
    );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><title>${escape(s.name)} — vistas de referência</title><desc>Vista superior e frontal em mm. Referência dimensional; não é arquivo de corte. Use STL para imprimir. Tampa: ${PRINT_LIDS[s.printLid]}.</desc><g id="REFERENCE" fill="none" stroke="#3159a8" stroke-width="0.2">${referenceContours(
    s,
  )
    .map(
      (r) =>
        `<path d="${r.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")}Z"/>`,
    )
    .join("")}</g></svg>`;
}
export function projectDXF(s) {
  if (!printed(s)) return exportDXF(s);
  const out = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$INSUNITS",
    "70",
    "4",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
  ];
  for (const ring of referenceContours(s)) {
    out.push(
      "0",
      "LWPOLYLINE",
      "100",
      "AcDbEntity",
      "8",
      "REFERENCE",
      "100",
      "AcDbPolyline",
      "90",
      String(ring.length),
      "70",
      "1",
    );
    for (const [x, y] of ring) out.push("10", String(x), "20", String(-y));
  }
  out.push("0", "ENDSEC", "0", "EOF");
  return out.join("\n");
}
// Extrude the actual laser outlines, including holes, for a reference assembly.
export function laserTriangles(s) {
  return panels(s).flatMap((panel) => {
    const { origin, u, v, normal } = panel.pose,
      cross = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ],
      flip = cross.reduce((n, x, i) => n + x * normal[i], 0) < 0;
    return extrudedTriangles(panelPolygons(panel), s.thickness).map((tri) => {
      const vertices = tri.map(([x, y, z]) =>
        origin.map((n, i) => n + u[i] * x + v[i] * y + normal[i] * z),
      );
      return flip ? vertices.reverse() : vertices;
    });
  });
}
export function projectSTL(s) {
  return printed(s)
    ? exportSTL(s)
    : trianglesSTL(laserTriangles(s), "montagem_referencia");
}
function lineRing(doc, ring, dx, dy, closed = true) {
  for (let i = 1; i < ring.length; i++)
    doc.line(
      ring[i - 1][0] + dx,
      ring[i - 1][1] + dy,
      ring[i][0] + dx,
      ring[i][1] + dy,
    );
  if (closed)
    doc.line(
      ring.at(-1)[0] + dx,
      ring.at(-1)[1] + dy,
      ring[0][0] + dx,
      ring[0][1] + dy,
    );
}
export function projectPDF(s) {
  const parts = printed(s) ? [] : panels(s);
  let doc;
  if (parts.length) {
    for (const [i, p] of parts.entries()) {
      const format = [Math.max(80, p.width + 20), Math.max(65, p.height + 35)];
      if (!doc)
        doc = new jsPDF({
          unit: "mm",
          format,
          orientation: format[0] > format[1] ? "landscape" : "portrait",
          compress: true,
        });
      else
        doc.addPage(format, format[0] > format[1] ? "landscape" : "portrait");
      doc.setFontSize(10);
      doc.setTextColor(25);
      doc.text(`${i + 1}. ${p.name}`, 10, 8, { maxWidth: format[0] - 20 });
      doc.setFontSize(8);
      doc.text(
        `${p.width.toFixed(2)} x ${p.height.toFixed(2)} mm | espessura ${s.thickness} mm | escala 1:1`,
        10,
        13,
        { maxWidth: format[0] - 20 },
      );
      doc.setLineWidth(0.1);
      doc.setDrawColor(255, 0, 0);
      for (const r of panelContours(p)) lineRing(doc, r, 10, 23);
      doc.setDrawColor(0, 0, 255);
      for (const r of p.engravingPaths || []) lineRing(doc, r, 10, 23, false);
      for (const poly of p.engravingAreas || []) {
        const operations = poly.flatMap((ring) => [
          { op: "m", c: [ring[0][0] + 10, ring[0][1] + 23] },
          ...ring.slice(1).map(([x, y]) => ({ op: "l", c: [x + 10, y + 23] })),
          { op: "h", c: [] },
        ]);
        doc.path(operations);
        if (p.engravingFilled) {
          doc.setFillColor(0, 0, 255);
          doc.fillEvenOdd();
        } else doc.stroke();
      }
    }
  } else {
    doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFontSize(18);
    doc.text("Papeled Maker", 15, 20);
    doc.setFontSize(12);
    doc.text(s.name, 15, 32);
    doc.setFontSize(10);
    const special =
      familyFor(s) === "lettering"
        ? [
            `Texto: ${s.signText}`,
            `Posicao: ${s.signOrientation === "standing" ? "em pe" : "relevo"}; unidas: ${s.signJoin ? "sim" : "nao"}; espaco: ${s.signSpacing}%`,
            `Fonte: ${LETTER_FONTS.find((f) => f.id === s.signFont).label}`,
            `Base: ${s.signBase ? "sim" : "nao"} | altura total ${signMetrics(s).totalHeight.toFixed(1)} mm`,
          ]
        : familyFor(s) === "toothbrush"
          ? [
              `Textura: ${BRUSH_TEXTURES[s.brushTexture]}`,
              `Cobertura alta: ${s.brushCover ? s.brushCoverHeight + " mm" : "nao"}; drenagem: ${s.brushDrain ? (2 * brushDrainage(s).radius).toFixed(1) + " mm, 5 furos, pes 2 mm" : "nao"}`,
              `Porta-escovas ${s.brushShape === "round" ? "redondo" : "quadrado"}`,
              s.printLid === "none"
                ? "Sem tampa"
                : `Aberturas na tampa: ${s.brushHoles}`,
            ]
          : [];
    const lines = [
      ...special,
      `Corpo: ${s.width} x ${s.depth} x ${s.height} mm`,
      familyFor(s) === "lettering"
        ? s.signBase
          ? `Base: ${s.thickness} mm`
          : `Letras: ${s.height} mm de espessura`
        : `Parede / fundo: ${s.thickness} mm`,
      `Raio dos cantos: ${s.cornerRadius} mm`,
      `Tampa: ${PRINT_LIDS[s.printLid]}`,
      `Folga por lado: ${s.clearance} mm`,
      familyFor(s) === "lettering"
        ? s.signBase
          ? s.signOrientation === "standing"
            ? "Letras em pe unidas a base; detalhes recebem apoios."
            : "Letras em relevo unidas a base."
          : s.signJoin
            ? "Letras e acentos unidos por ligacoes de 1,2 mm."
            : "Letras e acentos podem ser pecas independentes."
        : "Corpo em peca unica. Tampa e pino, quando presentes, separados.",
      "Vistas ilustrativas: dimensoes declaradas prevalecem.",
      "Use os arquivos STL para imprimir; SVG/DXF sao referencias.",
    ];
    lines.forEach((line, i) => doc.text(line, 15, 44 + i * 7));
    const scale = Math.min(
      175 / (2 * s.width + 20),
      85 /
        Math.max(
          s.depth,
          s.height,
          familyFor(s) === "lettering" ? signMetrics(s).totalHeight + 5 : 0,
        ),
    );
    doc.setDrawColor(49, 89, 168);
    for (const r of referenceContours(s))
      lineRing(
        doc,
        r.map(([x, y]) => [x * scale, y * scale]),
        15,
        115 + special.length * 7,
      );
  }
  doc.setProperties({
    title: s.name,
    author: "Papeled Maker",
    subject: printed(s)
      ? "Resumo para impressao 3D"
      : "Paineis de corte em escala real",
  });
  return new Uint8Array(doc.output("arraybuffer"));
}
export function projectPackage(s, message = "") {
  const errors = validate(s);
  if (errors.length) throw Error(errors[0]);
  const base = projectFilename(s),
    files = {};
  files[base + ".svg"] = strToU8(projectSVG(s));
  files[base + ".dxf"] = strToU8(projectDXF(s));
  files[base + ".pdf"] = projectPDF(s);
  files[base + (printed(s) ? "" : "-montagem-referencia") + ".stl"] = strToU8(
    projectSTL(s),
  );
  files[base + ".papeled.json"] = strToU8(JSON.stringify(s, null, 2));
  if (
    printed(s) &&
    (s.printLid !== "none" || (familyFor(s) === "toothbrush" && s.brushCover))
  ) {
    for (const p of printLayout(s)) {
      const minX = Math.min(...p.triangles.flat().map((v) => v[0]));
      const triangles = p.triangles.map((tri) =>
        tri.map((v) => [v[0] - minX, v[1], v[2]]),
      );
      files[`pecas/${base}-${p.id}.stl`] = strToU8(
        trianglesSTL(triangles, p.id),
      );
    }
  }
  files["LEIA-ME.txt"] = strToU8(
    `Papeled Maker — ${s.name}\n\n${printed(s) ? "STL: modelo para impressao 3D; quando ha tampa, corpo/tampa/pino tambem tem STLs individuais. O STL principal distribui as pecas lado a lado, com base em Z=0. SVG/DXF: vistas dimensionais de referencia, nao cortar a laser. PDF: ficha do projeto." : "SVG/DXF: pecas de corte em mm; CUT vermelho e ENGRAVE azul. PDF: uma peca por pagina em escala 1:1, imprimir em tamanho real, sem ajustar. STL: referencia da montagem fechada; nao e uma peca unica para impressao."}\nJSON: projeto editavel. ${isEducational(s) ? educationalNotes(s) + "\n" : ""}Sem compensacao de kerf. Teste encaixes e folgas antes de produzir.\n\nWhatsApp: +55 61 99243-0051\npapeledmaker@gmail.com\n`,
  );
  if (message) files["pedido-de-orcamento.txt"] = strToU8(message);
  return {
    name: base + ".zip",
    data: zipSync(files, { level: 6 }),
    files: Object.keys(files),
  };
}
