import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const userRole = localStorage.getItem('userRole'); // Or pull from Context/Firebase

  if (!userRole || !allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" />;
  }
  return children;
}