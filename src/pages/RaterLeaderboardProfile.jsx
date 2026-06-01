import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../config/firebase";

const pct = (c, t) => (t > 0 ? Math.round((c / t) * 100) : 0);

const emptyQuality = () => ({
    correct: 0,
    total: 0,
});

const qualityLabels = {
    relevance: "Relevance",
    name: "Name",
    address: "Address",
    pin: "Pin",
};

export default function RaterLeaderboardProfile() {
    const [loading, setLoading] = useState(true);
    const [raters, setRaters] = useState([]);
    const [selectedRater, setSelectedRater] = useState(null);
    const [improvementMetric, setImprovementMetric] = useState("overall");

    useEffect(() => {
        fetchRaterPerformance();
    }, []);

    const fetchRaterPerformance = async () => {
        setLoading(true);

        try {
            const usersSnap = await getDocs(
                query(collection(db, "users"), where("role", "==", "rater")),
            );

            const raterMap = {};

            usersSnap.forEach((userDoc) => {
                const data = userDoc.data();

                raterMap[userDoc.id] = {
                    id: userDoc.id,
                    email: data.email || "Unknown Rater",
                    totalTasks: 0,
                    overallCorrect: 0,
                    overallTotal: 0,
                    sets: {},
                    quality: {
                        relevance: emptyQuality(),
                        name: emptyQuality(),
                        address: emptyQuality(),
                        pin: emptyQuality(),
                    },
                    timeline: [],
                };
            });

            const submissionsSnap = await getDocs(collection(db, "rater_submissions"));

            submissionsSnap.forEach((subDoc) => {
                const sub = subDoc.data();
                const rater = raterMap[sub.userId];

                if (!rater) return;

                const submittedTime = sub.submittedAt?.toMillis?.() || 0;
                const setName = sub.taskGroup || "Unknown Set";
                const cats = sub.categories || {};

                rater.totalTasks += 1;
                rater.overallCorrect += sub.overall?.correct || 0;
                rater.overallTotal += sub.overall?.total || 0;

                if (!rater.sets[setName]) {
                    rater.sets[setName] = {
                        tasks: 0,
                        correct: 0,
                        total: 0,
                        quality: {
                            relevance: emptyQuality(),
                            name: emptyQuality(),
                            address: emptyQuality(),
                            pin: emptyQuality(),
                        },
                    };
                }

                rater.sets[setName].tasks += 1;
                rater.sets[setName].correct += sub.overall?.correct || 0;
                rater.sets[setName].total += sub.overall?.total || 0;

                addQuality(rater.quality.relevance, cats.relevance);
                addQuality(rater.quality.name, cats.nameAccuracy);
                addQuality(rater.quality.address, cats.addressAccuracy);
                addQuality(rater.quality.pin, cats.pinAccuracy);

                addQuality(rater.sets[setName].quality.relevance, cats.relevance);
                addQuality(rater.sets[setName].quality.name, cats.nameAccuracy);
                addQuality(rater.sets[setName].quality.address, cats.addressAccuracy);
                addQuality(rater.sets[setName].quality.pin, cats.pinAccuracy);

                rater.timeline.push({
                    id: subDoc.id,
                    setName,
                    taskType: sub.taskType || "unknown",
                    time: submittedTime,
                    scores: {
                        overall: pct(sub.overall?.correct || 0, sub.overall?.total || 0),
                        relevance: pct(cats.relevance?.correct || 0, cats.relevance?.total || 0),
                        name: pct(cats.nameAccuracy?.correct || 0, cats.nameAccuracy?.total || 0),
                        address: pct(cats.addressAccuracy?.correct || 0, cats.addressAccuracy?.total || 0),
                        pin: pct(cats.pinAccuracy?.correct || 0, cats.pinAccuracy?.total || 0),
                    },
                });
            });

            const raterList = Object.values(raterMap)
                .map((rater) => ({
                    ...rater,
                    overallAccuracy: pct(rater.overallCorrect, rater.overallTotal),
                    timeline: rater.timeline.sort((a, b) => b.time - a.time).slice(0, 12),
                }))
                .sort((a, b) => {
                    if (b.overallAccuracy !== a.overallAccuracy) {
                        return b.overallAccuracy - a.overallAccuracy;
                    }

                    return b.totalTasks - a.totalTasks;
                });

            setRaters(raterList);
            setSelectedRater(raterList[0] || null);
        } catch (error) {
            console.error("Failed to load leaderboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const activeRater = selectedRater || raters[0];

    const categoryLeaderboards = {
        relevance: getCategoryRanking(raters, "relevance"),
        name: getCategoryRanking(raters, "name"),
        address: getCategoryRanking(raters, "address"),
        pin: getCategoryRanking(raters, "pin"),
    };

    if (loading) {
        return <div style={styles.loading}>Loading leaderboard...</div>;
    }

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Leaderboard & Rater Profile</h1>
                    <p style={styles.subtitle}>
                        Ranking, improvement path, set progress, and quality by section.
                    </p>
                </div>

                <button onClick={fetchRaterPerformance} style={styles.refreshBtn}>
                    Refresh
                </button>
            </div>

            <div style={styles.layout}>
                <section style={styles.leaderboardPanel}>
                    <h2 style={styles.panelTitle}>Overall Leaderboard</h2>

                    {raters.length === 0 ? (
                        <div style={styles.emptyState}>No rater submissions found yet.</div>
                    ) : (
                        <div style={styles.raterList}>
                            {raters.map((rater, index) => (
                                <button
                                    key={rater.id}
                                    type="button"
                                    onClick={() => setSelectedRater(rater)}
                                    style={{
                                        ...styles.raterRow,
                                        ...(activeRater?.id === rater.id ? styles.raterRowActive : {}),
                                    }}
                                >
                                    <div style={styles.rank}>#{index + 1}</div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={styles.raterName}>{rater.email.split("@")[0]}</div>
                                        <div style={styles.raterEmail}>{rater.email}</div>
                                    </div>

                                    <div style={styles.scoreBlock}>
                                        <div style={styles.score}>{rater.overallAccuracy}%</div>
                                        <div style={styles.scoreLabel}>{rater.totalTasks} tasks</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    <h2 style={{ ...styles.panelTitle, marginTop: "24px" }}>
                        Category Leaders
                    </h2>

                    <div style={styles.categoryBoardStack}>
                        <CategoryLeaderboard
                            title="Relevance"
                            raters={categoryLeaderboards.relevance}
                        />
                        <CategoryLeaderboard title="Name" raters={categoryLeaderboards.name} />
                        <CategoryLeaderboard
                            title="Address"
                            raters={categoryLeaderboards.address}
                        />
                        <CategoryLeaderboard title="Pin" raters={categoryLeaderboards.pin} />
                    </div>
                </section>

                <section style={styles.profilePanel}>
                    {!activeRater ? (
                        <div style={styles.emptyState}>Select a rater to view profile.</div>
                    ) : (
                        <>
                            <div style={styles.profileHeader}>
                                <div style={{ minWidth: 0 }}>
                                    <h2 style={styles.profileName}>{activeRater.email.split("@")[0]}</h2>
                                    <p style={styles.raterEmail}>{activeRater.email}</p>
                                </div>

                                <div style={styles.profileScore}>{activeRater.overallAccuracy}%</div>
                            </div>

                           

                            <div style={styles.sectionHeaderRow}>
                                <h3 style={styles.sectionTitle}>Improvement Path</h3>

                                <select
                                    value={improvementMetric}
                                    onChange={(e) => setImprovementMetric(e.target.value)}
                                    style={styles.metricSelect}
                                >
                                    <option value="overall">Overall</option>
                                    <option value="relevance">Relevance</option>
                                    <option value="name">Name</option>
                                    <option value="address">Address</option>
                                    <option value="pin">Pin</option>
                                </select>
                            </div>

                            <LineGraph points={activeRater.timeline} metric={improvementMetric} />

                            <h3 style={styles.sectionTitle}>Quality Breakdown</h3>
                            <div style={styles.qualityGrid}>
                                <QualityBar label="Relevance" data={activeRater.quality.relevance} />
                                <QualityBar label="Name" data={activeRater.quality.name} />
                                <QualityBar label="Address" data={activeRater.quality.address} />
                                <QualityBar label="Pin" data={activeRater.quality.pin} />
                            </div>

                            <h3 style={styles.sectionTitle}>Set Quality Progress</h3>
                            <div style={styles.setGrid}>
                                {Object.entries(activeRater.sets).length === 0 ? (
                                    <div style={styles.emptyState}>No set progress yet.</div>
                                ) : (
                                    Object.entries(activeRater.sets).map(([setName, setData]) => (
                                        <div key={setName} style={styles.setCard}>
                                            <div style={styles.setTop}>
                                                <div>
                                                    <div style={styles.setName}>{setName}</div>
                                                    <div style={styles.setMeta}>
                                                        {setData.tasks} tasks · Overall{" "}
                                                        {pct(setData.correct, setData.total)}%
                                                    </div>
                                                </div>
                                                <strong>{pct(setData.correct, setData.total)}%</strong>
                                            </div>

                                            <div style={styles.setQualityGrid}>
                                                <MiniQuality label="Rel" data={setData.quality.relevance} />
                                                <MiniQuality label="Name" data={setData.quality.name} />
                                                <MiniQuality label="Addr" data={setData.quality.address} />
                                                <MiniQuality label="Pin" data={setData.quality.pin} />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <h3 style={styles.sectionTitle}>All Raters Quality Comparison</h3>
                            <AllRatersQualityGraph raters={raters} />
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}

function addQuality(target, source) {
    target.correct += source?.correct || 0;
    target.total += source?.total || 0;
}

function getCategoryRanking(raters, key) {
    return raters
        .map((rater) => ({
            id: rater.id,
            email: rater.email,
            tasks: rater.totalTasks,
            score: pct(rater.quality[key].correct, rater.quality[key].total),
            total: rater.quality[key].total,
        }))
        .filter((rater) => rater.total > 0)
        .sort((a, b) => b.score - a.score || b.tasks - a.tasks)
        .slice(0, 5);
}

function SummaryTile({ label, value }) {
    return (
        <div style={styles.summaryTile}>
            <div style={styles.summaryLabel}>{label}</div>
            <div style={styles.summaryValue}>{value}</div>
        </div>
    );
}

function LineGraph({ points, metric }) {
  const ordered = [...points].reverse();
  const graphPoints = ordered.length > 0 ? ordered : [{ scores: { [metric]: 0 } }];

  const width = 620;
  const height = 190;
  const padding = 22;

  const coords = graphPoints.map((point, index) => {
    const score = point.scores?.[metric] || 0;

    const x =
      padding +
      (index / Math.max(graphPoints.length - 1, 1)) * (width - padding * 2);

    const y =
      height - padding - (score / 100) * (height - padding * 2);

    return { x, y, score };
  });

  const polyline = coords.map((coord) => `${coord.x},${coord.y}`).join(" ");

  return (
    <div style={styles.graphCard}>
      <svg viewBox={`0 0 ${width} ${height}`} style={styles.graphSvg}>
        <line x1="22" y1="168" x2="598" y2="168" stroke="#e2e8f0" />
        <line x1="22" y1="22" x2="22" y2="168" stroke="#e2e8f0" />
        <line x1="22" y1="95" x2="598" y2="95" stroke="#e2e8f0" strokeDasharray="4 4" />

        <polyline
          points={polyline}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {coords.map((coord, index) => (
          <g key={index}>
            <circle cx={coord.x} cy={coord.y} r="5" fill="#0f172a" />
            <text
              x={coord.x}
              y={Math.max(coord.y - 10, 14)}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="#334155"
            >
              {coord.score}%
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}


function AllRatersQualityGraph({ raters }) {
  const visibleRaters = raters.filter((rater) => rater.totalTasks > 0);

  if (visibleRaters.length === 0) {
    return <div style={styles.emptyState}>No rater quality data available.</div>;
  }

  const categories = [
    { key: "relevance", label: "Rel", color: "#0ea5e9" },
    { key: "name", label: "Name", color: "#10b981" },
    { key: "address", label: "Addr", color: "#f59e0b" },
    { key: "pin", label: "Pin", color: "#ef4444" },
  ];

  return (
    <div style={styles.compareGraphCard}>
      <div style={styles.compareLegend}>
        {categories.map((cat) => (
          <span key={cat.key} style={styles.legendItem}>
            <span style={{ ...styles.legendDot, backgroundColor: cat.color }} />
            {cat.label}
          </span>
        ))}
      </div>

      <div style={styles.compareRows}>
        {visibleRaters.map((rater) => (
          <div key={rater.id} style={styles.compareRow}>
            <div style={styles.compareName}>{rater.email.split("@")[0]}</div>

            <div style={styles.compareBars}>
              {categories.map((cat) => {
                const score = pct(
                  rater.quality[cat.key].correct,
                  rater.quality[cat.key].total
                );

                return (
                  <div key={cat.key} style={styles.compareBarWrap}>
                    <div
                      style={{
                        ...styles.compareBar,
                        height: `${Math.max(score, 4)}%`,
                        backgroundColor: cat.color,
                      }}
                      title={`${cat.label}: ${score}%`}
                    />
                    <span style={styles.compareBarLabel}>{score}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function CategoryLeaderboard({ title, raters }) {
    return (
        <div style={styles.categoryBoard}>
            <div style={styles.categoryTitle}>{title}</div>

            {raters.length === 0 ? (
                <div style={styles.raterEmail}>No data</div>
            ) : (
                raters.map((rater, index) => (
                    <div key={rater.id} style={styles.categoryRow}>
                        <span style={styles.categoryName}>
                            #{index + 1} {rater.email.split("@")[0]}
                        </span>
                        <strong>{rater.score}%</strong>
                    </div>
                ))
            )}
        </div>
    );
}

function QualityBar({ label, data }) {
    const score = pct(data.correct, data.total);
    const color = score >= 85 ? "#10b981" : score >= 70 ? "#f59e0b" : "#ef4444";

    return (
        <div style={styles.qualityCard}>
            <div style={styles.qualityTop}>
                <span>{label}</span>
                <strong>{data.total > 0 ? `${score}%` : "-"}</strong>
            </div>
            <div style={styles.track}>
                <div style={{ ...styles.fill, width: `${score}%`, backgroundColor: color }} />
            </div>
            <div style={styles.qualityMeta}>
                {data.correct}/{data.total} correct
            </div>
        </div>
    );
}

function MiniQuality({ label, data }) {
    const score = pct(data.correct, data.total);

    return (
        <div style={styles.miniQuality}>
            <span>{label}</span>
            <strong>{data.total > 0 ? `${score}%` : "-"}</strong>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        padding: "32px",
        backgroundColor: "#f8fafc",
        fontFamily: "system-ui, sans-serif",
    },
    loading: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#64748b",
        fontSize: "18px",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        gap: "16px",
        alignItems: "center",
        marginBottom: "24px",
    },
    title: {
        margin: 0,
        color: "#0f172a",
        fontSize: "28px",
        fontWeight: "900",
    },
    subtitle: {
        margin: "6px 0 0 0",
        color: "#64748b",
        fontSize: "14px",
    },
    refreshBtn: {
        backgroundColor: "#0f172a",
        color: "white",
        border: "none",
        borderRadius: "8px",
        padding: "10px 16px",
        cursor: "pointer",
        fontWeight: "800",
    },
    layout: {
        display: "grid",
        gridTemplateColumns: "minmax(320px, 0.8fr) minmax(560px, 1.5fr)",
        gap: "20px",
    },
    leaderboardPanel: {
        backgroundColor: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    },
    profilePanel: {
        backgroundColor: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "22px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    },
    panelTitle: {
        margin: "0 0 14px 0",
        color: "#0f172a",
        fontSize: "18px",
    },
    raterList: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    },
    raterRow: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "12px",
        textAlign: "left",
        cursor: "pointer",
    },
    raterRowActive: {
        backgroundColor: "#ecfdf5",
        borderColor: "#10b981",
    },
    rank: {
        width: "38px",
        height: "38px",
        borderRadius: "999px",
        backgroundColor: "#0f172a",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "900",
        fontSize: "13px",
        flexShrink: 0,
    },
    raterName: {
        color: "#0f172a",
        fontSize: "14px",
        fontWeight: "800",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    raterEmail: {
        color: "#64748b",
        fontSize: "12px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    scoreBlock: {
        textAlign: "right",
        flexShrink: 0,
    },
    score: {
        color: "#059669",
        fontWeight: "900",
        fontSize: "18px",
    },
    scoreLabel: {
        color: "#64748b",
        fontSize: "11px",
    },
    categoryBoardStack: {
        display: "grid",
        gap: "10px",
    },
    categoryBoard: {
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "12px",
        backgroundColor: "#f8fafc",
    },
    categoryTitle: {
        color: "#0f172a",
        fontSize: "13px",
        fontWeight: "900",
        marginBottom: "8px",
    },
    categoryRow: {
        display: "flex",
        justifyContent: "space-between",
        gap: "8px",
        color: "#334155",
        fontSize: "12px",
        padding: "6px 0",
        borderTop: "1px solid #e2e8f0",
    },
    categoryName: {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    profileHeader: {
        display: "flex",
        justifyContent: "space-between",
        gap: "16px",
        alignItems: "flex-start",
        marginBottom: "18px",
    },
    profileName: {
        margin: 0,
        color: "#0f172a",
        fontSize: "24px",
        fontWeight: "900",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    profileScore: {
        color: "#059669",
        fontSize: "36px",
        fontWeight: "900",
        lineHeight: 1,
        flexShrink: 0,
    },
    summaryGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "12px",
        marginBottom: "20px",
    },
    summaryTile: {
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "14px",
    },
    summaryLabel: {
        color: "#64748b",
        fontSize: "11px",
        fontWeight: "800",
        textTransform: "uppercase",
    },
    summaryValue: {
        marginTop: "6px",
        color: "#0f172a",
        fontSize: "22px",
        fontWeight: "900",
    },
    sectionTitle: {
        margin: "22px 0 12px 0",
        color: "#0f172a",
        fontSize: "16px",
        fontWeight: "900",
    },
    graphCard: {
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        backgroundColor: "#f8fafc",
        padding: "12px",
    },
    graphSvg: {
        width: "100%",
        height: "190px",
        display: "block",
    },
    qualityGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "12px",
    },
    qualityCard: {
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "14px",
    },
    qualityTop: {
        display: "flex",
        justifyContent: "space-between",
        color: "#334155",
        fontSize: "14px",
        fontWeight: "800",
        marginBottom: "8px",
    },
    track: {
        width: "100%",
        height: "8px",
        backgroundColor: "#e2e8f0",
        borderRadius: "999px",
        overflow: "hidden",
    },
    fill: {
        height: "100%",
        backgroundColor: "#10b981",
        borderRadius: "999px",
    },
    qualityMeta: {
        marginTop: "6px",
        color: "#64748b",
        fontSize: "12px",
    },
    setGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "12px",
    },
    setCard: {
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "14px",
    },
    setTop: {
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        marginBottom: "10px",
    },
    setName: {
        color: "#0f172a",
        fontSize: "14px",
        fontWeight: "900",
    },
    setMeta: {
        color: "#64748b",
        fontSize: "12px",
        marginTop: "4px",
    },
    setQualityGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "8px",
    },
    miniQuality: {
        backgroundColor: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "6px",
        padding: "8px",
        display: "flex",
        justifyContent: "space-between",
        gap: "6px",
        fontSize: "12px",
        color: "#334155",
    },
    timeline: {
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        overflow: "hidden",
    },
    timelineRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        padding: "12px 14px",
        borderBottom: "1px solid #e2e8f0",
    },
    timelineScore: {
        fontWeight: "900",
        fontSize: "16px",
        flexShrink: 0,
    },
    emptyState: {
        padding: "28px",
        textAlign: "center",
        color: "#64748b",
        backgroundColor: "#f8fafc",
        border: "1px dashed #cbd5e1",
        borderRadius: "8px",
    },

    sectionHeaderRow: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginTop: "22px",
  marginBottom: "12px",
},

metricSelect: {
  border: "1px solid #cbd5e1",
  backgroundColor: "white",
  borderRadius: "8px",
  padding: "8px 10px",
  color: "#334155",
  fontWeight: "800",
},

compareGraphCard: {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  backgroundColor: "#f8fafc",
  padding: "14px",
  overflowX: "auto",
},

compareLegend: {
  display: "flex",
  gap: "14px",
  marginBottom: "16px",
  color: "#475569",
  fontSize: "12px",
  fontWeight: "800",
},

legendItem: {
  display: "flex",
  alignItems: "center",
  gap: "6px",
},

legendDot: {
  width: "10px",
  height: "10px",
  borderRadius: "999px",
  display: "inline-block",
},

compareRows: {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
},

compareRow: {
  display: "grid",
  gridTemplateColumns: "140px 1fr",
  gap: "12px",
  alignItems: "end",
},

compareName: {
  color: "#0f172a",
  fontSize: "12px",
  fontWeight: "900",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
},

compareBars: {
  height: "130px",
  display: "grid",
  gridTemplateColumns: "repeat(4, 54px)",
  gap: "10px",
  alignItems: "end",
  borderBottom: "1px solid #cbd5e1",
},

compareBarWrap: {
  height: "120px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "4px",
},

compareBar: {
  width: "22px",
  borderRadius: "6px 6px 0 0",
  minHeight: "4px",
},

compareBarLabel: {
  color: "#64748b",
  fontSize: "10px",
  fontWeight: "800",
},
};