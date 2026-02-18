import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import BookReader from './components/BookReader';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/episode/1?lang=eng" replace />} />
        <Route path="/episode/:episodeNum" element={<BookReader />} />
        <Route path="*" element={<Navigate to="/episode/1?lang=eng" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
