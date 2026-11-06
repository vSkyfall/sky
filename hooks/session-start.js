#!/usr/bin/env node
// SessionStart: package.json'dan stack'i tanır ve ilgili Sky skill'lerini Claude'a hatırlatır.
const fs = require("fs");
const path = require("path");
const { readInput, disabled, addContext, readJSON } = require("./lib");

if (disabled("session")) process.exit(0);
const input = readInput();
const cwd = input.cwd || process.cwd();
const pkg = readJSON(path.join(cwd, "package.json"));
const deps = pkg ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } : {};
const has = (f) => fs.existsSync(path.join(cwd, f));
const read = (f) => {
  try {
    return fs.readFileSync(path.join(cwd, f), "utf8");
  } catch {
    return "";
  }
};
const anyFile = (re) => {
  try {
    return fs.readdirSync(cwd).some((f) => re.test(f));
  } catch {
    return false;
  }
};

const map = [
  [["next"], "Next.js", ["sky-nextjs", "sky-rsc-streaming"]],
  [["vite"], "Vite", ["sky-web-stack"]],
  [["astro"], "Astro", ["sky-seo"]],
  [["expo", "react-native"], "React Native/Expo", ["sky-mobile-app"]],
  [["wxt"], "WXT eklentisi", ["sky-browser-extension"]],
  [["@supabase/supabase-js", "@supabase/ssr"], "Supabase", ["sky-supabase"]],
  [["@prisma/client", "prisma"], "Prisma", ["sky-data"]],
  [["drizzle-orm"], "Drizzle", ["sky-data", "sky-sql"]],
  [["tailwindcss"], "Tailwind", ["sky-design-system"]],
  [["@trpc/server"], "tRPC", ["sky-trpc"]],
  [["stripe"], "Stripe", ["sky-payments"]],
  [["iyzipay"], "iyzico", ["sky-payments", "sky-tr-integrations"]],
  [["next-intl", "react-i18next", "i18next"], "i18n", ["sky-i18n"]],
  [["ai", "@anthropic-ai/sdk", "@ai-sdk/anthropic"], "AI SDK", ["sky-ai", "sky-ai-ux"]],
  [["@tanstack/react-query", "zustand"], "istemci state", ["sky-state"]],
  [["vitest", "jest", "@playwright/test"], "test", ["sky-testing"]],
  [["three", "@react-three/fiber"], "3D", ["sky-3d"]],
  [["@tiptap/react", "lexical", "@blocknote/react"], "editör", ["sky-editor"]],
  [["inngest", "@trigger.dev/sdk", "bullmq", "pg-boss"], "arka plan işleri", ["sky-jobs"]],
  [["resend", "@react-email/components", "react-email"], "e-posta", ["sky-notifications", "sky-email-design"]],
  [["payload", "next-sanity", "@sanity/client", "@keystatic/core"], "CMS", ["sky-cms"]],
  [["@sentry/nextjs", "@sentry/react", "posthog-js"], "gözlem", ["sky-observability"]],
  [["maplibre-gl", "leaflet", "react-leaflet"], "harita", ["sky-maps-geo"]],
  [["@dnd-kit/core"], "sürükle-bırak", ["sky-drag-drop"]],
  [["@tanstack/react-table"], "veri tablosu", ["sky-dashboard"]],
  [["recharts", "@visx/visx", "echarts"], "grafik", ["sky-dataviz"]],
  [["hono", "fastify", "express", "@nestjs/core"], "Node backend", ["sky-node-backend"]],
  [["electron", "@tauri-apps/api"], "masaüstü", ["sky-desktop-app"]],
  [["phaser", "pixi.js", "kaplay"], "oyun", ["sky-web-games"]],
  [["grammy", "discord.js", "@slack/bolt"], "bot", ["sky-bots"]],
  [["@modelcontextprotocol/sdk"], "MCP", ["sky-mcp-server"]],
  [["graphql", "graphql-yoga", "@apollo/server"], "GraphQL", ["sky-graphql"]],
  [["mongoose", "mongodb"], "MongoDB", ["sky-mongodb"]],
  [["better-sqlite3", "@libsql/client"], "SQLite", ["sky-sqlite"]],
  [["commander", "@clack/prompts", "citty", "yargs"], "CLI", ["sky-cli-tools"]],
  [["crawlee", "cheerio", "puppeteer"], "kazıma", ["sky-scraping"]],
  [["turbo", "nx"], "monorepo", ["sky-monorepo"]],
  [["vue", "nuxt"], "Vue/Nuxt", ["sky-vue"]],
  [["svelte", "@sveltejs/kit"], "Svelte/SvelteKit", ["sky-svelte"]],
  [["@angular/core"], "Angular", ["sky-angular"]],
  [["astro"], "Astro", ["sky-astro"]],
  [["solid-js"], "Solid", ["sky-web-stack"]],
  [["wagmi", "viem"], "Web3", ["sky-web3"]],
  [["@rainbow-me/rainbowkit", "@web3modal/wagmi", "ethers"], "Web3", ["sky-web3"]],
  [["firebase", "firebase-admin"], "Firebase", ["sky-baas"]],
  [["convex"], "Convex", ["sky-baas"]],
  [["pocketbase"], "PocketBase", ["sky-baas"]],
  [["tailwindcss"], "Tailwind", ["sky-tailwind"]],
  [["lit"], "Web Components", ["sky-web-components"]],
  [["ioredis", "redis", "@upstash/redis"], "Redis", ["sky-redis"]],
  [["@qdrant/js-client-rest", "@pinecone-database/pinecone", "chromadb", "pgvector"], "vektör DB", ["sky-vector-db"]],
  [["ollama", "@huggingface/transformers", "@mlc-ai/web-llm"], "yerel LLM", ["sky-local-llm"]],
];

const stack = [];
const skills = new Set();
for (const [names, label, sk] of map) {
  if (names.some((n) => n in deps)) {
    const v = names.map((n) => deps[n]).find(Boolean);
    const shown = label === "Next.js" && v ? `Next.js ${String(v).replace(/^[\^~]/, "")}` : label;
    if (!stack.includes(shown)) stack.push(shown);
    sk.forEach((s) => skills.add(s));
  }
}

// JS dışı ekosistemler ve altyapı dosyaları
const py = read("pyproject.toml") + read("requirements.txt");
const gradle = read("build.gradle") + read("build.gradle.kts") + read("app/build.gradle.kts") + read("app/build.gradle");
const eco = [
  [py.length > 0, "Python", ["sky-python"]],
  [/fastapi/i.test(py), "FastAPI", ["sky-fastapi"]],
  [/django/i.test(py), "Django", ["sky-django"]],
  [/pandas|polars|duckdb|jupyter|marimo/i.test(py), "veri analizi", ["sky-data-analysis"]],
  [has("go.mod"), "Go", ["sky-go"]],
  [has("Cargo.toml"), "Rust", ["sky-rust"]],
  [/laravel\/framework/.test(read("composer.json")), "Laravel", ["sky-laravel"]],
  [/["']rails["']/.test(read("Gemfile")), "Rails", ["sky-rails"]],
  [has("pom.xml") || /springframework/.test(gradle), "Spring/JVM", ["sky-spring"]],
  [/com\.android\.application|androidx/.test(gradle), "Android", ["sky-android"]],
  [anyFile(/\.(csproj|sln|slnx)$/), ".NET", ["sky-dotnet"]],
  [has("pubspec.yaml"), "Flutter", ["sky-flutter"]],
  [anyFile(/\.xcodeproj$/) || has("Package.swift"), "iOS/Swift", ["sky-ios"]],
  [has("src-tauri"), "Tauri", ["sky-desktop-app"]],
  [has("Dockerfile") || has("compose.yaml") || has("docker-compose.yml"), "Docker", ["sky-docker"]],
  [anyFile(/\.tf$/) || has("terraform") || has("Pulumi.yaml"), "IaC", ["sky-iac"]],
  [has("wrangler.toml") || has("wrangler.jsonc"), "Cloudflare", ["sky-cloudflare"]],
  [has("turbo.json") || has("pnpm-workspace.yaml") || has("nx.json"), "monorepo", ["sky-monorepo"]],
  [has(".github/workflows"), "GitHub Actions", ["sky-github-actions"]],
  [has("k8s") || has("helm") || has("charts") || has("kustomization.yaml"), "Kubernetes", ["sky-kubernetes"]],
  [has("wp-config.php") || has("wp-content") || anyFile(/^style\.css$/) && has("functions.php"), "WordPress", ["sky-wordpress"]],
  [has("shopify.app.toml") || anyFile(/\.liquid$/), "Shopify", ["sky-shopify"]],
  [has("platformio.ini") || anyFile(/\.ino$/), "IoT/gömülü", ["sky-iot"]],
  [has("CMakeLists.txt") || has("Makefile") && anyFile(/\.(c|cc|cpp|cxx|h|hpp)$/), "C/C++", ["sky-cpp"]],
  [has("mix.exs"), "Elixir/Phoenix", ["sky-elixir"]],
  [has("foundry.toml") || has("hardhat.config.ts") || has("hardhat.config.js") || anyFile(/\.sol$/), "Solidity/Web3", ["sky-web3"]],
  [has("ansible.cfg") || has("playbook.yml") || has("site.yml"), "Ansible", ["sky-ansible"]],
  [has("dbt_project.yml"), "dbt/veri hattı", ["sky-data-pipelines"]],
];
for (const [ok, label, sk] of eco) {
  if (!ok) continue;
  if (!stack.includes(label)) stack.push(label);
  sk.forEach((s) => skills.add(s));
}
if (!stack.length) process.exit(0);

const notes = [];
if (!fs.existsSync(path.join(cwd, "CLAUDE.md")) && !fs.existsSync(path.join(cwd, ".claude", "CLAUDE.md")))
  notes.push("Projede CLAUDE.md yok — uygun bir anda kullanıcıya /sky:sky-claude-md ile oluşturmayı öner.");

// Sky 5: yalnızca Türkiye'ye özgü skill'ler otomatik; diğerleri disable-model-invocation ile elle çağrılır.
const elle = (s) => {
  try {
    const t = fs.readFileSync(path.join(__dirname, "..", "skills", s, "SKILL.md"), "utf8");
    return /^disable-model-invocation:\s*true\s*$/m.test(t.split(/\n---/)[0]);
  } catch { return false; }
};
const secili = [...skills].slice(0, 10), oto = secili.filter((s) => !elle(s)), man = secili.filter(elle);
addContext(
  "SessionStart",
  `Sky: proje stack'i ${stack.join(", ")}.` +
    (oto.length ? ` Bu projede öne çıkan Sky skill'leri: ${oto.map((s) => "sky:" + s).join(", ")}.` : "") +
    (man.length ? ` İlgili elle çağrılan Sky rehberleri (sen yükleyemezsin, gerekirse kullanıcıya öner): ${man.map((s) => "/sky:" + s).join(", ")}.` : "") +
    ` Genel giriş noktası: sky:sky.` + (notes.length ? " " + notes.join(" ") : "")
);
process.exit(0);
