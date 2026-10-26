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

Object.assign(TOY_ART, {
  owl: [
    "M 20 37 C 17 26 19 17 21 11 C 29 14 34 19 38 22 C 45 19 55 19 62 22 C 66 19 71 14 79 11 C 81 17 83 26 80 37 C 88 46 86 67 77 79 C 64 94 36 94 23 79 C 14 67 12 46 20 37 Z",
    "M 22 44 C 8 47 9 66 20 72 C 22 62 25 56 29 52",
    "M 78 44 C 92 47 91 66 80 72 C 78 62 75 56 71 52",
    oval(35, 40, 14, 16),
    oval(65, 40, 14, 16),
    oval(37, 41, 6, 8),
    oval(63, 41, 6, 8),
    oval(39, 39, 1.6, 2),
    oval(61, 39, 1.6, 2),
    "M 46 51 C 48 49 52 49 54 51 L 50 59 Z",
    "M 28 28 C 33 24 39 24 43 28 M 57 28 C 61 24 67 24 72 28",
    "M 30 65 C 34 69 38 69 42 65 M 46 67 C 50 71 54 71 58 67 M 34 76 C 38 80 42 80 46 76 M 54 76 C 58 80 62 80 66 76",
    "M 30 88 C 24 94 32 96 36 92 C 40 97 45 94 42 89 M 58 89 C 55 94 60 97 64 92 C 68 96 76 94 70 88",
  ],
  cat: [
    "M 27 31 L 23 9 C 33 11 39 18 42 23 C 47 21 53 21 58 23 C 61 18 67 11 77 9 L 73 31 C 84 42 80 59 66 66 C 57 71 43 71 34 66 C 20 59 16 42 27 31 Z",
    "M 29 26 L 28 17 L 36 25 M 64 25 L 72 17 L 71 26",
    oval(36, 43, 4, 6),
    oval(64, 43, 4, 6),
    "M 45 51 C 47 48 53 48 55 51 C 54 55 50 57 50 57 C 50 57 46 55 45 51 Z",
    "M 50 57 L 50 60 C 46 65 42 63 40 60 M 50 60 C 54 65 58 63 60 60",
    "M 31 52 L 10 47 M 31 57 L 9 58 M 69 52 L 90 47 M 69 57 L 91 58",
    "M 35 68 C 27 75 27 85 32 90 M 65 68 C 73 75 73 85 68 90",
    "M 35 82 C 28 81 25 88 30 93 C 35 97 44 95 46 91 M 65 82 C 72 81 75 88 70 93 C 65 97 56 95 54 91",
    "M 46 76 L 46 91 M 54 76 L 54 91 M 46 91 C 48 94 52 94 54 91",
    "M 72 85 C 92 85 94 71 89 66 C 84 60 78 65 81 70 C 85 73 84 78 73 77",
    "M 31 89 L 33 94 M 37 89 L 38 95 M 62 89 L 62 95 M 68 89 L 67 94",
  ],
  dog: [
    "M 30 27 C 35 18 45 18 50 22 C 55 18 65 18 70 27 C 80 29 83 42 78 54 C 74 66 64 72 50 72 C 36 72 26 66 22 54 C 17 42 20 29 30 27 Z",
    "M 29 27 C 23 17 11 18 8 31 C 5 43 10 58 19 56 C 25 55 26 45 25 39",
    "M 71 27 C 77 17 89 18 92 31 C 95 43 90 58 81 56 C 75 55 74 45 75 39",
    oval(37, 42, 4.5, 6.5),
    oval(63, 42, 4.5, 6.5),
    "M 43 51 C 45 47 55 47 57 51 C 57 57 52 59 50 59 C 48 59 43 57 43 51 Z",
    "M 50 59 L 50 62 C 44 68 37 65 36 60 M 50 62 C 56 68 63 65 64 60",
    "M 45 66 C 44 76 56 76 55 66 M 50 68 L 50 73",
    "M 30 70 C 36 77 64 77 70 70 M 32 76 C 28 81 29 88 33 91 M 68 76 C 72 81 71 88 67 91",
    "M 37 84 C 28 84 26 93 35 95 L 45 95 L 45 82 M 63 84 C 72 84 74 93 65 95 L 55 95 L 55 82",
    "M 35 91 L 35 95 M 40 91 L 40 95 M 60 91 L 60 95 M 65 91 L 65 95",
    oval(50, 79, 3, 3),
  ],
  elephant: [
    "M 26 38 C 24 20 39 12 54 14 C 70 13 84 25 80 44 C 87 54 85 73 75 76 C 68 78 65 73 67 68 C 69 64 73 66 73 69 C 77 68 77 60 72 57",
    "M 27 33 C 9 23 5 40 11 54 C 16 66 29 67 35 55 C 38 47 35 39 27 33 Z",
    "M 31 35 C 23 24 15 34 17 45 C 18 52 23 58 29 53",
    "M 27 60 C 23 69 22 82 27 89 L 39 89 L 41 77 M 41 77 C 45 80 53 80 57 77 L 59 89 L 72 89 C 78 83 78 78 76 75",
    "M 29 84 L 29 89 M 34 84 L 34 89 M 62 84 L 62 89 M 67 84 L 67 89",
    oval(61, 37, 5, 7),
    oval(63, 38, 2, 3),
    "M 55 26 C 59 23 64 24 67 27 M 58 54 C 62 58 67 57 70 54",
    "M 57 48 C 58 54 61 55 64 54 L 61 48",
    "M 77 54 L 81 55 M 78 59 L 83 60 M 79 64 L 83 65",
    "M 20 67 C 10 65 8 75 12 78 M 9 77 L 14 80",
    "M 45 17 C 43 10 48 6 52 10 M 52 14 C 52 8 58 7 59 12",
  ],
  lion: [
    "M 50 8 C 56 3 63 7 65 13 C 72 9 79 13 79 20 C 87 20 92 26 88 33 C 96 38 96 46 90 50 C 96 57 92 65 84 65 C 87 73 81 80 74 77 C 72 86 63 89 58 82 C 53 91 45 91 40 83 C 32 89 24 84 24 77 C 15 80 9 73 13 65 C 4 62 4 53 11 49 C 4 43 6 35 13 32 C 9 24 15 18 22 20 C 22 12 30 9 36 14 C 39 7 45 5 50 8 Z",
    "M 24 38 C 19 30 25 24 31 29 M 69 29 C 75 24 81 30 76 38",
    "M 27 39 C 27 25 72 25 73 39 C 80 53 72 70 50 72 C 28 70 20 53 27 39 Z",
    oval(38, 43, 4, 6),
    oval(62, 43, 4, 6),
    "M 44 51 C 46 47 54 47 56 51 L 50 57 Z",
    "M 50 57 L 50 61 C 43 67 36 63 37 58 M 50 61 C 57 67 64 63 63 58",
    "M 36 52 L 27 49 M 35 57 L 25 58 M 64 52 L 73 49 M 65 57 L 75 58",
    "M 32 82 C 25 85 28 94 37 94 L 46 94 L 46 84 M 68 82 C 75 85 72 94 63 94 L 54 94 L 54 84",
    "M 35 89 L 35 94 M 40 89 L 40 94 M 60 89 L 60 94 M 65 89 L 65 94",
  ],
  rabbit: [
    "M 33 39 C 21 20 22 5 29 4 C 36 3 39 22 42 34 M 58 34 C 61 22 64 3 71 4 C 78 5 79 20 67 39",
    "M 34 29 C 29 18 28 12 30 11 C 33 12 35 21 37 29 M 63 29 C 65 21 67 12 70 11 C 72 12 71 18 66 29",
    "M 26 49 C 27 37 37 32 50 33 C 63 32 73 37 74 49 C 83 60 70 72 50 72 C 30 72 17 60 26 49 Z",
    oval(37, 49, 3.5, 5.5),
    oval(63, 49, 3.5, 5.5),
    "M 45 57 C 47 54 53 54 55 57 L 50 62 Z",
    "M 50 62 C 46 68 41 65 41 63 M 50 62 C 54 68 59 65 59 63",
    "M 46 65 L 46 70 L 54 70 L 54 65 M 50 66 L 50 70",
    "M 30 59 L 16 55 M 30 64 L 15 66 M 70 59 L 84 55 M 70 64 L 85 66",
    "M 34 72 C 24 79 27 88 34 89 M 66 72 C 76 79 73 88 66 89",
    "M 35 83 C 22 84 22 95 35 95 L 45 95 L 45 79 M 65 83 C 78 84 78 95 65 95 L 55 95 L 55 79",
    "M 32 91 L 32 95 M 38 91 L 38 95 M 62 91 L 62 95 M 68 91 L 68 95",
    "M 28 80 C 16 74 13 89 25 90",
  ],
  dinosaur: [
    "M 30 64 C 20 68 11 62 7 55 C 5 72 18 81 30 78 C 33 88 41 92 48 87 L 48 78 C 53 79 59 77 63 73 L 67 84 C 71 90 82 88 81 83 L 75 66 C 80 61 80 55 77 50 C 90 52 97 48 97 40 C 97 30 88 23 77 25 C 67 24 62 31 63 40 C 53 40 39 47 34 55 L 30 64 Z",
    "M 35 54 L 31 45 L 42 45 M 45 44 L 45 34 L 56 39 M 60 37 L 63 28 L 68 32",
    oval(80, 35, 4, 6),
    oval(81, 36, 1.5, 2.5),
    "M 74 27 C 78 24 82 25 85 27 M 89 40 C 92 40 94 42 95 44",
    "M 81 46 C 87 50 92 47 93 44",
    "M 57 54 C 64 51 68 57 65 61 C 63 65 58 64 56 62 M 60 56 L 62 59",
    "M 43 61 C 39 66 40 73 44 75",
    "M 39 84 L 39 88 M 44 84 L 44 88 M 71 83 L 72 88 M 76 82 L 77 87",
    oval(35, 65, 2, 3),
    oval(43, 55, 2, 2.5),
    oval(51, 48, 2, 2),
  ],
});

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
