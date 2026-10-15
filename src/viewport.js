// Camera state is local to the viewer: it never changes exported geometry.
export function createViewport({ element, getView, onRotate, onChange }) {
  const cameras = {
      "3d": { zoom: 1, x: 0.5, y: 0.5 },
      "2d": { zoom: 1, x: 0.5, y: 0.5 },
    },
    pointers = new Map();
  let drag = null,
    pinch = null;
  const current = () => cameras[getView()],
    svg = () => element.querySelector("svg");
  function base() {
    const node = svg();
    if (!node) return null;
    if (!node.dataset.baseViewbox)
      node.dataset.baseViewbox = node.getAttribute("viewBox");
    return node.dataset.baseViewbox.split(/\s+/).map(Number);
  }
  function apply() {
    const node = svg(),
      b = base();
    if (node && b) {
      const c = current(),
        w = b[2] / c.zoom,
        h = b[3] / c.zoom;
      node.setAttribute(
        "viewBox",
        `${b[0] + b[2] * c.x - w / 2} ${b[1] + b[3] * c.y - h / 2} ${w} ${h}`,
      );
    }
    onChange(current().zoom);
  }
  function reset(all = false) {
    for (const key of all ? ["2d", "3d"] : [getView()])
      Object.assign(cameras[key], { zoom: 1, x: 0.5, y: 0.5 });
    apply();
  }
  function point(x, y) {
    const matrix = svg()?.getScreenCTM();
    return matrix ? new DOMPoint(x, y).matrixTransform(matrix.inverse()) : null;
  }
  function zoomTo(value, anchor) {
    const b = base();
    if (!b) return;
    const c = current(),
      old = c.zoom,
      next = Math.max(0.5, Math.min(4, value));
    if (anchor) {
      const p = point(anchor.x, anchor.y),
        v = svg().viewBox.baseVal;
      if (p) {
        const u = (p.x - v.x) / v.width,
          vv = (p.y - v.y) / v.height;
        c.x = (p.x - b[0] + ((0.5 - u) * b[2]) / next) / b[2];
        c.y = (p.y - b[1] + ((0.5 - vv) * b[3]) / next) / b[3];
      }
    }
    c.zoom = next;
    if (next <= 1) {
      c.x = 0.5;
      c.y = 0.5;
    }
    c.x = Math.max(0, Math.min(1, c.x));
    c.y = Math.max(0, Math.min(1, c.y));
    if (old !== next) apply();
  }
  const zoomBy = (factor, anchor) => zoomTo(current().zoom * factor, anchor);
  element.addEventListener(
    "wheel",
    (e) => {
      if (!svg()) return;
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.0015), {
        x: e.clientX,
        y: e.clientY,
      });
    },
    { passive: false },
  );
  element.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !svg()) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      element.setPointerCapture(e.pointerId);
    } catch {}
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: current().zoom,
      };
      drag = null;
    } else if (pointers.size === 1) {
      drag = {
        x: e.clientX,
        y: e.clientY,
        pan: getView() === "2d" || e.shiftKey,
      };
    }
    element.classList.add("dragging");
  });
  element.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      if (pinch.distance > 0)
        zoomTo(
          (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.distance,
        );
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (drag.pan) {
      const b = base(),
        a = point(drag.x, drag.y),
        p = point(e.clientX, e.clientY);
      if (a && p && b) {
        const c = current();
        c.x = Math.max(0, Math.min(1, c.x - (p.x - a.x) / b[2]));
        c.y = Math.max(0, Math.min(1, c.y - (p.y - a.y) / b[3]));
        apply();
      }
    } else onRotate(dx * 0.5);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    drag = null;
    pinch = null;
    if (!pointers.size) element.classList.remove("dragging");
  };
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    element.addEventListener(event, release);
  element.addEventListener("keydown", (e) => {
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(1.25);
    }
    if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomBy(0.8);
    }
    if (e.key === "0" || e.key === "Home") {
      e.preventDefault();
      reset();
    }
  });
  return {
    apply,
    reset,
    zoomBy,
    get zoom() {
      return current().zoom;
    },
  };
}
