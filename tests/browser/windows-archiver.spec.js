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
