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

const PENDING = "papeled-windows-folder-pending-v1";
let syncingFolders = false;
function pendingFolders() {
  const data = JSON.parse(localStorage.getItem(PENDING) || "[]");
  if (!Array.isArray(data))
    throw Error("Não foi possível ler as renomeações pendentes.");
  return data;
}
export async function syncWindowsFolderStates() {
  if (syncingFolders)
    throw Error(
      "Uma sincronização de pastas já está em andamento. Tente novamente em instantes.",
    );
  const pending = pendingFolders();
  if (!pending.length)
    return "Nenhuma renomeação de pasta pendente neste navegador.";
  syncingFolders = true;
  try {
    const status = await windowsArchiveStatus();
    if (!status.capabilities?.includes("rename-folder"))
      throw Error(
        "Atualize o aplicativo Windows pelo download em Marca da empresa para renomear as pastas. As renomeações continuam pendentes neste navegador.",
      );
    const notes = [];
    for (const item of pending) {
      const result = await request("/folder-state", {
        body: { number: item.number, state: item.state },
      });
      localStorage.setItem(
        PENDING,
        JSON.stringify(pendingFolders().filter((row) => row.id !== item.id)),
      );
      notes.push(
        result.skipped
          ? `${item.number}: ${result.message}`
          : `Pasta renomeada: ${result.path}`,
      );
    }
    return notes.join(" ");
  } finally {
    syncingFolders = false;
  }
}
export async function markWindowsFolder(number, state) {
  if (!windowsArchiveEnabled())
    return "A pasta do Windows não foi alterada: aplicativo não vinculado neste navegador.";
  let queued = false;
  try {
    number = String(number).replace(/[^a-zA-Z0-9_-]/g, "-");
    const pending = pendingFolders().filter((item) => item.number !== number);
    pending.push({ id: crypto.randomUUID(), number, state });
    localStorage.setItem(PENDING, JSON.stringify(pending));
    queued = true;
    return await syncWindowsFolderStates();
  } catch (error) {
    return queued
      ? `A alteração do orçamento foi salva, mas a renomeação da pasta ficou pendente: ${error.message} Use ‘Sincronizar nomes das pastas’ em Marca da empresa.`
      : `A alteração do orçamento foi salva, mas não foi possível registrar a renomeação da pasta: ${error.message} Verifique a pasta manualmente no Windows.`;
  }
}
