import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// NOTE: no <React.StrictMode> here on purpose.
// StrictMode mounts components twice in dev, which double-initializes
// react-pageflip's internal engine and breaks the page-turn animation
// (pages detach and fly around). Rendering without it fixes the flip.
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
