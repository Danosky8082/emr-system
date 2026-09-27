// scripts/migrate-axios.js
//
// One-shot codemod: rewrites every hardcoded axios call like
//   axios.get('http://localhost:3000/api/patients', { headers: { Authorization: `Bearer ${token}` } })
// into
//   api.get('/patients')
//
// Usage:
//   node scripts/migrate-axios.js            # dry run — shows what would change
//   node scripts/migrate-axios.js --write    # actually rewrite the files
//
// Safe to re-run — files already migrated are skipped.

const fs = require('fs');
const path = require('path');

const DRY_RUN = !process.argv.includes('--write');
const SRC_DIR = path.join(__dirname, '..', 'emr-frontend', 'src');
const EXTENSIONS = new Set(['.js', '.jsx']);

// Skip these — they define the client themselves or need manual handling
const SKIP_FILES = new Set([
  path.join(SRC_DIR, 'api', 'client.js'),
  path.join(SRC_DIR, 'pages', 'SuperAdminDashboard.jsx'),
]);

// ============================================================
// TRANSFORM RULES
// ============================================================

function transform(source, filePath) {
  let out = source;
  let changes = 0;

  // ============================================================
  // RULE 1: axios.<method>('http://localhost:3000/api/...')  →  api.<method>('/...')
  //
  // We match ONLY the prefix (method + opening quote + `http://localhost:3000/api/`).
  // Everything after that — URL path, template interpolation, trailing args — is left
  // untouched. This means nested quotes inside ${...} no longer break the regex,
  // and template literals with trailing `{headers}` objects work too.
  // ============================================================
  out = out.replace(
    /axios\s*\.\s*(get|post|put|patch|delete)\s*\(\s*(['"`])http:\/\/localhost:3000\/api\//g,
    (match, method, quote) => {
      changes++;
      // Emit `api.<method>(<quote>/` — the `/` is the leading slash of the path
      return `api.${method}(${quote}/`;
    }
  );

  // ============================================================
  // RULE 2: Same, for URLs already using VITE_API_URL as the base
  // ============================================================
  out = out.replace(
    /axios\s*\.\s*(get|post|put|patch|delete)\s*\(\s*(['"`])\$\{import\.meta\.env\.VITE_API_URL\}\/api\//g,
    (match, method, quote) => {
      changes++;
      return `api.${method}(${quote}/`;
    }
  );

  // ============================================================
  // RULE 3: Strip redundant `{ headers: { Authorization: `Bearer ${token}` } }`
  //         from api.* calls — the client attaches the token automatically.
  // ============================================================
  out = out.replace(
    /(api\s*\.\s*(?:get|post|put|patch|delete)\s*\(\s*[^;]*?),\s*\{\s*headers\s*:\s*\{\s*Authorization\s*:\s*`Bearer \$\{token\}`\s*\}\s*\}\s*\)/gs,
    (match, before) => {
      if (match.includes('Authorization')) {
        changes++;
        return `${before})`;
      }
      return match;
    }
  );

  // ============================================================
  // RULE 3a: Variable assignments — `let url = 'http://localhost:3000/api/...'`
  //          becomes `let url = '/api/...'`
  //
  // Skips `baseURL:` config lines (handled manually).
  // ============================================================
  out = out.replace(
    /(['"`])http:\/\/localhost:3000(\/api\/[^'"`]*)\1/g,
    (match, quote, rest, offset, whole) => {
      const before = whole.slice(Math.max(0, offset - 20), offset);
      if (/baseURL\s*:\s*$/.test(before)) {
        return match;
      }
      changes++;
      return `${quote}${rest}${quote}`;
    }
  );

  // ============================================================
  // RULE 3c: Image URL builder — `http://localhost:3000/images/...`
  //          becomes `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/images/...`
  //
  // Images aren't served under /api and can't use the axios client (they're
  // loaded by <img src>), so we inline the env var directly.
  //
  // NOTE: the VITE_API_URL here still points at the base (without /api),
  // so we strip a trailing /api if one is present.
  // ============================================================
  out = out.replace(
    /(['"`])http:\/\/localhost:3000\/images\//g,
    (match, quote) => {
      changes++;
      return `${quote}\${(import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\\/api$/, '')}/images/`;
    }
  );

  // ============================================================
  // RULE 4: Ensure `api` is imported when the file uses it
  // ============================================================
  if (/\bapi\s*\.\s*(get|post|put|patch|delete)\b/.test(out)) {
    const hasImport =
      /import\s+api\s+from\s+['"][^'"]*api\/client['"]/.test(out) ||
      /import\s+\{\s*api\s*\}\s+from\s+['"][^'"]*api\/client['"]/.test(out);

    if (!hasImport) {
      const rel = path.relative(
        path.dirname(filePath),
        path.join(SRC_DIR, 'api', 'client')
      );
      const importPath = rel.startsWith('.') ? rel : `./${rel}`;
      const normalized = importPath.replace(/\\/g, '/');

      const lines = out.split('\n');
      let lastImportIdx = -1;
      for (let i = 0; i < Math.min(lines.length, 60); i++) {
        if (/^\s*import\s/.test(lines[i])) lastImportIdx = i;
      }
      if (lastImportIdx >= 0) {
        lines.splice(lastImportIdx + 1, 0, `import api from '${normalized}';`);
        out = lines.join('\n');
        changes++;
      }
    }
  }

  return { out, changes };
}

// ============================================================
// WALK THE TREE
// ============================================================

function walk(dir, onFile) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full, onFile);
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      onFile(full);
    }
  }
}

// ============================================================
// MAIN
// ============================================================

let totalFiles = 0;
let totalChanges = 0;
const summary = [];

walk(SRC_DIR, (filePath) => {
  if (SKIP_FILES.has(filePath)) return;

  const original = fs.readFileSync(filePath, 'utf8');
  const { out, changes } = transform(original, filePath);

  if (changes > 0) {
    totalFiles++;
    totalChanges += changes;
    const rel = path.relative(process.cwd(), filePath);
    summary.push(
      `  ${DRY_RUN ? '·' : '✓'} ${rel}  (${changes} change${changes > 1 ? 's' : ''})`
    );

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, out, 'utf8');
    }
  }
});

console.log('');
console.log('═'.repeat(70));
console.log(DRY_RUN ? '  DRY RUN — nothing written' : '  ✍️  Files rewritten');
console.log('═'.repeat(70));
summary.forEach((line) => console.log(line));
console.log('─'.repeat(70));
console.log(`  Files:    ${totalFiles}`);
console.log(`  Changes:  ${totalChanges}`);
console.log('═'.repeat(70));
console.log('');

if (DRY_RUN && totalChanges > 0) {
  console.log('👉 Run again with --write to apply:');
  console.log('   node scripts/migrate-axios.js --write');
  console.log('');
}