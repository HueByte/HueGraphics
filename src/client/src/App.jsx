import React from 'react';
import { Routes, Route } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import CloudPointsVisualizer from './pages/CloudPointsVisualizer';

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<CloudPointsVisualizer />} />
        <Route path="cloud-points" element={<CloudPointsVisualizer />} />
      </Route>
    </Routes>
  );
}

export default App;
