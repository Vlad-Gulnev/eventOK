const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static('docs'));

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

const DB_FILE = path.join(__dirname, 'data', 'db.json');
if (!fs.existsSync(path.dirname(DB_FILE))) fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    teams: [], tour1: {}, tour2: {}, tour3: {}, tour4: {},
    timer: { active: false, endTime: null, totalMinutes: 0 },
    speedBonus: { tour1: [], tour2: [], tour3: [] },
    blitz: { active: null, history: [] },
    videoStage: { phase: 'idle', endTime: null, answers: [], scores: {} },
    duelScores: {}
  }, null, 2));
}

function readDB() {
  try {
    const d = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    if (!d.blitz) d.blitz = { active: null, history: [] };
    if (!d.videoStage) d.videoStage = { phase: 'idle', endTime: null, answers: [], scores: {} };
    if (!d.duelScores) d.duelScores = {};
    return d;
  } catch (e) {
    return { teams: [], tour1: {}, tour2: {}, tour3: {}, tour4: {}, timer: {}, speedBonus: {}, blitz: { active: null, history: [] }, videoStage: { phase: 'idle', endTime: null, answers: [], scores: {} }, duelScores: {} };
  }
}
function writeDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

app.get('/api/status/global', (req, res) => {
  const db = readDB();
  if (db.teams.length === 0) return res.json({ tour1Done: false, tour2Done: false });
  const tour1Done = db.teams.every(t => db.tour1[t.id] && db.tour1[t.id].quiz && db.tour1[t.id].quiz.time);
  const tour2Done = db.teams.every(t => db.tour2[t.id] && db.tour2[t.id].time);
  res.json({ tour1Done, tour2Done });
});

const BLITZ_QUESTIONS = [
  { id: 1, title: 'Ситуация 1. Угроза в сети', images: ['img/anon1.webp', 'img/anon2.webp', 'img/anon3.webp', 'img/anon4.webp'], text: 'Что нужно делать в первую очередь, если тебе угрожают в интернете?', multiple: false, options: ['Ответить тем же', 'Сохранить скриншоты, заблокировать, рассказать старшим или в полицию', 'Просто удалить аккаунт', 'Ничего, это шутка'], correct: [1] },
  { id: 2, title: 'Ситуация 2. «Живые бомбы»', images: ['img/boom1.webp', 'img/boom2.webp', 'img/boom3.webp'], text: 'Как понять, что тебе предлагают опасную «подработку»? (отметь все верные)', multiple: true, options: ['Оплата слишком высокая за «несложную» работу', 'Просят никому не рассказывать', 'Просят передать посылку или сфотографировать объект', 'Есть официальный договор, сайт компании, прозрачные условия'], correct: [0, 1, 2] },
  { id: 3, title: 'Ситуация 3. Вовлечение через мошенничество', images: ['img/boom4.webp', 'img/boom5.webp', 'img/boom6.webp', 'img/boom7.webp'], text: 'Что ты сделаешь, если незнакомый человек (или знакомый) просит передать посылку?', multiple: false, options: ['Соглашусь, если платят хорошо', 'Спрошу, что внутри', 'Откажусь и предупрежу близких, если просят знакомые', 'Соглашусь, если человек выглядит надёжным'], correct: [2] },
  { id: 4, title: 'Ситуация 4. Как защитить себя', images: ['img/anon1.webp', 'img/boom7.webp'], text: 'Какие действия помогут защитить тебя и близких? (отметь все верные)', multiple: true, options: ['Рассказать близкому, если он нашёл «странную подработку»', 'Обращать внимание на бесхозные предметы', 'Не соглашаться передавать посылки, даже по просьбе знакомого', 'Сообщать о признаках вовлечения старшим или в полицию', 'Решать всё самому, никого не посвящать', 'Смеяться и не воспринимать серьёзно'], correct: [0, 1, 2, 3] },
  { id: 5, title: 'Ситуация 5. Один клик может привести к уголовному делу', images: ['img/case1-a.png', 'img/case1-b.png'], text: 'Что должно насторожить в поведении человека, который ещё не совершил преступление? (отметь все верные)', multiple: true, options: ['Изучение в интернете материалов по изготовлению взрывных устройств', 'Интерес к деструктивным сообществам и закрытым группам', 'Агрессивный контент в личных подборках', 'Обычный интерес к химии или технике'], correct: [0, 1, 2] },
  { id: 6, title: 'Ситуация 6. Что делать, если втягивают', images: ['img/case1-a.png', 'img/case1-b.png'], text: 'Что делать, если ты замечаешь, что тебя или друга втягивают в опасное сообщество?', multiple: false, options: ['Наблюдать дальше, чтобы понять до конца', 'Вовремя дистанцироваться и обратиться к близким, преподавателям или специалистам', 'Держать в тайне, чтобы не было проблем', 'Продолжать общаться — «авось, пронесёт»'], correct: [1] },
  { id: 7, title: 'Ситуация 7. Как манипуляторы используют молодёжь', images: ['img/case2-a.png', 'img/case2-b.png'], text: 'Почему молодые люди чаще становятся целью вербовщиков? (отметь все верные)', multiple: true, options: ['Ими легче манипулировать через страх', 'Через обещания заработка', 'Через чувство значимости и «своей» компании', 'Потому что они лучше разбираются в технологиях'], correct: [0, 1, 2] },
  { id: 8, title: 'Ситуация 8. Что нельзя делать по просьбе «куратора»', images: ['img/case2-a.png', 'img/case2-b.png'], text: 'Что нельзя делать, если незнакомый «куратор» просит выполнить поручение? (отметь все верные)', multiple: true, options: ['Передавать личные данные и документы', 'Переводить деньги по указанию третьих лиц', 'Соглашаться на действия, смысл которых скрывается', 'Уточнять детали у официальных источников'], correct: [0, 1, 2] },
  { id: 9, title: 'Ситуация 9. Телефонные мошенники', images: ['img/case3-a.png', 'img/case3-b.png'], text: 'Что должно насторожить в звонке от «сотрудника банка»? (отметь все верные)', multiple: true, options: ['Требование перевести деньги на «безопасный счёт»', 'Просьба никому не рассказывать о разговоре', 'Срочность и давление («действуйте прямо сейчас»)', 'Предложение прийти в отделение банка лично'], correct: [0, 1, 2] },
  { id: 10, title: 'Ситуация 10. Если стал жертвой — что делать', images: ['img/case3-a.png', 'img/case3-b.png'], text: 'Если ты понял, что стал жертвой мошенников или тебя втягивают — что делать?', multiple: false, options: ['Молчать, чтобы не было стыдно', 'Прекратить общение, рассказать близким и обратиться в банк или полицию', 'Продолжить разговор, чтобы «выиграть время»', 'Решить всё самостоятельно, никого не посвящая'], correct: [1] },
  { id: 11, title: 'Ситуация 11. «Пришли менять трубы»', images: ['img/scam-pipes.jpg'], text: 'Незнакомец в форме ЖКХ требует срочно заменить трубы и торопит с оплатой. Что делать?', multiple: false, options: ['Пустить и заплатить, чтобы избежать аварии', 'Попросить удостоверение и позвонить в управляющую компанию', 'Отказаться и прогнать его силой', 'Подписать договор без чтения'], correct: [1] },
  { id: 12, title: 'Ситуация 12. Платные реакции', images: ['img/tg-stars-case1.jpg', 'img/tg-stars-case2.jpg'], text: 'Что грозит за отправку «звезд» каналу, который собирает средства для террористов?', multiple: false, options: ['Штраф 5 000 рублей', 'Лишение свободы от 8 до 15 лет', 'Условный срок', 'Предупреждение'], correct: [1] },
  { id: 13, title: 'Ситуация 13. «Мне не хватает на проезд»', images: ['img/scam-transit.jpg'], text: 'Человек у метро плачет и просит 500 рублей на билет до дома, отказываясь от других вариантов помощи. Что это?', multiple: false, options: ['Человек действительно попал в беду', 'Тревожный признак мошенничества', 'Повод перевести деньги на карту', 'Нормальная ситуация, нужно помочь'], correct: [1] },
  { id: 14, title: 'Ситуация 14. Важное правило', images: ['img/tg-stars-def.jpg', 'img/tg-stars-rules.jpg'], text: 'Как проверить, безопасно ли переводить деньги или ставить платные реакции в канале?', multiple: false, options: ['Спросить у администратора канала', 'Проверить канал в списках ФСБ и Росфинмониторинга', 'Посмотреть количество подписчиков', 'Никак, это неважно'], correct: [1] },
  { id: 15, title: 'Ситуация 15. Дофаминовая ловушка', images: ['img/dopamine-trap.jpg'], text: 'Почему после употребления наркотиков жизнь кажется «серой»?', multiple: false, options: ['Развивается ангедония — мозг перестает радоваться обычным вещам', 'Это просто усталость', 'Так работает иммунитет', 'Человек просто капризничает'], correct: [0] },
  { id: 16, title: 'Ситуация 16. Что такое финансирование терроризма?', images: ['img/tg-stars-info.jpg', 'img/tg-stars-actions.jpg'], text: 'Что из этого может считаться финансированием терроризма?', multiple: false, options: ['Перевод на карту, отправка «звезд» и сбор донатов', 'Покупка товаров в обычном магазине', 'Помощь официальному приюту животных', 'Оплата коммунальных услуг'], correct: [0] },
  { id: 17, title: 'Ситуация 17. Как работает алгоритм', images: ['img/algo-trap-1.jpg', 'img/algo-trap-2.jpg'], text: 'Что современные алгоритмы соцсетей показывают пользователю?', multiple: false, options: ['Только то, что нравится', 'То, что вызывает сильные эмоции (включая злость и раздражение)', 'Только полезную и проверенную информацию', 'Только новости'], correct: [1] },
  { id: 18, title: 'Ситуация 18. Почему это опасно', images: ['img/algo-trap-3.jpg'], text: 'Чем больше времени ты проводишь в приложении, тем...', multiple: false, options: ['...лучше ты становишься', '...больше алгоритм предлагает похожего контента', '...быстрее находишь нужное', '...спокойнее твоя жизнь'], correct: [1] },
  { id: 19, title: 'Ситуация 19. Защита от алгоритма', images: ['img/algo-trap-4.jpg'], text: 'Как защититься от манипуляций алгоритмов?', multiple: false, options: ['Проводить в ленте больше времени', 'Ограничивать время, очищать рекомендации и искать информацию из разных источников', 'Читать только один паблик', 'Отключить интернет навсегда'], correct: [1] }
];

app.get('/api/blitz/questions', (req, res) => res.json(BLITZ_QUESTIONS));

app.post('/api/blitz/prepare', (req, res) => {
  const db = readDB();
  db.blitz.active = { status: 'preparation', players: [], teamResults: [] };
  writeDB(db);
  res.json({ ok: true });
});
app.post('/api/blitz/join', (req, res) => {
  const { teamId, playerName } = req.body;
  const db = readDB();
  const a = db.blitz.active;
  if (!a || a.status !== 'preparation') return res.status(400).json({ error: 'Идет другой этап' });
  const exists = a.players.find(p => String(p.teamId) === String(teamId) && p.playerName === playerName);
  if (!exists) { a.players.push({ teamId, playerName, status: 'ready' }); writeDB(db); }
  res.json({ ok: true });
});
app.post('/api/blitz/start', (req, res) => {
  const db = readDB();
  const a = db.blitz.active;
  if (!a || a.status !== 'preparation') return res.status(400).json({ error: 'Сначала запустите подготовку' });
  const qId = Math.floor(Math.random() * BLITZ_QUESTIONS.length) + 1;
  a.status = 'running';
  a.questionId = qId;
  a.startedAt = Date.now();
  a.endsAt = Date.now() + 60 * 1000;
  writeDB(db);
  res.json({ ok: true, active: a });
});
app.get('/api/blitz/active', (req, res) => {
  const db = readDB();
  const a = db.blitz.active;
  if (!a) return res.json({ active: false });
  const now = Date.now();
  const msLeft = a.endsAt ? Math.max(0, a.endsAt - now) : 0;
  if (a.status === 'running' && msLeft === 0) { finalizeBlitz(db, a); writeDB(db); }
  res.json({ blitz: a, timeLeftSec: Math.floor(msLeft / 1000), question: a.questionId ? BLITZ_QUESTIONS.find(q => q.id === a.questionId) : null });
});
app.post('/api/blitz/answer', (req, res) => {
  const { teamId, playerName, answer } = req.body;
  const db = readDB();
  const a = db.blitz.active;
  if (!a || a.status !== 'running') return res.status(400).json({ error: 'Вопрос не активен' });
  if (Date.now() > a.endsAt) return res.status(400).json({ error: 'Время вышло' });
  const player = a.players.find(p => String(p.teamId) === String(teamId) && p.playerName === playerName);
  if (!player) return res.status(400).json({ error: 'Игрок не найден' });
  if (player.status === 'eliminated') return res.status(400).json({ error: 'Вы уже выбыли' });
  if (player.status === 'answered') return res.status(400).json({ error: 'Вы уже ответили' });
  const teamWon = a.teamResults.find(t => String(t.teamId) === String(teamId));
  if (teamWon) return res.status(400).json({ error: 'Ваша команда уже дала верный ответ!' });
  const q = BLITZ_QUESTIONS.find(x => x.id === a.questionId);
  const given = answer.slice().sort().join(',');
  const correct = q.correct.slice().sort().join(',');
  if (given !== correct) {
    player.status = 'eliminated';
    writeDB(db);
    return res.status(400).json({ error: 'Неверно! Вы выбываете.' });
  }
  player.status = 'answered';
  const timeMs = Date.now() - a.startedAt;
  a.teamResults.push({ teamId, playerName, timeMs });
  a.teamResults.sort((x, y) => x.timeMs - y.timeMs);
  writeDB(db);
  res.json({ ok: true, message: 'Ответ принят!' });
});
app.post('/api/blitz/finish', (req, res) => {
  const db = readDB();
  const a = db.blitz.active;
  if (!a) return res.status(400).json({ error: 'Нет активного блица' });
  finalizeBlitz(db, a);
  writeDB(db);
  res.json({ ok: true });
});
app.post('/api/blitz/reset', (req, res) => {
  const db = readDB();
  db.blitz.active = null;
  writeDB(db);
  res.json({ ok: true });
});
function finalizeBlitz(db, a) {
  a.status = 'finished';
  const points = [5, 4, 3, 2, 1, 0, 0, 0, 0, 0];
  if (a.teamResults) {
    a.teamResults.forEach((ans, idx) => {
      ans.points = points[idx] || 0;
      if (!db.duelScores[ans.teamId]) db.duelScores[ans.teamId] = 0;
      db.duelScores[ans.teamId] += ans.points;
    });
  }
  db.blitz.history.push({ questionId: a.questionId, result: a.teamResults, finishedAt: new Date().toISOString() });
}

app.post('/api/video/video1', (req, res) => {
  const db = readDB();
  db.videoStage.phase = 'video1';
  db.videoStage.endTime = null;
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/video/questions', (req, res) => {
  const db = readDB();
  db.videoStage.phase = 'questions';
  db.videoStage.endTime = Date.now() + 90 * 1000;
  db.videoStage.answers = [];
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/video/video2', (req, res) => {
  const db = readDB();
  db.videoStage.phase = 'video2';
  db.videoStage.endTime = null;
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/video/finished', (req, res) => {
  const db = readDB();
  db.videoStage.phase = 'finished';
  db.videoStage.endTime = null;
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/video/reset', (req, res) => {
  const db = readDB();
  db.videoStage = { phase: 'idle', endTime: null, answers: [], scores: {} };
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/video/answer', (req, res) => {
  const { teamId, playerName, text } = req.body;
  const db = readDB();
  if (db.videoStage.phase !== 'questions') return res.status(400).json({ error: 'Прием ответов закрыт' });
  if (Date.now() > db.videoStage.endTime) return res.status(400).json({ error: 'Время вышло' });
  const exists = db.videoStage.answers.find(a => String(a.teamId) === String(teamId));
  if (exists) return res.status(400).json({ error: 'Команда уже отправила ответ' });
  db.videoStage.answers.push({ teamId, playerName, text, time: new Date().toISOString() });
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/video/score', (req, res) => {
  const { teamId, score } = req.body;
  const db = readDB();
  if (!db.videoStage.scores) db.videoStage.scores = {};
  db.videoStage.scores[teamId] = Number(score);
  writeDB(db);
  res.json({ ok: true });
});

app.get('/api/video/active', (req, res) => {
  const db = readDB();
  const v = db.videoStage;
  if (!v || v.phase === 'idle') return res.json({ active: false });
  let timeLeftSec = 0;
  if (v.phase === 'questions' && v.endTime) {
    timeLeftSec = Math.max(0, Math.floor((v.endTime - Date.now()) / 1000));
  }
  res.json({
    active: true,
    phase: v.phase,
    endTime: v.endTime,
    timeLeftSec: timeLeftSec,
    answers: v.answers || [],
    scores: v.scores || {}
  });
});

function computeQualityBonus(t, db) {
  const t1 = db.tour1[t.id] || {};
  const t2 = db.tour2[t.id] || {};
  const t3 = db.tour3[t.id] || {};
  const t4 = db.tour4[t.id] || {};
  const bonus = { t1Quiz: 0, t1Case: 0, t2: 0, t3: 0, t4Objects: 0, t4Algos: 0, t4Misses: 0, total: 0 };

  if (t1.quiz && t1.quiz.correct >= 30) bonus.t1Quiz = 5;
  if (Array.isArray(t1.caseScore)) {
    const s = t1.caseScore.reduce((a, b) => a + (Number(b) || 0), 0);
    if (s === 10) bonus.t1Case = 3;
  }
  if (t2.correct >= 38) bonus.t2 = 3;
  if (Array.isArray(t3.score)) {
    const s = t3.score.reduce((a, b) => a + (Number(b) || 0), 0);
    if (s === 20) bonus.t3 = 3;
  }
  if (t4.stage1 && t4.stage1.totalMisses === 0) bonus.t4Misses = 3;

  bonus.total = bonus.t1Quiz + bonus.t1Case + bonus.t2 + bonus.t3 + bonus.t4Misses;
  return bonus;
}

function computeBadgesFromStats(s) {
  const badges = [];
  if (s.t1Quiz && s.t1Quiz.correct >= 30) badges.push({ id:'ideal_quiz', icon:'💎', title:'Идеальный квиз', desc:'30 из 30 в Туре 1' });
  if (s.t1Case && Array.isArray(s.t1Case.score)) {
    const sum = s.t1Case.score.reduce((a, b) => a + (Number(b) || 0), 0);
    if (sum === 10) badges.push({ id:'thinker', icon:'🧠', title:'Мыслитель', desc:'Кейс Тура 1 на 10/10' });
  }
  if (s.t2 && s.t2.correct >= 38) badges.push({ id:'immunity', icon:'🛡', title:'Иммунитет', desc:'38 из 38 в Туре 2' });
  if (s.t3 && Array.isArray(s.t3.score)) {
    const sum = s.t3.score.reduce((a, b) => a + (Number(b) || 0), 0);
    if (sum === 20) badges.push({ id:'content_master', icon:'📢', title:'Контент-мастер', desc:'20 из 20 в Туре 3' });
  }
  if (s.t4 && s.t4.stage1 && s.t4.stage1.totalMisses === 0) badges.push({ id:'sniper', icon:'🎯', title:'Снайпер', desc:'Без промахов в игре' });
  if (s.speedBonusTotal >= 5) badges.push({ id:'speed', icon:'⚡', title:'Скорость', desc:'Бонус за скорость в 2+ турах' });
  if (s.duelWins >= 2) badges.push({ id:'duelist', icon:'⚔️', title:'Дуэлянт', desc:'Победа в 2+ блицах' });
  return badges;
}

app.post('/api/timer/start', (req, res) => {
  const minutes = Number(req.body.minutes) || 15;
  const db = readDB();
  db.timer = { active: true, endTime: Date.now() + minutes * 60 * 1000, totalMinutes: minutes, startedAt: Date.now() };
  writeDB(db);
  res.json({ ok: true, timer: db.timer });
});
app.get('/api/timer/state', (req, res) => {
  const db = readDB();
  const t = db.timer || {};
  if (!t.active || !t.endTime) return res.json({ active: false });
  const now = Date.now();
  const msLeft = Math.max(0, t.endTime - now);
  res.json({ active: msLeft > 0, expired: msLeft === 0, totalMinutes: t.totalMinutes, minutesLeft: Math.floor(msLeft / 60000), secondsLeft: Math.floor((msLeft % 60000) / 1000), msLeft });
});
app.post('/api/timer/stop', (req, res) => {
  const db = readDB();
  db.timer = { active: false, endTime: null, totalMinutes: 0 };
  writeDB(db);
  res.json({ ok: true });
});

app.get('/api/teams', (req, res) => res.json(readDB().teams));
app.get('/api/teams/by-token', (req, res) => {
  const t = String(req.query.token || '').trim();
  const team = readDB().teams.find(x => String(x.token).trim() === t);
  if (!team) return res.status(404).json({ error: 'not found' });
  res.json(team);
});
app.post('/api/teams', (req, res) => {
  const db = readDB();
  const caseId = Math.floor(Math.random() * 4) + 1;
  const team = {
    id: db.teams.length + 1,
    name: (req.body.name || `Команда ${db.teams.length + 1}`).slice(0, 60),
    token: Math.random().toString(36).slice(2, 10),
    caseId, emoji: req.body.emoji || '🛡', color: req.body.color || '#157fc4',
    createdAt: new Date().toISOString()
  };
  db.teams.push(team);
  writeDB(db);
  res.json(team);
});

app.post('/api/tour1/quiz', (req, res) => {
  const { teamId, playerName, answers, correct, total } = req.body;
  const db = readDB();
  if (!db.tour1[teamId]) db.tour1[teamId] = { quiz: { submissions: [] } };
  if (!db.tour1[teamId].quiz.submissions) db.tour1[teamId].quiz.submissions = [];

  if (!db.tour1[teamId].quiz.time) db.tour1[teamId].quiz.time = new Date().toISOString();

  db.tour1[teamId].quiz.submissions = db.tour1[teamId].quiz.submissions.filter(s => s.name !== playerName);
  db.tour1[teamId].quiz.submissions.push({ name: playerName, correct, total, time: new Date().toISOString() });

  const sum = db.tour1[teamId].quiz.submissions.reduce((acc, sub) => acc + sub.correct, 0);
  db.tour1[teamId].quiz.correct = Math.round((sum / db.tour1[teamId].quiz.submissions.length) * 10) / 10;
  writeDB(db);
  res.json({ ok: true, teamAverage: db.tour1[teamId].quiz.correct });
});

app.post('/api/tour1/case', (req, res) => {
  const { teamId, playerName, caseTitle, answer } = req.body;
  const db = readDB();
  if (!db.tour1[teamId]) db.tour1[teamId] = {};
  if (!db.tour1[teamId].kase) db.tour1[teamId].kase = { submissions: [] };
  db.tour1[teamId].kase.caseTitle = caseTitle;
  db.tour1[teamId].kase.submissions.push({ name: playerName, answer, time: new Date().toISOString() });
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/admin/tour1/case-score', (req, res) => {
  const db = readDB();
  if (!db.tour1[req.body.teamId]) db.tour1[req.body.teamId] = {};
  db.tour1[req.body.teamId].caseScore = req.body.scores;
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/tour2', (req, res) => {
  const { teamId, playerName, answers, correct, total, duration } = req.body;
  const db = readDB();
  if (!db.tour2[teamId]) db.tour2[teamId] = { submissions: [] };
  if (!db.tour2[teamId].time) db.tour2[teamId].time = new Date().toISOString();

  db.tour2[teamId].submissions = db.tour2[teamId].submissions.filter(s => s.name !== playerName);
  db.tour2[teamId].submissions.push({ name: playerName, correct, duration, time: new Date().toISOString() });

  const sum = db.tour2[teamId].submissions.reduce((acc, sub) => acc + sub.correct, 0);
  db.tour2[teamId].correct = Math.round((sum / db.tour2[teamId].submissions.length) * 10) / 10;
  const maxDuration = Math.max(...db.tour2[teamId].submissions.map(s => s.duration || 0));
  db.tour2[teamId].duration = maxDuration;
  writeDB(db);
  res.json({ ok: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    cb(null, 'team' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const ALLOWED_MIMES = ['image/jpeg','image/png','image/webp','image/gif','application/pdf','video/mp4','video/webm'];
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => ALLOWED_MIMES.indexOf(file.mimetype) === -1 ? cb(new Error('Недопустимый тип файла')) : cb(null, true) });

app.post('/api/tour3/upload', upload.array('files', 10), (req, res) => {
  const { teamId, teamName, format, formatTitle, topic, topicTitle, description } = req.body;
  const db = readDB();
  if (db.tour3[teamId] && db.tour3[teamId].time) return res.json({ ok: true, bonus: 0 });
  let bonus = 0;
  if (!db.speedBonus.tour3) db.speedBonus.tour3 = [];
  if (db.speedBonus.tour3.length === 0) { bonus = 3; db.speedBonus.tour3.push(teamId); }
  else if (db.speedBonus.tour3.length === 1) { bonus = 2; db.speedBonus.tour3.push(teamId); }
  const fileUrls = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];
  const fileNames = req.files ? req.files.map(f => f.originalname) : [];
  db.tour3[teamId] = { teamId, teamName, format, formatTitle, topic, topicTitle, description, fileUrls, fileNames, bonus, time: new Date().toISOString() };
  writeDB(db);
  res.json({ ok: true, fileUrls, fileNames, bonus });
});

app.post('/api/admin/tour3/score', (req, res) => {
  const db = readDB();
  if (!db.tour3[req.body.teamId]) db.tour3[req.body.teamId] = {};
  db.tour3[req.body.teamId].score = req.body.scores;
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/tour4/stage1', (req, res) => {
  const db = readDB();
  if (!db.tour4[req.body.teamId]) db.tour4[req.body.teamId] = {};
  db.tour4[req.body.teamId].teamName = req.body.teamName;
  db.tour4[req.body.teamId].stage1 = req.body.stage1;
  db.tour4[req.body.teamId].time = new Date().toISOString();
  let autoPoints = 0;
  if (req.body.stage1 && req.body.stage1.levelResults) {
    req.body.stage1.levelResults.forEach(l => {
      if (l.found) autoPoints += 1;
      if (l.algoBuilt) autoPoints += 1;
    });
  }
  db.tour4[req.body.teamId].autoPoints = autoPoints;
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/tour4/stage2', (req, res) => {
  const { teamId, stage2, stage2Score } = req.body;
  const db = readDB();
  if (!db.tour4[teamId]) db.tour4[teamId] = {};
  db.tour4[teamId].stage2 = stage2;
  db.tour4[teamId].stage2Score = stage2Score;
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/admin/tour4/manual-score', (req, res) => {
  const { teamId, manualPoints } = req.body;
  const db = readDB();
  if (!db.tour4[teamId]) db.tour4[teamId] = {};
  db.tour4[teamId].manualScore = Number(manualPoints) || 0;
  writeDB(db);
  res.json({ ok: true });
});

function computeTeamStats(t, db) {
  const t1 = db.tour1[t.id] || {};
  const t2 = db.tour2[t.id] || {};
  const t3 = db.tour3[t.id] || {};
  const t4 = db.tour4[t.id] || {};

  const quiz = (t1.quiz && t1.quiz.correct) || 0;
  const quizBonus = (t1.quiz && t1.quiz.bonus) || 0;
  const caseScore = Array.isArray(t1.caseScore) ? t1.caseScore.reduce((a, b) => a + (Number(b) || 0), 0) : 0;

  let k = 1;
  if (t1.quiz && t1.quiz.total) {
    const p = (quiz / 30) * 100;
    if (p < 50) k = 1.25;
  }
  const quizWithK = Math.round(quiz * k * 100) / 100;

  const tour2 = t2.correct || 0;
  const tour3 = Array.isArray(t3.score) ? t3.score.reduce((a, b) => a + (Number(b) || 0), 0) : 0;
  const tour3Bonus = t3.bonus || 0;
  
  let tour2Bonus = 0;
  if (tour2 > 0) {
      const allValid = db.teams.map(tm => {
          const r = db.tour2[tm.id];
          if (r && r.correct > 0 && r.time) return { id: tm.id, duration: r.duration || 999999, time: new Date(r.time).getTime() };
          return null;
      }).filter(Boolean);
      allValid.sort((a,b) => a.duration - b.duration || a.time - b.time);
      const rank = allValid.findIndex(x => x.id === t.id);
      if (rank === 0) tour2Bonus = 3;
      else if (rank === 1) tour2Bonus = 2;
      else if (rank === 2) tour2Bonus = 1;
  }

  const t4s1Auto = t4.autoPoints || 0; 
  const t4s2 = t4.stage2Score || 0;
  const t4manual = t4.manualScore || 0;
  
  const videoScore = db.videoStage && db.videoStage.scores && db.videoStage.scores[t.id] ? Number(db.videoStage.scores[t.id]) : 0;

  const quality = computeQualityBonus(t, db);
  const speedBonusTotal = quizBonus + tour2Bonus + tour3Bonus;
  const duelScore = (db.duelScores && db.duelScores[t.id]) || 0;
  const duelWins = 0;

  const tour2Total = tour2 + tour2Bonus + quality.t2 + duelScore;
  const t1Total = Math.round((quizWithK + caseScore + quizBonus + quality.t1Quiz + quality.t1Case) * 100) / 100;
  const tour4 = t4s1Auto + t4s2 + t4manual + quality.t4Misses;
  
  const grand = Math.round((t1Total + tour2Total + tour3 + tour3Bonus + quality.t3 + tour4 + videoScore) * 100) / 100;

  const stats = {
    id: t.id, name: t.name, token: t.token, caseId: t.caseId,
    emoji: t.emoji || '🛡', color: t.color || '#157fc4',
    t1Quiz: { correct: quiz, correctK: quizWithK, coefficient: k, total: 30, bonus: quizBonus, quality: quality.t1Quiz, time: (t1.quiz && t1.quiz.time) || null, submissions: (t1.quiz && t1.quiz.submissions) || [] },
    t1Case: { title: (t1.kase && t1.kase.caseTitle) || null, submissions: (t1.kase && t1.kase.submissions) || [], time: (t1.kase && t1.kase.time) || null, score: t1.caseScore || [0,0,0], quality: quality.t1Case },
    t1Total: Math.round(t1Total * 100) / 100,
    t2: { correct: tour2, total: 38, bonus: tour2Bonus, quality: quality.t2, duelScore: duelScore, duelWins: duelWins, combinedTotal: tour2Total, time: t2.time || null, submissions: t2.submissions || [] },
    t3: { formatTitle: t3.formatTitle, topicTitle: t3.topicTitle, description: t3.description, fileUrls: t3.fileUrls, fileNames: t3.fileNames, time: t3.time, bonus: tour3Bonus, quality: quality.t3, score: t3.score || [0,0,0,0] },
    t3Total: tour3 + tour3Bonus + quality.t3,
    t4: { stage1: t4.stage1 || null, stage2: t4.stage2 || null, stage2Score: t4s2, autoPoints: t4s1Auto, manualScore: t4manual, bonus: 0, quality: { misses: quality.t4Misses, total: quality.t4Misses }, time: t4.time },
    t4Total: tour4,
    videoScore: videoScore,
    duelScore, duelWins, speedBonusTotal, qualityTotal: quality.total, grand
  };
  stats.badges = computeBadgesFromStats(stats);
  return stats;
}

app.get('/api/admin/all', (req, res) => {
  const db = readDB();
  res.json({ teams: db.teams.map(t => computeTeamStats(t, db)) });
});

app.get('/api/leaderboard', (req, res) => {
  const db = readDB();
  res.json({ teams: db.teams.map(t => {
    const s = computeTeamStats(t, db);
    return { id: s.id, name: s.name, emoji: s.emoji, color: s.color, grand: s.grand };
  })});
});

app.post('/api/admin/reset-tour', (req, res) => {
  const tour = String(req.body.tour || '1');
  const db = readDB();
  if (tour === '1') db.tour1 = {};
  else if (tour === '2') db.tour2 = {};
  else if (tour === '3') db.tour3 = {};
  else if (tour === '4') db.tour4 = {};
  if (!db.speedBonus) db.speedBonus = {};
  db.speedBonus['tour' + tour] = [];
  if (tour === '2') { db.blitz = { active: null, history: [] }; db.duelScores = {}; }
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/admin/clear-all', (req, res) => {
  if (req.body.confirm !== 'YES') return res.status(400).json({ error: 'confirm required' });
  writeDB({ teams: [], tour1: {}, tour2: {}, tour3: {}, tour4: {}, timer: { active: false }, speedBonus: {}, blitz: { active: null, history: [] }, videoStage: { phase: 'idle', endTime: null, answers: [], scores: {} }, duelScores: {} });
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
  next();
});

app.post('/api/admin/team/delete', (req, res) => {
  const { teamId } = req.body;
  const db = readDB();
  db.teams = db.teams.filter(t => String(t.id) !== String(teamId));
  if (db.tour1[teamId]) delete db.tour1[teamId];
  if (db.tour2[teamId]) delete db.tour2[teamId];
  if (db.tour3[teamId]) delete db.tour3[teamId];
  if (db.tour4[teamId]) delete db.tour4[teamId];
  if (db.duelScores && db.duelScores[teamId]) delete db.duelScores[teamId];
  writeDB(db);
  res.json({ ok: true });
});

app.listen(3000, () => {
  console.log('Сервер: http://localhost:3000');
});