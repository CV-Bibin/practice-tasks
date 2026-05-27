import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../config/firebase";

export default function RaterAnalytics() {
  const navigate = useNavigate();
  const location = useLocation();
 
  const [raters, setRaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRater, setSelectedRater] = useState(null);
  const [activeTab, setActiveTab] = useState("overall");
  const [isLaunching, setIsLaunching] = useState(false); // To show loading state when fetching answers

useEffect(() => {
  fetchAnalyticsData();
}, [location.state?.reopenRaterId, location.state?.raterReportTab]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "rater")));
      const raterDataMap = {};
      
      usersSnap.forEach(doc => {
        raterDataMap[doc.id] = {
          id: doc.id,
          email: doc.data().email || "Unknown Rater",
          lastActive: null,
          totalTasks: 0,
          setBreakdown: {}, 
          modules: {
            overall: { tasks: 0, c: 0, t: 0 },
            search_2_0: { 
              tasks: 0, overall: { c: 0, t: 0 }, relevance: { c: 0, t: 0 }, 
              name: { c: 0, t: 0 }, address: { c: 0, t: 0 }, pin: { c: 0, t: 0 } 
            },
            auto_complete: { tasks: 0, overall: { c: 0, t: 0 } },
            poi: { tasks: 0, overall: { c: 0, t: 0 } }
          },
          recentActivity: []
        };
      });

      const subsSnap = await getDocs(collection(db, "rater_submissions"));
      
      subsSnap.forEach(doc => {
        const sub = doc.data();
        const uid = sub.userId;
        
        if (raterDataMap[uid]) {
          const rater = raterDataMap[uid];
          const taskType = sub.taskType || "search_2_0";
          const group = sub.taskGroup || "Unknown Set";
          const subTime = sub.submittedAt?.toMillis() || Date.now();
          
          rater.totalTasks++;
          rater.modules.overall.tasks++;
          if (rater.modules[taskType]) rater.modules[taskType].tasks++;

          if (!rater.setBreakdown[group]) rater.setBreakdown[group] = { tasks: 0, c: 0, t: 0 };
          rater.setBreakdown[group].tasks++;

          if (!rater.lastActive || subTime > rater.lastActive) rater.lastActive = subTime;

          rater.recentActivity.push({
            id: doc.id, type: taskType, time: subTime,
            score: sub.overall?.total > 0
  ? Math.round((sub.overall.correct / sub.overall.total) * 100)
  : 0
          });

          if (sub.overall) {
            rater.modules.overall.c += (sub.overall.correct || 0);
            rater.modules.overall.t += (sub.overall.total || 0);
            rater.setBreakdown[group].c += (sub.overall.correct || 0);
            rater.setBreakdown[group].t += (sub.overall.total || 0);
            
            if (rater.modules[taskType]) {
              rater.modules[taskType].overall.c += (sub.overall.correct || 0);
              rater.modules[taskType].overall.t += (sub.overall.total || 0);
            }
          }

          if (taskType === "search_2_0" && sub.categories) {
            const s2 = rater.modules.search_2_0;
            if (sub.categories.relevance) { s2.relevance.c += sub.categories.relevance.correct; s2.relevance.t += sub.categories.relevance.total; }
            if (sub.categories.nameAccuracy) { s2.name.c += sub.categories.nameAccuracy.correct; s2.name.t += sub.categories.nameAccuracy.total; }
            if (sub.categories.addressAccuracy) { s2.address.c += sub.categories.addressAccuracy.correct; s2.address.t += sub.categories.addressAccuracy.total; }
            if (sub.categories.pinAccuracy) { s2.pin.c += sub.categories.pinAccuracy.correct; s2.pin.t += sub.categories.pinAccuracy.total; }
          }
        }
      });

      Object.values(raterDataMap).forEach(rater => {
        rater.recentActivity.sort((a, b) => b.time - a.time);
        rater.recentActivity = rater.recentActivity.slice(0, 10);
      });

     const raterList = Object.values(raterDataMap);
setRaters(raterList);

const reopenRaterId = location.state?.reopenRaterId;
if (reopenRaterId) {
  const raterToReopen = raterList.find((r) => r.id === reopenRaterId);
  if (raterToReopen) {
    setSelectedRater(raterToReopen);
    setActiveTab(location.state?.raterReportTab || "search_2_0");
  }
}

    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: Magic Data Fetcher for Review Mode ---
  const launchReviewMode = async (setName) => {
    if (isLaunching) return;
    setIsLaunching(true);
    
    try {
      // Fetch ONLY the exact answers this specific rater submitted for this specific set
      const q = query(
        collection(db, "rater_submissions"), 
        where("userId", "==", selectedRater.id),
        where("taskGroup", "==", setName)
      );
      
      const snap = await getDocs(q);
      let pastAnswersPayload = {};
      
    snap.forEach(doc => {
  const data = doc.data();

  if (data.taskId && data.rawRaterAnswers) {
    pastAnswersPayload[data.taskId] = data.rawRaterAnswers;
  }
});

      // Navigate to simulator AND pass the data package
navigate('/simulate/search20', { 
  state: { 
    targetSet: setName, 
    reviewMode: true,
    reviewUid: selectedRater.id,
    reviewData: pastAnswersPayload,
    returnPath: "/admin",
    returnState: {
      activeTab: "analytics",
      reopenRaterId: selectedRater.id,
      raterReportTab: "search_2_0"
    }
  }
});
    } catch (error) {
      console.error("Error pulling rater data:", error);
      alert("Could not load the rater's past answers.");
    } finally {
      setIsLaunching(false);
    }
  };

  const calcPct = (c, t) => t > 0 ? Math.round((c / t) * 100) : 0;

  const getPctFormatted = (c, t) => {
    if (!t || t === 0) return <span style={{ color: '#94a3b8' }}>-</span>;
    const pct = calcPct(c, t);
    const color = pct >= 85 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
    return <span style={{ fontWeight: 'bold', color }}>{pct}%</span>;
  };

 const getInsights = (s2Data) => {
  const cats = [
    {
      name: "Relevance",
      c: s2Data.relevance.c,
      t: s2Data.relevance.t,
    },
    {
      name: "Name Accuracy",
      c: s2Data.name.c,
      t: s2Data.name.t,
    },
    {
      name: "Address Accuracy",
      c: s2Data.address.c,
      t: s2Data.address.t,
    },
    {
      name: "Pin Accuracy",
      c: s2Data.pin.c,
      t: s2Data.pin.t,
    },
  ]
    .filter((cat) => cat.t > 0)
    .map((cat) => ({
      name: cat.name,
      pct: calcPct(cat.c, cat.t),
    }));

  if (cats.length === 0) {
    return { strong: "N/A", weak: "N/A" };
  }

  cats.sort((a, b) => b.pct - a.pct);

  return {
    strong: `${cats[0].name} (${cats[0].pct}%)`,
    weak: `${cats[cats.length - 1].name} (${cats[cats.length - 1].pct}%)`,
  };
};

  const VisualBar = ({ label, correct, total }) => {
    const pct = calcPct(correct, total);
    const color = pct >= 85 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
    const bgTrackColor = pct >= 85 ? '#a7f3d0' : pct >= 70 ? '#fde68a' : '#fecaca'; 
    
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '700', color: '#475569' }}>
          <span>{label}</span>
          <span>{pct}% ({correct}/{total})</span>
        </div>
        <div style={{ width: '100%', backgroundColor: bgTrackColor, borderRadius: '6px', height: '12px', overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${pct}%`, backgroundColor: color, height: '100%', transition: 'width 0.5s ease-out' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
          <span>Correct</span>
          <span>Incorrect</span>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerBlock}>
        <h2 style={styles.sectionTitle}>Rater Performance Matrix</h2>
        <p style={styles.helpText}>Live accuracy tracking and exam progress for all active raters.</p>
      </div>

      <div style={styles.metricsRow}>
        <div style={styles.metricCard}>
          <div style={styles.metricValue}>{raters.length}</div>
          <div style={styles.metricLabel}>Total Registered Raters</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricValue}>{raters.reduce((acc, r) => acc + r.totalTasks, 0)}</div>
          <div style={styles.metricLabel}>Total Tasks Graded</div>
        </div>
      </div>

      <div style={styles.tableCard}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Calculating Analytics...</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Rater Email</th>
                <th style={styles.th}>Progress</th>
                <th style={styles.th}>Overall</th>
                <th style={styles.th}>Relevance</th>
                <th style={styles.th}>Name Acc.</th>
                <th style={styles.th}>Address Acc.</th>
                <th style={styles.th}>Pin Acc.</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {raters.map((rater) => (
                <tr key={rater.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{rater.email.split('@')[0]}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{rater.email}</div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.badge}>{rater.totalTasks} Tasks</span>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Across {Object.keys(rater.setBreakdown).length} Sets</div>
                  </td>
                  <td style={styles.td}>{getPctFormatted(rater.modules.overall.c, rater.modules.overall.t)}</td>
                  <td style={styles.td}>{getPctFormatted(rater.modules.search_2_0.relevance.c, rater.modules.search_2_0.relevance.t)}</td>
                  <td style={styles.td}>{getPctFormatted(rater.modules.search_2_0.name.c, rater.modules.search_2_0.name.t)}</td>
                  <td style={styles.td}>{getPctFormatted(rater.modules.search_2_0.address.c, rater.modules.search_2_0.address.t)}</td>
                  <td style={styles.td}>{getPctFormatted(rater.modules.search_2_0.pin.c, rater.modules.search_2_0.pin.t)}</td>
                  <td style={styles.td}>
                    <button onClick={() => { setSelectedRater(rater); setActiveTab("search_2_0"); }} style={styles.viewBtn}>View Report</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedRater && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>{selectedRater.email.split('@')[0]}'s Dossier</h3>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Last Login/Activity: {selectedRater.lastActive ? new Date(selectedRater.lastActive).toLocaleString() : "No Activity"}</div>
              </div>
              <button onClick={() => setSelectedRater(null)} style={styles.closeBtn}>✖</button>
            </div>

            <div style={styles.tabContainer}>
              {['overall', 'search_2_0', 'auto_complete', 'poi'].map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab)}
                  style={{ ...styles.tabBtn, ...(activeTab === tab ? styles.activeTabBtn : {}) }}
                >
                  {tab.replace(/_/g, ' ').toUpperCase()}
                </button>
              ))}
            </div>
            
            <div style={styles.modalBody}>
              
              {activeTab === 'overall' && (
                <div>
                  <div style={styles.grid2Col}>
                    <div style={styles.statBox}>
                      <div style={styles.statLabel}>Total Platform Tasks</div>
                      <div style={styles.statBigValue}>{selectedRater.totalTasks}</div>
                    </div>
                    <div style={styles.statBox}>
                      <div style={styles.statLabel}>Global Accuracy</div>
                      <div style={{...styles.statBigValue, color: '#10b981'}}>
                        {calcPct(selectedRater.modules.overall.c, selectedRater.modules.overall.t)}%
                      </div>
                    </div>
                  </div>

                  <h4 style={styles.subHeading}>Recent Activity Timeline</h4>
                  <div style={styles.timelineBox}>
                    {selectedRater.recentActivity.length === 0 ? <span style={{color: '#64748b'}}>No recent activity.</span> : 
                      selectedRater.recentActivity.map((act, i) => (
                        <div key={i} style={styles.timelineItem}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: act.score >= 85 ? '#10b981' : '#ef4444', marginRight: '12px' }}></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{act.type.replace(/_/g, ' ').toUpperCase()} Submission</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{new Date(act.time).toLocaleString()}</div>
                          </div>
                          <div style={{ fontWeight: 'bold', color: act.score >= 85 ? '#10b981' : '#ef4444' }}>{act.score}%</div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              {activeTab === 'search_2_0' && (
                <div>
                  {selectedRater.modules.search_2_0.tasks === 0 ? (
                    <div style={styles.emptyState}>No Search 2.0 tasks completed yet.</div>
                  ) : (
                    <>
                      <div style={{ ...styles.grid2Col, marginBottom: '24px' }}>
                        <div style={{ ...styles.statBox, backgroundColor: '#ecfdf5', borderColor: '#10b981' }}>
                          <div style={styles.statLabel}>Strongest Area</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669', marginTop: '4px' }}>
                            💪 {getInsights(selectedRater.modules.search_2_0).strong}
                          </div>
                        </div>
                        <div style={{ ...styles.statBox, backgroundColor: '#fef2f2', borderColor: '#ef4444' }}>
                          <div style={styles.statLabel}>Weakest Area</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b91c1c', marginTop: '4px' }}>
                            ⚠️ {getInsights(selectedRater.modules.search_2_0).weak}
                          </div>
                        </div>
                      </div>

                      <h4 style={styles.subHeading}>Accuracy Breakdown (Correct vs Incorrect)</h4>
                      <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
                        <VisualBar label="Relevance Classification" correct={selectedRater.modules.search_2_0.relevance.c} total={selectedRater.modules.search_2_0.relevance.t} />
                        <VisualBar label="Name & Category Accuracy" correct={selectedRater.modules.search_2_0.name.c} total={selectedRater.modules.search_2_0.name.t} />
                        <VisualBar label="Address & Component Accuracy" correct={selectedRater.modules.search_2_0.address.c} total={selectedRater.modules.search_2_0.address.t} />
                        <VisualBar label="Pin / Location Accuracy" correct={selectedRater.modules.search_2_0.pin.c} total={selectedRater.modules.search_2_0.pin.t} />
                      </div>

                      <h4 style={styles.subHeading}>Audit Rater Answers</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        {Object.keys(selectedRater.setBreakdown)
                          .filter(setName => setName !== "Unknown Set")
                          .map(setName => (
                            <div key={setName} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{setName}</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>Score: {getPctFormatted(selectedRater.setBreakdown[setName].c, selectedRater.setBreakdown[setName].t)}</div>
                              </div>
                              
                              {/* --- The Magic Button --- */}
                              <button 
                                onClick={() => launchReviewMode(setName)}
                                disabled={isLaunching}
                                style={{ backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: isLaunching ? 'not-allowed' : 'pointer' }}
                              >
                                {isLaunching ? "Loading Data..." : "🔍 Launch Review Mode"}
                              </button>

                            </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'auto_complete' && (
                 <div style={styles.emptyState}>
                   <div>{selectedRater.modules.auto_complete.tasks} Tasks Completed</div>
                   Auto Complete granular tracking will appear here once module is deployed.
                 </div>
              )}

              {activeTab === 'poi' && (
                 <div style={styles.emptyState}>
                   <div>{selectedRater.modules.poi.tasks} Tasks Completed</div>
                   POI Evaluation granular tracking will appear here once module is deployed.
                 </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column", gap: "24px" },
  headerBlock: { paddingBottom: "16px", borderBottom: "1px solid #cbd5e1" },
  sectionTitle: { margin: "0 0 4px 0", fontSize: "28px", color: "#0f172a", fontWeight: "800", letterSpacing: "-0.5px" },
  helpText: { margin: 0, color: "#64748b", fontSize: "15px" },
  metricsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' },
  metricCard: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  metricValue: { fontSize: '32px', fontWeight: '900', color: '#3b82f6', lineHeight: '1' },
  metricLabel: { fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px', marginTop: '8px' },
  tableCard: { backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  th: { padding: '16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  td: { padding: '16px', borderBottom: '1px solid #f1f5f9', fontSize: '14px', color: '#334155' },
  tr: { transition: 'background-color 0.1s' },
  badge: { backgroundColor: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' },
  viewBtn: { backgroundColor: 'white', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "#f8fafc", borderRadius: "12px", width: "100%", maxWidth: "700px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", overflow: "hidden" },
  modalHeader: { padding: "20px 24px", borderBottom: "1px solid #e2e8f0", backgroundColor: "white", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  closeBtn: { background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "#64748b" },
  tabContainer: { display: 'flex', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 24px' },
  tabBtn: { background: 'none', border: 'none', borderBottom: '3px solid transparent', padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s' },
  activeTabBtn: { color: '#3b82f6', borderBottom: '3px solid #3b82f6' },
  modalBody: { padding: '24px', overflowY: 'auto', flex: 1 },
  grid2Col: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  statBox: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  statLabel: { fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' },
  statBigValue: { fontSize: '28px', color: '#0f172a', fontWeight: '900', marginTop: '8px' },
  subHeading: { margin: '24px 0 12px 0', color: '#1e293b', fontSize: '16px', fontWeight: 'bold' },
  timelineBox: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' },
  timelineItem: { display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' },
  emptyState: { padding: '40px', textAlign: 'center', color: '#64748b', backgroundColor: 'white', borderRadius: '8px', border: '1px dashed #cbd5e1' }
};