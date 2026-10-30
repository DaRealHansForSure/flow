import { describe, expect, it } from "vite-plus/test";

import { codeBlockDownloadFileName, codeBlockDownloadStem } from "./MarkdownCodeBlock.logic";

describe("codeBlockDownloadFileName", () => {
  it.each([
    ["sh", null, "snippet.sh"],
    ["bash", null, "snippet.sh"],
    ["zsh", null, "snippet.sh"],
    ["ts", null, "snippet.ts"],
    ["tsx", null, "snippet.tsx"],
    ["js", null, "snippet.js"],
    ["json", null, "snippet.json"],
    ["yaml", null, "snippet.yaml"],
    ["yml", null, "snippet.yml"],
    ["py", null, "snippet.py"],
    ["python", null, "snippet.py"],
    ["go", null, "snippet.go"],
    ["rust", null, "snippet.rs"],
    ["sql", null, "snippet.sql"],
    ["markdown", null, "snippet.md"],
    ["diff", null, "snippet.diff"],
    ["patch", null, "snippet.patch"],
    ["toml", null, "snippet.toml"],
    ["html", null, "snippet.html"],
    ["css", null, "snippet.css"],
    ["TypeScript", null, "snippet.ts"],
    ["dockerfile", null, "Dockerfile"],
    ["text", null, "snippet.txt"],
    ["unknown-language", null, "snippet.txt"],
    ["toString", null, "snippet.txt"],
    ["ts", "src/server/main.ts", "main.ts"],
    ["text", "C:\\work\\notes.md", "notes.md"],
    ["sh", "install", "install.sh"],
    ["text", "notes", "notes.txt"],
    ["dockerfile", "Dockerfile.dev", "Dockerfile.dev"],
    ["dockerfile", "Containerfile", "Containerfile"],
  ])("names a %s block titled %s as %s", (language, fenceTitle, expected) => {
    expect(codeBlockDownloadFileName(language, fenceTitle)).toBe(expected);
  });
});

describe("codeBlockDownloadStem", () => {
  const now = new Date(2026, 9, 30, 1, 2, 3);
  it.each([
    ["/projects/example", "example-20261030-010203"],
    ["/projects/example/", "example-20261030-010203"],
    ["C:\\work\\My Project", "My-Project-20261030-010203"],
    ["/projects/.hidden", "hidden-20261030-010203"],
    [undefined, "snippet-20261030-010203"],
  ])("names a block from %s as %s", (projectFolder, expected) => {
    expect(codeBlockDownloadStem(projectFolder, now)).toBe(expected);
  });

  it("uses the stem for blocks without a file name", () => {
    expect(codeBlockDownloadFileName("sh", null, "example-20261030-010203")).toBe(
      "example-20261030-010203.sh",
    );
    expect(codeBlockDownloadFileName("sh", "install", "example-20261030-010203")).toBe(
      "install.sh",
    );
  });
});
