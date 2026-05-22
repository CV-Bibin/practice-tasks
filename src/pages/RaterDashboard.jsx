import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth'; // <-- Added onAuthStateChanged here
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export default function RaterDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Wrap the logic in the Firebase auth listener to keep you logged in on refresh
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/'); // Kick to login ONLY if truly logged out
        return;
      }

      try {
        // Now we use 'user.uid' directly from the listener
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setMetrics(userSnap.data().metrics);
        } else {
          // Fallback if the admin hasn't set up their metrics object yet
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

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const launchSimulator = (taskType) => {
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
            <button style={styles.simCard} onClick={() => launchSimulator('search20')}>
              <h3>Launch Search 2.0</h3>
              <p>Practice dual-pane map intent evaluation.</p>
            </button>
            <button style={styles.simCard} onClick={() => launchSimulator('autocomplete')}>
              <h3>Launch Auto Complete</h3>
              <p>Practice prediction scoring and routing.</p>
            </button>
            <button style={styles.simCard} onClick={() => launchSimulator('poi')}>
              <h3>Launch POI Evaluation</h3>
              <p>Practice external data verification.</p>
            </button>
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

// Clean, enterprise-style CSS-in-JS
const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '16px 32px', color: 'white' },
  headerTitle: { margin: 0, fontSize: '20px' },
  headerActions: { display: 'flex', gap: '16px', alignItems: 'center' },
  userEmail: { fontSize: '14px', color: '#cbd5e1' },
  logoutBtn: { backgroundColor: 'transparent', border: '1px solid #475569', color: 'white', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' },
  main: { padding: '32px', maxWidth: '1200px', margin: '0 auto' },
  section: { marginBottom: '40px' },
  sectionTitle: { fontSize: '18px', color: '#334155', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', marginBottom: '20px' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
  metricCard: { backgroundColor: 'white', padding: '20px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  metricTitle: { margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' },
  metricValue: { margin: 0, fontSize: '24px', fontWeight: 'bold' },
  simGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' },
  simCard: { backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '24px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', transition: 'box-shadow 0.2s', ':hover': { boxShadow: '0 4px 6px rgba(0,0,0,0.1)' } }
};