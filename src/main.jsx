import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import CultureQuiz from './features/CultureQuiz/CultureQuiz.jsx'
import './index.css'

// The public culture quiz lives outside the logged-in app so anyone can open the link.
const isQuizPage = window.location.pathname.replace(/\/+$/, '') === '/culture-quiz'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isQuizPage ? <CultureQuiz /> : <App />}
  </React.StrictMode>,
)
