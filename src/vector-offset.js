import Clipper from "clipper-lib";
const SCALE = 100000;
const toPoint = ([x, y]) => ({
  X: Math.round(x * SCALE),
  Y: Math.round(y * SCALE),
});
const fromTree = (tree) =>
  Clipper.JS.PolyTreeToExPolygons(tree).map((poly) =>
    [poly.outer, ...poly.holes].map((r) =>
      r.map((p) => [p.X / SCALE, p.Y / SCALE]),
    ),
  );
export function insetPolygon(shape, distance) {
  const offset = new Clipper.ClipperOffset(2, 0.02 * SCALE);
  offset.AddPaths(
    shape.flat().map((r) => r.map(toPoint)),
    Clipper.JoinType.jtRound,
    Clipper.EndType.etClosedPolygon,
  );
  const tree = new Clipper.PolyTree();
  offset.Execute(tree, -distance * SCALE);
  return fromTree(tree);
}
// Real closed stroke polygons, rather than a visual SVG stroke-width. The two
// sides are separated by exactly width mm along straight segments.
export function strokeAreas(paths, width) {
  const offset = new Clipper.ClipperOffset(2, 0.025 * SCALE);
  for (const path of paths) {
    const closed =
      Math.hypot(path[0][0] - path.at(-1)[0], path[0][1] - path.at(-1)[1]) <
      1e-6;
    offset.AddPath(
      (closed ? path.slice(0, -1) : path).map(toPoint),
      Clipper.JoinType.jtRound,
      closed ? Clipper.EndType.etClosedLine : Clipper.EndType.etOpenRound,
    );
  }
  const tree = new Clipper.PolyTree();
  offset.Execute(tree, (width * SCALE) / 2);
  return fromTree(tree);
}

// Integer boolean operations avoid near-coincident floating point edges when
// translated artwork is clipped against a socket or a narrow border strip.
export function booleanPolygons(subject, clip, operation = "intersection") {
  if (!subject.length) return [];
  const op = {
    intersection: Clipper.ClipType.ctIntersection,
    difference: Clipper.ClipType.ctDifference,
  }[operation];
  if (op === undefined) throw Error("Operação vetorial inválida.");
  const cutter = new Clipper.Clipper();
  cutter.AddPaths(
    subject.flat().map((r) => r.map(toPoint)),
    Clipper.PolyType.ptSubject,
    true,
  );
  cutter.AddPaths(
    clip.flat().map((r) => r.map(toPoint)),
    Clipper.PolyType.ptClip,
    true,
  );
  const tree = new Clipper.PolyTree();
  cutter.Execute(
    op,
    tree,
    Clipper.PolyFillType.pftNonZero,
    Clipper.PolyFillType.pftNonZero,
  );
  return fromTree(tree);
}
