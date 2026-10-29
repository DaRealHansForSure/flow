import { describe, expect, it } from "vite-plus/test";

import { codeBlockDownloadFileName } from "./MarkdownCodeBlock.logic";

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
