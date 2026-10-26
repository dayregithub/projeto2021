import { panels, validate, panelContours } from "./geometry.js";
import { isBlankPuzzle, toyMetrics } from "./educational.js";

// Retain the assembled XY coordinates. Nesting/packing these pieces would
// destroy registration with an adhesive image applied to a single blank.
export function stickerLayout(s) {
  if (!isBlankPuzzle(s))
    throw Error(
      "Escolha “Sem figura · para adesivar” para exportar o corte da imagem montada.",
    );
  const errors = validate(s);
  if (errors.length) throw Error(errors[0]);
  const m = toyMetrics(s);
  return {
    width: m.innerWidth,
    height: m.innerDepth,
    pieces: panels(s)
      .filter((p) => p.group === "toy-piece")
      .map((p) => ({
        name: p.name,
        contours: panelContours(p).map((ring) =>
          ring.map(([x, y]) => [
            x + p.pose.origin[0] - m.margin,
            y + p.pose.origin[1] - m.margin,
          ]),
        ),
      })),
  };
}
export function stickerSVG(s) {
  const l = stickerLayout(s);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${l.width}mm" height="${l.height}mm" viewBox="0 0 ${l.width} ${l.height}"><title>Corte da imagem montada — Papeled Maker</title><desc>Milímetros, escala 1:1. Área da imagem ${l.width} × ${l.height} mm. Somente as peças na posição montada, com a folga configurada; sem gravação. Base e moldura estão no arquivo principal. Alinhe a imagem à origem 0,0 sem redimensionar. Use adesivo e impressão compatíveis com laser, sem PVC.</desc><g id="CUT" fill="none" stroke="#ff0000" stroke-width="0.1">${l.pieces.flatMap((p) => p.contours.map((r) => `<path d="${r.map(([x, y], i) => `${i ? "L" : "M"}${+x.toFixed(4)} ${+y.toFixed(4)}`).join(" ")}Z"/>`)).join("")}</g></svg>`;
}
export function stickerDXF(s) {
  const l = stickerLayout(s),
    out = [
      "0",
      "SECTION",
      "2",
      "HEADER",
      "9",
      "$ACADVER",
      "1",
      "AC1015",
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
  for (const p of l.pieces)
    for (const r of p.contours) {
      out.push(
        "0",
        "LWPOLYLINE",
        "100",
        "AcDbEntity",
        "8",
        "CUT",
        "62",
        "1",
        "100",
        "AcDbPolyline",
        "90",
        String(r.length),
        "70",
        "1",
      );
      for (const [x, y] of r)
        out.push("10", String(x), "20", String(l.height - y));
    }
  out.push("0", "ENDSEC", "0", "EOF");
  return out.join("\n");
}
