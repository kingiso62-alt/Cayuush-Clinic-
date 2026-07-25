import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Appointments from './pages/Appointments';
import Pharmacy from './pages/Pharmacy';
import Laboratory from './pages/Laboratory';
import Radiology from './pages/Radiology';
import Billing from './pages/Billing';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import PatientRecord from './pages/PatientRecord';
import Staff from './pages/Staff';
import Queue from './pages/Queue';
import Inpatients from './pages/Inpatients';
import NotFound from './pages/NotFound';
import Layout from './components/Layout';
import Doctors from './pages/Doctors';
import Departments from './pages/Departments';
import Debts from './pages/Debts';
import PortalLogin from './pages/PortalLogin';
import PortalDashboard from './pages/PortalDashboard';
import PrescriptionWriter from './pages/PrescriptionWriter';
import Vaccinations from './pages/Vaccinations';
import Expenses from './pages/Expenses';
import Certificates from './pages/Certificates';
import Encounters from './pages/Encounters';
import Triage from './pages/Triage';
import Referrals from './pages/Referrals';
import Procedures from './pages/Procedures';
import Maternity from './pages/Maternity';
import Emergency from './pages/Emergency';
import Procurement from './pages/Procurement';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes wrapped in Layout (Sidebar + Main Content) */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="patients" element={<Patients />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="pharmacy" element={<Pharmacy />} />
        <Route path="laboratory" element={<Laboratory />} />
        <Route path="radiology" element={<Radiology />} />
        <Route path="billing" element={<Billing />} />
        <Route path="debts" element={<Debts />} />
        <Route path="settings" element={<Settings />} />
        <Route path="reports" element={<Reports />} />
        <Route path="patients/:id/records" element={<PatientRecord />} />
        <Route path="staff" element={<Staff />} />
        <Route path="queue" element={<Queue />} />
        <Route path="inpatients" element={<Inpatients />} />
        <Route path="doctors" element={<Doctors />} />
        <Route path="departments" element={<Departments />} />
        <Route path="prescription-writer" element={<PrescriptionWriter />} />
        <Route path="vaccinations" element={<Vaccinations />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="certificates" element={<Certificates />} />
        <Route path="encounters" element={<Encounters />} />
        <Route path="triage" element={<Triage />} />
        <Route path="referrals" element={<Referrals />} />
        <Route path="procedures" element={<Procedures />} />
        <Route path="maternity" element={<Maternity />} />
        <Route path="emergency" element={<Emergency />} />
        <Route path="procurement" element={<Procurement />} />
      </Route>

      {/* Patient Portal - No staff auth required */}
      <Route path="/portal" element={<PortalLogin />} />
      <Route path="/portal/dashboard" element={<PortalDashboard />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
