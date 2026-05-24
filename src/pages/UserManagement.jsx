import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- 1. DEFINE YOUR SUPER ADMIN ---
  const SUPER_ADMIN = 'iambibin.cv@gmail.com';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const userList = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        email: doc.data().email || 'No Email', 
        role: doc.data().role || 'rater',
        status: doc.data().status || 'active' // Add status tracking
      }));
      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId, email, newRole) => {
    if (email === SUPER_ADMIN) {
      alert("Action denied: Super Admin role cannot be changed.");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const toggleUserStatus = async (userId, email, currentStatus) => {
    if (email === SUPER_ADMIN) {
      alert("Action denied: Super Admin cannot be suspended.");
      return;
    }
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const deleteUser = async (userId, email) => {
    if (email === SUPER_ADMIN) {
      alert("Action denied: Super Admin cannot be deleted.");
      return;
    }
    
    // Add a confirmation prompt before deleting
    if (window.confirm(`Are you sure you want to completely delete ${email}? They will lose all access to the platform.`)) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        setUsers(prev => prev.filter(u => u.id !== userId)); // Remove from UI
      } catch (error) {
        console.error("Error deleting user:", error);
      }
    }
  };

  if (loading) return <div style={{ padding: '24px' }}>Loading User Database...</div>;

  return (
    <div style={{ padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>User Management</h2>
        <button onClick={fetchUsers} style={styles.refreshBtn}>Refresh List</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '16px' }}>User Email</th>
            <th style={{ padding: '16px' }}>Role</th>
            <th style={{ padding: '16px' }}>Status</th>
            <th style={{ padding: '16px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.length > 0 ? (
            users.map(user => {
              const isSuperAdmin = user.email === SUPER_ADMIN;
              
              return (
                <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: user.status === 'suspended' ? '#fef2f2' : 'white' }}>
                  <td style={{ padding: '16px', color: user.status === 'suspended' ? '#991b1b' : 'inherit' }}>
                    {user.email}
                    {isSuperAdmin && <span style={styles.superAdminBadge}>Super Admin</span>}
                  </td>
                  
                  {/* Role Dropdown */}
                  <td style={{ padding: '16px' }}>
                    <select 
                      value={user.role} 
                      onChange={(e) => updateUserRole(user.id, user.email, e.target.value)}
                      style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', cursor: isSuperAdmin ? 'not-allowed' : 'pointer', fontWeight: 'bold', color: user.role === 'admin' ? '#ef4444' : '#10b981' }}
                      disabled={isSuperAdmin} // Physically locks the dropdown for bibin
                    >
                      <option value="rater">rater</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>

                  {/* Status Indicator */}
                  <td style={{ padding: '16px', fontWeight: 'bold', color: user.status === 'active' ? '#16a34a' : '#dc2626' }}>
                    {user.status === 'active' ? 'Active' : 'Suspended'}
                  </td>

                  {/* Action Buttons */}
                  <td style={{ padding: '16px', display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => toggleUserStatus(user.id, user.email, user.status)}
                      style={{ ...styles.actionBtn, backgroundColor: isSuperAdmin ? '#d1d5db' : (user.status === 'active' ? '#f59e0b' : '#10b981'), cursor: isSuperAdmin ? 'not-allowed' : 'pointer' }}
                      disabled={isSuperAdmin}
                    >
                      {user.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>

                    <button 
                      onClick={() => deleteUser(user.id, user.email)}
                      style={{ ...styles.actionBtn, backgroundColor: isSuperAdmin ? '#d1d5db' : '#ef4444', cursor: isSuperAdmin ? 'not-allowed' : 'pointer' }}
                      disabled={isSuperAdmin}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center' }}>No users found in database.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  refreshBtn: { padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  actionBtn: { padding: '6px 12px', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' },
  superAdminBadge: { marginLeft: '8px', backgroundColor: '#1e293b', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '12px', textTransform: 'uppercase' }
};