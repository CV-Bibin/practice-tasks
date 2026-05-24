import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'; // <-- Added signOut
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { auth, db } from '../config/firebase'; 

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  // Listens for saved sessions and auto-redirects intelligently
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          
          if (userSnap.exists()) {
            const data = userSnap.data();
            
            // --- SECURITY CHECK: Block suspended users on auto-login ---
            if (data.status === 'suspended') {
              await signOut(auth); // Destroy session
              localStorage.removeItem('userRole'); // Clear badge
              setError("Your account has been suspended. Please contact the administrator.");
              return; // Stop them from navigating
            }
            
            const role = data.role || 'rater';
            localStorage.setItem('userRole', role); 
            navigate(role === 'admin' ? '/admin' : '/dashboard');
          } else {
            // Fallback for brand new users caught in the transition
            localStorage.setItem('userRole', 'rater');
            navigate('/dashboard');
          }
        } catch (error) {
          console.error("Error fetching session role:", error);
          navigate('/dashboard'); // Safe fallback
        }
      }
    });
    return () => unsubscribe(); // Cleanup listener on unmount
  }, [navigate]);

  // Handles the active login attempt
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Attempt to sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Look up this user in the Firestore 'users' collection
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      let userRole = 'rater'; // Default fallback
      let userStatus = 'active'; // Default to active

      if (userSnap.exists()) {
        // If they exist, grab their actual role and status
        const data = userSnap.data();
        userRole = data.role || 'rater';
        userStatus = data.status || 'active';
      } else {
        // --- AUTO-REGISTER FEATURE ---
        await setDoc(userRef, {
          email: user.email,
          role: 'rater', // Always default new people to 'rater' for security
          status: 'active', // Initialize new users as active
          createdAt: serverTimestamp()
        });
      }

      // --- SECURITY CHECK: Block suspended users on active login ---
      if (userStatus === 'suspended') {
        await signOut(auth); // Force logout immediately
        setError("Your account has been suspended. Please contact the administrator.");
        setIsLoading(false);
        return; // Stop the login process dead in its tracks!
      }

      // 3. Save the role to localStorage so ProtectedRoute can see it
      localStorage.setItem('userRole', userRole);

      // 4. The Smart Redirect
      if (userRole === 'admin') {
        navigate('/admin'); // Send admins to the Command Center
      } else {
        navigate('/dashboard'); // Send raters to their task list
      }

    } catch (err) {
      console.error(err);
      setError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Rater Portal Login</h2>
        
        {error && <div style={styles.errorBanner}>{error}</div>}

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="rater@example.com"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            style={isLoading ? { ...styles.button, opacity: 0.7 } : styles.button}
          >
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Basic inline styling for a clean, pro-level look without needing external CSS files yet
const styles = {
  container: { display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6', fontFamily: 'system-ui, sans-serif' },
  card: { backgroundColor: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
  title: { marginTop: 0, marginBottom: '24px', fontSize: '24px', color: '#1f2937', textAlign: 'center' },
  errorBanner: { backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '4px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', fontWeight: '600', color: '#4b5563' },
  input: { padding: '10px 12px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '16px' },
  button: { backgroundColor: '#2563eb', color: 'white', padding: '12px', borderRadius: '4px', border: 'none', fontSize: '16px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' }
};