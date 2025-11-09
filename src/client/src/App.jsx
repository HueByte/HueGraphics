import React from 'react';
import { Routes, Route } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import Home from './pages/Home';
import CloudPointsVisualizer from './pages/CloudPointsVisualizer';
import ModelsGallery from './pages/ModelsGallery';

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<Home />} />
        <Route path="cloud-points" element={<CloudPointsVisualizer />} />
        <Route path="models-gallery" element={<ModelsGallery />} />
      </Route>
    </Routes>
  );
}

export default App;
