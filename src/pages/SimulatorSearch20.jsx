import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import TaskMapPreview from '../components/shared/TaskMapPreview';
import { pinColors } from '../components/shared/TaskMapPreview';

// --- MATH HELPER: Calculates distance between two coordinates in kilometers ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return "N/A";
  }
  
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance.toFixed(3); // Formats to 3 decimal places (e.g. 0.920)
};

export default function SimulatorSearch20() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const q = query(collection(db, 'tasks'), where('taskType', '==', 'search_2_0'));
      const querySnapshot = await getDocs(q);
      const fetchedTasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setTasks(fetchedTasks);
      if (fetchedTasks.length > 0) {
        initializeAnswers(fetchedTasks[0]);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeAnswers = (task) => {
    const initialAnswers = { isNavigational: '' };
    task.taskData.results.forEach(res => {
      initialAnswers[res.resultId] = {
        unexpectedLanguage: false,
        poiClosed: false,
        relevance: '',
        relUserIntent: false,
        relDistance: false,
        nameAcc: '',
        nameIssue: false,
        categoryIssue: false,
        addressAcc: '',
        addrErrors: { streetNum: false, unit: false, streetName: false, subLoc: false, loc: false, region: false, postal: false, country: false, notExist: false, lang: false, countrySpecific: false, other: false },
        pinAcc: '',
        comment: ''
      };
    });
    setAnswers(initialAnswers);
    setIsSubmitted(false);
  };

  const handleAnswerChange = (resultId, field, value) => {
    if (isSubmitted && field !== 'comment') return; 
    setAnswers(prev => ({
      ...prev,
      [resultId]: { ...prev[resultId], [field]: value }
    }));
  };

  const handleGlobalChange = (field, value) => {
    if (isSubmitted) return;
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const submitRating = () => {
    if (isSubmitted) {
      nextTask();
      return;
    }

    let correctCount = 0;
    let totalQuestions = 0;
    const currentTask = tasks[currentTaskIndex];

    totalQuestions++;
    if (answers.isNavigational === currentTask.taskData.isNavigational) correctCount++;

    currentTask.taskData.results.forEach(res => {
      const raterAns = answers[res.resultId];
      const gold = res.goldStandard;

      totalQuestions += 2;
      if (raterAns.unexpectedLanguage === gold.unexpectedLanguage) correctCount++;
      if (raterAns.poiClosed === gold.poiClosed) correctCount++;

      totalQuestions++;
      if (raterAns.relevance === gold.relevance) correctCount++;

      // Removed 'Poor' from logic
      if (['Good', 'Acceptable', 'Bad'].includes(gold.relevance)) {
        totalQuestions += 2;
        if (raterAns.relUserIntent === gold.relUserIntent) correctCount++;
        if (raterAns.relDistance === gold.relDistance) correctCount++;
      }

      if (!gold.poiClosed) {
        totalQuestions += 3; 
        if (raterAns.nameAcc === gold.nameAccuracy) correctCount++;
        if (raterAns.addressAcc === gold.addressAccuracy) correctCount++;
        if (raterAns.pinAcc === gold.pinAccuracy) correctCount++;

        if (['Incorrect', 'Partially Correct'].includes(gold.nameAccuracy)) {
          totalQuestions += 2;
          if (raterAns.nameIssue === gold.nameIssue) correctCount++;
          if (raterAns.categoryIssue === gold.categoryIssue) correctCount++;
        }

        if (gold.addressAccuracy === 'Incorrect') {
          const addrKeys = ['streetNum', 'unit', 'streetName', 'subLoc', 'loc', 'region', 'postal', 'country', 'notExist', 'lang', 'countrySpecific', 'other'];
          totalQuestions += addrKeys.length;
          addrKeys.forEach(key => {
            if (raterAns.addrErrors?.[key] === gold.addressErrors?.[key]) correctCount++;
          });
        }
      }
    });

    setScore({ correct: correctCount, total: totalQuestions });
    setIsSubmitted(true);
  };

  const nextTask = () => {
    if (currentTaskIndex < tasks.length - 1) {
      const nextIndex = currentTaskIndex + 1;
      setCurrentTaskIndex(nextIndex);
      initializeAnswers(tasks[nextIndex]);
    } else {
      alert("You have completed all available practice tasks!");
      navigate('/dashboard');
    }
  };

  const getFeedbackStyle = (resultId, field, goldValue) => {
    if (!isSubmitted) return styles.select;
    const raterValue = resultId ? answers[resultId][field] : answers[field];
    
    if (raterValue === goldValue) {
      return { ...styles.select, backgroundColor: '#f0fdf4', borderColor: '#22c55e', color: '#166534' }; 
    }
    return { ...styles.select, backgroundColor: '#fef2f2', borderColor: '#ef4444', color: '#991b1b' }; 
  };

  if (loading) return <div style={styles.loading}>Loading Practice Tasks...</div>;
  if (tasks.length === 0) return <div style={styles.loading}>No tasks found in the database.</div>;

  const currentTask = tasks[currentTaskIndex];
  const { taskData } = currentTask;

  const viewportStr = `${taskData.viewportCenter.lat}, ${taskData.viewportCenter.lng}`;
  const userStr = `${taskData.userLocation.lat}, ${taskData.userLocation.lng}`;
  const formattedResults = taskData.results.map(r => ({
    id: r.resultId, name: r.name, address: r.address, coords: `${r.lat}, ${r.lng}`
  }));

  return (
    <div style={styles.container}>
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
          {/* Estimated Time block completely removed from here */}
        </div>
        
        <div style={styles.topBarRight}>
          {isSubmitted && (
             <div style={styles.scoreDisplay}>
               Score: {score.correct} / {score.total}
             </div>
          )}
          <button style={styles.btnBlue}>Rating Guidelines</button>
          <button onClick={() => navigate('/dashboard')} style={styles.btnLight}>Release Survey</button>
          <button onClick={submitRating} style={styles.btnGreen}>
            {isSubmitted ? "Load Next Task" : "Submit Rating"}
          </button>
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
              <tr><td style={styles.tdLabel}>Query</td><td style={styles.tdValue}><strong>{taskData.query}</strong></td></tr>
              
              {/* Dynamic Viewport Age Coloring */}
              <tr>
                <td style={styles.tdLabel}>Viewport Age</td>
                <td style={styles.tdValue}>
                  <span style={{color: taskData.viewportAge === 'STALE' ? '#ef4444' : '#10b981', fontWeight: 'bold'}}>
                    {taskData.viewportAge}
                  </span>
                </td>
              </tr>
              
              <tr><td style={styles.tdLabel}>Locale</td><td style={styles.tdValue}>{taskData.locale}</td></tr>
              <tr><td style={styles.tdLabel}>Country</td><td style={styles.tdValue}>{taskData.country}</td></tr>
              <tr><td style={styles.tdLabel}>User Lat, Lng</td><td style={styles.tdValue}>{userStr}</td></tr>
            </tbody>
          </table>

          {/* Navigational Question */}
          <div style={styles.navigationalBox}>
            <span style={{ fontSize: '14px', color: '#333' }}>Is there a navigational result for this query?</span>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
              <label style={styles.radioLabel}>
                <input type="radio" name="isNav" value="Yes" checked={answers.isNavigational === 'Yes'} onChange={(e) => handleGlobalChange('isNavigational', e.target.value)} disabled={isSubmitted}/> Yes
              </label>
              <label style={styles.radioLabel}>
                <input type="radio" name="isNav" value="No" checked={answers.isNavigational === 'No'} onChange={(e) => handleGlobalChange('isNavigational', e.target.value)} disabled={isSubmitted}/> No
              </label>
            </div>
            {isSubmitted && answers.isNavigational !== taskData.isNavigational && (
              <div style={styles.inlineError}>Correct Answer: {taskData.isNavigational}</div>
            )}
          </div>

          <hr style={styles.divider} />

          {/* Result Cards */}
          {taskData.results.map((res, index) => {
            const raterAns = answers[res.resultId];
            const gold = res.goldStandard;
            const headerColor = pinColors[index] || '#8b5cf6';
            
            // Calculate precise distances using the Haversine formula
           // 1. Calculate Distance to User normally
            const distToUser = calculateDistance(taskData.userLocation.lat, taskData.userLocation.lng, res.lat, res.lng);
            
            // 2. Define Viewport Boundaries
            const vLat = taskData.viewportCenter.lat;
            const vLng = taskData.viewportCenter.lng;
            const vOffset = taskData.viewportSizeOffset;
            
            const isInsideViewport = (
              res.lat >= (vLat - vOffset) &&
              res.lat <= (vLat + vOffset) &&
              res.lng >= (vLng - vOffset) &&
              res.lng <= (vLng + vOffset)
            );

            // 3. Set to 0 if inside, otherwise calculate distance
            const distToViewport = isInsideViewport 
              ? "0.000" 
              : calculateDistance(vLat, vLng, res.lat, res.lng);

            return (
              <div key={res.resultId} style={styles.resultCard}>
                
                {/* Result Header */}
                <div style={{...styles.resultHeader, backgroundColor: headerColor}}>
                  {index + 1}. {res.name}
                </div>

                {/* Result Data Table */}
                <table style={styles.dataTable}>
                  <tbody>
                    <tr><td style={styles.tdLabel}>Address</td><td style={styles.tdValue}>{res.address}</td></tr>
                    <tr><td style={styles.tdLabel}>Classification</td><td style={styles.tdValue}>{res.classification}</td></tr>

                    <tr><td style={styles.tdLabel}>Type</td><td style={styles.tdValue}>{res.type}</td></tr>

                    {/* Distance to User & Viewport calculations */}
                    <tr><td style={styles.tdLabel}>Distance to User</td><td style={styles.tdValue}>{distToUser} km</td></tr>
                    <tr><td style={styles.tdLabel}>Distance to Viewport</td><td style={styles.tdValue}>{distToViewport} km</td></tr>
                    
                    <tr><td style={styles.tdLabel}>Lat, Lng</td><td style={styles.tdValue}>{res.lat}, {res.lng}</td></tr>
                  </tbody>
                </table>

                {/* Form Controls */}
                <div style={styles.ratingSection}>
                  <label style={styles.checkboxItem}>
                    <input type="checkbox" checked={raterAns.unexpectedLanguage} onChange={() => handleAnswerChange(res.resultId, 'unexpectedLanguage', !raterAns.unexpectedLanguage)} disabled={isSubmitted} />
                    Result name/title is in unexpected language or script
                  </label>
                  <label style={{...styles.checkboxItem, fontWeight: 'bold'}}>
                    <input type="checkbox" checked={raterAns.poiClosed} onChange={() => handleAnswerChange(res.resultId, 'poiClosed', !raterAns.poiClosed)} disabled={isSubmitted} />
                    Business/POI is closed or does not exist
                  </label>

                  <div style={styles.formGroup}>
                    <label style={styles.inputLabel}>Relevance</label>
                    <select style={getFeedbackStyle(res.resultId, 'relevance', gold.relevance)} value={raterAns.relevance} onChange={(e) => handleAnswerChange(res.resultId, 'relevance', e.target.value)} disabled={isSubmitted}>
                      <option value="" disabled hidden></option>
                      <option value="Navigational">Navigational</option>
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Acceptable">Acceptable</option>
                      <option value="Bad">Bad</option> 
                      {/* Removed Poor from dropdown */}
                    </select>
                    {isSubmitted && raterAns.relevance !== gold.relevance && <div style={styles.inlineError}>Correct: {gold.relevance}</div>}
                    
                    {/* Removed Poor from included check */}
                    {['Good', 'Acceptable', 'Bad'].includes(raterAns.relevance) && (
                      <div style={styles.subCheckboxes}>
                        <label style={styles.checkboxItem}><input type="checkbox" checked={raterAns.relUserIntent} onChange={() => handleAnswerChange(res.resultId, 'relUserIntent', !raterAns.relUserIntent)} disabled={isSubmitted} /> User intent issue</label>
                        <label style={styles.checkboxItem}><input type="checkbox" checked={raterAns.relDistance} onChange={() => handleAnswerChange(res.resultId, 'relDistance', !raterAns.relDistance)} disabled={isSubmitted} /> Distance/Prominence issue</label>
                      </div>
                    )}
                  </div>

                  <div style={{...styles.formGroup, opacity: raterAns.poiClosed ? 0.5 : 1 }}>
                    <label style={styles.inputLabel}>Name Accuracy</label>
                    <select style={getFeedbackStyle(res.resultId, 'nameAcc', gold.nameAccuracy)} value={raterAns.nameAcc} onChange={(e) => handleAnswerChange(res.resultId, 'nameAcc', e.target.value)} disabled={isSubmitted || raterAns.poiClosed}>
                      <option value="" disabled hidden></option>
                      <option value="n/a">n/a</option><option value="Correct">Correct</option><option value="Partially Correct">Partially Correct</option><option value="Incorrect">Incorrect</option><option value="Can't Verify">Can't Verify</option>
                    </select>
                    {isSubmitted && !raterAns.poiClosed && raterAns.nameAcc !== gold.nameAccuracy && <div style={styles.inlineError}>Correct: {gold.nameAccuracy}</div>}
                    
                    {/* BUG FIXED: Uses raterAns instead of res so checkboxes actually show up! */}
                    {(raterAns.nameAcc === 'Incorrect' || raterAns.nameAcc === 'Partially Correct') && !raterAns.poiClosed && (
                      <div style={styles.subCheckboxes}>
                        <label style={styles.checkboxItem}><input type="checkbox" checked={raterAns.nameIssue} onChange={() => handleAnswerChange(res.resultId, 'nameIssue', !raterAns.nameIssue)} disabled={isSubmitted} /> Name Issue</label>
                        <label style={styles.checkboxItem}><input type="checkbox" checked={raterAns.categoryIssue} onChange={() => handleAnswerChange(res.resultId, 'categoryIssue', !raterAns.categoryIssue)} disabled={isSubmitted} /> Category Issue</label>
                      </div>
                    )}
                  </div>

                  <div style={{...styles.formGroup, opacity: raterAns.poiClosed ? 0.5 : 1 }}>
                    <label style={styles.inputLabel}>Address Accuracy</label>
                    <select style={getFeedbackStyle(res.resultId, 'addressAcc', gold.addressAccuracy)} value={raterAns.addressAcc} onChange={(e) => handleAnswerChange(res.resultId, 'addressAcc', e.target.value)} disabled={isSubmitted || raterAns.poiClosed}>
                      <option value="" disabled hidden></option>
                      <option value="Correct">Correct</option><option value="Correct with formatting issue">Correct with formatting issue</option><option value="Incorrect">Incorrect</option><option value="Can't Verify">Can't Verify</option>
                    </select>
                    {isSubmitted && !raterAns.poiClosed && raterAns.addressAcc !== gold.addressAccuracy && <div style={styles.inlineError}>Correct: {gold.addressAccuracy}</div>}
                    
                    {/* BUG FIXED: Uses raterAns instead of res! */}
                    {raterAns.addressAcc === 'Incorrect' && !raterAns.poiClosed && (
                      <div style={{ ...styles.subCheckboxes, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                        {[
                          { key: 'streetNum', label: 'Street Number' }, { key: 'unit', label: 'Unit/Apt' }, { key: 'streetName', label: 'Street Name' },
                          { key: 'subLoc', label: 'Sub-Locality' }, { key: 'loc', label: 'Locality' }, { key: 'region', label: 'Region/State' },
                          { key: 'postal', label: 'Postal Code' }, { key: 'country', label: 'Country' }, { key: 'notExist', label: 'Address does not exist' },
                          { key: 'lang', label: 'Language/Script issue' }, { key: 'countrySpecific', label: 'Country specific issue' }, { key: 'other', label: 'Other Issue' }
                        ].map((error) => (
                          <label key={error.key} style={styles.checkboxItem}>
                            <input 
                              type="checkbox" 
                              checked={raterAns.addrErrors[error.key]} 
                              onChange={() => {
                                if (isSubmitted) return;
                                const newErrors = { ...raterAns.addrErrors, [error.key]: !raterAns.addrErrors[error.key] };
                                setAnswers(prev => ({ ...prev, [res.resultId]: { ...prev[res.resultId], addrErrors: newErrors } }));
                              }} 
                              disabled={isSubmitted} 
                            /> {error.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{...styles.formGroup, opacity: raterAns.poiClosed ? 0.5 : 1 }}>
                    <label style={styles.inputLabel}>Pin Accuracy</label>
                    <select style={getFeedbackStyle(res.resultId, 'pinAcc', gold.pinAccuracy)} value={raterAns.pinAcc} onChange={(e) => handleAnswerChange(res.resultId, 'pinAcc', e.target.value)} disabled={isSubmitted || raterAns.poiClosed}>
                      <option value="" disabled hidden></option>
                      <option value="Perfect">Perfect</option><option value="Approximate">Approximate</option><option value="Next Door">Next Door</option><option value="Wrong">Wrong</option><option value="Can't Verify">Can't Verify</option>
                    </select>
                    {isSubmitted && !raterAns.poiClosed && raterAns.pinAcc !== gold.pinAccuracy && <div style={styles.inlineError}>Correct: {gold.pinAccuracy}</div>}
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.inputLabel}>Comment and Link</label>
                    <textarea 
                      style={styles.textarea} 
                      value={raterAns.comment} 
                      onChange={(e) => handleAnswerChange(res.resultId, 'comment', e.target.value)} 
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
  container: { height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif', backgroundColor: '#ffffff' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#555' },
  
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #d1d5db', padding: '8px 16px', backgroundColor: '#ffffff', minHeight: '60px' },
  topBarLeft: { display: 'flex', gap: '32px' },
  headerBlock: { display: 'flex', flexDirection: 'column' },
  headerLabel: { fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '2px' },
  headerValue: { fontSize: '14px', color: '#111827', fontWeight: '500' },
  topBarRight: { display: 'flex', gap: '12px', alignItems: 'center' },
  scoreDisplay: { fontWeight: 'bold', color: '#16a34a', marginRight: '12px', fontSize: '16px' },
  
  btnBlue: { backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' },
  btnLight: { backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', padding: '8px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' },
  btnGreen: { backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' },
  
  mainContent: { display: 'flex', flex: 1, overflow: 'hidden' },
  mapColumn: { flex: '1.4', borderRight: '1px solid #d1d5db', position: 'relative' },
  formColumn: { flex: '1', overflowY: 'auto', padding: '16px', backgroundColor: '#ffffff' },

  dataTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '13px' },
  tdLabel: { border: '1px solid #e5e7eb', padding: '8px 12px', color: '#374151', fontWeight: 'bold', width: '30%', backgroundColor: '#f9fafb' },
  tdValue: { border: '1px solid #e5e7eb', padding: '8px 12px', color: '#111827', width: '70%' },

  navigationalBox: { margin: '8px 0 16px 0' },
  radioLabel: { fontSize: '13px', color: '#111827', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },
  divider: { border: 'none', borderTop: '2px solid #e5e7eb', margin: '24px 0' },

  resultCard: { border: '1px solid #e5e7eb', borderRadius: '4px', marginBottom: '24px', overflow: 'hidden' },
  resultHeader: { padding: '10px 16px', color: 'white', fontWeight: 'bold', fontSize: '15px' },
  
  ratingSection: { padding: '16px', borderTop: '1px solid #e5e7eb' },
  checkboxItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', cursor: 'pointer', marginBottom: '8px' },
  
  formGroup: { marginTop: '16px' },
  inputLabel: { fontSize: '13px', color: '#4b5563', marginBottom: '4px', display: 'block' },
  select: { width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', backgroundColor: 'white', color: '#111827', outline: 'none' },
  textarea: { width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', minHeight: '60px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  
  subCheckboxes: { paddingLeft: '8px', marginTop: '6px' },
  inlineError: { color: '#ef4444', fontSize: '12px', fontWeight: 'bold', marginTop: '4px' }
};