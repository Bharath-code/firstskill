import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipFiles } from "./skill-generator";

const files = {
  "acme/SKILL.md": "---\nname: acme\n---\n\n# Acme skill\n",
  "acme/references/auth.md": "# Auth\n\nUse a Bearer key.\n",
  "acme/INSTALL.md": "unzip acme-skill-pack.zip -d ~/.claude/skills/\n",
};

function unzipAvailable(): boolean {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

test("zip round-trips through the system unzip", { skip: !unzipAvailable() }, () => {
  const dir = mkdtempSync(join(tmpdir(), "firstskill-zip-"));
  const zipPath = join(dir, "pack.zip");
  writeFileSync(zipPath, zipFiles(files));

  // -t verifies every entry's CRC, which is where hand-rolled zips go wrong.
  execFileSync("unzip", ["-tqq", zipPath]);
  execFileSync("unzip", ["-qq", zipPath, "-d", join(dir, "out")]);

  for (const [path, content] of Object.entries(files)) {
    assert.equal(readFileSync(join(dir, "out", path), "utf8"), content);
  }
});

test("zip has the local, central and end-of-directory signatures", () => {
  const zip = Buffer.from(zipFiles(files));
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 22 + 10), Object.keys(files).length);
});

test("an empty manifest still produces a valid empty archive", () => {
  const zip = Buffer.from(zipFiles({}));
  assert.equal(zip.length, 22);
  assert.equal(zip.readUInt32LE(0), 0x06054b50);
});
