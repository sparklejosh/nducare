const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'nducare.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
module.exports.DB_PATH = DB_PATH;
let db;
function open() {
db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK(role IN ('patient','doctor')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  specialty TEXT,
  bio TEXT,
  mdcn TEXT,
  fee INTEGER DEFAULT 0,
  avatar_hue INTEGER DEFAULT 160,
  gender TEXT,
  dob TEXT,
  blood_group TEXT,
  allergies TEXT,
  lat REAL, lng REAL,
  last_seen INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000)
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES users(id),
  doctor_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  symptoms TEXT,
  urgency TEXT DEFAULT 'routine',
  status TEXT NOT NULL DEFAULT 'requested',
  room_code TEXT NOT NULL UNIQUE,
  scheduled_at INTEGER,
  started_at INTEGER,
  ended_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000)
);
CREATE TABLE IF NOT EXISTS care_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id),
  diagnosis TEXT,
  notes TEXT,
  advice TEXT,
  tests TEXT DEFAULT '[]',
  prescriptions TEXT DEFAULT '[]',
  follow_up_days INTEGER,
  code TEXT UNIQUE,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000)
);
CREATE TABLE IF NOT EXISTS facilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT, area TEXT, phone TEXT,
  lat REAL NOT NULL, lng REAL NOT NULL,
  services TEXT DEFAULT '[]',
  rating REAL DEFAULT 4.0,
  hours TEXT, accreditation TEXT
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER UNIQUE REFERENCES appointments(id),
  doctor_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  comment TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_msg_room ON messages(room_code);
`);

// ---------- Seed ----------
function seed() {
  const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (count > 0) return;

  const hash = pw => bcrypt.hashSync(pw, 10);
  const ins = db.prepare(`INSERT INTO users (role,name,email,phone,password_hash,specialty,bio,mdcn,fee,avatar_hue,gender)
    VALUES (@role,@name,@email,@phone,@password_hash,@specialty,@bio,@mdcn,@fee,@avatar_hue,@gender)`);

  const doctors = [
    ['Dr. Adaeze Okonkwo', 'adaeze@nducare.ng', 'General Practice', 'Family physician with 11 years in primary care. Special interest in malaria, hypertension and diabetes management.', 'MDCN/R/41022', 3500, 162, 'female'],
    ['Dr. Chukwuemeka Nwosu', 'emeka@nducare.ng', 'Internal Medicine', 'Consultant physician, UNTH Ituku-Ozalla. Cardiometabolic disease, chest infections and chronic care.', 'MDCN/R/38810', 6000, 205, 'male'],
    ['Dr. Ngozi Eze', 'ngozi@nducare.ng', 'Paediatrics', 'Paediatrician passionate about child nutrition, fevers, and newborn care. Speaks Igbo and English.', 'MDCN/R/44510', 4500, 330, 'female'],
    ['Dr. Ifeanyi Obi', 'ifeanyi@nducare.ng', 'Dermatology', 'Skin, hair and nail conditions — eczema, acne, fungal infections, pigmentation.', 'MDCN/R/47091', 5000, 28, 'male'],
    ['Dr. Chioma Anyanwu', 'chioma@nducare.ng', "Obstetrics & Gynaecology", 'Antenatal care, fertility counselling, menstrual disorders and women’s wellness.', 'MDCN/R/40233', 5500, 290, 'female'],
    ['Dr. Obinna Madu', 'obinna@nducare.ng', 'Mental Health', 'Psychiatrist. Anxiety, depression, sleep, burnout. Judgement-free, confidential care.', 'MDCN/R/45877', 6000, 250, 'male'],
  ];
  const tx = db.transaction(() => {
    for (const [name, email, specialty, bio, mdcn, fee, hue, gender] of doctors) {
      ins.run({ role: 'doctor', name, email, phone: '+234 800 000 0000', password_hash: hash('doctor123'), specialty, bio, mdcn, fee, avatar_hue: hue, gender });
    }
    ins.run({ role: 'patient', name: 'Ada Nwachukwu', email: 'ada@demo.ng', phone: '+234 803 123 4567', password_hash: hash('patient123'), specialty: null, bio: null, mdcn: null, fee: 0, avatar_hue: 200, gender: 'female' });
    db.prepare("UPDATE users SET dob='1994-03-12', blood_group='O+', allergies='Penicillin' WHERE email='ada@demo.ng'").run();
  });
  tx();
}

function seedFacilities() {
  const count = db.prepare('SELECT COUNT(*) c FROM facilities').get().c;
  if (count > 0) return;
  const file = path.join(__dirname, 'data', 'facilities.json');
  if (!fs.existsSync(file)) return;
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ins = db.prepare(`INSERT INTO facilities (type,name,address,area,phone,lat,lng,services,rating,hours,accreditation)
    VALUES (@type,@name,@address,@area,@phone,@lat,@lng,@services,@rating,@hours,@accreditation)`);
  const tx = db.transaction(() => rows.forEach(r => ins.run({ ...r, services: JSON.stringify(r.services) })));
  tx();
}

seed();
seedFacilities();
return db;
}
module.exports.open = open;
