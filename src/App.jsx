import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import RaterDashboard from './pages/RaterDashboard';
import Simulator from './pages/Simulator';
import AdminDashboard from './pages/AdminDashboard'; 
import SimulatorSearch20 from './pages/SimulatorSearch20';
import UserManagement from './pages/UserManagement'; 
import ProtectedRoute from './components/shared/ProtectedRoute'; // <-- 1. Import the wrapper

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<RaterDashboard />} />
        
        {/* 2. Wrap Admin Routes with the ProtectedRoute */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } /> 
        
        <Route path="/admin/users" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagement />
          </ProtectedRoute>
        } /> 
        
        <Route path="/simulate/:taskType" element={<Simulator />} />
        <Route path="/simulate/search20" element={<SimulatorSearch20 />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;