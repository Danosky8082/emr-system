// src/pages/LabOrders.jsx - COMPLETE WITH DYNAMIC PRICING, WALLET INTEGRATION & LAB SCIENTIST SUPPORT
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const LabOrders = () => {
  const { token, user } = useAuth();
  const [labOrders, setLabOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Dynamic pricing state
  const [servicePrices, setServicePrices] = useState({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  
  // Lab Technician & Scientist states
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedLabOrder, setSelectedLabOrder] = useState(null);
  const [resultForm, setResultForm] = useState({
    result: '',
    status: 'Completed'
  });
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [validating, setValidating] = useState(false);
  
  const [formData, setFormData] = useState({
    patientId: '',
    testName: '',
    testType: 'Haematology',
    priority: 'Routine',
    notes: ''
  });

  const testTypes = ['Haematology', 'Biochemistry', 'Microbiology', 'Immunology', 'Serology', 'Molecular', 'Toxicology', 'Histopathology'];
  const priorities = ['Routine', 'Urgent', 'Emergency'];
  const statusOptions = ['Ordered', 'In Progress', 'Completed', 'Cancelled'];

  // Role checks
  const isLabTechnician = user?.role === 'LabTechnician';
  const isLabScientist = user?.role === 'LabScientist';
  const isLabStaff = isLabTechnician || isLabScientist;
  const canCreateOrders = ['Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Admin'].includes(user?.role);
  const canAddResults = isLabStaff || ['Admin'].includes(user?.role);
  const canValidateResults = isLabScientist || ['Admin'].includes(user?.role);

  // Fetch lab orders
  const fetchLabOrders = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/lab-orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLabOrders(res.data);
    } catch (error) {
      console.error('Error fetching lab orders:', error);
      toast.error('Failed to load lab orders');
    }
  };

  // Fetch patients
  const fetchPatients = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/patients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPatients(res.data);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to load patients');
    }
  };

  // Fetch dynamic service prices
  const fetchServicePrices = async () => {
  setPriceLoading(true);
  try {
    // ✅ Use /api/services instead of /api/pricing
    // This endpoint is available to LabTechnician and LabScientist
    const res = await axios.get('http://localhost:3000/api/services?isActive=true', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const priceMap = {};
    const catSet = new Set();
    
    res.data.forEach(service => {
      priceMap[service.name.toLowerCase()] = {
        id: service.id,
        name: service.name,
        code: service.code,
        basePrice: service.basePrice,
        nhisPrice: service.nhisPrice,
        corporatePrice: service.corporatePrice,
        category: service.category,
        isActive: service.isActive,
        requiresApproval: service.requiresApproval
      };
      if (service.category) catSet.add(service.category);
    });
    
    setServicePrices(priceMap);
    setCategories(Array.from(catSet));
    
    console.log(`✅ Loaded ${Object.keys(priceMap).length} service prices`);
  } catch (error) {
    console.error('Error fetching service prices:', error);
    // Only show error toast if it's not a 403 (permission denied)
    if (error.response?.status !== 403) {
      toast.error('Failed to load service prices. Using defaults.');
    } else {
      console.log('ℹ️ Pricing endpoint not accessible - using default prices');
    }
    // ✅ Set fallback prices so the app still works
    setServicePrices({
      'blood test': { name: 'Blood Test', basePrice: 5000, nhisPrice: 500, corporatePrice: 10000 },
      'urine test': { name: 'Urine Test', basePrice: 3000, nhisPrice: 300, corporatePrice: 6000 },
      'malaria test': { name: 'Malaria Test', basePrice: 2000, nhisPrice: 200, corporatePrice: 4000 },
      'typhoid test': { name: 'Typhoid Test', basePrice: 4000, nhisPrice: 400, corporatePrice: 8000 },
    });
  } finally {
    setPriceLoading(false);
  }
};

  // Fetch wallet balance
  const fetchWalletBalance = async (patientId) => {
    try {
      const res = await axios.get(`http://localhost:3000/api/patients/${patientId}/wallet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWalletBalance(res.data.balance || 0);
      return res.data.balance;
    } catch (error) {
      console.error('Error fetching wallet:', error);
      return null;
    }
  };

  // Get patient category
  const getPatientCategory = (patientId) => {
    const patient = patients.find(p => p.id === patientId);
    return patient?.patientCategory || 'FPP';
  };

  // Get lab cost
  const getLabCost = (testName, patientCategory = 'FPP') => {
    if (!testName) return 0;
    
    const service = servicePrices[testName.toLowerCase()];
    if (!service) {
      for (const [key, value] of Object.entries(servicePrices)) {
        if (testName.toLowerCase().includes(key) || key.includes(testName.toLowerCase())) {
          if (patientCategory === 'NHIS') return value.nhisPrice || (value.basePrice * 0.1);
          if (patientCategory === 'CORPORATE') return value.corporatePrice || (value.basePrice * 2);
          return value.basePrice;
        }
      }
      return 5000;
    }
    
    if (patientCategory === 'NHIS') return service.nhisPrice || (service.basePrice * 0.1);
    if (patientCategory === 'CORPORATE') return service.corporatePrice || (service.basePrice * 2);
    return service.basePrice;
  };

  // Get test suggestions
  const getTestSuggestions = () => {
    return Object.keys(servicePrices).map(key => servicePrices[key].name);
  };

  // Handle form input
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle patient selection
  const handlePatientSelect = async (patientId) => {
    setFormData(prev => ({ ...prev, patientId }));
    const patient = patients.find(p => p.id === patientId);
    setSelectedPatient(patient);
    if (patientId) {
      await fetchWalletBalance(patientId);
    } else {
      setWalletBalance(null);
    }
  };

  // Handle Order Lab Test
  const handleOrderLabTest = async (e) => {
    e.preventDefault();
    
    if (!formData.patientId) {
      toast.error('Please select a patient');
      return;
    }

    if (!formData.testName) {
      toast.error('Please enter test name');
      return;
    }

    const patientCategory = getPatientCategory(formData.patientId);
    const labCost = getLabCost(formData.testName, patientCategory);
    
    if (labCost <= 0) {
      toast.error('Invalid test price. Please check the test name.');
      return;
    }

    setProcessingPayment(true);

    try {
      const checkRes = await axios.post('http://localhost:3000/api/wallet/check-service', {
        patientId: formData.patientId,
        amount: labCost,
        serviceName: formData.testName,
        serviceType: 'lab'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      let paymentMethod = 'wallet';

      if (!checkRes.data.canCover) {
        const option = window.confirm(
          `⚠️ Insufficient Wallet Balance\n\n` +
          `Service: ${formData.testName}\n` +
          `Cost: ₦${labCost.toLocaleString()}\n` +
          `Wallet Balance: ₦${checkRes.data.balance.toLocaleString()}\n` +
          `Shortfall: ₦${checkRes.data.shortfall.toLocaleString()}\n\n` +
          `Click OK to pay with Cash/Transfer\n` +
          `Click Cancel to cancel the order`
        );

        if (!option) {
          toast.warning('Order cancelled');
          setProcessingPayment(false);
          return;
        }

        paymentMethod = 'cash';
      }

      await axios.post('http://localhost:3000/api/wallet/process-service', {
        patientId: formData.patientId,
        amount: labCost,
        description: `Lab: ${formData.testName}`,
        category: 'Lab',
        serviceType: 'lab',
        paymentMethod: paymentMethod,
        serviceId: servicePrices[formData.testName.toLowerCase()]?.id || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await axios.post('http://localhost:3000/api/lab-orders', {
        patientId: formData.patientId,
        testName: formData.testName,
        testType: formData.testType,
        priority: formData.priority,
        notes: formData.notes || '',
        price: labCost,
        patientCategory: patientCategory
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('✅ Lab order created successfully!');
      
      setShowModal(false);
      setFormData({
        patientId: '',
        testName: '',
        testType: 'Haematology',
        priority: 'Routine',
        notes: ''
      });
      setWalletBalance(null);
      setSelectedPatient(null);
      
      fetchLabOrders();
      
    } catch (error) {
      console.error('Lab order error:', error);
      toast.error(error.response?.data?.error || 'Failed to create lab order');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Handle update lab order status
  const handleUpdateStatus = async (orderId, status) => {
    setUpdatingStatus(true);
    try {
      await axios.patch(`http://localhost:3000/api/lab-orders/${orderId}/status`, 
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Order status updated to ${status}`);
      fetchLabOrders();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle submit results
  const handleSubmitResults = async (e) => {
    e.preventDefault();
    if (!selectedLabOrder) return;
    
    try {
      await axios.patch(`http://localhost:3000/api/lab-orders/${selectedLabOrder.id}/results`,
        { 
          result: resultForm.result,
          status: resultForm.status || 'Completed'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Results submitted successfully!');
      setShowResultModal(false);
      setResultForm({ result: '', status: 'Completed' });
      setSelectedLabOrder(null);
      fetchLabOrders();
    } catch (error) {
      console.error('Error submitting results:', error);
      toast.error('Failed to submit results');
    }
  };

  // Handle validate result (Lab Scientist only)
  const handleValidateResult = async (orderId) => {
    setValidating(true);
    try {
      await axios.patch(`http://localhost:3000/api/lab-orders/${orderId}/validate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('✅ Lab result validated successfully!');
      fetchLabOrders();
    } catch (error) {
      console.error('Error validating result:', error);
      toast.error('Failed to validate result');
    } finally {
      setValidating(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        fetchLabOrders(),
        fetchPatients(),
        fetchServicePrices()
      ]);
      setLoading(false);
    };
    init();
  }, []);

  const getStatusColor = (status) => {
    const colors = {
      'Ordered': '#f59e0b',
      'In Progress': '#3b82f6',
      'Completed': '#10b981',
      'Cancelled': '#ef4444',
      'Validated': '#8b5cf6'
    };
    return colors[status] || '#6b7280';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Routine': '#3b82f6',
      'Urgent': '#f59e0b',
      'Emergency': '#ef4444'
    };
    return colors[priority] || '#3b82f6';
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>🔬 Lab Orders</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            📊 {Object.keys(servicePrices).length} services loaded
          </span>
          {user?.role && (
            <span style={{ 
              fontSize: '12px', 
              background: isLabScientist ? '#8b5cf6' : isLabTechnician ? '#3b82f6' : '#10b981',
              color: 'white',
              padding: '2px 12px',
              borderRadius: '12px'
            }}>
              {user.role}
            </span>
          )}
          {canCreateOrders && (
            <button 
              className="btn btn-primary" 
              onClick={() => setShowModal(true)}
              style={{
                background: '#0f3460',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              + New Lab Order
            </button>
          )}
        </div>
      </div>

      {/* Lab Orders Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Test Name</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Result</th>
              <th>Validated</th>
              <th>Date</th>
              {isLabStaff && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {labOrders.map((l) => (
              <tr key={l.id} style={{
                background: l.validated ? '#f5f3ff' : 'white'
              }}>
                <td><strong>{l.patient?.firstName} {l.patient?.lastName || 'N/A'}</strong></td>
                <td>{l.testName}</td>
                <td>{l.testType}</td>
                <td>
                  <span style={{
                    background: getPriorityColor(l.priority),
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {l.priority}
                  </span>
                </td>
                <td>
                  <span style={{
                    background: getStatusColor(l.status),
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {l.status}
                  </span>
                </td>
                <td>
                  {l.result ? (
                    <span style={{ color: '#10b981', fontWeight: '500' }}>✅ Done</span>
                  ) : (
                    <span style={{ color: '#6b7280' }}>—</span>
                  )}
                </td>
                <td>
                  {l.validated ? (
                    <span style={{ color: '#8b5cf6', fontWeight: '500' }}>
                      ✅ {l.validatedBy?.firstName || 'Validated'}
                    </span>
                  ) : l.result ? (
                    <span style={{ color: '#f59e0b', fontWeight: '500' }}>⏳ Pending</span>
                  ) : (
                    <span style={{ color: '#6b7280' }}>—</span>
                  )}
                </td>
                <td>{new Date(l.createdAt).toLocaleDateString()}</td>
                {isLabStaff && (
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {/* Status dropdown */}
                      <select
                        value={l.status}
                        onChange={(e) => handleUpdateStatus(l.id, e.target.value)}
                        disabled={updatingStatus}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #ddd',
                          fontSize: '12px',
                          background: 'white'
                        }}
                      >
                        {statusOptions.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      
                      {/* Add/Edit Results */}
                      {canAddResults && l.status !== 'Cancelled' && (
                        <button
                          onClick={() => {
                            setSelectedLabOrder(l);
                            setResultForm({ 
                              result: l.result || '', 
                              status: l.status || 'Completed' 
                            });
                            setShowResultModal(true);
                          }}
                          style={{
                            background: l.result ? '#f59e0b' : '#0f3460',
                            color: 'white',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          {l.result ? '✏️ Edit' : '📝 Add Results'}
                        </button>
                      )}
                      
                      {/* View Results - FIXED: toast.info replaced with toast.success */}
                      {l.result && (
                        <button
                          onClick={() => {
                            toast.success(
                              `📋 Result: ${l.result}\n` +
                              `👤 By: ${l.performedBy?.firstName || 'Unknown'}\n` +
                              `📅 ${new Date(l.resultDate).toLocaleString()}`
                            );
                          }}
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          👁️ View
                        </button>
                      )}
                      
                      {/* Validate - Only Lab Scientist */}
                      {canValidateResults && l.result && !l.validated && (
                        <button
                          onClick={() => handleValidateResult(l.id)}
                          disabled={validating}
                          style={{
                            background: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          {validating ? '⏳' : '✅ Validate'}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {labOrders.length === 0 && (
              <tr><td colSpan={isLabStaff ? 9 : 8} className="text-center">No lab orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Lab Order Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3>🧪 New Lab Order</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleOrderLabTest}>
              <div className="modal-body">
                {/* Patient Selection */}
                <div className="form-group">
                  <label>Select Patient *</label>
                  <select
                    value={formData.patientId}
                    onChange={(e) => handlePatientSelect(e.target.value)}
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
                    <option value="">Select a patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.hospitalId} - {p.firstName} {p.lastName} 
                        {p.patientCategory && ` (${p.patientCategory})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Patient Category Display */}
                {selectedPatient && (
                  <div style={{
                    background: '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    fontSize: '13px',
                    color: '#374151'
                  }}>
                    <strong>Patient Category:</strong> {selectedPatient.patientCategory || 'FPP'}
                    {selectedPatient.patientCategory === 'NHIS' && (
                      <span style={{ color: '#10b981', marginLeft: '8px' }}>🏥 10% of base price</span>
                    )}
                    {selectedPatient.patientCategory === 'CORPORATE' && (
                      <span style={{ color: '#8b5cf6', marginLeft: '8px' }}>🏢 200% of base price</span>
                    )}
                  </div>
                )}

                {/* Wallet Balance Display */}
                {selectedPatient && walletBalance !== null && formData.testName && (
                  <div style={{
                    background: walletBalance >= getLabCost(formData.testName, selectedPatient.patientCategory) ? '#f0fdf4' : '#fef3c7',
                    border: `1px solid ${walletBalance >= getLabCost(formData.testName, selectedPatient.patientCategory) ? '#10b981' : '#f59e0b'}`,
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                  }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>💳 Wallet Balance:</span>
                      <span style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold',
                        color: walletBalance >= getLabCost(formData.testName, selectedPatient.patientCategory) ? '#10b981' : '#f59e0b',
                        marginLeft: '8px'
                      }}>
                        ₦{walletBalance.toLocaleString()}
                      </span>
                    </div>
                    {formData.testName && (
                      <div>
                        <span style={{ fontSize: '13px', color: '#6b7280' }}>Test Cost: </span>
                        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                          ₦{getLabCost(formData.testName, selectedPatient.patientCategory).toLocaleString()}
                        </span>
                        <span style={{ 
                          marginLeft: '8px',
                          fontSize: '12px',
                          color: walletBalance >= getLabCost(formData.testName, selectedPatient.patientCategory) ? '#10b981' : '#ef4444'
                        }}>
                          {walletBalance >= getLabCost(formData.testName, selectedPatient.patientCategory) ? '✅ Sufficient' : '⚠️ Insufficient'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Test Name */}
                <div className="form-group">
                  <label>Test Name *</label>
                  <input
                    type="text"
                    name="testName"
                    value={formData.testName}
                    onChange={handleInputChange}
                    placeholder="Start typing test name..."
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    list="testSuggestions"
                  />
                  <datalist id="testSuggestions">
                    {getTestSuggestions().map(test => (
                      <option key={test} value={test} />
                    ))}
                  </datalist>
                  {formData.testName && (
                    <small style={{ display: 'block', color: '#6b7280', marginTop: '4px' }}>
                      💰 Cost: ₦{getLabCost(formData.testName, selectedPatient?.patientCategory || 'FPP').toLocaleString()}
                    </small>
                  )}
                </div>

                {/* Test Type */}
                <div className="form-group">
                  <label>Test Type *</label>
                  <select
                    name="testType"
                    value={formData.testType}
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
                    {testTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className="form-group">
                  <label>Priority *</label>
                  <select
                    name="priority"
                    value={formData.priority}
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
                    {priorities.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Any additional notes..."
                    rows="2"
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
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowModal(false);
                    setWalletBalance(null);
                    setSelectedPatient(null);
                  }}
                  style={{
                    background: '#e5e7eb',
                    color: '#1f2937',
                    border: '1px solid #d1d5db',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={processingPayment || priceLoading}
                  style={{
                    background: '#0f3460',
                    color: 'white',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    opacity: (processingPayment || priceLoading) ? 0.6 : 1
                  }}
                >
                  {processingPayment ? '⏳ Processing...' : priceLoading ? '⏳ Loading...' : '🧪 Order Lab Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResultModal && selectedLabOrder && (
        <div className="modal-overlay" onClick={() => setShowResultModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>📝 {selectedLabOrder.result ? 'Edit' : 'Enter'} Lab Results</h3>
              <button className="modal-close" onClick={() => setShowResultModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmitResults}>
              <div className="modal-body">
                <div style={{ 
                  background: '#f8fafc', 
                  padding: '12px 16px', 
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <p style={{ margin: 0 }}>
                    <strong>Patient:</strong> {selectedLabOrder.patient?.firstName} {selectedLabOrder.patient?.lastName}
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                    <strong>Test:</strong> {selectedLabOrder.testName} ({selectedLabOrder.testType})
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                    <strong>Status:</strong> <span style={{ color: getStatusColor(selectedLabOrder.status) }}>{selectedLabOrder.status}</span>
                  </p>
                  {selectedLabOrder.validated && (
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#8b5cf6' }}>
                      ✅ Validated by {selectedLabOrder.validatedBy?.firstName || 'Unknown'}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label>Result *</label>
                  <textarea
                    value={resultForm.result}
                    onChange={(e) => setResultForm({...resultForm, result: e.target.value})}
                    rows="5"
                    required
                    placeholder="Enter the test results in detail..."
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

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={resultForm.status}
                    onChange={(e) => setResultForm({...resultForm, status: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: 'white'
                    }}
                  >
                    <option value="Completed">✅ Completed</option>
                    <option value="In Progress">🔄 In Progress</option>
                    <option value="Cancelled">❌ Cancelled</option>
                  </select>
                </div>

                {isLabScientist && !selectedLabOrder.validated && selectedLabOrder.result && (
                  <div style={{
                    background: '#f5f3ff',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #8b5cf6',
                    marginTop: '8px'
                  }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#5b21b6' }}>
                      🔬 As a Lab Scientist, you can validate this result after confirming accuracy.
                    </p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowResultModal(false)}
                  style={{
                    background: '#e5e7eb',
                    color: '#1f2937',
                    border: '1px solid #d1d5db',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{
                    background: '#0f3460',
                    color: 'white',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {selectedLabOrder.result ? '🔄 Update Results' : '✅ Submit Results'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabOrders;