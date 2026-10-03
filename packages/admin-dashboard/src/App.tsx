import { BrowserRouter, Routes, Route } from 'react-router-dom';

function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Milestones Admin</h1>
        <p className="text-gray-500 text-center">Dashboard — Coming Soon</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}
