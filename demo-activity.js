// Seeds realistic-looking past activity (patients, consultations, care plans, payments, reviews)
// so dashboards and doctor profiles are not empty. Idempotent: skips if demo patients already exist.
// Usage: node scripts/demo-activity.js   (or set SEED_DEMO_ACTIVITY=1 on the server for first boot)
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
module.exports = function seedDemoActivity(db) {
  if (db.prepare("SELECT 1 FROM users WHERE email='chinedu.okafor@demo.ng'").get()) return 0;
  const hash = bcrypt.hashSync('patient123', 8);
  const names = ['Chinedu Okafor', 'Amaka Eze', 'Tobenna Nnaji', 'Ifeoma Ugwu', 'Kelechi Obi', 'Nneka Anozie', 'Uche Madu', 'Chiamaka Nwodo', 'Emeka Agu', 'Ogechi Ani', 'Somto Okeke', 'Adanna Chukwu', 'Ikenna Ede', 'Blessing Nnamani', 'Chidera Okonkwo', 'Obiageli Nwafor', 'Tochukwu Aneke', 'Ngozi Okoro', 'Ebuka Onyia', 'Chisom Udeh', 'Nnamdi Ugwuanyi', 'Kosisochukwu Eze', 'Precious Ogbu', 'Chukwudi Nweke'];
  const reasons = [['Fever and chills for 3 days', ['Fever', 'Headache', 'Body aches'], 'Uncomplicated malaria', [['Artemether/Lumefantrine', '80/480 mg', '4 tablets', 'twice daily', '3 days'], ['Paracetamol', '500 mg', '2 tablets', 'three times daily', '3 days']], ['Malaria Parasite', 'Full Blood Count']],
    ['Persistent cough and chest tightness', ['Cough', 'Shortness of breath'], 'Acute bronchitis', [['Amoxicillin/Clavulanate', '625 mg', '1 tablet', 'twice daily', '7 days']], ['Full Blood Count']],
    ['Headaches, BP reading 160/100 at pharmacy', ['Headache', 'Dizziness'], 'Hypertension, newly diagnosed', [['Amlodipine', '5 mg', '1 tablet', 'once daily', '30 days']], ['Electrolytes (E/U/Cr)', 'Lipid Profile', 'Fasting Blood Sugar']],
    ['Itchy rash on both arms', ['Rash/Itching'], 'Contact dermatitis', [['Hydrocortisone cream', '1%', 'thin layer', 'twice daily', '7 days'], ['Cetirizine', '10 mg', '1 tablet', 'at night', '5 days']], []],
    ['Child with fever and vomiting', ['Fever', 'Nausea/Vomiting'], 'Viral gastroenteritis', [['ORS', 'sachet', '1 sachet in 500 ml', 'after each loose stool', '3 days'], ['Zinc', '20 mg', '1 tablet', 'once daily', '10 days']], ['Stool Microscopy']],
    ['Missed period, feeling nauseous', ['Nausea/Vomiting', 'Fatigue'], 'Early pregnancy — booking antenatal', [['Folic acid', '5 mg', '1 tablet', 'once daily', '90 days']], ['Pregnancy Test (βhCG)', 'Blood Group & Genotype', 'HIV Screening', 'Hepatitis B Surface Antigen']],
    ['Cannot sleep, constant worry about work', ['Anxiety/Low mood', 'Insomnia'], 'Generalised anxiety', [], []],
    ['Burning when urinating', ['Painful urination'], 'Urinary tract infection', [['Nitrofurantoin', '100 mg', '1 capsule', 'twice daily', '5 days']], ['Urinalysis']],
    ['Increased thirst and frequent urination', ['Fatigue', 'Loss of appetite'], 'Type 2 diabetes — suspected', [['Metformin', '500 mg', '1 tablet', 'twice daily with food', '30 days']], ['Fasting Blood Sugar', 'HbA1c']],
    ['Sore throat and difficulty swallowing', ['Sore throat', 'Fever'], 'Bacterial tonsillitis', [['Amoxicillin', '500 mg', '1 capsule', 'three times daily', '7 days']], []]];
  const comments = ['Very patient and explained everything clearly.', 'Quick response, got my prescription in minutes.', 'Kind doctor, the lab directions were very helpful.', 'Felt listened to. Will use again.', 'Excellent. Saved me a trip to town.', 'Professional and thorough.', ''];
  const docs = db.prepare("SELECT id, fee FROM users WHERE role='doctor' ORDER BY id").all();
  const genCode = (n = 6) => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from(crypto.randomBytes(n)).map(b => a[b % a.length]).join(''); };
  const insU = db.prepare("INSERT INTO users (role,name,email,phone,password_hash,fee,avatar_hue,gender,created_at) VALUES ('patient',?,?,?,?,0,?,?,?)");
  const insA = db.prepare("INSERT INTO appointments (patient_id,doctor_id,reason,symptoms,urgency,status,room_code,started_at,ended_at,created_at,paid) VALUES (?,?,?,?,?,?,?,?,?,?,1)");
  const insP = db.prepare("INSERT INTO care_plans (appointment_id,diagnosis,notes,advice,tests,prescriptions,follow_up_days,code,created_at) VALUES (?,?,?,?,?,?,?,?,?)");
  const insPay = db.prepare("INSERT INTO payments (appointment_id,patient_id,amount,reference,status,created_at) VALUES (?,?,?,?, 'success', ?)");
  const insR = db.prepare("INSERT INTO reviews (appointment_id,doctor_id,patient_id,stars,comment,created_at) VALUES (?,?,?,?,?,?)");
  let n = 0;
  const tx = db.transaction(() => {
    const now = Date.now();
    names.forEach((name, i) => {
      const created = now - Math.floor((2 + i * 1.3) * 864e5) - Math.floor(Math.random() * 6e7);
      const email = name.toLowerCase().replace(/ /g, '.') + '@demo.ng';
      const pid = insU.run(name, email, '+234 80' + String(30000000 + i * 91733).slice(0, 8), hash, (i * 47) % 360, i % 2 ? 'female' : 'male', created).lastInsertRowid;
      const visits = 1 + (i % 3 === 0 ? 1 : 0);
      for (let v = 0; v < visits; v++) {
        const r = reasons[(i + v) % reasons.length]; const d = docs[(i + v) % docs.length];
        const at = created + Math.floor(Math.random() * 3.6e6) + v * 5 * 864e5; if (at > now) continue;
        const wait = (2 + Math.floor(Math.random() * 7)) * 60000, len = (7 + Math.floor(Math.random() * 12)) * 60000;
        const aid = insA.run(pid, d.id, r[0], JSON.stringify(r[1]), i % 4 === 0 ? 'soon' : 'routine', 'completed', genCode(8), at + wait, at + wait + len, at).lastInsertRowid;
        insP.run(aid, r[2], 'History and examination via video. Vitals reported by patient.', 'Complete the medication. Return if symptoms persist beyond 3 days or worsen.', JSON.stringify(r[4].map(t => ({ name: t }))), JSON.stringify(r[3].map(([drug, strength, dose, freq, dur]) => ({ drug, strength, dose, frequency: freq, duration: dur, qty: '', notes: '' }))), 7, 'NC-' + genCode(6), at + wait + len);
        insPay.run(aid, pid, d.fee, 'NC-DEMO-' + genCode(10), at + 60000);
        if (i % 5 !== 4) insR.run(aid, d.id, pid, i % 7 === 0 ? 4 : 5, comments[(i + v) % comments.length], at + wait + len + 600000);
        n++;
      }
    });
  });
  tx();
  return n;
};
if (require.main === module) { console.log('Run the server once with SEED_DEMO_ACTIVITY=1 instead (migrations must run first):\n  SEED_DEMO_ACTIVITY=1 npm start'); }
