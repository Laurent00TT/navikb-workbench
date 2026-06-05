#!/usr/bin/env node
/**
 * UI-language guard: fail the build if any CJK (Chinese / Japanese / Korean)
 * characters sneak into the source. The workbench UI is English-only; this
 * stops a stray CJK string from regressing in. Legitimate typographic symbols
 * (middle dot, ellipsis, em dash, warning sign) are NOT CJK and pass fine — we
 * only reject the CJK-punctuation, ideograph, and fullwidth Unicode ranges.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";

// Checked numerically (by code point) so this guard file itself stays ASCII:
//   3000-303F  CJK punctuation
//   3400-9FFF  CJK ideographs (ext-A + main)
//   FF00-FFEF  fullwidth / halfwidth forms
function isCJK(cp) {
  return (
    (cp >= 0x3000 && cp <= 0x303f) ||
    (cp >= 0x3400 && cp <= 0x9fff) ||
    (cp >= 0xff00 && cp <= 0xffef)
  );
}

let offenders = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) scan(p);
  }
}

function scan(file) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const ch of line) {
      if (isCJK(ch.codePointAt(0))) {
        offenders++;
        console.error(`  ${file}:${i + 1}  CJK ${JSON.stringify(ch)} -> ${line.trim().slice(0, 90)}`);
        break;
      }
    }
  });
}

walk(ROOT);

if (offenders > 0) {
  console.error(`\n${offenders} line(s) contain CJK characters. The workbench UI is English-only.`);
  process.exit(1);
}
console.log("OK: no CJK characters in web/src");
