import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import opentype from "opentype.js";
const names = [
  ["roboto", "Roboto", "Comuns"],
  ["lato", "Lato", "Comuns"],
  ["montserrat", "Montserrat", "Comuns"],
  ["oswald", "Oswald", "Comuns"],
  ["merriweather", "Merriweather", "Formais"],
  ["playfair-display", "Playfair Display", "Formais"],
  ["lora", "Lora", "Formais"],
  ["pacifico", "Pacifico", "Manuscritas"],
  ["dancing-script", "Dancing Script", "Manuscritas"],
  ["caveat", "Caveat", "Manuscritas"],
];
const chars = [
  ...new Set([
    ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join(
      "",
    ),
    ..."ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ",
  ]),
];
const dist = (p, a, b) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  return (
    Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) /
    (Math.hypot(dx, dy) || 1)
  );
};
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function curve(points, out, n = 0) {
  if (
    n > 9 ||
    Math.max(
      ...points.slice(1, -1).map((p) => dist(p, points[0], points.at(-1))),
    ) < 0.16
  ) {
    out.push(points.at(-1));
    return;
  }
  let layers = [points];
  while (layers.at(-1).length > 1) {
    const a = layers.at(-1);
    layers.push(a.slice(1).map((v, i) => mid(a[i], v)));
  }
  curve(
    layers.map((a) => a[0]),
    out,
    n + 1,
  );
  curve(layers.map((a) => a.at(-1)).reverse(), out, n + 1);
}
function contours(commands) {
  let out = [],
    r = [],
    pos = [0, 0];
  const end = () => {
    if (r.length > 2) {
      if (Math.hypot(r[0][0] - r.at(-1)[0], r[0][1] - r.at(-1)[1]) < 1e-5)
        r.pop();
      out.push(r.map((p) => p.map((n) => Math.round(n * 1000) / 1000)));
    }
    r = [];
  };
  for (const c of commands) {
    const next = [c.x, c.y];
    if (c.type === "M") {
      end();
      r.push(next);
    }
    if (c.type === "L") r.push(next);
    if (c.type === "Q") curve([pos, [c.x1, c.y1], next], r);
    if (c.type === "C") curve([pos, [c.x1, c.y1], [c.x2, c.y2], next], r);
    if (c.type === "Z") {
      end();
      continue;
    }
    pos = next;
  }
  end();
  return out;
}
const fonts = [];
mkdirSync("public/font-licenses", { recursive: true });
for (const [id, label, group] of names) {
  const bytes = readFileSync(
      `node_modules/@fontsource/${id}/files/${id}-latin-400-normal.woff`,
    ),
    font = opentype.parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ),
    glyphs = {},
    kern = {};
  for (const c of chars) {
    const g = font.charToGlyph(c);
    if (g.index)
      glyphs[c] = {
        advance: (g.advanceWidth / font.unitsPerEm) * 100,
        rings: contours(g.getPath(0, 0, 100).commands),
      };
  }
  for (const a of chars)
    for (const b of chars) {
      const value = font.getKerningValue(
        font.charToGlyph(a),
        font.charToGlyph(b),
      );
      if (value)
        kern[a + b] = Math.round((value / font.unitsPerEm) * 100000) / 1000;
    }
  fonts.push({ id, label, group, glyphs, kern });
  copyFileSync(
    `node_modules/@fontsource/${id}/LICENSE`,
    `public/font-licenses/${id}.txt`,
  );
}
writeFileSync("src/font-data.json", JSON.stringify(fonts));
console.log(`Generated ${fonts.length} local outline fonts.`);
