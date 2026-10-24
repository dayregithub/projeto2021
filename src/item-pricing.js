// Item adjustments never mutate the quote-wide pricing snapshot.
export function laserMinuteReference(item, pricing) {
  return item.primaryService
    ? item.primaryService.price / (item.primaryService.unit === "hora" ? 60 : 1)
    : pricing.laserSaleHour / 60;
}
export function applyItemDiscount(item, { money, number }) {
  const type = item.discountType ?? "amount";
  if (!["amount", "percent"].includes(type))
    throw Error("Tipo de desconto do item inválido.");
  const value = number(item.discount ?? 0, "Desconto do item", {
    max: type === "percent" ? 100 : 1e9,
  });
  const gross = item.subtotal;
  const discount = money(type === "percent" ? (gross * value) / 100 : value);
  if (discount > gross)
    throw Error("O desconto do item não pode superar seu total.");
  const subtotal = money(gross - discount);
  let cumulative = 0,
    allocated = 0;
  const invoiceRows =
    discount && item.invoiceRows
      ? item.invoiceRows.map((row) => {
          cumulative += row.subtotal;
          const through = money(gross ? (discount * cumulative) / gross : 0);
          const net = money(row.subtotal - (through - allocated));
          allocated = through;
          return {
            ...row,
            subtotalBeforeDiscount: row.subtotal,
            unitPriceBeforeDiscount: row.unitPrice,
            subtotal: net,
            unitPrice: row.quantity ? net / row.quantity : 0,
          };
        })
      : item.invoiceRows;
  return {
    ...item,
    subtotalBeforeDiscount: gross,
    itemDiscountAmount: discount,
    subtotal,
    unitPriceBeforeDiscount: item.unitPrice,
    unitPrice: discount ? subtotal / item.quantity : item.unitPrice,
    ...(item.pricePerGram != null && item.totalGrams
      ? { pricePerGram: subtotal / item.totalGrams }
      : {}),
    ...(invoiceRows ? { invoiceRows } : {}),
  };
}
export function groupedProposalItem(item, { brl }) {
  const lines = [];
  if (item.invoiceRows) {
    const hasMaterial =
      item.materialAmount > 0 || item.materialMode === "included";
    lines.push(hasMaterial ? "Serviço + Material" : "Serviço");
    const serviceName =
      item.primaryService?.name ||
      (item.process === "laser" ? "Corte / gravação a laser" : "Impressão 3D");
    lines.push(
      `Serviço: ${serviceName} — ${brl(item.serviceAmount)}${item.ratePerMinute != null ? ` (${brl(item.ratePerMinute)}/min)` : ""}`,
    );
    if (hasMaterial) {
      const material = item.invoiceRows[1];
      lines.push(
        `Material: ${item.materialName} — ${material.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${material.unit}; ${brl(item.materialAmount)}`,
      );
    }
    const start = hasMaterial ? 2 : 1;
    for (const extra of item.invoiceRows.slice(start))
      lines.push(
        `Adicional: ${extra.description} — ${extra.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${extra.unit}; ${brl(extra.subtotalBeforeDiscount ?? extra.subtotal)}`,
      );
  }
  if (item.itemDiscountAmount)
    lines.push(
      `Desconto deste item: -${brl(item.itemDiscountAmount)}${item.discountType === "percent" ? ` (${item.discount.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)` : ""}`,
    );
  return { ...item, compositionLines: lines };
}

// Both the editor and proposal use the calculated amounts, never the raw
// percentage inputs, so mixed R$/percentage discounts reconcile to the cent.
export function estimateDiscountBreakdown(result) {
  return result.items.map((item, index) => ({
    label: `Item ${index + 1} — ${item.description || "Sem descrição"}`,
    amount: item.itemDiscountAmount,
    percentage: item.discountType === "percent" ? item.discount : null,
  }));
}
