import { test, expect } from "./fixtures.js";
test("material and service registry feeds quotes with independent prices and snapshots", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="resources"]').click();
  const f = page.locator("#resource-form");
  await f.locator('[name="name"]').fill("MDF 6 mm");
  await f.locator('[name="thickness"]').fill("6");
  await f.locator('[name="price"]').fill("200");
  await f.locator('[name="width"]').fill("100");
  await f.locator('[name="length"]').fill("200");
  await f.locator('[type="submit"]').click();
  await expect(page.locator("#resource-status")).toContainText("salvo");
  await f.locator('[name="kind"]').selectOption("service");
  await f.locator('[name="name"]').fill("Pintura");
  await f.locator('[name="price"]').fill("20");
  await f.locator('[name="cost"]').fill("5");
  await f.locator('[type="submit"]').click();
  await expect(page.locator("#resource-list")).toContainText("Pintura");
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await page.locator('[data-item="materialMode"]').selectOption("included");
  await page
    .locator("[data-material-name]")
    .selectOption({ label: "MDF 6 mm" });
  await expect(page.locator("[data-material-summary]")).toContainText("400,00");
  await page.locator('[data-item="materialQuantity"]').fill("0.12");
  await page.locator("[data-service-pick]").selectOption("0");
  await page.locator("[data-service-add]").click();
  await expect(page.locator("[data-service-quantity]")).toHaveValue("1");
  await expect(page.locator("#estimate-summary .metric").nth(2)).toContainText(
    "68,00",
  );
  await page.locator("#estimate-save").click();
  await page.reload();
  await page.locator('[data-tab="estimates"]').click();
  await expect(page.locator("[data-material-summary]")).toContainText("400,00");
  await expect(page.locator("[data-service-quantity]")).toHaveValue("1");
  await page.locator('[data-tab="resources"]').click();
  await page.locator("[data-material-edit]").click();
  await f.locator('[name="price"]').fill("250");
  await f.locator('[type="submit"]').click();
  await page.locator('[data-tab="estimates"]').click();
  await expect(page.locator("[data-material-summary]")).toContainText("400,00");
});

test("customer name is required and action is blocked until linked project registration succeeds", async ({
  page,
}) => {
  await page.route("**/platform-config.json", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        supabaseUrl: "https://testproject.supabase.co",
        supabaseAnonKey: "sb_publishable_test",
      }),
    }),
  );
  const captured = [];
  let failRegistration = true;
  await page.route("https://testproject.supabase.co/**", async (route) => {
    const url = route.request().url();
    if (url.includes("customer_capture_enabled"))
      return route.fulfill({ contentType: "application/json", body: "true" });
    if (url.includes("register_customer_project")) {
      if (failRegistration) {
        failRegistration = false;
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Temporary failure" }),
        });
      }
      captured.push(route.request().postDataJSON());
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.goto("/");
  await page.locator('[data-group="laser-boxes"]').click();
  await page.locator("#save-project").click();
  const dialog = page.locator("#customer-project-dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator('[type="submit"]').click();
  expect(captured).toHaveLength(0);
  await dialog.locator('[name="name"]').fill("Maria Cliente");
  await dialog.locator('[type="submit"]').click();
  expect(captured).toHaveLength(0);
  await expect(dialog.locator('[name="email"]')).toHaveAttribute(
    "required",
    "",
  );
  await dialog.locator('[name="email"]').fill("maria@example.com");
  await dialog.locator('[type="submit"]').click();
  await expect(dialog.locator('[role="status"]')).toContainText(
    "Não foi possível registrar",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("papeled-projects-v1") || "[]").length,
    ),
  ).toBe(0);
  await dialog.locator('[type="submit"]').click();
  await expect(dialog).toBeHidden();
  expect(captured).toHaveLength(1);
  expect(captured[0].p_name).toBe("Maria Cliente");
  expect(captured[0].p_project.model).toBeTruthy();
  expect(captured[0].p_action).toBe("save");
  await page.locator("#export-project").click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[type="submit"]').click();
  await expect(dialog).toBeHidden();
  expect(captured[1].p_action).toBe("export");
  expect(captured[1].p_email).toBe("maria@example.com");
  const download = page.waitForEvent("download");
  await page.locator('[data-export="json"]').click();
  await download;
});

test("kanban moves issued quotes through delivery and preserves paid date", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await page.locator('[data-item="minutes"]').fill("60");
  await page.locator("#estimate-save").click();
  await page.locator('[data-tab="production"]').click();
  await page.locator("[data-estimate-card] details summary").click();
  await page.locator("[data-stage-change]").selectOption("approved");
  await expect(
    page.locator('[data-stage="approved"] [data-estimate-card]'),
  ).toHaveCount(1);
  await page.locator("[data-stage-change]").selectOption("in_progress");
  await page.locator("[data-payment-change]").selectOption("paid");
  await expect(page.locator("[data-payment-date]")).not.toHaveValue("");
  const date = await page.locator("[data-payment-date]").inputValue();
  await page.locator("[data-stage-change]").selectOption("completed");
  await page.locator("[data-stage-change]").selectOption("delivered");
  await page.reload();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator('[data-tab="production"]').click();
  await expect(
    page.locator('[data-stage="delivered"] [data-estimate-card]'),
  ).toHaveCount(1);
  await page.locator("[data-estimate-card] details summary").click();
  await expect(page.locator("[data-payment-change]")).toHaveValue("paid");
  await expect(page.locator("[data-payment-date]")).toHaveValue(date);
  await expect(page.locator('#estimate-form [name="status"]')).toHaveValue(
    "delivered",
  );
  await expect(
    page.locator('#estimate-form [name="paymentStatus"]'),
  ).toHaveValue("paid");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("separate settings affect new quotes only and history reopens original pricing", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await page
    .locator('#estimate-form [name="customer"]')
    .fill("Cliente histórico");
  await page.locator('[data-item="minutes"]').fill("60");
  await page.locator("#estimate-save").click();
  await page.locator('[data-tab="estimate-settings"]').click();
  await page.locator('[data-pricing="laserSaleHour"]').fill("120");
  await page.locator('[data-pricing="laserCostHour"]').fill("30");
  await page.locator('[data-layout="businessName"]').fill("Marca renovada");
  await page.locator("#estimate-save-profile").click();
  await expect(page.locator("#estimate-settings-status")).toContainText(
    "Configurações salvas",
  );
  await page.locator('[data-tab="estimates"]').click();
  await expect(page.locator("#estimate-summary .metric").nth(2)).toContainText(
    "70,00",
  );
  await expect(page.locator("#estimate-form [data-pricing]")).toHaveCount(0);
  await expect(page.locator("#estimate-form [data-layout]")).toHaveCount(0);
  await page.locator("#new-laser-estimate").click();
  await page.locator('[data-item="minutes"]').fill("60");
  await expect(page.locator("#estimate-summary .metric").nth(2)).toContainText(
    "120,00",
  );
  await page.locator('[data-tab="estimate-history"]').click();
  await page.locator("#estimate-history-search").fill("Cliente histórico");
  await page.locator("#estimate-history-list [data-open-estimate]").click();
  await expect(page.locator("#estimate-summary .metric").nth(2)).toContainText(
    "70,00",
  );
  await page.screenshot({
    path: "/tmp/papeled-admin-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "/tmp/papeled-admin-mobile.png",
    fullPage: true,
  });
});

test("spreadsheet workflow bills laser, material and extras with independent quantities", async ({
  page,
}) => {
  await page.goto("/admin.html");
  await page.locator("#local-preview").click();
  await page.locator('[data-tab="resources"]').click();
  const f = page.locator("#resource-form");
  await f.locator('[name="name"]').fill("MDF 3 mm");
  await f.locator('[name="materialUnit"]').selectOption("unidade");
  await f.locator('[name="price"]').fill("8");
  await f.locator('[name="salePrice"]').fill("12.50");
  await f.locator('[type="submit"]').click();
  await expect(page.locator("#resource-status")).toContainText("salvo");
  await f.locator('[name="kind"]').selectOption("service");
  await f.locator('[name="name"]').fill("Acabamento");
  await f.locator('[name="price"]').fill("10");
  await f.locator('[name="cost"]').fill("5");
  await f.locator('[type="submit"]').click();
  await page.locator('[data-tab="estimate-settings"]').click();
  await page.locator('[data-pricing="laserSaleHour"]').fill("85");
  await page.locator("#estimate-save-profile").click();
  await expect(page.locator("#estimate-settings-status")).toContainText(
    "Configurações salvas",
  );
  await page.locator('[data-tab="estimates"]').click();
  await page.locator("#new-laser-estimate").click();
  await page.locator('[data-item="description"]').fill("CORTE PEÇAS");
  await page.locator('[data-item="quantity"]').fill("40");
  await page.locator('[data-item="minutes"]').fill("10");
  await expect(page.locator("[data-time-result]")).toContainText("400 minutos");
  await page.locator('[data-item="materialMode"]').selectOption("included");
  await page
    .locator("[data-material-name]")
    .selectOption({ label: "MDF 3 mm" });
  await page.locator('[data-item="materialQuantity"]').fill("40");
  await expect(page.locator("#estimate-summary .metric").nth(0)).toContainText(
    "500,00",
  );
  await expect(page.locator("#estimate-summary .metric").nth(1)).toContainText(
    "566,67",
  );
  await expect(page.locator("#estimate-summary .metric").nth(2)).toContainText(
    "1.066,67",
  );
  await page.locator("[data-service-pick]").selectOption("0");
  await page.locator("[data-new-service-quantity]").fill("7");
  await page.locator("[data-service-add]").click();
  await expect(page.locator("#estimate-summary .metric").nth(2)).toContainText(
    "1.136,67",
  );
  await page.locator('[data-item="quantity"]').fill("80");
  await expect(page.locator("#estimate-summary .metric").nth(0)).toContainText(
    "500,00",
  );
  await expect(page.locator("[data-service-quantity]")).toHaveValue("7");
  await expect(page.locator("#estimate-summary .metric").nth(2)).toContainText(
    "1.703,33",
  );
  await page.locator('#estimate-form [name="customer"]').fill("Ana");
  await page
    .locator('#estimate-form [name="title"]')
    .fill("Caixa organizadora");
  await page.locator("#estimate-save").click();
  await page.locator('[data-tab="production"]').click();
  const card = page.locator("[data-estimate-card]");
  await expect(card.locator("h4")).toHaveText("Ana");
  await expect(card.locator(".kanban-project-name")).toHaveText(
    "Caixa organizadora",
  );
  await expect(card.locator("[data-payment-change]")).toBeHidden();
});
