import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import BookReader from './components/BookReader';

function App() {
  const [language, setLanguage] = useState('eng');

  return (
    <HashRouter>
      <Routes>
        <Route 
          path="/" 
          element={
            <BookReader 
              language={language} 
              setLanguage={setLanguage} 
            />
          } 
        />
        <Route 
          path="/episode/:episodeNum" 
          element={
            <BookReader 
              language={language} 
              setLanguage={setLanguage} 
            />
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
