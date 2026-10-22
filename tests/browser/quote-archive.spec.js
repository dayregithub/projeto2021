import { test, expect } from "./fixtures.js";
import { unzipSync, strFromU8 } from "fflate";
import fs from "node:fs/promises";
async function prepare(page) {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await page
    .locator('#estimate-form [name="customer"]')
    .fill("Cliente arquivo");
  await page.locator('[data-item="minutes"]').fill("60");
}
test("archive ZIP contains numbered PDF and reimportable quote and closes after saving", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = undefined;
  });
  await prepare(page);
  const downloaded = page.waitForEvent("download");
  await page.locator("#estimate-archive").click();
  const download = await downloaded;
  const files = unzipSync(
    new Uint8Array(await fs.readFile(await download.path())),
  );
  const jsonName = Object.keys(files).find((name) =>
    name.endsWith("/orcamento-editavel.json"),
  );
  const data = JSON.parse(strFromU8(files[jsonName]));
  expect(data.type).toBe("papeled-estimate");
  expect(data.quote.customer).toBe("Cliente arquivo");
  expect(jsonName.startsWith(data.quote.number + "/")).toBeTruthy();
  expect(Object.keys(files).some((name) => name.endsWith(".pdf"))).toBeTruthy();
  await expect(page.locator("#estimate-editor")).toBeHidden();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("papeled-issued-estimates-v1"))[0]
          .customer,
    ),
  ).toBe("Cliente arquivo");
});
test("missing local folder keeps quote open without losing data", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {};
  });
  await prepare(page);
  await page.locator("#estimate-archive").click();
  await expect(page.locator("#estimate-editor")).toBeVisible();
  await expect(page.locator('#estimate-form [name="customer"]')).toHaveValue(
    "Cliente arquivo",
  );
  await expect(page.locator("#estimate-archive")).toBeEnabled();
});
test("folder writer creates numbered directory and updates PDF and JSON", async ({
  page,
}) => {
  await page.goto("/admin.html");
  const result = await page.evaluate(async () => {
    const { archiveFiles, writeArchive } =
      await import("/src/estimate-archive.js");
    const files = {};
    let name;
    const folder = {
      getDirectoryHandle: async (n) => {
        name = n;
        return {
          getFileHandle: async (file) => ({
            createWritable: async () => ({
              write: async (bytes) => {
                files[file] = [...bytes];
              },
              close: async () => {},
            }),
          }),
        };
      },
    };
    await writeArchive(
      folder,
      archiveFiles(
        { number: "PM-20261022-ABC123", customer: "Primeiro" },
        { name: "proposta.pdf", bytes: new Uint8Array([1, 2]).buffer },
      ),
    );
    await writeArchive(
      folder,
      archiveFiles(
        { number: "PM-20261022-ABC123", customer: "Atualizado" },
        { name: "proposta.pdf", bytes: new Uint8Array([3]).buffer },
      ),
    );
    return {
      name,
      pdf: files["proposta.pdf"],
      quote: JSON.parse(
        new TextDecoder().decode(
          new Uint8Array(files["orcamento-editavel.json"]),
        ),
      ),
    };
  });
  expect(result.name).toBe("PM-20261022-ABC123");
  expect(result.pdf).toEqual([3]);
  expect(result.quote.quote.customer).toBe("Atualizado");
});

test("unsupported folder API does not wait for IndexedDB and keeps brand and navigation usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = undefined;
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) =>
      args[0] === "papeled-local-archive" ? {} : open(...args);
  });
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="brand"]').click();
  await page.locator('[data-cost-panel="brand"] details summary').click();
  await expect(page.locator("#archive-folder-status")).toContainText(
    "Arquivamento por ZIP disponível",
  );
  await expect(page.locator("#archive-folder-choose")).toBeHidden();
  await page.locator("#archive-folder-help").click();
  await expect(page.locator("#archive-folder-status")).toContainText(
    "Após baixar, extraia-o",
  );
  await page.locator('[data-layout="businessName"]').fill("Papeled teste");
  await page.locator("#estimate-save-profile").click();
  await expect(page.locator('[data-layout="businessName"]')).toHaveValue(
    "Papeled teste",
  );
  await page.locator('[data-tab="finance"]').click();
  await expect(page.locator('[data-section="finance"]')).toBeVisible();
});

test("folder storage that never responds times out without locking navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {};
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) =>
      args[0] === "papeled-local-archive" ? {} : open(...args);
  });
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="brand"]').click();
  await page.locator('[data-cost-panel="brand"] details summary').click();
  await expect(page.locator("#archive-folder-status")).toContainText(
    "Não foi possível recuperar a pasta",
    { timeout: 10000 },
  );
  await page.locator('[data-tab="finance"]').click();
  await expect(page.locator('[data-section="finance"]')).toBeVisible();
});
