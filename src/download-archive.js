const BUCKET = "maker-downloads";
export const MAX_ARCHIVE_SIZE = 25 * 1024 * 1024;
let backend = null,
  preview = false;
export function setArchiveBackend(client, local) {
  backend = client;
  preview = local;
  document
    .querySelectorAll("[data-archive-option]")
    .forEach((e) => (e.hidden = false));
}
async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("papeled-download-archive", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("files", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function localAction(mode, action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("files", mode),
        request = action(tx.objectStore("files"));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function fileHash(file) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function archiveDownload(
  file,
  {
    model = "",
    product = null,
    checkbox = "archive-export",
    status = "archive-export-status",
  } = {},
) {
  if (!document.getElementById(checkbox)?.checked || (!backend && !preview))
    return;
  const note = document.getElementById(status);
  try {
    if (file.size > MAX_ARCHIVE_SIZE)
      throw Error(
        "O arquivo excede 25 MB. O download continua, mas a cópia não foi guardada.",
      );
    if (note)
      note.textContent = "Guardando uma cópia do arquivo para o estúdio…";
    const format = file.name.split(".").pop().toLowerCase(),
      id = crypto.randomUUID(),
      hash = await fileHash(file);
    const record = {
      id,
      filename: file.name,
      format,
      model_id: model,
      product_id: product,
      size_bytes: file.size,
      sha256: hash,
      object_path: `${id}/file.${format}`,
      state: "ready",
      created_at: new Date().toISOString(),
    };
    if (preview)
      await localAction("readwrite", (store) => store.put({ ...record, file }));
    else {
      let result = await backend.rpc("reserve_download", {
        p_id: id,
        p_filename: file.name,
        p_model: model,
        p_format: format,
        p_size: file.size,
        p_sha256: hash,
        p_product: product,
      });
      if (result.error)
        throw Error("Não foi possível reservar a cópia no estúdio.");
      result = await backend.storage
        .from(BUCKET)
        .upload(record.object_path, file, {
          contentType: "application/octet-stream",
          upsert: false,
        });
      if (result.error)
        throw Error(
          "O envio da cópia falhou. O arquivo baixado continua disponível no seu aparelho.",
        );
      result = await backend.rpc("complete_download", { p_id: id });
      if (result.error)
        throw Error("A cópia foi enviada, mas não foi confirmada no painel.");
    }
    if (note)
      note.textContent = preview
        ? "Cópia guardada na prévia local deste navegador."
        : "Cópia guardada no painel privado do estúdio.";
  } catch (error) {
    if (note) note.textContent = error.message;
  }
}
export async function listDownloads(client, local) {
  if (local)
    return (await localAction("readonly", (s) => s.getAll()))
      .map(({ file, ...record }) => record)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 250);
  const { data, error } = await client
    .from("download_files")
    .select("*")
    .eq("state", "ready")
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw error;
  return data;
}
export async function getDownload(client, local, record) {
  let file;
  if (local) {
    const entry = await localAction("readonly", (s) => s.get(record.id));
    file = entry?.file;
    if (!file) throw Error("Arquivo não encontrado neste navegador.");
  } else {
    const { data, error } = await client.storage
      .from(BUCKET)
      .download(record.object_path);
    if (error) throw Error("Não foi possível acessar o arquivo privado.");
    file = data;
  }
  if ((await fileHash(file)) !== record.sha256)
    throw Error("A cópia não passou na verificação de integridade.");
  return new File([file], record.filename, {
    type: "application/octet-stream",
  });
}
export async function deleteDownload(client, local, record) {
  if (local) {
    await localAction("readwrite", (s) => s.delete(record.id));
    return;
  }
  const removed = await client.storage
    .from(BUCKET)
    .remove([record.object_path]);
  if (removed.error) throw removed.error;
  const result = await client
    .from("download_files")
    .delete()
    .eq("id", record.id);
  if (result.error) throw result.error;
}
