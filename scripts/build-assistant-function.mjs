import { MODELS, defaults } from "../src/models.js";
import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
await writeFile(
  new URL("supabase/functions/_shared/assistant-models.json", root),
  JSON.stringify(
    MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      description: m.description,
      defaults: defaults(m.id),
    })),
    null,
    2,
  ) + "\n",
);
const models = await readFile(
  new URL("supabase/functions/_shared/assistant-models.json", root),
  "utf8",
);
const plan = await readFile(
  new URL("supabase/functions/_shared/assistant-plan.js", root),
  "utf8",
);
const source = await readFile(
  new URL("supabase/functions/maker-assistant/index.ts", root),
  "utf8",
);
// Single-file source for the Supabase dashboard editor. No credentials embedded.
const handler = source
  .replace(/import models from [\s\S]*?;\n/, "")
  .replace(
    /import \{[\s\S]*?\} from "\.\.\/_shared\/assistant-plan\.js";\n/,
    "",
  );
await writeFile(
  new URL("public/maker-assistant.ts", root),
  `// Paste in maker-assistant/index.ts in the Supabase dashboard.\nconst models=${models};\n${plan}\n${handler}`,
);
