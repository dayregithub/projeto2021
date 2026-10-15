import { zipSync, strToU8 } from "fflate";

export function deliveryZip(files, contents) {
  const entries = Object.assign(Object.create(null), {
    "LEIA-ME-PAPELED.txt": strToU8(
      "Criação própria para produção — Papeled Maker\nWhatsApp: +55 61 99243-0051\npapeledmaker@gmail.com\n",
    ),
  });
  files.forEach((file, index) => {
    const cleaned = file.name.replace(/[\\/\x00-\x1f]/g, "_") || "arquivo";
    const safe = ["__proto__", "constructor", "prototype"].includes(cleaned)
      ? "arquivo-" + cleaned
      : cleaned;
    let name = safe,
      suffix = 2;
    while (Object.hasOwn(entries, name)) name = `${suffix++}-${safe}`;
    entries[name] = contents[index];
  });
  return new File(
    [zipSync(entries, { level: 0 })],
    "minha-criacao-papeled.zip",
    { type: "application/zip" },
  );
}
function base64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
const folded = (bytes) =>
  base64(bytes)
    .match(/.{1,76}/g)
    ?.join("\r\n") || "";
export function deliveryEmail(files, contents, { name, text }) {
  const boundary = "papeled-" + crypto.randomUUID(),
    subject = base64(
      new TextEncoder().encode(name || "Minha criação — Papeled Maker"),
    );
  const lines = [
    "To: papeledmaker@gmail.com",
    `Subject: =?UTF-8?B?${subject}?=`,
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    folded(new TextEncoder().encode(text)),
  ];
  files.forEach((file, i) => {
    const safe = file.name.replace(/[\x00-\x1f"\\/]/g, "_");
    const ascii = safe.replace(/[^\x20-\x7e]/g, "_");
    lines.push(
      `--${boundary}`,
      "Content-Type: application/octet-stream",
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${ascii}";`,
      ` filename*=UTF-8''${encodeURIComponent(safe).replace(/'/g, "%27")}`,
      "",
      folded(contents[i]),
    );
  });
  lines.push(`--${boundary}--`, "");
  return new File([lines.join("\r\n")], "criacao-papeled.eml", {
    type: "message/rfc822",
  });
}
export function downloadDelivery(file) {
  const url = URL.createObjectURL(file),
    link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
