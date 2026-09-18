// prisma/seed.js — COMPLETE MULTI-TENANT SEED
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DEFAULT_TENANT_ID = 'default-hospital-id';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://postgres:12345678@127.0.0.1:5433/emr_db?schema=public',
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database (multi-tenant)...');
  console.log(`🏢 Tenant: ${DEFAULT_TENANT_ID}\n`);

  const now = new Date();
  const T = DEFAULT_TENANT_ID;

  try {
    // ============================================================
// 0. HOSPITALS (TENANTS) — must exist first
// ============================================================
console.log('🏥 Hospitals (tenants)...');

const HOSPITALS = [
  {
    id: 'default-hospital-id',
    name: 'CareTech General Hospital',       // ← renamed from "Default General Hospital"
    slug: 'default-hospital',
    code: 'DEFAULT-HOSP',
    usernamePrefix: 'caretech',              // ← NEW
    email: 'info@hospital.com',
    phone: '08000000000',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    primaryColor: '#0f3460',
    secondaryColor: '#1a4a7a',
  },
  {
    id: 'st-marys-hospital-id',
    name: "St. Mary's Hospital",
    slug: 'st-marys',
    code: 'STMARYS',
    usernamePrefix: 'stmarys',               // ← NEW
    email: 'info@stmarys.health',
    phone: '08000000002',
    city: 'Abuja',
    state: 'FCT',
    country: 'Nigeria',
    primaryColor: '#dc2626',
    secondaryColor: '#991b1b',
  },
];

for (const h of HOSPITALS) {
  await prisma.hospital.upsert({
    where: { id: h.id },
    update: { updatedAt: now },
    create: {
      ...h,
      plan: 'trial',
      status: 'active',
      isActive: true,
    },
  });
  console.log(`  ✅ ${h.name} (${h.slug})`);
}
    // ============================================================
// 1. HOSPITAL SETTINGS — one per hospital
// ============================================================
console.log('\n⚙️  Hospital settings...');

const SETTINGS_PER_HOSPITAL = {
  'default-hospital-id': {
    registrationFee: 2000,
    cardFee: 1000,
    consultationFee: 5000,
  },
  'st-marys-hospital-id': {
    registrationFee: 3000,
    cardFee: 1500,
    consultationFee: 7500,
  },
};

for (const [hospitalId, s] of Object.entries(SETTINGS_PER_HOSPITAL)) {
  await prisma.hospitalSettings.upsert({
    where: { tenantId: hospitalId },
    update: { ...s, updatedAt: now },
    create: {
      tenantId: hospitalId,
      hospitalId,
      ...s,
      nhisMultiplier: 0.1,
      retainerMultiplier: 2.0,
      autoArchiveHours: 24,
      appointmentDuration: 30,
      enablePatientPortal: true,
      enableKioskMode: true,
      currency: 'NGN',
      currencySymbol: '₦',
      timezone: 'Africa/Lagos',
    },
  });
  console.log(`  ✅ Settings for ${hospitalId}`);
}
    // ============================================================
    // 2. SERVICE CONFIGURATIONS
    // ============================================================
    console.log('\n💰 Service configurations...');
    const serviceConfigs = [
      { serviceType: 'REGISTRATION', name: 'Registration Fee', description: 'One-time registration fee', baseAmount: 2000 },
      { serviceType: 'CARD', name: 'ID Card Fee', description: 'Patient ID card printing fee', baseAmount: 1000 },
      { serviceType: 'CONSULTATION', name: 'Consultation Fee', description: 'Standard consultation fee', baseAmount: 5000 },
    ];
    for (const sc of serviceConfigs) {
      await prisma.serviceConfiguration.upsert({
        where: { tenantId_serviceType: { tenantId: T, serviceType: sc.serviceType } },
        update: { ...sc, updatedAt: now },
        create: { ...sc, tenantId: T, isActive: true, updatedAt: now },
      });
    }
    console.log(`  ✅ ${serviceConfigs.length} configs`);

    // ============================================================
    // 3. CLINICS (from your SQL)
    // ============================================================
    console.log('\n🏥 Clinics...');
    const clinics = [
      { name: 'General Outpatient', description: 'General outpatient services', location: 'Ground Floor, Block A' },
      { name: 'Paediatrics', description: 'Paediatric care for children', location: 'First Floor, Block B' },
      { name: 'Obstetrics & Gynaecology', description: "Women's health and maternity", location: 'Second Floor, Block A' },
      { name: 'Internal Medicine', description: 'Adult medical care', location: 'Ground Floor, Block C' },
      { name: 'Surgery', description: 'Surgical consultations', location: 'First Floor, Block C' },
      { name: 'Postnatal Clinic', description: 'Post-delivery care services', location: "Women's Wing, Ground Floor" },
      { name: 'Family Planning Clinic', description: 'Family planning and reproductive health', location: "Women's Wing, 1st Floor" },
      { name: 'Nutrition Clinic', description: 'Nutritional counseling and support', location: 'Main Building, Ground Floor' },
      { name: 'Diabetes/Endocrinology Clinic', description: 'Diabetes and endocrine disorders', location: 'Main Building, 1st Floor' },
      { name: 'Cardiology Clinic', description: 'Heart and cardiovascular services', location: 'Main Building, 2nd Floor' },
      { name: 'Neurology Clinic', description: 'Brain and nervous system services', location: 'Main Building, 2nd Floor' },
      { name: 'Oncology Clinic', description: 'Cancer care services', location: 'Oncology Wing, Ground Floor' },
      { name: 'Renal Clinic', description: 'Kidney care services', location: 'Renal Wing, Ground Floor' },
      { name: 'Respiratory Clinic', description: 'Lung and respiratory services', location: 'Main Building, 1st Floor' },
      { name: 'Gastroenterology Clinic', description: 'Digestive system services', location: 'Main Building, 1st Floor' },
      { name: 'Rheumatology Clinic', description: 'Autoimmune and joint disorders', location: 'Main Building, 2nd Floor' },
      { name: 'Haematology Clinic', description: 'Blood disorders services', location: 'Main Building, 1st Floor' },
    ];
    for (const c of clinics) {
      await prisma.clinic.upsert({
        where: { tenantId_name: { tenantId: T, name: c.name } },
        update: { ...c, updatedAt: now },
        create: { ...c, tenantId: T, isActive: true, updatedAt: now },
      });
    }
    console.log(`  ✅ ${clinics.length} clinics`);

    // ============================================================
    // 4. WARDS (from your SQL)
    // ============================================================
    console.log('\n🛏️  Wards...');
    const wards = [
      { name: 'Medical Ward (Male)', description: 'General medical care for male patients', capacity: 30 },
      { name: 'Medical Ward (Female)', description: 'General medical care for female patients', capacity: 30 },
      { name: 'Surgical Ward (Male)', description: 'Surgical care for male patients', capacity: 25 },
      { name: 'Surgical Ward (Female)', description: 'Surgical care for female patients', capacity: 25 },
      { name: 'Paediatric Ward', description: 'Care for children and infants', capacity: 20 },
      { name: 'Maternity Ward', description: 'Maternity and delivery care', capacity: 25 },
      { name: 'Labour Ward', description: 'Labour and delivery suites', capacity: 10 },
      { name: 'Antenatal Ward', description: 'Pregnancy care and monitoring', capacity: 15 },
      { name: 'Postnatal Ward', description: 'Post-delivery care for mothers', capacity: 20 },
      { name: 'ICU - Intensive Care Unit', description: 'Critical care for seriously ill patients', capacity: 10 },
      { name: 'HDU - High Dependency Unit', description: 'High dependency care', capacity: 10 },
      { name: 'Neonatal ICU (NICU)', description: 'Special care for newborns', capacity: 15 },
      { name: 'Orthopaedic Ward', description: 'Bone and joint care', capacity: 20 },
      { name: 'Oncology Ward', description: 'Cancer care unit', capacity: 15 },
      { name: 'Psychiatric Ward', description: 'Mental health care', capacity: 15 },
      { name: 'Isolation Ward', description: 'Isolation for infectious diseases', capacity: 10 },
      { name: 'Daycare Ward', description: 'Day care procedures and observation', capacity: 10 },
      { name: 'Private Ward (Premium)', description: 'Premium private care', capacity: 5 },
      { name: 'VIP Ward', description: 'VIP care suites', capacity: 3 },
      { name: 'General Ward', description: 'General ward care', capacity: 40 },
      { name: 'Recovery Ward', description: 'Post-surgery recovery', capacity: 15 },
      { name: 'Burns Unit', description: 'Burn care and treatment', capacity: 8 },
      { name: 'Dialysis Unit', description: 'Dialysis treatment', capacity: 10 },
    ];
    for (const w of wards) {
      await prisma.ward.upsert({
        where: { tenantId_name: { tenantId: T, name: w.name } },
        update: { ...w, updatedAt: now },
        create: { ...w, tenantId: T, updatedAt: now },
      });
    }
    console.log(`  ✅ ${wards.length} wards`);

    // ============================================================
    // 5. SERVICE PRICING (from your SQL)
    // ============================================================
    console.log('\n💲 Service pricing...');
    const services = [
      // Consultation
      ['General Consultation', 'Standard general consultation', 'FPP', 5000, 500, 10000],
      ['Specialist Consultation', 'Consultation with specialist doctor', 'FPP', 10000, 1000, 20000],
      ['Emergency Consultation', 'Emergency/urgent consultation', 'FPP', 7500, 750, 15000],
      ['Follow-up Consultation', 'Follow-up consultation visit', 'FPP', 3000, 300, 6000],
      ['Home Visit Consultation', 'Doctor home visit service', 'FPP', 15000, 1500, 30000],
      // Lab
      ['Full Blood Count (FBC)', 'Complete blood count test', 'Lab', 3500, 350, 7000],
      ['Malaria Test', 'Malaria parasite detection', 'Lab', 2000, 200, 4000],
      ['Typhoid Test (Widal)', 'Typhoid fever test', 'Lab', 2500, 250, 5000],
      ['Urinalysis', 'Urine analysis test', 'Lab', 1500, 150, 3000],
      ['Stool Analysis', 'Stool examination test', 'Lab', 2000, 200, 4000],
      ['Blood Culture', 'Blood culture and sensitivity', 'Lab', 5000, 500, 10000],
      ['Urine Culture', 'Urine culture and sensitivity', 'Lab', 4000, 400, 8000],
      ['Sputum Culture', 'Sputum culture and sensitivity', 'Lab', 4500, 450, 9000],
      ['Wound Swab Culture', 'Wound swab culture and sensitivity', 'Lab', 4000, 400, 8000],
      ['HIV Test', 'HIV antibody test', 'Lab', 3000, 300, 6000],
      ['Hepatitis B Test', 'Hepatitis B surface antigen test', 'Lab', 3500, 350, 7000],
      ['Hepatitis C Test', 'Hepatitis C antibody test', 'Lab', 3500, 350, 7000],
      ['Syphilis Test', 'Syphilis screening test', 'Lab', 2500, 250, 5000],
      ['Blood Glucose Test', 'Blood glucose level test', 'Lab', 1000, 100, 2000],
      ['Lipid Profile', 'Cholesterol and lipid test', 'Lab', 4000, 400, 8000],
      ['Liver Function Test', 'Liver enzyme and function test', 'Lab', 5000, 500, 10000],
      ['Kidney Function Test', 'Kidney function and electrolyte test', 'Lab', 5000, 500, 10000],
      ['Thyroid Function Test', 'Thyroid hormone test', 'Lab', 6000, 600, 12000],
      ['Pregnancy Test', 'Beta HCG pregnancy test', 'Lab', 1500, 150, 3000],
      ['Pap Smear', 'Cervical cancer screening', 'Lab', 4000, 400, 8000],
      ['Prostate Specific Antigen (PSA)', 'Prostate cancer screening test', 'Lab', 5000, 500, 10000],
      ['COVID-19 Test', 'COVID-19 RT-PCR test', 'Lab', 10000, 1000, 20000],
      ['Dengue Test', 'Dengue fever test', 'Lab', 5000, 500, 10000],
      ['Cholera Test', 'Cholera stool test', 'Lab', 4000, 400, 8000],
      ['Tuberculosis Test', 'TB screening test', 'Lab', 6000, 600, 12000],
      // Imaging
      ['Chest X-Ray', 'Chest X-ray imaging', 'Imaging', 8000, 800, 16000],
      ['Abdominal X-Ray', 'Abdominal X-ray imaging', 'Imaging', 8000, 800, 16000],
      ['Pelvic X-Ray', 'Pelvic X-ray imaging', 'Imaging', 8000, 800, 16000],
      ['Skull X-Ray', 'Skull X-ray imaging', 'Imaging', 8000, 800, 16000],
      ['Abdominal Ultrasound', 'Abdominal ultrasound scan', 'Imaging', 10000, 1000, 20000],
      ['Pelvic Ultrasound', 'Pelvic ultrasound scan', 'Imaging', 10000, 1000, 20000],
      ['Obstetric Ultrasound', 'Pregnancy ultrasound scan', 'Imaging', 12000, 1200, 24000],
      ['Echocardiogram', 'Heart ultrasound', 'Imaging', 25000, 2500, 50000],
      ['CT Scan - Head', 'Head CT scan', 'Imaging', 55000, 5500, 110000],
      ['CT Scan - Chest', 'Chest CT scan', 'Imaging', 55000, 5500, 110000],
      ['CT Scan - Abdomen', 'Abdominal CT scan', 'Imaging', 60000, 6000, 120000],
      ['MRI - Brain', 'Brain MRI', 'Imaging', 85000, 8500, 170000],
      ['MRI - Spine', 'Spine MRI', 'Imaging', 90000, 9000, 180000],
      // Procedures
      ['Wound Dressing (Minor)', 'Minor wound dressing', 'Procedure', 2000, 200, 4000],
      ['Wound Dressing (Major)', 'Major wound dressing', 'Procedure', 5000, 500, 10000],
      ['Suturing (Minor)', 'Minor wound suturing', 'Procedure', 5000, 500, 10000],
      ['Suturing (Major)', 'Major wound suturing', 'Procedure', 10000, 1000, 20000],
      ['Incision & Drainage', 'Incision and drainage procedure', 'Procedure', 7000, 700, 14000],
      ['Biopsy', 'Tissue biopsy procedure', 'Procedure', 15000, 1500, 30000],
      ['IV Cannulation', 'IV line insertion', 'Procedure', 15000, 1500, 30000],
      ['Blood Transfusion', 'Blood transfusion procedure', 'Procedure', 25000, 2500, 50000],
      ['Lumbar Puncture', 'Spinal tap procedure', 'Procedure', 20000, 2000, 40000],
      ['Chest Tube Insertion', 'Chest tube placement', 'Procedure', 30000, 3000, 60000],
      ['Peritoneal Dialysis', 'Peritoneal dialysis procedure', 'Procedure', 40000, 4000, 80000],
      ['Haemodialysis', 'Haemodialysis treatment', 'Procedure', 50000, 5000, 100000],
      ['Endoscopy', 'Upper GI endoscopy', 'Procedure', 35000, 3500, 70000],
      ['Colonoscopy', 'Colonoscopy procedure', 'Procedure', 40000, 4000, 80000],
      ['Bronchoscopy', 'Bronchoscopy procedure', 'Procedure', 35000, 3500, 70000],
      ['Cystoscopy', 'Cystoscopy procedure', 'Procedure', 30000, 3000, 60000],
      ['Hysteroscopy', 'Hysteroscopy procedure', 'Procedure', 35000, 3500, 70000],
      ['Laparoscopy', 'Laparoscopy procedure', 'Procedure', 45000, 4500, 90000],
      ['Arthroscopy', 'Arthroscopy procedure', 'Procedure', 40000, 4000, 80000],
      ['Cardiac Catheterization', 'Cardiac catheterization procedure', 'Procedure', 80000, 8000, 160000],
      // Dental
      ['Dental Consultation', 'Dental examination and consultation', 'Dental', 3000, 300, 6000],
      ['Tooth Extraction', 'Simple tooth extraction', 'Dental', 5000, 500, 10000],
      ['Dental Filling', 'Dental filling procedure', 'Dental', 7000, 700, 14000],
      ['Dental Cleaning', 'Professional dental cleaning', 'Dental', 8000, 800, 16000],
      ['Root Canal', 'Root canal treatment', 'Dental', 25000, 2500, 50000],
      ['Crown & Bridge', 'Dental crown and bridge', 'Dental', 40000, 4000, 80000],
      ['Dentures', 'Denture fitting', 'Dental', 50000, 5000, 100000],
      ['Teeth Whitening', 'Professional teeth whitening', 'Dental', 20000, 2000, 40000],
      ['Orthodontics', 'Orthodontic treatment', 'Dental', 60000, 6000, 120000],
      ['Dental Implant', 'Dental implant procedure', 'Dental', 100000, 10000, 200000],
      // Optometry
      ['Eye Examination', 'Comprehensive eye exam', 'Optometry', 5000, 500, 10000],
      ['Visual Field Test', 'Visual field assessment', 'Optometry', 8000, 800, 16000],
      ['Glaucoma Screening', 'Glaucoma screening test', 'Optometry', 10000, 1000, 20000],
      ['Retinal Imaging', 'Retinal photography', 'Optometry', 15000, 1500, 30000],
      ['Contact Lens Fitting', 'Contact lens fitting', 'Optometry', 12000, 1200, 24000],
      ['Spectacle Prescription', 'Glasses prescription', 'Optometry', 3000, 300, 6000],
    ];
    for (const [name, description, category, basePrice, nhisPrice, corporatePrice] of services) {
      await prisma.servicePricing.upsert({
        where: { tenantId_name: { tenantId: T, name } },
        update: { description, category, basePrice, nhisPrice, corporatePrice, updatedAt: now },
        create: { tenantId: T, name, description, category, basePrice, nhisPrice, corporatePrice, isActive: true, updatedAt: now },
      });
    }
    console.log(`  ✅ ${services.length} services`);

    // ============================================================
    // 6. MEDICATIONS (from your SQL)
    // ============================================================
    console.log('\n💊 Medications...');
    const medications = [
      // Antibiotics
      ['Amoxicillin 500mg Capsule', 'Amoxicillin', 'Antibiotic', 'Emzor', 500, 1000, 50],
      ['Amoxicillin-Clavulanate 625mg Tablet', 'Co-amoxiclav', 'Antibiotic', 'GSK', 800, 500, 30],
      ['Ciprofloxacin 500mg Tablet', 'Ciprofloxacin', 'Antibiotic', 'Bayer', 600, 500, 30],
      ['Metronidazole 400mg Tablet', 'Metronidazole', 'Antibiotic', 'Sanofi', 300, 800, 40],
      ['Doxycycline 100mg Capsule', 'Doxycycline', 'Antibiotic', 'Pfizer', 400, 400, 25],
      ['Azithromycin 500mg Tablet', 'Azithromycin', 'Antibiotic', 'Pfizer', 700, 300, 20],
      ['Ceftriaxone 1g Injection', 'Ceftriaxone', 'Antibiotic', 'Roche', 1500, 200, 15],
      ['Gentamicin 80mg Injection', 'Gentamicin', 'Antibiotic', 'AstraZeneca', 800, 200, 15],
      ['Cloxacillin 500mg Capsule', 'Cloxacillin', 'Antibiotic', 'Emzor', 450, 400, 25],
      ['Erythromycin 250mg Tablet', 'Erythromycin', 'Antibiotic', 'Abbott', 350, 300, 20],
      ['Cefuroxime 500mg Tablet', 'Cefuroxime', 'Antibiotic', 'GSK', 650, 300, 20],
      ['Levofloxacin 500mg Tablet', 'Levofloxacin', 'Antibiotic', 'Bayer', 550, 300, 20],
      ['Clarithromycin 500mg Tablet', 'Clarithromycin', 'Antibiotic', 'Abbott', 750, 300, 20],
      ['Amikacin 500mg Injection', 'Amikacin', 'Antibiotic', 'AstraZeneca', 1200, 150, 10],
      ['Meropenem 1g Injection', 'Meropenem', 'Antibiotic', 'Pfizer', 2500, 100, 5],
      // Antihypertensives
      ['Amlodipine 5mg Tablet', 'Amlodipine', 'Antihypertensive', 'Pfizer', 300, 500, 30],
      ['Lisinopril 10mg Tablet', 'Lisinopril', 'Antihypertensive', 'AstraZeneca', 350, 400, 25],
      ['Losartan 50mg Tablet', 'Losartan', 'Antihypertensive', 'MSD', 400, 400, 25],
      ['Atenolol 50mg Tablet', 'Atenolol', 'Antihypertensive', 'GSK', 250, 500, 30],
      ['Hydrochlorothiazide 25mg Tablet', 'Hydrochlorothiazide', 'Antihypertensive', 'Sanofi', 200, 500, 30],
      ['Nifedipine 20mg Tablet', 'Nifedipine', 'Antihypertensive', 'Bayer', 450, 300, 20],
      ['Enalapril 5mg Tablet', 'Enalapril', 'Antihypertensive', 'MSD', 300, 400, 25],
      ['Ramipril 5mg Tablet', 'Ramipril', 'Antihypertensive', 'Aventis', 350, 400, 25],
      ['Telmisartan 40mg Tablet', 'Telmisartan', 'Antihypertensive', 'Boehringer', 450, 300, 20],
      ['Metoprolol 50mg Tablet', 'Metoprolol', 'Antihypertensive', 'AstraZeneca', 300, 400, 25],
      // Antidiabetics
      ['Metformin 500mg Tablet', 'Metformin', 'Antidiabetic', 'MSD', 250, 500, 30],
      ['Glibenclamide 5mg Tablet', 'Glibenclamide', 'Antidiabetic', 'Sanofi', 200, 400, 25],
      ['Insulin NPH 100IU/ml Injection', 'Insulin NPH', 'Antidiabetic', 'Novo Nordisk', 3000, 200, 15],
      ['Insulin Regular 100IU/ml Injection', 'Insulin Regular', 'Antidiabetic', 'Novo Nordisk', 3000, 200, 15],
      ['Pioglitazone 15mg Tablet', 'Pioglitazone', 'Antidiabetic', 'Takeda', 350, 300, 20],
      ['Gliclazide 80mg Tablet', 'Gliclazide', 'Antidiabetic', 'Servier', 300, 300, 20],
      ['Sitagliptin 100mg Tablet', 'Sitagliptin', 'Antidiabetic', 'MSD', 800, 200, 15],
      ['Empagliflozin 25mg Tablet', 'Empagliflozin', 'Antidiabetic', 'Boehringer', 900, 200, 15],
      // Pain Relievers
      ['Paracetamol 500mg Tablet', 'Paracetamol', 'Pain Reliever', 'Emzor', 100, 1000, 50],
      ['Ibuprofen 400mg Tablet', 'Ibuprofen', 'Pain Reliever', 'Pfizer', 200, 500, 30],
      ['Diclofenac 50mg Tablet', 'Diclofenac', 'Pain Reliever', 'Novartis', 250, 400, 25],
      ['Tramadol 50mg Capsule', 'Tramadol', 'Pain Reliever', 'Grünenthal', 350, 300, 20],
      ['Pethidine 100mg Injection', 'Pethidine', 'Pain Reliever', 'AstraZeneca', 1200, 100, 10],
      ['Morphine 10mg Injection', 'Morphine', 'Pain Reliever', 'AstraZeneca', 1500, 100, 10],
      // Psychiatric
      ['Diazepam 5mg Tablet', 'Diazepam', 'Psychiatric', 'Roche', 350, 200, 15],
      ['Alprazolam 0.5mg Tablet', 'Alprazolam', 'Psychiatric', 'Pfizer', 300, 200, 15],
      ['Olanzapine 10mg Tablet', 'Olanzapine', 'Psychiatric', 'Eli Lilly', 800, 150, 10],
      ['Clozapine 100mg Tablet', 'Clozapine', 'Psychiatric', 'Novartis', 900, 150, 10],
      ['Lithium 400mg Tablet', 'Lithium', 'Psychiatric', 'GSK', 450, 200, 15],
      // Emergency
      ['Adrenaline 1mg Injection', 'Adrenaline', 'Emergency', 'AstraZeneca', 1000, 100, 10],
      ['Atropine 1mg Injection', 'Atropine', 'Emergency', 'AstraZeneca', 800, 100, 10],
      ['Naloxone 0.4mg Injection', 'Naloxone', 'Emergency', 'Pfizer', 1200, 100, 10],
      ['Dextrose 50% Injection', 'Dextrose', 'Emergency', 'Baxter', 1500, 100, 10],
      ['Calcium Gluconate 10% Injection', 'Calcium Gluconate', 'Emergency', 'AstraZeneca', 900, 100, 10],
      ['Sodium Bicarbonate 8.4% Injection', 'Sodium Bicarbonate', 'Emergency', 'Baxter', 1000, 100, 10],
      ['Hydrocortisone 100mg Injection', 'Hydrocortisone', 'Emergency', 'Pfizer', 1300, 100, 10],
      ['Chlorpheniramine 10mg Injection', 'Chlorpheniramine', 'Emergency', 'Sanofi', 500, 150, 10],
      // Ophthalmic
      ['Chloramphenicol Eye Drops', 'Chloramphenicol', 'Ophthalmic', 'Bausch', 1500, 200, 15],
      ['Timolol Eye Drops 0.5%', 'Timolol', 'Ophthalmic', 'MSD', 2000, 150, 10],
      ['Artificial Tears', 'Hypromellose', 'Ophthalmic', 'Bausch', 1000, 200, 15],
      ['Latanoprost Eye Drops', 'Latanoprost', 'Ophthalmic', 'Pfizer', 3000, 100, 10],
      ['Dorzolamide Eye Drops', 'Dorzolamide', 'Ophthalmic', 'MSD', 2500, 100, 10],
      // Topical
      ['Hydrocortisone Cream 1%', 'Hydrocortisone', 'Topical', 'Pfizer', 800, 200, 15],
      ['Betamethasone Cream 0.1%', 'Betamethasone', 'Topical', 'GSK', 900, 200, 15],
      ['Neomycin Cream', 'Neomycin', 'Topical', 'Bayer', 600, 200, 15],
      ['Silver Sulphadiazine Cream', 'Silver Sulphadiazine', 'Topical', 'AstraZeneca', 1200, 150, 10],
      ['Ketoconazole Cream', 'Ketoconazole', 'Topical', 'Janssen', 1000, 150, 10],
      ['Acyclovir Cream', 'Acyclovir', 'Topical', 'GSK', 1500, 150, 10],
      ['Retinoic Acid Cream', 'Tretinoin', 'Topical', 'Janssen', 2000, 100, 10],
    ];
    const expiryDate = new Date('2026-12-31');
    for (const [name, genericName, category, supplier, unitPrice, stockQuantity, reorderLevel] of medications) {
      // Note: Medication has no unique constraint on name, so find by name first
      const existing = await prisma.medication.findFirst({
        where: { tenantId: T, name },
      });
      if (existing) {
        await prisma.medication.update({
          where: { id: existing.id },
          data: { genericName, category, supplier, unitPrice, stockQuantity, reorderLevel, updatedAt: now },
        });
      } else {
        await prisma.medication.create({
          data: {
            tenantId: T,
            name, genericName, category, supplier,
            unitPrice, stockQuantity, reorderLevel,
            expiryDate,
            batchNumber: `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          },
        });
      }
    }
    console.log(`  ✅ ${medications.length} medications`);

    // ============================================================
    // 7. DEPARTMENTS
    // ============================================================
    console.log('\n🏢 Departments...');
    const departments = [
      ['Internal Medicine', 'General internal medicine', 'IM-001', 'Main Building, 1st Floor'],
      ['Surgery', 'Surgical services', 'SUR-002', 'Surgical Wing'],
      ['Paediatrics', 'Child health services', 'PED-003', "Children's Wing"],
      ['Obstetrics & Gynaecology', "Women's health and maternity", 'OBG-004', "Women's Wing"],
      ['Orthopaedics', 'Bone and joint services', 'ORT-005', 'Orthopaedic Wing'],
      ['Ophthalmology', 'Eye care services', 'OPH-006', 'Main Building, 2nd Floor'],
      ['ENT', 'Ear, nose, and throat services', 'ENT-007', 'Main Building, 2nd Floor'],
      ['Dermatology', 'Skin care services', 'DER-008', 'Main Building, 3rd Floor'],
      ['Psychiatry', 'Mental health services', 'PSY-009', 'Psychiatric Wing'],
      ['Dentistry', 'Dental care services', 'DEN-010', 'Dental Wing'],
      ['Pharmacy', 'Pharmacy services', 'PHA-011', 'Pharmacy Wing'],
      ['Laboratory', 'Clinical laboratory services', 'LAB-012', 'Lab Wing'],
      ['Radiology', 'Imaging and radiology services', 'RAD-013', 'Radiology Wing'],
      ['Physiotherapy', 'Physical therapy services', 'PHY-014', 'Rehabilitation Wing'],
      ['Nutrition & Dietetics', 'Clinical nutrition services', 'NUT-015', 'Main Building, Ground Floor'],
      ['Administration', 'Hospital administration', 'ADM-016', 'Admin Wing'],
      ['Human Resources', 'Staff management and recruitment', 'HR-017', 'Admin Wing'],
      ['Finance', 'Financial management', 'FIN-018', 'Admin Wing'],
      ['Accounts', 'Accounting services', 'ACC-019', 'Admin Wing'],
      ['Medical Records', 'Medical records management', 'MR-020', 'Records Wing'],
      ['Billing', 'Billing and insurance services', 'BIL-021', 'Admin Wing'],
      ['ICT', 'Information technology services', 'ICT-022', 'IT Wing'],
      ['Cardiology', 'Heart and cardiovascular services', 'CAR-023', 'Main Building, 2nd Floor'],
      ['Neurology', 'Brain and nervous system services', 'NEU-024', 'Main Building, 2nd Floor'],
      ['Oncology', 'Cancer care services', 'ONC-025', 'Oncology Wing'],
      ['Renal', 'Kidney care and dialysis', 'REN-026', 'Renal Wing'],
      ['Respiratory', 'Lung and respiratory services', 'RES-027', 'Main Building, 1st Floor'],
      ['Gastroenterology', 'Digestive system services', 'GAS-028', 'Main Building, 1st Floor'],
      ['Rheumatology', 'Autoimmune and joint disorders', 'RHE-029', 'Main Building, 2nd Floor'],
      ['Haematology', 'Blood disorders services', 'HAE-030', 'Main Building, 1st Floor'],
      ['Medical Education', 'Training and medical education', 'MED-031', '3rd Floor, East Wing'],
      ['Research & Development', 'Medical research', 'RND-032', 'Research Wing'],
      ['Quality Assurance', 'Quality and safety management', 'QA-033', 'Admin Wing'],
    ];
    for (const [name, description, costCenter, location] of departments) {
      await prisma.department.upsert({
        where: { tenantId_name: { tenantId: T, name } },
        update: { description, costCenter, location, updatedAt: now },
        create: { tenantId: T, name, description, costCenter, location, isActive: true, updatedAt: now },
      });
    }
    console.log(`  ✅ ${departments.length} departments`);

    // ============================================================
// 8. STAFF USERS (default hospital)
// ============================================================
console.log('\n👤 Staff users...');
const staffUsers = [
  ['ADMIN001', 'admin', 'System', 'Administrator', 'admin@hospital.com', 'Admin', 'admin123'],
  ['IT001', 'itadmin', 'IT', 'Admin', 'itadmin@hospital.com', 'ITAdmin', 'admin123'],
  ['HR001', 'hr', 'HR', 'Manager', 'hr@hospital.com', 'HR', 'hr123'],
  ['DOC001', 'doctor', 'John', 'Doctor', 'doctor@hospital.com', 'Doctor', 'doctor123'],
  ['NURSE001', 'nurse', 'Sarah', 'Nurse', 'nurse@hospital.com', 'Nurse', 'nurse123'],
  ['BILL001', 'billing', 'Billing', 'Officer', 'billing@hospital.com', 'BillingOfficer', 'billing123'],
  ['PHARM001', 'pharmacist', 'Pharmacy', 'Staff', 'pharmacist@hospital.com', 'Pharmacist', 'pharm123'],
  ['LAB001', 'labtech', 'Lab', 'Technician', 'labtech@hospital.com', 'LabTechnician', 'lab123'],
  ['LABSCI001', 'labscientist', 'Lab', 'Scientist', 'labscientist@hospital.com', 'LabScientist', 'labsci123'],
  ['RAD001', 'radiologist', 'Radiology', 'Specialist', 'radiologist@hospital.com', 'Radiologist', 'rad123'],
  ['ACC001', 'accountant', 'Account', 'Ant', 'accountant@hospital.com', 'Accountant', 'acc123'],
  ['REC001', 'records', 'Records', 'Officer', 'records@hospital.com', 'Records', 'records123'],
  ['OBG001', 'obstetrician', 'Obstetrics', 'Specialist', 'obstetrician@hospital.com', 'Obstetrician', 'obg123'],
  ['MID001', 'midwife', 'Midwife', 'Staff', 'midwife@hospital.com', 'Midwife', 'mid123'],
  ['RECEPT001', 'receptionist', 'Reception', 'Staff', 'receptionist@hospital.com', 'Receptionist', 'recept123'],
];

const CARETECH_PREFIX = 'caretech';
for (const [employeeId, username, firstName, lastName, email, role, password] of staffUsers) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const fullUsername = `${CARETECH_PREFIX}-${username}`;    // ← prefix
  await prisma.staff.upsert({
    where: { tenantId_employeeId: { tenantId: T, employeeId } },
    update: {
      username: fullUsername,                               // ← prefixed
      firstName, lastName, email, role,
      isActive: true, updatedAt: now,
    },
    create: {
      tenantId: T, employeeId,
      username: fullUsername,                               // ← prefixed
      firstName, lastName, email, role,
      password: hashedPassword, isActive: true, updatedAt: now,
    },
  });
}
console.log(`  ✅ ${staffUsers.length} staff`);

// ============================================================
// 8b. ADMIN STAFF FOR ST. MARY'S
// ============================================================
console.log('\n👤 St. Mary\'s admin...');
const stMarysAdmin = {
  employeeId: 'ADMIN-SM-001',
  username: 'stmarys-admin',
  firstName: 'Mary',
  lastName: 'Bello',
  email: 'admin@stmarys.health',
  role: 'Admin',
  password: 'password123',
  tenantId: 'st-marys-hospital-id',
};

{
  const hashedPassword = await bcrypt.hash(stMarysAdmin.password, 10);
  await prisma.staff.upsert({
    where: {
      tenantId_employeeId: {
        tenantId: stMarysAdmin.tenantId,
        employeeId: stMarysAdmin.employeeId,
      },
    },
    update: {
      username: stMarysAdmin.username,
      firstName: stMarysAdmin.firstName,
      lastName: stMarysAdmin.lastName,
      email: stMarysAdmin.email,
      role: stMarysAdmin.role,
      isActive: true,
      updatedAt: now,
    },
    create: {
      tenantId: stMarysAdmin.tenantId,
      employeeId: stMarysAdmin.employeeId,
      username: stMarysAdmin.username,
      firstName: stMarysAdmin.firstName,
      lastName: stMarysAdmin.lastName,
      email: stMarysAdmin.email,
      role: stMarysAdmin.role,
      password: hashedPassword,
      isActive: true,
      updatedAt: now,
    },
  });
  console.log(`  ✅ ${stMarysAdmin.username} / ${stMarysAdmin.password}`);
}

    // ============================================================
    // 9. ROLE PERMISSIONS
    // ============================================================
    console.log('\n🔐 Role permissions...');
    const allModules = [
      'dashboard','patients','staff','appointments','prescriptions','labOrders','billing',
      'pharmacy','pharmacyDashboard','pharmacyInventory','nhisManagement','nhisAuthorizations',
      'pharmacyStock','pharmacyTransactions','pharmacyBranches','clinics','wards','pricing',
      'billingOfficer','wallet','patientIntake','admissions','patientHistory','roiRequests',
      'nurseDashboard','doctorDashboard','antenatal','archivedPatients','archivedPatientsView',
      'queueManagement','doctorQueue','hrDashboard','hrEmployees','hrDepartments','hrLeaves',
      'hrAttendance','hrPerformance','hrTrainings','radiology','dental','optometry',
      'immunizations','patientPortal','portalSetup','laborAndDelivery'
    ];
    const base = Object.fromEntries(allModules.map((m) => [m, false]));

    const rolePerms = {
      Admin: Object.fromEntries(allModules.map((m) => [m, true])),
      ITAdmin: Object.fromEntries(allModules.map((m) => [m, true])),
      HR: { ...base, dashboard: true, staff: true, hrDashboard: true, hrEmployees: true, hrDepartments: true, hrLeaves: true, hrAttendance: true, hrPerformance: true, hrTrainings: true, archivedPatients: true, archivedPatientsView: true },
      Doctor: { ...base, dashboard: true, patients: true, appointments: true, prescriptions: true, labOrders: true, doctorDashboard: true, doctorQueue: true, patientHistory: true, archivedPatientsView: true },
      Nurse: { ...base, dashboard: true, patients: true, nurseDashboard: true, queueManagement: true, antenatal: true, laborAndDelivery: true, immunizations: true, archivedPatientsView: true },
      Obstetrician: { ...base, dashboard: true, patients: true, appointments: true, prescriptions: true, labOrders: true, doctorDashboard: true, doctorQueue: true, antenatal: true, laborAndDelivery: true, archivedPatientsView: true },
      Midwife: { ...base, dashboard: true, patients: true, nurseDashboard: true, queueManagement: true, antenatal: true, laborAndDelivery: true, archivedPatientsView: true },
      Pharmacist: { ...base, dashboard: true, prescriptions: true, pharmacy: true, pharmacyDashboard: true, pharmacyInventory: true, pharmacyStock: true, pharmacyTransactions: true, nhisManagement: true, nhisAuthorizations: true },
      BillingOfficer: { ...base, dashboard: true, patients: true, billingOfficer: true, wallet: true },
      Accountant: { ...base, dashboard: true, billing: true, pricing: true, wallet: true, nhisManagement: true, nhisAuthorizations: true },
      Records: { ...base, dashboard: true, patients: true, patientIntake: true, admissions: true, patientHistory: true, roiRequests: true, queueManagement: true, antenatal: true, archivedPatients: true, archivedPatientsView: true },
      LabTechnician: { ...base, dashboard: true, patients: true, labOrders: true },
      LabScientist: { ...base, dashboard: true, patients: true, labOrders: true, patientHistory: true, archivedPatientsView: true },
      Radiologist: { ...base, dashboard: true, patients: true, radiology: true, archivedPatientsView: true },
      Receptionist: { ...base, dashboard: true, patients: true, appointments: true },
      Dentist: { ...base, dashboard: true, patients: true, dental: true },
      Optometrist: { ...base, dashboard: true, patients: true, optometry: true },
      Paediatrician: { ...base, dashboard: true, patients: true, appointments: true, prescriptions: true, labOrders: true, immunizations: true },
      Surgeon: { ...base, dashboard: true, patients: true, appointments: true, prescriptions: true, labOrders: true },
      Psychiatrist: { ...base, dashboard: true, patients: true, appointments: true, prescriptions: true },
    };

    for (const [role, perms] of Object.entries(rolePerms)) {
      await prisma.rolePermission.upsert({
        where: { tenantId_role: { tenantId: T, role } },
        update: { ...perms, updatedAt: now },
        create: { role, ...perms, tenantId: T, updatedAt: now },
      });
    }
    console.log(`  ✅ ${Object.keys(rolePerms).length} roles`);

    // ============================================================
    // 10. TEST PATIENT
    // ============================================================
    console.log('\n👤 Test patient...');
    await prisma.patient.upsert({
      where: { tenantId_hospitalId: { tenantId: T, hospitalId: '000001' } },
      update: { updatedAt: now },
      create: {
        tenantId: T, hospitalId: '000001',
        firstName: 'John', lastName: 'Oyelakin',
        dateOfBirth: new Date('1985-05-15'),
        gender: 'Male', phone: '08012345678',
        email: 'john.oye@gmail.com', address: '123 Main Street, Lagos',
        emergencyContact: '08087654321',
        nextOfKinName: 'Hannah Oyelakin',
        nextOfKinPhone: '08087654321',
        nextOfKinRelationship: 'Spouse',
        patientCategory: 'FPP',
      },
    });
    const testPatient = await prisma.patient.findUnique({
      where: { tenantId_hospitalId: { tenantId: T, hospitalId: '000001' } },
    });
    if (testPatient) {
      await prisma.patientWallet.upsert({
        where: { patientId: testPatient.id },
        update: { updatedAt: now },
        create: { patientId: testPatient.id, balance: 15000, status: 'Active', tenantId: T, updatedAt: now },
      });
    }
    console.log('  ✅ Patient + Wallet');

    // ============================================================
    // DONE
    // ============================================================
    console.log('\n═══════════════════════════════════════════════════');
    console.log('🎉 SEED COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log(`🏢 Tenant: ${T}`);
    console.log('');
    console.log('📋 LOGIN CREDENTIALS:');
    console.log('  Admin:   admin@hospital.com / admin123');
    console.log('  Doctor:  doctor@hospital.com / doctor123');
    console.log('  Nurse:   nurse@hospital.com / nurse123');
    console.log('  (see all in staff table)');
    console.log('═══════════════════════════════════════════════════');

    // ============================================================
// 11. PLATFORM USER (SaaS operator)
// ============================================================
console.log('\n🔐 Platform users...');
{
  const platformPassword = await bcrypt.hash('platform123', 10);
  await prisma.platformUser.upsert({
    where: { username: 'platform-admin' },
    update: {},
    create: {
      username: 'platform-admin',
      email: 'admin@nexgen.health',
      password: platformPassword,
      firstName: 'Platform',
      lastName: 'Owner',
      role: 'PlatformAdmin',
      isActive: true,
    },
  });
  console.log('  ✅ platform-admin / platform123');
}
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });