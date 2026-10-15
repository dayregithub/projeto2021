export const BRUSH_TEXTURES = {
  none: "Lisa",
  ribbed: "Canelada vertical",
  rings: "Anéis horizontais",
  dots: "Pontilhada",
};
export function brushDrainage(s) {
  const inside = s.width / 2 - s.thickness,
    radius = Math.min(s.brushDrainDiameter / 2, inside * 0.18),
    orbit = inside * 0.42;
  return {
    radius,
    lift: s.brushDrain ? 2 : 0,
    centers: [
      [s.width / 2, s.depth / 2],
      ...[0, 1, 2, 3].map((i) => [
        s.width / 2 + orbit * Math.cos((i * Math.PI) / 2),
        s.depth / 2 + orbit * Math.sin((i * Math.PI) / 2),
      ]),
    ],
  };
}
export function brushCoverDimensions(s) {
  const seatOffset = s.printLid === "outer" ? s.clearance + s.thickness : 0,
    seatZ = s.height + (s.printLid === "outer" ? s.clearance + s.thickness : 0),
    lip = Math.min(2 * s.thickness + 2, s.height / 3);
  return {
    innerOffset: seatOffset + s.clearance,
    outerOffset: seatOffset + s.clearance + s.thickness,
    bottom: seatZ - lip,
    stopZ: seatZ + s.clearance,
    top: seatZ + s.clearance + 2 * s.thickness + s.brushCoverHeight,
  };
}
