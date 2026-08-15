import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout'; // <--- IMPORT

const Pharmacy = () => {
  const { token } = useAuth();
  const { searchTerm } = useSearch(); // <--- GET SEARCH TERM
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMedications();
  }, []);

  const fetchMedications = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/medications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedications(res.data);
    } catch (error) {
      console.error('Error fetching medications:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- FILTER LOGIC APPLIED HERE ---
  const filteredMedications = medications.filter(m => {
    const searchString = `${m.name} ${m.genericName || ''} ${m.category || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Pharmacy Inventory</h2>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Generic</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Unit Price</th>
              <th>Expiry</th>
            </tr>
          </thead>
          <tbody>
            {filteredMedications.map((m) => (
              <tr key={m.id}>
                <td><strong>{m.name}</strong></td>
                <td>{m.genericName || '-'}</td>
                <td>{m.category}</td>
                <td style={{ color: m.stockQuantity <= m.reorderLevel ? '#ef4444' : '#000' }}>
                  {m.stockQuantity}
                  {m.stockQuantity <= m.reorderLevel && ' ⚠️'}
                </td>
                <td>₦{m.unitPrice.toLocaleString()}</td>
                <td>{new Date(m.expiryDate).toLocaleDateString()}</td>
              </tr>
            ))}
            {filteredMedications.length === 0 && (
              <tr><td colSpan="6" className="text-center">No medications found matching that search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Pharmacy;