// src/components/MobileMenu.jsx
import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import './MobileMenu.css';

const MobileMenu = ({ isOpen, onClose, menuGroups }) => {
  const { user } = useAuth();
  const { hospitalName } = useTenant();
  const navigate = useNavigate();

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`mobile-menu-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`mobile-menu ${isOpen ? 'open' : ''}`}
        aria-label="Main navigation"
      >
        {/* Header */}
        <div className="mobile-menu-header">
          <div className="mobile-menu-brand">
            <span className="mobile-menu-brand-name">{hospitalName || 'NexGen EMR'}</span>
          </div>
          <button
            className="mobile-menu-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        {/* User info */}
        {user && (
          <div className="mobile-menu-user">
            <div className="mobile-menu-user-name">
              {user.firstName} {user.lastName}
            </div>
            <div className="mobile-menu-user-role">{user.role}</div>
          </div>
        )}

        {/* Menu items */}
        <nav className="mobile-menu-nav">
          {menuGroups.map((group) => (
            <div key={group.title} className="mobile-menu-group">
              <div className="mobile-menu-group-title">{group.title}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleLinkClick}
                  className={({ isActive }) =>
                    `mobile-menu-link ${isActive ? 'active' : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="mobile-menu-footer">
  <button
    className="mobile-menu-switch"
    onClick={() => {
      onClose();
      if (window.confirm('Switch to another hospital? You will be logged out.')) {
        window.dispatchEvent(new CustomEvent('app:logout'));
      }
    }}
  >
    🏥 Switch Hospital
  </button>
  <button
    className="mobile-menu-logout"
    onClick={() => {
      onClose();
      window.dispatchEvent(new CustomEvent('app:logout'));
    }}
  >
    🚪 Logout
  </button>
</div>
      </aside>
    </>
  );
};

export default MobileMenu;