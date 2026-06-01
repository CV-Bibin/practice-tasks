import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";

const getScoreStyle = (score) => {
  if (score >= 90) return { grad: "linear-gradient(135deg, #10b981, #047857)", solid: "#10b981" }; // Green
  if (score >= 80) return { grad: "linear-gradient(135deg, #3b82f6, #1d4ed8)", solid: "#3b82f6" }; // Blue
  if (score >= 70) return { grad: "linear-gradient(135deg, #facc15, #a16207)", solid: "#facc15" }; // Yellow
  if (score >= 60) return { grad: "linear-gradient(135deg, #f97316, #c2410c)", solid: "#f97316" }; // Orange
  if (score >= 50) return { grad: "linear-gradient(135deg, #d946ef, #a21caf)", solid: "#d946ef" }; // Magenta
  if (score >= 40) return { grad: "linear-gradient(135deg, #ef4444, #b91c1c)", solid: "#ef4444" }; // Red
  return { grad: "linear-gradient(135deg, #7f1d1d, #450a0a)", solid: "#7f1d1d" }; // Dark Red
};

const pct = (correct, total) =>
  total > 0 ? Math.round((correct / total) * 100) : 0;

const emptyScore = () => ({
  correct: 0,
  total: 0,
});

const emptyModuleMetrics = () => ({
  tasks: 0,
  overall: emptyScore(),
  relevance: emptyScore(),
  name: emptyScore(),
  address: emptyScore(),
  pin: emptyScore(),
});

const emptySetQuality = () => ({
  overall: emptyScore(),
  relevance: emptyScore(),
  name: emptyScore(),
  address: emptyScore(),
  pin: emptyScore(),
});

const addScore = (target, correct = 0, total = 0) => {
  target.correct += correct || 0;
  target.total += total || 0;
};

const getModuleKey = (taskType) => {
  if (taskType === "search_2_0") return "search20";
  if (taskType === "auto_complete") return "autocomplete";
  if (taskType === "poi" || taskType === "poi_eval") return "poi";
  return "search20";
};

const tabConfig = {
  search20: {
    label: "Search 2.0",
    tabLabel: "Search 2.0 Tasks",
    firestoreTypes: ["search_2_0", undefined, null, ""],
    emptyTitle: "You're all caught up",
    emptySubtitle: "There are no active Search 2.0 exams assigned right now.",
  },
  autocomplete: {
    label: "Auto Complete",
    tabLabel: "Auto Complete",
    firestoreTypes: ["auto_complete"],
    emptyTitle: "Auto Complete Module",
    emptySubtitle: "No active Auto Complete exams are available yet.",
  },
  poi: {
    label: "POI Evaluation",
    tabLabel: "POI Evaluation",
    firestoreTypes: ["poi", "poi_eval"],
    emptyTitle: "POI Evaluation Module",
    emptySubtitle: "No active POI Evaluation exams are available yet.",
  },
};

export default function RaterDashboard() {
  const [moduleMetrics, setModuleMetrics] = useState({
    search20: emptyModuleMetrics(),
    autocomplete: emptyModuleMetrics(),
    poi: emptyModuleMetrics(),
  });
  const [liveSets, setLiveSets] = useState([]);
  const [setQuality, setSetQuality] = useState({});
  const [userAttempts, setUserAttempts] = useState({});
  const [activeSessions, setActiveSessions] = useState({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("search20");

  const navigate = useNavigate();

  const calculateMetricsFromSubmissions = async (uid) => {
    const submissionsQuery = query(
      collection(db, "rater_submissions"),
      where("userId", "==", uid)
    );

    const submissionsSnap = await getDocs(submissionsQuery);

    const metricsByModule = {
      search20: emptyModuleMetrics(),
      autocomplete: emptyModuleMetrics(),
      poi: emptyModuleMetrics(),
    };

    const qualityBySet = {};

    submissionsSnap.forEach((d) => {
      const sub = d.data();
      const moduleKey = getModuleKey(sub.taskType);
      const moduleData = metricsByModule[moduleKey];
      const setName = sub.taskGroup || "Unknown Set";
      const cats = sub.categories || {};

      if (!qualityBySet[setName]) {
        qualityBySet[setName] = emptySetQuality();
      }

      moduleData.tasks += 1;

      addScore(moduleData.overall, sub.overall?.correct, sub.overall?.total);
      addScore(moduleData.relevance, cats.relevance?.correct, cats.relevance?.total);
      addScore(moduleData.name, cats.nameAccuracy?.correct, cats.nameAccuracy?.total);
      addScore(
        moduleData.address,
        cats.addressAccuracy?.correct,
        cats.addressAccuracy?.total
      );
      addScore(moduleData.pin, cats.pinAccuracy?.correct, cats.pinAccuracy?.total);

      addScore(qualityBySet[setName].overall, sub.overall?.correct, sub.overall?.total);
      addScore(
        qualityBySet[setName].relevance,
        cats.relevance?.correct,
        cats.relevance?.total
      );
      addScore(
        qualityBySet[setName].name,
        cats.nameAccuracy?.correct,
        cats.nameAccuracy?.total
      );
      addScore(
        qualityBySet[setName].address,
        cats.addressAccuracy?.correct,
        cats.addressAccuracy?.total
      );
      addScore(qualityBySet[setName].pin, cats.pinAccuracy?.correct, cats.pinAccuracy?.total);
    });

    return {
      metricsByModule,
      qualityBySet,
    };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        navigate("/");
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();

          if (userData.status === "suspended") {
            alert("Your account has been suspended. Please contact an administrator.");
            await signOut(auth);
            navigate("/");
            return;
          }

          if (userData.role === "admin") {
            setIsAdmin(true);
          }
        }

        const calculated = await calculateMetricsFromSubmissions(user.uid);
        setModuleMetrics(calculated.metricsByModule);
        setSetQuality(calculated.qualityBySet);

        const setsQuery = query(
          collection(db, "exam_sets"),
          where("isDeployed", "==", true)
        );
        const setsSnap = await getDocs(setsQuery);
        const availableSets = setsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setLiveSets(availableSets);

        const attemptsSnap = await getDocs(
          collection(db, "users", user.uid, "attempts")
        );
        const attemptsData = {};
        attemptsSnap.forEach((d) => {
          attemptsData[d.id] = d.data().count || 0;
        });
        setUserAttempts(attemptsData);

        const activeSnap = await getDocs(
          collection(db, "users", user.uid, "active_sessions")
        );
        const sessionData = {};
        activeSnap.forEach((d) => {
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
    navigate("/");
  };

  const launchExam = (setId) => {
    if (activeTab === "search20") {
      navigate("/simulate/search20", { state: { targetSet: setId } });
    }
  };

  const activeMetrics = moduleMetrics[activeTab] || emptyModuleMetrics();
  const activeConfig = tabConfig[activeTab];

  const activeSets = liveSets.filter((set) => {
    const setType = set.taskType || set.type || set.moduleType || "";

    if (activeTab === "search20") {
      return !setType || tabConfig.search20.firestoreTypes.includes(setType);
    }

    return activeConfig.firestoreTypes.includes(setType);
  });

  if (loading) {
    return (
      <div
        className="flex-center"
        style={{
          height: "100vh",
          backgroundColor: "#f8fafc",
          color: "#64748b",
          fontSize: "1.2rem",
          fontWeight: "500",
        }}
      >
        <div className="spinner" /> Loading Workspace...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      <style>{`
        .header-glass {
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .metric-card {
          background: white;
          border-radius: 14px;
          padding: 22px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .metric-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 30px rgba(15, 23, 42, 0.08);
        }

        .tab-btn {
          padding: 12px 24px;
          font-weight: 800;
          font-size: 15px;
          color: #64748b;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          color: #0f172a;
        }

        .tab-btn.active {
          color: #4f46e5;
          border-bottom-color: #4f46e5;
        }

        .exam-card {
          background: white;
          border-radius: 18px;
          padding: 26px;
          padding-bottom: 92px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.06);
          position: relative;
          overflow: hidden;
          min-height: 350px;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
        }

        .exam-card::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          height: 5px;
          background: linear-gradient(90deg, #4f46e5, #06b6d4, #10b981);
        }

        .exam-card:hover {
          transform: translateY(-4px);
          border-color: #a5b4fc;
          box-shadow: 0 22px 36px rgba(79, 70, 229, 0.12);
        }

        .quality-reveal {
          margin-top: 18px;
          border-radius: 14px;
          background: #ffffff; /* Changed to White */
          border: 1px solid #cbd5e1; /* Added the light stroke */
          overflow: hidden;
          transition: max-height 0.35s ease, box-shadow 0.25s ease;
        }

        .quality-reveal-header {
          height: 54px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 800;
          color: #334155; /* Changed from light blue to dark slate */
        }

        .quality-reveal-body {
          padding: 0 16px 16px 16px;
          display: grid;
          gap: 12px;
        }

        .quality-row {
          display: grid;
          grid-template-columns: 80px 1fr 44px;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #475569; /* Changed from light gray to dark gray */
        }

        .quality-track {
          height: 8px;
          background: #e2e8f0; /* Changed from transparent white to solid light gray */
          border-radius: 999px;
          overflow: hidden;
        }

        .quality-fill {
          height: 100%;
          border-radius: 999px;
        }

        .card-action {
          position: absolute;
          left: 26px;
          right: 26px;
          bottom: 24px;
          z-index: 2;
        }

        .btn-primary {
          width: 100%;
          background: #4f46e5;
          color: white;
          padding: 12px 20px;
          border-radius: 9px;
          font-weight: 800;
          font-size: 15px;
          border: none;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #4338ca;
        }

        .btn-primary:active:not(:disabled) {
          transform: scale(0.98);
        }

        .btn-primary:disabled {
          background: #cbd5e1;
          color: #64748b;
          cursor: not-allowed;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #e2e8f0;
          border-top-color: #4f46e5;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 12px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .flex-center {
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>

      <header
        className="header-glass"
        style={{
          padding: "16px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "34px",
              height: "34px",
              background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
              borderRadius: "10px",
            }}
          />
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: "900",
              color: "#0f172a",
            }}
          >
            RaterSpace
          </h1>
        </div>

        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              style={{
                background: "#eef2ff",
                color: "#4f46e5",
                border: "none",
                padding: "8px 16px",
                borderRadius: "20px",
                fontWeight: "800",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Admin Panel
            </button>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              borderLeft: "1px solid #e2e8f0",
              paddingLeft: "20px",
            }}
          >
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#0f172a",
                }}
              >
                {auth.currentUser?.email?.split("@")[0] || "User"}
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                Rater Account
              </div>
            </div>

            <button
              onClick={handleLogout}
              style={{
                background: "transparent",
                border: "1px solid #cbd5e1",
                color: "#475569",
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "700",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "40px" }}>
        <section style={{ marginBottom: "42px" }}>
          <div style={{ marginBottom: "22px" }}>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "900",
                color: "#0f172a",
                margin: 0,
              }}
            >
              {activeConfig.label} Quality Overview
            </h2>
            <p
              style={{
                margin: "6px 0 0 0",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              These numbers change based on the active task tab.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px",
            }}
          >
          {(() => {
              const overallScore = pct(activeMetrics.overall.correct, activeMetrics.overall.total);
              return (
                <MetricCard
                  title={`${activeConfig.label} Overall`}
                  value={`${overallScore}%`}
                  subText={`${activeMetrics.tasks} tasks submitted`}
                  scoreStyle={getScoreStyle(overallScore)}
                />
              );
            })()}
            
            <MetricCard
              title="Relevance"
              value={`${pct(activeMetrics.relevance.correct, activeMetrics.relevance.total)}%`}
              isWarning={
                pct(activeMetrics.relevance.correct, activeMetrics.relevance.total) < 85
              }
              accent="#0ea5e9"
              
            />
            <MetricCard
              title="Name Accuracy"
              value={`${pct(activeMetrics.name.correct, activeMetrics.name.total)}%`}
              isWarning={pct(activeMetrics.name.correct, activeMetrics.name.total) < 85}
              accent="#10b981"
              
            />
            <MetricCard
              title="Address Accuracy"
              value={`${pct(activeMetrics.address.correct, activeMetrics.address.total)}%`}
              isWarning={
                pct(activeMetrics.address.correct, activeMetrics.address.total) < 85
              }
              accent="#f59e0b"
             
            />
            <MetricCard
              title="Pin Accuracy"
              value={`${pct(activeMetrics.pin.correct, activeMetrics.pin.total)}%`}
              isWarning={pct(activeMetrics.pin.correct, activeMetrics.pin.total) < 85}
              accent="#fb7185"
              
            />
          </div>
        </section>

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              borderBottom: "1px solid #e2e8f0",
              marginBottom: "32px",
            }}
          >
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {Object.entries(tabConfig).map(([key, config]) => (
                <div
                  key={key}
                  className={`tab-btn ${activeTab === key ? "active" : ""}`}
                  onClick={() => setActiveTab(key)}
                >
                  {config.tabLabel}
                </div>
              ))}
            </div>
          </div>

          {activeSets.length === 0 ? (
            <EmptyState
              title={activeConfig.emptyTitle}
              subtitle={activeConfig.emptySubtitle}
            />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                gap: "24px",
              }}
            >
              {activeSets.map((set) => {
                const pastAttempts = userAttempts[set.id] || 0;
                const isUnlimited = set.attemptLimit === 999;
                const hasReachedLimit =
                  !isUnlimited && pastAttempts >= set.attemptLimit;
                const isResuming = !!activeSessions[set.id] && !hasReachedLimit;
                const isLocked = hasReachedLimit;
                const canReview = hasReachedLimit && set.answersRevealed;
                const quality = setQuality[set.id];

                return (
                  <div key={set.id} className="exam-card">
                    <div
                      style={{
                        position: "absolute",
                        top: "24px",
                        right: "24px",
                        padding: "6px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "800",
                        backgroundColor:
                          isLocked && !canReview
                            ? "#f1f5f9"
                            : isResuming
                              ? "#fef3c7"
                              : "#ecfdf5",
                        color:
                          isLocked && !canReview
                            ? "#64748b"
                            : isResuming
                              ? "#a16207"
                              : "#059669",
                      }}
                    >
                      {isLocked && !canReview
                        ? "Locked"
                        : isResuming
                          ? "In Progress"
                          : "Available"}
                    </div>

                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "800",
                        color: "#4f46e5",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "8px",
                      }}
                    >
                      {activeConfig.label} Module
                    </div>

                    <h3
                      style={{
                        margin: "0 0 16px 0",
                        fontSize: "24px",
                        fontWeight: "900",
                        color: isLocked && !canReview ? "#64748b" : "#0f172a",
                        paddingRight: "100px",
                      }}
                    >
                      {set.id}
                    </h3>

                    <div
                      style={{
                        backgroundColor: "#f8fafc",
                        padding: "16px",
                        borderRadius: "12px",
                        border: "1px solid #f1f5f9",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "13px",
                          fontWeight: "700",
                          color: "#475569",
                          marginBottom: "8px",
                        }}
                      >
                        <span>Attempt Progress</span>
                        <span>
                          {isUnlimited
                            ? "Unlimited"
                            : `${pastAttempts} / ${set.attemptLimit}`}
                        </span>
                      </div>

                      {!isUnlimited && (
                        <div
                          style={{
                            height: "7px",
                            backgroundColor: "#e2e8f0",
                            borderRadius: "999px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              backgroundColor:
                                isLocked && !canReview
                                  ? "#ef4444"
                                  : isResuming
                                    ? "#f59e0b"
                                    : "#4f46e5",
                              width: `${Math.min(
                                100,
                                (pastAttempts / set.attemptLimit) * 100
                              )}%`,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: "12px",
                          color: "#94a3b8",
                          marginTop: "8px",
                        }}
                      >
                        {isUnlimited
                          ? "Unlimited practice mode enabled."
                          : canReview
                            ? "Answers are available for review."
                            : isResuming
                              ? "You have an unfinished attempt."
                              : isLocked
                                ? "Maximum attempts reached."
                                : "You have attempts remaining."}
                      </div>
                    </div>

                    <QualityReveal quality={quality} />

                    <div className="card-action">
                      {canReview ? (
                        <button
                          onClick={() =>
                            navigate("/simulate/search20", {
                              state: {
                                targetSet: set.id,
                                reviewMode: true,
                              },
                            })
                          }
                          className="btn-primary"
                          style={{ backgroundColor: "#0ea5e9" }}
                        >
                          Review Results
                        </button>
                      ) : (
                        <button
                          disabled={isLocked || activeTab !== "search20"}
                          onClick={() => launchExam(set.id)}
                          className="btn-primary"
                          style={{
                            backgroundColor:
                              isLocked || activeTab !== "search20"
                                ? "#cbd5e1"
                                : isResuming
                                  ? "#f59e0b"
                                  : "#4f46e5",
                            color:
                              isLocked || activeTab !== "search20"
                                ? "#64748b"
                                : "white",
                          }}
                        >
                          {activeTab !== "search20"
                            ? "Coming Soon"
                            : isLocked
                              ? "Awaiting Results"
                              : isResuming
                                ? "Continue Exam"
                                : pastAttempts > 0
                                  ? "Retake Module"
                                  : "Start Module"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ title, value, isWarning, accent, subText, scoreStyle }) {
  // CSS trick to make the text render as a gradient
  const gradientCSS = scoreStyle ? {
    backgroundImage: scoreStyle.grad,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  } : {};

  return (
    <div
      className="metric-card"
      style={{
        // Uses the dynamic solid color for the top stroke, or defaults for other cards
        borderTop: scoreStyle ? `4px solid ${scoreStyle.solid}` : (isWarning ? "4px solid #ef4444" : `4px solid ${accent}`),
        background: "white" 
      }}
    >
      <p
        style={{
          margin: "0 0 8px 0",
          fontSize: "14px",
          fontWeight: "800",
          color: scoreStyle ? "transparent" : "#64748b",
          ...gradientCSS
        }}
      >
        {title}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "34px",
          fontWeight: "950",
          color: scoreStyle ? "transparent" : (isWarning ? "#ef4444" : "#059669"),
          lineHeight: 1,
          ...gradientCSS
        }}
      >
        {value}
      </p>
      {subText && (
        <p
          style={{
            margin: "10px 0 0 0",
            fontSize: "12px",
            fontWeight: "700",
            color: scoreStyle ? "transparent" : "#94a3b8",
            ...gradientCSS
          }}
        >
          {subText}
        </p>
      )}
    </div>
  );
}

function QualityReveal({ quality }) {
  // NEW: State to track if the drawer is open or closed
  const [isOpen, setIsOpen] = useState(false);

  if (!quality || quality.overall.total === 0) {
    return (
      <div className="quality-reveal">
        <div className="quality-reveal-header">
          <span>Set Quality</span>
          <span>No attempts yet</span>
        </div>
        <div className="quality-reveal-body">
          <div style={{ color: "#94a3b8", fontSize: "12px", lineHeight: 1.5 }}>
            Complete at least one task in this set to unlock quality details.
          </div>
        </div>
      </div>
    );
  }

 return (
    <div 
      className="quality-reveal"
      // NEW: Dynamically change height and shadow based on 'isOpen' state
      style={{
        maxHeight: isOpen ? "280px" : "54px",
        boxShadow: isOpen ? "inset 0 1px 0 rgba(255,255,255,0.08)" : "none"
      }}
    >
      {/* NEW: Make the header clickable to toggle the state */}
      <div 
        className="quality-reveal-header" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: "pointer" }}
      >
        <span>Set Quality</span>
        
        {/* NEW: Added a dropdown arrow that rotates when clicked */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>{pct(quality.overall.correct, quality.overall.total)}%</span>
          <span style={{ 
            fontSize: "10px", 
            transform: isOpen ? "rotate(180deg)" : "none", 
            transition: "transform 0.3s ease" 
          }}>
            ▼
          </span>
        </div>
      </div>

      <div className="quality-reveal-body">
        <QualityRow label="Overall" data={quality.overall} color="#38bdf8" />
        <QualityRow label="Relevance" data={quality.relevance} color="#818cf8" />
        <QualityRow label="Name" data={quality.name} color="#22c55e" />
        <QualityRow label="Address" data={quality.address} color="#f59e0b" />
        <QualityRow label="Pin" data={quality.pin} color="#fb7185" />
      </div>
    </div>
  );
}
function QualityRow({ label, data, color }) {
  const score = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;

  return (
    <div className="quality-row">
      <span>{label}</span>
      
      <div className="quality-track">
        <div
          className="quality-fill"
          style={{
            width: `${score}%`,
            backgroundColor: color,
          }}
        />
      </div>
      
      {/* Updated text color to dark slate so it shows on the light background */}
      <strong style={{ color: "#0f172a", textAlign: "right", fontSize: "13px" }}>
        {data.total > 0 ? `${score}%` : "0%"}
      </strong>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div
      style={{
        padding: "80px 20px",
        textAlign: "center",
        backgroundColor: "white",
        borderRadius: "16px",
        border: "1px dashed #cbd5e1",
      }}
    >
      <h3
        style={{
          margin: "0 0 8px 0",
          fontSize: "20px",
          color: "#0f172a",
          fontWeight: "800",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          color: "#64748b",
          fontSize: "15px",
          maxWidth: "420px",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}