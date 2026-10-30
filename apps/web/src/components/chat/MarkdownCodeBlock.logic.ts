import { Children, isValidElement, type ReactNode } from "react";
import type { ExtraProps as ReactMarkdownExtraProps } from "react-markdown";

import { fnv1a32, type DiffThemeName } from "../../lib/diffRendering";

const CODE_FENCE_LANGUAGE_REGEX = /(?:^|\s)language-([^\s]+)/;

export function extractFenceLanguage(className: string | undefined): string {
  const match = className?.match(CODE_FENCE_LANGUAGE_REGEX);
  const raw = match?.[1] ?? "text";
  // Shiki doesn't bundle a gitignore grammar; ini is a close match.
  return raw === "gitignore" ? "ini" : raw;
}

const FENCE_TITLE_ATTR_REGEX = /(?:^|\s)(?:title|file(?:name)?)=(?:"([^"]+)"|'([^']+)'|(\S+))/i;
const FENCE_FILENAME_TOKEN_REGEX = /^[\w@][\w@./-]*\.[A-Za-z0-9]+$/;

export function extractFenceTitle(meta: string | undefined): string | null {
  if (!meta) return null;
  const attrMatch = FENCE_TITLE_ATTR_REGEX.exec(meta);
  const attrTitle = attrMatch?.[1] ?? attrMatch?.[2] ?? attrMatch?.[3];
  if (attrTitle) return attrTitle;
  return meta.split(/\s+/).find((candidate) => FENCE_FILENAME_TOKEN_REGEX.test(candidate)) ?? null;
}

const DOWNLOAD_FILE_STEM = "snippet";
const DOWNLOAD_FALLBACK_EXTENSION = "txt";

// Languages whose files go by a fixed name rather than an extension.
const DOWNLOAD_FILE_NAMES_BY_LANGUAGE = new Map([
  ["dockerfile", "Dockerfile"],
  ["makefile", "Makefile"],
]);

const DOWNLOAD_EXTENSIONS_BY_LANGUAGE = new Map([
  ["sh", "sh"],
  ["bash", "sh"],
  ["zsh", "sh"],
  ["shell", "sh"],
  ["shellscript", "sh"],
  ["fish", "fish"],
  ["powershell", "ps1"],
  ["pwsh", "ps1"],
  ["ts", "ts"],
  ["typescript", "ts"],
  ["tsx", "tsx"],
  ["js", "js"],
  ["javascript", "js"],
  ["jsx", "jsx"],
  ["json", "json"],
  ["jsonc", "json"],
  ["yaml", "yaml"],
  ["yml", "yml"],
  ["py", "py"],
  ["python", "py"],
  ["go", "go"],
  ["rs", "rs"],
  ["rust", "rs"],
  ["sql", "sql"],
  ["md", "md"],
  ["markdown", "md"],
  ["diff", "diff"],
  ["patch", "patch"],
  ["toml", "toml"],
  ["ini", "ini"],
  ["xml", "xml"],
  ["html", "html"],
  ["css", "css"],
  ["scss", "scss"],
  ["mermaid", "mmd"],
]);

/** `<project folder>-<YYYYMMDD>-<HHMMSS>` in local time, or `snippet-...` outside a project. */
export function codeBlockDownloadStem(projectFolder: string | undefined, now: Date): string {
  const folder = projectFolder?.split(/[\\/]/).findLast((segment) => segment.length > 0);
  const safeFolder = folder?.replace(/[^\w.-]+/g, "-").replace(/^[.-]+/, "");
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${safeFolder || DOWNLOAD_FILE_STEM}-${date}-${time}`;
}

export function codeBlockDownloadFileName(
  language: string,
  fenceTitle: string | null,
  stem: string = DOWNLOAD_FILE_STEM,
): string {
  const normalizedLanguage = language.toLowerCase();
  const fixedFileName = DOWNLOAD_FILE_NAMES_BY_LANGUAGE.get(normalizedLanguage);
  const extension =
    DOWNLOAD_EXTENSIONS_BY_LANGUAGE.get(normalizedLanguage) ?? DOWNLOAD_FALLBACK_EXTENSION;
  const titleFileName = fenceTitle?.split(/[\\/]/).at(-1)?.trim();

  if (titleFileName) {
    const titleHasExtension = titleFileName.includes(".");
    if (titleHasExtension || fixedFileName !== undefined) {
      return titleFileName;
    }
    return `${titleFileName}.${extension}`;
  }
  return fixedFileName ?? `${stem}.${extension}`;
}

export function extractPreCodeMeta(node: unknown): string | undefined {
  const children = (
    node as
      | {
          children?: Array<{
            type?: string;
            tagName?: string;
            data?: { meta?: unknown };
            properties?: { dataCodeMeta?: unknown };
          }>;
        }
      | undefined
  )?.children;
  const codeNode = children?.find((child) => child?.type === "element" && child.tagName === "code");
  const meta = codeNode?.properties?.dataCodeMeta ?? codeNode?.data?.meta;
  return typeof meta === "string" && meta.trim().length > 0 ? meta.trim() : undefined;
}

export function isClosedCodeFence(
  node: ReactMarkdownExtraProps["node"],
  text: string,
  code: string,
): boolean {
  const start = node?.position?.start.offset;
  const end = node?.position?.end.offset;
  if (start === undefined || end === undefined) return false;
  const source = text.slice(start, end);
  const opening = /^(?:`{3,}|~{3,})/.exec(source)?.[0];
  // One class for the blockquote prefix: nested quantifiers here backtrack
  // exponentially on code lines that start with many `> ` markers.
  const closing = /(?:^|\n)[ \t>]*(`{3,}|~{3,})[ \t\r]*$/.exec(source)?.[1];
  return (
    opening !== undefined &&
    closing !== undefined &&
    opening[0] === closing[0] &&
    closing.length >= opening.length &&
    // Only a real closer is omitted from parsed code. A CRLF stream cut after
    // CR must not count as an extra source line.
    source.replace(/\r$/, "").split(/\r\n|\r|\n/).length > code.split(/\r\n|\r|\n/).length
  );
}

export function nodeToPlainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((child) => nodeToPlainText(child)).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeToPlainText(node.props.children);
  }
  return "";
}

export function extractCodeBlock(
  children: ReactNode,
): { className: string | undefined; code: string } | null {
  const childNodes = Children.toArray(children);
  if (childNodes.length !== 1) {
    return null;
  }

  const onlyChild = childNodes[0];
  if (
    !isValidElement<{ className?: string; children?: ReactNode; node?: { tagName?: string } }>(
      onlyChild,
    )
  ) {
    return null;
  }
  // With a custom `code` component the child's type is that component, not
  // the "code" tag — the hast node react-markdown attaches still names it.
  if (onlyChild.type !== "code" && onlyChild.props.node?.tagName !== "code") {
    return null;
  }

  return {
    className: onlyChild.props.className,
    code: nodeToPlainText(onlyChild.props.children),
  };
}

export function createHighlightCacheKey(
  code: string,
  language: string,
  themeName: DiffThemeName,
): string {
  return `${fnv1a32(code).toString(36)}:${code.length}:${language}:${themeName}`;
}

export function estimateHighlightedSize(html: string, code: string): number {
  return Math.max(html.length * 2, code.length * 3);
}
