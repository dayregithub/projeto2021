import { readProject } from "./geometry.js";
import { validateEstimate } from "./estimate-calculations.js";
export const WORKSPACE_KEYS = [
  "papeled-projects-v1",
  "papeled-draft-v1",
  "papeled-issued-estimates-v1",
  "papeled-estimate-profile-v1",
  "papeled-estimate-draft-v1",
];
export function readWorkspace(storage = localStorage) {
  const data = { version: 1 };
  for (const key of WORKSPACE_KEYS) {
    const raw = storage.getItem(key);
    if (raw !== null) data[key] = JSON.parse(raw);
  }
  if (JSON.stringify(data).length > 7000000)
    throw Error(
      "A cópia ultrapassa 7 MB. Exporte os projetos antes de sincronizar.",
    );
  return data;
}
export function validateWorkspace(data) {
  if (!data || data.version !== 1) throw Error("Cópia de trabalho inválida.");
  for (const p of data["papeled-projects-v1"] || []) {
    if (typeof p.id !== "string" || typeof p.updated !== "string")
      throw Error("Projeto salvo inválido.");
    readProject(p.project);
  }
  if (data["papeled-draft-v1"]) readProject(data["papeled-draft-v1"]);
  for (const q of data["papeled-issued-estimates-v1"] || [])
    validateEstimate(q);
  if (data["papeled-estimate-draft-v1"])
    validateEstimate(data["papeled-estimate-draft-v1"]);
  const profile = data["papeled-estimate-profile-v1"];
  if (profile && (typeof profile !== "object" || Array.isArray(profile)))
    throw Error("Padrões inválidos.");
  return data;
}
export function restoreWorkspace(input, storage = localStorage) {
  const previous = new Map(
    WORKSPACE_KEYS.map((key) => [key, storage.getItem(key)]),
  );
  try {
    const data = validateWorkspace(input),
      current = readWorkspace(storage);
    // Merge named records without overwriting local edits. Restore profiles/drafts explicitly.
    for (const key of WORKSPACE_KEYS) {
      if (!(key in data)) continue;
      let value = data[key];
      if (
        key === "papeled-projects-v1" ||
        key === "papeled-issued-estimates-v1"
      )
        value = [
          ...new Map(
            [...(data[key] || []), ...(current[key] || [])].map((row) => [
              row.id,
              row,
            ]),
          ).values(),
        ];
      storage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    // Free added entries first, then restore the exact previous browser copy.
    for (const key of WORKSPACE_KEYS) storage.removeItem(key);
    for (const [key, value] of previous)
      if (value !== null) storage.setItem(key, value);
    throw error;
  }
}
export async function initWorkspaceCloud({
  client,
  local = false,
  status = () => {},
}) {
  if (local || !client) {
    status(
      "Prévia local: dados deste navegador. Entre com seu administrador para salvar no banco.",
    );
    return null;
  }
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return null;
  const allowed = await client.rpc("require_admin");
  if (allowed.error) return null;
  let device = localStorage.getItem("papeled-workspace-device");
  if (!device) {
    device = crypto.randomUUID();
    localStorage.setItem("papeled-workspace-device", device);
  }
  let last = "",
    pending = false,
    stopped = false,
    timer;
  const deviceName = /Mobi|Android/i.test(navigator.userAgent)
    ? "Celular / tablet"
    : "Computador";
  async function sync() {
    if (pending || stopped) return;
    pending = true;
    try {
      const data = validateWorkspace(readWorkspace()),
        serialized = JSON.stringify(data);
      if (serialized === last) return;
      status(
        "Salvando cópia dos projetos, rascunhos e configurações no banco…",
      );
      const result = await client.from("workspace_backups").upsert(
        {
          owner_id: session.user.id,
          device_id: device,
          device_name: deviceName,
          data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,device_id" },
      );
      if (result.error) throw result.error;
      last = serialized;
      status(
        "Cópia de trabalho salva no Supabase. Produtos, solicitações e orçamentos emitidos usam suas tabelas próprias.",
      );
    } catch (error) {
      status(
        "Cópia ainda não salva no banco. Instale workspace-schema.sql e verifique a conexão. Os dados locais foram preservados.",
      );
    } finally {
      pending = false;
    }
  }
  await sync();
  timer = setInterval(sync, 5000);
  const onVisible = () => {
    if (document.visibilityState === "hidden") void sync();
  };
  document.addEventListener("visibilitychange", onVisible);
  return {
    sync,
    async list() {
      const result = await client
        .from("workspace_backups")
        .select("id,device_name,updated_at")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (result.error) throw result.error;
      return result.data;
    },
    async restore(id) {
      const result = await client
        .from("workspace_backups")
        .select("data")
        .eq("id", id)
        .single();
      if (result.error) throw result.error;
      restoreWorkspace(result.data.data);
      await sync();
    },
    stop() {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}
