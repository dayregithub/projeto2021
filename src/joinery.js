import clipping from "polygon-clipping";
export const JOINT_GROUPS = {
  inherit: "Igual à união principal",
  straight: "Reta",
  finger: "Dedo",
  tslot: "T",
};
export const resolvedJoint = (s, key) =>
  s[key] === "inherit" || !s[key] ? s.joint : s[key];
const contacts = new WeakMap();
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
export const rectangle = (x, y, w, h) => [
  [
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y],
    ],
  ],
];
export const disk = (x, y, r, n = 48) => [
  [
    Array.from({ length: n + 1 }, (_, i) => [
      x + r * Math.cos((i * 2 * Math.PI) / n),
      y + r * Math.sin((i * 2 * Math.PI) / n),
    ]),
  ],
];
export function reshape(p, shape) {
  if (!shape.length)
    throw Error(`A união removeu toda a peça ${p.name}. Aumente suas medidas.`);
  const pts = shape.flat(2),
    x = Math.min(...pts.map((p) => p[0])),
    y = Math.min(...pts.map((p) => p[1])),
    w = Math.max(...pts.map((p) => p[0])) - x,
    h = Math.max(...pts.map((p) => p[1])) - y;
  const old = p.pose;
  p.shape = shape.map((poly) =>
    poly.map((ring) => {
      const a = ring.map((v) => [v[0] - x, v[1] - y]);
      if (
        a.length > 1 &&
        Math.hypot(a[0][0] - a.at(-1)[0], a[0][1] - a.at(-1)[1]) < 1e-8
      )
        a.pop();
      return a;
    }),
  );
  p.width = w;
  p.height = h;
  p.pose = {
    ...old,
    origin: old.origin.map((v, i) => v + old.u[i] * x + old.v[i] * y),
  };
  if (p.coverArea) {
    p.coverArea.x -= x;
    p.coverArea.y -= y;
  }
  return p;
}
export function makePanel(name, w, h, pose, extra = {}) {
  return {
    name,
    width: w,
    height: h,
    slots: [],
    shape: rectangle(0, 0, w, h).map((poly) => poly.map((r) => r.slice(0, -1))),
    pose,
    ...extra,
  };
}
const uv = (p, v) => {
  const d = v.map((v, i) => v - p.pose.origin[i]);
  return [dot(d, p.pose.u), dot(d, p.pose.v)];
};
const polyFromWorld = (p, points) => [[points.map((v) => uv(p, v))]];
const snapped = (shape) =>
  shape.map((poly) =>
    poly.map((ring) =>
      ring.map((v) => v.map((n) => Math.round(n * 1e7) / 1e7)),
    ),
  );
const change = (p, operation, shape) =>
  reshape(p, clipping[operation](snapped(p.shape), snapped(shape)));
// The contact line lies at the receiving face and in the mid-plane of the
// male panel. depth points from the male edge into the receiving material.
export function joinContact(receiver, male, start, end, depth, joint, s) {
  if (joint === "straight" || joint === "cross") return;
  const t = s.thickness,
    delta = end.map((v, i) => v - start[i]),
    length = Math.hypot(...delta);
  if (length < 1e-6) return;
  const q = delta.map((v) => v / length),
    margin = Math.min(2 * t, length * 0.1),
    a = add(start, q, margin),
    L = length - 2 * margin;
  const project = (v) =>
      v.map(
        (n, i) => n - receiver.pose.normal[i] * dot(v, receiver.pose.normal),
      ),
    midpoint = project(add(start, delta, 0.5)),
    previous = (contacts.get(receiver) || []).find(
      (c) =>
        Math.hypot(...c.mid.map((v, i) => v - midpoint[i])) < 1e-5 &&
        Math.abs(c.length - length) < 1e-5 &&
        dot(c.depth, depth) < -0.99,
    );
  const phase = previous ? 1 : 0;
  const history = contacts.get(receiver) || [];
  contacts.set(receiver, history);
  const record = { mid: midpoint, length, depth: [...depth] };
  history.push(record);
  const at = (u) => add(a, q, u),
    maleQuad = (lo, hi, v0, v1) =>
      polyFromWorld(male, [
        add(at(lo), depth, v0),
        add(at(hi), depth, v0),
        add(at(hi), depth, v1),
        add(at(lo), depth, v1),
      ]);
  const slot = (lo, hi) =>
    polyFromWorld(receiver, [
      add(at(lo), male.pose.normal, -t / 2),
      add(at(hi), male.pose.normal, -t / 2),
      add(at(hi), male.pose.normal, t / 2),
      add(at(lo), male.pose.normal, t / 2),
    ]);
  if (joint === "finger") {
    let count = Math.max(3, Math.round(L / s.fingerSize));
    if (count % 2 === 0) count++;
    for (let i = phase ? 2 : 1; i < count; i += 2) {
      const lo = (L * i) / count,
        hi = (L * (i + 1)) / count;
      change(male, "union", maleQuad(lo, hi, 0, t));
      change(receiver, "difference", slot(lo, hi));
    }
  } else if (joint === "tslot") {
    const tab = Math.min(2 * t, L * 0.14);
    if (previous?.trim) previous.trim();
    record.trim = () => {
      for (const f of [0.15, 0.85])
        change(
          male,
          "difference",
          maleQuad(L * f - tab / 2, L * f + tab / 2, t / 2, t),
        );
    };
    for (const fraction of [0.15, 0.85]) {
      const center = L * fraction;
      change(
        male,
        "union",
        maleQuad(center - tab / 2, center + tab / 2, 0, phase ? t / 2 : t),
      );
      change(receiver, "difference", slot(center - tab / 2, center + tab / 2));
    }
    const mid = L * (phase ? 0.65 : 0.35);
    change(male, "difference", maleQuad(mid - 1.6, mid + 1.6, -14.4, 0));
    change(male, "difference", maleQuad(mid - 2.9, mid + 2.9, -12, -9.6));
    const center = uv(receiver, at(mid));
    const hole = disk(...center, 1.6);
    if (!clipping.difference(hole, receiver.shape).length) {
      change(receiver, "difference", hole);
    } else {
      change(receiver, "union", disk(...center, Math.max(5.5, t * 1.5)));
      change(receiver, "difference", disk(...uv(receiver, at(mid)), 1.6));
    }
    receiver.m3Fasteners = (receiver.m3Fasteners || 0) + 1;
  }
}
export function rectanglePose(
  x,
  y,
  z,
  u = [1, 0, 0],
  v = [0, 1, 0],
  normal = [0, 0, 1],
) {
  return { origin: [x, y, z], u, v, normal };
}
export function shellContacts(
  parts,
  { x = 0, y = 0, z = 0, w, d, h, t, top = false, front = true },
  joint,
  s,
) {
  const by = (role) => parts.find((p) => p.role === role),
    base = by("base"),
    cap = by("top"),
    back = by("back"),
    face = by("front"),
    left = by("left") || parts.filter((p) => p.role === "side")[0],
    right = by("right") || parts.filter((p) => p.role === "side")[1];
  if (base) {
    if (back)
      joinContact(
        base,
        back,
        [x, y + t / 2, z + t],
        [x + w, y + t / 2, z + t],
        [0, 0, -1],
        joint,
        s,
      );
    if (face && front)
      joinContact(
        base,
        face,
        [x, y + d - t / 2, z + t],
        [x + w, y + d - t / 2, z + t],
        [0, 0, -1],
        joint,
        s,
      );
    for (const [wall, cx] of [
      [left, x + t / 2],
      [right, x + w - t / 2],
    ])
      if (wall)
        joinContact(
          base,
          wall,
          [cx, y + t, z + t],
          [cx, y + d - t, z + t],
          [0, 0, -1],
          joint,
          s,
        );
  }
  if (cap && top) {
    if (back)
      joinContact(
        cap,
        back,
        [x, y + t / 2, z + h - t],
        [x + w, y + t / 2, z + h - t],
        [0, 0, 1],
        joint,
        s,
      );
    for (const [wall, cx] of [
      [left, x + t / 2],
      [right, x + w - t / 2],
    ])
      if (wall)
        joinContact(
          cap,
          wall,
          [cx, y + t, z + h - t],
          [cx, y + d - t, z + h - t],
          [0, 0, 1],
          joint,
          s,
        );
  }
  for (const [wall, cx] of [
    [left, x + t / 2],
    [right, x + w - t / 2],
  ])
    if (wall) {
      if (back)
        joinContact(
          back,
          wall,
          [cx, y + t, z + t],
          [cx, y + t, z + h - (top ? t : 0)],
          [0, -1, 0],
          joint,
          s,
        );
      if (face && front)
        joinContact(
          face,
          wall,
          [cx, y + d - t, z + t],
          [cx, y + d - t, z + h],
          [0, 1, 0],
          joint,
          s,
        );
    }
}
