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

test("archive reserves private paths, rejects arbitrary uploads and exposes ready copies only to admins", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant insert,select,delete on storage.objects to anon,authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/001_platform.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/002_download_archive.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const admin = "11111111-1111-4111-8111-111111111111",
      id = "44444444-4444-4444-8444-444444444444",
      hash = "a".repeat(64);
    await db.exec(
      `insert into auth.users values('${admin}');insert into public.admin_users values('${admin}');set role anon;`,
    );
    await assert.rejects(db.query("select * from public.download_files"));
    await assert.rejects(
      db.query(
        "insert into storage.objects(bucket_id,name,metadata) values('maker-downloads','arbitrary/file.stl','{}')",
      ),
    );
    await db.query(
      `select public.reserve_download('${id}','original.stl','print','stl',123,'${hash}')`,
    );
    await assert.rejects(db.query(`select public.complete_download('${id}')`));
    await db.query(
      `insert into storage.objects(bucket_id,name,metadata) values('maker-downloads','${id}/file.stl','{"size":123}')`,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await db.query(`select public.complete_download('${id}')`);
    await assert.rejects(
      db.query(
        `insert into storage.objects(bucket_id,name,metadata) values('maker-downloads','${id}/file.stl','{}')`,
      ),
    );
    await db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${admin}';`,
    );
    assert.equal(
      (
        await db.query(
          "select * from public.download_files where state='ready'",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      1,
    );
    await db.exec(
      "delete from storage.objects;delete from public.download_files;",
    );
    assert.equal(
      (await db.query("select * from public.download_files")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test("a changed archive object fails the original checksum verification", async () => {
  const { getDownload, fileHash } = await import("../src/download-archive.js");
  const original = new Blob(["original data"]),
    changed = new Blob(["different data"]);
  const client = {
    storage: {
      from: () => ({ download: async () => ({ data: changed, error: null }) }),
    },
  };
  await assert.rejects(
    getDownload(client, false, {
      object_path: "id/file.stl",
      filename: "file.stl",
      sha256: await fileHash(original),
    }),
    /integridade/,
  );
});

test("60 days and all-time include every page of events and quotes without a database upgrade", async () => {
  const { getStatistics } = await import("../src/platform-data.js");
  const now = new Date().toISOString(),
    old = new Date(Date.now() - 120 * 86400000).toISOString();
  const events = Array.from({ length: 1205 }, (_, i) => ({
    id: i,
    kind: i < 1000 ? "page_view" : "download",
    model_id: "print",
    format: "stl",
    created_at: now,
  }));
  events.push({ id: 1205, kind: "page_view", created_at: old });
  const quotes = Array.from({ length: 1103 }, (_, i) => ({
    id: i,
    created_at: now,
  }));
  quotes.push({ id: 1103, created_at: old });
  const client = {
    from(table) {
      return {
        lower: null,
        upper: null,
        select() {
          return this;
        },
        order() {
          return this;
        },
        lte(_, value) {
          this.upper = value;
          return this;
        },
        gte(_, value) {
          this.lower = value;
          return this;
        },
        async range(start, end) {
          const rows = (table === "site_events" ? events : quotes).filter(
            (r) =>
              r.created_at <= this.upper &&
              (!this.lower || r.created_at >= this.lower),
          );
          return {
            data: rows.slice(start, Math.min(end + 1, start + 73)),
            error: null,
          };
        },
      };
    },
    rpc() {
      throw Error("Extra periods must work with the existing database.");
    },
  };
  const sixty = await getStatistics(client, 60);
  assert.equal(sixty.visits, 1000);
  assert.equal(sixty.downloads, 205);
  assert.equal(sixty.quotes, 1103);
  assert.equal(sixty.series.length, 60);
  const all = await getStatistics(client, 0);
  assert.equal(all.visits, 1001);
  assert.equal(all.quotes, 1104);
  assert.equal(all.series.length, 121);
  assert.equal(summarize([], [], 0).series.length, 1);
});
