import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getMe } from '../services/auth.services'

const Dashboard = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [user, setUser] = useState(null)

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const data = await getMe()
                setUser(data)
                localStorage.setItem('user', JSON.stringify(data))
            } catch (error) {
                console.error('Error fetching user:', error)
                navigate('/')
            }
        }
        fetchUser()
    }, [])

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <h1 className="text-2xl font-bold text-gray-900">
                Welcome, {user?.name || 'Loading...'}
            </h1>
            <p className="text-gray-500 mt-1">Your Drive is being watched for new files.</p>
            <div className="grid grid-cols-3 gap-6 mt-8">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Pending Actions</p>
                    <p className="text-3xl font-bold text-indigo-600 mt-1">0</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Files Organized</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">0</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Categories</p>
                    <p className="text-3xl font-bold text-purple-600 mt-1">0</p>
                </div>
            </div>
        </div>
    )
}

export default Dashboard