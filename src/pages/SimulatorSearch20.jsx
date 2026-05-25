import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  doc, 
  setDoc, 
  increment, 
  getDoc,    
  updateDoc, 
  deleteDoc  
} from "firebase/firestore";
import { db, auth } from "../config/firebase"; // Ensure 'auth' is imported!
import TaskMapPreview from "../components/shared/TaskMapPreview";
import { pinColors } from "../components/shared/TaskMapPreview";

// --- FISHER-YATES SHUFFLE ---
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// --- MATH HELPER: Calculates distance between two coordinates in kilometers ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return "N/A";
  }

  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance.toFixed(3); // Formats to 3 decimal places (e.g. 0.920)
};

// Helper to map address error keys to readable labels for the feedback UI
const addrLabels = {
  streetNum: "Street Number",
  unit: "Unit/Apt",
  streetName: "Street Name",
  subLoc: "Sub-Locality",
  loc: "Locality",
  region: "Region/State",
  postal: "Postal Code",
  country: "Country",
  notExist: "Address does not exist",
  lang: "Language/Script",
  countrySpecific: "Country specific",
  other: "Other Issue",
};

export default function SimulatorSearch20() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // NEW: Catch routing state
  const targetSet = location.state?.targetSet;
  const reviewMode = location.state?.reviewMode;
  
  const [tasks, setTasks] = useState([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // NEW: Store past submissions for review mode
  const [reviewData, setReviewData] = useState({});

  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  useEffect(() => {
    // Kick them out if they didn't click a real exam
    if (!targetSet) {
      alert("No exam set selected. Please launch from your dashboard.");
      navigate('/dashboard');
      return;
    }
    fetchTasksAndReviewData();
  }, [targetSet, navigate]);

const fetchTasksAndReviewData = async () => {
    try {
      const q = query(collection(db, "tasks"), where("taskType", "==", "search_2_0"), where("group", "==", targetSet));
      const querySnapshot = await getDocs(q);
      let fetchedTasks = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      if (reviewMode && auth.currentUser) {
        // ... (Keep your existing Review Mode logic here)
        setTasks(fetchedTasks);
        if (fetchedTasks.length > 0) initializeAnswers(fetchedTasks[0]);
      } else if (auth.currentUser) {
        // --- THE ANTI-CHEAT SESSION LOGIC ---
        const sessionRef = doc(db, 'users', auth.currentUser.uid, 'active_sessions', targetSet);
        const sessionSnap = await getDoc(sessionRef);

        if (sessionSnap.exists()) {
          // RESUME SESSION
          const sessionData = sessionSnap.data();
          // Restore the exact shuffle order
          fetchedTasks.sort((a, b) => {
            const iA = sessionData.shuffledIds.indexOf(a.id);
            const iB = sessionData.shuffledIds.indexOf(b.id);
            return (iA > -1 ? iA : 999) - (iB > -1 ? iB : 999);
          });
          setTasks(fetchedTasks);
          setCurrentTaskIndex(sessionData.currentIndex);
          initializeAnswers(fetchedTasks[sessionData.currentIndex]);
        } else {
          // CREATE NEW SESSION
         fetchedTasks = shuffleArray(fetchedTasks);
          await setDoc(sessionRef, {
            shuffledIds: fetchedTasks.map(t => t.id),
            currentIndex: 0,
            startedAt: serverTimestamp()
          });
          setTasks(fetchedTasks);
          setCurrentTaskIndex(0);
          if (fetchedTasks.length > 0) initializeAnswers(fetchedTasks[0]);
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeAnswers = (task, pastData = reviewData) => {
    // NEW: If reviewing, inject their past answers and lock the form!
    if (reviewMode && pastData[task.id]) {
      setAnswers(pastData[task.id]);
      setIsSubmitted(true);
      return;
    }

    const initialAnswers = { isNavigational: "" };
    task.taskData.results.forEach((res) => {
      initialAnswers[res.resultId] = {
        unexpectedLanguage: false,
        poiClosed: false,
        relevance: "",
        relUserIntent: false,
        relDistance: false,
        nameAcc: "",
        nameIssue: false,
        categoryIssue: false,
        addressAcc: "",
        addrErrors: {
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
        },
        pinAcc: "",
        comment: "",
      };
    });
    setAnswers(initialAnswers);
    setIsSubmitted(false);
  };

  const handleAnswerChange = (resultId, field, value) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({
      ...prev,
      [resultId]: { ...prev[resultId], [field]: value },
    }));
  };

  const handleGlobalChange = (field, value) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [field]: value }));
  };

  const submitRating = async () => {
    if (isSubmitted) {
      nextTask();
      return;
    }
    
    // Add this right after the if statement:
    if (submitting) return;
    setSubmitting(true);

    // --- 1. Initialize Deep Tracking Categories ---
    let catScores = {
      navigational: { c: 0, t: 0 },
      poiClosed: { c: 0, t: 0 },
      relevance: { c: 0, t: 0 },
      name: { c: 0, t: 0 },
      address: { c: 0, t: 0 },
      pin: { c: 0, t: 0 }
    };

    const currentTask = tasks[currentTaskIndex];

    // --- 2. Grade Navigational ---
    catScores.navigational.t++;
    if (answers.isNavigational === currentTask.taskData.isNavigational) catScores.navigational.c++;

    // --- 3. Grade Results Granularly ---
    currentTask.taskData.results.forEach(res => {
      const raterAns = answers[res.resultId] || {};
      const gold = res.goldStandard || {};

      // Status & Language
      catScores.poiClosed.t += 2;
      if (raterAns.unexpectedLanguage === gold.unexpectedLanguage) catScores.poiClosed.c++;
      if (raterAns.poiClosed === gold.poiClosed) catScores.poiClosed.c++;

      // Relevance block
      catScores.relevance.t++;
      if (raterAns.relevance === gold.relevance) catScores.relevance.c++;

      if (['Good', 'Acceptable', 'Bad'].includes(gold.relevance)) {
        catScores.relevance.t += 2;
        if (raterAns.relUserIntent === gold.relUserIntent) catScores.relevance.c++;
        if (raterAns.relDistance === gold.relDistance) catScores.relevance.c++;
      }

      // Accuracy blocks (Only if open)
      if (!gold.poiClosed) {
        
        // Name Accuracy
        catScores.name.t++;
        if (raterAns.nameAcc === gold.nameAccuracy) catScores.name.c++;

        if (['Incorrect', 'Partially Correct'].includes(gold.nameAccuracy)) {
          catScores.name.t += 2;
          if (raterAns.nameIssue === gold.nameIssue) catScores.name.c++;
          if (raterAns.categoryIssue === gold.categoryIssue) catScores.name.c++;
        }

        // Address Accuracy
        catScores.address.t++;
        if (raterAns.addressAcc === gold.addressAccuracy) catScores.address.c++;

        if (gold.addressAccuracy === 'Incorrect') {
          const addrKeys = ['streetNum', 'unit', 'streetName', 'subLoc', 'loc', 'region', 'postal', 'country', 'notExist', 'lang', 'countrySpecific', 'other'];
          catScores.address.t += addrKeys.length;
          addrKeys.forEach(key => {
            if (raterAns.addrErrors?.[key] === gold.addressErrors?.[key]) catScores.address.c++;
          });
        }

        // Pin Accuracy
        catScores.pin.t++;
        if (raterAns.pinAcc === gold.pinAccuracy) catScores.pin.c++;
      }
    });

    // --- 4. Tally Overall Score for UI ---
    let correctCount = 0;
    let totalQuestions = 0;
    Object.values(catScores).forEach(score => {
      correctCount += score.c;
      totalQuestions += score.t;
    });

    setScore({ correct: correctCount, total: totalQuestions });
    setIsSubmitted(true);

    // --- 5. Save Deep Analytics Payload to Firebase ---
    if (auth.currentUser) {
      try {
        // Calculate percentages safely
        const calcPercent = (c, t) => t > 0 ? Math.round((c / t) * 100) : null;

        await addDoc(collection(db, 'rater_submissions'), {
          userId: auth.currentUser.uid,
          raterEmail: auth.currentUser.email,
          taskId: currentTask.id,
          taskGroup: targetSet, // NEW: Associates this submission with the exact exam set
          taskType: 'search_2_0',
          submittedAt: serverTimestamp(),
          
          // Overall Score
          overall: {
            correct: correctCount,
            total: totalQuestions,
            accuracy: calcPercent(correctCount, totalQuestions)
          },

          // Granular Category Scores
          categories: {
            navigational: { correct: catScores.navigational.c, total: catScores.navigational.t, accuracy: calcPercent(catScores.navigational.c, catScores.navigational.t) },
            poiClosed: { correct: catScores.poiClosed.c, total: catScores.poiClosed.t, accuracy: calcPercent(catScores.poiClosed.c, catScores.poiClosed.t) },
            relevance: { correct: catScores.relevance.c, total: catScores.relevance.t, accuracy: calcPercent(catScores.relevance.c, catScores.relevance.t) },
            nameAccuracy: { correct: catScores.name.c, total: catScores.name.t, accuracy: calcPercent(catScores.name.c, catScores.name.t) },
            addressAccuracy: { correct: catScores.address.c, total: catScores.address.t, accuracy: calcPercent(catScores.address.c, catScores.address.t) },
            pinAccuracy: { correct: catScores.pin.c, total: catScores.pin.t, accuracy: calcPercent(catScores.pin.c, catScores.pin.t) }
          },

          // The Ultimate Audit Trail: Exact Rater Inputs
          rawRaterAnswers: answers
        });
     
       // --- INSTANT ANTI-CHEAT LOCK ---
        // Advance the database index immediately so a refresh skips this question
        if (!reviewMode) {
          const nextIndex = currentTaskIndex + 1;
          await updateDoc(doc(db, 'users', auth.currentUser.uid, 'active_sessions', targetSet), {
            currentIndex: nextIndex
          });
        } 

     } catch (err) {
        console.error("Failed to save submission analytics:", err);
      } finally {
        setSubmitting(false); // <--- ADD THIS
      }
    }
  };

 const nextTask = async () => { 
    const nextIndex = currentTaskIndex + 1;

    // The database was already updated during submitRating. 
    // Just move the local UI forward.
    if (nextIndex < tasks.length) {
      setCurrentTaskIndex(nextIndex);
      initializeAnswers(tasks[nextIndex]);
    } else {
      // EXAM COMPLETION PROTOCOL
      if (!reviewMode && auth.currentUser) {
        try {
          // 1. Log the attempt count
          await setDoc(doc(db, 'users', auth.currentUser.uid, 'attempts', targetSet), { 
             count: increment(1), lastAttemptAt: serverTimestamp() 
          }, { merge: true });
          
          // 2. Delete the session
          await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'active_sessions', targetSet));
        } catch (err) {
          console.error("Failed to finish exam:", err);
        }
      }
      setShowCompletionModal(true);
    }
  };
  const getFeedbackStyle = (resultId, field, goldValue) => {
    if (!isSubmitted) return styles.select;
    const raterValue = resultId ? answers[resultId][field] : answers[field];

    if (raterValue === goldValue) {
      return {
        ...styles.select,
        backgroundColor: "#f0fdf4",
        borderColor: "#22c55e",
        color: "#166534",
      };
    }
    return {
      ...styles.select,
      backgroundColor: "#fef2f2",
      borderColor: "#ef4444",
      color: "#991b1b",
    };
  };

  if (loading)
    return <div style={styles.loading}>Loading Practice Tasks...</div>;
  if (tasks.length === 0)
    return <div style={styles.loading}>No tasks found in the database.</div>;

  const currentTask = tasks[currentTaskIndex];
  const { taskData } = currentTask;

  const viewportStr = `${taskData.viewportCenter.lat}, ${taskData.viewportCenter.lng}`;
  const userStr = `${taskData.userLocation.lat}, ${taskData.userLocation.lng}`;
  const formattedResults = taskData.results.map((r) => ({
    id: r.resultId,
    name: r.name,
    address: r.address,
    coords: `${r.lat}, ${r.lng}`,
  }));

  // --- NEW: Dynamic Estimated Time Calculation ---
  let totalEstSeconds = 0;
  if (Object.keys(answers).length > 0) {
    taskData.results.forEach((res) => {
      const raterAns = answers[res.resultId] || {};
      // If POI is closed, add 105 seconds (1m 45s). Otherwise, add 190 seconds (3m 10s).
      if (raterAns && raterAns.poiClosed) {
        totalEstSeconds += 105;
      } else {
        totalEstSeconds += 190;
      }
    });
  }
  const estMinutes = Math.floor(totalEstSeconds / 60);
  const estSeconds = totalEstSeconds % 60;
  // -----------------------------------------------

  return (
    <div style={styles.container}>

      {/* --- Custom Completion Box --- */}
      {showCompletionModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <p style={styles.modalText}>{reviewMode ? "You have finished reviewing this module." : "no more tasks available"}</p>
            <button style={styles.modalButton} onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </button>
          </div>
        </div>
      )}

       {/* TOP HEADER */}
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <div style={styles.headerBlock}>
            <span style={styles.headerLabel}>Task Type</span>
            <span style={styles.headerValue}>Maps_Search_2.0</span>
          </div>
          <div style={styles.headerBlock}>
            <span style={styles.headerLabel}>Task ID</span>
            <span style={styles.headerValue}>{currentTask.id}</span>
          </div>
          <div style={styles.headerBlock}>
            <span style={styles.headerLabel}>Estimated Rating Time</span>
            <span style={styles.headerValue}>
              {estMinutes} minutes {estSeconds} seconds
            </span>
          </div>
        </div>

        <div style={styles.topBarRight}>
          {/* NEW: Show badge if in review mode */}
          {reviewMode && <span style={{backgroundColor: '#fef08a', color: '#854d0e', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', marginRight: '8px'}}>REVIEW MODE</span>}
          
          <button style={styles.btnBlue}>Rating Guidelines</button>
          <button
            onClick={() => navigate("/dashboard")}
            style={styles.btnLight}
          >
            Release Survey
          </button>

          {/* NEW: Toggle button logic based on Review Mode */}
          {!reviewMode ? (
            <button onClick={submitRating} style={styles.btnGreen}>
              {isSubmitted ? (currentTaskIndex === tasks.length - 1 ? "Finish Module" : "Load Next Task") : "Submit Rating"}
            </button>
          ) : (
            <button onClick={nextTask} style={styles.btnGreen}>
               {currentTaskIndex === tasks.length - 1 ? "Finish Review" : "Next Question"}
            </button>
          )}

        </div>
      </header>

      {/* MAIN LAYOUT: Map on Left, Form on Right */}
      <div style={styles.mainContent}>
        {/* LEFT COLUMN: Map Area */}
        <div style={styles.mapColumn}>
          <TaskMapPreview
            userCoords={userStr}
            viewportCoords={viewportStr}
            viewportSize={taskData.viewportSizeOffset}
            results={formattedResults}
          />
        </div>

        {/* RIGHT COLUMN: Rater Form */}
        <div style={styles.formColumn}>
          {/* Task Context Table */}
          <table style={styles.dataTable}>
            <tbody>
              <tr>
                <td style={styles.tdLabel}>Query</td>
                <td style={styles.tdValue}>
                  <strong>{taskData.query}</strong>
                </td>
              </tr>

              {/* Dynamic Viewport Age Coloring */}
              <tr>
                <td style={styles.tdLabel}>Viewport Age</td>
                <td style={styles.tdValue}>
                  <span
                    style={{
                      color:
                        taskData.viewportAge === "STALE"
                          ? "#ef4444"
                          : "#10b981",
                      fontWeight: "bold",
                    }}
                  >
                    {taskData.viewportAge}
                  </span>
                </td>
              </tr>

              <tr>
                <td style={styles.tdLabel}>Locale</td>
                <td style={styles.tdValue}>{taskData.locale}</td>
              </tr>
              <tr>
                <td style={styles.tdLabel}>Country</td>
                <td style={styles.tdValue}>{taskData.country}</td>
              </tr>
              <tr>
                <td style={styles.tdLabel}>User Lat, Lng</td>
                <td style={styles.tdValue}>{userStr}</td>
              </tr>
            </tbody>
          </table>

          {/* Navigational Question */}
          <div style={styles.navigationalBox}>
            <span style={{ fontSize: "14px", color: "#333" }}>
              Is there a navigational result for this query?
            </span>
            <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="isNav"
                  value="Yes"
                  checked={answers.isNavigational === "Yes"}
                  onChange={(e) =>
                    handleGlobalChange("isNavigational", e.target.value)
                  }
                  disabled={isSubmitted}
                />{" "}
                Yes
              </label>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="isNav"
                  value="No"
                  checked={answers.isNavigational === "No"}
                  onChange={(e) =>
                    handleGlobalChange("isNavigational", e.target.value)
                  }
                  disabled={isSubmitted}
                />{" "}
                No
              </label>
            </div>
            {isSubmitted &&
              answers.isNavigational !== taskData.isNavigational && (
                <div style={styles.inlineError}>
                  Correct Answer: {taskData.isNavigational}
                </div>
              )}
          </div>

          <hr style={styles.divider} />

          {/* Result Cards */}
          {taskData.results.map((res, index) => {
            const raterAns = answers[res.resultId] || {};
            const gold = res.goldStandard || {};
            const headerColor = pinColors[index] || "#8b5cf6";

            // Calculate precise distances using the Haversine formula
            // 1. Calculate Distance to User normally
            const distToUser = calculateDistance(
              taskData.userLocation.lat,
              taskData.userLocation.lng,
              res.lat,
              res.lng,
            );

            // 2. Define Viewport Boundaries
            const vLat = taskData.viewportCenter.lat;
            const vLng = taskData.viewportCenter.lng;
            const vOffset = taskData.viewportSizeOffset;

            const isInsideViewport =
              res.lat >= vLat - vOffset &&
              res.lat <= vLat + vOffset &&
              res.lng >= vLng - vOffset &&
              res.lng <= vLng + vOffset;

            // 3. Set to 0 if inside, otherwise calculate distance
            const distToViewport = isInsideViewport
              ? "0.000"
              : calculateDistance(vLat, vLng, res.lat, res.lng);

            return (
              <div key={res.resultId} style={styles.resultCard}>
                {/* Result Header */}
                <div
                  style={{
                    ...styles.resultHeader,
                    backgroundColor: headerColor,
                  }}
                >
                  {index + 1}. {res.name}
                </div>

                {/* Result Data Table */}
                <table style={styles.dataTable}>
                  <tbody>
                    <tr>
                      <td style={styles.tdLabel}>Address</td>
                      <td style={styles.tdValue}>{res.address}</td>
                    </tr>
                    <tr>
                      <td style={styles.tdLabel}>Classification</td>
                      <td style={styles.tdValue}>{res.classification}</td>
                    </tr>

                    <tr>
                      <td style={styles.tdLabel}>Type</td>
                      <td style={styles.tdValue}>{res.type}</td>
                    </tr>

                    {/* Distance to User & Viewport calculations */}
                    <tr>
                      <td style={styles.tdLabel}>Distance to User</td>
                      <td style={styles.tdValue}>{distToUser} km</td>
                    </tr>
                    <tr>
                      <td style={styles.tdLabel}>Distance to Viewport</td>
                      <td style={styles.tdValue}>{distToViewport} km</td>
                    </tr>

                    <tr>
                      <td style={styles.tdLabel}>Lat, Lng</td>
                      <td style={styles.tdValue}>
                        {res.lat}, {res.lng}
                      </td>
                    </tr>
                  </tbody>
                </table>

               {/* Form Controls */}
                <div style={styles.ratingSection}>
                  <label style={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={raterAns.unexpectedLanguage}
                      onChange={() =>
                        handleAnswerChange(
                          res.resultId,
                          "unexpectedLanguage",
                          !raterAns.unexpectedLanguage,
                        )
                      }
                      disabled={isSubmitted}
                    />
                    Result name/title is in unexpected language or script
                  </label>
                  <label style={{ ...styles.checkboxItem, fontWeight: "bold" }}>
                    <input
                      type="checkbox"
                      checked={raterAns.poiClosed}
                      onChange={() =>
                        handleAnswerChange(
                          res.resultId,
                          "poiClosed",
                          !raterAns.poiClosed,
                        )
                      }
                      disabled={isSubmitted}
                    />
                    Business/POI is closed or does not exist
                  </label>

                  {/* 1. RELEVANCE BLOCK */}
                  <div style={styles.formGroup}>
                    <label style={styles.inputLabel}>Relevance</label>
                    <select
                      style={getFeedbackStyle(
                        res.resultId,
                        "relevance",
                        gold.relevance,
                      )}
                      value={raterAns.relevance}
                      onChange={(e) =>
                        handleAnswerChange(
                          res.resultId,
                          "relevance",
                          e.target.value,
                        )
                      }
                      disabled={isSubmitted}
                    >
                      <option value="" disabled hidden></option>
                      <option value="Navigational">Navigational</option>
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Acceptable">Acceptable</option>
                      <option value="Bad">Bad</option>
                    </select>

                    {/* Relevance Granular Feedback */}
                    {isSubmitted && (
                      <>
                        {raterAns.relevance !== gold.relevance && (
                          <div style={styles.inlineError}>
                            Correct Answer: {gold.relevance}
                          </div>
                        )}
                        {["Good", "Acceptable", "Bad"].includes(gold.relevance) &&
                          (raterAns.relUserIntent !== gold.relUserIntent ||
                            raterAns.relDistance !== gold.relDistance) && (
                            <div style={styles.inlineError}>
                              Missed Flags:{" "}
                              {gold.relUserIntent
                                ? "[x] User intent issue "
                                : ""}{" "}
                              {gold.relDistance
                                ? "[x] Distance/Prominence issue"
                                : ""}{" "}
                              {!gold.relUserIntent && !gold.relDistance
                                ? "None"
                                : ""}
                            </div>
                          )}
                      </>
                    )}

                    {["Good", "Acceptable", "Bad"].includes(
                      raterAns.relevance,
                    ) && (
                      <div style={styles.subCheckboxes}>
                        <label style={styles.checkboxItem}>
                          <input
                            type="checkbox"
                            checked={raterAns.relUserIntent}
                            onChange={() =>
                              handleAnswerChange(
                                res.resultId,
                                "relUserIntent",
                                !raterAns.relUserIntent,
                              )
                            }
                            disabled={isSubmitted}
                          />{" "}
                          User intent issue
                        </label>
                        <label style={styles.checkboxItem}>
                          <input
                            type="checkbox"
                            checked={raterAns.relDistance}
                            onChange={() =>
                              handleAnswerChange(
                                res.resultId,
                                "relDistance",
                                !raterAns.relDistance,
                              )
                            }
                            disabled={isSubmitted}
                          />{" "}
                          Distance/Prominence issue
                        </label>
                      </div>
                    )}
                  </div>

                  {/* 2. NAME ACCURACY BLOCK */}
                  <div
                    style={{
                      ...styles.formGroup,
                      opacity: raterAns.poiClosed ? 0.5 : 1,
                    }}
                  >
                    <label style={styles.inputLabel}>Name Accuracy</label>
                    <select
                      style={getFeedbackStyle(
                        res.resultId,
                        "nameAcc",
                        gold.nameAccuracy,
                      )}
                      value={raterAns.nameAcc}
                      onChange={(e) =>
                        handleAnswerChange(
                          res.resultId,
                          "nameAcc",
                          e.target.value,
                        )
                      }
                      disabled={isSubmitted || raterAns.poiClosed}
                    >
                      <option value="" disabled hidden></option>
                      <option value="n/a">n/a</option>
                      <option value="Correct">Correct</option>
                      <option value="Partially Correct">
                        Partially Correct
                      </option>
                      <option value="Incorrect">Incorrect</option>
                      <option value="Can't Verify">Can't Verify</option>
                    </select>

                    {/* Name Accuracy Granular Feedback */}
                    {isSubmitted && !raterAns.poiClosed && (
                      <>
                        {raterAns.nameAcc !== gold.nameAccuracy && (
                          <div style={styles.inlineError}>
                            Correct Answer: {gold.nameAccuracy}
                          </div>
                        )}
                        {["Incorrect", "Partially Correct"].includes(
                          gold.nameAccuracy,
                        ) &&
                          (raterAns.nameIssue !== gold.nameIssue ||
                            raterAns.categoryIssue !== gold.categoryIssue) && (
                            <div style={styles.inlineError}>
                              Missed Flags:{" "}
                              {gold.nameIssue ? "[x] Name Issue " : ""}{" "}
                              {gold.categoryIssue ? "[x] Category Issue" : ""}{" "}
                              {!gold.nameIssue && !gold.categoryIssue
                                ? "None"
                                : ""}
                            </div>
                          )}
                      </>
                    )}

                    {(raterAns.nameAcc === "Incorrect" ||
                      raterAns.nameAcc === "Partially Correct") &&
                      !raterAns.poiClosed && (
                        <div style={styles.subCheckboxes}>
                          <label style={styles.checkboxItem}>
                            <input
                              type="checkbox"
                              checked={raterAns.nameIssue}
                              onChange={() =>
                                handleAnswerChange(
                                  res.resultId,
                                  "nameIssue",
                                  !raterAns.nameIssue,
                                )
                              }
                              disabled={isSubmitted}
                            />{" "}
                            Name Issue
                          </label>
                          <label style={styles.checkboxItem}>
                            <input
                              type="checkbox"
                              checked={raterAns.categoryIssue}
                              onChange={() =>
                                handleAnswerChange(
                                  res.resultId,
                                  "categoryIssue",
                                  !raterAns.categoryIssue,
                                )
                              }
                              disabled={isSubmitted}
                            />{" "}
                            Category Issue
                          </label>
                        </div>
                      )}
                  </div>

                  {/* 3. ADDRESS ACCURACY BLOCK */}
                  <div
                    style={{
                      ...styles.formGroup,
                      opacity: raterAns.poiClosed ? 0.5 : 1,
                    }}
                  >
                    <label style={styles.inputLabel}>Address Accuracy</label>
                    <select
                      style={getFeedbackStyle(
                        res.resultId,
                        "addressAcc",
                        gold.addressAccuracy,
                      )}
                      value={raterAns.addressAcc}
                      onChange={(e) =>
                        handleAnswerChange(
                          res.resultId,
                          "addressAcc",
                          e.target.value,
                        )
                      }
                      disabled={isSubmitted || raterAns.poiClosed}
                    >
                      <option value="" disabled hidden></option>
                      <option value="Correct">Correct</option>
                      <option value="Correct with formatting issue">
                        Correct with formatting issue
                      </option>
                      <option value="Incorrect">Incorrect</option>
                      <option value="Can't Verify">Can't Verify</option>
                    </select>

                    {/* Address Accuracy Granular Feedback */}
                    {isSubmitted && !raterAns.poiClosed && (
                      <>
                        {raterAns.addressAcc !== gold.addressAccuracy && (
                          <div style={styles.inlineError}>
                            Correct Answer: {gold.addressAccuracy}
                          </div>
                        )}
                        {gold.addressAccuracy === "Incorrect" && (
                          <div style={styles.inlineError}>
                            Correct Address Errors:{" "}
                            {Object.keys(gold.addressErrors || {})
                              .filter((k) => gold.addressErrors[k])
                              .map((k) => `[x] ${addrLabels[k]}`)
                              .join(", ") || "None"}
                          </div>
                        )}
                      </>
                    )}

                    {raterAns.addressAcc === "Incorrect" &&
                      !raterAns.poiClosed && (
                        <div
                          style={{
                            ...styles.subCheckboxes,
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "4px",
                          }}
                        >
                          {Object.keys(addrLabels).map((errorKey) => (
                            <label key={errorKey} style={styles.checkboxItem}>
                              <input
                                type="checkbox"
                                checked={raterAns.addrErrors?.[errorKey] || false}
                                onChange={() => {
                                  if (isSubmitted) return;
                                  const newErrors = {
                                    ...raterAns.addrErrors,
                                    [errorKey]: !raterAns.addrErrors[errorKey],
                                  };
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [res.resultId]: {
                                      ...prev[res.resultId],
                                      addrErrors: newErrors,
                                    },
                                  }));
                                }}
                                disabled={isSubmitted}
                              />{" "}
                              {addrLabels[errorKey]}
                            </label>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* 4. PIN ACCURACY BLOCK */}
                  <div
                    style={{
                      ...styles.formGroup,
                      opacity: raterAns.poiClosed ? 0.5 : 1,
                    }}
                  >
                    <label style={styles.inputLabel}>Pin Accuracy</label>
                    <select
                      style={getFeedbackStyle(
                        res.resultId,
                        "pinAcc",
                        gold.pinAccuracy,
                      )}
                      value={raterAns.pinAcc}
                      onChange={(e) =>
                        handleAnswerChange(
                          res.resultId,
                          "pinAcc",
                          e.target.value,
                        )
                      }
                      disabled={isSubmitted || raterAns.poiClosed}
                    >
                      <option value="" disabled hidden></option>
                      <option value="Perfect">Perfect</option>
                      <option value="Approximate">Approximate</option>
                      <option value="Next Door">Next Door</option>
                      <option value="Wrong">Wrong</option>
                      <option value="Can't Verify">Can't Verify</option>
                    </select>
                    {isSubmitted &&
                      !raterAns.poiClosed &&
                      raterAns.pinAcc !== gold.pinAccuracy && (
                        <div style={styles.inlineError}>
                          Correct: {gold.pinAccuracy}
                        </div>
                      )}
                  </div>

                  {/* 5. COMMENT BLOCK */}
                  <div style={styles.formGroup}>
                    <label style={styles.inputLabel}>Comment and Link</label>
                    <textarea
                      style={styles.textarea}
                      value={raterAns.comment}
                      onChange={(e) =>
                        handleAnswerChange(
                          res.resultId,
                          "comment",
                          e.target.value,
                        )
                      }
                      placeholder="Add evaluation comments here..."
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// CSS-in-JS mimicking TryRating UI
const styles = {
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#ffffff",
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontSize: "18px",
    color: "#555",
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #d1d5db",
    padding: "8px 16px",
    backgroundColor: "#ffffff",
    minHeight: "60px",
  },
  topBarLeft: { display: "flex", gap: "32px" },
  headerBlock: { display: "flex", flexDirection: "column" },
  headerLabel: {
    fontSize: "11px",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: "2px",
  },
  headerValue: { fontSize: "14px", color: "#111827", fontWeight: "500" },
  topBarRight: { display: "flex", gap: "12px", alignItems: "center" },
  scoreDisplay: {
    fontWeight: "bold",
    color: "#16a34a",
    marginRight: "12px",
    fontSize: "16px",
  },

  btnBlue: {
    backgroundColor: "#0ea5e9",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  btnLight: {
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    padding: "8px 16px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  btnGreen: {
    backgroundColor: "#22c55e",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    fontWeight: "bold",
  },

  mainContent: { display: "flex", flex: 1, overflow: "hidden" },
  mapColumn: {
    flex: "1.4",
    borderRight: "1px solid #d1d5db",
    position: "relative",
  },
  formColumn: {
    flex: "1",
    overflowY: "auto",
    padding: "16px",
    backgroundColor: "#ffffff",
  },

  dataTable: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: "16px",
    fontSize: "13px",
  },
  tdLabel: {
    border: "1px solid #e5e7eb",
    padding: "8px 12px",
    color: "#374151",
    fontWeight: "bold",
    width: "30%",
    backgroundColor: "#f9fafb",
  },
  tdValue: {
    border: "1px solid #e5e7eb",
    padding: "8px 12px",
    color: "#111827",
    width: "70%",
  },

  navigationalBox: { margin: "8px 0 16px 0" },
  radioLabel: {
    fontSize: "13px",
    color: "#111827",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  divider: { border: "none", borderTop: "2px solid #e5e7eb", margin: "24px 0" },

  resultCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "4px",
    marginBottom: "24px",
    overflow: "hidden",
  },
  resultHeader: {
    padding: "10px 16px",
    color: "white",
    fontWeight: "bold",
    fontSize: "15px",
  },

  ratingSection: { padding: "16px", borderTop: "1px solid #e5e7eb" },
  checkboxItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "#374151",
    cursor: "pointer",
    marginBottom: "8px",
  },

  formGroup: { marginTop: "16px" },
  inputLabel: {
    fontSize: "13px",
    color: "#4b5563",
    marginBottom: "4px",
    display: "block",
    fontWeight: "bold",
  },
  select: {
    width: "100%",
    padding: "8px",
    border: "1px solid #d1d5db",
    borderRadius: "4px",
    fontSize: "13px",
    backgroundColor: "white",
    color: "#111827",
    outline: "none",
  },
  textarea: {
    width: "100%",
    padding: "8px",
    border: "1px solid #d1d5db",
    borderRadius: "4px",
    fontSize: "13px",
    minHeight: "60px",
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
  },

  subCheckboxes: { paddingLeft: "8px", marginTop: "6px" },
  inlineError: {
    color: "#ef4444",
    fontSize: "12px",
    fontWeight: "bold",
    marginTop: "4px",
  },

  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalBox: { backgroundColor: '#ffffff', padding: '32px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', textAlign: 'center', minWidth: '300px' },
  modalText: { fontSize: '18px', color: '#1f2937', fontWeight: 'bold', marginBottom: '24px' },
  modalButton: { backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }
};