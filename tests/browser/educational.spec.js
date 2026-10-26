import { test, expect } from "./fixtures.js";
import { readFile } from "node:fs/promises";
test("educational laser catalog offers three editable models and preserves figures and material thickness", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('[data-filter="laser"]').click();
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

test("cartoon figures expose real double borders, fill mode and traditional or straight jigsaw pieces", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('[data-group="laser-education"]').click();
  await expect(page.locator("#toy-piece-style")).toHaveValue("jigsaw");
  await expect(page.locator("#toy-engraving")).toHaveValue("double");
  await expect(page.locator("#toyBorderWidth")).toHaveValue("1.2");
  const initial = await page.locator("#toy-art-preview").getAttribute("src");
  await page.locator("#toyBorderWidth").fill("2");
  expect(await page.locator("#toy-art-preview").getAttribute("src")).not.toBe(
    initial,
  );
  await page.locator("#toy-engraving").selectOption("fill");
  await page.locator("#toyLift").fill("8");
  for (const toy of ["turtle", "butterfly", "fish"]) {
    await page.locator("#toy-theme").selectOption(toy);
    await expect
      .poll(() =>
        page
          .locator("#toy-art-preview")
          .evaluate((img) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
    await page
      .locator(".toy-art-card")
      .screenshot({ path: `/tmp/papeled-cartoon-${toy}.png` });
  }
  await page.locator("#toy-theme").selectOption("butterfly");
  await page
    .locator("#preview")
    .screenshot({ path: "/tmp/papeled-cartoon-jigsaw.png" });
  const jigsaw = await page.locator("#preview").innerHTML();
  await page.locator("#toy-piece-style").selectOption("straight");
  expect(await page.locator("#preview").innerHTML()).not.toBe(jigsaw);
  await page.locator("#toy-piece-style").selectOption("jigsaw");
  await page.locator("#export-project").click();
  const file = page.waitForEvent("download");
  await page.locator('[data-export="svg"]').click();
  const svg = await readFile(await (await file).path(), "utf8");
  const layers = await page.evaluate((svg) => {
    const d = new DOMParser().parseFromString(svg, "image/svg+xml");
    return {
      errors: d.querySelectorAll("parsererror").length,
      fill: d.querySelectorAll("#ENGRAVE_FILL path").length,
      closed: [...d.querySelectorAll("#ENGRAVE_FILL path")].every((p) =>
        p.getAttribute("d").endsWith("Z"),
      ),
      cut: d.querySelectorAll("#CUT path").length,
    };
  }, svg);
  expect(layers.errors).toBe(0);
  expect(layers.fill).toBeGreaterThan(5);
  expect(layers.closed).toBe(true);
  expect(layers.cut).toBeGreaterThan(7);
  await page.locator("#export-dialog [data-close]").click();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator("#toy-piece-style")).toHaveValue("jigsaw");
  await expect(page.locator("#toy-engraving")).toHaveValue("fill");
  await expect(page.locator("#toyBorderWidth")).toHaveValue("2");
  await page.locator("#toy-engraving").selectOption("line");
  await expect(page.locator("#toy-border-control")).toBeHidden();
  await page.locator("#toy-engraving").selectOption("double");
  await page
    .locator(".toy-art-card")
    .screenshot({ path: "/tmp/papeled-cartoon-double-border.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("blank adhesive puzzles export cut-only files and the mounted registration layout without hidden guide engraving", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-group="laser-education"]').click();
  await page.selectOption("#toy-theme", "none");
  await expect(page.locator("#toy-engraving")).toBeHidden();
  await expect(page.locator("#toy-guide")).toBeHidden();
  await expect(page.locator("#toy-image-controls")).toBeHidden();
  await expect(page.locator("#toy-blank-note")).toContainText("216 × 156 mm");
  await expect(page.locator("#summary-metrics")).toContainText(
    "Somente corte a laser",
  );
  await page.locator("#export-project").click();
  const normal = page.waitForEvent("download");
  await page.locator('[data-export="svg"]').click();
  expect(await readFile(await (await normal).path(), "utf8")).not.toContain(
    "ENGRAVE",
  );
  const mounted = page.waitForEvent("download");
  await page.locator('[data-export="sticker-svg"]').click();
  const svg = await readFile(await (await mounted).path(), "utf8");
  expect(svg).toContain('width="216mm" height="156mm"');
  expect(svg).not.toContain("ENGRAVE");
  await page.locator("#export-dialog [data-close]").click();
  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.locator("#toy-theme")).toHaveValue("none");
  await expect(page.locator("#toy-engraving")).toBeHidden();
  await page.selectOption("#toy-theme", "turtle");
  await expect(page.locator("#toy-engraving")).toBeVisible();
});

test("ten cartoon choices can be resized, dragged, moved by keyboard, reset and restored after reload", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('[data-group="laser-education"]').click();
  await expect(page.locator("#toy-theme option")).toHaveCount(11);
  await page.locator("#toy-engraving").selectOption("fill");
  const cards = [];
  for (const value of [
    "fish",
    "turtle",
    "butterfly",
    "owl",
    "cat",
    "dog",
    "elephant",
    "lion",
    "rabbit",
    "dinosaur",
  ]) {
    await page.selectOption("#toy-theme", value);
    await expect
      .poll(() =>
        page
          .locator("#toy-art-preview")
          .evaluate((e) => e.complete && e.naturalWidth > 0),
      )
      .toBe(true);
    cards.push({
      label: await page.locator("#toy-theme option:checked").textContent(),
      src: await page.locator("#toy-art-preview").getAttribute("src"),
    });
  }
  await page.selectOption("#toy-theme", "owl");
  const initial = await page.locator("#toy-art-preview").getAttribute("src");
  await page.locator("#toyImageScale").fill("140");
  await page.locator("#toyImageX").fill("20");
  await page.locator("#toyImageY").fill("-15");
  await expect(page.locator("#toy-image-scale-value")).toHaveText("140%");
  expect(await page.locator("#toy-art-preview").getAttribute("src")).not.toBe(
    initial,
  );
  await page.locator("#toy-art-preview").scrollIntoViewIfNeeded();
  const box = await page.locator("#toy-art-preview").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 20,
    box.y + box.height / 2 + 10,
    { steps: 4 },
  );
  await page.mouse.up();
  expect(Number(await page.locator("#toyImageX").inputValue())).toBeGreaterThan(
    20,
  );
  await page.locator("#toy-art-preview").focus();
  await page.keyboard.press("ArrowLeft");
  const savedX = await page.locator("#toyImageX").inputValue();
  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.locator("#toy-theme")).toHaveValue("owl");
  await expect(page.locator("#toyImageScale")).toHaveValue("140");
  await expect(page.locator("#toyImageX")).toHaveValue(savedX);
  await page.locator("#toy-image-reset").click();
  await expect(page.locator("#toyImageScale")).toHaveValue("100");
  await expect(page.locator("#toyImageX")).toHaveValue("0");
  await expect(page.locator("#toyImageY")).toHaveValue("0");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  const gallery = await page.context().newPage();
  await gallery.setViewportSize({ width: 1000, height: 620 });
  await gallery.setContent(
    `<html lang="pt-BR"><head><meta charset="utf-8"><style>body{font-family:Arial;background:#f8f4f0;color:#684b43;margin:24px}h1{font-size:26px;margin:0 0 8px}p{margin:0 0 20px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}figure{margin:0;border:1px solid #dfd1c8;background:white;border-radius:12px;padding:12px}img{width:100%;height:190px}figcaption{text-align:center;font-weight:bold;margin-top:10px}</style></head><body><h1>Papeled Maker · figuras para quebra-cabeça</h1><p>Dez desenhos vetoriais · borda dupla e preenchimento ajustáveis</p><div class="grid">${cards.map((c) => `<figure><img src="${c.src}"><figcaption>${c.label}</figcaption></figure>`).join("")}</div></body></html>`,
  );
  await gallery.locator("img").last().waitFor();
  await gallery.evaluate(() =>
    Promise.all([...document.images].map((i) => i.decode())),
  );
  await gallery
    .locator("body")
    .screenshot({ path: "/tmp/papeled-10-figures.png" });
  await gallery.close();
});
