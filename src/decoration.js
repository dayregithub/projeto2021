import clipping from "polygon-clipping";
export const DECORATIONS = {
  none: "Sem recorte",
  heart: "Coração",
  circle: "Círculo",
  star: "Estrela",
  flower: "Flor",
};
// A compact, deterministic single-stroke alphabet. Every export uses these same
// polylines, so engraving never depends on fonts installed on the laser machine.
const LETTERS = {
  A: "0,6 0,2 2,0 4,2 4,6|0,3 4,3",
  B: "0,6 0,0 3,0 4,1 4,2 3,3 0,3|3,3 4,4 4,5 3,6 0,6",
  C: "4,0 1,0 0,1 0,5 1,6 4,6",
  D: "0,6 0,0 2,0 4,2 4,4 2,6 0,6",
  E: "4,0 0,0 0,6 4,6|0,3 3,3",
  F: "4,0 0,0 0,6|0,3 3,3",
  G: "4,1 3,0 1,0 0,1 0,5 1,6 4,6 4,3 2,3",
  H: "0,0 0,6|4,0 4,6|0,3 4,3",
  I: "0,0 4,0|2,0 2,6|0,6 4,6",
  J: "4,0 4,5 3,6 1,6 0,5",
  K: "0,0 0,6|4,0 0,3 4,6",
  L: "0,0 0,6 4,6",
  M: "0,6 0,0 2,3 4,0 4,6",
  N: "0,6 0,0 4,6 4,0",
  O: "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0",
  P: "0,6 0,0 3,0 4,1 4,2 3,3 0,3",
  Q: "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0|2,4 4,6",
  R: "0,6 0,0 3,0 4,1 4,2 3,3 0,3|2,3 4,6",
  S: "4,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 0,6",
  T: "0,0 4,0|2,0 2,6",
  U: "0,0 0,5 1,6 3,6 4,5 4,0",
  V: "0,0 0,3 2,6 4,3 4,0",
  W: "0,0 0,6 2,3 4,6 4,0",
  X: "0,0 4,6|4,0 0,6",
  Y: "0,0 2,3 4,0|2,3 2,6",
  Z: "0,0 4,0 0,6 4,6",
  0: "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0|0,5 4,1",
  1: "1,1 2,0 2,6|0,6 4,6",
  2: "0,1 1,0 3,0 4,1 4,2 0,6 4,6",
  3: "0,0 4,0 2,3 4,4 4,5 3,6 0,6|1,3 2,3",
  4: "3,6 3,0 0,4 4,4",
  5: "4,0 0,0 0,3 3,3 4,4 4,5 3,6 0,6",
  6: "4,0 1,0 0,2 0,5 1,6 3,6 4,5 4,4 3,3 0,3",
  7: "0,0 4,0 1,6",
  8: "1,0 3,0 4,1 4,2 3,3 1,3 0,2 0,1 1,0|1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3",
  9: "4,3 1,3 0,2 0,1 1,0 3,0 4,1 4,4 3,6 0,6",
  "-": "0,3 4,3",
  ".": "2,5.7 2,6",
  "'": "2,0 2,1.4",
  "&": "4,6 1,3 1,1 2,0 3,1 3,2 0,4 0,5 1,6 2,6 4,3",
};
const accents = {
  "\u0301": "1,-.5 3,-1.5",
  "\u0300": "1,-1.5 3,-.5",
  "\u0302": "0,-.5 2,-1.5 4,-.5",
  "\u0303": "0,-.6 1,-1.3 3,-.3 4,-1",
  "\u0308": "1,-1.5 1,-1|3,-1.5 3,-1",
  "\u0327": "2,6 1,7 2,7.5",
};
const lines = (s) =>
  s
    .split("|")
    .map((line) => line.split(" ").map((v) => v.split(",").map(Number)));
export function validEngraving(text) {
  if (typeof text !== "string" || text.length > 30) return false;
  return [...text.normalize("NFC").toUpperCase()].every((c) => {
    if (c === " ") return true;
    const [letter, ...marks] = [...c.normalize("NFD")];
    return !!LETTERS[letter] && marks.every((m) => accents[m]);
  });
}
function engraving(text, area, size, hasCutout, t) {
  const chars = [...text.trim().normalize("NFC").toUpperCase()],
    width = chars.length * 5.5 - 1.5;
  if (width <= 0) return [];
  const margin = Math.max(3 * t, 4),
    safeH = area.height - 2 * margin;
  const scale = Math.min(
      size / 8,
      (area.width - 2 * margin) / width,
      (safeH * 0.2) / 9,
    ),
    x0 = area.x + (area.width - width * scale) / 2,
    y0 = area.y + margin + safeH * (hasCutout ? 0.72 : 0.4);
  let x = x0,
    out = [];
  for (const c of chars) {
    if (c !== " ") {
      const [base, ...marks] = [...c.normalize("NFD")];
      for (const stroke of lines(LETTERS[base]))
        out.push(
          stroke.map(([u, v]) => [x + u * scale, y0 + (v + 1.5) * scale]),
        );
      for (const m of marks)
        for (const stroke of lines(accents[m]))
          out.push(
            stroke.map(([u, v]) => [x + u * scale, y0 + (v + 1.5) * scale]),
          );
    }
    x += 5.5 * scale;
  }
  return out;
}
function ornament(type, cx, cy, size) {
  let pts = [];
  const r = size / 2;
  if (type === "heart") {
    for (let i = 0; i < 80; i++) {
      const a = (i * Math.PI * 2) / 80;
      pts.push([
        16 * Math.sin(a) ** 3,
        -(
          13 * Math.cos(a) -
          5 * Math.cos(2 * a) -
          2 * Math.cos(3 * a) -
          Math.cos(4 * a)
        ),
      ]);
    }
    const minX = Math.min(...pts.map((p) => p[0])),
      maxX = Math.max(...pts.map((p) => p[0])),
      minY = Math.min(...pts.map((p) => p[1])),
      maxY = Math.max(...pts.map((p) => p[1]));
    pts = pts.map(([x, y]) => [
      cx + ((x - (minX + maxX) / 2) / (maxX - minX)) * size,
      cy + ((y - (minY + maxY) / 2) / (maxY - minY)) * size,
    ]);
  } else {
    const count = type === "star" ? 10 : 64;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / count,
        rr =
          type === "star"
            ? i % 2
              ? r * 0.45
              : r
            : type === "flower"
              ? r * (0.76 + 0.24 * Math.cos(5 * a))
              : r;
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
  }
  return [[pts]];
}
export function decoratePanels(s, parts) {
  const target = parts.find((p) => p.role === "lid-panel");
  if (!target || (!s.engraveName && s.lidCutout === "none")) return parts;
  const area = target.coverArea || {
      x: 0,
      y: 0,
      width: target.width,
      height: target.height,
    },
    margin = Math.max(3 * s.thickness, 4),
    available = Math.min(area.width - 2 * margin, area.height - 2 * margin);
  if (available <= 0) throw Error("Tampa pequena demais para personalização.");
  if (s.lidCutout !== "none") {
    const size = (available * s.decorationSize) / 100,
      shape = ornament(
        s.lidCutout,
        area.x + area.width / 2,
        area.y + area.height * (s.engraveName ? 0.42 : 0.5),
        size,
      );
    target.shape = clipping.difference(target.shape, shape).map((poly) =>
      poly.map((r) => {
        const a = r.map((p) => [...p]);
        if (
          a.length > 1 &&
          Math.hypot(a[0][0] - a.at(-1)[0], a[0][1] - a.at(-1)[1]) < 1e-7
        )
          a.pop();
        return a;
      }),
    );
  }
  target.engravingPaths = engraving(
    s.engraveName,
    area,
    s.engraveSize,
    s.lidCutout !== "none",
    s.thickness,
  );
  return parts;
}
