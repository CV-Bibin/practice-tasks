import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";

// Import the decoupled map component and helpers
import TaskMapPreview, { getLat, getLng, pinColors } from "../shared/TaskMapPreview";

export default function CreateSearch20Task() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Context State with Country & Locale
  const [taskContext, setTaskContext] = useState({
    query: "",
    viewportAge: "FRESH",
    country: "United States",
    locale: "en_US",
    viewportCoords: "",
    userCoords: "",
    aet: "180",
    viewportSize: 0.015,
    isNavigational: "No",
  });

  // Result State with Classification, Type, and the RESTORED poiClosed checkbox
  const initialResultState = {
    id: 1,
    name: "",
    classification: "", 
    type: "Business/POI", 
    address: "",
    coords: "",
    unexpectedLanguage: false,
    poiClosed: false, // Restored!
    relevance: "",
    relUserIntent: false,
    relDistance: false,
    nameAcc: "",
    nameIssue: false,
    categoryIssue: false,
    addressAcc: "",
    addrErrors: {
      streetNum: false, unit: false, streetName: false, subLoc: false, loc: false, region: false, postal: false, country: false, notExist: false, lang: false, countrySpecific: false, other: false,
    },
    pinAcc: "",
  };

  const [results, setResults] = useState([{ ...initialResultState }]);

  // Handle smart Country/Locale switching
  const handleContextChange = (e) => {
    const { name, value } = e.target;
    let updates = { [name]: value };

    // If Country changes, auto-update the Locale
    if (name === "country") {
      updates.locale = value === "United States" ? "en_US" : "en_IND";
    }

    setTaskContext({ ...taskContext, ...updates });
  };

  const handleResultChange = (id, field, value) => {
    setResults(
      results.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleCheckboxToggle = (id, field) => {
    setResults(
      results.map((r) => {
        if (r.id === id) {
          const newValue = !r[field];
          let updates = { [field]: newValue };

          // Restored POI Closed wipe logic
          if (field === "poiClosed" && newValue === true) {
            updates.nameAcc = "";
            updates.addressAcc = "";
            updates.pinAcc = "";
            updates.nameIssue = false;
            updates.categoryIssue = false;
          }

          return { ...r, ...updates };
        }
        return r;
      }),
    );
  };

  const handleAddrErrorToggle = (id, errorField) => {
    setResults(
      results.map((r) => {
        if (r.id === id) {
          const newErrors = { ...r.addrErrors, [errorField]: !r.addrErrors[errorField] };
          let newPinAcc = r.pinAcc;
          if (errorField === "notExist" && newErrors.notExist === true) {
            newPinAcc = "Can't Verify";
          }
          return { ...r, addrErrors: newErrors, pinAcc: newPinAcc };
        }
        return r;
      }),
    );
  };

  const addResult = () => {
    if (results.length < 5)
      setResults([...results, { ...initialResultState, id: results.length + 1 }]);
  };

  const removeResult = (id) => {
    const filtered = results.filter((r) => r.id !== id);
    setResults(filtered.map((r, index) => ({ ...r, id: index + 1 })));
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        taskType: "search_2_0",
        aetSeconds: Number(taskContext.aet),
        createdAt: serverTimestamp(),
        taskData: {
          query: taskContext.query,
          viewportAge: taskContext.viewportAge,
          country: taskContext.country,
          locale: taskContext.locale,
          viewportSizeOffset: Number(taskContext.viewportSize),
          viewportCenter: {
            lat: parseFloat(getLat(taskContext.viewportCoords)),
            lng: parseFloat(getLng(taskContext.viewportCoords)),
          },
          userLocation: {
            lat: parseFloat(getLat(taskContext.userCoords)),
            lng: parseFloat(getLng(taskContext.userCoords)),
          },
          isNavigational: taskContext.isNavigational,
          results: results.map((r) => ({
            resultId: r.id,
            name: r.name,
            classification: r.classification,
            type: r.type,
            address: r.address,
            lat: parseFloat(getLat(r.coords)),
            lng: parseFloat(getLng(r.coords)),
            goldStandard: {
              unexpectedLanguage: r.unexpectedLanguage,
              poiClosed: r.poiClosed, // Restored
              relevance: r.relevance,
              relUserIntent: r.relUserIntent,
              relDistance: r.relDistance,
              nameAccuracy: r.nameAcc,
              nameIssue: r.nameIssue,
              categoryIssue: r.categoryIssue,
              addressAccuracy: r.addressAcc,
              addressErrors: r.addrErrors,
              pinAccuracy: r.pinAcc,
            },
          })),
        },
      };
      
      const docRef = await addDoc(collection(db, "tasks"), payload);
      alert(`Task successfully added! Unique Task ID: ${docRef.id}`);

      setTaskContext({
        query: "", viewportAge: "FRESH", country: "United States", locale: "en_US", viewportCoords: "", userCoords: "", aet: "180", viewportSize: 0.015, isNavigational: "No",
      });
      setResults([{ ...initialResultState }]);
    } catch (error) {
      alert(`Error adding task: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleCreateTask} style={styles.formLayout}>
      {/* LEFT COLUMN */}
      <div style={styles.leftScrollColumn}>
        <div style={styles.headerBlock}>
          <h2 style={styles.sectionTitle}>Create Search 2.0 Task</h2>
          <p style={styles.helpText}>Configure the viewport, define context, and set gold answers.</p>
        </div>

        {/* Section 1: Context */}
        <div style={styles.sectionCard}>
          <h3 style={styles.subHeading}>1. User & Viewport Context</h3>

          <div style={styles.grid2Col}>
            <div>
              <label style={styles.label}>User Query</label>
              <input required style={styles.input} name="query" value={taskContext.query} onChange={handleContextChange} placeholder="e.g. Starbucks near me" />
            </div>
            <div>
              <label style={styles.label}>Viewport Age</label>
              <select style={styles.select} name="viewportAge" value={taskContext.viewportAge} onChange={handleContextChange}>
                <option value="FRESH">Fresh</option>
                <option value="STALE">Stale</option>
              </select>
            </div>

            {/* Smart Country Dropdown */}
            <div>
              <label style={styles.label}>Country</label>
              <select style={styles.select} name="country" value={taskContext.country} onChange={handleContextChange}>
                <option value="United States">United States</option>
                <option value="India">India</option>
              </select>
            </div>

            {/* Smart Locale Dropdown */}
            <div>
              <label style={styles.label}>Locale</label>
              <select style={styles.select} name="locale" value={taskContext.locale} onChange={handleContextChange}>
                {taskContext.country === "United States" ? (
                  <option value="en_US">en_US</option>
                ) : (
                  <>
                    <option value="en_IND">en_IND</option>
                    <option value="mal_IND">mal_IND</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label style={styles.label}>Viewport Center (Lat, Lng)</label>
              <input required style={styles.input} name="viewportCoords" value={taskContext.viewportCoords} onChange={handleContextChange} placeholder="e.g. 10.2605, 76.9270" />
            </div>
            <div>
              <label style={styles.label}>User Location (Lat, Lng)</label>
              <input required style={styles.input} name="userCoords" value={taskContext.userCoords} onChange={handleContextChange} placeholder="e.g. 10.2605, 76.9270" />
            </div>
          </div>

          <label style={{ ...styles.label, marginTop: "16px" }}>Viewport Bounding Box Size (Offset)</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input type="range" min="0.001" max="2" step="0.001" name="viewportSize" value={taskContext.viewportSize} onChange={handleContextChange} style={{ flex: 1 }} />
            <span style={{ fontSize: "13px", fontWeight: "bold" }}>{taskContext.viewportSize}</span>
          </div>
        </div>

        {/* Section 2: Results */}
        <div style={styles.sectionCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ ...styles.subHeading, margin: 0 }}>2. Result Data & Gold Answers ({results.length}/5)</h3>
          </div>

          <div style={{ marginBottom: "24px", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
            <label style={styles.label}>Is there a navigational result for this query?</label>
            <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
              <label style={styles.radioLabel}><input type="radio" name="isNavigational" value="Yes" checked={taskContext.isNavigational === "Yes"} onChange={handleContextChange}/> Yes</label>
              <label style={styles.radioLabel}><input type="radio" name="isNavigational" value="No" checked={taskContext.isNavigational === "No"} onChange={handleContextChange}/> No</label>
            </div>
          </div>

          {results.map((res, index) => {
             return (
            <div key={res.id} style={{ ...styles.resultCard, borderLeft: `6px solid ${pinColors[index]}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <strong style={{ color: pinColors[index], fontSize: "16px" }}>Result #{res.id}</strong>
                {results.length > 1 && <button type="button" onClick={() => removeResult(res.id)} style={styles.removeBtn}>Remove</button>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: '1fr 1fr', gap: "12px", marginBottom: "16px" }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={styles.label}>Result Name</label>
                  <input required style={styles.input} placeholder="e.g. Starbucks" value={res.name} onChange={(e) => handleResultChange(res.id, "name", e.target.value)} />
                </div>
                
                <div>
                  <label style={styles.label}>Classification</label>
                  <input required style={styles.input} placeholder="e.g. Ice Cream Shop" value={res.classification} onChange={(e) => handleResultChange(res.id, "classification", e.target.value)} />
                </div>

                <div>
                  <label style={styles.label}>Type</label>
                  <select style={styles.select} value={res.type} onChange={(e) => handleResultChange(res.id, "type", e.target.value)}>
                    <option value="Business/POI">Business/POI</option>
                    <option value="Address">Address</option>
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={styles.label}>Result Address</label>
                  <textarea required style={styles.textarea} placeholder="Paste full address here..." value={res.address} onChange={(e) => handleResultChange(res.id, "address", e.target.value)} />
                </div>
                
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={styles.label}>Result Pin (Lat, Lng)</label>
                  <input required style={styles.input} placeholder="e.g. 10.2605, 76.9270" value={res.coords} onChange={(e) => handleResultChange(res.id, "coords", e.target.value)} />
                </div>
              </div>

              {/* RESTORED CHECKBOXES */}
              <div style={{ marginTop: '16px', marginBottom: '20px' }}>
                <label style={styles.checkboxItem}>
                  <input type="checkbox" checked={res.unexpectedLanguage} onChange={() => handleCheckboxToggle(res.id, "unexpectedLanguage")} /> Result name/title is in unexpected language or script
                </label>
                <label style={{ ...styles.checkboxItem, fontWeight: 'bold' }}>
                  <input type="checkbox" checked={res.poiClosed} onChange={() => handleCheckboxToggle(res.id, "poiClosed")} /> Business/POI is closed or does not exist
                </label>
              </div>

              {/* Relevance Grading */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Relevance</label>
                <select required style={styles.select} value={res.relevance} onChange={(e) => handleResultChange(res.id, "relevance", e.target.value)}>
                  <option value="" disabled hidden>Select...</option>
                  <option value="Navigational">Navigational</option><option value="Excellent">Excellent</option><option value="Good">Good</option><option value="Acceptable">Acceptable</option><option value="Bad">Bad</option>
                </select>
                {["Good", "Acceptable", "Bad"].includes(res.relevance) && (
                  <div style={styles.indentedBlock}>
                    <label style={styles.checkboxItem}><input type="checkbox" checked={res.relUserIntent} onChange={() => handleCheckboxToggle(res.id, "relUserIntent")} /> User intent issue</label>
                    <label style={styles.checkboxItem}><input type="checkbox" checked={res.relDistance} onChange={() => handleCheckboxToggle(res.id, "relDistance")} /> Distance/Prominence issue</label>
                  </div>
                )}
              </div>

              {/* Accuracy Dropdowns (Fade if POI is Closed) */}
              <div style={{ ...styles.formGroup, opacity: res.poiClosed ? 0.5 : 1 }}>
                <label style={styles.label}>Name and Category Accuracy</label>
                <select required={!res.poiClosed} disabled={res.poiClosed} style={styles.select} value={res.nameAcc} onChange={(e) => handleResultChange(res.id, "nameAcc", e.target.value)}>
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

              <div style={{ ...styles.formGroup, opacity: res.poiClosed ? 0.5 : 1 }}>
                <label style={styles.label}>Address Accuracy</label>
                <select required={!res.poiClosed} disabled={res.poiClosed} style={styles.select} value={res.addressAcc} onChange={(e) => handleResultChange(res.id, "addressAcc", e.target.value)}>
                  <option value="" disabled hidden>Select...</option>
                  <option value="Correct">Correct</option><option value="Correct with formatting issue">Correct with formatting issue</option><option value="Incorrect">Incorrect</option><option value="Can't Verify">Can't Verify</option>
                </select>
                {res.addressAcc === "Incorrect" && !res.poiClosed && (
                  <div style={{ ...styles.indentedBlock, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                    {[
                      { key: "streetNum", label: "Street Number" }, { key: "unit", label: "Unit/Apt" }, { key: "streetName", label: "Street Name" },
                      { key: "subLoc", label: "Sub-Locality" }, { key: "loc", label: "Locality" }, { key: "region", label: "Region/State" },
                      { key: "postal", label: "Postal Code" }, { key: "country", label: "Country" }, { key: "notExist", label: "Address does not exist" },
                      { key: "lang", label: "Language/Script issue" }, { key: "countrySpecific", label: "Country specific issue" }, { key: "other", label: "Other Issue" },
                    ].map((error) => (
                      <label key={error.key} style={styles.checkboxItem}>
                        <input type="checkbox" checked={res.addrErrors[error.key]} onChange={() => handleAddrErrorToggle(res.id, error.key)} /> {error.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ ...styles.formGroup, opacity: res.poiClosed ? 0.5 : 1 }}>
                <label style={styles.label}>Pin Accuracy</label>
                <select required={!res.poiClosed} disabled={res.poiClosed} style={styles.select} value={res.pinAcc} onChange={(e) => handleResultChange(res.id, "pinAcc", e.target.value)}>
                  <option value="" disabled hidden>Select...</option>
                  <option value="Perfect">Perfect</option><option value="Approximate">Approximate</option><option value="Next Door">Next Door</option><option value="Wrong">Wrong</option><option value="Can't Verify">Can't Verify</option>
                </select>
              </div>
            </div>
            );
          })}

          {results.length < 5 && (
            <button type="button" onClick={addResult} style={styles.addBtn}>+ Add Another Result</button>
          )}

          <div style={{ marginTop: "32px" }}>
            <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
              {isSubmitting ? "Saving Task to Database..." : "Deploy Task to Raters"}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Sticky Map */}
      <div style={styles.rightStickyColumn}>
        <div style={styles.stickyMapWrapper}>
          <div style={styles.mapHeader}>
            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#1e293b" }}>Live Map Verification</span>
          </div>
          <div style={{ flex: 1, position: "relative" }}>
            <TaskMapPreview userCoords={taskContext.userCoords} viewportCoords={taskContext.viewportCoords} viewportSize={taskContext.viewportSize} results={results} />
          </div>
        </div>
      </div>
    </form>
  );
}

const styles = {
  formLayout: { display: "flex", gap: "24px", alignItems: "flex-start", position: "relative" },
  leftScrollColumn: { flex: "1.2", display: "flex", flexDirection: "column", gap: "24px" },
  headerBlock: { paddingBottom: "8px", borderBottom: "1px solid #e2e8f0" },
  sectionTitle: { margin: "0 0 4px 0", fontSize: "24px", color: "#0f172a" },
  helpText: { margin: 0, color: "#64748b", fontSize: "14px" },
  sectionCard: { backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0" },
  rightStickyColumn: { flex: "1", position: "sticky", top: "0", height: "calc(100vh - 120px)", minHeight: "600px" },
  stickyMapWrapper: { height: "100%", display: "flex", flexDirection: "column", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", border: "1px solid #cbd5e1", overflow: "hidden" },
  mapHeader: { padding: "12px 16px", backgroundColor: "#f1f5f9", borderBottom: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center" },
  grid2Col: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  subHeading: { margin: "0 0 16px 0", fontSize: "18px", color: "#1e293b" },
  label: { fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "4px", display: "block" },
  radioLabel: { fontSize: "14px", color: "#334155", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" },
  input: { padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", width: "100%", boxSizing: "border-box" },
  textarea: { padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", width: "100%", boxSizing: "border-box", minHeight: "80px", fontFamily: "inherit", resize: "vertical" },
  select: { padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", backgroundColor: "white", width: "100%", boxSizing: "border-box" },
  resultCard: { backgroundColor: "#ffffff", padding: "20px", borderRadius: "6px", border: "1px solid #e2e8f0", marginBottom: "16px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" },
  formGroup: { marginTop: "16px" },
  checkboxItem: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#475569", cursor: "pointer", marginBottom: "6px" },
  indentedBlock: { paddingLeft: "16px", borderLeft: "2px solid #cbd5e1", marginLeft: "8px", marginTop: "8px", paddingTop: "4px", paddingBottom: "4px" },
  addBtn: { width: "100%", padding: "14px", border: "2px dashed #94a3b8", backgroundColor: "#f8fafc", color: "#475569", fontWeight: "bold", borderRadius: "6px", cursor: "pointer", transition: "background-color 0.2s" },
  removeBtn: { backgroundColor: "transparent", border: "none", color: "#ef4444", fontSize: "13px", cursor: "pointer", fontWeight: "bold" },
  submitBtn: { width: "100%", backgroundColor: "#22c55e", color: "white", border: "none", padding: "16px", borderRadius: "6px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(34,197,94,0.3)" },
};