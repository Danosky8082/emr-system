// src/pages/Patients.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const Patients = () => {
  const { token, user } = useAuth();
  const { searchTerm } = useSearch();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', gender: 'Male', dateOfBirth: '', phone: '', email: '', address: '',
    emergencyContact: '', allergies: '', nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: '',
    patientCategory: 'FPP',
    insuranceProvider: '',
    insuranceId: '',
    corporateCompany: '',
  });

  // ✅ Use useCallback to memoize fetchPatients
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      let url = 'http://localhost:3000/api/patients';
      if (['Nurse', 'Midwife'].includes(user?.role)) {
        url = 'http://localhost:3000/api/nurse/patients';
      } else if (['Doctor', 'Obstetrician'].includes(user?.role)) {
        url = 'http://localhost:3000/api/doctor/patients';
      }

      const res = await axios.get(url, { 
        headers: { Authorization: `Bearer ${token}` },
        // ✅ Prevent caching
        params: { _t: Date.now() }
      });

      let patientsList = res.data;
      if (['Nurse', 'Midwife', 'Doctor', 'Obstetrician'].includes(user?.role)) {
        patientsList = res.data.map(j => j.patient);
      }
      
      console.log('✅ Patients fetched:', patientsList);
      setPatients(patientsList);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    if (user && token) {
      fetchPatients();
    }
  }, [user, token, fetchPatients, refreshKey]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // ✅ If category changes, show a helpful message
    if (name === 'patientCategory') {
      const categoryMessages = {
        'FPP': '💰 Patient will pay full amount for all services.',
        'NHIS': '🏥 Patient will pay only 10% of service costs.',
        'CORPORATE': '🏢 Patient\'s company will pay double the standard rate.'
      };
      toast.success(categoryMessages[value] || 'Category updated');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      let response;
      
      if (editingPatient) {
        // ✅ Log what we're sending
        console.log('📤 Updating patient:', formData);
        
        response = await axios.put(
          `http://localhost:3000/api/patients/${editingPatient.id}`, 
          formData, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Patient updated successfully!');
      } else {
        response = await axios.post(
          'http://localhost:3000/api/patients', 
          formData, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Patient registered successfully!');
      }
      
      // ✅ Log the response
      console.log('📥 Server response:', response.data);
      
      setShowModal(false);
      setEditingPatient(null);
      setFormData({ 
        firstName: '', lastName: '', gender: 'Male', dateOfBirth: '', phone: '', email: '', address: '', 
        emergencyContact: '', allergies: '', nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: '',
        patientCategory: 'FPP',
        insuranceProvider: '',
        insuranceId: '',
        corporateCompany: '',
      });
      
      // ✅ Force refresh by incrementing refreshKey
      setRefreshKey(prev => prev + 1);
      
    } catch (error) { 
      console.error('Submit error:', error);
      toast.error(error.response?.data?.error || 'Operation failed'); 
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (patient) => {
    console.log('📝 Editing patient:', patient);
    setEditingPatient(patient);
    setFormData({
      firstName: patient.firstName || '', 
      lastName: patient.lastName || '', 
      gender: patient.gender || 'Male', 
      dateOfBirth: patient.dateOfBirth?.split('T')[0] || '',
      phone: patient.phone || '', 
      email: patient.email || '', 
      address: patient.address || '', 
      emergencyContact: patient.emergencyContact || '',
      allergies: patient.allergies || '', 
      nextOfKinName: patient.nextOfKinName || '', 
      nextOfKinPhone: patient.nextOfKinPhone || '',
      nextOfKinRelationship: patient.nextOfKinRelationship || '',
      patientCategory: patient.patientCategory || 'FPP',
      insuranceProvider: patient.insuranceProvider || '',
      insuranceId: patient.insuranceId || '',
      corporateCompany: patient.corporateCompany || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this patient?')) return;
    try {
      await axios.delete(`http://localhost:3000/api/patients/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Patient deleted successfully');
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to delete patient.';
      toast.error(message);
    }
  };

  const getCategoryInfo = (category) => {
    const map = {
      'FPP': { label: '💰 FPP', className: 'category-fpp', tooltip: 'Free Paying Patient - Full Payment' },
      'NHIS': { label: '🏥 NHIS', className: 'category-nhis', tooltip: 'National Health Insurance - 10% Payment' },
      'CORPORATE': { label: '🏢 Corporate', className: 'category-corporate', tooltip: 'Corporate/Company - Double Rate' },
    };
    return map[category] || map['FPP'];
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = `${p.firstName} ${p.lastName} ${p.hospitalId || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'ALL' || p.patientCategory === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  if (loading && patients.length === 0) return <div className="spinner" />;
  
  const canManage = ['Admin', 'Records', 'ITAdmin'].includes(user?.role);
  const canViewProfile = ['Admin', 'Records', 'ITAdmin', 'Nurse', 'Doctor', 'Obstetrician', 'Midwife'].includes(user?.role);

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Patient Management</h2>
        {canManage && (
          <button 
            className="btn btn-primary" 
            onClick={() => { 
              setEditingPatient(null); 
              setFormData({ 
                firstName: '', lastName: '', gender: 'Male', dateOfBirth: '', phone: '', email: '', address: '', 
                emergencyContact: '', allergies: '', nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: '',
                patientCategory: 'FPP',
                insuranceProvider: '',
                insuranceId: '',
                corporateCompany: '',
              }); 
              setShowModal(true); 
            }}
          >
            + Register New Patient
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div style={{ 
        marginBottom: '16px', 
        display: 'flex', 
        gap: '12px', 
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <label style={{ fontWeight: '600', fontSize: '14px', color: '#374151' }}>Filter by Category:</label>
        <select 
          value={categoryFilter} 
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          <option value="ALL">All Categories</option>
          <option value="FPP">💰 FPP</option>
          <option value="NHIS">🏥 NHIS</option>
          <option value="CORPORATE">🏢 Corporate</option>
        </select>
        {categoryFilter !== 'ALL' && (
          <button 
            className="btn btn-sm btn-secondary"
            onClick={() => setCategoryFilter('ALL')}
            style={{ 
              background: '#e5e7eb', 
              color: '#1f2937',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ✕ Clear Filter
          </button>
        )}
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          Showing {filteredPatients.length} of {patients.length} patients
        </span>
        <button 
          className="btn btn-sm btn-secondary"
          onClick={() => setRefreshKey(prev => prev + 1)}
          style={{ 
            background: '#0f3460', 
            color: 'white',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Hospital ID</th>
              <th>Name</th>
              <th>Gender</th>
              <th>Category</th>
              <th>Phone</th>
              <th>Next of Kin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.length > 0 ? (
              filteredPatients.map((p) => {
                const categoryInfo = getCategoryInfo(p.patientCategory);
                return (
                  <tr key={p.id}>
                    <td><strong>{p.hospitalId}</strong></td>
                    <td>{p.firstName} {p.lastName}</td>
                    <td>{p.gender}</td>
                    <td>
                      <span 
                        className={`category-badge ${categoryInfo.className}`}
                        title={categoryInfo.tooltip}
                        style={{
                          display: 'inline-block',
                          padding: '3px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {categoryInfo.label}
                      </span>
                      {p.patientCategory === 'NHIS' && p.insuranceProvider && (
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                          {p.insuranceProvider}
                        </div>
                      )}
                      {p.patientCategory === 'CORPORATE' && p.corporateCompany && (
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                          {p.corporateCompany}
                        </div>
                      )}
                    </td>
                    <td>{p.phone || '-'}</td>
                    <td>{p.nextOfKinName || '-'}</td>
                    <td style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                      {canViewProfile && (
                        <Link 
                          to={`/patient-profile/${p.id}`} 
                          className="btn btn-sm btn-open-file"
                          style={{ 
                            background: '#0f3460', 
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          📂 Open File
                        </Link>
                      )}
                      {canManage && (
                        <>
                          <button 
                            className="btn btn-sm btn-edit"
                            style={{ 
                              background: '#0f3460', 
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 10px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onClick={() => handleEdit(p)}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            className="btn btn-sm btn-delete"
                            style={{ 
                              background: '#ef4444', 
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 10px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onClick={() => handleDelete(p.id)}
                          >
                            🗑️ Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="text-center">
                  {searchTerm || categoryFilter !== 'ALL' 
                    ? 'No patients found matching your filters.' 
                    : 'No patients found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Registration/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingPatient ? 'Edit Patient' : 'Register New Patient'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Basic Information */}
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Gender *</label>
                    <select name="gender" value={formData.gender} onChange={handleInputChange}>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date of Birth *</label>
                    <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone</label>
                    <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input type="text" name="address" value={formData.address} onChange={handleInputChange} />
                </div>
                
                {/* Patient Category Section */}
                <div style={{ 
                  marginTop: '16px', 
                  padding: '16px', 
                  background: '#f8fafc', 
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: '#1a1a2e' }}>
                    💳 Patient Category & Billing Information
                  </h4>
                  <div className="form-group">
                    <label>Patient Category *</label>
                    <select 
                      name="patientCategory" 
                      value={formData.patientCategory} 
                      onChange={handleInputChange}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: 'white'
                      }}
                    >
                      <option value="FPP">💰 FPP - Free Paying Patient (Full Payment)</option>
                      <option value="NHIS">🏥 NHIS - National Health Insurance (10% Payment)</option>
                      <option value="CORPORATE">🏢 Corporate/Company (Double Rate)</option>
                    </select>
                    <small style={{ display: 'block', color: '#6b7280', marginTop: '4px' }}>
                      {formData.patientCategory === 'FPP' && 'Patient pays the full amount for all services.'}
                      {formData.patientCategory === 'NHIS' && 'Patient pays only 10% of the service cost (NHIS covers the rest).'}
                      {formData.patientCategory === 'CORPORATE' && 'Patient\'s company pays double the standard rate.'}
                    </small>
                  </div>

                  {/* Conditional fields for NHIS */}
                  {formData.patientCategory === 'NHIS' && (
                    <div className="form-row" style={{ marginTop: '12px' }}>
                      <div className="form-group">
                        <label>NHIS Provider</label>
                        <input type="text" name="insuranceProvider" value={formData.insuranceProvider} onChange={handleInputChange} placeholder="e.g., NHIS - Lagos State" />
                      </div>
                      <div className="form-group">
                        <label>NHIS Number</label>
                        <input type="text" name="insuranceId" value={formData.insuranceId} onChange={handleInputChange} placeholder="e.g., NHIS-123456" />
                      </div>
                    </div>
                  )}

                  {/* Conditional fields for Corporate */}
                  {formData.patientCategory === 'CORPORATE' && (
                    <div className="form-row" style={{ marginTop: '12px' }}>
                      <div className="form-group">
                        <label>Company Name *</label>
                        <input type="text" name="corporateCompany" value={formData.corporateCompany} onChange={handleInputChange} placeholder="e.g., MTN Nigeria" required />
                      </div>
                      <div className="form-group">
                        <label>Employee ID / Policy Number</label>
                        <input type="text" name="insuranceId" value={formData.insuranceId} onChange={handleInputChange} placeholder="e.g., EMP-001234" />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Next of Kin Section */}
                <h4 style={{marginTop:'16px', borderTop:'1px solid #eee', paddingTop:'10px'}}>Next of Kin Details <span style={{color:'red'}}>*</span></h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" name="nextOfKinName" value={formData.nextOfKinName} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Phone <span style={{color:'red'}}>*</span></label>
                    <input type="text" name="nextOfKinPhone" value={formData.nextOfKinPhone} onChange={handleInputChange} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Relationship</label>
                  <input type="text" name="nextOfKinRelationship" value={formData.nextOfKinRelationship} onChange={handleInputChange} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingPatient ? 'Update Patient' : 'Register Patient'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patients;