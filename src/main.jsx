import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import PreferencesWindow from './components/PreferencesWindow'
import './index.css'  // <--- 确保这一行存在！

const isPreferencesWindow = window.location.hash === '#preferences';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isPreferencesWindow ? <PreferencesWindow /> : <App />}
  </React.StrictMode>,
)
