// Spreadsheet model: filament + energy + configured operating/project costs, then markup or margin.
export function calculatePrintItem(
  item,
  p,
  printer,
  { money, number, validateMaterial, materialFor, validateService },
) {
  const qty = item.quantity,
    scale = item.printInputMode === "piece" ? qty : 1;
  const grams =
    number(item.grams, "Peso de impressão (g)", { min: 0.001, max: 1000000 }) *
    scale;
  const hours =
    number(item.hours, "Duração da impressão (horas)", {
      min: 0.0001,
      max: 1000000,
    }) * scale;
  const selected = validateMaterial(materialFor(item, p), "print");
  const mode = item.materialMode || "included";
  if (!["included", "provided", "none"].includes(mode))
    throw Error("Selecione quem fornece o filamento.");
  if (mode === "included" && selected.price <= 0)
    throw Error("Informe o preço de compra do filamento por kg.");
  const usedGrams = grams * (1 + item.lossPercent / 100);
  const material =
    mode === "included" ? (usedGrams / 1000) * selected.price : 0;
  const energy = hours * printer.energy,
    machine = hours * printer.machine;
  const handling = ((item.handlingMinutes * scale) / 60) * p.laborHour,
    painting = item.paintingCost * scale,
    extras = item.extras * scale;
  const baseCost = material + energy + machine + handling + painting + extras;
  const method = p.printPricingMethod || "markup";
  if (!["markup", "margin"].includes(method))
    throw Error("Método de preço 3D inválido.");
  const markup = number(p.printMarkup ?? p.markupPercent, "Acréscimo 3D (%)", {
    max: 10000,
  });
  const margin = number(
    p.printMarginPercent ?? p.marginPercent,
    "Margem 3D (%)",
    { max: 99.99 },
  );
  if (method === "margin" && margin + p.taxPercent >= 100)
    throw Error("Margem 3D + impostos devem ser menores que 100%.");
  const factor =
    method === "margin"
      ? 1 / (1 - (margin + p.taxPercent) / 100)
      : 1 + markup / 100;
  const suggested = money(baseCost * factor);
  const materialAmount = money(material * factor),
    serviceAmount = money(suggested - materialAmount);
  if (!Array.isArray(item.services || []) || (item.services || []).length > 30)
    throw Error("Inclua no máximo 30 serviços adicionais.");
  let extraCost = 0;
  const extraRows = (item.services || []).map((service) => {
    validateService(service);
    number(service.quantity, "Quantidade do serviço adicional", {
      max: 100000,
    });
    extraCost += service.cost * service.quantity;
    return {
      description: service.name,
      quantity: service.quantity,
      unitPrice: service.price,
      subtotal: money(service.price * service.quantity),
      technical: "Quantidade total independente da quantidade de peças.",
      unit: service.unit,
      process: "print",
    };
  });
  const additionalAmount = money(
    extraRows.reduce((sum, row) => sum + row.subtotal, 0),
  );
  const subtotal = money(suggested + additionalAmount),
    totalCost = baseCost + extraCost;
  const invoiceRows = [
    {
      description: `${item.description} · Impressão 3D`,
      quantity: qty,
      unitPrice: serviceAmount / qty,
      subtotal: serviceAmount,
      technical: `${grams.toLocaleString("pt-BR")} g e ${hours.toLocaleString("pt-BR")} horas no lote de ${qty} peça(s).`,
      unit: "un.",
      process: "print",
      preciseUnitPrice: true,
    },
  ];
  if (mode === "included")
    invoiceRows.push({
      description: `Filamento ${selected.name}`,
      quantity: usedGrams,
      unitPrice: materialAmount / usedGrams,
      subtotal: materialAmount,
      technical: selected.specification || "Filamento para impressão 3D",
      unit: "g",
      process: "print",
      preciseUnitPrice: true,
    });
  invoiceRows.push(...extraRows);
  return {
    ...item,
    unitPrice: subtotal / qty,
    suggested: suggested / qty,
    subtotal,
    totalCost,
    unitCost: totalCost / qty,
    materialName: selected.name,
    serviceAmount,
    materialAmount,
    additionalAmount,
    totalMinutes: hours * 60,
    totalHours: hours,
    totalGrams: grams,
    usedGrams,
    pricePerGram: subtotal / grams,
    baseCost,
    invoiceRows,
    costs: {
      material,
      energy,
      machine,
      handling,
      painting,
      extras: extras + extraCost,
    },
    technical: invoiceRows.map((row) => row.technical).join(" · "),
  };
}
