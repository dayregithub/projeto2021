import { test, expect } from "./fixtures.js";
import { readFile } from "node:fs/promises";

async function mockAuth(page, { user = true, admin = false, expires = false } = {}) {
  await page.addInitScript(({ user, admin, expires }) => {
    let listener;
    window.authCalls = [];
    window.__authClient = {
      auth: {
        onAuthStateChange(callback) { listener = callback; },
        async getSession() { return { data: { session: { user: { id: "stored-user" } } } }; },
        async getUser() {
          window.authCalls.push("validate-user");
          if (expires) listener("SIGNED_OUT", null);
          return { data: { user: user ? { id: "verified-user" } : null } };
        },
        async signOut() { return { error: null }; },
      },
      async rpc(name) {
        window.authCalls.push(name);
        return { data: admin, error: null };
      },
    };
  }, { user, admin, expires });
  const source = await readFile(new URL("../../src/platform-data.js", import.meta.url), "utf8");
  await page.route("**/src/platform-data.js", route => route.fulfill({
    contentType: "text/javascript",
    body: source.replace('import { createClient } from "@supabase/supabase-js";', "").replace("export function connection() {", "export function connection() { return Promise.resolve(window.__authClient); }\nfunction unusedConnection() {"),
  }));
}

test("stored session without a verified user cannot open the admin route", async ({ page }) => {
  await mockAuth(page, { user: false });
  await page.goto("/admin.html");
  await expect(page.locator("#login")).toBeVisible();
  await expect(page.locator("#notice")).toContainText("validar o acesso");
  await expect(page.locator("#workspace")).toBeHidden();
  expect(await page.evaluate(() => window.authCalls)).toEqual(["validate-user"]);
});

test("a verified non-admin cannot open the admin route or use local preview", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/admin.html");
  await expect(page.locator("#notice")).toContainText("validar o acesso");
  await page.evaluate(() => document.getElementById("local-preview").click());
  await expect(page.locator("#workspace")).toBeHidden();
  expect(await page.evaluate(() => window.authCalls)).toEqual(["validate-user", "require_admin"]);
});

test("sign-out during access validation keeps the workspace locked", async ({ page }) => {
  await mockAuth(page, { admin: true, expires: true });
  await page.goto("/admin.html");
  await expect(page.locator("#notice")).toContainText("sessão terminou");
  await expect(page.locator("#workspace")).toBeHidden();
  await expect(page.locator("#login")).toBeVisible();
});
