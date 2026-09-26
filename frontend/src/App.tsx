import { useEffect, useState } from 'react'
import { API_BASE_URL } from './config'

// A component is just a function that returns JSX (HTML-like syntax).
function App() {
  // useState: a value React remembers between renders.
  // Changing it (via the setter) makes React re-render this component.
  // <string | null> is a TypeScript "generic": the state is either a string or null.
  const [apiTitle, setApiTitle] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // useEffect: run side effects (like network calls) AFTER render.
  // The [] dependency array means "run once, when the component first appears".
  useEffect(() => {
    fetch(`${API_BASE_URL}/openapi.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { info: { title: string } }) => setApiTitle(data.info.title))
      .catch((err: unknown) => setError(String(err)))
  }, [])

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Cruise Report Manager!!!!!!!!</h1>
      <p>API base URL: <code>{API_BASE_URL}</code></p>
      {error && <p style={{ color: 'crimson' }}>Backend unreachable: {error}</p>}
      {apiTitle && <p style={{ color: 'green' }}>Connected to: {apiTitle}</p>}
      {!error && !apiTitle && <p>Connecting…</p>}
    </main>
  )
}

export default App