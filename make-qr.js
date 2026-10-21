const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const BASE_URL = 'http://localhost:3000'; // потом заменим на домен

const DB_FILE = path.join(__dirname, 'data', 'db.json');
const OUT_DIR = path.join(__dirname, 'public', 'qr');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));

if (db.teams.length === 0) {
  console.log('Нет команд в базе. Сначала зарегистрируйте их через /join.html');
  process.exit(0);
}

(async () => {
  for (const team of db.teams) {
    const url = `${BASE_URL}/join.html?token=${team.token}&team=${team.id}`;
    const file = path.join(OUT_DIR, `team-${team.id}.png`);
    await QRCode.toFile(file, url, { width: 400, margin: 2 });
    console.log(`✔ ${team.name} → ${file}`);
    console.log(`   ссылка: ${url}`);
  }
  console.log('\nГотово. Картинки в public/qr/');
})();