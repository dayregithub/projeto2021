import { test, expect } from "./fixtures.js";
const token = "A".repeat(43);
async function brand(page) {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="brand"]').click();
  await page.locator('[data-cost-panel="brand"] details summary').click();
}
async function quote(page) {
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await page
    .locator('#estimate-form [name="customer"]')
    .fill("Cliente Windows");
  await page.locator('[data-item="minutes"]').fill("20");
}
test("download, pairing, changing path and automatic archive without a folder picker", async ({
  page,
}) => {
  let root = "C:\\Users\\Maker\\Documents\\Papeled Maker\\Orçamentos";
  let received;
  await page.addInitScript(() => {
    window.showDirectoryPicker = () => {
      throw Error("Must not ask for a folder");
    };
  });
  await page.route("http://127.0.0.1:47831/**", async (route) => {
    const request = route.request();
    expect(request.headers().authorization).toBe("Bearer " + token);
    const path = new URL(request.url()).pathname;
    let response;
    if (path === "/status")
      response = { name: "Papeled Maker Arquivador", version: 1, root };
    if (path === "/settings") {
      root = request.postDataJSON().root;
      response = { root };
    }
    if (path === "/archive") {
      received = request.postDataJSON();
      response = { path: root + "\\" + received.number };
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(response),
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await brand(page);
  await expect(
    page.getByRole("link", {
      name: "Baixar aplicativo para Windows 10/11 (64 bits)",
    }),
  ).toHaveAttribute("href", "./downloads/PapeledMaker-Arquivador-Windows.zip");
  await page.locator("#windows-archive-token").fill(token);
  await page.locator("#windows-archive-connect").click();
  await expect(page.locator("#windows-archive-status")).toContainText(
    "Aplicativo vinculado",
  );
  await expect(page.locator("#windows-archive-token")).toHaveValue("");
  await expect(page.locator("#windows-archive-root")).toHaveValue(root);
  root = "D:\\Papeled\\Orçamentos";
  await page.locator("#windows-archive-root").fill(root);
  await page.locator("#windows-archive-root-save").click();
  await expect(page.locator("#windows-archive-status")).toContainText(
    "Caminho atualizado",
  );
  await quote(page);
  await page.locator("#estimate-archive").click();
  await expect(page.locator("#estimate-editor")).toBeHidden();
  expect(received.quote.type).toBe("papeled-estimate");
  expect(received.quote.quote.customer).toBe("Cliente Windows");
  expect(received.quote.quote.number).toBe(received.number);
  expect(Buffer.from(received.pdf, "base64").subarray(0, 5).toString()).toBe(
    "%PDF-",
  );
  await page.reload();
  await page.locator('[data-tab="brand"]').click();
  await page.locator('[data-cost-panel="brand"] details summary').click();
  await expect(page.locator("#windows-archive-status")).toContainText(
    "Aplicativo vinculado neste navegador",
  );
  await page.locator("#windows-archive-disconnect").click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("papeled-windows-archiver-token-v1"),
    ),
  ).toBeNull();
});
test("app write failure leaves the saved quote open and does not silently download a ZIP", async ({
  page,
}) => {
  await page.addInitScript(
    (token) => localStorage.setItem("papeled-windows-archiver-token-v1", token),
    token,
  );
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.route("http://127.0.0.1:47831/**", async (route) => {
    const status = route.request().url().endsWith("/status");
    await route.fulfill({
      status: status ? 200 : 400,
      contentType: "application/json",
      body: JSON.stringify(
        status
          ? {
              name: "Papeled Maker Arquivador",
              version: 1,
              root: "C:\\Orcamentos",
            }
          : { error: "Feche o arquivo PDF e tente novamente." },
      ),
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await brand(page);
  await quote(page);
  await page.locator("#estimate-archive").click();
  await expect(page.locator("#estimate-status")).toContainText(
    "Feche o arquivo PDF",
  );
  await expect(page.locator("#estimate-editor")).toBeVisible();
  await expect(page.locator("#estimate-archive")).toBeEnabled();
  expect(downloads).toBe(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("papeled-issued-estimates-v1"))[0]
          .customer,
    ),
  ).toBe("Cliente Windows");
});

test("history and Kanban open the matching folder and give feedback on missing folders", async ({
  page,
}) => {
  await page.addInitScript(
    (token) => localStorage.setItem("papeled-windows-archiver-token-v1", token),
    token,
  );
  const opened = [];
  let missing = false;
  await page.route("http://127.0.0.1:47831/**", async (route) => {
    const status = route.request().url().endsWith("/status");
    let body;
    if (status)
      body = {
        name: "Papeled Maker Arquivador",
        version: 1,
        capabilities: ["open-folder"],
        root: "C:\\Orcamentos",
      };
    else if (route.request().url().endsWith("/archive"))
      body = { path: "C:\\Orcamentos\\PM-EXEMPLO" };
    else {
      opened.push(route.request().postDataJSON());
      body = missing
        ? {
            error:
              "A pasta deste orçamento não foi encontrada neste computador.",
          }
        : { path: "C:\\Orcamentos\\PM-EXEMPLO" };
    }
    await route.fulfill({
      status: !status && missing ? 404 : 200,
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await brand(page);
  await quote(page);
  await page.locator("#estimate-save").click();
  await expect(page.locator("#estimate-save")).toBeEnabled();
  const number = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("papeled-issued-estimates-v1"))[0].number,
  );
  await page.locator('[data-tab="estimate-history"]').click();
  const historyButton = page
    .locator("#estimate-history-list [data-open-folder]")
    .first();
  await historyButton.click();
  await expect(page.locator("#estimate-history-status")).toContainText(
    "Abertura solicitada",
  );
  expect(opened[0]).toEqual({ number });
  await expect(historyButton).toBeEnabled();
  await page.locator('[data-tab="production"]').click();
  await page
    .locator("#estimate-history [data-estimate-card] summary")
    .first()
    .click();
  await page.locator("#estimate-history [data-open-folder]").first().click();
  await expect(page.locator("#production-status")).toContainText(
    "Abertura solicitada",
  );
  await expect.poll(() => opened.length).toBe(2);
  expect(opened[1]).toEqual({ number });
  missing = true;
  await page.locator('[data-tab="estimate-history"]').click();
  await historyButton.click();
  await expect(page.locator("#estimate-history-status")).toContainText(
    "não foi encontrada",
  );
  await expect(historyButton).toHaveText("Abrir pasta");
  await expect(historyButton).toBeEnabled();
});
test("opening a folder explains when the installed helper needs updating", async ({
  page,
}) => {
  await page.addInitScript(
    (token) => localStorage.setItem("papeled-windows-archiver-token-v1", token),
    token,
  );
  await page.route("http://127.0.0.1:47831/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        name: "Papeled Maker Arquivador",
        version: 1,
        root: "C:\\Orcamentos",
      }),
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  await brand(page);
  await quote(page);
  await page.locator("#estimate-save").click();
  await expect(page.locator("#estimate-save")).toBeEnabled();
  await page.locator('[data-tab="estimate-history"]').click();
  await page
    .locator("#estimate-history-list [data-open-folder]")
    .first()
    .click();
  await expect(page.locator("#estimate-history-status")).toContainText(
    "Atualize o aplicativo Windows",
  );
});

test("confirmed cancellation and deletion rename by number, and offline rename can be retried after deletion", async ({
  page,
}) => {
  await page.addInitScript(
    (token) => localStorage.setItem("papeled-windows-archiver-token-v1", token),
    token,
  );
  const states = [];
  let offline = false;
  await page.route("http://127.0.0.1:47831/**", async (route) => {
    if (offline) {
      await route.abort();
      return;
    }
    const status = route.request().url().endsWith("/status");
    let body;
    if (status)
      body = {
        name: "Papeled Maker Arquivador",
        version: 1,
        capabilities: ["open-folder", "rename-folder"],
        root: "C:\\Orcamentos",
      };
    else if (route.request().url().endsWith("/archive"))
      body = { path: "C:\\Orcamentos\\PM-EXEMPLO" };
    else {
      const request = route.request().postDataJSON();
      states.push(request);
      body = {
        path: `C:\\Orcamentos\\${request.number} - ${request.state === "deleted" ? "DELETADO" : "CANCELADO"}`,
      };
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await brand(page);
  await quote(page);
  await page.locator("#estimate-save").click();
  await expect(page.locator("#estimate-save")).toBeEnabled();
  const number = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("papeled-issued-estimates-v1"))[0].number,
  );
  await page.locator('[data-tab="estimate-history"]').click();
  await page
    .locator("#estimate-history-list [data-cancel-record]")
    .first()
    .click();
  expect(states).toHaveLength(0);
  await page.locator("#estimate-record-confirm").click();
  await expect(page.locator("#estimate-history-status")).toContainText(
    "CANCELADO",
  );
  expect(states).toEqual([{ number, state: "cancelled" }]);
  offline = true;
  await page
    .locator("#estimate-history-list [data-delete-record]")
    .first()
    .click();
  await page.locator("#estimate-record-confirm").click();
  await expect(page.locator("#estimate-history-status")).toContainText(
    "ficou pendente",
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("papeled-issued-estimates-v1")),
    ),
  ).toEqual([]);
  const pending = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("papeled-windows-folder-pending-v1")),
  );
  expect(pending[0]).toMatchObject({ number, state: "deleted" });
  offline = false;
  await page.reload();
  await page.locator('[data-tab="brand"]').click();
  await page.locator('[data-cost-panel="brand"] details summary').click();
  await page.locator("#windows-archive-sync").click();
  await expect(page.locator("#windows-archive-status")).toContainText(
    "DELETADO",
  );
  expect(states[1]).toEqual({ number, state: "deleted" });
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("papeled-windows-folder-pending-v1")),
    ),
  ).toEqual([]);
});

test("quote screen exposes the app and ordinary save writes the Windows folder with explicit failure recovery", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await expect(
    page.getByRole("link", { name: "Baixar aplicativo Windows", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#estimate-windows-state")).toContainText(
    "não vinculado",
  );
  await page.locator("#estimate-windows-setup").click();
  await expect(page.locator("#windows-archive-token")).toBeVisible();
  let fail = false;
  const archives = [];
  await page.route("http://127.0.0.1:47831/**", async (route) => {
    const status = route.request().url().endsWith("/status");
    if (!status) archives.push(route.request().postDataJSON());
    await route.fulfill({
      status: !status && fail ? 400 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        status
          ? {
              name: "Papeled Maker Arquivador",
              version: 1,
              root: "C:\\Orcamentos",
            }
          : fail
            ? { error: "Disco cheio" }
            : { path: "C:\\Orcamentos\\PM-TESTE" },
      ),
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.locator("#windows-archive-token").fill(token);
  await page.locator("#windows-archive-connect").click();
  await expect(page.locator("#windows-archive-status")).toContainText(
    "Aplicativo vinculado",
  );
  await quote(page);
  await page.locator("#estimate-save").click();
  await expect(page.locator("#estimate-status")).toContainText(
    "pasta atualizada no Windows",
  );
  await expect(page.locator("#estimate-editor")).toBeVisible();
  expect(archives.length).toBe(1);
  expect(Buffer.from(archives[0].pdf, "base64").subarray(0, 5).toString()).toBe(
    "%PDF-",
  );
  fail = true;
  await page.locator("#estimate-save").click();
  await expect(page.locator("#estimate-status")).toContainText(
    "NÃO foram gravados no Windows",
  );
  await expect(page.locator("#estimate-status")).toContainText("Disco cheio");
  await expect(page.locator("#estimate-save")).toBeEnabled();
  await expect(page.locator("#estimate-editor")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("papeled-issued-estimates-v1")).length,
    ),
  ).toBe(1);
  expect(archives[0].number).toBe(archives[1].number);
});
