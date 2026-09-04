import { Navigate, useSearchParams } from 'react-router-dom'

const ProtectedRoute = ({ children }) => {
    const [searchParams] = useSearchParams()
    const urlToken = searchParams.get('token')

    if (urlToken) {
        localStorage.setItem('token', urlToken)
    }

    const token = localStorage.getItem('token')
    if (!token) return <Navigate to="/" replace />
    return children
}

export default ProtectedRoute