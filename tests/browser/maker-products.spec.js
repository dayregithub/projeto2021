import { test, expect } from "./fixtures.js";
import { readFile } from "node:fs/promises";
test("maker 3D products expose working customization, persist settings and export separate STLs", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('[data-group="print-stamps"]').click();
  await expect(page.locator("#maker-options")).toBeVisible();
  await expect(page.locator("#print-options")).toBeHidden();
  await expect(page.locator("#construction-section")).toBeHidden();
  await expect(page.locator("#maker-font option")).toHaveCount(10);
  await page.locator("#makerText").fill("Luna");
  await page.locator("#maker-font").selectOption("lora");
  await expect(page.locator("#part-count")).toHaveText("2");
  await page.locator("#preview").screenshot({ path: "/tmp/papeled-stamp.png" });
  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.locator("#maker-font")).toHaveValue("lora");
  await page.locator("#export-project").click();
  const file = page.waitForEvent("download");
  await page.locator('[data-export="zip"]').click();
  expect(
    (await readFile(await (await file).path())).subarray(0, 2).toString(),
  ).toBe("PK");
  await page.locator("#export-dialog [data-close]").click();
  await page.locator('[data-nav="modelos"]').first().click();
  await page.locator('[data-group="print-relief"]').click();
  await page.selectOption("#model-variation", "keychain");
  await expect(page.locator("#maker-hole")).toHaveValue("yes");
  await page.locator("#makerText").fill("João");
  await page.locator("#maker-hole-position").selectOption("right");
  await expect(page.locator("#validation")).toBeHidden();
  await page
    .locator("#preview")
    .screenshot({ path: "/tmp/papeled-keychain.png" });
  await page.locator('[data-nav="modelos"]').first().click();
  await page.locator('[data-group="print-rollers"]').click();
  await expect(page.locator("#height")).toBeDisabled();
  await page.locator("#maker-pattern").selectOption("dots");
  await page.locator("#makerRelief").fill("1.5");
  await expect(page.locator("#height")).toHaveValue("33");
  await expect(page.locator("#validation")).toBeHidden();
  await page
    .locator("#preview")
    .screenshot({ path: "/tmp/papeled-roller.png" });
  await page.locator('[data-nav="modelos"]').first().click();
  await page.locator('[data-group="print-gears"]').click();
  await expect(page.locator("#width")).toBeDisabled();
  await expect(page.locator("#part-count")).toHaveText("4");
  const before = await page.locator("#preview").innerHTML();
  await page.locator("#maker-gear-step").click();
  expect(await page.locator("#preview").innerHTML()).not.toBe(before);
  await page.locator("#makerGearCount").fill("2");
  await expect(page.locator("#part-count")).toHaveText("3");
  await page.locator("#preview").screenshot({ path: "/tmp/papeled-gears.png" });
  await page.locator("#maker-gear-base").selectOption("no");
  await expect(page.locator("#part-count")).toHaveText("2");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
