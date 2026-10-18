import { test as base, expect } from "@playwright/test";
// Browser tests use only local preview data, never the owner's live Supabase.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/platform-config.json", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ supabaseUrl: "", supabaseAnonKey: "" }),
      }),
    );
    await page.route("https://*.supabase.co/**", (route) => route.abort());
    await use(page);
  },
  context: async ({ context }, use) => {
    // Also cover extra pages opened by admin end-to-end workflows.
    await context.route("**/platform-config.json", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ supabaseUrl: "", supabaseAnonKey: "" }),
      }),
    );
    await context.route("https://*.supabase.co/**", (route) => route.abort());
    await use(context);
  },
});
export { expect };
