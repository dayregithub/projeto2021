import fonts from "./font-data.json" with { type: "json" };
export const LETTER_FONTS = fonts.map(({ id, label, group }) => ({
  id,
  label,
  group,
}));
export const letteringFont = (s) => fonts.find((f) => f.id === s.signFont);
export function validSignText(s) {
  const font = letteringFont(s);
  return (
    typeof s.signText === "string" &&
    s.signText.trim().length > 0 &&
    s.signText.length <= 36 &&
    [...s.signText.normalize("NFC")].every(
      (c) => font?.glyphs[c] && /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .,&!?'()+:_-]$/.test(c),
    )
  );
}
export function letterContours(s) {
  const font = letteringFont(s);
  if (!font || !validSignText(s))
    throw Error("Use até 36 letras, números, acentos e pontuação simples.");
  let cursor = 0,
    previous = "",
    glyphs = [];
  for (const c of s.signText.normalize("NFC")) {
    const g = font.glyphs[c];
    cursor += font.kern[previous + c] || 0;
    if (g.rings.length)
      glyphs.push(g.rings.map((r) => r.map(([x, y]) => [x + cursor, y])));
    cursor += g.advance * (1 + s.signSpacing / 100);
    previous = c;
  }
  const points = glyphs.flat(2),
    minX = Math.min(...points.map((v) => v[0])),
    maxX = Math.max(...points.map((v) => v[0])),
    minY = Math.min(...points.map((v) => v[1])),
    maxY = Math.max(...points.map((v) => v[1]));
  if (!points.length || maxX - minX < 1 || maxY - minY < 1)
    throw Error("Digite ao menos uma letra ou número para criar o letreiro.");
  const margin = s.signBase ? Math.max(3, s.thickness) : 1,
    scale = Math.min(
      s.signTextHeight / (maxY - minY),
      (s.width - 2 * margin) / (maxX - minX),
      s.signOrientation === "standing"
        ? Infinity
        : (s.depth - 2 * margin) / (maxY - minY),
    ),
    width = (maxX - minX) * scale,
    height = (maxY - minY) * scale,
    dx = (s.width - width) / 2,
    dy = s.signOrientation === "standing" ? margin : (s.depth - height) / 2;
  return {
    width,
    height,
    glyphs: glyphs.map((rs) =>
      rs.map((r) =>
        r.map(([x, y]) => [(x - minX) * scale + dx, (y - minY) * scale + dy]),
      ),
    ),
  };
}

export function signMetrics(s) {
  const letters = letterContours(s);
  return {
    ...letters,
    totalHeight:
      s.signOrientation === "standing"
        ? letters.height + s.thickness
        : s.height,
  };
}
