import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MapViewport from '../components/MapViewport';

export default function Simulator() {
  const { taskType } = useParams();
  const navigate = useNavigate();
  
  const [taskData, setTaskData] = useState({
    id: "01G8HARNE4D1QKY1...",
    query: "Bata showroom near me",
    resultName: "Bata Velachery",
    address: "Velachery Tambaram Main Road, Chennai, Tamil Nadu",
    lat: 12.973815,
    lng: 80.220053,
    aet: 190
  });

  // 1. Updated state to include nested address errors
  const [answers, setAnswers] = useState({
    relevance: '',
    nameAccuracy: '',
    addressAccuracy: '',
    addressErrors: {
      streetNumber: false,
      streetName: false,
      subLocality: false,
      locality: false,
      postalCode: false,
      country: false
    },
    pinAccuracy: ''
  });

  // 2. Helper function to toggle individual checkboxes
  const handleCheckboxToggle = (field) => {
    setAnswers((prev) => ({
      ...prev,
      addressErrors: {
        ...prev.addressErrors,
        [field]: !prev.addressErrors[field]
      }
    }));
  };

  const handleSubmit = () => {
    console.log("Submitting to database:", answers);
    alert("Task submitted! Check the console for the JSON payload.");
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.badge}>Task Type: {taskType.toUpperCase()}</span>
          <span style={styles.taskId}>ID: {taskData.id}</span>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.releaseBtn} onClick={() => navigate('/dashboard')}>Release Survey</button>
          <button style={styles.submitBtn} onClick={handleSubmit}>Submit Rating</button>
        </div>
      </header>

      <div style={styles.workspace}>
        <div style={styles.leftPane}>
          <div style={styles.intentPanel}>
            <strong>User Query:</strong> "{taskData.query}"
          </div>
          <div style={styles.mapWrapper}>
            <MapViewport 
              lat={taskData.lat} 
              lng={taskData.lng} 
              resultName={taskData.resultName} 
              address={taskData.address} 
            />
          </div>
        </div>

        <div style={styles.rightPane}>
          <div style={styles.dataCard}>
            <h3 style={styles.cardTitle}>1. {taskData.resultName}</h3>
            <table style={styles.dataTable}>
              <tbody>
                <tr><td style={styles.tdLabel}>Address</td><td style={styles.tdValue}>{taskData.address}</td></tr>
                <tr><td style={styles.tdLabel}>Lat, Lng</td><td style={styles.tdValue}>{taskData.lat}, {taskData.lng}</td></tr>
              </tbody>
            </table>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Relevance</label>
            <select style={styles.select} value={answers.relevance} onChange={(e) => setAnswers({...answers, relevance: e.target.value})}>
              <option value="">Select rating...</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Acceptable">Acceptable</option>
              <option value="Poor">Poor</option>
              <option value="Bad">Bad</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Name Accuracy</label>
            <select style={styles.select} value={answers.nameAccuracy} onChange={(e) => setAnswers({...answers, nameAccuracy: e.target.value})}>
              <option value="">Select rating...</option>
              <option value="Correct">Correct</option>
              <option value="Incorrect">Incorrect</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Address Accuracy</label>
            <select style={styles.select} value={answers.addressAccuracy} onChange={(e) => setAnswers({...answers, addressAccuracy: e.target.value})}>
              <option value="">Select rating...</option>
              <option value="Correct">Correct</option>
              <option value="Incorrect">Incorrect</option>
            </select>
          </div>

          {/* 3. The Conditional Checkbox Block */}
          {answers.addressAccuracy === 'Incorrect' && (
            <div style={styles.conditionalBlock}>
              <label style={styles.checkboxItem}>
                <input type="checkbox" checked={answers.addressErrors.streetNumber} onChange={() => handleCheckboxToggle('streetNumber')} />
                Street Number
              </label>
              <label style={styles.checkboxItem}>
                <input type="checkbox" checked={answers.addressErrors.streetName} onChange={() => handleCheckboxToggle('streetName')} />
                Street Name
              </label>
              <label style={styles.checkboxItem}>
                <input type="checkbox" checked={answers.addressErrors.subLocality} onChange={() => handleCheckboxToggle('subLocality')} />
                Sub-Locality
              </label>
              <label style={styles.checkboxItem}>
                <input type="checkbox" checked={answers.addressErrors.locality} onChange={() => handleCheckboxToggle('locality')} />
                Locality
              </label>
              <label style={styles.checkboxItem}>
                <input type="checkbox" checked={answers.addressErrors.postalCode} onChange={() => handleCheckboxToggle('postalCode')} />
                Postal Code
              </label>
              <label style={styles.checkboxItem}>
                <input type="checkbox" checked={answers.addressErrors.country} onChange={() => handleCheckboxToggle('country')} />
                Country
              </label>
            </div>
          )}

          <div style={styles.formGroup}>
            <label style={styles.label}>Pin Accuracy</label>
            <select style={styles.select} value={answers.pinAccuracy} onChange={(e) => setAnswers({...answers, pinAccuracy: e.target.value})}>
              <option value="">Select rating...</option>
              <option value="Exact">Exact</option>
              <option value="Approximate">Approximate</option>
              <option value="Incorrect">Incorrect</option>
            </select>
          </div>

        </div>
      </div>
    </div>
  );
}

// Updated styles to include the indented conditional block
const styles = {
  container: { height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' },
  header: { height: '60px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px' },
  headerLeft: { display: 'flex', gap: '16px', alignItems: 'center' },
  badge: { backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: '#475569' },
  taskId: { fontSize: '12px', color: '#64748b' },
  headerRight: { display: 'flex', gap: '12px' },
  releaseBtn: { backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' },
  submitBtn: { backgroundColor: '#22c55e', border: 'none', color: 'white', padding: '8px 24px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  workspace: { display: 'flex', flex: 1, overflow: 'hidden' },
  leftPane: { flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0' },
  intentPanel: { padding: '16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '15px' },
  mapWrapper: { flex: 1, backgroundColor: '#e2e8f0' }, 
  rightPane: { flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: '#ffffff', maxWidth: '600px' },
  dataCard: { border: '1px solid #c4b5fd', borderRadius: '6px', marginBottom: '24px', overflow: 'hidden' },
  cardTitle: { margin: 0, backgroundColor: '#8b5cf6', color: 'white', padding: '12px 16px', fontSize: '16px' },
  dataTable: { width: '100%', borderCollapse: 'collapse' },
  tdLabel: { padding: '12px 16px', borderBottom: '1px solid #e2e8f0', color: '#64748b', width: '30%', fontSize: '14px' },
  tdValue: { padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: '500', fontSize: '14px' },
  formGroup: { marginBottom: '20px' },
  label: { display: 'block', marginBottom: '8px', fontSize: '14px', color: '#475569' },
  select: { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '15px' },
  // New styles for the sub-menu
  conditionalBlock: { paddingLeft: '16px', borderLeft: '2px solid #cbd5e1', marginLeft: '8px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  checkboxItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155', cursor: 'pointer' }
};