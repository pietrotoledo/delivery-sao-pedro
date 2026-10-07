import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || "d1da0187-8fb6-47de-9cfa-c72f50b2755b";
if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(databaseId)) {
  console.error("CLOUDFLARE_D1_DATABASE_ID deve conter um ID de banco D1 válido.");
  process.exit(1);
}

const script = fileURLToPath(new URL("./run-framework.mjs", import.meta.url));
const result = spawnSync(process.execPath, [script, "build"], {
  env: { ...process.env, CLOUDFLARE_DIRECT: "1", CLOUDFLARE_D1_DATABASE_ID: databaseId },
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
