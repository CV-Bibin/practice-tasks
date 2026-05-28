import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth'; 
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';


export default function RaterDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [liveSets, setLiveSets] = useState([]);
  const [userAttempts, setUserAttempts] = useState({});
  const [activeSessions, setActiveSessions] = useState({}); // NEW: Tracks mid-exam state
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Tab State for modern navigation
  const [activeTab, setActiveTab] = useState('search20');
  
  const navigate = useNavigate();




const calculateMetricsFromSubmissions = async (uid) => {
  const submissionsQuery = query(
    collection(db, "rater_submissions"),
    where("userId", "==", uid)
  );

  const submissionsSnap = await getDocs(submissionsQuery);

  let overallCorrect = 0;
  let overallTotal = 0;

  let searchCorrect = 0;
  let searchTotal = 0;

  let autoCorrect = 0;
  let autoTotal = 0;

  let poiCorrect = 0;
  let poiTotal = 0;

  submissionsSnap.forEach((d) => {
    const sub = d.data();

    const correct = sub.overall?.correct || 0;
    const total = sub.overall?.total || 0;

    overallCorrect += correct;
    overallTotal += total;

    if (sub.taskType === "search_2_0") {
      searchCorrect += correct;
      searchTotal += total;
    }

    if (sub.taskType === "auto_complete") {
      autoCorrect += correct;
      autoTotal += total;
    }

    if (sub.taskType === "poi") {
      poiCorrect += correct;
      poiTotal += total;
    }
  });

  const pct = (correct, total) =>
    total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    totalTasksCompleted: submissionsSnap.size,
    overallAccuracy: pct(overallCorrect, overallTotal),
    search20Accuracy: pct(searchCorrect, searchTotal),
    autoCompleteAccuracy: pct(autoCorrect, autoTotal),
    poiAccuracy: pct(poiCorrect, poiTotal),
  };
};





  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
  setLoading(false);
  navigate('/');
  return;
}

      try {
        // 1. Fetch User Profile
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

       if (userSnap.exists()) {
  const userData = userSnap.data();
  if (userData.role === "admin") setIsAdmin(true);
}

const calculatedMetrics = await calculateMetricsFromSubmissions(user.uid);
setMetrics(calculatedMetrics);

        // 2. Fetch LIVE Exam Sets
        const setsQuery = query(collection(db, 'exam_sets'), where('isDeployed', '==', true));
        const setsSnap = await getDocs(setsQuery);
        const availableSets = setsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setLiveSets(availableSets);

        // 3. Fetch This User's Attempt History
        const attemptsSnap = await getDocs(collection(db, 'users', user.uid, 'attempts'));
        const attemptsData = {};
        attemptsSnap.forEach(d => {
          attemptsData[d.id] = d.data().count || 0;
        });
        setUserAttempts(attemptsData);

        // 4. NEW: Fetch incomplete active sessions
        const activeSnap = await getDocs(collection(db, 'users', user.uid, 'active_sessions'));
        const sessionData = {};
        activeSnap.forEach(d => { 
          sessionData[d.id] = true; 
        });
        setActiveSessions(sessionData);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
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

  const launchExam = (setId) => {
    navigate(`/simulate/search20`, { state: { targetSet: setId } });
  };

  if (loading) return (
    <div className="flex-center" style={{ height: '100vh', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '1.2rem', fontWeight: '500' }}>
      <div className="spinner"></div> Loading Workspace...
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: '"Inter", system-ui, sans-serif' }}>
      {/* INJECTED CSS FOR PRO HOVER EFFECTS & ANIMATIONS */}
      <style>{`
        .header-glass {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #e2e8f0;
          position: sticky; top: 0; z-index: 50;
        }
        .metric-card {
          background: white; border-radius: 12px; padding: 24px;
          border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .metric-card:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.08); }
        .tab-btn {
          padding: 12px 24px; font-weight: 600; font-size: 15px; color: #64748b;
          border-bottom: 3px solid transparent; cursor: pointer; transition: all 0.2s;
        }
        .tab-btn:hover { color: #0f172a; }
        .tab-btn.active { color: #4f46e5; border-bottom: 3px solid #4f46e5; }
        .exam-card {
          background: white; border-radius: 16px; padding: 28px;
          border: 1px solid #e2e8f0; display: flex; flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative; overflow: hidden;
        }
        .exam-card.active:hover {
          border-color: #a5b4fc; box-shadow: 0 20px 25px -5px rgba(79, 70, 229, 0.1);
          transform: translateY(-4px);
        }
        .btn-primary {
          background: #4f46e5; color: white; padding: 12px 20px; border-radius: 8px;
          font-weight: 600; font-size: 15px; border: none; cursor: pointer;
          transition: background 0.2s, transform 0.1s;
        }
        .btn-primary:hover:not(:disabled) { background: #4338ca; }
        .btn-primary:active:not(:disabled) { transform: scale(0.98); }
        .btn-primary:disabled { background: #cbd5e1; color: #64748b; cursor: not-allowed; }
        .spinner {
          width: 24px; height: 24px; border: 3px solid #e2e8f0; border-top-color: #4f46e5;
          border-radius: 50%; animation: spin 1s linear infinite; margin-right: 12px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .flex-center { display: flex; align-items: center; justify-content: center; }
      `}</style>

      {/* Modern Glassmorphism Header */}
      <header className="header-glass" style={{ padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #4f46e5, #ec4899)', borderRadius: '8px' }}></div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>RaterSpace</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {isAdmin && (
            <button onClick={() => navigate('/admin')} style={{ background: '#f1f5f9', color: '#4f46e5', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
              ⚙️ Admin Panel
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid #e2e8f0', paddingLeft: '20px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                {auth.currentUser?.email?.split('@')[0] || "User"}
                </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Rater Account</div>
            </div>
            <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#475569', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px' }}>
        
        {/* Performance Overview */}
        <section style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '24px', letterSpacing: '-0.5px' }}>Performance Overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <MetricCard title="Overall Accuracy" value={`${metrics?.overallAccuracy || 0}%`} isWarning={metrics?.overallAccuracy < 85} />
            <MetricCard title="Search 2.0 Rating" value={`${metrics?.search20Accuracy || 0}%`} isWarning={metrics?.search20Accuracy < 85} />
            <MetricCard title="Auto Complete" value={`${metrics?.autoCompleteAccuracy || 0}%`} isWarning={metrics?.autoCompleteAccuracy < 85} />
            <MetricCard title="POI Evaluation" value={`${metrics?.poiAccuracy || 0}%`} isWarning={metrics?.poiAccuracy < 85} />
            <MetricCard title="Tasks Completed" value={metrics?.totalTasksCompleted || 0} isNeutral={true} />
          </div>
        </section>

        {/* Task Hub with Modern Tabs */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid #e2e8f0', marginBottom: '32px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className={`tab-btn ${activeTab === 'search20' ? 'active' : ''}`} onClick={() => setActiveTab('search20')}>
                Search 2.0 Tasks
              </div>
              <div className={`tab-btn ${activeTab === 'autocomplete' ? 'active' : ''}`} onClick={() => setActiveTab('autocomplete')}>
                Auto Complete
              </div>
              <div className={`tab-btn ${activeTab === 'poi' ? 'active' : ''}`} onClick={() => setActiveTab('poi')}>
                POI Evaluation
              </div>
            </div>
          </div>

          {/* TAB CONTENT: SEARCH 2.0 */}
          {activeTab === 'search20' && (
            liveSets.length === 0 ? (
              <EmptyState title="You're all caught up!" subtitle="There are no active Search 2.0 exams assigned to you right now." icon="🎉" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                {liveSets.map(set => {
                  const pastAttempts = userAttempts[set.id] || 0;
const isUnlimited = set.attemptLimit === 999;

const hasReachedLimit = !isUnlimited && pastAttempts >= set.attemptLimit;
const isResuming = !!activeSessions[set.id] && !hasReachedLimit;
const isLocked = hasReachedLimit;
const canReview = hasReachedLimit && set.answersRevealed;

                  return (
                    <div key={set.id} className={`exam-card ${isLocked && !canReview ? 'locked' : 'active'}`}>
                      {/* Status Badge */}
                      <div style={{ position: 'absolute', top: '24px', right: '24px', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: (isLocked && !canReview) ? '#f1f5f9' : isResuming ? '#fef3c7' : '#ecfdf5', color: (isLocked && !canReview) ? '#64748b' : isResuming ? '#a16207' : '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {(isLocked && !canReview) ? '🔒 Locked' : isResuming ? '⏳ In Progress' : '🟢 Available'}
                      </div>
                      
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        Search 2.0 Module
                      </div>
                      
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '22px', fontWeight: '800', color: (isLocked && !canReview) ? '#64748b' : '#0f172a' }}>
                        {set.id}
                      </h3>
                      
                      {/* Progress Bar Area */}
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
                          <span>Attempt Progress</span>
                          <span>{isUnlimited ? '∞' : `${pastAttempts} / ${set.attemptLimit}`}</span>
                        </div>
                        {!isUnlimited && (
                          <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', backgroundColor: (isLocked && !canReview) ? '#ef4444' : '#4f46e5', width: `${(pastAttempts / set.attemptLimit) * 100}%`, transition: 'width 0.3s ease' }}></div>
                          </div>
                        )}
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                          {isUnlimited ? "Unlimited practice mode enabled." : 
                           canReview ? "Answers are now available for review." :
                           isResuming ? "You have an unfinished attempt." :
                           isLocked ? "Maximum attempts reached. Awaiting review." : "You have attempts remaining."}
                        </div>
                      </div>

                      {/* SMART BUTTON LOGIC */}
                      {canReview ? (
                        <button 
                          onClick={() => navigate(`/simulate/search20`, { state: { targetSet: set.id, reviewMode: true } })}
                          className="btn-primary"
                          style={{ marginTop: 'auto', width: '100%', backgroundColor: '#0ea5e9' }}
                        >
                          📊 Review Results
                        </button>
                      ) : (
                        <button 
                          disabled={isLocked} 
                          onClick={() => launchExam(set.id)}
                          className="btn-primary"
                          style={{ 
                            marginTop: 'auto', 
                            width: '100%',
                            backgroundColor: isLocked ? '#cbd5e1' : isResuming ? '#f59e0b' : '#4f46e5', // Amber if resuming
                            color: isLocked ? '#64748b' : 'white',
                            cursor: isLocked ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isLocked ? "Awaiting Results" : isResuming ? "Continue Exam" : pastAttempts > 0 ? "Retake Module" : "Start Module"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* TAB CONTENT: COMING SOON MODULES */}
          {activeTab === 'autocomplete' && (
            <EmptyState title="Auto Complete Module" subtitle="This module is currently in development and will be available soon." icon="⌨️" />
          )}
          {activeTab === 'poi' && (
            <EmptyState title="POI Evaluation Module" subtitle="Point of Interest evaluation tasks will be deployed here soon." icon="📍" />
          )}

        </section>
      </main>
    </div>
  );
}


function MetricCard({ title, value, isWarning, isNeutral }) {
  return (
    <div className="metric-card" style={{ borderTop: isNeutral ? 'none' : isWarning ? '4px solid #ef4444' : '4px solid #10b981' }}>
      <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#64748b' }}>{title}</p>
      <p style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: isNeutral ? '#0f172a' : isWarning ? '#ef4444' : '#059669', letterSpacing: '-1px' }}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ title, subtitle, icon }) {
  return (
    <div style={{ padding: '80px 20px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#0f172a', fontWeight: '700' }}>{title}</h3>
      <p style={{ margin: 0, color: '#64748b', fontSize: '15px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>{subtitle}</p>
    </div>
  );
}