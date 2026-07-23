import React, { useState } from 'react';
import { BookMarked } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function Auth() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email to confirm your account, then sign in below.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.wordmark}><BookMarked size={22} /> Tropeology</div>
        <p style={styles.tagline}>Every book, every note, every streak.</p>

        <form onSubmit={submit} style={styles.form}>
          <label style={styles.label}>Email</label>
          <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />

          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />

          {error && <p style={styles.error}>{error}</p>}
          {message && <p style={styles.message}>{message}</p>}

          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          style={styles.switchBtn}
          onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setMessage(''); }}
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E2B24', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", padding: 16 },
  card: { background: '#263B31', borderRadius: 16, padding: 32, width: '100%', maxWidth: 360, color: '#F3ECDD' },
  wordmark: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: "Georgia, 'Iowan Old Style', serif", fontSize: 24, fontWeight: 600, color: '#C9A24B' },
  tagline: { color: '#93A896', fontSize: 13, fontStyle: 'italic', margin: '4px 0 20px' },
  form: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11.5, color: '#93A896', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 8 },
  input: { background: '#1E2B24', border: '1px solid rgba(243,236,221,0.14)', color: '#F3ECDD', borderRadius: 8, padding: '9px 10px', fontSize: 14, fontFamily: 'inherit' },
  error: { color: '#E27A63', fontSize: 12.5, margin: '4px 0 0' },
  message: { color: '#8FD6CC', fontSize: 12.5, margin: '4px 0 0' },
  btn: { background: '#C9A24B', color: '#241B08', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 14 },
  switchBtn: { background: 'none', border: 'none', color: '#C9A24B', fontSize: 12.5, marginTop: 18, cursor: 'pointer', textDecoration: 'underline', width: '100%', textAlign: 'center' },
};
