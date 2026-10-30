// Prints the CHANGELOG.md section of one version, the release text of its GitHub releases.
// Usage: node scripts/fork/changelog-section.mjs X.Y.Z [CHANGELOG.md]
import * as NodeFS from "node:fs";

const [version, changelogPath = "CHANGELOG.md"] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  throw Error("Usage: changelog-section.mjs X.Y.Z [CHANGELOG.md]");
}

const lines = NodeFS.readFileSync(changelogPath, "utf8").split("\n");
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
if (start < 0) {
  throw Error(`CHANGELOG.md has no section for ${version}.`);
}
const length = lines.slice(start + 1).findIndex((line) => line.startsWith("## ["));
const section = lines.slice(start + 1, length < 0 ? undefined : start + 1 + length);
const text = section.join("\n").trim();
if (text === "") {
  throw Error(`The CHANGELOG.md section for ${version} is empty.`);
}
process.stdout.write(`${text}\n`);
