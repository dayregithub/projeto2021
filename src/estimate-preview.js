import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerURL;

// Render the actual PDF rather than depending on an installed browser PDF plug-in.
export async function renderEstimatePreview(bytes, root, current) {
  const loading = getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loading.promise;
  if (!current()) {
    await pdf.destroy();
    return () => {};
  }
  let pageNumber = 1,
    renderTask = null,
    disposed = false;
  root.innerHTML =
    '<div class="actions"><button type="button" data-previous>Anterior</button><span data-page role="status"></span><button type="button" data-next>Próxima</button></div><canvas aria-label="Página do orçamento"></canvas>';
  const canvas = root.querySelector("canvas"),
    previous = root.querySelector("[data-previous]"),
    next = root.querySelector("[data-next]"),
    label = root.querySelector("[data-page]");
  async function draw() {
    previous.disabled = next.disabled = true;
    label.textContent = `Página ${pageNumber} de ${pdf.numPages}`;
    const page = await pdf.getPage(pageNumber);
    if (disposed || !current()) return;
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    renderTask = page.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
    });
    await renderTask.promise;
    if (disposed || !current()) return;
    previous.disabled = pageNumber === 1;
    next.disabled = pageNumber === pdf.numPages;
  }
  const change = (delta) => {
    pageNumber += delta;
    draw().catch((error) => {
      if (!disposed && current())
        label.textContent =
          "Não foi possível desenhar esta página. Abra o PDF em outra aba.";
    });
  };
  previous.onclick = () => change(-1);
  next.onclick = () => change(1);
  try {
    await draw();
  } catch (error) {
    await pdf.destroy();
    throw error;
  }
  return () => {
    disposed = true;
    renderTask?.cancel();
    pdf.destroy();
  };
}
