import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MdChevronRight } from 'react-icons/md';
import './Sidebar.css';

function Sidebar({ isOpen, onClose, customContent }) {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState(['cloud-points']); // Expanded by default

  const defaultMenuItems = [
    { path: '/', label: 'Home' },
    {
      id: 'cloud-points',
      path: '/cloud-points',
      label: 'Cloud Points Visualizer',
      children: [
        { path: '/models-gallery', label: 'Models Gallery' },
      ]
    },
    { path: '/kinect-live', label: 'Kinect Live Capture' },
  ];

  const toggleExpand = (itemId) => {
    setExpandedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isItemActive = (item) => {
    if (item.children) {
      return location.pathname === item.path || item.children.some(child => location.pathname === child.path);
    }
    return location.pathname === item.path;
  };

  const renderMenuItem = (item) => {
    if (item.children) {
      const isExpanded = expandedItems.includes(item.id);
      const isActive = isItemActive(item);

      return (
        <React.Fragment key={item.id}>
          <div
            className={`sidebar-link parent ${isExpanded ? 'expanded' : ''} ${isActive ? 'active' : ''}`}
            onClick={() => toggleExpand(item.id)}
          >
            <span>{item.label}</span>
            <MdChevronRight className="expand-icon" />
          </div>
          {isExpanded && item.children.map(child => (
            <Link
              key={child.path}
              to={child.path}
              className={`sidebar-link nested ${location.pathname === child.path ? 'active' : ''}`}
              onClick={onClose}
            >
              {child.label}
            </Link>
          ))}
        </React.Fragment>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
        onClick={onClose}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
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
            defaultMenuItems.map(renderMenuItem)
          )}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
