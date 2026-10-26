import { test, expect } from "./fixtures.js";
import { readFile } from "node:fs/promises";
test("educational laser catalog offers three editable models and preserves figures and material thickness", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.selectOption("#use-filter", "education");
  await expect(page.locator(".model-card")).toHaveCount(1);
  await page.locator('[data-group="laser-education"]').click();
  await expect(page.locator("#model-variation option")).toHaveCount(3);
  await expect(page.locator("#toy-options")).toBeVisible();
  await expect(page.locator("#construction-section")).toBeHidden();
  await expect(page.locator("#height")).toBeDisabled();
  await expect(page.locator("#height")).toHaveValue("6");
  await expect(page.locator("#project-stats")).toContainText("6 peças");
  await page.selectOption("#toy-theme", "butterfly");
  await page.locator("#toyCols").fill("4");
  await page.locator("#toyRows").fill("4");
  await expect(page.locator("#part-count")).toHaveText("18");
  await page.locator("#thickness").fill("4");
  await expect(page.locator("#height")).toHaveValue("8");
  const seated = await page.locator("#preview").innerHTML();
  await page.locator("#toyLift").fill("30");
  expect(await page.locator("#preview").innerHTML()).not.toBe(seated);
  await expect(page.locator("#assembly-text")).toContainText("16 peças soltas");
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator("#toy-theme")).toHaveValue("butterfly");
  await expect(page.locator("#toyCols")).toHaveValue("4");
  await expect(page.locator("#height")).toHaveValue("8");
  await page.locator("#toyCols").fill("2");
  await page.locator("#toyRows").fill("2");
  await page
    .locator("#preview")
    .screenshot({ path: "/tmp/papeled-picture-puzzle.png" });
  await page.locator("#export-project").click();
  const downloaded = page.waitForEvent("download");
  await page.locator('[data-export="svg"]').click();
  const svg = await readFile(await (await downloaded).path(), "utf8");
  expect(svg).toContain("Figura · linha");
  expect(svg).toContain('id="ENGRAVE"');
  await page.locator("#export-dialog [data-close]").click();
  await page.selectOption("#model-variation", "shapepuzzle");
  await expect(page.locator("#toy-picture-controls")).toBeHidden();
  await page.selectOption("#toy-shape-count", "6");
  await expect(page.locator("#part-count")).toHaveText("8");
  await expect(page.locator("#parts-list")).toContainText("Elipse");
  await page
    .locator("#preview")
    .screenshot({ path: "/tmp/papeled-shape-puzzle.png" });
  await page.selectOption("#model-variation", "tangram");
  await expect(page.locator("#part-count")).toHaveText("9");
  await expect(page.locator("#parts-list")).toContainText("Paralelogramo");
  await page.locator("#toyLift").fill("10");
  await page
    .locator("#preview")
    .screenshot({ path: "/tmp/papeled-tangram.png" });
  await expect(page.locator("#validation")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
