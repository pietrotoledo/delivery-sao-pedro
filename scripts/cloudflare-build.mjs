import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
if (!databaseId || !/^[a-f0-9-]{36}$/i.test(databaseId)) {
  console.error("Defina CLOUDFLARE_D1_DATABASE_ID com o ID do banco D1 antes do build.");
  process.exit(1);
}

const script = fileURLToPath(new URL("./run-framework.mjs", import.meta.url));
const result = spawnSync(process.execPath, [script, "build"], {
  env: { ...process.env, CLOUDFLARE_DIRECT: "1" },
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
