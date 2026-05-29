import { useState, useEffect } from "react";
import { collection, getDocs, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { useDialog } from "../components/shared/CustomDialogProvider";

const getLat = (coords) => coords?.split(",")[0]?.trim() || "";
const getLng = (coords) => coords?.split(",")[1]?.trim() || "";

export default function QuestionManagement() {
  // Tabs now match your exact database 'taskType' strings
  const [activeTab, setActiveTab] = useState("search_2_0");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const { alertBox, confirmBox } = useDialog();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [unlockedFields, setUnlockedFields] = useState({});

  useEffect(() => {
    fetchQuestions(activeTab);
  }, [activeTab]);

  const fetchQuestions = async (taskType) => {
    setLoading(true);
    try {
      // PRO FIX: Now strictly filtering the database by the active tab!
      const q = query(collection(db, "tasks"), where("taskType", "==", taskType));
      const querySnapshot = await getDocs(q);
      
      const qList = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          rawDoc: data,
          displayTitle: data.taskData?.query || data.query || data.prompt || "Unnamed Task",
        };
      });

      setQuestions(qList);
    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      setLoading(false);
    }
  };

const deleteQuestion = async (questionId) => {
  const confirmed = await confirmBox({
    title: "Delete question?",
    message: "Are you sure you want to delete this question? This action cannot be undone.",
  });

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "tasks", questionId));
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));

    await alertBox({
      title: "Question deleted",
      message: "The question was deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting question:", error);

    await alertBox({
      title: "Delete failed",
      message: "Could not delete the question. Please try again.",
    });
  }
};

  const openEditModal = (task) => {
    const tData = task.rawDoc.taskData || {};
    setEditingTask({
      id: task.id,
      taskContext: {
        query: tData.query || "",
        viewportAge: tData.viewportAge || "FRESH",
        country: tData.country || "United States",
        locale: tData.locale || "en_US",
        viewportCoords: tData.viewportCenter ? `${tData.viewportCenter.lat}, ${tData.viewportCenter.lng}` : "",
        userCoords: tData.userLocation ? `${tData.userLocation.lat}, ${tData.userLocation.lng}` : "",
        aet: task.rawDoc.aetSeconds || 180,
        viewportSize: tData.viewportSizeOffset || 0.015,
        isNavigational: tData.isNavigational || "No",
      },
      results: (tData.results || []).map((r) => ({
        id: r.resultId,
        name: r.name || "",
        classification: r.classification || "",
        type: r.type || "Business/POI",
        address: r.address || "",
        coords: `${r.lat}, ${r.lng}`,
        unexpectedLanguage: r.goldStandard?.unexpectedLanguage || false,
        poiClosed: r.goldStandard?.poiClosed || false,
        relevance: r.goldStandard?.relevance || "",
        relUserIntent: r.goldStandard?.relUserIntent || false,
        relDistance: r.goldStandard?.relDistance || false,
        nameAcc: r.goldStandard?.nameAccuracy || "",
        nameIssue: r.goldStandard?.nameIssue || false,
        categoryIssue: r.goldStandard?.categoryIssue || false,
        addressAcc: r.goldStandard?.addressAccuracy || "",
        addrErrors: r.goldStandard?.addressErrors || { streetNum: false, unit: false, streetName: false, subLoc: false, loc: false, region: false, postal: false, country: false, notExist: false, lang: false, countrySpecific: false, other: false },
        pinAcc: r.goldStandard?.pinAccuracy || "",
      })),
    });
    setUnlockedFields({});
    setIsEditModalOpen(true);
  };

  const handleContextChange = (e) => {
    const { name, value } = e.target;
    let updates = { [name]: value };
    if (name === "country") updates.locale = value === "United States" ? "en_US" : "en_IND";
    setEditingTask((prev) => ({ ...prev, taskContext: { ...prev.taskContext, ...updates } }));
  };

  const handleResultChange = (id, field, value) => {
    setEditingTask((prev) => ({
      ...prev,
      results: prev.results.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    }));
  };

  const handleCheckboxToggle = (id, field) => {
    setEditingTask((prev) => ({
      ...prev,
      results: prev.results.map((r) => {
        if (r.id === id) {
          const newValue = !r[field];
          let updates = { [field]: newValue };
         if (field === "poiClosed" && newValue === true) {
  updates.nameAcc = "";
  updates.addressAcc = "";
  updates.pinAcc = "";
  updates.nameIssue = false;
  updates.categoryIssue = false;
  updates.addrErrors = {
    streetNum: false,
    unit: false,
    streetName: false,
    subLoc: false,
    loc: false,
    region: false,
    postal: false,
    country: false,
    notExist: false,
    lang: false,
    countrySpecific: false,
    other: false,
  };
}
          return { ...r, ...updates };
        }
        return r;
      }),
    }));
  };

  const handleAddrErrorToggle = (id, errorField) => {
    setEditingTask((prev) => ({
      ...prev,
      results: prev.results.map((r) => {
        if (r.id === id) {
          const newErrors = { ...r.addrErrors, [errorField]: !r.addrErrors[errorField] };
          let newPinAcc = r.pinAcc;
          if (errorField === "notExist" && newErrors.notExist === true) newPinAcc = "Can't Verify";
          return { ...r, addrErrors: newErrors, pinAcc: newPinAcc };
        }
        return r;
      }),
    }));
  };

  const saveEditedTask = async () => {
    try {
      const payload = {
        aetSeconds: Number(editingTask.taskContext.aet),
        "taskData.query": editingTask.taskContext.query,
        "taskData.viewportAge": editingTask.taskContext.viewportAge,
        "taskData.country": editingTask.taskContext.country,
        "taskData.locale": editingTask.taskContext.locale,
        "taskData.viewportSizeOffset": Number(editingTask.taskContext.viewportSize),
        "taskData.isNavigational": editingTask.taskContext.isNavigational,
        "taskData.viewportCenter": { lat: parseFloat(getLat(editingTask.taskContext.viewportCoords)), lng: parseFloat(getLng(editingTask.taskContext.viewportCoords)) },
        "taskData.userLocation": { lat: parseFloat(getLat(editingTask.taskContext.userCoords)), lng: parseFloat(getLng(editingTask.taskContext.userCoords)) },
        "taskData.results": editingTask.results.map((r) => ({
          resultId: r.id,
          name: r.name,
          classification: r.classification,
          type: r.type,
          address: r.address,
          lat: parseFloat(getLat(r.coords)),
          lng: parseFloat(getLng(r.coords)),
        goldStandard: {
  unexpectedLanguage: r.unexpectedLanguage,
  poiClosed: r.poiClosed,
  relevance: r.relevance,
  relUserIntent: r.relUserIntent,
  relDistance: r.relDistance,
  nameAccuracy: r.poiClosed ? null : r.nameAcc,
  nameIssue: r.poiClosed ? null : r.nameIssue,
  categoryIssue: r.poiClosed ? null : r.categoryIssue,
  addressAccuracy: r.poiClosed ? null : r.addressAcc,
  addressErrors: r.poiClosed ? null : r.addrErrors,
  pinAccuracy: r.poiClosed ? null : r.pinAcc,
},
        })),
      };

     await updateDoc(doc(db, "tasks", editingTask.id), payload);
await fetchQuestions(activeTab);
setIsEditModalOpen(false);

await alertBox({
  title: "Changes saved",
  message: "The question was updated successfully.",
});
   } catch (error) {
  console.error("Error saving task:", error);

  await alertBox({
    title: "Save failed",
    message: "Could not save the question changes. Please try again.",
  });
}
  };

  const toggleLock = (key) => setUnlockedFields((p) => ({ ...p, [key]: !p[key] }));
  const LockGroup = ({ lockKey, label, children }) => {
    const isUnlocked = unlockedFields[lockKey];
    return (
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <label style={styles.label}>{label}</label>
          <button type="button" onClick={() => toggleLock(lockKey)} style={{ ...styles.lockBtn, color: isUnlocked ? "#3b82f6" : "#9ca3af" }}>
            {isUnlocked ? "🔓 Unlocked" : "🔒 Locked"}
          </button>
        </div>
        <div style={{ opacity: isUnlocked ? 1 : 0.6, pointerEvents: isUnlocked ? "auto" : "none", transition: "all 0.2s" }}>
          {children}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "24px", backgroundColor: "#f9fafb", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2>Question Data Bank</h2>
        <button onClick={() => fetchQuestions(activeTab)} style={styles.submitBtn}>Refresh List</button>
      </div>

      <div style={styles.tabContainer}>
        <button style={activeTab === 'search_2_0' ? styles.activeTabBtn : styles.tabBtn} onClick={() => setActiveTab('search_2_0')}>Search 2.0 Tasks</button>
        <button style={activeTab === 'auto_complete' ? styles.activeTabBtn : styles.tabBtn} onClick={() => setActiveTab('auto_complete')}>Auto Complete Tasks</button>
        <button style={activeTab === 'poi_eval' ? styles.activeTabBtn : styles.tabBtn} onClick={() => setActiveTab('poi_eval')}>POI Tasks</button>
      </div>

      <div style={styles.sectionCard}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>
              <th style={{ padding: "12px", width: "100px" }}>ID</th>
              <th style={{ padding: "12px" }}>Task Query / Prompt</th>
              <th style={{ padding: "12px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="3" style={{ padding: "24px", textAlign: "center" }}>Loading...</td></tr> : questions.length > 0 ? (
              questions.map((q) => (
                <tr key={q.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px", color: "#6b7280", fontSize: "12px" }}>{q.id.substring(0, 8)}...</td>
                  <td style={{ padding: "12px" }}><strong>{q.displayTitle}</strong></td>
                  <td style={{ padding: "12px", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button onClick={() => openEditModal(q)} style={{ ...styles.btnAction, backgroundColor: "#3b82f6" }}>Edit Data</button>
                    <button onClick={() => deleteQuestion(q.id)} style={{ ...styles.btnAction, backgroundColor: "#ef4444" }}>Delete</button>
                  </td>
                </tr>
              ))
            ) : <tr><td colSpan="3" style={{ padding: "24px", textAlign: "center" }}>No {activeTab} tasks found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* EDIT MODAL REMAINS EXACTLY THE SAME AS PREVIOUS VERSION */}
      {isEditModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px", marginBottom: "16px" }}>
              <h2 style={styles.sectionTitle}>Edit Task & Gold Answers</h2>
              <button onClick={() => setIsEditModalOpen(false)} style={styles.removeBtn}>Close ✖</button>
            </div>

            <div style={{ overflowY: "auto", paddingRight: "8px", flex: 1 }}>
              <div style={styles.sectionCard}>
                <h3 style={styles.subHeading}>1. User & Viewport Context</h3>
                <div style={styles.grid2Col}>
                  <LockGroup lockKey="ctx_query" label="User Query">
                    <input style={styles.input} name="query" value={editingTask.taskContext.query} onChange={handleContextChange} />
                  </LockGroup>
                  <LockGroup lockKey="ctx_aet" label="AET (Seconds)">
                    <input type="number" style={styles.input} name="aet" value={editingTask.taskContext.aet} onChange={handleContextChange} />
                  </LockGroup>
                  <LockGroup lockKey="ctx_viewportAge" label="Viewport Age">
  <select
    style={styles.select}
    name="viewportAge"
    value={editingTask.taskContext.viewportAge}
    onChange={handleContextChange}
  >
    <option value="FRESH">Fresh</option>
    <option value="STALE">Stale</option>
  </select>
</LockGroup>

<LockGroup lockKey="ctx_isNavigational" label="Is there a navigational result?">
  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
    <label style={styles.checkboxItem}>
      <input
        type="radio"
        name="isNavigational"
        value="Yes"
        checked={editingTask.taskContext.isNavigational === "Yes"}
        onChange={handleContextChange}
      />
      Yes
    </label>

    <label style={styles.checkboxItem}>
      <input
        type="radio"
        name="isNavigational"
        value="No"
        checked={editingTask.taskContext.isNavigational === "No"}
        onChange={handleContextChange}
      />
      No
    </label>
  </div>
</LockGroup>
                  <LockGroup lockKey="ctx_location" label="Country & Locale">
                    <div style={{ display: "flex", gap: "8px" }}>
                      <select style={styles.select} name="country" value={editingTask.taskContext.country} onChange={handleContextChange}>
                        <option value="United States">United States</option><option value="India">India</option>
                      </select>
                      <select style={styles.select} name="locale" value={editingTask.taskContext.locale} onChange={handleContextChange}>
                        <option value="en_US">en_US</option><option value="en_IND">en_IND</option><option value="mal_IND">mal_IND</option>
                      </select>
                    </div>
                  </LockGroup>
                  <LockGroup lockKey="ctx_coords" label="Viewport & User Coords (Lat, Lng)">
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input style={styles.input} name="viewportCoords" value={editingTask.taskContext.viewportCoords} onChange={handleContextChange} />
                      <input style={styles.input} name="userCoords" value={editingTask.taskContext.userCoords} onChange={handleContextChange} />
                    </div>
                  </LockGroup>
                </div>
              </div>

              <div style={styles.sectionCard}>
                <h3 style={styles.subHeading}>2. Result Data & Gold Answers</h3>
                {editingTask.results.map((res, index) => (
                  <div key={res.id} style={styles.resultCard}>
                    <h4 style={{ margin: "0 0 16px 0", color: "#1e293b" }}>Result #{res.id}</h4>
                    <LockGroup lockKey={`res_${res.id}_info`} label="Result Info">
                      <div style={{ ...styles.grid2Col, marginBottom: "12px" }}>
                        <div style={{ gridColumn: "span 2" }}>
                          <input style={styles.input} value={res.name} onChange={(e) => handleResultChange(res.id, "name", e.target.value)} placeholder="Result Name" />
                        </div>
                        <input style={styles.input} value={res.classification} onChange={(e) => handleResultChange(res.id, "classification", e.target.value)} placeholder="Classification" />
                        <select style={styles.select} value={res.type} onChange={(e) => handleResultChange(res.id, "type", e.target.value)}>
                          <option value="Business/POI">Business/POI</option><option value="Address">Address</option>
                        </select>
                        <div style={{ gridColumn: "span 2" }}>
                          <textarea style={styles.textarea} value={res.address} onChange={(e) => handleResultChange(res.id, "address", e.target.value)} placeholder="Address" />
                        </div>
                        <div style={{ gridColumn: "span 2" }}>
                          <input style={styles.input} value={res.coords} onChange={(e) => handleResultChange(res.id, "coords", e.target.value)} placeholder="Lat, Lng" />
                        </div>
                      </div>
                    </LockGroup>

                    <LockGroup lockKey={`res_${res.id}_flags`} label="POI Status Flags">
                      <label style={styles.checkboxItem}><input type="checkbox" checked={res.unexpectedLanguage} onChange={() => handleCheckboxToggle(res.id, "unexpectedLanguage")} /> Unexpected language/script</label>
                      <label style={{ ...styles.checkboxItem, fontWeight: "bold" }}><input type="checkbox" checked={res.poiClosed} onChange={() => handleCheckboxToggle(res.id, "poiClosed")} /> POI is closed or does not exist</label>
                    </LockGroup>

                    <LockGroup lockKey={`res_${res.id}_rel`} label="Relevance Grading">
                      <select style={styles.select} value={res.relevance} onChange={(e) => handleResultChange(res.id, "relevance", e.target.value)}>
                        <option value="" disabled hidden>Select...</option>
                        <option value="Navigational">Navigational</option><option value="Excellent">Excellent</option><option value="Good">Good</option><option value="Acceptable">Acceptable</option><option value="Bad">Bad</option>
                      </select>
                      {["Good", "Acceptable", "Bad"].includes(res.relevance) && (
                        <div style={styles.indentedBlock}>
                          <label style={styles.checkboxItem}><input type="checkbox" checked={res.relUserIntent} onChange={() => handleCheckboxToggle(res.id, "relUserIntent")} /> User intent issue</label>
                          <label style={styles.checkboxItem}><input type="checkbox" checked={res.relDistance} onChange={() => handleCheckboxToggle(res.id, "relDistance")} /> Distance/Prominence issue</label>
                        </div>
                      )}
                    </LockGroup>

                    <LockGroup lockKey={`res_${res.id}_nameAcc`} label="Name Accuracy">
                      <div style={{ opacity: res.poiClosed ? 0.5 : 1 }}>
                        <select style={styles.select} disabled={res.poiClosed} value={res.nameAcc} onChange={(e) => handleResultChange(res.id, "nameAcc", e.target.value)}>
                          <option value="" disabled hidden>Select...</option>
                          <option value="n/a">n/a</option><option value="Correct">Correct</option><option value="Partially Correct">Partially Correct</option><option value="Incorrect">Incorrect</option><option value="Can't Verify">Can't Verify</option>
                        </select>
                        {(res.nameAcc === "Incorrect" || res.nameAcc === "Partially Correct") && !res.poiClosed && (
                          <div style={styles.indentedBlock}>
                            <label style={styles.checkboxItem}><input type="checkbox" checked={res.nameIssue} onChange={() => handleCheckboxToggle(res.id, "nameIssue")} /> Name Issue</label>
                            <label style={styles.checkboxItem}><input type="checkbox" checked={res.categoryIssue} onChange={() => handleCheckboxToggle(res.id, "categoryIssue")} /> Category Issue</label>
                          </div>
                        )}
                      </div>
                    </LockGroup>

                    <LockGroup lockKey={`res_${res.id}_addrAcc`} label="Address Accuracy">
                      <div style={{ opacity: res.poiClosed ? 0.5 : 1 }}>
                        <select style={styles.select} disabled={res.poiClosed} value={res.addressAcc} onChange={(e) => handleResultChange(res.id, "addressAcc", e.target.value)}>
                          <option value="" disabled hidden>Select...</option>
                          <option value="Correct">Correct</option><option value="Correct with formatting issue">Correct with formatting issue</option><option value="Incorrect">Incorrect</option><option value="Can't Verify">Can't Verify</option>
                        </select>
                        {res.addressAcc === "Incorrect" && !res.poiClosed && (
                          <div style={{ ...styles.indentedBlock, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                            {[
                              { key: "streetNum", label: "Street Number" }, { key: "unit", label: "Unit/Apt" }, { key: "streetName", label: "Street Name" },
                              { key: "subLoc", label: "Sub-Locality" }, { key: "loc", label: "Locality" }, { key: "region", label: "Region/State" },
                              { key: "postal", label: "Postal Code" }, { key: "country", label: "Country" }, { key: "notExist", label: "Address does not exist" },
                              { key: "lang", label: "Language/Script issue" }, { key: "countrySpecific", label: "Country specific" }, { key: "other", label: "Other Issue" },
                            ].map((error) => (
                              <label key={error.key} style={styles.checkboxItem}>
                                <input type="checkbox" checked={res.addrErrors[error.key]} onChange={() => handleAddrErrorToggle(res.id, error.key)} /> {error.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </LockGroup>

                    <LockGroup lockKey={`res_${res.id}_pinAcc`} label="Pin Accuracy">
                      <div style={{ opacity: res.poiClosed ? 0.5 : 1 }}>
                        <select style={styles.select} disabled={res.poiClosed} value={res.pinAcc} onChange={(e) => handleResultChange(res.id, "pinAcc", e.target.value)}>
                          <option value="" disabled hidden>Select...</option>
                          <option value="Perfect">Perfect</option><option value="Approximate">Approximate</option><option value="Next Door">Next Door</option><option value="Wrong">Wrong</option><option value="Can't Verify">Can't Verify</option>
                        </select>
                      </div>
                    </LockGroup>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setIsEditModalOpen(false)} style={{ ...styles.submitBtn, backgroundColor: "#64748b", width: "auto" }}>Cancel</button>
              <button onClick={saveEditedTask} style={{ ...styles.submitBtn, width: "auto" }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  tabContainer: { display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "2px solid #e5e7eb", paddingBottom: "8px" },
  tabBtn: { padding: "10px 20px", backgroundColor: "transparent", border: "none", color: "#6b7280", fontSize: "15px", fontWeight: "bold", cursor: "pointer", borderRadius: "6px 6px 0 0" },
  activeTabBtn: { padding: "10px 20px", backgroundColor: "#e0f2fe", border: "none", color: "#0369a1", fontSize: "15px", fontWeight: "bold", cursor: "pointer", borderRadius: "6px 6px 0 0", borderBottom: "3px solid #0284c7" },
  sectionCard: { backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0", marginBottom: "20px" },
  grid2Col: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  sectionTitle: { margin: "0", fontSize: "20px", color: "#0f172a" },
  subHeading: { margin: "0 0 16px 0", fontSize: "16px", color: "#1e293b", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" },
  label: { fontSize: "13px", fontWeight: "600", color: "#475569", display: "block" },
  input: { padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", width: "100%", boxSizing: "border-box" },
  textarea: { padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", width: "100%", boxSizing: "border-box", minHeight: "60px", resize: "vertical" },
  select: { padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", backgroundColor: "white", width: "100%", boxSizing: "border-box" },
  resultCard: { backgroundColor: "#f8fafc", padding: "20px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "16px" },
  checkboxItem: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#475569", cursor: "pointer", marginBottom: "6px" },
  indentedBlock: { paddingLeft: "16px", borderLeft: "2px solid #cbd5e1", marginLeft: "8px", marginTop: "8px", paddingTop: "4px" },
  submitBtn: { backgroundColor: "#22c55e", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", fontSize: "14px", fontWeight: "bold", cursor: "pointer" },
  removeBtn: { backgroundColor: "transparent", border: "none", color: "#ef4444", fontSize: "13px", cursor: "pointer", fontWeight: "bold" },
  btnAction: { padding: "8px 16px", color: "white", border: "none", borderRadius: "4px", fontSize: "13px", cursor: "pointer", fontWeight: "bold" },
  lockBtn: { background: "none", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "bold", padding: "4px 8px", borderRadius: "4px", backgroundColor: "#f1f5f9" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "24px" },
  modalContent: { backgroundColor: "#f1f5f9", padding: "32px", borderRadius: "12px", width: "100%", maxWidth: "850px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }
};