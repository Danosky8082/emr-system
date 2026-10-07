// src/components/OrbitLoader.jsx
import React from 'react';

const OrbitLoader = ({ size = 120, label = 'Loading…' }) => (
  <div className="orbit-loader" style={{ width: size, height: size }}>
    <div className="orbit-ring">
      <span className="orbit-dot dot-1" />
      <span className="orbit-dot dot-2" />
      <span className="orbit-dot dot-3" />
    </div>
    <img src="/logo.png" alt="" className="orbit-logo" />
    {label && <div className="orbit-label">{label}</div>}
  </div>
);

export default OrbitLoader;