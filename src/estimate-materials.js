export const MATERIAL_NAMES = {
  laser: [
    "MDF",
    "MDF 3 mm",
    "MDF 6 mm",
    "MDF 9 mm",
    "MDF 12 mm",
    "Compensado",
    "Acrílico",
    "Madeira maciça",
    "Papel / papelão",
    "Outro",
  ],
  print: ["PLA", "PETG", "ABS", "ASA", "TPU", "Resina", "Outro"],
};
export function materialFor(item, pricing) {
  if (item.material) return item.material;
  return item.process === "laser"
    ? {
        name: "MDF",
        price: pricing.sheetPrice,
        width: pricing.sheetWidth,
        length: pricing.sheetLength,
      }
    : { name: "PLA", price: pricing.filamentKg };
}
export function validateMaterial(m, process) {
  if (
    !m ||
    typeof m.name !== "string" ||
    !m.name.trim() ||
    m.name.length > 100 ||
    typeof m.price !== "number" ||
    !Number.isFinite(m.price) ||
    m.price < 0 ||
    m.price > 1e7
  )
    throw Error("Material: informe o nome e o preço de compra.");
  if (
    process === "laser" &&
    (!m.unit || m.unit === "chapa") &&
    (!Number.isFinite(m.width) ||
      !Number.isFinite(m.length) ||
      m.width <= 0 ||
      m.length <= 0 ||
      m.width > 10000 ||
      m.length > 10000)
  )
    throw Error(
      "Material laser: informe largura e comprimento da chapa em cm.",
    );
  if (
    m.salePrice !== undefined &&
    m.salePrice !== null &&
    (typeof m.salePrice !== "number" ||
      !Number.isFinite(m.salePrice) ||
      m.salePrice < 0 ||
      m.salePrice > 1e7)
  )
    throw Error("Preço de venda do material inválido.");
  if (m.unit && !["chapa", "unidade", "m²", "kg"].includes(m.unit))
    throw Error("Unidade do material inválida.");
  return m;
}
