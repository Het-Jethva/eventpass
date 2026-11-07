import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const databaseTests = process.argv.includes("--database");
const tests = (await readdir(path.join(root, "tests")))
  .filter((name) =>
    databaseTests
      ? name.endsWith(".db-test.mjs")
      : /\.test\.(?:mjs|ts)$/.test(name),
  )
  .map((name) => path.join(root, "tests", name));
if (tests.length === 0) throw new Error("No behavioral tests found.");

const scratch = path.join(root, ".audit");
await mkdir(scratch, { recursive: true });
const output = await mkdtemp(path.join(scratch, "tests-"));
try {
  await build({
    entryPoints: tests,
    outdir: output,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    conditions: ["react-server"],
    outExtension: { ".js": ".mjs" },
    sourcemap: "inline",
    logLevel: "silent",
  });
  const files = (await readdir(output))
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => path.join(output, name));
  const result = spawnSync(
    process.execPath,
    ["--conditions=react-server", "--test", ...files],
    {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(output, { recursive: true, force: true });
}
