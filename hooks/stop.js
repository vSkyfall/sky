#!/usr/bin/env node
// Stop: bu turda Claude'un Edit/Write/MultiEdit ile eklediği satırlarda debug kalıntısı arar; bulursa
// bir kez Claude'dan temizlemesini veya bilinçli olduğunu belirtmesini ister. Turun sınırı oturum
// kaydındaki (transcript) son kullanıcı mesajıdır; daha önceki veya kullanıcının kendi değişikliklerine bakmaz.
const fs = require("fs");
const path = require("path");
const { readInput, disabled, emit } = require("./lib");

if (disabled("stop")) process.exit(0);
const input = readInput();
if (input.stop_hook_active || !input.transcript_path) process.exit(0);
const cwd = input.cwd || process.cwd();

let entries;
try {
  entries = fs.readFileSync(input.transcript_path, "utf8").split("\n");
} catch {
  process.exit(0);
}

// Son kullanıcı mesajından sonraki dosya düzenleme çağrılarını topla.
const isPrompt = (c) =>
  typeof c === "string" || (Array.isArray(c) && c.some((x) => x.type === "text") && !c.some((x) => x.type === "tool_result"));
let edits = [];
for (const line of entries) {
  let e;
  try {
    e = JSON.parse(line);
  } catch {
    continue;
  }
  if (e.isSidechain || !e.message) continue;
  const c = e.message.content;
  if (e.type === "user" && !e.isMeta && isPrompt(c)) edits = [];
  else if (e.type === "assistant" && Array.isArray(c))
    for (const x of c) if (x.type === "tool_use" && /^(Edit|Write|MultiEdit)$/.test(x.name) && x.input) edits.push(x.input);
}
if (!edits.length) process.exit(0);

// Dosya başına eklenen satırlar: yeni metinde olup eski metinde olmayanlar.
const added = new Map(); // file -> Set(lines)
for (const inp of edits) {
  const file = inp.file_path || inp.path;
  if (!file) continue;
  const pairs = inp.edits ? inp.edits : [{ old_string: inp.old_string, new_string: inp.new_string ?? inp.content }];
  const set = added.get(file) || new Set();
  for (const { old_string = "", new_string = "" } of pairs) {
    const old = new Set(String(old_string).split("\n"));
    for (const l of String(new_string).split("\n")) if (!old.has(l)) set.add(l);
  }
  added.set(file, set);
}

const WEB = /\.(t|j)sx?$|\.vue$|\.svelte$|\.astro$|\.(py|go|rs|php|rb|dart|kt|swift)$/;
const rules = [
  [/\bconsole\.log\(/, "console.log", (f) => !/(scripts?|bin|cli)\/|\.config\.|\.test\.|\.spec\./.test(f)],
  [/^\s*debugger;?\s*$/, "debugger", () => true],
  [/\b(it|test|describe)\.only\(/, ".only (diğer testler atlanır)", () => true],
  [/@ts-ignore/, "@ts-ignore", () => true],
  [/^\s*(breakpoint\(\)|import\s+pdb|pdb\.set_trace\(\))/, "Python debugger", (f) => f.endsWith(".py")],
  [/\bdbg!\(/, "dbg!", (f) => f.endsWith(".rs")],
  [/\b(dd|var_dump)\(/, "dd/var_dump", (f) => f.endsWith(".php")],
  [/binding\.(pry|irb)|\bbyebug\b/, "Ruby debugger", (f) => f.endsWith(".rb")],
  [/@pytest\.mark\.skip\b|\bfit\(|\bfdescribe\(/, "atlanan/odaklanmış test", () => true],
];

const hits = [];
for (const [file, lines] of added) {
  const rel = path.relative(cwd, file).replace(/\\/g, "/") || file;
  if (!WEB.test(rel) || /node_modules|\.next\//.test(rel)) continue;
  let current;
  try {
    current = fs.readFileSync(file, "utf8").split("\n");
  } catch {
    continue; // dosya silinmiş
  }
  for (const [re, label, applies] of rules) {
    if (!applies(rel)) continue;
    for (const l of lines) {
      if (!re.test(l)) continue;
      const n = current.indexOf(l);
      if (n >= 0) hits.push(`${rel}:${n + 1} ${label}`); // satır hâlâ dosyadaysa bildir
    }
  }
}

if (hits.length) {
  emit({
    decision: "block",
    reason:
      `Sky son kontrol — bu turdaki değişikliklerde kalıntı olabilecek satırlar var:\n${hits.slice(0, 12).map((h) => "  - " + h).join("\n")}` +
      (hits.length > 12 ? `\n  (+${hits.length - 12} daha)` : "") +
      `\nBilinçli değilse temizle; bilinçliyse kullanıcıya kısaca belirt ve bitir.`,
  });
}
process.exit(0);
