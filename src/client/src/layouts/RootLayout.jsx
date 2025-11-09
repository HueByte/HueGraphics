import React, { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MenuToggle from '../components/MenuToggle';
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
      <MenuToggle onClick={toggleSidebar} />

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
