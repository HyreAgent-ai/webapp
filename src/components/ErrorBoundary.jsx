import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info?.componentStack);
    this.setState({ info });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d1117',
          color: '#e6edf3',
          fontFamily: "'Inter', system-ui, sans-serif",
          padding: 32,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 520 }}>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
              Something went wrong
            </div>
            <div style={{
              fontSize: 13,
              color: '#8b949e',
              marginBottom: 6,
              fontFamily: "'Courier New', monospace",
              background: '#161b22',
              padding: '10px 16px',
              borderRadius: 8,
              textAlign: 'left',
              border: '1px solid #30363d',
              wordBreak: 'break-word',
            }}>
              {this.state.error.message}
            </div>
            <div style={{ fontSize: 12, color: '#484f58', marginBottom: 24 }}>
              This error has been logged to the console.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '9px 22px',
                background: '#58a6ff',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
