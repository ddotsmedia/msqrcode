import { BrowserRouter, Routes, Route } from 'react-router-dom';

function HomePage() {
  return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-3xl font-bold text-brand-800 mb-4">☕ Milestones Coffee</h1>
        <p className="text-brand-600">Digital Menu — Coming Soon</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
