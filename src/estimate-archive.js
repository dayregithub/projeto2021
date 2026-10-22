import { zipSync, strToU8 } from "fflate";
let cached;
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("papeled-local-archive", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("settings");
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(
        Error(
          "O armazenamento do navegador não respondeu. Reabra o painel ou verifique as permissões de armazenamento do site.",
        ),
      );
    }, 5000);
    request.onsuccess = () => {
      clearTimeout(timer);
      if (timedOut) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error);
    };
    request.onblocked = () => {
      clearTimeout(timer);
      timedOut = true;
      reject(
        Error(
          "Feche outras abas do painel e tente novamente para liberar o armazenamento.",
        ),
      );
    };
  });
}
async function setting(write, value) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("settings", write ? "readwrite" : "readonly");
      const request = write
        ? tx.objectStore("settings").put(value, "folder")
        : tx.objectStore("settings").get("folder");
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || Error("Não foi possível guardar a pasta."));
    });
  } finally {
    db.close();
  }
}
export async function archiveFolder() {
  if (cached === undefined) cached = (await setting(false)) || null;
  return cached;
}
export async function chooseArchiveFolder() {
  const folder = await window.showDirectoryPicker({
    id: "papeled-quotes",
    mode: "readwrite",
  });
  await setting(true, folder);
  cached = folder;
  return folder;
}
export async function forgetArchiveFolder() {
  await setting(true, null);
  cached = null;
}
export async function authorizeArchiveFolder() {
  const folder = await archiveFolder();
  if (!folder)
    throw Error(
      "Escolha a pasta de arquivamento em Marca da empresa antes de continuar.",
    );
  if (
    (await folder.queryPermission({ mode: "readwrite" })) !== "granted" &&
    (await folder.requestPermission({ mode: "readwrite" })) !== "granted"
  )
    throw Error(
      "Autorize o acesso à pasta ou escolha outra em Marca da empresa. O orçamento continua aberto.",
    );
  return folder;
}
export function archiveFiles(quote, pdf) {
  const folder =
    String(quote.number).replace(/[^a-zA-Z0-9_-]/g, "-") || "orcamento";
  return {
    folder,
    files: {
      [pdf.name]: new Uint8Array(pdf.bytes),
      "orcamento-editavel.json": strToU8(
        JSON.stringify({ type: "papeled-estimate", quote }, null, 2),
      ),
      "LEIA-ME.txt": strToU8(
        "Proposta em PDF e cópia editável do orçamento. Para editar, importe orcamento-editavel.json no painel Papeled Maker. Esta pasta contém dados pessoais e custos internos; envie ao cliente apenas o PDF. Novos arquivamentos do mesmo número atualizam estes arquivos.\n",
      ),
    },
  };
}
export async function writeArchive(folder, archive) {
  const target = await folder.getDirectoryHandle(archive.folder, {
    create: true,
  });
  for (const [name, bytes] of Object.entries(archive.files)) {
    const file = await target.getFileHandle(name, { create: true });
    const stream = await file.createWritable();
    try {
      await stream.write(bytes);
      await stream.close();
    } catch (error) {
      await stream.abort().catch(() => {});
      throw error;
    }
  }
}
export function archiveZip(archive) {
  return zipSync(
    Object.fromEntries(
      Object.entries(archive.files).map(([name, bytes]) => [
        `${archive.folder}/${name}`,
        bytes,
      ]),
    ),
  );
}
