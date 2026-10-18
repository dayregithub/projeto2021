import { readProject } from "./geometry.js";
const PREFIX = "papeled-admin-edit-";
const validToken = (token) => /^[a-f0-9-]{36}$/.test(token || "");
function read(token) {
  if (!validToken(token)) throw Error("Link de edição inválido.");
  const entry = JSON.parse(localStorage.getItem(PREFIX + token) || "null");
  if (!entry || Date.now() - entry.created > 86400000)
    throw Error("A edição expirou. Abra o configurador novamente pelo painel.");
  return { ...entry, project: readProject(entry.project) };
}
export function openAdminEditor(project, meta = {}) {
  const token = crypto.randomUUID();
  localStorage.setItem(
    PREFIX + token,
    JSON.stringify({
      project: readProject(project),
      meta,
      created: Date.now(),
      returned: false,
    }),
  );
  const url = new URL("./", document.baseURI);
  url.searchParams.set("makerEdit", token);
  url.hash = "editor";
  location.assign(url.href);
}
export function editingProject() {
  const token = new URL(location.href).searchParams.get("makerEdit");
  return token ? { token, ...read(token) } : null;
}
export function returnToAdmin(token, project) {
  const entry = read(token);
  localStorage.setItem(
    PREFIX + token,
    JSON.stringify({ ...entry, project: readProject(project), returned: true }),
  );
  const url = new URL("./admin.html", document.baseURI);
  url.searchParams.set("makerReturn", token);
  location.assign(url.href);
}
export function takeEditorReturn() {
  const url = new URL(location.href),
    token = url.searchParams.get("makerReturn");
  if (!token) return null;
  const entry = read(token);
  if (!entry.returned)
    throw Error("Os ajustes ainda não foram enviados pelo configurador.");
  localStorage.removeItem(PREFIX + token);
  url.searchParams.delete("makerReturn");
  history.replaceState(null, "", url.href);
  return entry;
}
