import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { summarize } from "../src/platform-data.js";

test("anonymous writes are bounded and quotes/drafts/metrics remain private; admin dashboard uses all rows", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/001_platform.sql", import.meta.url),
        "utf8",
      ),
    );
    const admin = "11111111-1111-4111-8111-111111111111",
      other = "22222222-2222-4222-8222-222222222222";
    await db.exec(
      `insert into auth.users values('${admin}'),('${other}'); insert into public.admin_users values('${admin}'); insert into public.catalog_products(title,description,settings,published) values('Publicado','Produto público','{}',true),('Rascunho','Privado','{}',false); set role anon;`,
    );
    assert.equal(
      (await db.query("select title from public.catalog_products")).rows.length,
      1,
    );
    await assert.rejects(db.query("select * from public.quote_requests"));
    await assert.rejects(db.query("select * from public.site_events"));
    await assert.rejects(
      db.query(
        "insert into public.catalog_products(title,description,settings) values('Ataque','Teste','{}')",
      ),
    );
    await assert.rejects(db.query("select public.admin_dashboard(30)"));
    await db.query("select public.record_site_event('download','open','svg')");
    await assert.rejects(
      db.query(
        "select public.record_site_event('download','private@example.com','svg')",
      ),
    );
    await assert.rejects(
      db.query("select public.record_site_event('secret','open','svg')"),
    );
    await db.query(
      "select public.submit_quote('33333333-3333-4333-8333-333333333333','Cliente','contato@example.com','2 peças','{}')",
    );
    await assert.rejects(
      db.query(
        "select public.submit_quote('44444444-4444-4444-8444-444444444444','Cliente','contato',repeat('x',2001),'{}')",
      ),
    );
    await db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${other}';`,
    );
    assert.equal(
      (await db.query("select * from public.quote_requests")).rows.length,
      0,
    );
    await assert.rejects(db.query("select public.require_admin()"));
    await db.exec(
      `reset role; insert into public.site_events(kind) select 'page_view' from generate_series(1,1205); set role authenticated;set request.jwt.claim.sub='${admin}';`,
    );
    assert.equal(
      (await db.query("select * from public.quote_requests")).rows.length,
      1,
    );
    const stats = (await db.query("select public.admin_dashboard(30) as stats"))
      .rows[0].stats;
    assert.equal(stats.visits, 1205);
    assert.equal(stats.downloads, 1);
    assert.equal(stats.quotes, 1);
    assert.equal(stats.series.length, 30);
    assert.equal(stats.top[0].model, "open");
    await db.query("update public.quote_requests set status='contacted'");
    await assert.rejects(
      db.query("update public.quote_requests set contact='changed'"),
    );
  } finally {
    await db.close();
  }
});

test("local dashboard excludes old events and keeps downloads separate from visits", () => {
  const now = new Date().toISOString(),
    old = "2020-01-01T00:00:00Z";
  const stats = summarize(
    [
      { kind: "page_view", created_at: now },
      { kind: "model_view", created_at: now },
      { kind: "download", model_id: "print", format: "stl", created_at: now },
      { kind: "page_view", created_at: old },
    ],
    [{ created_at: now }],
    7,
  );
  assert.equal(stats.visits, 1);
  assert.equal(stats.views, 1);
  assert.equal(stats.downloads, 1);
  assert.equal(stats.quotes, 1);
  assert.equal(stats.series.length, 7);
  assert.equal(stats.top[0].format, "stl");
});
