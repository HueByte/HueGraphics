import React from 'react';
import { HiMenu } from 'react-icons/hi';
import './MenuToggle.css';

function MenuToggle({ onClick }) {
  return (
    <button
      className="menu-toggle-btn"
      onClick={onClick}
      aria-label="Toggle menu"
    >
      <HiMenu size={24} />
    </button>
  );
}

export default MenuToggle;
