// Original cartoon line art. All coordinates are vector curves in a 100 x 100
// design space, independent of browser fonts, raster images or remote services.
const oval = (x, y, rx, ry) =>
  `M ${x - rx} ${y} C ${x - rx} ${y - ry * 0.5523} ${x - rx * 0.5523} ${y - ry} ${x} ${y - ry} C ${x + rx * 0.5523} ${y - ry} ${x + rx} ${y - ry * 0.5523} ${x + rx} ${y} C ${x + rx} ${y + ry * 0.5523} ${x + rx * 0.5523} ${y + ry} ${x} ${y + ry} C ${x - rx * 0.5523} ${y + ry} ${x - rx} ${y + ry * 0.5523} ${x - rx} ${y} Z`;
export const TOY_ART = {
  butterfly: [
    // Scalloped wings, with a distinct upper/lower pair on either side.
    "M 46 40 C 37 17 12 3 6 17 C 1 28 11 44 36 51 C 19 47 6 52 10 69 C 13 84 23 92 33 84 C 40 79 44 70 47 61",
    "M 54 40 C 63 17 88 3 94 17 C 99 28 89 44 64 51 C 81 47 94 52 90 69 C 87 84 77 92 67 84 C 60 79 56 70 53 61",
    // Body and smiling face.
    "M 45 41 C 42 51 43 68 48 79 C 49 82 51 82 52 79 C 57 68 58 51 55 41",
    "M 43 35 C 42 26 46 22 50 22 C 54 22 58 26 57 35 C 57 42 54 46 50 46 C 46 46 43 42 43 35 Z",
    "M 46 23 C 44 16 42 11 37 10 C 33 9 31 13 34 15",
    "M 54 23 C 56 16 58 11 63 10 C 67 9 69 13 66 15",
    oval(47, 32, 1.5, 2.4),
    oval(53, 32, 1.5, 2.4),
    "M 47 38 C 49 41 51 41 53 38",
    // Curved wing panels, teardrops and spots.
    "M 39 41 C 29 25 13 15 13 24 C 14 32 24 39 39 44 C 40 44 40 43 39 41 Z",
    "M 61 41 C 71 25 87 15 87 24 C 86 32 76 39 61 44 C 60 44 60 43 61 41 Z",
    "M 40 58 C 32 53 18 54 18 63 C 18 73 25 79 30 74 C 35 70 38 65 40 58 Z",
    "M 60 58 C 68 53 82 54 82 63 C 82 73 75 79 70 74 C 65 70 62 65 60 58 Z",
    oval(13, 41, 1.8, 2),
    oval(20, 46, 1.6, 1.8),
    oval(87, 41, 1.8, 2),
    oval(80, 46, 1.6, 1.8),
    "M 46 54 C 49 56 51 56 54 54",
    "M 46 62 C 49 64 51 64 54 62",
    "M 47 70 C 49 71 51 71 53 70",
  ],
  turtle: [
    // Tail, flippers and feet have organic outlines rather than ellipses.
    "M 21 57 C 12 52 7 54 6 59 C 10 58 14 64 22 64",
    "M 29 66 C 21 66 15 71 17 77 C 20 84 32 83 38 75 L 40 69",
    "M 59 67 C 56 73 58 81 65 83 C 72 86 83 83 83 78 C 82 73 74 72 73 65",
    "M 24 76 L 26 80 M 29 75 L 32 79 M 65 78 L 65 82 M 71 78 L 72 82",
    // Head and neck; large brows, a cheek and a friendly smile.
    "M 70 58 C 80 61 91 61 95 55 C 99 49 95 44 92 42 C 94 34 88 29 83 32 C 79 26 71 29 72 39 L 68 45",
    oval(79, 39, 3.2, 5.1),
    oval(88, 40, 3.2, 4.8),
    oval(80, 40, 1.1, 2.2),
    oval(89, 41, 1.1, 2),
    "M 76 31 C 78 29 81 29 83 31",
    "M 86 32 C 89 31 91 32 92 34",
    "M 79 51 C 83 57 90 55 92 50",
    "M 91 48 C 93 48 94 50 94 51",
    "M 77 48 C 78 47 79 47 80 48",
    // Shell silhouette and a curved rim.
    "M 19 56 C 13 40 20 22 36 17 C 52 11 69 19 75 34 C 79 44 77 55 70 62 C 55 73 30 71 19 56 Z",
    "M 20 53 C 32 66 57 69 72 55",
    // Distinct shell plates.
    "M 38 28 C 43 25 52 25 57 30 L 61 42 L 55 54 L 40 54 L 32 42 Z",
    "M 38 28 L 35 19 M 57 30 L 65 23 M 61 42 L 75 39 M 55 54 L 61 63 M 40 54 L 34 63 M 32 42 L 18 39",
    "M 24 30 C 27 26 30 24 33 23",
  ],
  fish: [
    // A rounded fish with flowing fins, not a polygonal body.
    "M 25 38 C 16 27 6 24 6 30 C 9 39 11 46 7 58 C 4 66 14 68 24 57 C 31 72 46 81 62 77 C 77 75 88 65 91 55 C 97 54 99 50 95 47 C 95 35 87 25 75 22 C 63 12 42 16 31 27 C 28 30 26 34 25 38 Z",
    "M 43 21 C 43 10 56 6 61 12 C 65 7 74 11 70 21",
    "M 38 69 C 34 79 42 85 49 79 L 53 78",
    "M 14 34 C 18 42 19 50 13 58",
    "M 28 38 C 26 44 26 51 28 57",
    // Big eye, pupil, eyebrow and smiling cheek.
    oval(76, 40, 8, 9),
    oval(79, 42, 3.4, 4.7),
    oval(80, 40, 1, 1.4),
    "M 70 27 C 75 24 80 25 84 28",
    "M 77 58 C 82 63 89 60 91 55",
    "M 75 56 C 76 54 79 54 80 56",
    // Curved pectoral fin and scales.
    "M 52 46 C 42 37 34 43 38 53 C 41 63 51 60 56 52 C 58 49 56 47 52 46 Z",
    "M 41 47 L 50 51 M 42 54 L 50 52",
    "M 46 27 C 50 33 55 33 59 27 M 38 33 C 41 38 46 39 49 35",
    "M 54 35 C 58 41 63 41 66 35 M 57 58 C 60 64 65 64 69 58",
    "M 49 66 C 52 71 57 71 61 66",
  ],
};

// Adaptive cubic flattening provides smooth contours at fabrication scale.
// The maximum deviation is bounded in millimetres after the artwork is sized.
function flattenCubic(a, b, c, d, tolerance, out, depth = 0) {
  const dx = d[0] - a[0],
    dy = d[1] - a[1],
    length = Math.hypot(dx, dy);
  const distance = (p) =>
    length
      ? Math.abs(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / length
      : Math.hypot(p[0] - a[0], p[1] - a[1]);
  if (depth >= 14 || Math.max(distance(b), distance(c)) <= tolerance) {
    out.push(d);
    return;
  }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const ab = mid(a, b),
    bc = mid(b, c),
    cd = mid(c, d),
    abc = mid(ab, bc),
    bcd = mid(bc, cd),
    m = mid(abc, bcd);
  flattenCubic(a, ab, abc, m, tolerance, out, depth + 1);
  flattenCubic(m, bcd, cd, d, tolerance, out, depth + 1);
}
export function cartoonPaths(
  theme,
  { width, height, x = 0, y = 0, tolerance = 0.04 } = {},
) {
  const scale = Math.min(width, height) / 100,
    dx = x + (width - 100 * scale) / 2,
    dy = y + (height - 100 * scale) / 2;
  return TOY_ART[theme].flatMap((source) => {
    const tokens = source.match(/[MLCZ]|-?\d*\.?\d+/g);
    let i = 0,
      command,
      current,
      start,
      paths = [],
      path = [];
    const point = () => [
      dx + Number(tokens[i++]) * scale,
      dy + Number(tokens[i++]) * scale,
    ];
    while (i < tokens.length) {
      if (/[MLCZ]/.test(tokens[i])) command = tokens[i++];
      if (command === "M") {
        if (path.length > 1) paths.push(path);
        current = point();
        start = current;
        path = [current];
        command = "L";
      } else if (command === "L") {
        current = point();
        path.push(current);
      } else if (command === "C") {
        const b = point(),
          c = point(),
          d = point();
        flattenCubic(current, b, c, d, tolerance, path);
        current = d;
      } else if (command === "Z") {
        path.push(start);
        current = start;
        command = null;
      } else throw Error("Comando vetorial de ilustração inválido.");
    }
    if (path.length > 1) paths.push(path);
    return paths;
  });
}

export function simplifyArtPath(points, tolerance = 0.08) {
  if (points.length < 3) return points;
  const a = points[0],
    b = points.at(-1),
    dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = Math.hypot(dx, dy);
  let farthest = 0,
    index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i],
      distance = length
        ? Math.abs(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / length
        : Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (distance > farthest) {
      farthest = distance;
      index = i;
    }
  }
  return farthest <= tolerance
    ? [a, b]
    : [
        ...simplifyArtPath(points.slice(0, index + 1), tolerance).slice(0, -1),
        ...simplifyArtPath(points.slice(index), tolerance),
      ];
}
