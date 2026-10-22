import { validateMaterial } from "./estimate-materials.js";
const KEY = "papeled-estimate-profile-v1";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function validateService(s) {
  if (
    !s ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    s.name.length > 100 ||
    !["unidade", "hora", "minuto"].includes(s.unit) ||
    !["service", "resource"].includes(s.type)
  )
    throw Error("Serviço/recurso: nome, tipo ou unidade inválidos.");
  for (const key of ["price", "cost"])
    if (!Number.isFinite(s[key]) || s[key] < 0 || s[key] > 1e7)
      throw Error(
        "Informe preço e custo não negativos para o serviço/recurso.",
      );
  return s;
}
export function initResourceCatalog({ getState, onSaved }) {
  const $ = (id) => document.getElementById(id),
    form = $("resource-form");
  let profile = {},
    recordId = null;
  const message = (text) => ($("resource-status").textContent = text);
  function fields() {
    const material = form.elements.kind.value === "material",
      laser = form.elements.process.value === "laser";
    if (!laser) form.elements.materialUnit.value = "kg";
    form.elements.materialUnit.disabled = !laser;
    form.querySelector("[data-material-fields]").hidden = !material;
    form.querySelector("[data-service-fields]").hidden = material;
    form.querySelector("[data-sheet-fields]").hidden = !material || !laser;
    form.querySelector("[data-material-price-label]").textContent = !material
      ? "Preço de venda por unidade (R$)"
      : laser
        ? "Custo de compra por unidade (R$)"
        : "Custo de compra por kg (R$)";
  }
  form.elements.materialUnit.onchange = () => {
    for (const key of ["width", "length"])
      form.elements.namedItem(key).closest("label").hidden =
        form.elements.materialUnit.value !== "chapa";
  };
  form.elements.kind.onchange = fields;
  form.elements.process.onchange = fields;
  fields();
  function reset() {
    recordId = null;
    form.reset();
    fields();
  }
  $("resource-new").onclick = () => {
    reset();
    if ($("resource-process-filter").value !== "all") {
      form.elements.process.value = $("resource-process-filter").value;
      fields();
    }
  };
  $("resource-process-filter").onchange = render;
  async function refresh() {
    try {
      profile = JSON.parse(localStorage.getItem(KEY) || "{}");
      const { client, local } = getState();
      if (client && !local) {
        const r = await client
          .from("pricing_profiles")
          .select("data")
          .eq("id", "default")
          .maybeSingle();
        if (r.error) throw r.error;
        if (r.data) profile = r.data.data;
        message("Cadastro conectado ao Supabase.");
      } else message("Prévia local: cadastros somente neste navegador.");
      render();
    } catch {
      message(
        "Cadastro local disponível. Para salvar no banco, execute database-update.sql no Supabase.",
      );
      render();
    }
  }
  function render() {
    const process = $("resource-process-filter").value;
    $("resource-list").innerHTML =
      [
        ...(profile.materials || []).map((entry, i) =>
          process !== "all" && entry.process !== process
            ? ""
            : `<article class="card"><h3>${esc(entry.material.name)}</h3><p>${entry.process === "laser" ? "Laser · " + (entry.material.unit || "chapa") : "3D · kg"} · Custo R$ ${entry.material.price.toFixed(2)}${entry.material.salePrice != null ? " · Venda R$ " + entry.material.salePrice.toFixed(2) : " · Venda conforme acréscimo"}${entry.material.thickness ? " · " + entry.material.thickness + " mm" : ""}${entry.material.specification ? " · " + esc(entry.material.specification) : ""}</p><button type="button" data-material-edit="${i}">Editar material</button></article>`,
        ),
        ...(profile.services || []).map(
          (s, i) =>
            `<article class="card"><h3>${esc(s.name)}</h3><p>${s.type === "resource" ? "Recurso" : "Serviço"} · R$ ${s.price.toFixed(2)} / ${s.unit}</p><button type="button" data-service-edit="${i}">Editar serviço/recurso</button></article>`,
        ),
      ].join("") ||
      "<p>Nenhum cadastro. Cadastre materiais e serviços abaixo.</p>";
    $("resource-list")
      .querySelectorAll("[data-material-edit]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const e = profile.materials[Number(b.dataset.materialEdit)],
              m = e.material;
            reset();
            recordId = {
              kind: "material",
              index: Number(b.dataset.materialEdit),
            };
            form.elements.kind.value = "material";
            form.elements.process.value = e.process;
            for (const k of [
              "name",
              "price",
              "width",
              "length",
              "thickness",
              "specification",
              "salePrice",
              "materialUnit",
            ])
              form.elements.namedItem(k).value =
                k === "materialUnit" ? m.unit || "chapa" : (m[k] ?? "");
            fields();
          }),
      );
    $("resource-list")
      .querySelectorAll("[data-service-edit]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const s = profile.services[Number(b.dataset.serviceEdit)];
            reset();
            recordId = {
              kind: "service",
              index: Number(b.dataset.serviceEdit),
            };
            form.elements.kind.value = s.type;
            for (const k of ["name", "price", "cost", "unit"])
              form.elements[k].value = s[k];
            fields();
          }),
      );
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const { client, local } = getState();
      let next = structuredClone(profile);
      if (client && !local) {
        const r = await client
          .from("pricing_profiles")
          .select("data")
          .eq("id", "default")
          .maybeSingle();
        if (r.error)
          throw Error(
            "Instale database-update.sql antes de cadastrar na nuvem.",
          );
        next = r.data?.data || next;
      }
      const f = form.elements,
        name = f.name.value.trim(),
        kind = f.kind.value;
      if (kind === "material") {
        const material = {
          name,
          salePrice:
            f.salePrice.value === "" ? null : Number(f.salePrice.value),
          unit: f.process.value === "print" ? "kg" : f.materialUnit.value,
          price: Number(f.price.value),
          width: Number(f.width.value),
          length: Number(f.namedItem("length").value),
          thickness:
            f.process.value === "laser" ? Number(f.thickness.value) : 0,
          specification: f.specification.value.trim(),
        };
        validateMaterial(material, f.process.value);
        if (
          !Number.isFinite(material.thickness) ||
          material.thickness < 0 ||
          material.thickness > 1000 ||
          material.specification.length > 1000
        )
          throw Error("Confira espessura e especificação.");
        const entry = {
          id: crypto.randomUUID(),
          process: f.process.value,
          material,
        };
        next.materials ||= [];
        const i =
          recordId?.kind === "material"
            ? next.materials.findIndex(
                (x) =>
                  x.process === profile.materials[recordId.index].process &&
                  x.material.name ===
                    profile.materials[recordId.index].material.name,
              )
            : -1;
        if (
          next.materials.some(
            (x, j) =>
              j !== i &&
              x.process === entry.process &&
              x.material.name === name,
          )
        )
          throw Error("Já existe material com esse nome neste processo.");
        if (i >= 0) {
          entry.id = next.materials[i].id || entry.id;
          next.materials[i] = entry;
        } else next.materials.push(entry);
      } else {
        const service = validateService({
          id: crypto.randomUUID(),
          name,
          type: kind,
          price: Number(f.price.value),
          cost: Number(f.cost.value),
          unit: f.unit.value,
        });
        next.services ||= [];
        const old =
          recordId?.kind === "service"
            ? profile.services[recordId.index]
            : null;
        const i = old ? next.services.findIndex((s) => s.id === old.id) : -1;
        if (next.services.some((s, j) => j !== i && s.name === name))
          throw Error("Já existe serviço/recurso com esse nome.");
        if (i >= 0) {
          service.id = next.services[i].id;
          next.services[i] = service;
        } else next.services.push(service);
      }
      if ((next.materials?.length || 0) + (next.services?.length || 0) > 200)
        throw Error("Limite de 200 cadastros.");
      if (client && !local) {
        const r = await client.from("pricing_profiles").upsert({
          id: "default",
          data: next,
          updated_at: new Date().toISOString(),
        });
        if (r.error)
          throw Error(
            "Não foi possível salvar no banco. Seus campos foram preservados para tentar novamente.",
          );
      }
      localStorage.setItem(KEY, JSON.stringify(next));
      profile = next;
      reset();
      render();
      await onSaved();
      message(
        client && !local
          ? "Cadastro salvo no Supabase. Orçamentos anteriores mantêm seus valores."
          : "Cadastro salvo neste navegador (prévia local).",
      );
    } catch (error) {
      message(error.message);
    } finally {
      button.disabled = false;
    }
  };
  return {
    refresh,
    setProcess: (process) => {
      $("resource-process-filter").value = process;
      if (process !== "all") {
        reset();
        form.elements.process.value = process;
        fields();
      }
      render();
    },
  };
}
