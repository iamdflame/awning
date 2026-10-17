#!/usr/bin/env node
// Copies the company documents (repo-root docs/ and SECURITY.md) into web/content/,
// because Vercel builds only web/. web/content/ is committed; docs/ stays the source of truth.
//
//   node scripts/sync-content.mjs           copy (run after editing anything in docs/)
//   node scripts/sync-content.mjs --check   exit 1 and list the files that differ (tests/CI)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(web, "..");
const out = path.join(web, "content");

/** Repo-relative sources; each lands at web/content/<same path>. */
export const SOURCES = [
  "docs/legal/terms.md",
  "docs/legal/privacy.md",
  "docs/SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/API.md",
  "docs/PLUGIN.md",
  "docs/THREAT_MODEL.md",
  "docs/BUSINESS.md",
  "docs/ROADMAP.md",
  "SECURITY.md",
];

// Line endings follow the checkout (core.autocrlf), so compare and write with LF.
const lf = (s) => s.replace(/\r\n/g, "\n");

function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p).split(path.sep).join("/")];
  });
}

export function drift() {
  const problems = [];
  for (const rel of SOURCES) {
    const src = path.join(repo, rel);
    const dst = path.join(out, rel);
    if (!existsSync(src)) problems.push(`${rel}: missing in the repo`);
    else if (!existsSync(dst)) problems.push(`web/content/${rel}: missing (run node scripts/sync-content.mjs)`);
    else if (lf(readFileSync(src, "utf8")) !== lf(readFileSync(dst, "utf8"))) problems.push(`web/content/${rel}: differs from ${rel}`);
  }
  for (const rel of listFiles(out)) {
    if (!SOURCES.includes(rel)) problems.push(`web/content/${rel}: not a synced document (delete it or add it to SOURCES)`);
  }
  return problems;
}

function sync() {
  for (const rel of listFiles(out)) if (!SOURCES.includes(rel)) rmSync(path.join(out, rel));
  for (const rel of SOURCES) {
    const dst = path.join(out, rel);
    mkdirSync(path.dirname(dst), { recursive: true });
    writeFileSync(dst, lf(readFileSync(path.join(repo, rel), "utf8")));
  }
  console.log(`synced ${SOURCES.length} documents into web/content/`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(path.join(repo, "docs"))) {
    console.error("docs/ not found next to web/: run this from a full checkout of the repository");
    process.exit(2);
  }
  if (process.argv.includes("--check")) {
    const problems = drift();
    if (problems.length) {
      console.error(`web/content/ is out of date with docs/:\n  ${problems.join("\n  ")}\nRun: node scripts/sync-content.mjs`);
      process.exit(1);
    }
    console.log("web/content/ matches docs/");
  } else {
    sync();
  }
}
