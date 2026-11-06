#!/usr/bin/env node
// UserPromptSubmit: isteği Türkçe/İngilizce anahtar kelimelerle eşleyip ilgili Sky skill'lerini önerir.
const { readInput, disabled, addContext } = require("./lib");

if (disabled("prompt")) process.exit(0);
const input = readInput();
const prompt = String(input.prompt || "");
if (!prompt || prompt.trim().startsWith("/") || prompt.length > 4000) process.exit(0);
// Türkçe küçük harf "API" → "apı" yapar; İngilizce terimler de eşleşsin diye iki biçimi birden ara.
const text = prompt.toLocaleLowerCase("tr-TR") + "\n" + prompt.toLowerCase();

// Terimler kelime başında eşlenir. Kısa terimler (≤ 3 harf) tam kelime olmalı; uzunlar Türkçe ek
// alabilir ("formu", "performansı"). EXCEPT, ek değil başka kelime oluşturan devamları dışlar.
const L = "a-zçğıöşü0-9";
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const EXCEPT = {
  java: "script",
  form: "at|al|ül",
  feed: "back",
  hero: "ku",
  "takım": "yıldız",
  rust: "ic",
  spring: "board",
  ruby: "ist",
};
const term = (t) =>
  t.length <= 3
    ? new RegExp(`(?<![${L}])${esc(t)}(?![${L}])`)
    : new RegExp(`(?<![${L}])${esc(t)}${EXCEPT[t] ? `(?!${EXCEPT[t]})` : ""}`);

const MAP = [
  [["randevu", "rezervasyon", "müsait saat", "booking"], ["sky-scheduling"]],
  [["ödeme", "iyzico", "stripe", "abonelik", "checkout", "paytr"], ["sky-payments", "sky-checkout-ux"]],
  [["e-fatura", "e-arşiv", "kargo", "tc kimlik", "iban", "netgsm", "iys", "whatsapp business"], ["sky-tr-integrations"]],
  [["giriş ekran", "kayıt ol", "login", "oauth", "parola", "şifre sıfırla", "otp", "2fa", "passkey", "oturum"], ["sky-auth", "sky-auth-ux"]],
  [["seo", "sitemap", "meta etiket", "google'da", "json-ld"], ["sky-seo"]],
  [["yavaş", "performans", "lighthouse", "lcp", "bundle", "hızlandır"], ["sky-perf"]],
  [["çalışmıyor", "hata alıyorum", "bozuldu", "debug", "neden olmuyor", "hydration", "cors"], ["sky-debug"]],
  [["test yaz", "vitest", "playwright", "e2e", "coverage", "flaky"], ["sky-testing"]],
  [["landing", "açılış sayfa", "hero"], ["sky-landing"]],
  [["fiyatlandırma", "pricing", "fiyat sayfa"], ["sky-pricing-page"]],
  [["dashboard", "admin panel", "yönetim panel", "veri tablosu"], ["sky-dashboard"]],
  [["grafik", "chart", "görselleştir", "sparkline"], ["sky-dataviz"]],
  [["animasyon", "geçiş efekt", "framer", "mikro etkileşim"], ["sky-motion"]],
  [["lottie", "rive"], ["sky-motion-assets"]],
  [["erişilebilir", "a11y", "ekran okuyucu", "wcag"], ["sky-a11y"]],
  [["çok dil", "i18n", "çeviri", "ingilizce ekle", "next-intl"], ["sky-i18n"]],
  [["e-posta şablon", "mail tasarım", "bülten", "newsletter"], ["sky-email-design"]],
  [["bildirim", "sms", "push notification", "e-posta gönder"], ["sky-notifications"]],
  [["ai", "yapay zeka", "yapay zekâ", "chatbot", "llm", "claude api", "openai", "rag"], ["sky-ai", "sky-ai-ux"]],
  [["ajan", "agent", "mcp"], ["sky-ai-agents"]],
  [["arama", "autocomplete", "search"], ["sky-search"]],
  [["harita", "konum", "yakınımdaki", "şube bulucu"], ["sky-maps-geo"]],
  [["sürükle", "kanban", "drag"], ["sky-drag-drop"]],
  [["pdf", "yazdır", "sertifika", "makbuz"], ["sky-print-pdf"]],
  [["editör", "rich text", "notion gibi", "tiptap"], ["sky-editor"]],
  [["fotoğraf yükle", "görsel yükle", "avatar", "galeri", "video oynat"], ["sky-media"]],
  [["pwa", "ana ekrana", "çevrimdışı", "offline"], ["sky-pwa"]],
  [["3d", "three.js", "threejs", "webgl"], ["sky-3d"]],
  [["çizim", "imza alan", "canvas", "konfeti", "whiteboard"], ["sky-canvas"]],
  [["takvim", "tarih seçici", "saat dilimi", "geri sayım", "date picker"], ["sky-date-time"]],
  [["mobil uygulama", "react native", "expo", "app store", "play store"], ["sky-mobile-app"]],
  [["chrome eklenti", "tarayıcı eklenti", "browser extension"], ["sky-browser-extension"]],
  [["deploy", "yayına al", "canlıya al", "docker", "vercel", "github actions", "ci/cd"], ["sky-deploy"]],
  [["sentry", "analytics", "uptime", "izleme", "loglama"], ["sky-observability"]],
  [["supabase", "rls"], ["sky-supabase"]],
  [["sql", "sorgu yaz", "indeks", "explain"], ["sky-sql"]],
  [["cache", "önbellek", "redis"], ["sky-caching"]],
  [["kuyruk", "cron", "arka planda", "background job"], ["sky-jobs"]],
  [["webhook gönder", "zapier", "giden webhook"], ["sky-webhooks-out"]],
  [["api key", "dışa açık api", "public api", "geliştirici portal"], ["sky-public-api"]],
  [["takım", "ekip davet", "çalışma alanı", "organizasyon", "multi-tenant", "çok kiracı"], ["sky-multitenancy"]],
  [["dosya yükle", "s3", "r2", "storage", "depolama"], ["sky-storage"]],
  [["güvenlik", "hacklen", "csp", "owasp", "xss", "pentest"], ["sky-security"]],
  [["kvkk", "gdpr", "kişisel veri", "verilerimi sil", "çerez onay"], ["sky-privacy-engineering"]],
  [["excel", "csv", "içe aktar", "dışa aktar"], ["sky-import-export"]],
  [["kim değiştirdi", "audit", "değişiklik geçmiş", "sürüm geçmiş", "geri al"], ["sky-audit-history"]],
  [["cms", "içerik yönetim", "kendisi düzenle"], ["sky-cms"]],
  [["e-ticaret", "online mağaza", "sepet", "varyant", "stok"], ["sky-ecommerce"]],
  [["mesajlaşma", "sohbet", "canlı destek", "chat"], ["sky-chat-product"]],
  [["feature flag", "a/b test", "beta program", "kademeli açılış"], ["sky-feature-flags"]],
  [["kota", "plan limit", "kullanım limit", "metering"], ["sky-metering-quotas"]],
  [["marka", "logo", "renk palet", "favicon"], ["sky-brand", "sky-color"]],
  [["font", "yazı tipi", "tipografi"], ["sky-web-fonts"]],
  [["onboarding", "ilk kullanım", "kurulum sihirbaz", "aktivasyon"], ["sky-onboarding"]],
  [["boş durum", "empty state", "404", "hata sayfa", "iskelet"], ["sky-states-library"]],
  [["ikon", "icon"], ["sky-icons"]],
  [["figma"], ["sky-figma"]],
  [["buton metni", "hata mesajı", "mikro metin", "sen mi siz mi", "ux yazım"], ["sky-ux-writing"]],
  [["saas", "mvp", "sıfırdan ürün"], ["sky-saas-blueprint"]],
  [["kuaför", "klinik", "restoran", "diş hekim", "esnaf", "işletme site", "qr menü"], ["sky-small-business-site"]],
  [["portfolyo", "portfolio", "kişisel site", "özgeçmiş"], ["sky-portfolio"]],
  [["düğün", "davetiye", "etkinlik", "lcv", "rsvp", "konferans"], ["sky-event-site"]],
  [["kurs", "eğitim platform", "lms", "online ders"], ["sky-lms"]],
  [["dokümantasyon", "docs site", "yardım merkez"], ["sky-docs-site"]],
  [["changelog", "yenilikler", "roadmap", "yol harita"], ["sky-changelog"]],
  [["lansman", "bekleme listesi", "waitlist", "product hunt"], ["sky-launch"]],
  [["refactor", "kod karışık", "çok büyük dosya", "yeniden düzenle"], ["sky-refactor"]],
  [["upgrade", "sürüm yükselt", "tailwind 4", "app router'a geç", "typescript'e çevir"], ["sky-upgrades"]],
  [["claude.md"], ["sky-claude-md"]],
  [["teslim et", "müşteriye teslim", "devir"], ["sky-handoff"]],
  [["oyunlaştır", "rozet", "streak", "lider tablosu"], ["sky-gamification"]],
  [["global state", "zustand", "redux", "state yönetim"], ["sky-state"]],
  [["dark pattern", "iptal akış", "karanlık kalıp"], ["sky-ethical-ux"]],
  [["container query", ":has(", "modern css", "scroll animasyon"], ["sky-css-modern"]],
  [["trpc"], ["sky-trpc"]],
  [["mobilde", "telefonda", "bottom sheet", "safe area"], ["sky-mobile-ux"]],
  [["menü yapı", "navigasyon", "bilgi mimari", "site harita"], ["sky-navigation-ia"]],
  [["tasarım sistem", "bileşen kütüphane", "cva", "shadcn"], ["sky-design-system"]],
  [["python", "pyproject", "pytest", "pydantic"], ["sky-python"]],
  [["fastapi"], ["sky-fastapi"]],
  [["django", "drf"], ["sky-django"]],
  [["golang", "go ile", "go'da", "go kodu", "goroutine"], ["sky-go"]],
  [["rust", "cargo", "borrow checker", "tokio", "axum"], ["sky-rust"]],
  [["laravel", "php", "eloquent", "livewire", "filament"], ["sky-laravel"]],
  [["spring", "java", "jpa", "hibernate"], ["sky-spring"]],
  [[".net", "c#", "asp.net", "dotnet", "entity framework"], ["sky-dotnet"]],
  [["rails", "ruby", "hotwire"], ["sky-rails"]],
  [["express", "fastify", "hono", "nestjs", "node api", "bun", "deno"], ["sky-node-backend"]],
  [["android", "jetpack compose", "kotlin"], ["sky-android"]],
  [["ios", "swift", "swiftui", "xcode"], ["sky-ios"]],
  [["flutter", "dart", "riverpod"], ["sky-flutter"]],
  [["electron", "tauri", "masaüstü uygulama", "desktop app"], ["sky-desktop-app"]],
  [["dockerfile", "dockerize", "docker compose", "konteyner"], ["sky-docker"]],
  [["kubernetes", "k8s", "helm", "kubectl"], ["sky-kubernetes"]],
  [["terraform", "pulumi", "iac", "altyapı kod"], ["sky-iac"]],
  [["aws", "lambda", "s3 bucket", "ec2", "rds"], ["sky-aws"]],
  [["cloudflare", "workers", "wrangler", "d1", "turnstile"], ["sky-cloudflare"]],
  [["vps", "sunucu kur", "nginx", "systemd", "ssh", "ubuntu sunucu"], ["sky-linux-server"]],
  [["github actions", "workflow yaml", "ci pipeline"], ["sky-github-actions"]],
  [["durum kodu", "status code", "dns", "ssl", "tls", "http başlık"], ["sky-http"]],
  [["yük testi", "load test", "k6", "kaç kullanıcı kaldırır"], ["sky-load-testing"]],
  [["mongodb", "mongo", "mongoose"], ["sky-mongodb"]],
  [["sqlite", "turso", "libsql"], ["sky-sqlite"]],
  [["graphql", "apollo"], ["sky-graphql"]],
  [["mikroservis", "microservice", "event-driven", "kafka", "rabbitmq", "outbox"], ["sky-microservices"]],
  [["commit", "rebase", "merge conflict", "çakışma çöz", "git "], ["sky-git"]],
  [["code review", "kodu incele", "pr incele", "review"], ["sky-code-review"]],
  [["tdd", "önce test"], ["sky-tdd"]],
  [["planla", "plan çıkar", "ne kadar sürer", "işi böl"], ["sky-planning"]],
  [["eslint", "prettier", "biome", "lint kur", "husky", "pre-commit"], ["sky-code-style"]],
  [["hexagonal", "clean architecture", "ddd", "design pattern", "tasarım kalıb", "mimari kalıp"], ["sky-architecture-patterns"]],
  [["system design", "sistem tasarım", "nasıl ölçeklenir"], ["sky-system-design"]],
  [["algoritma", "leetcode", "veri yapı", "big-o", "zaman karmaşıklığı"], ["sky-algorithms"]],
  [["bana açıkla", "anlamadım", "nasıl çalışıyor", "öğret", "yeni başlıyorum"], ["sky-explain"]],
  [["promise", "async/await", "abortcontroller", "event loop"], ["sky-js-async"]],
  [["bellek sızıntı", "memory leak", "cpu %100", "node yavaş"], ["sky-node-performance"]],
  [["npm paketi", "kütüphane yayınla", "npm publish", "package exports"], ["sky-npm-library"]],
  [["cli", "komut satırı", "terminal aracı"], ["sky-cli-tools"]],
  [["monorepo", "turborepo", "nx"], ["sky-monorepo"]],
  [["regex", "düzenli ifade"], ["sky-regex"]],
  [["bash", "shell script", "script yaz", "terminal komut", "zsh"], ["sky-shell"]],
  [["oyun", "phaser", "pixijs", "game"], ["sky-web-games"]],
  [["telegram bot", "discord bot", "slack uygulama", "whatsapp bot", "bot yaz"], ["sky-bots"]],
  [["scrap", "kazıma", "siteden veri çek", "crawler", "fiyat takib"], ["sky-scraping"]],
  [["pandas", "polars", "duckdb", "jupyter", "veri analiz"], ["sky-data-analysis"]],
  [["claude code", "slash komut", "subagent", "alt agent"], ["sky-claude-code"]],
  [["skill yaz", "eklenti yap", "plugin yaz", "hook yaz", "sky'a ekle"], ["sky-skill-authoring"]],
  [["mcp sunucu", "mcp server", "model context protocol"], ["sky-mcp-server"]],
  [["ai kalite", "eval", "llm judge", "prompt test"], ["sky-ai-eval"]],
  [["adr", "mimari karar", "diyagram çiz", "readme"], ["sky-architecture-docs"]],
  [["api yaz", "endpoint", "uç nokta", "route handler", "rest api"], ["sky-backend-api"]],
  [["paylaş butonu", "panoya kopyala", "sekmeler arası", "sesle yazma", "web share"], ["sky-browser-apis"]],
  [["şema tasarım", "migration", "veritabanı tasarım", "prisma", "drizzle"], ["sky-data"]],
  [["form", "doğrulama", "validation", "react hook form"], ["sky-forms"]],
  [["sonsuz kaydırma", "infinite scroll", "feed", "daha fazla yükle"], ["sky-infinite-lists"]],
  [["next.js", "nextjs", "app router", "server action", "server component"], ["sky-nextjs"]],
  [["canlı güncelle", "websocket", "sse", "realtime", "presence"], ["sky-realtime"]],
  [["timeout", "retry", "circuit breaker", "servis çökerse"], ["sky-resilience"]],
  [["suspense", "streaming", "waterfall", "sayfa geç açılıyor"], ["sky-rsc-streaming"]],
  [["typescript", "tip hatası", "any kullan", "generic"], ["sky-typescript"]],
  [["arayüz", "tasarımı düzelt", "daha profesyonel", "dark mode", "ui"], ["sky-ui-craft"]],
  [["kullanılabilirlik", "ux değerlendir", "nielsen", "kafa karıştırıyor"], ["sky-ux-heuristics"]],
  [["react", "vite", "proje kur", "stack seç", "klasör yapısı"], ["sky-web-stack"]],
  [["vue", "nuxt", "composition api", "pinia"], ["sky-vue"]],
  [["svelte", "sveltekit", "rün", "$state"], ["sky-svelte"]],
  [["angular", "signal", "rxjs"], ["sky-angular"]],
  [["astro", "içerik sitesi", "island", "content collection"], ["sky-astro"]],
  [["react router", "remix", "loader", "fetcher"], ["sky-react-router"]],
  [["htmx", "alpine", "hypermedia", "spa istemiyorum", "sunucu render"], ["sky-htmx"]],
  [["react native", "expo", "flashlist", "nativewind"], ["sky-react-native"]],
  [["tailwind", "@theme", "utility", "sınıf sırala"], ["sky-tailwind"]],
  [["webrtc", "görüntülü görüşme", "ekran paylaş", "canlı yayın", "online muayene"], ["sky-webrtc"]],
  [["wasm", "webassembly", "tarayıcıda hızlı", "rust'ı web"], ["sky-wasm"]],
  [["ses", "müzik uygulama", "web audio", "sesli mesaj", "oynatıcı", "tone.js"], ["sky-web-audio"]],
  [["web component", "custom element", "gömülebilir widget", "lit"], ["sky-web-components"]],
  [["wordpress", "gutenberg", "woocommerce", "wp eklenti", "wp tema"], ["sky-wordpress"]],
  [["shopify", "liquid", "hydrogen", "online store"], ["sky-shopify"]],
  [["firebase", "firestore", "convex", "pocketbase", "appwrite", "hazır backend", "baas"], ["sky-baas"]],
  [["c++", "cpp", "cmake", "c kodu", "modern c++"], ["sky-cpp"]],
  [["java", "kotlin", "jvm"], ["sky-java"]],
  [["elixir", "phoenix", "liveview", "otp", "genserver"], ["sky-elixir"]],
  [["makine öğrenmesi", "ml model", "model eğit", "tahmin modeli", "sklearn", "pytorch", "öneri sistemi"], ["sky-ml"]],
  [["yerel model", "ollama", "internetsiz ai", "veriler dışarı çıkmasın", "llama", "open weight"], ["sky-local-llm"]],
  [["vektör", "embedding", "pgvector", "qdrant", "pinecone", "semantik arama"], ["sky-vector-db"]],
  [["veri ambarı", "etl", "elt", "dbt", "clickhouse", "bigquery", "raporlama altyapı"], ["sky-data-pipelines"]],
  [["redis", "valkey", "sorted set", "dağıtık kilit", "rate limit"], ["sky-redis"]],
  [["gcp", "google cloud", "cloud run", "cloud sql", "firestore"], ["sky-gcp"]],
  [["azure", "app service", "container apps", "entra", "key vault"], ["sky-azure"]],
  [["ansible", "playbook", "sunucu otomasyon", "yapılandırma otomasyon"], ["sky-ansible"]],
  [["sır yönetim", "api anahtarı nerede", ".env", "sır sızdı", "vault", "secret"], ["sky-secrets"]],
  [["iot", "esp32", "arduino", "raspberry pi", "sensör", "akıllı ev", "gömülü", "mqtt", "tübitak"], ["sky-iot"]],
  [["kriptografi", "parola sakla", "hash", "şifreleme", "hmac", "jwt doğrula", "argon2"], ["sky-crypto"]],
  [["web3", "blok zinciri", "blockchain", "akıllı sözleşme", "solidity", "nft", "cüzdan", "dapp"], ["sky-web3"]],
  [["açık kaynak", "open source", "lisans", "katkı", "oss yayınla"], ["sky-open-source"]],
  [["freelance", "serbest çalış", "müşteri işi", "teklif", "fiyatlandırma", "sözleşme", "kapora"], ["sky-freelance"]],
  [["teknik yazı", "dokümantasyon yaz", "blog yazısı", "makale", "rehber yaz"], ["sky-tech-writing"]],
  [["mülakat", "iş görüşmesi", "cv", "özgeçmiş", "maaş müzakere", "kariyer", "iş arıyorum", "star yöntemi"], ["sky-interview-prep"]],
];

const found = [];
for (const [terms, skills] of MAP) {
  if (terms.some((t) => term(t).test(text))) for (const s of skills) if (!found.includes(s)) found.push(s);
  if (found.length >= 4) break;
}
if (!found.length) process.exit(0);

// Sky 5: yalnızca Türkiye'ye özgü skill'ler otomatik; diğerleri disable-model-invocation ile elle çağrılır.
const path = require("path");
const fs = require("fs");
const elle = (s) => {
  try {
    const t = fs.readFileSync(path.join(__dirname, "..", "skills", s, "SKILL.md"), "utf8");
    return /^disable-model-invocation:\s*true\s*$/m.test(t.split(/\n---/)[0]);
  } catch { return false; }
};
const sec = found.slice(0, 4), oto = sec.filter((s) => !elle(s)), man = sec.filter(elle);
const parcalar = [];
if (oto.length) parcalar.push(`bu istekle ilgili olabilecek skill'ler — ${oto.map((s) => "sky:" + s).join(", ")}. Uygunsa Skill aracıyla yükle; ilgisizse yok say.`);
if (man.length) parcalar.push(`elle çağrılan ilgili rehberler — ${man.map((s) => "/sky:" + s).join(", ")}. Bunları sen yükleyemezsin; gerekiyorsa kullanıcıya öner.`);
addContext("UserPromptSubmit", "Sky önerisi: " + parcalar.join(" Ayrıca "));
process.exit(0);
