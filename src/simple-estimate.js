export function durationLabel(minutes) {
  const seconds = Math.round(minutes * 60);
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
// New quotes separate time, material and additional services. Old snapshots keep their original rules.
export function calculateSimpleItem(
  item,
  p,
  laser,
  { money, number, validateMaterial, materialFor, validateService },
) {
  const qty = item.quantity,
    minutes = item.minutes * qty,
    hours = item.hours * qty;
  const markup =
    item.process === "laser"
      ? (p.laserMaterialMarkup ?? p.markupPercent)
      : (p.printMarkup ?? p.markupPercent);
  const factor = 1 + markup / 100;
  const selected = validateMaterial(materialFor(item, p), item.process);
  const materialMode = item.materialMode ?? "none";
  if (!["none", "included", "provided"].includes(materialMode))
    throw Error("Escolha com material, sem material ou material do cliente.");
  const chargeMaterial = materialMode === "included";
  const materialQty = chargeMaterial
    ? number(item.materialQuantity ?? 0, "Quantidade total de material", {
        max: 1000000,
      })
    : 0;
  if (chargeMaterial && materialQty <= 0)
    throw Error("Informe a quantidade de material.");
  const materialScale = item.process === "print" ? 1 / 1000 : 1;
  const costMaterial = chargeMaterial
    ? materialQty * materialScale * selected.price
    : 0;
  const saleMaterial = chargeMaterial
    ? materialQty *
      materialScale *
      (selected.salePrice ?? selected.price * factor)
    : 0;
  let rate = p.laserSaleHour / 60,
    costRate = laser.hour / 60,
    name =
      item.process === "laser" ? "Corte / gravação a laser" : "Impressão 3D";
  if (item.primaryService) {
    validateService(item.primaryService);
    if (
      !["hora", "minuto"].includes(item.primaryService.unit) ||
      item.process !== "laser"
    )
      throw Error("O serviço principal laser deve usar hora ou minuto.");
    const divisor = item.primaryService.unit === "hora" ? 60 : 1;
    rate = item.primaryService.price / divisor;
    costRate = item.primaryService.cost / divisor;
    name = item.primaryService.name;
  }
  const machine =
    item.process === "laser"
      ? minutes * costRate
      : hours *
        (p.printerInvestment / p.printerLifeHours + p.printMaintenanceHour);
  const energy =
    item.process === "print"
      ? ((hours * p.printerWatts) / 1000) * p.printEnergy
      : 0;
  const serviceAmount = money(
    item.process === "laser" ? minutes * rate : (machine + energy) * factor,
  );
  const materialAmount = money(saleMaterial);
  const services = item.services || [];
  if (!Array.isArray(services) || services.length > 30)
    throw Error("Inclua no máximo 30 serviços adicionais.");
  let extraCost = 0;
  const extraRows = services.map((service) => {
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
      technical: `Quantidade própria em ${service.unit}, sem multiplicação pela quantidade das peças.`,
      unit: service.unit,
      process: item.process,
    };
  });
  const additionalAmount = money(
    extraRows.reduce((sum, row) => sum + row.subtotal, 0),
  );
  const subtotal = money(serviceAmount + materialAmount + additionalAmount);
  const totalCost = machine + energy + costMaterial + extraCost;
  const rows = [
    {
      description: `${item.description} · ${name}`,
      quantity: item.process === "laser" ? minutes : qty,
      unitPrice:
        item.process === "laser" ? rate : qty ? serviceAmount / qty : 0,
      subtotal: serviceAmount,
      technical:
        item.process === "laser"
          ? `${item.minutes} min × ${qty} peça(s) = ${minutes} min (${durationLabel(minutes)})`
          : `${hours} horas totais de impressão`,
      unit: item.process === "laser" ? "min" : "un.",
      process: item.process,
      preciseUnitPrice: item.process === "laser",
    },
  ];
  if (chargeMaterial)
    rows.push({
      description: selected.name,
      quantity: materialQty,
      unitPrice:
        (selected.salePrice ?? selected.price * factor) * materialScale,
      subtotal: materialAmount,
      technical: `Material · ${item.process === "print" ? "g" : selected.unit || "chapa"}${selected.specification ? " · " + selected.specification : ""}`,
      process: item.process,
      unit: item.process === "print" ? "g" : selected.unit || "chapa",
      preciseUnitPrice: item.process === "print",
    });
  rows.push(...extraRows);
  return {
    ...item,
    unitPrice: qty ? subtotal / qty : 0,
    suggested: qty ? subtotal / qty : 0,
    subtotal,
    totalCost,
    unitCost: totalCost / qty,
    materialName: selected.name,
    serviceAmount,
    materialAmount,
    additionalAmount,
    totalMinutes: minutes,
    ratePerMinute: item.process === "laser" ? rate : null,
    invoiceRows: rows,
    costs: {
      material: costMaterial,
      machine,
      energy,
      handling: 0,
      painting: 0,
      extras: extraCost,
    },
    technical: rows.map((row) => row.technical).join(" · "),
  };
}
