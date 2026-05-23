import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth'; 
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export default function RaterDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/');
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.role === 'admin') {
            setIsAdmin(true);
          }
          setMetrics(userData.metrics);
        } else {
          setMetrics({
            totalTasksCompleted: 0,
            overallAccuracy: 0,
            search20Accuracy: 0,
            autoCompleteAccuracy: 0,
            poiAccuracy: 0
          });
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const launchSimulator = (taskType) => {
    // This perfectly triggers your App.jsx route: <Route path="/simulate/search20" />
    navigate(`/simulate/${taskType}`);
  };

  if (loading) {
    return <div style={styles.loading}>Loading Dashboard...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>Rater Dashboard</h1>
        <div style={styles.headerActions}>
          
          {isAdmin && (
            <button onClick={() => navigate('/admin')} style={styles.adminBtn}>
              ⚙️ Admin Command Center
            </button>
          )}

          <span style={styles.userEmail}>{auth.currentUser?.email}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Analytics Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Your Performance Metrics</h2>
          <div style={styles.metricsGrid}>
            <MetricCard title="Overall Accuracy" value={`${metrics?.overallAccuracy || 0}%`} highlight={metrics?.overallAccuracy < 85} />
            <MetricCard title="Search 2.0" value={`${metrics?.search20Accuracy || 0}%`} highlight={metrics?.search20Accuracy < 85} />
            <MetricCard title="Auto Complete" value={`${metrics?.autoCompleteAccuracy || 0}%`} highlight={metrics?.autoCompleteAccuracy < 85} />
            <MetricCard title="POI Evaluation" value={`${metrics?.poiAccuracy || 0}%`} highlight={metrics?.poiAccuracy < 85} />
            <MetricCard title="Tasks Completed" value={metrics?.totalTasksCompleted || 0} />
          </div>
        </section>

        {/* Simulator Hub */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Training Simulators</h2>
          <div style={styles.simGrid}>
            
            {/* Active Simulator */}
            <div style={styles.activeSimCard} onClick={() => launchSimulator('search20')}>
              <div style={styles.statusBadge}>Live</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Search 2.0 Simulator</h3>
              <p style={{ margin: 0, color: '#475569', fontSize: '14px' }}>Practice dual-pane map intent evaluation using live task data.</p>
              <button style={styles.launchBtn}>Launch Simulator →</button>
            </div>

            {/* Inactive/Upcoming Simulators */}
            <div style={styles.inactiveSimCard}>
              <div style={styles.inactiveBadge}>Coming Soon</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#64748b' }}>Auto Complete</h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Practice prediction scoring and routing.</p>
            </div>

            <div style={styles.inactiveSimCard}>
              <div style={styles.inactiveBadge}>Coming Soon</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#64748b' }}>POI Evaluation</h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Practice external data verification and closed/open status.</p>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}

// Reusable micro-component for the stats
function MetricCard({ title, value, highlight }) {
  return (
    <div style={{...styles.metricCard, borderTop: highlight ? '4px solid #ef4444' : '4px solid #10b981'}}>
      <p style={styles.metricTitle}>{title}</p>
      <p style={{...styles.metricValue, color: highlight ? '#ef4444' : '#111827'}}>{value}</p>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '16px 32px', color: 'white' },
  headerTitle: { margin: 0, fontSize: '20px' },
  headerActions: { display: 'flex', gap: '16px', alignItems: 'center' },
  userEmail: { fontSize: '14px', color: '#cbd5e1' },
  adminBtn: { backgroundColor: '#8b5cf6', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background-color 0.2s' },
  logoutBtn: { backgroundColor: 'transparent', border: '1px solid #475569', color: 'white', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' },
  main: { padding: '32px', maxWidth: '1200px', margin: '0 auto' },
  section: { marginBottom: '40px' },
  sectionTitle: { fontSize: '18px', color: '#334155', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', marginBottom: '20px' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
  metricCard: { backgroundColor: 'white', padding: '20px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  metricTitle: { margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' },
  metricValue: { margin: 0, fontSize: '24px', fontWeight: 'bold' },
  simGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' },
  activeSimCard: { backgroundColor: 'white', border: '2px solid #3b82f6', padding: '24px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', position: 'relative', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.1)' },
  inactiveSimCard: { backgroundColor: '#f1f5f9', border: '1px dashed #cbd5e1', padding: '24px', borderRadius: '8px', textAlign: 'left', position: 'relative', opacity: 0.8 },
  statusBadge: { position: 'absolute', top: '16px', right: '16px', backgroundColor: '#dbeafe', color: '#2563eb', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
  inactiveBadge: { position: 'absolute', top: '16px', right: '16px', backgroundColor: '#e2e8f0', color: '#64748b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
  launchBtn: { marginTop: '16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }
};