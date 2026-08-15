// src/components/PatientCard.jsx
import React from 'react';
import QRCode from 'react-qr-code'; // <--- Uses the stable, default-export library

const PatientCard = ({ patient, hospitalName = "NexGen EMR Clinic" }) => {
  if (!patient) return null;

  return (
    <div 
      id="patient-card-print-area"
      style={{
        width: '85.6mm',
        height: '54mm',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #d1d5db',
        padding: '15px',
        position: 'relative',
        fontFamily: 'Arial, sans-serif',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f3460' }}>
            {hospitalName}
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>Medical Centre, Lagos</div>
        </div>
        <div style={{ border: '1px solid #eee', borderRadius: '4px', padding: '4px' }}>
          {/* <--- The QR Code now renders safely ---> */}
          <QRCode value={patient.hospitalId} size={50} />
        </div>
      </div>

      <div style={{ marginTop: '5px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a2e' }}>
          {patient.firstName} {patient.lastName}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          {patient.gender} • {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : 'N/A'}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '5px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
        <div style={{ fontSize: '10px', color: '#999' }}>
          Valid for hospital services
        </div>
        <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f3460', letterSpacing: '1px' }}>
          {patient.hospitalId}
        </div>
      </div>
    </div>
  );
};

export default PatientCard;