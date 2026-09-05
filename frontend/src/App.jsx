import Layout from './components/Layout'
import { BrowserRouter as Router, Routes, Route, useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Confirmations from './pages/Confirmations'
import Categories from './pages/Categories'
import History from './pages/History'
import ProtectedRoute from './components/ProtectedRoute'
import DriveTree from './pages/DriveTree'

const TokenHandler = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      localStorage.setItem('token', token)
      window.history.replaceState({}, '', '/dashboard')
      navigate('/dashboard', { replace: true })
    }
  }, [])

  return null
}

function App() {
  return (
    <Router>
      <TokenHandler />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={
          <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
        } />
        <Route path="/confirmations" element={
          <ProtectedRoute><Layout><Confirmations /></Layout></ProtectedRoute>
        } />
        <Route path="/categories" element={
          <ProtectedRoute><Layout><Categories /></Layout></ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute><Layout><History /></Layout></ProtectedRoute>
        } />
        <Route path="/drive" element={
          <ProtectedRoute><Layout><DriveTree /></Layout></ProtectedRoute>
        } />
      </Routes>
    </Router>
  )
}

export default App