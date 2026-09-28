import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import process from "node:process";

/**
 * The source package Mozilla's reviewers get with every signed version
 * (`docs/distribution.md`, "Source code"): the committed tree at HEAD, with
 * `package-lock.json` and without `node_modules` or `dist`. Uncommitted
 * changes would not be in it, so a dirty tree is refused.
 */
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

if (git("status", "--porcelain").trim() !== "")
  throw new Error(
    "Commit or remove every change first: git status is not clean.",
  );

const { version } = JSON.parse(await readFile("package.json", "utf8"));
const output = `dist/joyfox-${version}-source.zip`;
await mkdir("dist", { recursive: true });
git(
  "archive",
  "--format=zip",
  `--prefix=joyfox-${version}/`,
  `--output=${output}`,
  "HEAD",
);
process.stdout.write(`${output}\n`);
