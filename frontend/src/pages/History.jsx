import { useState, useEffect } from 'react'
import { getFileHistory } from '../services/drive.services'

const History = () => {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const data = await getFileHistory()
                setHistory(data)
            } catch (error) {
                console.error('Error fetching history:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchHistory()
    }, [])

    if (loading) return <p>Loading...</p>

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">File History</h1>
            {history.length === 0 ? (
                <p className="text-gray-500">No file actions yet.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {history.map(action => (
                        <div key={action._id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-900">{action.fileName}</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Moved to → <span className="text-indigo-600">{action.category}</span>
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {new Date(action.createdAt).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                <span className={`text-xs px-3 py-1 rounded-full font-medium ${action.status === 'confirmed'
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-red-50 text-red-700'
                                    }`}>
                                    {action.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default History