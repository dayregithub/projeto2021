// Closed, compound paths preserve holes (e.g. the two sides of a border).
export const engravingAreaPath = (poly, dx = 0, dy = 0) =>
  poly
    .map(
      (ring) =>
        ring
          .map(
            ([x, y], i) =>
              `${i ? "L" : "M"}${+(x + dx).toFixed(4)} ${+(y + dy).toFixed(4)}`,
          )
          .join(" ") + "Z",
    )
    .join(" ");
export function engravingAreasSVG(
  panel,
  dx = 0,
  dy = 0,
  { color = "#0000ff", strokeWidth = 0.15 } = {},
) {
  return (panel.engravingAreas || [])
    .map(
      (poly) =>
        `<path d="${engravingAreaPath(poly, dx, dy)}" fill="${panel.engravingFilled ? color : "none"}" fill-rule="evenodd" stroke="${color}" stroke-width="${strokeWidth}"/>`,
    )
    .join("");
}
