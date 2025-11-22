import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import Home from './pages/Home';
import CloudPointsVisualizer from './pages/CloudPointsVisualizer';
import ModelsGallery from './pages/ModelsGallery';
import KinectLiveCapture from './pages/KinectLiveCapture';
import FractalViewer from './pages/FractalViewer';
import AudioVisualizer from './pages/AudioVisualizer';

function App() {
  const isKinectEnabled = import.meta.env.VITE_KINECT_ENABLED === 'true';

  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<Home />} />
        <Route path="cloud-points" element={<CloudPointsVisualizer />} />
        <Route path="models-gallery" element={<ModelsGallery />} />
        <Route path="fractal-viewer" element={<FractalViewer />} />
        <Route path="audio-visualizer" element={<AudioVisualizer />} />
        <Route
          path="kinect-live"
          element={isKinectEnabled ? <KinectLiveCapture /> : <Navigate to="/" replace />}
        />
      </Route>
    </Routes>
  );
}

export default App;
