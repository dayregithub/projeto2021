import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
const temp = await mkdtemp(join(tmpdir(), "papeled-archiver-"));
try {
  const executable = join(temp, "PapeledMakerArquivador.exe");
  execFileSync(
    process.env.PAPELED_GO_BIN || "go",
    [
      "build",
      "-trimpath",
      "-ldflags=-s -w -H windowsgui",
      "-o",
      executable,
      ".",
    ],
    {
      cwd: resolve("windows-archiver"),
      env: {
        ...process.env,
        GOOS: "windows",
        GOARCH: "amd64",
        CGO_ENABLED: "0",
      },
      stdio: "inherit",
    },
  );
  const bytes = await readFile(executable);
  const instructions = await readFile("windows-archiver/LEIA-ME.txt");
  const zip = zipSync({
    "PapeledMakerArquivador.exe": new Uint8Array(bytes),
    "LEIA-ME.txt": new Uint8Array(instructions),
  });
  await mkdir("public/downloads", { recursive: true });
  await writeFile("public/downloads/PapeledMaker-Arquivador-Windows.zip", zip);
  await writeFile(
    "public/downloads/PapeledMaker-Arquivador-Windows.sha256",
    `${createHash("sha256").update(zip).digest("hex")}  PapeledMaker-Arquivador-Windows.zip\n`,
  );
  console.log("Instalador Windows x64 atualizado em public/downloads/.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
