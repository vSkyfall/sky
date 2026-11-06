#!/usr/bin/env node
// PreToolUse(Bash): tehlikeli komutlar ve şüpheli paket kurulumları için kullanıcı onayı ister.
const { execFileSync } = require("child_process");
const { readInput, disabled, ask } = require("./lib");

const POPULAR = [
  "react", "react-dom", "next", "vite", "typescript", "zod", "axios", "lodash", "express", "dotenv", "prisma",
  "drizzle-orm", "tailwindcss", "clsx", "dayjs", "date-fns", "moment", "zustand", "redux", "jotai", "swr",
  "eslint", "prettier", "vitest", "jest", "playwright", "stripe", "iyzipay", "resend", "sharp", "uuid",
  "nanoid", "bcrypt", "argon2", "jsonwebtoken", "cors", "helmet", "mongoose", "pg", "mysql2", "redis",
  "ioredis", "socket.io", "framer-motion", "motion", "three", "chart.js", "recharts", "d3", "webpack",
  "esbuild", "rollup", "nodemon", "commander", "chalk", "yargs", "inquirer", "cheerio", "puppeteer",
];

const input = readInput();
const cmd = (input.tool_input && input.tool_input.command) || "";
if (!cmd || process.env.SKY_HOOKS === "off") process.exit(0);

const reasons = [];

if (!disabled("danger")) {
  if (dangerousRm(cmd)) reasons.push("geniş kapsamlı `rm -rf`");
  const rules = [
    [/\bgit\s+push\b[^|;&]*\s(--force|-f)(\s|$)/, "`git push --force` (uzak geçmişi ezer)"],
    [/\bgit\s+reset\s+--hard\b/, "`git reset --hard` (kaydedilmemiş değişiklikler kaybolur)"],
    [/\bgit\s+clean\s+-[a-zA-Z]*f/, "`git clean -f` (izlenmeyen dosyalar silinir)"],
    [/\bgit\s+(checkout\s+(--\s+)?|restore\s+)\.\s*$/, "tüm çalışma alanı değişikliklerini geri alma"],
    [/\bprisma\s+migrate\s+reset\b/, "`prisma migrate reset` (veritabanını sıfırlar)"],
    [/\bprisma\s+db\s+push\b[^|;&]*--accept-data-loss/, "`prisma db push --accept-data-loss`"],
    [/\bdrizzle-kit\s+push\b/, "`drizzle-kit push` (migration'sız şema değişikliği)"],
    [/\bsupabase\s+db\s+(push|reset\b[^|;&]*--linked)/, "bağlı Supabase projesinde şema değişikliği"],
    [/\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE(\s+TABLE)?\s+\w)/i, "SQL `DROP` / `TRUNCATE`"],
    [/\bvercel\b[^|;&]*\s--prod\b|\bnetlify\s+deploy\b[^|;&]*--prod/, "production deploy"],
    [/\b(npm|pnpm|yarn)\s+publish\b/, "paket yayınlama"],
    [/\bchmod\s+-R\s+777\b/, "`chmod -R 777`"],
    [/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/, "internetten indirilen scripti doğrudan çalıştırma"],
  ];
  for (const [re, msg] of rules) if (re.test(cmd)) reasons.push(msg);
}

if (!disabled("packages")) {
  const m = cmd.match(/\b(?:npm\s+(?:install|i|add)|pnpm\s+(?:add|install|i)|yarn\s+add|bun\s+(?:add|install|i))\s+([^|;&]+)/);
  if (m) {
    const names = m[1]
      .split(/\s+/)
      .filter((t) => t && !t.startsWith("-") && !/^[./~]/.test(t) && !t.includes(":"))
      .map((t) => (t.startsWith("@") ? t.replace(/^(@[^@]+)@.*$/, "$1") : t.replace(/@.*$/, "")))
      .slice(0, 5);
    for (const name of names) {
      const issue = checkPackage(name);
      if (issue) reasons.push(`\`${name}\`: ${issue}`);
    }
  }
}

if (reasons.length) {
  ask(`Sky güvenlik kontrolü: ${reasons.join("; ")}. Devam etmeden önce kullanıcı onayı gerekiyor.`);
}
process.exit(0);

// Özyinelemeli rm'in hedefi kök, ev dizini, tek seviyeli sistem dizini (/etc, /home), joker
// veya çalışma dizininin tamamı mı? Bayrak sırası ve uzun biçimler (-r -f, --recursive) da tanınır.
function dangerousRm(command) {
  const WIDE = /^(\/\*?|\/[^/\s]+\/?\*?|~\/?\*?|\$\{?HOME\}?\/?\*?|\*|\.\/?\*?|\.\.\/?\*?)$/;
  for (const seg of command.split(/[;&|\n]+|\$\(|`/)) {
    const t = seg.trim().split(/\s+/);
    const i = t.findIndex((x) => x === "rm" || /\/rm$/.test(x));
    if (i < 0) continue;
    let recursive = false, endOfFlags = false;
    const targets = [];
    for (const a of t.slice(i + 1)) {
      if (!endOfFlags && a === "--") { endOfFlags = true; continue; }
      if (!endOfFlags && a === "--recursive") recursive = true;
      else if (!endOfFlags && /^-[a-zA-Z]+$/.test(a)) { if (/[rR]/.test(a)) recursive = true; }
      else if (endOfFlags || !a.startsWith("--")) targets.push(a.replace(/^["']|["']$/g, ""));
    }
    if (recursive && targets.some((x) => WIDE.test(x))) return true;
  }
  return false;
}

function checkPackage(name) {
  const similar = POPULAR.find((p) => p !== name && Math.abs(p.length - name.length) <= 2 && distance(p, name) === 1);
  if (similar && !POPULAR.includes(name)) return `popüler \`${similar}\` paketine çok benziyor (typo-squat olabilir)`;
  try {
    const out = execFileSync("npm", ["view", name, "time.created", "--json"], { timeout: 4000, stdio: ["ignore", "pipe", "pipe"] })
      .toString()
      .trim();
    const created = new Date(JSON.parse(out));
    const ageDays = (Date.now() - created.getTime()) / 86_400_000;
    if (Number.isFinite(ageDays) && ageDays < 30) return `${Math.floor(ageDays)} gün önce yayımlanmış çok yeni bir paket`;
  } catch (e) {
    const err = String((e && e.stderr) || "");
    if (err.includes("E404")) return "npm kayıt defterinde bulunamadı";
    // Ağ yok veya npm erişilemiyor: sessizce geç.
  }
  return null;
}

function distance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
