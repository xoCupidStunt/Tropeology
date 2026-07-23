import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { randomTagline } from './taglines';

export default function Auth() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [tagline] = useState(randomTagline);

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
        <img src="/logo.png" alt="Tropeology" style={styles.logo} />
        <p style={styles.tagline}>{tagline}</p>

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
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e100d', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", fontWeight: 500, padding: 16 },
  card: { background: '#211e1e', borderRadius: 16, padding: 32, width: '100%', maxWidth: 360, color: '#b9a5b0' },
  logo: { display: 'block', width: 160, height: 'auto', margin: '0 auto' },
  tagline: { color: '#939894', fontSize: 13, fontStyle: 'italic', margin: '4px 0 20px', textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11.5, color: '#939894', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 8 },
  input: { background: '#0e100d', border: '1px solid rgba(185,165,176,0.14)', color: '#b9a5b0', borderRadius: 8, padding: '9px 10px', fontSize: 16, fontFamily: 'inherit' },
  error: { color: '#cf5969', fontSize: 12.5, margin: '4px 0 0' },
  message: { color: '#e1c1e1', fontSize: 12.5, margin: '4px 0 0' },
  btn: { background: '#a97e97', color: '#0e100d', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 14 },
  switchBtn: { background: 'none', border: 'none', color: '#a97e97', fontSize: 12.5, marginTop: 18, cursor: 'pointer', textDecoration: 'underline', width: '100%', textAlign: 'center' },
};
