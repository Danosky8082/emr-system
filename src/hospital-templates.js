// src/hospital-templates.js
// ============================================================
// DEFAULT STARTER DATA FOR NEW HOSPITALS
//
// Called whenever a hospital is created — regardless of which
// endpoint created it (Quick Add, public Register, seed, or
// any future flow). Guarantees every new hospital has:
//   • Clinics
//   • Wards
//   • Departments
//   • Service pricing (consultations, lab, imaging, procedures,
//     dental, optometry)
//   • Service configurations (registration, card, consultation)
//
// All items are editable by the hospital admin after creation.
// ============================================================

// ────────────────────────────────────────────────────────────
// Default clinics
// ────────────────────────────────────────────────────────────
const DEFAULT_CLINICS = [
  { name: 'General Outpatient',        description: 'General outpatient services',              location: 'Ground Floor, Block A' },
  { name: 'Paediatrics',               description: 'Paediatric care for children',             location: 'First Floor, Block B' },
  { name: 'Obstetrics & Gynaecology',  description: "Women's health and maternity",             location: 'Second Floor, Block A' },
  { name: 'Internal Medicine',         description: 'Adult medical care',                       location: 'Ground Floor, Block C' },
  { name: 'Surgery',                   description: 'Surgical consultations',                   location: 'First Floor, Block C' },
  { name: 'Postnatal Clinic',          description: 'Post-delivery care services',              location: "Women's Wing, Ground Floor" },
  { name: 'Family Planning Clinic',    description: 'Family planning and reproductive health',  location: "Women's Wing, 1st Floor" },
  { name: 'Nutrition Clinic',          description: 'Nutritional counseling and support',       location: 'Main Building, Ground Floor' },
  { name: 'Diabetes/Endocrinology',    description: 'Diabetes and endocrine disorders',         location: 'Main Building, 1st Floor' },
  { name: 'Cardiology Clinic',         description: 'Heart and cardiovascular services',        location: 'Main Building, 2nd Floor' },
  { name: 'Neurology Clinic',          description: 'Brain and nervous system services',        location: 'Main Building, 2nd Floor' },
  { name: 'Dental Clinic',             description: 'Dental and oral health services',          location: 'Dental Wing, Ground Floor' },
  { name: 'Eye Clinic',                description: 'Optometry and eye care services',          location: 'Main Building, 1st Floor' },
  { name: 'Psychiatry Clinic',         description: 'Mental health services',                   location: 'Psychiatric Wing, Ground Floor' },
  { name: 'Physiotherapy',             description: 'Physical therapy and rehabilitation',      location: 'Rehabilitation Wing' },
];

// ────────────────────────────────────────────────────────────
// Default wards
// ────────────────────────────────────────────────────────────
const DEFAULT_WARDS = [
  { name: 'Medical Ward (Male)',    description: 'General medical care for male patients',    capacity: 30 },
  { name: 'Medical Ward (Female)',  description: 'General medical care for female patients',  capacity: 30 },
  { name: 'Surgical Ward (Male)',   description: 'Surgical care for male patients',           capacity: 25 },
  { name: 'Surgical Ward (Female)', description: 'Surgical care for female patients',         capacity: 25 },
  { name: 'Paediatric Ward',        description: 'Care for children and infants',             capacity: 20 },
  { name: 'Maternity Ward',         description: 'Maternity and delivery care',               capacity: 25 },
  { name: 'Labour Ward',            description: 'Labour and delivery suites',                capacity: 10 },
  { name: 'Antenatal Ward',         description: 'Pregnancy care and monitoring',             capacity: 15 },
  { name: 'Postnatal Ward',         description: 'Post-delivery care for mothers',            capacity: 20 },
  { name: 'ICU',                    description: 'Intensive Care Unit for critical patients', capacity: 10 },
  { name: 'HDU',                    description: 'High Dependency Unit',                      capacity: 10 },
  { name: 'NICU',                   description: 'Neonatal Intensive Care Unit',              capacity: 15 },
  { name: 'Isolation Ward',         description: 'Isolation for infectious diseases',         capacity: 10 },
  { name: 'Private Ward',           description: 'Premium private patient care',              capacity: 5 },
  { name: 'General Ward',           description: 'General ward care',                         capacity: 40 },
];

// ────────────────────────────────────────────────────────────
// Default departments
// ────────────────────────────────────────────────────────────
const DEFAULT_DEPARTMENTS = [
  { name: 'Administration',           description: 'Hospital administration',            costCenter: 'ADM-001', location: 'Admin Wing' },
  { name: 'Human Resources',          description: 'Staff management and recruitment',   costCenter: 'HR-002',  location: 'Admin Wing' },
  { name: 'Finance',                  description: 'Financial management',               costCenter: 'FIN-003', location: 'Admin Wing' },
  { name: 'Accounts',                 description: 'Accounting services',                costCenter: 'ACC-004', location: 'Admin Wing' },
  { name: 'Medical Records',          description: 'Medical records management',         costCenter: 'MR-005',  location: 'Records Wing' },
  { name: 'Billing',                  description: 'Billing and insurance services',     costCenter: 'BIL-006', location: 'Admin Wing' },
  { name: 'ICT',                      description: 'Information technology services',    costCenter: 'ICT-007', location: 'IT Wing' },
  { name: 'Internal Medicine',        description: 'General internal medicine',          costCenter: 'IM-008',  location: 'Main Building, 1st Floor' },
  { name: 'Surgery',                  description: 'Surgical services',                  costCenter: 'SUR-009', location: 'Surgical Wing' },
  { name: 'Paediatrics',              description: 'Child health services',              costCenter: 'PED-010', location: "Children's Wing" },
  { name: 'Obstetrics & Gynaecology', description: "Women's health and maternity",       costCenter: 'OBG-011', location: "Women's Wing" },
  { name: 'Pharmacy',                 description: 'Pharmacy services',                  costCenter: 'PHA-012', location: 'Pharmacy Wing' },
  { name: 'Laboratory',               description: 'Clinical laboratory services',       costCenter: 'LAB-013', location: 'Lab Wing' },
  { name: 'Radiology',                description: 'Imaging and radiology services',     costCenter: 'RAD-014', location: 'Radiology Wing' },
];

// ────────────────────────────────────────────────────────────
// Default service pricing
// [name, description, category, basePrice, nhisPrice, corporatePrice]
// ────────────────────────────────────────────────────────────
const DEFAULT_SERVICES = [
  // ── Consultations ──
  ['General Consultation',    'Standard general consultation',          'FPP',        5000,   500,    10000],
  ['Specialist Consultation', 'Consultation with specialist doctor',   'FPP',        10000,  1000,   20000],
  ['Emergency Consultation',  'Emergency/urgent consultation',         'FPP',        7500,   750,    15000],
  ['Follow-up Consultation',  'Follow-up consultation visit',          'FPP',        3000,   300,    6000],
  ['Home Visit Consultation', 'Doctor home visit service',             'FPP',        15000,  1500,   30000],

  // ── Laboratory ──
  ['Full Blood Count (FBC)',  'Complete blood count test',             'Lab',        3500,   350,    7000],
  ['Malaria Test',            'Malaria parasite detection',           'Lab',        2000,   200,    4000],
  ['Typhoid Test (Widal)',    'Typhoid fever test',                   'Lab',        2500,   250,    5000],
  ['Urinalysis',              'Urine analysis test',                  'Lab',        1500,   150,    3000],
  ['Stool Analysis',          'Stool examination test',               'Lab',        2000,   200,    4000],
  ['Blood Culture',           'Blood culture and sensitivity',        'Lab',        5000,   500,    10000],
  ['Urine Culture',           'Urine culture and sensitivity',        'Lab',        4000,   400,    8000],
  ['Sputum Culture',          'Sputum culture and sensitivity',       'Lab',        4500,   450,    9000],
  ['Wound Swab Culture',      'Wound swab culture and sensitivity',   'Lab',        4000,   400,    8000],
  ['HIV Test',                'HIV antibody test',                    'Lab',        3000,   300,    6000],
  ['Hepatitis B Test',        'Hepatitis B surface antigen test',     'Lab',        3500,   350,    7000],
  ['Hepatitis C Test',        'Hepatitis C antibody test',            'Lab',        3500,   350,    7000],
  ['Syphilis Test',           'Syphilis screening test',              'Lab',        2500,   250,    5000],
  ['Blood Glucose Test',      'Blood glucose level test',             'Lab',        1000,   100,    2000],
  ['Lipid Profile',           'Cholesterol and lipid test',           'Lab',        4000,   400,    8000],
  ['Liver Function Test',     'Liver enzyme and function test',       'Lab',        5000,   500,    10000],
  ['Kidney Function Test',    'Kidney function and electrolyte test', 'Lab',        5000,   500,    10000],
  ['Thyroid Function Test',   'Thyroid hormone test',                 'Lab',        6000,   600,    12000],
  ['Pregnancy Test',          'Beta HCG pregnancy test',              'Lab',        1500,   150,    3000],
  ['Pap Smear',               'Cervical cancer screening',            'Lab',        4000,   400,    8000],
  ['PSA (Prostate)',          'Prostate cancer screening test',       'Lab',        5000,   500,    10000],
  ['COVID-19 Test',           'COVID-19 RT-PCR test',                 'Lab',        10000,  1000,   20000],

  // ── Imaging / X-Ray ──
  ['Chest X-Ray',             'Chest X-ray imaging',                  'Imaging',    8000,   800,    16000],
  ['Abdominal X-Ray',         'Abdominal X-ray imaging',              'Imaging',    8000,   800,    16000],
  ['Pelvic X-Ray',            'Pelvic X-ray imaging',                 'Imaging',    8000,   800,    16000],
  ['Skull X-Ray',             'Skull X-ray imaging',                  'Imaging',    8000,   800,    16000],
  ['Abdominal Ultrasound',    'Abdominal ultrasound scan',            'Imaging',    10000,  1000,   20000],
  ['Pelvic Ultrasound',       'Pelvic ultrasound scan',               'Imaging',    10000,  1000,   20000],
  ['Obstetric Ultrasound',    'Pregnancy ultrasound scan',            'Imaging',    12000,  1200,   24000],
  ['Echocardiogram',          'Heart ultrasound',                     'Imaging',    25000,  2500,   50000],
  ['CT Scan - Head',          'Head CT scan',                         'Imaging',    55000,  5500,   110000],
  ['CT Scan - Chest',         'Chest CT scan',                        'Imaging',    55000,  5500,   110000],
  ['CT Scan - Abdomen',       'Abdominal CT scan',                    'Imaging',    60000,  6000,   120000],
  ['MRI - Brain',             'Brain MRI',                            'Imaging',    85000,  8500,   170000],
  ['MRI - Spine',             'Spine MRI',                            'Imaging',    90000,  9000,   180000],

  // ── Procedures ──
  ['Wound Dressing (Minor)',  'Minor wound dressing',                 'Procedure',  2000,   200,    4000],
  ['Wound Dressing (Major)',  'Major wound dressing',                 'Procedure',  5000,   500,    10000],
  ['Suturing (Minor)',        'Minor wound suturing',                 'Procedure',  5000,   500,    10000],
  ['Suturing (Major)',        'Major wound suturing',                 'Procedure',  10000,  1000,   20000],
  ['Incision & Drainage',     'Incision and drainage procedure',      'Procedure',  7000,   700,    14000],
  ['Biopsy',                  'Tissue biopsy procedure',              'Procedure',  15000,  1500,   30000],
  ['IV Cannulation',          'IV line insertion',                    'Procedure',  15000,  1500,   30000],
  ['Blood Transfusion',       'Blood transfusion procedure',          'Procedure',  25000,  2500,   50000],
  ['Lumbar Puncture',         'Spinal tap procedure',                 'Procedure',  20000,  2000,   40000],
  ['Chest Tube Insertion',    'Chest tube placement',                 'Procedure',  30000,  3000,   60000],
  ['Endoscopy',               'Upper GI endoscopy',                   'Procedure',  35000,  3500,   70000],
  ['Colonoscopy',             'Colonoscopy procedure',                'Procedure',  40000,  4000,   80000],
  ['Laparoscopy',             'Laparoscopy procedure',                'Procedure',  45000,  4500,   90000],
  ['Haemodialysis',           'Haemodialysis treatment',              'Procedure',  50000,  5000,   100000],

  // ── Dental ──
  ['Dental Consultation',     'Dental examination and consultation',  'Dental',     3000,   300,    6000],
  ['Tooth Extraction',        'Simple tooth extraction',              'Dental',     5000,   500,    10000],
  ['Dental Filling',          'Dental filling procedure',             'Dental',     7000,   700,    14000],
  ['Dental Cleaning',         'Professional dental cleaning',         'Dental',     8000,   800,    16000],
  ['Root Canal',              'Root canal treatment',                 'Dental',     25000,  2500,   50000],
  ['Crown & Bridge',          'Dental crown and bridge',              'Dental',     40000,  4000,   80000],
  ['Dentures',                'Denture fitting',                      'Dental',     50000,  5000,   100000],
  ['Teeth Whitening',         'Professional teeth whitening',         'Dental',     20000,  2000,   40000],
  ['Orthodontics',            'Orthodontic treatment',                'Dental',     60000,  6000,   120000],
  ['Dental Implant',          'Dental implant procedure',             'Dental',     100000, 10000,  200000],

  // ── Optometry ──
  ['Eye Examination',         'Comprehensive eye exam',               'Optometry',  5000,   500,    10000],
  ['Visual Field Test',       'Visual field assessment',              'Optometry',  8000,   800,    16000],
  ['Glaucoma Screening',      'Glaucoma screening test',              'Optometry',  10000,  1000,   20000],
  ['Retinal Imaging',         'Retinal photography',                  'Optometry',  15000,  1500,   30000],
  ['Contact Lens Fitting',    'Contact lens fitting',                 'Optometry',  12000,  1200,   24000],
  ['Spectacle Prescription',  'Glasses prescription',                 'Optometry',  3000,   300,    6000],
];

// ────────────────────────────────────────────────────────────
// Default service configurations
// ────────────────────────────────────────────────────────────
const DEFAULT_SERVICE_CONFIGS = [
  { serviceType: 'REGISTRATION', name: 'Registration Fee', description: 'One-time registration fee',    baseAmount: 2000 },
  { serviceType: 'CARD',         name: 'ID Card Fee',      description: 'Patient ID card printing fee', baseAmount: 1000 },
  { serviceType: 'CONSULTATION', name: 'Consultation Fee', description: 'Standard consultation fee',    baseAmount: 5000 },
];

// ============================================================
// MAIN — Create all default starter data for a new hospital
// Uses the caller's transaction (tx) so everything succeeds
// or fails together.
// ============================================================
async function createDefaultHospitalData(tx, hospitalId) {
  const created = {
    clinics: 0,
    wards: 0,
    departments: 0,
    services: 0,
    configs: 0,
  };

  // ── Clinics ──
  for (const clinic of DEFAULT_CLINICS) {
    await tx.clinic.create({
      data: {
        tenantId: hospitalId,
        name: clinic.name,
        description: clinic.description,
        location: clinic.location,
        isActive: true,
      },
    });
    created.clinics++;
  }

  // ── Wards ──
  for (const ward of DEFAULT_WARDS) {
    await tx.ward.create({
      data: {
        tenantId: hospitalId,
        name: ward.name,
        description: ward.description,
        capacity: ward.capacity,
      },
    });
    created.wards++;
  }

  // ── Departments ──
  for (const dept of DEFAULT_DEPARTMENTS) {
    await tx.department.create({
      data: {
        tenantId: hospitalId,
        name: dept.name,
        description: dept.description,
        costCenter: dept.costCenter,
        location: dept.location,
        isActive: true,
      },
    });
    created.departments++;
  }

  // ── Service Pricing ──
  for (const [name, description, category, basePrice, nhisPrice, corporatePrice] of DEFAULT_SERVICES) {
    await tx.servicePricing.create({
      data: {
        tenantId: hospitalId,
        name,
        description,
        category,
        basePrice,
        nhisPrice,
        corporatePrice,
        isActive: true,
      },
    });
    created.services++;
  }

  // ── Service Configurations (registration / card / consultation fees) ──
  for (const sc of DEFAULT_SERVICE_CONFIGS) {
    await tx.serviceConfiguration.create({
      data: {
        tenantId: hospitalId,
        serviceType: sc.serviceType,
        name: sc.name,
        description: sc.description,
        baseAmount: sc.baseAmount,
        isActive: true,
      },
    });
    created.configs++;
  }

  return created;
}

module.exports = {
  createDefaultHospitalData,
  DEFAULT_CLINICS,
  DEFAULT_WARDS,
  DEFAULT_DEPARTMENTS,
  DEFAULT_SERVICES,
  DEFAULT_SERVICE_CONFIGS,
};