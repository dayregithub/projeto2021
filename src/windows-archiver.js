const KEY = "papeled-windows-archiver-token-v1";
const BASE = "http://127.0.0.1:47831";
export function windowsArchiveEnabled() {
  return Boolean(localStorage.getItem(KEY));
}
export function disconnectWindowsArchive() {
  localStorage.removeItem(KEY);
}
async function request(
  path,
  { token = localStorage.getItem(KEY), body, timeout = 5000 } = {},
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token || ""))
    throw Error(
      "Cole o código exibido pelo aplicativo Windows para vincular este navegador.",
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${BASE}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
    });
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error || "O aplicativo recusou a operação.");
    return data;
  } catch (error) {
    if (error.name === "AbortError" || error instanceof TypeError)
      throw Error(
        "O aplicativo Windows não respondeu. Abra ‘Papeled Maker Arquivador’ no menu Iniciar e permita o acesso à rede local no navegador, se solicitado. O orçamento não será fechado sem confirmação da gravação.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export async function windowsArchiveStatus(token) {
  const data = await request("/status", { token });
  if (data.name !== "Papeled Maker Arquivador" || data.version !== 1)
    throw Error(
      "Aplicativo incompatível. Baixe a versão disponível neste painel.",
    );
  return data;
}
export async function connectWindowsArchive(token) {
  token = token.trim();
  const data = await windowsArchiveStatus(token);
  localStorage.setItem(KEY, token);
  return data;
}
export function updateWindowsArchiveRoot(root) {
  return request("/settings", { body: { root } });
}
export function sendWindowsArchive(archive) {
  const pdfName = Object.keys(archive.files).find((name) =>
    name.endsWith(".pdf"),
  );
  const bytes = archive.files[pdfName];
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return request("/archive", {
    body: {
      number: archive.folder,
      pdf: btoa(binary),
      quote: JSON.parse(
        new TextDecoder().decode(archive.files["orcamento-editavel.json"]),
      ),
    },
    timeout: 30000,
  });
}

export async function openWindowsArchive(number) {
  if (!windowsArchiveEnabled())
    throw Error(
      "Para abrir a pasta no Windows, vincule o aplicativo em Marca da empresa → Arquivamento no Windows.",
    );
  const status = await windowsArchiveStatus();
  if (!status.capabilities?.includes("open-folder"))
    throw Error(
      "Atualize o aplicativo Windows: baixe e execute o instalador disponível em Marca da empresa. A vinculação e os arquivos serão preservados.",
    );
  return request("/open-folder", {
    body: { number: String(number).replace(/[^a-zA-Z0-9_-]/g, "-") },
  });
}
