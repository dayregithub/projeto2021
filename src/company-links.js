// Company contacts are optional for older quote snapshots.
export function companyLinks(layout) {
  const rows = [];
  const read = (key) => {
    const value = layout[key] ?? "";
    if (typeof value !== "string" || value.length > 300)
      throw Error("Contato da empresa inválido.");
    return value.trim();
  };
  const instagram = read("instagram");
  if (instagram) {
    let handle = instagram.replace(/^@/, "");
    if (/^https?:\/\//i.test(instagram)) {
      const url = new URL(instagram);
      if (
        !["instagram.com", "www.instagram.com"].includes(
          url.hostname.toLowerCase(),
        )
      )
        throw Error("Informe o @ ou link do Instagram da empresa.");
      handle = url.pathname.split("/").filter(Boolean)[0] || "";
    }
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle))
      throw Error("Informe um usuário válido do Instagram.");
    rows.push({
      label: `Instagram: @${handle}`,
      url: `https://www.instagram.com/${handle}/`,
    });
  }
  const whatsapp = read("whatsapp");
  if (whatsapp) {
    const digits = whatsapp.replace(/\D/g, "");
    if (
      !/^[+\d\s().-]+$/.test(whatsapp) ||
      digits.length < 10 ||
      digits.length > 15
    )
      throw Error("Informe o WhatsApp com DDD, ou país e DDD.");
    const number = digits.length <= 11 ? "55" + digits : digits;
    rows.push({
      label: `WhatsApp: ${whatsapp}`,
      url: `https://wa.me/${number}`,
    });
  }
  for (const [key, label] of [
    ["institutionalWebsite", "Institucional"],
    ["makerWebsite", "Criação e orçamento"],
  ]) {
    const value = read(key);
    if (!value) continue;
    let url;
    try {
      url = new URL(value);
    } catch {
      throw Error(`${label}: informe um endereço completo, como https://...`);
    }
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw Error(`${label}: use um endereço HTTP ou HTTPS válido.`);
    rows.push({ label: `${label}: ${value}`, url: url.href });
  }
  return rows;
}
