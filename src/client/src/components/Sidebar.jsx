import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

function Sidebar({ isOpen, onClose, customContent }) {
  const location = useLocation();

  const defaultMenuItems = [
    { path: '/', label: 'Home' },
    { path: '/cloud-points', label: 'Cloud Points Visualizer' },
  ];

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar glass ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>{customContent?.title || 'Menu'}</h3>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <nav className="sidebar-nav">
          {customContent ? (
            customContent.content
          ) : (
            defaultMenuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={onClose}
              >
                {item.label}
              </Link>
            ))
          )}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
