export function customerContacts(q) {
  const legacy = q.contact || "";
  const email =
    q.customerEmail ||
    legacy.match(/[^\s<>|;,]+@[^\s<>|;,]+\.[^\s<>|;,]+/)?.[0] ||
    "";
  const phoneText = legacy.replace(email, "");
  const phone =
    q.customerPhone ||
    phoneText.match(/(?:\+|\()?\d[\d\s().-]{7,}\d/)?.[0]?.trim() ||
    "";
  return { phone, email };
}
