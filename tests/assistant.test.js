import test from "node:test";
import assert from "node:assert/strict";
import {
  proposalsFrom,
  applyProposal,
  auditProducts,
} from "../src/assistant-actions.js";
import { defaults } from "../src/models.js";
import {
  planSchema,
  instructions,
} from "../supabase/functions/_shared/assistant-plan.js";
const create = {
  kind: "create_product",
  model: "toothbrush",
  title: "Porta-escovas canelado",
  description: "Organização para a bancada.",
  published: true,
  settings_patch: [
    { key: "width", value: 80 },
    { key: "depth", value: 80 },
    { key: "brushTexture", value: "ribbed" },
    { key: "brushCover", value: true },
  ],
};
const plan = (actions) => ({
  reply: "Confira as alterações propostas.",
  actions,
});
test("new products preserve real parameters and stay drafts until explicit publication", async () => {
  let data = { products: [], quotes: [] };
  const proposal = proposalsFrom(plan([create]), data)[0];
  assert.equal(data.products.length, 0);
  assert.equal(proposal.after.published, false);
  assert.equal(proposal.after.settings.brushCover, true);
  assert.equal(proposal.after.settings.width, 80);
  const state = {
    local: true,
    readLocal: () => structuredClone(data),
    writeLocal: (value) => (data = value),
  };
  await applyProposal(proposal, state);
  assert.equal(data.products.length, 1);
  await assert.rejects(applyProposal(proposal, state), /já foi aplicada/);
  const update = proposalsFrom(
    plan([
      {
        kind: "update_product",
        target_id: proposal.after.id,
        title: null,
        description: "Nova descrição clara.",
        model: null,
        settings_patch: [],
        published: null,
      },
    ]),
    data,
  )[0];
  assert.equal(update.after.published, false);
  assert.deepEqual(update.after.settings, proposal.after.settings);
  data.products[0].description = "Alteração feita por outro atendimento";
  await assert.rejects(applyProposal(update, state), /cadastro mudou/);
});
test("unavailable parameters, invalid geometry, colors and arbitrary commands cannot be applied", () => {
  for (const patch of [
    [{ key: "width", value: 1 }],
    [{ key: "finish", value: "coral" }],
    [{ key: "model", value: "lettering" }],
    [{ key: "execute_sql", value: "drop table" }],
    [
      { key: "width", value: 80 },
      { key: "width", value: 90 },
    ],
  ])
    assert.throws(() =>
      proposalsFrom(plan([{ ...create, settings_patch: patch }]), {
        products: [],
        quotes: [],
      }),
    );
  assert.throws(() =>
    proposalsFrom(plan([{ ...create, kind: "execute_code" }]), {
      products: [],
      quotes: [],
    }),
  );
  assert.throws(() =>
    proposalsFrom(plan([{ ...create, model: "new-unknown-mechanism" }]), {
      products: [],
      quotes: [],
    }),
  );
  assert.throws(() =>
    proposalsFrom(plan(Array(6).fill(create)), { products: [], quotes: [] }),
  );
});
test("quote actions only touch known requests and review identifies broken settings", async () => {
  let data = { products: [], quotes: [{ id: "request", status: "new" }] };
  const proposal = proposalsFrom(
    plan([
      { kind: "set_quote_status", target_id: "request", status: "contacted" },
    ]),
    data,
  )[0];
  await applyProposal(proposal, {
    local: true,
    readLocal: () => structuredClone(data),
    writeLocal: (v) => (data = v),
  });
  assert.equal(data.quotes[0].status, "contacted");
  assert.throws(() =>
    proposalsFrom(
      plan([
        { kind: "set_quote_status", target_id: "other", status: "closed" },
      ]),
      data,
    ),
  );
  const findings = auditProducts([
    {
      id: "product",
      title: "Produto",
      settings: { ...defaults("print"), height: 0 },
      description: "",
      image_url: null,
    },
  ]);
  assert.equal(findings.length, 3);
  assert.match(findings[0].message, /Configuração inválida/);
});
test("assistant protocol requires explicit bounded actions and contains no execution capability", () => {
  assert.equal(planSchema.properties.actions.maxItems, 5);
  assert.equal(planSchema.additionalProperties, false);
  assert.equal(planSchema.properties.actions.items.additionalProperties, false);
  assert.match(instructions, /Não proponha JavaScript, SQL/);
  assert.equal(
    planSchema.properties.actions.items.properties.kind.enum.includes(
      "execute_code",
    ),
    false,
  );
});
