import React, { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './RootLayout.css';

function RootLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState(null);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const updateSidebarContent = useCallback((content) => {
    setSidebarContent(content);
  }, []);

  return (
    <div className="root-layout">
      <button
        className="menu-toggle-btn"
        onClick={toggleSidebar}
        aria-label="Toggle menu"
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
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        customContent={sidebarContent}
      />

      <main className="main-content">
        <Outlet context={{ updateSidebarContent }} />
      </main>
    </div>
  );
}

export default RootLayout;
