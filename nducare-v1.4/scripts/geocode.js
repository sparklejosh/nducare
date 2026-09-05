// One-off: geocode seed facilities via Nominatim (respecting 1 req/sec) and write data/facilities.json
const fs = require('fs');
const path = require('path');

const AREAS = { // fallback centroids in Enugu
  'GRA': [6.4519, 7.5023], 'New Haven': [6.4581, 7.5230], 'Independence Layout': [6.4390, 7.5145],
  'Ogui New Layout': [6.4430, 7.4990], 'Achara Layout': [6.4210, 7.4990], 'Uwani': [6.4350, 7.4930],
  'Asata': [6.4470, 7.4960], 'Trans-Ekulu': [6.4780, 7.5230], 'Abakpa Nike': [6.4790, 7.5380],
  'Garriki': [6.4060, 7.4900], 'Emene': [6.4700, 7.5720], 'Ogui Road': [6.4380, 7.4970]
};

const labs = [
  ['SYNLAB Nigeria (Enugu)', '26A Forest Crescent, by Parklane Teaching Hospital, GRA', 'GRA', '0700 079 6522', 'Forest Crescent, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Fasting Blood Sugar','HbA1c','Lipid Profile','Liver Function Test','Kidney Function Test','Electrolytes (E/U/Cr)','Urinalysis','Thyroid Function Test','HIV Screening','Hepatitis B Surface Antigen','Pregnancy Test (βhCG)','Stool Microscopy','PSA','Blood Group & Genotype','COVID-19 PCR'], 4.7],
  ['Conquest Medical Imaging', '18 Abakaliki Road, GRA', 'GRA', '0703 406 6198', 'Abakaliki Road, Enugu', ['Ultrasound Scan','X-Ray','CT Scan','MRI','Mammogram','ECG','Echocardiogram','Bone Densitometry'], 4.5],
  ['Spectrum Medical Laboratory', '6 Market Road, Ogui New Layout', 'Ogui New Layout', '0803 473 0673', 'Market Road, Ogui, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Fasting Blood Sugar','Urinalysis','Pregnancy Test (βhCG)','Stool Microscopy','Blood Group & Genotype','HIV Screening','Hepatitis B Surface Antigen'], 4.2],
  ['Adonai Stelmon Medical Laboratory', '46 Chime Avenue, New Haven', 'New Haven', '0703 038 5009', 'Chime Avenue, New Haven, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Fasting Blood Sugar','Lipid Profile','Liver Function Test','Kidney Function Test','Urinalysis','Hepatitis B Surface Antigen','HIV Screening','Blood Group & Genotype','Semen Analysis'], 4.4],
  ['Chimos Medical Diagnostic Laboratory', '28 Owerri Road, Asata', 'Asata', '0803 393 2381', 'Owerri Road, Asata, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Ultrasound Scan','CT Scan','X-Ray','Fasting Blood Sugar','Urinalysis','Liver Function Test','Kidney Function Test','ECG'], 4.3],
  ['Graceland Laboratories & Scan Centre', '19/35 Chime Avenue, New Haven', 'New Haven', '0803 700 4878', 'Chime Avenue, New Haven, Enugu', ['Full Blood Count','Malaria Parasite','Ultrasound Scan','Widal Test','Fasting Blood Sugar','Pregnancy Test (βhCG)','Urinalysis','Hepatitis B Surface Antigen','HIV Screening','Lipid Profile'], 4.1],
  ['Immaculate Diagnostics', '57 Obioma Street, by Amokwe Bus Stop, Achara Layout', 'Achara Layout', '0803 593 3286', 'Obioma Street, Achara Layout, Enugu', ['Full Blood Count','Malaria Parasite','Ultrasound Scan','Widal Test','Fasting Blood Sugar','Urinalysis','Stool Microscopy','Blood Group & Genotype','Liver Function Test'], 4.0],
  ['Landmark Medical Laboratory Services', '168 Agbani Road, by Igbariam Bus Stop, Achara Layout', 'Achara Layout', '0803 401 9267', 'Agbani Road, Achara Layout, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Fasting Blood Sugar','Urinalysis','Pregnancy Test (βhCG)','HIV Screening','Blood Group & Genotype'], 3.9],
  ['McChuks Medical Diagnostic Centre', '2 Ohafia Street, by Zik Avenue, Uwani', 'Uwani', '0803 669 6165', 'Ohafia Street, Uwani, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Fasting Blood Sugar','HbA1c','Lipid Profile','Liver Function Test','Kidney Function Test','Electrolytes (E/U/Cr)','Urinalysis','Ultrasound Scan','ECG','PSA'], 4.4],
  ['Medichem Laboratories', '1 Udorji Street, Ogui New Layout', 'Ogui New Layout', '0803 342 7483', 'Ogui New Layout, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Ultrasound Scan','Fasting Blood Sugar','Urinalysis','Hepatitis B Surface Antigen','HIV Screening','Thyroid Function Test'], 4.2],
  ['Mekon Medical Diagnostic Services', 'Bank Avenue, opp. CBN Quarters, Trans-Ekulu', 'Trans-Ekulu', '', 'Trans-Ekulu, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Fasting Blood Sugar','Urinalysis','Pregnancy Test (βhCG)','Stool Microscopy','Blood Group & Genotype'], 4.0],
  ['Panacea Medical Laboratory', '9 Edozie Street, Uwani', 'Uwani', '0803 342 2098', 'Uwani, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Fasting Blood Sugar','Urinalysis','Stool Microscopy','Microbiology Culture & Sensitivity','Blood Group & Genotype'], 4.1],
  ['Praise-Worth Clinics & Diagnostic Centre', '54 Obiagu Road, by Ebe-Lane Bus Stop, Ogui New Layout', 'Ogui New Layout', '0803 774 1533', 'Obiagu Road, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Fasting Blood Sugar','Lipid Profile','Liver Function Test','Kidney Function Test','Urinalysis','Ultrasound Scan','X-Ray','ECG'], 4.6],
  ['Heritage Medical Laboratories', '366 Agbani Road, opp. Army Barracks, Garriki', 'Garriki', '', 'Agbani Road, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Fasting Blood Sugar','Urinalysis','Pregnancy Test (βhCG)','HIV Screening'], 3.8],
  ['Cynbald Laboratory', 'Abia Street, Abakpa Nike', 'Abakpa Nike', '', 'Abakpa Nike, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Fasting Blood Sugar','Urinalysis','Stool Microscopy','Blood Group & Genotype','Hepatitis B Surface Antigen'], 3.9],
  ['Goldlife Medical Laboratory', '94/108 Nike Road', 'Abakpa Nike', '', 'Nike Road, Enugu', ['Full Blood Count','Malaria Parasite','Widal Test','Fasting Blood Sugar','Urinalysis','Pregnancy Test (βhCG)','HIV Screening','Blood Group & Genotype','Liver Function Test'], 4.0],
];

const pharmacies = [
  ['HealthPlus Pharmacy (Polo Park)', 'Polo Park Mall, Savage Crescent, Abakaliki Road, GRA', 'GRA', '', 'Polo Park Mall, Enugu', ['Prescription dispensing','Home delivery','HMO accepted','Pharmacist consultation','Cold chain (vaccines/insulin)'], 4.6, '08:00-21:00'],
  ['Medplus Pharmacy (Spar)', 'Spar Mall, off Ishielu Street, opp. Michael Okpara Square, Independence Layout', 'Independence Layout', '0909 118 6816', 'Michael Okpara Square, Enugu', ['Prescription dispensing','Home delivery','HMO accepted','Pharmacist consultation','Cold chain (vaccines/insulin)'], 4.5, '08:00-21:00'],
  ["God's Glory Pharmacy", '62 Chime Avenue, New Haven', 'New Haven', '0805 281 8602', 'Chime Avenue, New Haven, Enugu', ['Prescription dispensing','Pharmacist consultation','Blood pressure check'], 4.3, '08:00-22:00'],
  ['Best Option Pharmacy', '20 Chime Avenue, New Haven', 'New Haven', '0815 568 9719', 'Chime Avenue, New Haven, Enugu', ['Prescription dispensing','Pharmacist consultation'], 4.1, '08:00-21:00'],
  ['Nigus Pharmacy', '4 Presidential Road, Independence Layout', 'Independence Layout', '0807 623 9248', 'Presidential Road, Enugu', ['Prescription dispensing','Home delivery','Pharmacist consultation'], 4.2, '08:00-22:00'],
  ['Corex Pharmacy', '1 Mike Torey Lane, Phase 6, Trans-Ekulu', 'Trans-Ekulu', '0803 795 3701', 'Trans-Ekulu, Enugu', ['Prescription dispensing','Pharmacist consultation','Blood pressure check'], 4.0, '08:00-21:00'],
  ['Henlil Pharmacy', 'Discovery Plaza, 96/98 Chime Avenue, New Haven', 'New Haven', '0803 806 0680', 'Chime Avenue, New Haven, Enugu', ['Prescription dispensing','Home delivery','Pharmacist consultation','24 hours'], 4.4, '00:00-23:59'],
  ['Addcare Pharmacy', '35 Uduma Street, behind Dome Event Centre, New Haven', 'New Haven', '0811 394 1494', 'Uduma Street, New Haven, Enugu', ['Prescription dispensing','Pharmacist consultation','Blood pressure check','Blood sugar check'], 4.2, '08:00-22:00'],
  ['Renhocks Pharmacy', '83 Park Avenue, GRA', 'GRA', '0818 706 5470', 'Park Avenue, GRA, Enugu', ['Prescription dispensing','Home delivery','HMO accepted','Pharmacist consultation'], 4.3, '08:00-22:00'],
  ['Marlock Pharmacy', '12/28 Lower Chime Avenue, New Haven', 'New Haven', '0803 338 6746', 'Chime Avenue, New Haven, Enugu', ['Prescription dispensing','Pharmacist consultation'], 4.0, '08:00-21:00'],
  ['Symbolcare Pharmacy', '11-13 Ezillo Avenue, Independence Layout', 'Independence Layout', '0815 410 6392', 'Ezillo Avenue, Independence Layout, Enugu', ['Prescription dispensing','Home delivery','Pharmacist consultation','Blood pressure check'], 4.3, '08:00-22:00'],
  ['Stamford Pharmacy', '3 Ogui Road, Achara', 'Ogui Road', '0803 300 7369', 'Ogui Road, Enugu', ['Prescription dispensing','Pharmacist consultation'], 3.9, '08:00-21:00'],
  ['Gabbey Pharmacy', '8 Awkunanaw Street, Uwani', 'Uwani', '0803 353 5058', 'Awkunanaw Street, Uwani, Enugu', ['Prescription dispensing','Pharmacist consultation','Blood pressure check'], 4.1, '08:00-21:00'],
  ['Healthblaze Pharmacy', '184 Ogui Road, Achara', 'Ogui Road', '0904 020 5711', 'Ogui Road, Enugu', ['Prescription dispensing','Home delivery','Pharmacist consultation'], 4.2, '08:00-22:00'],
  ['Alpha Pharmacy', '32 Edinburgh Road, by College Road, Ogui New Layout', 'Ogui New Layout', '0809 834 6916', 'Edinburgh Road, Enugu', ['Prescription dispensing','HMO accepted','Pharmacist consultation','Cold chain (vaccines/insulin)'], 4.4, '08:00-21:00'],
  ['Bertsons Pharmacy', '51 Chime Avenue, New Haven', 'New Haven', '0806 267 4213', 'Chime Avenue, New Haven, Enugu', ['Prescription dispensing','Pharmacist consultation'], 4.0, '08:00-21:00'],
  ['Modern Pharmacy', '1 Nomeh Drive, Trans-Ekulu', 'Trans-Ekulu', '0803 302 7741', 'Trans-Ekulu, Enugu', ['Prescription dispensing','Pharmacist consultation','Blood pressure check'], 4.1, '08:00-21:00'],
  ['More Days Pharmacy', '9 College Road, Abakpa Nike', 'Abakpa Nike', '0806 397 2767', 'College Road, Abakpa Nike, Enugu', ['Prescription dispensing','Pharmacist consultation'], 3.9, '08:00-22:00'],
  ['Leonard Pharmacy & Stores', '10 Bisala Road, Independence Layout', 'Independence Layout', '0806 013 8001', 'Bisalla Road, Independence Layout, Enugu', ['Prescription dispensing','Pharmacist consultation','Home delivery'], 4.0, '08:00-21:00'],
  ['Zinna Pharmacy', 'Prince Plaza, 2 Unije Street, Asata', 'Asata', '0902 200 9232', 'Asata, Enugu', ['Prescription dispensing','Pharmacist consultation'], 4.0, '08:00-21:00'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const cache = {};
async function geocode(q) {
  if (cache[q]) return cache[q];
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ng&q=' + encodeURIComponent(q);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'NduCare-seed/1.0 (dev)' } });
    const j = await r.json();
    if (j[0]) { cache[q] = [+j[0].lat, +j[0].lon]; return cache[q]; }
  } catch (e) { console.error('geocode fail', q, e.message); }
  return null;
}
// deterministic small jitter so facilities on the same street don't stack
function jitter(i) { const a = (i * 137.5) % 360 * Math.PI / 180; const d = 0.0012 + (i % 3) * 0.0006; return [Math.sin(a) * d, Math.cos(a) * d]; }

(async () => {
  const out = [];
  let i = 0;
  for (const [type, rows] of [['lab', labs], ['pharmacy', pharmacies]]) {
    for (const row of rows) {
      const [name, address, area, phone, q, services, rating, hours] = row;
      let c = await geocode(q); await sleep(1100);
      if (!c || Math.abs(c[0] - 6.44) > 0.12 || Math.abs(c[1] - 7.51) > 0.12) { console.log('fallback for', name); c = AREAS[area]; }
      const [dj, dk] = jitter(i++);
      out.push({ type, name, address: address + ', Enugu', area, phone, lat: +(c[0] + dj).toFixed(6), lng: +(c[1] + dk).toFixed(6), services, rating, hours: hours || '07:30-19:00',
        accreditation: type === 'lab' ? 'MLSCN' : 'PCN' });
      console.log(type, name, c);
    }
  }
  fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'facilities.json'), JSON.stringify(out, null, 1));
  console.log('wrote', out.length);
})();
