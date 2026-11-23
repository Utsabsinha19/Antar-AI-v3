import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Antar AI Error Boundary Caught Error]:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('antar_theme');
      localStorage.removeItem('antar_reports_cache_v2');
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#090D16',
          color: '#F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #06B6D4, #3B82F6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '20px'
              }}>
                🧠
              </div>
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#FFFFFF' }}>
                  Antar <span style={{ color: '#22D3EE' }}>AI</span> Workspace
                </h1>
                <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>Runtime Diagnostics & Recovery Protocol</p>
              </div>
            </div>

            <div style={{
              backgroundColor: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '20px'
            }}>
              <p style={{ fontSize: '12px', color: '#FDA4AF', margin: '0 0 6px 0', fontWeight: '600' }}>
                Application Encountered an Unexpected Runtime State
              </p>
              <pre style={{
                fontSize: '11px',
                color: '#FECDD3',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'JetBrains Mono, monospace'
              }}>
                {this.state.error?.message || 'Unknown runtime error occurred.'}
              </pre>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#06B6D4',
                  color: '#090D16',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#E2E8F0',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  fontWeight: '600',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Reset Local Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
