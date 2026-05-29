import { useState, useEffect } from "react";
import { collection, getDocs, updateDoc, doc, writeBatch, setDoc, deleteDoc, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { useDialog } from "../components/shared/CustomDialogProvider";

export default function SetManagement() {
  const [tasks, setTasks] = useState([]);
  const [setSettings, setSetSettings] = useState({});
  const [activeSet, setActiveSet] = useState("Unassigned");
  const [loading, setLoading] = useState(false);
  const { alertBox, confirmBox, promptBox } = useDialog();

  // NEW: Analytics States
  const [totalRaters, setTotalRaters] = useState(0);
  const [setCompletions, setSetCompletions] = useState({}); // { 'Batch A': 5 }

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedToAdd, setSelectedToAdd] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "tasks"));
      const taskList = querySnapshot.docs.map(d => ({
        id: d.id, group: d.data().group || "Unassigned", type: d.data().taskType || "Unknown", title: d.data().taskData?.query || d.data().query || "Unnamed Task"
      }));
      setTasks(taskList);

      const settingsSnapshot = await getDocs(collection(db, "exam_sets"));
      const settingsData = {};
      settingsSnapshot.forEach(d => { settingsData[d.id] = d.data(); });
      setSetSettings(settingsData);

      // --- NEW: Fetch Analytics ---
      // 1. Get total number of raters
      const ratersQuery = query(collection(db, "users"), where("role", "==", "rater"));
      const ratersSnap = await getDocs(ratersQuery);
      setTotalRaters(ratersSnap.size);

      // 2. Figure out how many unique users have attempted each set
      const subsSnap = await getDocs(collection(db, "rater_submissions"));
      const completions = {}; // Track unique user IDs per set
      subsSnap.forEach(d => {
        const data = d.data();
        if (data.taskGroup) {
          if (!completions[data.taskGroup]) completions[data.taskGroup] = new Set();
          completions[data.taskGroup].add(data.userId);
        }
      });
      const finalCompletions = {};
      Object.keys(completions).forEach(key => finalCompletions[key] = completions[key].size);
      setSetCompletions(finalCompletions);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const uniqueSets = [
    "Unassigned",
    ...new Set([
      ...Object.keys(setSettings),
      ...tasks.map((t) => t.group).filter((g) => g !== "Unassigned"),
    ]),
  ];
  const activeTasks = tasks.filter(t => t.group === activeSet);
  const availableTasks = tasks.filter(t => t.group !== activeSet && t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const activeSetData = setSettings[activeSet] || { isDeployed: false, attemptLimit: 1, answersRevealed: false };
  const completedCount = setCompletions[activeSet] || 0;
  const remainingCount = Math.max(0, totalRaters - completedCount);

  // --- EXAM OPERATIONS ---
  const toggleDeployment = async () => {
    if (activeTasks.length === 0) {
      await alertBox({
        title: "Cannot deploy set",
        message: "Add tasks before deploying.",
      });
      return;
    }

    const newStatus = !activeSetData.isDeployed;

    const confirmed = await confirmBox({
      title: newStatus ? "Deploy set?" : "Unpublish set?",
      message: newStatus
        ? `Deploy "${activeSet}" to raters now?`
        : `Unpublish "${activeSet}"?`,
    });

    if (!confirmed) return;

    const payload = { ...activeSetData, isDeployed: newStatus };
    await setDoc(doc(db, "exam_sets", activeSet), payload, { merge: true });
    setSetSettings((prev) => ({ ...prev, [activeSet]: payload }));
  };

  const toggleRevealAnswers = async () => {
    const newStatus = !activeSetData.answersRevealed;

    const confirmed = await confirmBox({
      title: newStatus ? "Reveal answers?" : "Hide answers?",
      message: newStatus
        ? `Reveal answers for "${activeSet}"? Raters who finished will be able to review their score.`
        : `Hide answers again for "${activeSet}"?`,
    });

    if (!confirmed) return;

    const payload = { ...activeSetData, answersRevealed: newStatus };
    await setDoc(doc(db, "exam_sets", activeSet), payload, { merge: true });
    setSetSettings((prev) => ({ ...prev, [activeSet]: payload }));
  };

  const updateAttemptLimit = async (limit) => {
    const payload = { ...activeSetData, attemptLimit: Number(limit) };
    await setDoc(doc(db, "exam_sets", activeSet), payload, { merge: true });
    setSetSettings(prev => ({ ...prev, [activeSet]: payload }));
  };

  // --- SET & TASK OPERATIONS ---
  const createNewSet = async () => {
    const newName = await promptBox({
      title: "Create new set",
      message: "Enter new Set Name:",
    });

    const trimmedName = newName?.trim();

    if (!trimmedName) return;

    if (uniqueSets.includes(trimmedName)) {
      await alertBox({
        title: "Set already exists",
        message: `"${trimmedName}" already exists. Please choose another name.`,
      });
      return;
    }

    await setDoc(doc(db, "exam_sets", trimmedName), {
      isDeployed: false,
      attemptLimit: 1,
      answersRevealed: false,
    });

    setSetSettings((prev) => ({
      ...prev,
      [trimmedName]: {
        isDeployed: false,
        attemptLimit: 1,
        answersRevealed: false,
      },
    }));

    setActiveSet(trimmedName);
  };

 const renameSet = async (oldName) => {
  if (oldName === "Unassigned") return;

  const newName = await promptBox({
    title: "Rename set",
    message: `Rename "${oldName}" to:`,
    defaultValue: oldName,
  });

  const trimmedName = newName?.trim();

  if (!trimmedName || trimmedName === oldName) return;

  if (uniqueSets.includes(trimmedName)) {
    await alertBox({
      title: "Set already exists",
      message: `"${trimmedName}" already exists. Please choose another name.`,
    });
    return;
  }

  const batch = writeBatch(db);

  tasks
    .filter((t) => t.group === oldName)
    .forEach((t) => {
      batch.update(doc(db, "tasks", t.id), { group: trimmedName });
    });

  await batch.commit();

  const oldSettings = setSettings[oldName] || {
    isDeployed: false,
    attemptLimit: 1,
    answersRevealed: false,
  };

  await setDoc(doc(db, "exam_sets", trimmedName), oldSettings);
  await deleteDoc(doc(db, "exam_sets", oldName));

  await fetchData();
  setActiveSet(trimmedName);
};

  const deleteSet = async (setName) => {
  if (setName === "Unassigned") return;

  const confirmed = await confirmBox({
    title: "Delete set?",
    message: `Delete "${setName}"? Tasks will move to Unassigned.`,
  });

  if (!confirmed) return;

  const batch = writeBatch(db);

  tasks
    .filter((t) => t.group === setName)
    .forEach((t) => {
      batch.update(doc(db, "tasks", t.id), { group: "Unassigned" });
    });

  await batch.commit();
  await deleteDoc(doc(db, "exam_sets", setName));

  await fetchData();
  setActiveSet("Unassigned");
};
const removeTaskFromSet = async (taskId) => {
  const confirmed = await confirmBox({
    title: "Remove question?",
    message: "Remove this question from the set? It will move to Unassigned.",
  });

  if (!confirmed) return;

  setTasks((prev) =>
    prev.map((t) => (t.id === taskId ? { ...t, group: "Unassigned" } : t))
  );

  await updateDoc(doc(db, "tasks", taskId), { group: "Unassigned" });
};

  const addSelectedTasksToSet = async () => {
    if (selectedToAdd.length === 0) return;
    const batch = writeBatch(db);
    selectedToAdd.forEach(id => batch.update(doc(db, "tasks", id), { group: activeSet }));
    await batch.commit();
    setTasks(prev => prev.map(t => selectedToAdd.includes(t.id) ? { ...t, group: activeSet } : t));
    setSelectedToAdd([]); setIsAddModalOpen(false);
  };

  const toggleSelectTask = (id) => setSelectedToAdd(prev => prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]);

  return (
    <div style={styles.layout}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>Your Sets</h2>
          <button onClick={createNewSet} style={styles.btnSmallAction}>➕ New</button>
        </div>
        <div style={styles.setList}>
          {uniqueSets.map(set => (
            <div key={set} style={activeSet === set ? styles.setItemActive : styles.setItem} onClick={() => setActiveSet(set)}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{set === "Unassigned" ? "📥" : "📁"}</span>
                <span style={{ fontWeight: activeSet === set ? "bold" : "normal" }}>{set} {setSettings[set]?.isDeployed && <span style={{ color: '#10b981', fontSize: '10px' }}>● LIVE</span>}</span>
                <span style={styles.countBadge}>{tasks.filter(t => t.group === set).length}</span>
              </div>
              {set !== "Unassigned" && (
                <div style={styles.setActions}>
                  <button onClick={(e) => { e.stopPropagation(); renameSet(set); }} style={styles.iconBtn}>✏️</button>
                  <button onClick={(e) => { e.stopPropagation(); deleteSet(set); }} style={styles.iconBtn}>🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      <main style={styles.mainContent}>
        <div style={styles.mainHeader}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", color: "#0f172a" }}>{activeSet === "Unassigned" ? "📥" : "📁"} {activeSet}</h1>
            <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>{activeTasks.length} questions in this set</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={fetchData} style={styles.btnSecondary}>Refresh</button>
            {activeSet !== "Unassigned" && <button onClick={() => setIsAddModalOpen(true)} style={{ ...styles.btnSecondary, color: '#3b82f6', borderColor: '#3b82f6' }}>➕ Add Questions to Set</button>}
          </div>
        </div>

        {/* --- PRO-LEVEL DEPLOYMENT PANEL --- */}
        {activeSet !== "Unassigned" && (
          <div style={styles.deploymentPanel}>

            {/* ZONE 1: Analytics */}
            <div style={styles.panelZoneAnalytics}>
              <div style={styles.statBox}>
                <div style={styles.statValue}>{totalRaters}</div>
                <div style={styles.statLabel}>Total Raters</div>
              </div>
              <div style={styles.statBox}>
                <div style={{ ...styles.statValue, color: '#10b981' }}>{completedCount}</div>
                <div style={styles.statLabel}>Started</div>
              </div>
              <div style={styles.statBox}>
                <div style={{ ...styles.statValue, color: '#f59e0b' }}>{remainingCount}</div>
                <div style={styles.statLabel}>Not Started</div>
              </div>
            </div>

            {/* ZONE 2: Configuration */}
            <div style={styles.panelZoneConfig}>
              <div style={styles.controlGroup}>
                <span style={styles.controlLabel}>Attempt Limit</span>
                <select style={styles.limitSelect} value={activeSetData.attemptLimit} onChange={(e) => updateAttemptLimit(e.target.value)} disabled={activeSetData.isDeployed}>
                  <option value={1}>Single Attempt</option>
                  <option value={2}>Two Attempts</option>
                  <option value={999}>Unlimited</option>
                </select>
              </div>

              <div style={styles.controlGroup}>
                <span style={styles.controlLabel}>Review Mode</span>
                <button
                  onClick={toggleRevealAnswers}
                  style={{
                    ...styles.btnReview,
                    backgroundColor: activeSetData.answersRevealed ? '#ecfdf5' : '#f8fafc',
                    borderColor: activeSetData.answersRevealed ? '#10b981' : '#cbd5e1',
                    color: activeSetData.answersRevealed ? '#059669' : '#475569'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{activeSetData.answersRevealed ? "👁️" : "🙈"}</span>
                  {activeSetData.answersRevealed ? "Revealed" : "Hidden"}
                </button>
              </div>
            </div>

            {/* ZONE 3: Master Action */}
            <div style={styles.panelZoneAction}>
              <div style={styles.statusPill}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: activeSetData.isDeployed ? '#10b981' : '#94a3b8' }}></div>
                <span style={{ fontWeight: 'bold', color: activeSetData.isDeployed ? '#10b981' : '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {activeSetData.isDeployed ? "Status: Live" : "Status: Draft"}
                </span>
              </div>
              <button
                onClick={toggleDeployment}
                style={activeSetData.isDeployed ? styles.btnUnpublish : styles.btnDeploy}
              >
                {activeSetData.isDeployed ? "🛑 Unpublish Set" : "🚀 Deploy to Raters"}
              </button>
            </div>

          </div>
        )}
        <div style={styles.taskGrid}>
          {loading ? <div style={styles.emptyState}>Loading tasks...</div> : activeTasks.length === 0 ? (
            <div style={styles.emptyState}><div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div><h3 style={{ margin: 0 }}>This set is empty</h3></div>
          ) : activeTasks.map(task => (
            <div key={task.id} style={styles.taskCard}>
              <div>
                <h4 style={{ margin: "0 0 4px 0", color: "#1e293b", fontSize: "15px" }}>{task.title}</h4>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "bold" }}>{task.type.replace(/_/g, ' ').toUpperCase()} • ID: {task.id.substring(0, 6)}</div>
              </div>
              {activeSet !== "Unassigned" && <button onClick={() => removeTaskFromSet(task.id)} style={styles.removeBtn}>✖</button>}
            </div>
          ))}
        </div>
      </main>

      {/* Modal - Same as previous */}
      {isAddModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px", marginBottom: "16px" }}>
              <h2 style={{ margin: 0 }}>Add to "{activeSet}"</h2>
              <button onClick={() => { setIsAddModalOpen(false); setSelectedToAdd([]); }} style={styles.iconBtn}>✖</button>
            </div>
            <input type="text" placeholder="🔍 Search questions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchInput} />
            <div style={styles.modalScrollArea}>
              {availableTasks.map(task => (
                <div key={task.id} style={{ ...styles.modalTaskCard, backgroundColor: selectedToAdd.includes(task.id) ? "#eff6ff" : "white", border: selectedToAdd.includes(task.id) ? "1px solid #3b82f6" : "1px solid #e2e8f0" }} onClick={() => toggleSelectTask(task.id)}>
                  <input type="checkbox" checked={selectedToAdd.includes(task.id)} readOnly style={{ cursor: "pointer" }} />
                  <div style={{ flex: 1 }}><div style={{ fontWeight: "bold", fontSize: "14px" }}>{task.title}</div><div style={{ fontSize: "11px", color: "#64748b" }}>{task.group !== "Unassigned" && <span style={{ color: "#ef4444" }}>Moving from: {task.group}</span>}</div></div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
              <span style={{ fontWeight: "bold", color: "#3b82f6" }}>{selectedToAdd.length} selected</span>
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => { setIsAddModalOpen(false); setSelectedToAdd([]); }} style={styles.btnSecondary}>Cancel</button>
                <button onClick={addSelectedTasksToSet} style={styles.btnPrimary} disabled={selectedToAdd.length === 0}>Add Questions</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const styles = {
  layout: { display: "flex", height: "100vh", backgroundColor: "#f8fafc", fontFamily: "system-ui" },
  sidebar: { width: "260px", backgroundColor: "white", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" },
  sidebarHeader: { padding: "20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" },
  setList: { flex: 1, padding: "10px" },
  setItem: { padding: "10px", borderRadius: "6px", cursor: "pointer", display: "flex", justifyContent: "space-between" },
  setItemActive: { padding: "10px", borderRadius: "6px", cursor: "pointer", display: "flex", justifyContent: "space-between", backgroundColor: "#eff6ff" },
  mainContent: { flex: 1, overflowY: "auto" },
  mainHeader: { padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  deploymentPanel: { margin: "0 32px", backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", alignItems: "stretch", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" },
  panelZoneAnalytics: { display: "flex", gap: "24px", padding: "20px 32px", backgroundColor: "#f9fafb", borderRight: "1px solid #e2e8f0" },
  panelZoneConfig: { flex: 1, display: "flex", gap: "24px", padding: "20px 32px", alignItems: "center" },
  panelZoneAction: { padding: "20px 32px", display: "flex", alignItems: "center", borderLeft: "1px solid #e2e8f0" },
  statBox: { textAlign: "center" },
  statValue: { fontSize: "24px", fontWeight: "900", color: "#1e293b" },
  statLabel: { fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: "800" },
  controlGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  controlLabel: { fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" },
  limitSelect: { padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" },
  btnReview: { padding: "8px 16px", borderRadius: "6px", border: "1px solid", fontWeight: "600", cursor: "pointer" },
  btnDeploy: { backgroundColor: "#10b981", color: "white", border: "none", padding: "10px 24px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  btnUnpublish: { backgroundColor: "#ef4444", color: "white", border: "none", padding: "10px 24px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  taskGrid: { padding: "32px", display: "flex", flexDirection: "column", gap: "12px" },
  taskCard: { backgroundColor: "white", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" },
  btnPrimary: { backgroundColor: "#3b82f6", color: "white", border: "none", padding: "10px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" },
  btnSecondary: { backgroundColor: "white", color: "#374151", border: "1px solid #d1d5db", padding: "10px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" },
  removeBtn: { backgroundColor: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer" },
  btnSmallAction: { backgroundColor: "#f0fdf4", color: "#15803d", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" },
  iconBtn: { background: "none", border: "none", cursor: "pointer" },
  countBadge: {
    backgroundColor: "#f1f5f9",
    color: "#64748b",
    borderRadius: "999px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: "bold",
  },

  setActions: {
    display: "flex",
    gap: "4px",
  },

  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginRight: "16px",
  },

  emptyState: {
    backgroundColor: "white",
    border: "1px dashed #cbd5e1",
    borderRadius: "8px",
    padding: "40px",
    textAlign: "center",
    color: "#64748b",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15,23,42,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  modalContent: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    width: "100%",
    maxWidth: "700px",
    maxHeight: "85vh",
    overflow: "hidden",
  },

  searchInput: {
    width: "100%",
    padding: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    marginBottom: "16px",
    boxSizing: "border-box",
  },

  modalScrollArea: {
    maxHeight: "50vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  modalTaskCard: {
    padding: "12px",
    borderRadius: "8px",
    display: "flex",
    gap: "12px",
    alignItems: "center",
    cursor: "pointer",
  },
};