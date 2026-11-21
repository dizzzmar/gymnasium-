// Genera config.js a partir de variables de entorno (se ejecuta al publicar: `node build-config.js`).
// Las variables se definen en el panel del alojamiento, nunca en el repositorio.
const fs = require('fs');

const url = (process.env.SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_ANON_KEY || '').trim();

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
  console.error('SUPABASE_URL falta o no tiene la forma https://<proyecto>.supabase.co');
  process.exit(1);
}
if (!key) {
  console.error('SUPABASE_ANON_KEY falta.');
  process.exit(1);
}

const out = 'window.APP_CONFIG = ' + JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }) + ';\n';
fs.writeFileSync('config.js', out);
console.log('config.js generado.');
