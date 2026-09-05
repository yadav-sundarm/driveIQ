import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getMe } from '../services/auth.services'
import { triggerPoll, scanExisting } from '../services/drive.services'

const Dashboard = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [checking, setChecking] = useState(false)

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

    const handleCheckDrive = async () => {
        setChecking(true)
        try {
            // Sequential on purpose — see note above about duplicate FileActions
            const pollResult = await triggerPoll()
            console.log('Poll result:', pollResult)

            const scanResult = await scanExisting()
            console.log('Scan result:', scanResult)
        } catch (error) {
            console.error('Check Drive failed:', error.response?.data || error.message)
        } finally {
            setChecking(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Welcome, {user?.name || 'Loading...'}
                    </h1>
                    <p className="text-gray-500 mt-1">Your Drive is being watched for new files.</p>
                </div>
                <button
                    onClick={handleCheckDrive}
                    disabled={checking}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition disabled:opacity-50"
                >
                    {checking ? 'Checking Drive...' : 'Check Drive Now'}
                </button>
            </div>
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