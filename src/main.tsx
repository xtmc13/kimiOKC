import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Component, type ReactNode } from 'react'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{color:'white',padding:'40px',fontFamily:'monospace'}}>
          <h1 style={{color:'red'}}>React Error</h1>
          <pre style={{whiteSpace:'pre-wrap'}}>{this.state.error.message}</pre>
          <pre style={{whiteSpace:'pre-wrap',fontSize:'12px',opacity:0.7}}>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
