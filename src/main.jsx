import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, details) { console.error('Usmans AI error:', error, details); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main style={{ fontFamily: 'system-ui', padding: 'max(24px, 5vw)', maxWidth: 800, margin: 'auto', lineHeight: 1.6 }}>
      <h1>Usman's AI could not start</h1>
      <p>The website loaded but a component failed. Your chat files have not been deleted.</p>
      <pre style={{ whiteSpace: 'pre-wrap', padding: 16, background: '#f5f5ff', borderRadius: 12 }}>{String(this.state.error.message || this.state.error)}</pre>
      <button onClick={() => window.location.reload()} style={{ padding: '12px 18px', cursor: 'pointer' }}>Reload the app</button>
      <p>For help, copy this error and the output of <code>npm.cmd run build</code>.</p>
    </main>;
  }
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
