import { test, expect } from "./fixtures.js";

test("SVG-based variant exposes the measured frame, total height and fourteen pieces without replacing previous variants", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('[data-group="laser-boxes"]').click();
  await page.selectOption("#model-variation", "referencehinge");
  await expect(page.locator("#hinge-type")).toHaveValue("reference");
  await expect(page.locator("#width")).toHaveValue("106");
  await expect(page.locator("#depth")).toHaveValue("150");
  await expect(page.locator("#height")).toHaveValue("50");
  await expect(page.locator("#height-title")).toHaveText(
    "Altura total com tampa",
  );
  await expect(page.locator("#lidHeight")).toHaveValue("9");
  await expect(page.locator("#part-count")).toHaveText("14");
  await expect(page.locator("#reference-guide")).toBeVisible();
  await expect(page.locator("#hingeLidGap")).toBeVisible();
  await page.locator("#hingeLidGap").fill("1.5");
  await expect(page.locator("#lid-hint")).toContainText("107,5 mm");
  await expect(page.locator("#lid-hint")).toContainText("corpo 41 mm");
  await expect(page.locator("#parts-list")).toContainText("traseira curta");
  await expect(page.locator("#validation")).toBeHidden();
  await expect(page.locator("#lidOpening")).toHaveAttribute("max", "100");
  await page.locator("#toggle-lid").click();
  await expect(page.locator("#lidOpening")).toHaveValue("0");
  const closed = await page.locator("#preview").innerHTML();
  await page.locator("#toggle-lid").click();
  expect(await page.locator("#preview").innerHTML()).not.toBe(closed);
  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.locator("#model-variation")).toHaveValue("referencehinge");
  await expect(page.locator("#hinge-type")).toHaveValue("reference");
  await expect(page.locator("#hingeLidGap")).toHaveValue("1.5");
  await page.selectOption("#hinge-type", "profile");
  await expect(page.locator("#profile-guide")).toBeVisible();
  await page.selectOption("#hinge-type", "reference");
  await expect(page.locator("#reference-guide")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 820 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
