import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import RaterDashboard from './pages/RaterDashboard';
import Simulator from './pages/Simulator';
import AdminDashboard from './pages/AdminDashboard'; // <-- 1. Import the Admin component
import SimulatorSearch20 from './pages/SimulatorSearch20';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<RaterDashboard />} />
        
        {/* 2. Swap out the <div> placeholder with the real component */}
        <Route path="/admin" element={<AdminDashboard />} /> 
        
        <Route path="/simulate/:taskType" element={<Simulator />} />
        <Route path="/simulate/search20" element={<SimulatorSearch20 />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;