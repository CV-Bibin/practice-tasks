// src/pages/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth'; 


// Import our modular admin components
import CreateSearch20Task from '../components/admin/CreateSearch20Task';
import UserManagement from './UserManagement'; 
import QuestionManagement from './QuestionManagement'; 
import SetManagement from './SetManagement';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // State to manage which view is active in the dashboard
  const [activeTab, setActiveTab] = useState('search20');

  // Strict Security Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return navigate('/');
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists() && userSnap.data().role === 'admin') {
          setIsAuthorized(true);
        } else {
          alert("Unauthorized access. Raters cannot view the admin panel.");
          navigate('/dashboard');
        }
      } catch (error) {
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Secure Logout Handler
  const handleLogout = async () => {
    try {
      await signOut(auth); // Tell Firebase to destroy the session
      localStorage.removeItem('userRole'); // Remove the Gatekeeper badge
      navigate('/'); // Send back to login screen
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (loading) return <div style={styles.loading}>Verifying Admin Credentials...</div>;
  if (!isAuthorized) return null;

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>Admin Command Center</h1>
        
        {/* Button Group for Header */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={styles.navBtn} onClick={() => navigate('/dashboard')}>Switch to Rater View</button>
          <button style={{ ...styles.navBtn, backgroundColor: '#ef4444', borderColor: '#ef4444' }} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div style={styles.layout}>
        {/* Sidebar Navigation */}
        <aside style={styles.sidebar}>
          <div style={styles.menuGroup}>
            <h4 style={styles.menuLabel}>Task Creation</h4>
            <button 
              style={activeTab === 'search20' ? styles.activeMenuBtn : styles.menuBtn} 
              onClick={() => setActiveTab('search20')}
            >
              + Search 2.0 Task
            </button>
            <button 
              style={activeTab === 'autocomplete' ? styles.activeMenuBtn : styles.menuBtn} 
              onClick={() => setActiveTab('autocomplete')}
            >
              + Auto Complete Task
            </button>
            <button 
              style={activeTab === 'poi' ? styles.activeMenuBtn : styles.menuBtn} 
              onClick={() => setActiveTab('poi')}
            >
              + POI Evaluation Task
            </button>
          </div>

          <div style={styles.menuGroup}>
            <h4 style={styles.menuLabel}>Management</h4>
            <button 
              style={activeTab === 'analytics' ? styles.activeMenuBtn : styles.menuBtn} 
              onClick={() => setActiveTab('analytics')}
            >
              Rater Analytics
            </button>
            
            <button 
              style={activeTab === 'questionmanagement' ? styles.activeMenuBtn : styles.menuBtn} 
              onClick={() => setActiveTab('questionmanagement')}
            >
              <span style={styles.menuIcon}>📝</span> Question Management
            </button>

            <button 
  style={activeTab === 'setmanagement' ? styles.activeMenuBtn : styles.menuBtn} 
  onClick={() => setActiveTab('setmanagement')}
>
  <span style={styles.menuIcon}>🗂️</span> Set Builder
</button>

            <button 
              style={activeTab === 'usermanagement' ? styles.activeMenuBtn : styles.menuBtn} 
              onClick={() => setActiveTab('usermanagement')}
            >
              <span style={styles.menuIcon}>👥</span> User Management
            </button>
          </div>
        </aside>

        {/* Main Content Area (Dynamic) */}
        <main style={styles.mainContent}>
          {activeTab === 'search20' && <CreateSearch20Task />}
          {activeTab === 'autocomplete' && <div><h2>Auto Complete Builder Coming Soon</h2></div>}
          {activeTab === 'poi' && <div><h2>POI Task Builder Coming Soon</h2></div>}
          {activeTab === 'analytics' && <div><h2>Rater Analytics Matrix Coming Soon</h2></div>}
          
          {/* NEW: Replaced placeholder with the actual component! */}
          {activeTab === 'questionmanagement' && <QuestionManagement />}
          {activeTab === 'setmanagement' && <SetManagement />}
          
          {activeTab === 'usermanagement' && <UserManagement />}
        </main>
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', fontFamily: 'system-ui, sans-serif' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '16px 32px', color: 'white', flexShrink: 0 },
  headerTitle: { margin: 0, fontSize: '20px' },
  navBtn: { backgroundColor: 'transparent', border: '1px solid #475569', color: 'white', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  
  layout: { display: 'flex', flex: 1, overflow: 'hidden' },
  
  sidebar: { width: '250px', backgroundColor: '#1e293b', color: 'white', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 },
  menuGroup: { marginBottom: '32px' },
  menuLabel: { fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 12px 24px', letterSpacing: '0.05em' },
  menuBtn: { width: '100%', textAlign: 'left', backgroundColor: 'transparent', border: 'none', color: '#cbd5e1', padding: '10px 24px', cursor: 'pointer', fontSize: '14px', transition: 'background 0.2s', display: 'flex', alignItems: 'center' },
  activeMenuBtn: { width: '100%', textAlign: 'left', backgroundColor: '#334155', border: 'none', color: 'white', padding: '10px 24px', cursor: 'pointer', fontSize: '14px', borderLeft: '4px solid #3b82f6', display: 'flex', alignItems: 'center' },
  
  menuIcon: { marginRight: '8px', fontSize: '16px' },
  
  mainContent: { flex: 1, padding: '32px', overflowY: 'auto' }
};