import { test, expect } from "./fixtures.js";
test("registered materials, tax breakdowns and reorganized navigation work across both processes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("papeled-estimate-profile-v1"))
      localStorage.setItem(
        "papeled-estimate-profile-v1",
        JSON.stringify({
          pricing: { taxPercent: 10 },
          materials: [
            {
              process: "laser",
              material: {
                name: "MDF cadastrado",
                price: 85,
                width: 180,
                length: 275,
                unit: "chapa",
              },
            },
            {
              process: "print",
              material: { name: "PETG cadastrado", price: 200, unit: "kg" },
            },
          ],
        }),
      );
  });
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await expect(page.locator(".nav-group > summary")).toHaveText([
    "SITE",
    "COMERCIAL",
    "CADASTROS",
    "GESTÃO",
  ]);
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-print-estimate").click();
  await expect(page.locator("[data-material-name] option")).toHaveCount(1);
  await expect(page.locator("[data-material-name] option")).toHaveText(
    "PETG cadastrado",
  );
  await page.locator('[data-item="grams"]').fill("100");
  await page.locator('[data-item="hours"]').fill("2");
  await page
    .locator("summary")
    .filter({ hasText: "Conferir custos calculados" })
    .click();
  const cost = page.locator("[data-project-cost-result]");
  await expect(cost).toContainText("Impostos inclusos na venda (10%)");
  await expect(cost).toContainText("5,24");
  await expect(cost).toContainText("47,14");
  await expect(cost).toContainText("26,19");
  await page.locator("#estimate-save").click();
  await page.locator("#new-laser-estimate").click();
  await page.locator('[data-item="minutes"]').fill("60");
  await page
    .locator("summary")
    .filter({ hasText: "Conferir custos calculados" })
    .click();
  await expect(cost).toContainText("Energia");
  await expect(cost).toContainText("7,00");
  await expect(cost).toContainText("56,14");
  await page.locator("#estimate-save").click();
  await page.locator('[data-tab="resources-laser"]').click();
  await expect(page.locator("#resource-list")).toContainText("MDF cadastrado");
  await expect(page.locator("#resource-list")).not.toContainText(
    "PETG cadastrado",
  );
  await expect(page.locator('#resource-form [name="process"]')).toHaveValue(
    "laser",
  );
  await page.locator('[data-tab="resources-print"]').click();
  await expect(page.locator("#resource-list")).toContainText("PETG cadastrado");
  await expect(page.locator("#resource-list")).not.toContainText(
    "MDF cadastrado",
  );
  await expect(page.locator('#resource-form [name="process"]')).toHaveValue(
    "print",
  );
  await page.locator('[data-tab="brand"]').click();
  await expect(page.locator('[data-cost-panel="brand"]')).toBeVisible();
  await expect(page.locator('[data-cost-panel="laser"]')).toBeHidden();
  await expect(page.locator(".cost-settings-tabs")).toBeHidden();
  await page.locator('[data-tab="estimate-settings"]').click();
  await expect(page.locator('[data-cost-panel="laser"]')).toBeVisible();
  await expect(page.locator('[data-cost-panel="brand"]')).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("without a catalog the quote requests registration instead of inventing material options", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-print-estimate").click();
  await expect(page.locator("[data-material-name] option")).toHaveText(
    "Nenhum material cadastrado",
  );
  await expect(page.locator("[data-material-cost]")).toBeDisabled();
  await expect(page.locator("[data-material-summary]")).toContainText(
    "Cadastre",
  );
  await page.locator('[data-item="grams"]').fill("100");
  await page.locator('[data-item="hours"]').fill("2");
  await expect(page.locator("#estimate-save")).toBeDisabled();
  await expect(page.locator("#estimate-summary")).toContainText(
    "Cadastre e selecione",
  );
});

test("existing quote shows its saved tax and can explicitly adopt the current configured rate", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await page.locator('[data-item="minutes"]').fill("60");
  await page.locator("#estimate-save").click();
  await page.locator('[data-tab="estimate-settings"]').click();
  await page.locator('[data-cost-tab="general"]').click();
  await page.locator('[data-pricing="taxPercent"]').fill("10");
  await page.locator("#estimate-save-profile").click();
  await expect(page.locator("#estimate-settings-status")).toContainText(
    "Configurações salvas",
  );
  await page.locator('[data-tab="estimates"]').click();
  await page
    .locator("summary")
    .filter({ hasText: "Conferir custos calculados" })
    .click();
  await expect(page.locator("[data-project-cost-result]")).toContainText(
    "Impostos inclusos na venda (0%)",
  );
  await page.locator("[data-refresh-quote-tax]").click();
  await expect(page.locator("[data-project-cost-result]")).toContainText(
    "Impostos inclusos na venda (10%)",
  );
  await expect(page.locator("[data-project-cost-result]")).toContainText(
    "7,00",
  );
  await expect(page.locator("#estimate-summary [data-estimate-total]")).toContainText(
    "70,00",
  );
  await page.locator("#estimate-save").click();
  await page.reload();
  await page.locator('[data-tab="estimates"]').click();
  await page
    .locator("summary")
    .filter({ hasText: "Conferir custos calculados" })
    .click();
  await expect(page.locator("[data-project-cost-result]")).toContainText(
    "Impostos inclusos na venda (10%)",
  );
});
