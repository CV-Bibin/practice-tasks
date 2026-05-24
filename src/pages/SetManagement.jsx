import { useState, useEffect } from "react";
import { collection, getDocs, updateDoc, doc, writeBatch, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export default function SetManagement() {
  const [tasks, setTasks] = useState([]);
  const [setSettings, setSetSettings] = useState({}); // Stores deploy status & limits
  const [activeSet, setActiveSet] = useState("Unassigned");
  const [loading, setLoading] = useState(false);

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
      // 1. Fetch all tasks
      const querySnapshot = await getDocs(collection(db, "tasks"));
      const taskList = querySnapshot.docs.map(d => ({
        id: d.id,
        group: d.data().group || "Unassigned",
        type: d.data().taskType || "Unknown",
        title: d.data().taskData?.query || d.data().query || "Unnamed Task"
      }));
      setTasks(taskList);

      // 2. Fetch all Set Settings (Deployment status & Attempt Limits)
      const settingsSnapshot = await getDocs(collection(db, "exam_sets"));
      const settingsData = {};
      settingsSnapshot.forEach(d => {
        settingsData[d.id] = d.data();
      });
      setSetSettings(settingsData);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const uniqueSets = ["Unassigned", ...new Set(tasks.map(t => t.group).filter(g => g !== "Unassigned"))];
  const activeTasks = tasks.filter(t => t.group === activeSet);
  const availableTasks = tasks.filter(t => t.group !== activeSet && t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  // Get active settings or default them
  const activeSetData = setSettings[activeSet] || { isDeployed: false, attemptLimit: 1 };

  // --- EXAM / DEPLOYMENT OPERATIONS ---
  const toggleDeployment = async () => {
    if (activeTasks.length === 0) return alert("You cannot deploy an empty set! Add some tasks first.");
    
    const newStatus = !activeSetData.isDeployed;
    const confirmMsg = newStatus 
      ? `Deploy "${activeSet}" to raters now?` 
      : `Unpublish "${activeSet}"? Raters will no longer see it.`;
      
    if (window.confirm(confirmMsg)) {
      try {
        const payload = { ...activeSetData, isDeployed: newStatus };
        await setDoc(doc(db, "exam_sets", activeSet), payload, { merge: true });
        setSetSettings(prev => ({ ...prev, [activeSet]: payload }));
      } catch (error) {
        console.error("Deploy error:", error);
      }
    }
  };

  const updateAttemptLimit = async (limit) => {
    try {
      const payload = { ...activeSetData, attemptLimit: Number(limit) };
      await setDoc(doc(db, "exam_sets", activeSet), payload, { merge: true });
      setSetSettings(prev => ({ ...prev, [activeSet]: payload }));
    } catch (error) {
      console.error("Limit update error:", error);
    }
  };

  // --- SET OPERATIONS ---
  const createNewSet = async () => {
    const newName = window.prompt("Enter new Set Name (e.g., 'Batch A', 'Hard Tasks'):");
    if (newName && newName.trim() !== "") {
      const trimmed = newName.trim();
      if (!uniqueSets.includes(trimmed)) {
        // Initialize default settings in database
        await setDoc(doc(db, "exam_sets", trimmed), { isDeployed: false, attemptLimit: 1 });
        setSetSettings(prev => ({ ...prev, [trimmed]: { isDeployed: false, attemptLimit: 1 } }));
        setActiveSet(trimmed); 
      } else {
        alert("A set with this name already exists!");
      }
    }
  };

  const renameSet = async (oldName) => {
    if (oldName === "Unassigned") return alert("Cannot rename Unassigned.");
    const newName = window.prompt(`Rename "${oldName}" to:`, oldName);
    if (!newName || newName.trim() === "" || newName === oldName) return;

    try {
      const batch = writeBatch(db);
      tasks.filter(t => t.group === oldName).forEach(t => {
        batch.update(doc(db, "tasks", t.id), { group: newName.trim() });
      });
      await batch.commit();
      
      // Migrate settings
      const oldSettings = setSettings[oldName] || { isDeployed: false, attemptLimit: 1 };
      await setDoc(doc(db, "exam_sets", newName.trim()), oldSettings);
      await deleteDoc(doc(db, "exam_sets", oldName)); // Clean up old name
      
      fetchData(); // Refresh everything to sync state securely
      setActiveSet(newName.trim());
    } catch (error) {
      console.error("Error renaming set:", error);
    }
  };

  const deleteSet = async (setName) => {
    if (setName === "Unassigned") return;
    if (!window.confirm(`Are you sure you want to delete the set "${setName}"? \n\nAll tasks will be moved back to 'Unassigned'.`)) return;

    try {
      const batch = writeBatch(db);
      tasks.filter(t => t.group === setName).forEach(t => {
        batch.update(doc(db, "tasks", t.id), { group: "Unassigned" });
      });
      await batch.commit();
      await deleteDoc(doc(db, "exam_sets", setName)); // Delete settings
      
      fetchData();
      setActiveSet("Unassigned");
    } catch (error) {
      console.error("Error deleting set:", error);
    }
  };

  // --- TASK OPERATIONS ---
  const removeTaskFromSet = async (taskId) => {
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, group: "Unassigned" } : t));
      await updateDoc(doc(db, "tasks", taskId), { group: "Unassigned" });
    } catch (error) {
      console.error("Failed to remove task", error);
      fetchData(); 
    }
  };

  const addSelectedTasksToSet = async () => {
    if (selectedToAdd.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedToAdd.forEach(id => {
        batch.update(doc(db, "tasks", id), { group: activeSet });
      });
      await batch.commit();
      
      setTasks(prev => prev.map(t => selectedToAdd.includes(t.id) ? { ...t, group: activeSet } : t));
      setSelectedToAdd([]);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error("Error adding tasks:", error);
    }
  };

  const toggleSelectTask = (id) => {
    setSelectedToAdd(prev => prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]);
  };

  return (
    <div style={styles.layout}>
      
      {/* LEFT SIDEBAR: Set Navigation */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>Your Sets</h2>
          <button onClick={createNewSet} style={styles.btnSmallAction}>➕ New</button>
        </div>
        
        <div style={styles.setList}>
          {uniqueSets.map(set => {
            const isLive = setSettings[set]?.isDeployed;
            return (
              <div 
                key={set} 
                style={activeSet === set ? styles.setItemActive : styles.setItem}
                onClick={() => setActiveSet(set)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>{set === "Unassigned" ? "📥" : "📁"}</span>
                  <span style={{ fontWeight: activeSet === set ? "bold" : "normal" }}>
                    {set} {isLive && <span style={{ fontSize: '10px', color: '#10b981', marginLeft: '4px' }}>● LIVE</span>}
                  </span>
                  <span style={styles.countBadge}>{tasks.filter(t => t.group === set).length}</span>
                </div>
                
                {set !== "Unassigned" && (
                  <div style={styles.setActions}>
                    <button onClick={(e) => { e.stopPropagation(); renameSet(set); }} style={styles.iconBtn} title="Rename Set">✏️</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteSet(set); }} style={styles.iconBtn} title="Delete Set">🗑️</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* MAIN CONTENT: Tasks inside the active Set */}
      <main style={styles.mainContent}>
        <div style={styles.mainHeader}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              {activeSet === "Unassigned" ? "📥" : "📁"} {activeSet}
            </h1>
            <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>
              {activeTasks.length} questions in this set
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={fetchData} style={styles.btnSecondary}>Refresh</button>
            {activeSet !== "Unassigned" && (
              <button onClick={() => setIsAddModalOpen(true)} style={{...styles.btnSecondary, color: '#3b82f6', borderColor: '#3b82f6'}}>
                ➕ Add Questions to Set
              </button>
            )}
          </div>
        </div>

        {/* NEW: DEPLOYMENT SETTINGS PANEL */}
        {activeSet !== "Unassigned" && (
          <div style={styles.deploymentPanel}>
            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase" }}>Deployment Status</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: activeSetData.isDeployed ? "#10b981" : "#cbd5e1" }}></div>
                  <span style={{ fontWeight: "bold", color: activeSetData.isDeployed ? "#10b981" : "#64748b", fontSize: "16px" }}>
                    {activeSetData.isDeployed ? "Live & Visible to Raters" : "Draft Mode (Hidden)"}
                  </span>
                </div>
              </div>

              <div style={{ width: "1px", height: "40px", backgroundColor: "#cbd5e1" }}></div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase", marginBottom: "4px" }}>Rater Attempt Control</span>
                <select 
                  style={styles.limitSelect} 
                  value={activeSetData.attemptLimit} 
                  onChange={(e) => updateAttemptLimit(e.target.value)}
                  disabled={activeSetData.isDeployed} // Lock changes while live
                  title={activeSetData.isDeployed ? "Unpublish to change limits" : ""}
                >
                  <option value={1}>Single Attempt (Locks after 1)</option>
                  <option value={2}>Two Attempts (Locks after 2)</option>
                  <option value={999}>Unlimited Attempts (Practice Mode)</option>
                </select>
              </div>

            </div>

            {/* The Master Deploy Button */}
            <button 
              onClick={toggleDeployment} 
              style={activeSetData.isDeployed ? styles.btnUnpublish : styles.btnDeploy}
            >
              {activeSetData.isDeployed ? "🛑 Unpublish Set" : "🚀 Deploy to Raters"}
            </button>
          </div>
        )}

        <div style={styles.taskGrid}>
          {loading ? (
            <div style={styles.emptyState}>Loading tasks...</div>
          ) : activeTasks.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
              <h3 style={{ margin: 0, color: "#334155" }}>This set is empty</h3>
              {activeSet !== "Unassigned" && <p style={{ color: "#64748b" }}>Click "Add Questions" above to start building this set.</p>}
            </div>
          ) : (
            activeTasks.map(task => (
              <div key={task.id} style={styles.taskCard}>
                <div>
                  <h4 style={{ margin: "0 0 4px 0", color: "#1e293b", fontSize: "15px" }}>{task.title}</h4>
                  <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "bold" }}>
                    {task.type.replace(/_/g, ' ').toUpperCase()} • ID: {task.id.substring(0,6)}
                  </div>
                </div>
                {activeSet !== "Unassigned" && (
                  <button onClick={() => removeTaskFromSet(task.id)} style={styles.removeBtn} title="Remove from Set">✖</button>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* BULK ADD MODAL */}
      {isAddModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, color: "#0f172a" }}>Add to "{activeSet}"</h2>
              <button onClick={() => { setIsAddModalOpen(false); setSelectedToAdd([]); }} style={styles.iconBtn}>✖</button>
            </div>

            <input 
              type="text" 
              placeholder="🔍 Search questions by prompt or query..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />

            <div style={styles.modalScrollArea}>
              {availableTasks.length === 0 ? (
                <div style={styles.emptyState}>No other tasks available.</div>
              ) : (
                availableTasks.map(task => (
                  <div 
                    key={task.id} 
                    style={{ ...styles.modalTaskCard, backgroundColor: selectedToAdd.includes(task.id) ? "#eff6ff" : "white", border: selectedToAdd.includes(task.id) ? "1px solid #3b82f6" : "1px solid #e2e8f0" }}
                    onClick={() => toggleSelectTask(task.id)}
                  >
                    <input type="checkbox" checked={selectedToAdd.includes(task.id)} readOnly style={{ cursor: "pointer" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", color: "#1e293b", fontSize: "14px" }}>{task.title}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {task.type.replace(/_/g, ' ').toUpperCase()} 
                        {task.group !== "Unassigned" && <span style={{ color: "#ef4444" }}> • Moving from: {task.group}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
              <span style={{ fontWeight: "bold", color: "#3b82f6" }}>{selectedToAdd.length} selected</span>
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => { setIsAddModalOpen(false); setSelectedToAdd([]); }} style={styles.btnSecondary}>Cancel</button>
                <button onClick={addSelectedTasksToSet} style={styles.btnPrimary} disabled={selectedToAdd.length === 0}>
                  Add {selectedToAdd.length} Questions
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  layout: { display: "flex", height: "calc(100vh - 70px)", backgroundColor: "#f1f5f9", fontFamily: "system-ui, sans-serif" },
  
  // Sidebar
  sidebar: { width: "280px", backgroundColor: "white", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0 },
  sidebarHeader: { padding: "20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc" },
  setList: { flex: 1, overflowY: "auto", padding: "12px 8px" },
  setItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "6px", cursor: "pointer", color: "#475569", transition: "background 0.2s", marginBottom: "4px" },
  setItemActive: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "6px", cursor: "pointer", color: "#0369a1", backgroundColor: "#e0f2fe", marginBottom: "4px" },
  countBadge: { backgroundColor: "#e2e8f0", color: "#475569", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" },
  setActions: { display: "flex", gap: "4px" },
  
  // Main Content
  mainContent: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  mainHeader: { padding: "24px 32px", borderBottom: "1px solid #e2e8f0", backgroundColor: "white", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  
  // NEW: Deployment Panel
  deploymentPanel: { margin: "24px 32px 0 32px", padding: "20px", backgroundColor: "white", borderRadius: "8px", border: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  btnDeploy: { backgroundColor: "#10b981", color: "white", border: "none", padding: "12px 24px", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", boxShadow: "0 4px 6px rgba(16,185,129,0.3)", transition: "background 0.2s" },
  btnUnpublish: { backgroundColor: "#ef4444", color: "white", border: "none", padding: "12px 24px", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", boxShadow: "0 4px 6px rgba(239,68,68,0.3)" },
  limitSelect: { padding: "8px", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: "bold", color: "#334155", backgroundColor: "#f8fafc", cursor: "pointer" },

  taskGrid: { flex: 1, overflowY: "auto", padding: "24px 32px", display: "flex", flexDirection: "column", gap: "12px" },
  taskCard: { backgroundColor: "white", padding: "16px", borderRadius: "8px", border: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  emptyState: { textAlign: "center", padding: "48px 24px", color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center" },
  
  // Buttons & Inputs
  btnPrimary: { backgroundColor: "#3b82f6", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" },
  btnSecondary: { backgroundColor: "white", color: "#334155", border: "1px solid #cbd5e1", padding: "10px 20px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" },
  btnSmallAction: { backgroundColor: "#ecfdf5", color: "#10b981", border: "none", padding: "6px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" },
  iconBtn: { background: "transparent", border: "none", cursor: "pointer", fontSize: "14px", padding: "4px", opacity: 0.7 },
  removeBtn: { backgroundColor: "#fee2e2", color: "#ef4444", border: "none", width: "28px", height: "28px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", display: "flex", justifyContent: "center", alignItems: "center" },
  
  // Modal
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "white", padding: "24px", borderRadius: "12px", width: "100%", maxWidth: "600px", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" },
  searchInput: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "15px", marginBottom: "16px", boxSizing: "border-box", outline: "none" },
  modalScrollArea: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" },
  modalTaskCard: { padding: "12px", borderRadius: "6px", display: "flex", gap: "12px", alignItems: "center", cursor: "pointer", transition: "all 0.1s" }
};