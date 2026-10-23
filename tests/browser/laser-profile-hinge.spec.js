import { test, expect } from "./fixtures.js";

test("profile-aligned laser hinge previews open and closed, preserves settings and supports 2D cutting view", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator('[data-group="laser-boxes"]').click();
  await page.selectOption("#model-variation", "compacthinge");
  await page.selectOption("#hinge-type", "profile");
  await expect(page.locator("#validation")).toBeHidden();
  await expect(page.locator("#profile-guide")).toBeVisible();
  await expect(page.locator("#part-count")).toHaveText("13");
  await expect(page.locator("#parts-list")).toContainText("Braço alinhado");
  await expect(page.locator("#lidOpening")).toHaveAttribute("max", "100");
  await page.locator("#lidOpening").fill("0");
  const closed = await page.locator("#preview").innerHTML();
  await page
    .locator("#preview")
    .screenshot({ path: "/tmp/papeled-profile-hinge-closed.png" });
  await page.locator("#toggle-lid").click();
  await expect(page.locator("#lidOpening")).toHaveValue("100");
  expect(await page.locator("#preview").innerHTML()).not.toBe(closed);
  await page
    .locator("#preview")
    .screenshot({ path: "/tmp/papeled-profile-hinge-open.png" });
  await page.locator('[data-view="2d"]').click();
  await expect(page.locator("#preview svg")).toBeVisible();
  await page.reload();
  await expect(page.locator("#hinge-type")).toHaveValue("profile");
  await expect(page.locator("#validation")).toBeHidden();
  expect(errors).toEqual([]);
});
