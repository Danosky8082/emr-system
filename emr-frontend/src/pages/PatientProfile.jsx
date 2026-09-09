// src/pages/PatientProfile.jsx - WITH FULL DISPENSE MODAL & STOCK CONTROL

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './PatientProfile.css';
import './Dashboard.css';
import toast from 'react-hot-toast';

const PatientProfile = () => {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('profile');
  const [error, setError] = useState(null);

  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState([]);
  const [imagingOrders, setImagingOrders] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [notes, setNotes] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [labOrders, setLabOrders] = useState([]);

  // ✅ MEDICATION AUTOCOMPLETE STATE
  const [allMedications, setAllMedications] = useState([]);
  const [medicationSuggestions, setMedicationSuggestions] = useState([]);
  const [showMedicationSuggestions, setShowMedicationSuggestions] = useState(false);
  const [medicationSearchTerm, setMedicationSearchTerm] = useState('');
  const medicationInputRef = useRef(null);
  const medicationSuggestionRef = useRef(null);

  // ✅ LAB TEST AUTOCOMPLETE STATE
  const [allLabTests, setAllLabTests] = useState([]);
  const [labTestSuggestions, setLabTestSuggestions] = useState([]);
  const [showLabTestSuggestions, setShowLabTestSuggestions] = useState(false);
  const [labTestSearchTerm, setLabTestSearchTerm] = useState('');
  const labTestInputRef = useRef(null);
  const labTestSuggestionRef = useRef(null);

  // ✅ DISPENSE MODAL STATE
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [dispensingPrescription, setDispensingPrescription] = useState(null);
  const [dispenseStockInfo, setDispenseStockInfo] = useState(null);
  const [dispenseQuantity, setDispenseQuantity] = useState(1);
  const [dispensing, setDispensing] = useState(false);
  const [dispenseStockLoading, setDispenseStockLoading] = useState(false);
  const [showDispenseSuccess, setShowDispenseSuccess] = useState(false);
  const [dispenseResult, setDispenseResult] = useState(null);

  // ✅ APPOINTMENT MODAL STATE
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [appointmentForm, setAppointmentForm] = useState({
    staffId: '',
    dateTime: '',
    duration: 30,
    type: 'Consultation',
    notes: ''
  });

  // Modal states
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteForm, setNoteForm] = useState({
    type: 'SOAP',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    fullContent: ''
  });

  const [showVitalModal, setShowVitalModal] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressureSystolic: '', bloodPressureDiastolic: '', heartRate: '', temperature: '',
    respiratoryRate: '', oxygenSaturation: '', weight: '', height: '', notes: ''
  });

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionForm, setPrescriptionForm] = useState({
    medication: '', dosage: '', frequency: '', duration: '', instructions: ''
  });

  const [showLabOrderModal, setShowLabOrderModal] = useState(false);
  const [labOrderForm, setLabOrderForm] = useState({
    testName: '', testType: 'Haematology', priority: 'Routine', notes: ''
  });

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const [showImagingModal, setShowImagingModal] = useState(false);
  const [imagingForm, setImagingForm] = useState({
    imagingType: 'X-Ray',
    bodyPart: '',
    priority: 'Routine',
    clinicalHistory: '',
    clinicalQuestion: '',
    notes: ''
  });

  const imagingTypes = [
    'X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'Mammogram',
    'PET Scan', 'Fluoroscopy', 'Angiography'
  ];

  const bodyParts = [
    'Chest', 'Head', 'Abdomen', 'Pelvis', 'Spine', 'Neck',
    'Shoulder', 'Elbow', 'Wrist', 'Hand', 'Hip', 'Knee', 'Ankle', 'Foot', 'Full Body'
  ];

  const isDoctor = ['Doctor', 'Obstetrician'].includes(user?.role);
  const isNurse = ['Nurse', 'Midwife'].includes(user?.role);
  const isPharmacist = user?.role === 'Pharmacist';

  // ============================================================
  // MEDICATION AUTOCOMPLETE HELPERS
  // ============================================================

  const COMMON_MEDICATIONS = [
    'Paracetamol', 'Amoxicillin', 'Ciprofloxacin', 'Metronidazole',
    'Artemether-Lumefantrine', 'Amlodipine', 'Lisinopril', 'Metformin',
    'Omeprazole', 'Ibuprofen', 'Diclofenac', 'Cetirizine',
    'Loratadine', 'Furosemide', 'Spironolactone', 'Warfarin',
    'Aspirin', 'Clopidogrel', 'Atorvastatin', 'Simvastatin',
    'Losartan', 'Valsartan', 'Carvedilol', 'Bisoprolol',
    'Salbutamol', 'Budesonide', 'Prednisolone', 'Dexamethasone',
    'Insulin Glargine', 'Insulin Aspart', 'Sitagliptin', 'Empagliflozin',
    'Doxycycline', 'Azithromycin', 'Clarithromycin', 'Levofloxacin',
    'Moxifloxacin', 'Ceftriaxone', 'Cefuroxime', 'Cefixime',
    'Dicloxacillin', 'Flucloxacillin', 'Cefalexin', 'Ceftazidime',
    'Piperacillin-Tazobactam', 'Meropenem', 'Vancomycin', 'Gentamicin',
    'Amikacin', 'Tobramycin', 'Chloramphenicol', 'Erythromycin',
    'Clindamycin', 'Linezolid', 'Rifampicin', 'Isoniazid',
    'Pyrazinamide', 'Ethambutol', 'Streptomycin', 'Quinine',
    'Chloroquine', 'Hydroxychloroquine', 'Mefloquine', 'Doxycycline',
    'Albendazole', 'Mebendazole', 'Praziquantel', 'Ivermectin',
    'Phenytoin', 'Carbamazepine', 'Valproic Acid', 'Lamotrigine',
    'Levetiracetam', 'Topiramate', 'Gabapentin', 'Pregabalin',
    'Fluoxetine', 'Sertraline', 'Citalopram', 'Escitalopram',
    'Paroxetine', 'Venlafaxine', 'Duloxetine', 'Mirtazapine',
    'Olanzapine', 'Quetiapine', 'Risperidone', 'Aripiprazole',
    'Haloperidol', 'Chlorpromazine', 'Diazepam', 'Lorazepam',
    'Clonazepam', 'Alprazolam', 'Zolpidem', 'Zopiclone',
    'Promethazine', 'Prochlorperazine', 'Ondansetron', 'Metoclopramide',
    'Domperidone', 'Loperamide', 'Bismuth Subsalicylate', 'Psyllium',
    'Lactulose', 'Polyethylene Glycol', 'Sodium Picosulfate', 'Bisacodyl',
    'Senna', 'Docusate Sodium', 'Glycerin', 'Hydrocortisone',
    'Betamethasone', 'Clobetasol', 'Mometasone', 'Tacrolimus',
    'Pimecrolimus', 'Calcipotriene', 'Tretinoin', 'Adapalene',
    'Benzoyl Peroxide', 'Salicylic Acid', 'Clindamycin', 'Erythromycin',
    'Metronidazole', 'Azelaic Acid', 'Minoxidil', 'Finasteride',
    'Terbinafine', 'Clotrimazole', 'Miconazole', 'Ketoconazole',
    'Fluconazole', 'Itraconazole', 'Voriconazole', 'Caspofungin',
    'Amphotericin B', 'Nystatin', 'Acyclovir', 'Valacyclovir',
    'Famciclovir', 'Oseltamivir', 'Zanamivir', 'Remdesivir',
    'Ritonavir', 'Lopinavir', 'Nelfinavir', 'Saquinavir',
    'Efavirenz', 'Nevirapine', 'Tenofovir', 'Emtricitabine',
    'Lamivudine', 'Abacavir', 'Dolutegravir', 'Raltegravir',
    'Methotrexate', 'Sulfasalazine', 'Hydroxychloroquine', 'Leflunomide',
    'Adalimumab', 'Etanercept', 'Infliximab', 'Rituximab',
    'Tocilizumab', 'Anakinra', 'Canakinumab', 'Ustekinumab'
  ];

  const COMMON_LAB_TESTS = [
    'Full Blood Count', 'Complete Blood Count', 'WBC Count', 'RBC Count',
    'Haemoglobin', 'Haematocrit', 'Platelet Count', 'White Blood Cell Count',
    'Differential Count', 'Neutrophil Count', 'Lymphocyte Count',
    'Monocyte Count', 'Eosinophil Count', 'Basophil Count',
    'Fasting Blood Sugar', 'Random Blood Sugar', 'OGTT',
    'HbA1c', 'Lipid Profile', 'Total Cholesterol', 'LDL Cholesterol',
    'HDL Cholesterol', 'Triglycerides', 'Liver Function Test',
    'ALT', 'AST', 'ALP', 'GGT', 'Total Bilirubin', 'Direct Bilirubin',
    'Indirect Bilirubin', 'Serum Albumin', 'Total Protein',
    'Kidney Function Test', 'Creatinine', 'Urea', 'BUN',
    'Electrolytes', 'Sodium', 'Potassium', 'Chloride', 'Bicarbonate',
    'Calcium', 'Magnesium', 'Phosphate', 'Uric Acid',
    'Thyroid Function Test', 'TSH', 'T3', 'T4', 'Free T3', 'Free T4',
    'Cardiac Enzymes', 'Troponin I', 'Troponin T', 'CK-MB', 'LDH',
    'Prothrombin Time', 'aPTT', 'INR', 'D-Dimer', 'Fibrinogen',
    'Blood Culture', 'Urine Culture', 'Sputum Culture', 'Stool Culture',
    'CSF Culture', 'Throat Swab', 'Wound Swab', 'Genital Swab',
    'Antibiotic Sensitivity Test', 'Gram Stain', 'AFB Smear',
    'GeneXpert', 'PCR Test', 'COVID-19 Test', 'HIV Test',
    'HBsAg', 'Anti-HCV', 'VDRL', 'RPR', 'Widal Test',
    'Rheumatoid Factor', 'ANA Test', 'C-Reactive Protein', 'ESR',
    'Ferritin', 'Serum Iron', 'TIBC', 'Vitamin B12', 'Folate',
    'Vitamin D', 'Alpha-Fetoprotein', 'CA-125', 'CEA', 'PSA',
    'Beta-HCG', 'FSH', 'LH', 'Prolactin', 'Testosterone',
    'Estradiol', 'Progesterone', 'Cortisol', 'ACTH',
    'Urinalysis', 'Urine Microscopy', 'Proteinuria', 'Hematuria',
    'Glucosuria', 'Ketones in Urine', 'Bilirubin in Urine',
    'Urobilinogen', 'Pregnancy Test', 'Ovulation Test',
    'Stool Analysis', 'Occult Blood', 'Ova and Cyst',
    'Semen Analysis', 'Thyroid Peroxidase Antibody',
    'Anti-Tg Antibody', 'H. pylori Test', 'Stool Antigen Test',
    'Rapid Malaria Test', 'Microfilaria Test', 'Blood Smear',
    'Bone Marrow Aspiration', 'Cytology', 'Histopathology',
    'Fine Needle Aspiration', 'Biopsy', 'G6PD Test'
  ];

  const getStaffName = (staff) => {
    if (!staff) return 'Unknown Staff';
    if (staff.firstName && staff.lastName) {
      return `${staff.firstName} ${staff.lastName}`;
    }
    if (staff.fullName) return staff.fullName;
    if (staff.firstName) return staff.firstName;
    if (staff.lastName) return staff.lastName;
    return staff.role || 'Unknown Staff';
  };

  // ✅ FETCH STOCK FOR DISPENSE
  const fetchStockForDispense = async (medicationName) => {
    setDispenseStockLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:3000/api/medications/stock/${encodeURIComponent(medicationName)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDispenseStockInfo(res.data);
      return res.data;
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error(`⚠️ "${medicationName}" not found in inventory. Please add it first.`);
      } else {
        toast.error('Failed to check stock');
      }
      return null;
    } finally {
      setDispenseStockLoading(false);
    }
  };

  // ✅ OPEN DISPENSE MODAL
  const handleOpenDispenseModal = async (prescription) => {
    setDispensingPrescription(prescription);
    setDispenseQuantity(1);
    setShowDispenseSuccess(false);
    setDispenseResult(null);
    await fetchStockForDispense(prescription.medication);
    setShowDispenseModal(true);
  };

  // ✅ PROCESS DISPENSE
  const handleProcessDispense = async () => {
    if (!dispensingPrescription || !dispenseStockInfo) return;
    
    const quantity = parseInt(dispenseQuantity);
    if (!quantity || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    
    if (quantity > dispenseStockInfo.stockQuantity) {
      toast.error(`Insufficient stock. Available: ${dispenseStockInfo.stockQuantity}`);
      return;
    }
    
    setDispensing(true);
    
    try {
      // Step 1: Update stock
      const stockResponse = await axios.patch(
        `http://localhost:3000/api/medications/${dispenseStockInfo.id}/stock`,
        {
          quantity: quantity,
          transactionType: 'Dispensed',
          note: `Dispensed to ${patient.firstName} ${patient.lastName} (${patient.hospitalId}) - ${quantity} unit(s)`,
          patientId: patient.id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Step 2: Mark prescription as dispensed
      const prescResponse = await axios.patch(
        `http://localhost:3000/api/prescriptions/${dispensingPrescription.id}/dispense`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setDispenseStockInfo({
        ...dispenseStockInfo,
        stockQuantity: stockResponse.data.newStock
      });
      
      setDispenseResult({
        medication: dispensingPrescription.medication,
        quantity: quantity,
        beforeStock: dispenseStockInfo.stockQuantity,
        afterStock: stockResponse.data.newStock,
        prescription: prescResponse.data
      });
      
      setShowDispenseSuccess(true);
      toast.success(`✅ ${quantity} unit(s) of ${dispensingPrescription.medication} dispensed!`);
      
      setTimeout(() => {
        fetchAllData();
      }, 500);
      
    } catch (error) {
      console.error('Dispense error:', error);
      toast.error(error.response?.data?.error || 'Failed to dispense');
    } finally {
      setDispensing(false);
    }
  };

  // ✅ FETCH MEDICATIONS for autocomplete
  const fetchMedications = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/medications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const meds = res.data.map(m => m.name);
      setAllMedications([...meds, ...COMMON_MEDICATIONS]);
    } catch (error) {
      console.log('⚠️ Using fallback medication list');
      setAllMedications(COMMON_MEDICATIONS);
    }
  };

  // ✅ FETCH LAB TESTS for autocomplete
  const fetchLabTests = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/services', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const tests = res.data
        .filter(s => s.category === 'Lab' || s.category === 'Lab Test')
        .map(s => s.name);
      setAllLabTests([...tests, ...COMMON_LAB_TESTS]);
    } catch (error) {
      console.log('⚠️ Using fallback lab tests list');
      setAllLabTests(COMMON_LAB_TESTS);
    }
  };

  // ✅ Medication Search Handler
  const handleMedicationSearch = (value) => {
    setMedicationSearchTerm(value);
    setPrescriptionForm({ ...prescriptionForm, medication: value });
    
    if (value && value.length >= 2) {
      const filtered = allMedications
        .filter(m => m.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 15);
      setMedicationSuggestions(filtered);
      setShowMedicationSuggestions(true);
    } else {
      setShowMedicationSuggestions(false);
    }
  };

  // ✅ Select Medication
  const selectMedication = (medication) => {
    setPrescriptionForm({ ...prescriptionForm, medication });
    setMedicationSearchTerm(medication);
    setShowMedicationSuggestions(false);
  };

  // ✅ Lab Test Search Handler
  const handleLabTestSearch = (value) => {
    setLabTestSearchTerm(value);
    setLabOrderForm({ ...labOrderForm, testName: value });
    
    if (value && value.length >= 2) {
      const filtered = allLabTests
        .filter(t => t.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 15);
      setLabTestSuggestions(filtered);
      setShowLabTestSuggestions(true);
    } else {
      setShowLabTestSuggestions(false);
    }
  };

  // ✅ Select Lab Test
  const selectLabTest = (test) => {
    setLabOrderForm({ ...labOrderForm, testName: test });
    setLabTestSearchTerm(test);
    setShowLabTestSuggestions(false);
  };

  // ✅ Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (medicationInputRef.current && !medicationInputRef.current.contains(event.target)) {
        setShowMedicationSuggestions(false);
      }
      if (labTestInputRef.current && !labTestInputRef.current.contains(event.target)) {
        setShowLabTestSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ FETCH AVAILABLE DOCTORS FOR APPOINTMENT
  const fetchAvailableDoctors = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/doctors/available', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableDoctors(res.data);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast.error('Failed to load doctors');
    }
  };

  // ✅ HANDLE APPOINTMENT CREATION
  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/appointments', {
        patientId: patient.id,
        staffId: appointmentForm.staffId,
        dateTime: appointmentForm.dateTime,
        duration: appointmentForm.duration,
        type: appointmentForm.type,
        notes: appointmentForm.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('✅ Appointment scheduled successfully!');
      setShowAppointmentModal(false);
      setAppointmentForm({
        staffId: '',
        dateTime: '',
        duration: 30,
        type: 'Consultation',
        notes: ''
      });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to schedule appointment');
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [patientRes, vitalsRes, imagingRes, notesRes, prescriptionsRes, labRes] = await Promise.all([
        axios.get(`http://localhost:3000/api/patients/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`http://localhost:3000/api/patients/${id}/vitals`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`http://localhost:3000/api/patients/${id}/imaging-orders`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`http://localhost:3000/api/patients/${id}/notes`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get('http://localhost:3000/api/prescriptions', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get('http://localhost:3000/api/lab-orders', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
      ]);

      const patientData = patientRes.data;
      const vitalsData = vitalsRes.data;
      const imagingData = imagingRes.data || [];
      const notesData = notesRes.data || [];
      const prescriptionsData = prescriptionsRes.data.filter(p => p.patientId === id) || [];
      const labData = labRes.data.filter(l => l.patientId === id) || [];

      setPatient(patientData);
      setVitals(vitalsData);
      setImagingOrders(imagingData);
      setNotes(notesData);
      setPrescriptions(prescriptionsData);
      setLabOrders(labData);

      buildRecentActivities(patientData, vitalsData, imagingData, notesData, prescriptionsData, labData);

    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.error || err.message;
      if (status === 403) {
        toast.error(message || 'You do not have permission to view this patient.');
        setTimeout(() => navigate(-1), 3000);
      } else if (status === 404) {
        toast.error('Patient not found.');
      } else {
        toast.error('Failed to load patient profile: ' + message);
      }
      setError(message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Build recent activities timeline
  const buildRecentActivities = (patientData, vitalsData, imagingData, notesData, prescriptionsData, labData) => {
    const activities = [];

    if (vitalsData && vitalsData.length > 0) {
      vitalsData.forEach(v => {
        activities.push({
          id: `vital-${v.id}`,
          type: 'vital',
          date: v.recordedAt,
          title: 'Vital Signs Recorded',
          description: `BP: ${v.bloodPressureSystolic}/${v.bloodPressureDiastolic} | HR: ${v.heartRate} | Temp: ${v.temperature}°C`,
          staff: v.Staff,
          staffName: getStaffName(v.Staff),
          icon: '❤️',
          color: '#ef4444',
          details: v
        });
      });
    }

    if (notesData && notesData.length > 0) {
      notesData.forEach(n => {
        activities.push({
          id: `note-${n.id}`,
          type: 'note',
          date: n.createdAt,
          title: `Clinical Note (${n.type || 'SOAP'})`,
          description: n.subjective || n.assessment || n.fullContent || 'Clinical note recorded',
          staff: n.Staff,
          staffName: getStaffName(n.Staff),
          icon: '📝',
          color: '#3b82f6',
          details: n
        });
      });
    }

    if (prescriptionsData && prescriptionsData.length > 0) {
      prescriptionsData.forEach(p => {
        const isDispensed = p.status === 'Dispensed' || p.status === 'dispensed';
        activities.push({
          id: `prescription-${p.id}`,
          type: 'prescription',
          date: p.createdAt,
          title: `Prescription: ${p.medication}`,
          description: `${p.dosage} - ${p.frequency} (${p.status || 'Prescribed'})`,
          staff: isDispensed ? (p.dispensedBy || p.prescribedBy) : p.prescribedBy,
          staffName: isDispensed 
            ? getStaffName(p.dispensedBy || p.prescribedBy) 
            : getStaffName(p.prescribedBy),
          icon: '💊',
          color: '#8b5cf6',
          details: p
        });
      });
    }

    if (labData && labData.length > 0) {
      labData.forEach(l => {
        const performingStaff = l.performedBy || l.orderedBy;
        activities.push({
          id: `lab-${l.id}`,
          type: 'lab',
          date: l.createdAt,
          title: `Lab Order: ${l.testName}`,
          description: `${l.testType} - ${l.status || 'Ordered'}`,
          staff: performingStaff,
          staffName: getStaffName(performingStaff),
          icon: '🔬',
          color: '#10b981',
          details: l
        });
      });
    }

    if (imagingData && imagingData.length > 0) {
      imagingData.forEach(i => {
        const performingStaff = i.status === 'Completed' ? (i.radiologist || i.orderingStaff) : i.orderingStaff;
        activities.push({
          id: `imaging-${i.id}`,
          type: 'imaging',
          date: i.createdAt,
          title: `Imaging: ${i.imagingType}`,
          description: `${i.bodyPart} - ${i.status || 'Ordered'}`,
          staff: performingStaff,
          staffName: getStaffName(performingStaff),
          icon: '📷',
          color: '#f59e0b',
          details: i
        });
      });
    }

    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    setRecentActivities(activities.slice(0, 20));
  };

  useEffect(() => {
    if (id) {
      fetchAllData();
      fetchMedications();
      fetchLabTests();
    }
  }, [id, token]);

  // ---------- BACK BUTTON ----------
  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      const role = user?.role;
      if (role === 'Nurse') navigate('/nurse-dashboard');
      else if (role === 'Doctor') navigate('/doctor-dashboard');
      else navigate('/patients');
    }
  };

  // ---------- NOTE HANDLERS ----------
  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingNote) {
        await axios.put(`http://localhost:3000/api/clinical-notes/${editingNote.id}`, noteForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Note updated successfully!');
      } else {
        await axios.post('http://localhost:3000/api/clinical-notes', { patientId: id, ...noteForm }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Note added successfully!');
      }
      setShowNoteModal(false);
      setEditingNote(null);
      setNoteForm({ type: 'SOAP', subjective: '', objective: '', assessment: '', plan: '', fullContent: '' });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save note');
    }
  };

  const handleStartEditNote = (note) => {
    setEditingNote(note);
    setNoteForm({
      type: note.type,
      subjective: note.subjective || '',
      objective: note.objective || '',
      assessment: note.assessment || '',
      plan: note.plan || '',
      fullContent: note.fullContent || ''
    });
    setShowNoteModal(true);
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to permanently delete this note?')) return;
    try {
      await axios.delete(`http://localhost:3000/api/clinical-notes/${noteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Note deleted successfully');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  // ---------- VITAL HANDLERS ----------
  const handleVitalSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/vitals', { patientId: id, ...vitalsForm }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Vitals recorded successfully!');
      setShowVitalModal(false);
      setVitalsForm({
        bloodPressureSystolic: '', bloodPressureDiastolic: '', heartRate: '', temperature: '',
        respiratoryRate: '', oxygenSaturation: '', weight: '', height: '', notes: ''
      });
      fetchAllData();
    } catch (error) { toast.error('Failed to record vitals'); }
  };

  // ---------- PRESCRIPTION HANDLERS ----------
  const handlePrescriptionSubmit = async (e) => {
    e.preventDefault();
    if (!prescriptionForm.medication) {
      toast.error('Please select a medication');
      return;
    }
    try {
      await axios.post('http://localhost:3000/api/prescriptions', { patientId: id, ...prescriptionForm }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Prescription created successfully!');
      setShowPrescriptionModal(false);
      setPrescriptionForm({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' });
      setMedicationSearchTerm('');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create prescription');
    }
  };

  // ---------- LAB ORDER HANDLERS ----------
  const handleLabOrderSubmit = async (e) => {
    e.preventDefault();
    if (!labOrderForm.testName) {
      toast.error('Please select a test');
      return;
    }
    try {
      await axios.post('http://localhost:3000/api/lab-orders', { patientId: id, ...labOrderForm }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Lab order created successfully!');
      setShowLabOrderModal(false);
      setLabOrderForm({ testName: '', testType: 'Haematology', priority: 'Routine', notes: '' });
      setLabTestSearchTerm('');
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create lab order');
    }
  };

  // ---------- IMAGING/X-RAY HANDLERS ----------
  const handleImagingSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/imaging-orders', { patientId: id, ...imagingForm }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Imaging order created successfully!');
      setShowImagingModal(false);
      setImagingForm({
        imagingType: 'X-Ray',
        bodyPart: '',
        priority: 'Routine',
        clinicalHistory: '',
        clinicalQuestion: '',
        notes: ''
      });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create imaging order');
    }
  };

  const handleImagingInputChange = (e) => {
    const { name, value } = e.target;
    setImagingForm(prev => ({ ...prev, [name]: value }));
  };

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const canModifyNote = (note) => {
    return user?.role === 'Admin' || note.authorId === user?.id;
  };

  const canOrderImaging = isDoctor;

  const getImageUrl = (url) => {
    if (!url) return '';
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http')) {
      const filename = cleanUrl.split('/').pop();
      cleanUrl = `http://localhost:3000/images/${filename}`;
    }
    return cleanUrl;
  };

  const getActivityIcon = (type) => {
    const icons = {
      vital: '❤️',
      note: '📝',
      prescription: '💊',
      lab: '🔬',
      imaging: '📷'
    };
    return icons[type] || '📋';
  };

  const getActivityColor = (type) => {
    const colors = {
      vital: '#ef4444',
      note: '#3b82f6',
      prescription: '#8b5cf6',
      lab: '#10b981',
      imaging: '#f59e0b'
    };
    return colors[type] || '#6b7280';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return <div className="spinner" />;
  if (error) {
    return (
      <div className="dashboard" style={{ textAlign: 'center', padding: '50px' }}>
        <h3>Oops! Something went wrong.</h3>
        <p>{error}</p>
        <button onClick={handleBack} className="btn btn-secondary">← Go Back</button>
      </div>
    );
  }
  if (!patient) return <div>Patient not found</div>;

  return (
    <div className="patient-profile-container">
      {/* SIDEBAR */}
      <div className="profile-sidebar">
        <h4>Patient Record</h4>
        <button className={`profile-tab-btn ${currentTab === 'profile' ? 'active' : ''}`} onClick={() => setCurrentTab('profile')}>
          <span className="icon">👤</span> Profile
        </button>
        <button className={`profile-tab-btn ${currentTab === 'vitals' ? 'active' : ''}`} onClick={() => setCurrentTab('vitals')}>
          <span className="icon">❤️</span> Vitals
        </button>
        <button className={`profile-tab-btn ${currentTab === 'notes' ? 'active' : ''}`} onClick={() => setCurrentTab('notes')}>
          <span className="icon">📝</span> Clinical Notes
        </button>
        <button className={`profile-tab-btn ${currentTab === 'prescriptions' ? 'active' : ''}`} onClick={() => setCurrentTab('prescriptions')}>
          <span className="icon">💊</span> Prescriptions
        </button>
        <button className={`profile-tab-btn ${currentTab === 'lab-orders' ? 'active' : ''}`} onClick={() => setCurrentTab('lab-orders')}>
          <span className="icon">🔬</span> Lab Orders
        </button>
        <button className={`profile-tab-btn ${currentTab === 'imaging' ? 'active' : ''}`} onClick={() => setCurrentTab('imaging')}>
          <span className="icon">📷</span> Imaging/X-Ray
        </button>

        <div style={{ marginTop: '20px', padding: '0 20px' }}>
          <button onClick={handleBack} className="btn btn-secondary" style={{ width: '100%', display: 'block', textAlign: 'center', cursor: 'pointer' }}>
            ← Back to List
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="profile-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>{patient.firstName} {patient.lastName}</h3>
          {isDoctor && (
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => {
                fetchAvailableDoctors();
                setShowAppointmentModal(true);
              }}
              style={{
                background: '#0f3460',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              📅 Schedule Appointment
            </button>
          )}
        </div>

        <div className="profile-grid" style={{ marginBottom: '20px' }}>
          <div className="profile-grid-item"><span className="label">Hospital ID</span><span className="value">{patient.hospitalId}</span></div>
          <div className="profile-grid-item"><span className="label">Age</span><span className="value">{calculateAge(patient.dateOfBirth)} years</span></div>
          <div className="profile-grid-item"><span className="label">Gender</span><span className="value">{patient.gender}</span></div>
          <div className="profile-grid-item"><span className="label">Date of Birth</span><span className="value">{new Date(patient.dateOfBirth).toLocaleDateString()}</span></div>
          <div className="profile-grid-item"><span className="label">Phone</span><span className="value">{patient.phone || '-'}</span></div>
          <div className="profile-grid-item"><span className="label">Email</span><span className="value">{patient.email || '-'}</span></div>
          <div className="profile-grid-item"><span className="label">Address</span><span className="value">{patient.address || '-'}</span></div>
          <div className="profile-grid-item"><span className="label">Emergency Contact</span><span className="value">{patient.emergencyContact || '-'}</span></div>
          <div className="profile-grid-item"><span className="label">Allergies</span><span className="value" style={{ color: patient.allergies ? '#ef4444' : 'inherit' }}>{patient.allergies || 'None'}</span></div>
          <div className="profile-grid-item" style={{ gridColumn: '1 / -1' }}><span className="label">Next of Kin</span><span className="value">{patient.nextOfKinName || '-'} {patient.nextOfKinPhone ? ` (${patient.nextOfKinPhone})` : ''} {patient.nextOfKinRelationship ? ` - ${patient.nextOfKinRelationship}` : ''}</span></div>
        </div>

        {/* Recent Activity Timeline */}
        {recentActivities.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', position: 'sticky', top: 0, background: 'white', zIndex: 1, paddingBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>
                📋 Recent Activities
              </h4>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {recentActivities.length} activities
              </span>
            </div>

            <div style={{ position: 'relative', paddingLeft: '20px' }}>
              <div style={{
                position: 'absolute',
                left: '6px',
                top: '4px',
                bottom: '4px',
                width: '2px',
                background: '#e5e7eb'
              }} />

              {recentActivities.map((activity, index) => (
                <div key={activity.id} style={{
                  position: 'relative',
                  padding: '10px 12px 10px 20px',
                  marginBottom: '4px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  borderLeft: `3px solid ${getActivityColor(activity.type)}`,
                  background: index % 2 === 0 ? '#fafafa' : 'white'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f0f7ff'}
                onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? '#fafafa' : 'white'}
                onClick={() => {
                  const tabMap = {
                    vital: 'vitals',
                    note: 'notes',
                    prescription: 'prescriptions',
                    lab: 'lab-orders',
                    imaging: 'imaging'
                  };
                  setCurrentTab(tabMap[activity.type] || 'profile');
                }}
                >
                  <div style={{
                    position: 'absolute',
                    left: '-20px',
                    top: '14px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: getActivityColor(activity.type),
                    border: '2px solid white',
                    boxShadow: '0 0 0 2px ' + getActivityColor(activity.type)
                  }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '18px' }}>{getActivityIcon(activity.type)}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a2e', flex: '1' }}>
                      {activity.title}
                    </span>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>
                      {formatDate(activity.date)}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: '#374151', marginTop: '2px' }}>
                    {activity.description}
                  </div>

                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    👤 {activity.staffName}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#9ca3af' }}>
              💡 Click any activity to jump to its section
            </div>
          </div>
        )}

        {/* TAB CONTENT */}
        {currentTab === 'profile' && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h4 style={{ margin: '0 0 16px 0' }}>📋 Full Patient Information</h4>
            <div className="profile-grid">
              <div className="profile-grid-item"><span className="label">Hospital ID</span><span className="value">{patient.hospitalId}</span></div>
              <div className="profile-grid-item"><span className="label">Age</span><span className="value">{calculateAge(patient.dateOfBirth)} years</span></div>
              <div className="profile-grid-item"><span className="label">Gender</span><span className="value">{patient.gender}</span></div>
              <div className="profile-grid-item"><span className="label">Date of Birth</span><span className="value">{new Date(patient.dateOfBirth).toLocaleDateString()}</span></div>
              <div className="profile-grid-item"><span className="label">Phone</span><span className="value">{patient.phone || '-'}</span></div>
              <div className="profile-grid-item"><span className="label">Email</span><span className="value">{patient.email || '-'}</span></div>
              <div className="profile-grid-item"><span className="label">Address</span><span className="value">{patient.address || '-'}</span></div>
              <div className="profile-grid-item"><span className="label">Emergency Contact</span><span className="value">{patient.emergencyContact || '-'}</span></div>
              <div className="profile-grid-item"><span className="label">Allergies</span><span className="value" style={{ color: patient.allergies ? '#ef4444' : 'inherit' }}>{patient.allergies || 'None'}</span></div>
              <div className="profile-grid-item" style={{ gridColumn: '1 / -1' }}><span className="label">Next of Kin</span><span className="value">{patient.nextOfKinName || '-'} {patient.nextOfKinPhone ? ` (${patient.nextOfKinPhone})` : ''} {patient.nextOfKinRelationship ? ` - ${patient.nextOfKinRelationship}` : ''}</span></div>
              <div className="profile-grid-item"><span className="label">Patient Category</span><span className="value">{patient.patientCategory || 'FPP'}</span></div>
              <div className="profile-grid-item"><span className="label">Insurance</span><span className="value">{patient.insuranceProvider || 'None'}</span></div>
              <div className="profile-grid-item"><span className="label">Insurance ID</span><span className="value">{patient.insuranceId || '—'}</span></div>
              <div className="profile-grid-item"><span className="label">Corporate Company</span><span className="value">{patient.corporateCompany || '—'}</span></div>
              <div className="profile-grid-item"><span className="label">Registered</span><span className="value">{new Date(patient.createdAt).toLocaleDateString()}</span></div>
              <div className="profile-grid-item"><span className="label">Last Updated</span><span className="value">{new Date(patient.updatedAt).toLocaleDateString()}</span></div>
            </div>
          </div>
        )}

        {/* VITALS TAB */}
        {currentTab === 'vitals' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ border: 'none', padding: 0, margin: 0 }}>Vital Signs History</h3>
              <button className="btn btn-primary" onClick={() => setShowVitalModal(true)}>➕ Record Vitals</button>
            </div>
            {vitals.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Date/Time</th><th>Nurse</th><th>BP (mmHg)</th><th>HR (bpm)</th><th>Temp (°C)</th><th>SpO₂ (%)</th><th>RR (/min)</th><th>Weight (kg)</th><th>Height (cm)</th><th>Notes</th></tr></thead>
                  <tbody>{vitals.map(v => (
                    <tr key={v.id}>
                      <td>{new Date(v.recordedAt).toLocaleString()}</td>
                      <td>{getStaffName(v.Staff)}</td>
                      <td>{v.bloodPressureSystolic}/{v.bloodPressureDiastolic}</td>
                      <td>{v.heartRate}</td>
                      <td>{v.temperature}</td>
                      <td>{v.oxygenSaturation}</td>
                      <td>{v.respiratoryRate}</td>
                      <td>{v.weight}</td>
                      <td>{v.height}</td>
                      <td>{v.notes || '-'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : (<p>No vitals recorded yet.</p>)}
          </>
        )}

        {/* NOTES TAB */}
        {currentTab === 'notes' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ border: 'none', padding: 0, margin: 0 }}>Clinical Notes (SOAP)</h3>
              <button className="btn btn-secondary" onClick={() => {
                setEditingNote(null);
                setNoteForm({ type: 'SOAP', subjective: '', objective: '', assessment: '', plan: '', fullContent: '' });
                setShowNoteModal(true);
              }}>+ Add Note</button>
            </div>
            {notes.length > 0 ? (
              notes.map(n => (
                <div key={n.id} className={`note-card type-${n.type.replace(/ /g, '')}`}>
                  <div className="note-header">
                    <div className={`note-tag tag-${n.type.replace(/ /g, '')}`}>{n.type}</div>
                    <span><strong>{n.type}</strong> by {getStaffName(n.Staff)}</span>
                    <span className="note-date">{new Date(n.createdAt).toLocaleString()}</span>
                    {canModifyNote(n) && (
                      <div className="note-actions">
                        <button onClick={() => handleStartEditNote(n)}>✏️ Edit</button>
                        <button className="delete-btn" onClick={() => handleDeleteNote(n.id)}>🗑️ Delete</button>
                      </div>
                    )}
                  </div>
                  <div className="note-body">
                    {n.subjective && <div><strong>S:</strong> {n.subjective}</div>}
                    {n.objective && <div><strong>O:</strong> {n.objective}</div>}
                    {n.assessment && <div><strong>A:</strong> {n.assessment}</div>}
                    {n.plan && <div><strong>P:</strong> {n.plan}</div>}
                    {!n.subjective && !n.objective && !n.assessment && !n.plan && <div style={{ opacity: 0.7 }}>{n.fullContent || 'No structured content'}</div>}
                  </div>
                </div>
              ))
            ) : (<p>No clinical notes.</p>)}
          </>
        )}

        {/* ============================================================
            PRESCRIPTIONS TAB - WITH DISPENSE BUTTON & MODAL
            ============================================================ */}
        {currentTab === 'prescriptions' && (
          <div className="table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h3 style={{ border: 'none', padding: 0, margin: 0 }}>💊 Prescriptions</h3>
              {(isDoctor || isNurse) && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowPrescriptionModal(true)}>
                  ➕ New Prescription
                </button>
              )}
            </div>

            {isPharmacist && (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #3b82f6',
                borderRadius: '8px',
                padding: '10px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '18px' }}>💊</span>
                <span style={{ fontSize: '14px', color: '#1e3a5f' }}>
                  Click <strong>"Dispense"</strong> on any Prescribed medication.
                  <span style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                    Stock balance will be shown before dispensing.
                  </span>
                </span>
              </div>
            )}

            <table>
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Status</th>
                  <th>Prescribed By</th>
                  <th>Dispensed By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.length > 0 ? (
                  prescriptions.map(p => (
                    <tr key={p.id} style={{
                      background: p.status === 'Prescribed' && isPharmacist ? '#fefce8' : 'white'
                    }}>
                      <td><strong>{p.medication}</strong></td>
                      <td>{p.dosage}</td>
                      <td>{p.frequency}</td>
                      <td>
                        <span className="status-badge" style={{
                          background: p.status === 'Dispensed' ? '#10b981' : p.status === 'Cancelled' ? '#ef4444' : '#f59e0b',
                          color: p.status === 'Dispensed' ? 'white' : p.status === 'Cancelled' ? 'white' : '#1a1a2e',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-block'
                        }}>
                          {p.status || 'Prescribed'}
                        </span>
                      </td>
                      <td>{getStaffName(p.prescribedBy)}</td>
                      <td>{p.status === 'Dispensed' ? getStaffName(p.dispensedBy) : '-'}</td>
                      <td>
                        {isPharmacist && p.status === 'Prescribed' && (
                          <button
                            className="btn btn-sm"
                            onClick={() => handleOpenDispenseModal(p)}
                            style={{
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                          >
                            💊 Dispense
                          </button>
                        )}
                        {p.status === 'Dispensed' && (
                          <span style={{ color: '#10b981', fontSize: '12px', fontWeight: '600' }}>
                            ✅ Dispensed
                            {p.dispensedBy && (
                              <span style={{ fontSize: '10px', color: '#6b7280', display: 'block' }}>
                                by {getStaffName(p.dispensedBy)}
                              </span>
                            )}
                          </span>
                        )}
                        {p.status === 'Prescribed' && !isPharmacist && (
                          <span style={{ fontSize: '11px', color: '#6b7280' }}>
                            ⏳ Awaiting Dispense
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="7" className="text-center">No prescriptions found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* LAB ORDERS TAB */}
        {currentTab === 'lab-orders' && (
          <div className="table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h3 style={{ border: 'none', padding: 0, margin: 0 }}>Lab Orders</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowLabOrderModal(true)}>➕ New Lab Order</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Ordered By</th>
                  <th>Performed By</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {labOrders.length > 0 ? (
                  labOrders.map(l => (
                    <tr key={l.id}>
                      <td><strong>{l.testName}</strong></td>
                      <td>{l.testType}</td>
                      <td>
                        <span className="status-badge" style={{
                          background: l.priority === 'Urgent' ? '#ef4444' : l.priority === 'Emergency' ? '#dc2626' : '#3b82f6',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-block'
                        }}>
                          {l.priority || 'Routine'}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge" style={{
                          background: l.status === 'Completed' ? '#10b981' : l.status === 'Ordered' ? '#f59e0b' : '#6b7280',
                          color: l.status === 'Completed' ? 'white' : '#1a1a2e',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-block'
                        }}>
                          {l.status || 'Ordered'}
                        </span>
                      </td>
                      <td>{getStaffName(l.orderedBy)}</td>
                      <td>{l.performedBy ? getStaffName(l.performedBy) : '-'}</td>
                      <td>{l.result || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="7" className="text-center">No lab orders found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* IMAGING TAB */}
        {currentTab === 'imaging' && (
          <div className="table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h3 style={{ border: 'none', padding: 0, margin: 0 }}>📷 Imaging & X-Ray Orders</h3>
              {canOrderImaging && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowImagingModal(true)}>
                  ➕ New Imaging Order
                </button>
              )}
            </div>

            {imagingOrders.some(order => order.images && order.images.length > 0) && (
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>
                  📷 Images ({imagingOrders.reduce((count, order) => count + (order.images ? order.images.split(',').length : 0), 0)})
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                  {imagingOrders
                    .filter(order => order.images && order.images.length > 0)
                    .flatMap(order => order.images.split(','))
                    .filter(url => url && url.trim() !== '')
                    .map((url, idx) => {
                      const imageUrl = getImageUrl(url);
                      return (
                        <div key={idx} style={{ position: 'relative', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', aspectRatio: '1 / 1' }}>
                          <img src={imageUrl} alt={`Imaging ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', transition: 'transform 0.2s' }}
                            onClick={() => window.open(imageUrl, '_blank')}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            onError={(e) => {
                              console.error(`❌ Failed to load image: ${imageUrl}`);
                              e.target.onerror = null;
                              e.target.style.display = 'none';
                              const parent = e.target.parentElement;
                              const fallback = document.createElement('div');
                              fallback.style.cssText = `width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f1f5f9;color:#6b7280;font-size:14px;padding:10px;text-align:center;`;
                              const filename = imageUrl.split('/').pop();
                              fallback.innerHTML = `<span style="font-size:32px;">🖼️</span><span style="margin-top:4px;font-size:12px;">${filename}</span><button onclick="window.open('${imageUrl}', '_blank')" style="margin-top:6px;padding:4px 12px;background:#0f3460;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">View Full Size</button>`;
                              parent.appendChild(fallback);
                            }}
                          />
                          <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>{idx + 1}</span>
                        </div>
                      );
                    })}
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Click on any image to view full size</p>
              </div>
            )}

            {imagingOrders.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Type</th>
                    <th>Body Part</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Ordered By</th>
                    <th>Radiologist</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {imagingOrders.map(order => (
                    <tr key={order.id}>
                      <td><strong>{order.orderNumber || order.id.slice(0, 8)}</strong></td>
                      <td>{order.imagingType}</td>
                      <td>{order.bodyPart}</td>
                      <td>
                        <span className="status-badge" style={{
                          background: order.priority === 'Emergency' ? '#dc2626' : order.priority === 'Urgent' ? '#ef4444' : '#3b82f6',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-block'
                        }}>
                          {order.priority || 'Routine'}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge" style={{
                          background: order.status === 'Completed' ? '#10b981' : order.status === 'In Progress' ? '#3b82f6' : order.status === 'Scheduled' ? '#8b5cf6' : order.status === 'Cancelled' ? '#ef4444' : '#f59e0b',
                          color: ['Completed', 'Cancelled'].includes(order.status) ? 'white' : '#1a1a2e',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-block'
                        }}>
                          {order.status || 'Ordered'}
                        </span>
                      </td>
                      <td>{getStaffName(order.orderingStaff)}</td>
                      <td>{order.status === 'Completed' ? getStaffName(order.radiologist) : '-'}</td>
                      <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button className="btn btn-sm btn-primary" onClick={() => { setSelectedOrder(order); setShowOrderModal(true); }}
                          style={{ background: '#0f3460', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#1a4a7a'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#0f3460'}
                        >
                          📄 View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                <p style={{ fontSize: '16px' }}>📷 No imaging orders found.</p>
                <p style={{ fontSize: '14px' }}>{canOrderImaging ? 'Click "New Imaging Order" to request an X-Ray or scan.' : 'Imaging orders will appear here when requested by a doctor.'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================
          APPOINTMENT MODAL
          ============================================================ */}
      {showAppointmentModal && (
        <div className="modal-overlay" onClick={() => setShowAppointmentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>📅 Schedule Appointment</h3>
              <button className="modal-close" onClick={() => setShowAppointmentModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateAppointment}>
              <div className="modal-body">
                <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                  <p style={{ margin: 0 }}><strong>Patient:</strong> {patient.firstName} {patient.lastName}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>ID: {patient.hospitalId}</p>
                </div>

                <div className="form-group">
                  <label>Doctor *</label>
                  <select
                    value={appointmentForm.staffId}
                    onChange={(e) => setAppointmentForm({...appointmentForm, staffId: e.target.value})}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Select Doctor...</option>
                    {availableDoctors.map(d => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.firstName} {d.lastName} ({d.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={appointmentForm.dateTime}
                    onChange={(e) => setAppointmentForm({...appointmentForm, dateTime: e.target.value})}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Duration (minutes)</label>
                    <select
                      value={appointmentForm.duration}
                      onChange={(e) => setAppointmentForm({...appointmentForm, duration: parseInt(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">60 min</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      value={appointmentForm.type}
                      onChange={(e) => setAppointmentForm({...appointmentForm, type: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="Consultation">Consultation</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Emergency">Emergency</option>
                      <option value="Procedure">Procedure</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={appointmentForm.notes}
                    onChange={(e) => setAppointmentForm({...appointmentForm, notes: e.target.value})}
                    rows="2"
                    placeholder="Any additional notes..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAppointmentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule Appointment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          VITAL SIGNS MODAL
          ============================================================ */}
      {showVitalModal && (
        <div className="modal-overlay" onClick={() => setShowVitalModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record Vitals – {patient.firstName} {patient.lastName}</h3>
              <button className="modal-close" onClick={() => setShowVitalModal(false)}>×</button>
            </div>
            <form onSubmit={handleVitalSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>BP Systolic (mmHg)</label><input type="number" value={vitalsForm.bloodPressureSystolic} onChange={e => setVitalsForm({...vitalsForm, bloodPressureSystolic: e.target.value})} /></div>
                  <div className="form-group"><label>BP Diastolic (mmHg)</label><input type="number" value={vitalsForm.bloodPressureDiastolic} onChange={e => setVitalsForm({...vitalsForm, bloodPressureDiastolic: e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Heart Rate (bpm)</label><input type="number" value={vitalsForm.heartRate} onChange={e => setVitalsForm({...vitalsForm, heartRate: e.target.value})} /></div>
                  <div className="form-group"><label>Temperature (°C)</label><input type="number" step="0.1" value={vitalsForm.temperature} onChange={e => setVitalsForm({...vitalsForm, temperature: e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Respiratory Rate (breaths/min)</label><input type="number" value={vitalsForm.respiratoryRate} onChange={e => setVitalsForm({...vitalsForm, respiratoryRate: e.target.value})} /></div>
                  <div className="form-group"><label>Oxygen Saturation (%)</label><input type="number" value={vitalsForm.oxygenSaturation} onChange={e => setVitalsForm({...vitalsForm, oxygenSaturation: e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Weight (kg)</label><input type="number" step="0.1" value={vitalsForm.weight} onChange={e => setVitalsForm({...vitalsForm, weight: e.target.value})} /></div>
                  <div className="form-group"><label>Height (cm)</label><input type="number" value={vitalsForm.height} onChange={e => setVitalsForm({...vitalsForm, height: e.target.value})} /></div>
                </div>
                <div className="form-group"><label>Notes</label><textarea value={vitalsForm.notes} onChange={e => setVitalsForm({...vitalsForm, notes: e.target.value})} rows="2" /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowVitalModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save Vitals</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          NOTES MODAL
          ============================================================ */}
      {showNoteModal && (
        <div className="modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingNote ? 'Edit Clinical Note' : 'Add Clinical Note'}</h3>
              <button className="modal-close" onClick={() => setShowNoteModal(false)}>×</button>
            </div>
            <form onSubmit={handleNoteSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Note Type</label><select value={noteForm.type} onChange={e => setNoteForm({...noteForm, type: e.target.value})}><option value="SOAP">SOAP Note</option><option value="Progress Note">Progress Note</option><option value="Discharge Summary">Discharge Summary</option></select></div>
                <div className="form-group"><label>Subjective (Patient's complaints)</label><textarea rows="3" value={noteForm.subjective} onChange={e => setNoteForm({...noteForm, subjective: e.target.value})} placeholder="e.g. Patient reports chest pain..." /></div>
                <div className="form-group"><label>Objective (Examination findings)</label><textarea rows="3" value={noteForm.objective} onChange={e => setNoteForm({...noteForm, objective: e.target.value})} placeholder="e.g. BP 120/80, Heart rate 70..." /></div>
                <div className="form-group"><label>Assessment (Diagnosis/Impression)</label><textarea rows="3" value={noteForm.assessment} onChange={e => setNoteForm({...noteForm, assessment: e.target.value})} placeholder="e.g. Suspect hypertension..." /></div>
                <div className="form-group"><label>Plan (Treatment/Next steps)</label><textarea rows="3" value={noteForm.plan} onChange={e => setNoteForm({...noteForm, plan: e.target.value})} placeholder="e.g. Order lab tests, prescribe medication..." /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowNoteModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">{editingNote ? 'Update Note' : 'Save Note'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          PRESCRIPTION MODAL - WITH AUTOCOMPLETE
          ============================================================ */}
      {showPrescriptionModal && (
        <div className="modal-overlay" onClick={() => setShowPrescriptionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>💊 New Prescription</h3>
              <button className="modal-close" onClick={() => setShowPrescriptionModal(false)}>×</button>
            </div>
            <form onSubmit={handlePrescriptionSubmit}>
              <div className="modal-body">
                <div className="form-group" ref={medicationInputRef}>
                  <label>Medication * <span style={{ fontSize: '12px', color: '#6b7280' }}>(Type at least 2 letters)</span></label>
                  <input
                    type="text"
                    required
                    value={medicationSearchTerm || prescriptionForm.medication}
                    onChange={(e) => handleMedicationSearch(e.target.value)}
                    placeholder="e.g. Paracetamol, Amoxicillin, Metformin..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    autoComplete="off"
                  />
                  {showMedicationSuggestions && medicationSuggestions.length > 0 && (
                    <div
                      ref={medicationSuggestionRef}
                      style={{
                        position: 'absolute',
                        zIndex: 1000,
                        background: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        width: '100%',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        marginTop: '4px'
                      }}
                    >
                      {medicationSuggestions.map((med, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: idx < medicationSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onClick={() => selectMedication(med)}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f0f7ff'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <span>💊</span>
                          <span style={{ fontWeight: '500' }}>{med}</span>
                          <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: 'auto' }}>Click to select</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {showMedicationSuggestions && medicationSuggestions.length === 0 && medicationSearchTerm.length >= 2 && (
                    <div style={{
                      position: 'absolute',
                      zIndex: 1000,
                      background: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      width: '100%',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      marginTop: '4px',
                      color: '#6b7280'
                    }}>
                      No matching medications found. You can type the full name.
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group"><label>Dosage *</label><input type="text" required value={prescriptionForm.dosage} onChange={e => setPrescriptionForm({...prescriptionForm, dosage: e.target.value})} placeholder="e.g. 500mg" /></div>
                  <div className="form-group"><label>Frequency *</label><input type="text" required value={prescriptionForm.frequency} onChange={e => setPrescriptionForm({...prescriptionForm, frequency: e.target.value})} placeholder="e.g. Twice daily" /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Duration</label><input type="text" value={prescriptionForm.duration} onChange={e => setPrescriptionForm({...prescriptionForm, duration: e.target.value})} placeholder="e.g. 7 days" /></div>
                  <div className="form-group"><label>Instructions</label><input type="text" value={prescriptionForm.instructions} onChange={e => setPrescriptionForm({...prescriptionForm, instructions: e.target.value})} placeholder="e.g. Take with food" /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowPrescriptionModal(false);
                  setMedicationSearchTerm('');
                }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Prescription</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          LAB ORDER MODAL - WITH AUTOCOMPLETE
          ============================================================ */}
      {showLabOrderModal && (
        <div className="modal-overlay" onClick={() => setShowLabOrderModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>🔬 New Lab Order</h3>
              <button className="modal-close" onClick={() => setShowLabOrderModal(false)}>×</button>
            </div>
            <form onSubmit={handleLabOrderSubmit}>
              <div className="modal-body">
                <div className="form-group" ref={labTestInputRef}>
                  <label>Test Name * <span style={{ fontSize: '12px', color: '#6b7280' }}>(Type at least 2 letters)</span></label>
                  <input
                    type="text"
                    required
                    value={labTestSearchTerm || labOrderForm.testName}
                    onChange={(e) => handleLabTestSearch(e.target.value)}
                    placeholder="e.g. Full Blood Count, FBS, HbA1c..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    autoComplete="off"
                  />
                  {showLabTestSuggestions && labTestSuggestions.length > 0 && (
                    <div
                      ref={labTestSuggestionRef}
                      style={{
                        position: 'absolute',
                        zIndex: 1000,
                        background: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        width: '100%',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        marginTop: '4px'
                      }}
                    >
                      {labTestSuggestions.map((test, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: idx < labTestSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onClick={() => selectLabTest(test)}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f0f7ff'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <span>🔬</span>
                          <span style={{ fontWeight: '500' }}>{test}</span>
                          <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: 'auto' }}>Click to select</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {showLabTestSuggestions && labTestSuggestions.length === 0 && labTestSearchTerm.length >= 2 && (
                    <div style={{
                      position: 'absolute',
                      zIndex: 1000,
                      background: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      width: '100%',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      marginTop: '4px',
                      color: '#6b7280'
                    }}>
                      No matching tests found. You can type the full name.
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group"><label>Test Type *</label>
                    <select value={labOrderForm.testType} onChange={e => setLabOrderForm({...labOrderForm, testType: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}>
                      <option>Haematology</option><option>Biochemistry</option><option>Microbiology</option><option>Immunology</option><option>Serology</option><option>Molecular</option><option>Toxicology</option><option>Histopathology</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Priority *</label>
                    <select value={labOrderForm.priority} onChange={e => setLabOrderForm({...labOrderForm, priority: e.target.value})} style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}>
                      <option>Routine</option><option>Urgent</option><option>Emergency</option>
                    </select>
                  </div>
                </div>
                <div className="form-group"><label>Notes</label><textarea rows="2" value={labOrderForm.notes} onChange={e => setLabOrderForm({...labOrderForm, notes: e.target.value})} placeholder="Any additional notes..." style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowLabOrderModal(false);
                  setLabTestSearchTerm('');
                }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Lab Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          IMAGING ORDER DETAILS MODAL
          ============================================================ */}
      {showOrderModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowOrderModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>📷 Imaging Order Details</h3>
              <button className="modal-close" onClick={() => setShowOrderModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div><strong>Order #:</strong> {selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}</div>
                <div><strong>Type:</strong> {selectedOrder.imagingType}</div>
                <div><strong>Body Part:</strong> {selectedOrder.bodyPart}</div>
                <div><strong>Priority:</strong> {selectedOrder.priority || 'Routine'}</div>
                <div><strong>Status:</strong> {selectedOrder.status || 'Ordered'}</div>
                <div><strong>Ordered By:</strong> {getStaffName(selectedOrder.orderingStaff)}</div>
                <div><strong>Radiologist:</strong> {selectedOrder.status === 'Completed' ? getStaffName(selectedOrder.radiologist) : 'Pending'}</div>
                <div><strong>Date:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}</div>
                <div><strong>Images:</strong> {selectedOrder.images ? selectedOrder.images.split(',').length : 0} image(s)</div>
              </div>
              {selectedOrder.clinicalHistory && <div style={{ marginBottom: '12px' }}><strong>Clinical History:</strong><p style={{ margin: '4px 0 0 0', color: '#374151' }}>{selectedOrder.clinicalHistory}</p></div>}
              {selectedOrder.clinicalQuestion && <div style={{ marginBottom: '12px' }}><strong>Clinical Question:</strong><p style={{ margin: '4px 0 0 0', color: '#374151' }}>{selectedOrder.clinicalQuestion}</p></div>}
              {selectedOrder.result && <div style={{ marginBottom: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #10b981' }}><strong style={{ color: '#065f46' }}>Findings:</strong><p style={{ margin: '4px 0 0 0', color: '#374151' }}>{selectedOrder.result}</p></div>}
              {selectedOrder.report && <div style={{ marginBottom: '12px', padding: '12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #3b82f6' }}><strong style={{ color: '#1e40af' }}>Impression:</strong><p style={{ margin: '4px 0 0 0', color: '#374151' }}>{selectedOrder.report}</p></div>}
              {selectedOrder.images && selectedOrder.images.length > 0 && (
                <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0' }}>📷 Images ({selectedOrder.images.split(',').length})</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                    {selectedOrder.images.split(',').filter(url => url && url.trim() !== '').map((url, index) => {
                      const imageUrl = getImageUrl(url);
                      return (
                        <div key={index} style={{ position: 'relative', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', aspectRatio: '1 / 1' }}>
                          <img src={imageUrl} alt={`Image ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(imageUrl, '_blank')} onError={(e) => {
                            console.error(`❌ Failed to load image: ${imageUrl}`);
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            const parent = e.target.parentElement;
                            const fallback = document.createElement('div');
                            fallback.style.cssText = `width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f1f5f9;color:#6b7280;font-size:14px;padding:10px;text-align:center;`;
                            const filename = imageUrl.split('/').pop();
                            fallback.innerHTML = `<span style="font-size:32px;">🖼️</span><span style="margin-top:4px;font-size:12px;">${filename}</span><button onclick="window.open('${imageUrl}', '_blank')" style="margin-top:6px;padding:4px 12px;background:#0f3460;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">View Full Size</button>`;
                            parent.appendChild(fallback);
                          }} />
                          <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>{index + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Click on any image to view full size</p>
                </div>
              )}
              {selectedOrder.notes && <div style={{ marginTop: '12px' }}><strong>Notes:</strong><p style={{ margin: '4px 0 0 0', color: '#374151' }}>{selectedOrder.notes}</p></div>}
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowOrderModal(false)} style={{ background: '#e5e7eb', color: '#1f2937', border: '1px solid #d1d5db', padding: '10px 30px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Close</button></div>
          </div>
        </div>
      )}

      {/* ============================================================
          IMAGING/X-RAY MODAL
          ============================================================ */}
      {showImagingModal && (
        <div className="modal-overlay" onClick={() => setShowImagingModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3>📷 New Imaging/X-Ray Order</h3>
              <button className="modal-close" onClick={() => setShowImagingModal(false)}>×</button>
            </div>
            <form onSubmit={handleImagingSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Imaging Type *</label><select name="imagingType" value={imagingForm.imagingType} onChange={handleImagingInputChange} required style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}>{imagingTypes.map(type => (<option key={type} value={type}>{type}</option>))}</select></div>
                <div className="form-group"><label>Body Part *</label><select name="bodyPart" value={imagingForm.bodyPart} onChange={handleImagingInputChange} required style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}><option value="">Select Body Part...</option>{bodyParts.map(part => (<option key={part} value={part}>{part}</option>))}</select></div>
                <div className="form-group"><label>Priority *</label><select name="priority" value={imagingForm.priority} onChange={handleImagingInputChange} style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}><option value="Routine">Routine</option><option value="Urgent">Urgent</option><option value="Emergency">Emergency</option></select></div>
                <div className="form-group"><label>Clinical History</label><textarea name="clinicalHistory" value={imagingForm.clinicalHistory} onChange={handleImagingInputChange} rows="2" placeholder="Brief clinical history..." style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} /></div>
                <div className="form-group"><label>Clinical Question</label><textarea name="clinicalQuestion" value={imagingForm.clinicalQuestion} onChange={handleImagingInputChange} rows="2" placeholder="What specific question do you want answered by this imaging?" style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} /></div>
                <div className="form-group"><label>Additional Notes</label><textarea name="notes" value={imagingForm.notes} onChange={handleImagingInputChange} rows="2" placeholder="Any additional notes..." style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowImagingModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Order Imaging</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          DISPENSE MODAL - WITH STOCK BALANCE & QUANTITY INPUT
          ============================================================ */}
      {showDispenseModal && dispensingPrescription && (
        <div className="modal-overlay" onClick={() => setShowDispenseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
            maxWidth: '550px',
            borderRadius: '16px',
            overflow: 'hidden'
          }}>
            
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #0f3460, #1a4a7a)',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>💊</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Dispense Medication</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', opacity: 0.8 }}>
                    {patient.firstName} {patient.lastName} • {patient.hospitalId}
                  </p>
                </div>
              </div>
              <button 
                className="modal-close" 
                onClick={() => setShowDispenseModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              {/* Prescription Info */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Medication</span>
                    <div style={{ fontWeight: '600', fontSize: '16px' }}>{dispensingPrescription.medication}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Dosage</span>
                    <div style={{ fontWeight: '500' }}>{dispensingPrescription.dosage}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Frequency</span>
                    <div style={{ fontWeight: '500' }}>{dispensingPrescription.frequency}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Prescribed By</span>
                    <div style={{ fontWeight: '500', fontSize: '13px' }}>{getStaffName(dispensingPrescription.prescribedBy)}</div>
                  </div>
                </div>
              </div>

              {/* Stock Balance */}
              <div style={{
                background: dispenseStockInfo?.stockQuantity <= 0 ? '#fee2e2' : 
                           dispenseStockInfo?.stockQuantity <= (dispenseStockInfo?.reorderLevel || 10) ? '#fef3c7' : '#f0fdf4',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                border: `2px solid ${
                  dispenseStockInfo?.stockQuantity <= 0 ? '#dc2626' : 
                  dispenseStockInfo?.stockQuantity <= (dispenseStockInfo?.reorderLevel || 10) ? '#f59e0b' : '#10b981'
                }`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '32px' }}>
                      {dispenseStockInfo?.stockQuantity <= 0 ? '📦' : 
                       dispenseStockInfo?.stockQuantity <= (dispenseStockInfo?.reorderLevel || 10) ? '⚠️' : '✅'}
                    </span>
                    <div>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Current Stock Balance</span>
                      <div style={{ 
                        fontSize: '28px', 
                        fontWeight: '700',
                        color: dispenseStockInfo?.stockQuantity <= 0 ? '#dc2626' : 
                               dispenseStockInfo?.stockQuantity <= (dispenseStockInfo?.reorderLevel || 10) ? '#d97706' : '#065f46'
                      }}>
                        {dispenseStockLoading ? '...' : dispenseStockInfo?.stockQuantity || 0}
                        <span style={{ fontSize: '14px', fontWeight: '400', color: '#6b7280', marginLeft: '4px' }}>units</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Reorder Level</span>
                    <div style={{ fontWeight: '600' }}>{dispenseStockInfo?.reorderLevel || 10} units</div>
                    {dispenseStockInfo?.stockQuantity <= (dispenseStockInfo?.reorderLevel || 10) && (
                      <span style={{ fontSize: '11px', color: '#d97706', display: 'block' }}>
                        ⚠️ Low stock - Please reorder soon
                      </span>
                    )}
                    {dispenseStockInfo?.stockQuantity <= 0 && (
                      <span style={{ fontSize: '11px', color: '#dc2626', display: 'block' }}>
                        ❌ Out of stock - Cannot dispense
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Dispense Quantity Input */}
              {!showDispenseSuccess ? (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>
                      Quantity to Dispense *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setDispenseQuantity(Math.max(1, dispenseQuantity - 1))}
                        disabled={dispenseQuantity <= 1}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          background: 'white',
                          fontSize: '18px',
                          cursor: dispenseQuantity <= 1 ? 'not-allowed' : 'pointer',
                          opacity: dispenseQuantity <= 1 ? 0.5 : 1
                        }}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={dispenseQuantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setDispenseQuantity(Math.max(0, val));
                        }}
                        min="1"
                        max={dispenseStockInfo?.stockQuantity || 999}
                        style={{
                          width: '80px',
                          height: '40px',
                          textAlign: 'center',
                          fontSize: '18px',
                          fontWeight: 'bold',
                          borderRadius: '8px',
                          border: '2px solid #d1d5db',
                          padding: '0 8px'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setDispenseQuantity(Math.min(dispenseStockInfo?.stockQuantity || 999, dispenseQuantity + 1))}
                        disabled={dispenseQuantity >= (dispenseStockInfo?.stockQuantity || 0)}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          background: 'white',
                          fontSize: '18px',
                          cursor: dispenseQuantity >= (dispenseStockInfo?.stockQuantity || 0) ? 'not-allowed' : 'pointer',
                          opacity: dispenseQuantity >= (dispenseStockInfo?.stockQuantity || 0) ? 0.5 : 1
                        }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => setDispenseQuantity(dispenseStockInfo?.stockQuantity || 1)}
                        disabled={!dispenseStockInfo?.stockQuantity || dispenseStockInfo?.stockQuantity <= 0}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          background: '#f3f4f6',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Max
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        Available: {dispenseStockInfo?.stockQuantity || 0} units
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        After dispense: {(dispenseStockInfo?.stockQuantity || 0) - dispenseQuantity} units
                      </span>
                    </div>
                  </div>

                  <div style={{
                    background: '#fef3c7',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    border: '1px solid #f59e0b'
                  }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
                      ⚠️ This action will:
                      <br />
                      • Reduce stock by <strong>{dispenseQuantity || 0}</strong> unit(s)
                      <br />
                      • Mark prescription as <strong>Dispensed</strong>
                      <br />
                      • Log transaction in pharmacy records
                    </p>
                  </div>
                </div>
              ) : (
                // Success State
                <div style={{
                  textAlign: 'center',
                  padding: '20px 0'
                }}>
                  <span style={{ fontSize: '64px' }}>✅</span>
                  <h3 style={{ margin: '12px 0 4px 0', color: '#065f46' }}>Dispense Successful!</h3>
                  <p style={{ color: '#6b7280' }}>
                    {dispenseResult?.quantity} unit(s) of {dispenseResult?.medication} dispensed
                  </p>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    marginTop: '12px',
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '8px'
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>Before Stock</span>
                      <div style={{ fontWeight: '600' }}>{dispenseResult?.beforeStock} units</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>After Stock</span>
                      <div style={{ fontWeight: '600', color: '#10b981' }}>{dispenseResult?.afterStock} units</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: '#fafafa'
            }}>
              {!showDispenseSuccess ? (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowDispenseModal(false)}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      background: 'white',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleProcessDispense}
                    disabled={dispensing || !dispenseStockInfo || dispenseStockInfo?.stockQuantity <= 0 || dispenseQuantity <= 0 || dispenseQuantity > (dispenseStockInfo?.stockQuantity || 0)}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '8px',
                      border: 'none',
                      background: (!dispenseStockInfo || dispenseStockInfo?.stockQuantity <= 0 || dispenseQuantity <= 0 || dispenseQuantity > (dispenseStockInfo?.stockQuantity || 0)) 
                        ? '#9ca3af' 
                        : '#0f3460',
                      color: 'white',
                      cursor: (!dispenseStockInfo || dispenseStockInfo?.stockQuantity <= 0 || dispenseQuantity <= 0 || dispenseQuantity > (dispenseStockInfo?.stockQuantity || 0)) 
                        ? 'not-allowed' 
                        : 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {dispensing ? '⏳ Processing...' : '💊 Dispense'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setShowDispenseModal(false);
                    setShowDispenseSuccess(false);
                    setDispenseResult(null);
                  }}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0f3460',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientProfile;