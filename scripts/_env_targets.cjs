const fs = require('fs');
const s = fs.readFileSync('.env', 'utf8');
for (const l of s.split(/\r?\n/)) {
  const m = l.match(/^(DATABASE_URL|PLATFORM_DATABASE_URL|TENANT_DATABASE_URL)=(.*)$/);
  if (m) {
    try {
      const u = new URL(m[2].replace(/^['"]|['"]$/g, ''));
      console.log(m[1], u.hostname, u.pathname);
    } catch { console.log(m[1], 'unparseable'); }
  }
}
