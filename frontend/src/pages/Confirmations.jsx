import { useState, useEffect } from 'react'
import { getPendingActions, confirmAction, rejectAction } from '../services/drive.services'

const Confirmations = () => {
    const [actions, setActions] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchActions = async () => {
            try {
                const data = await getPendingActions()
                setActions(data)
            } catch (error) {
                console.error('Error fetching actions:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchActions()
    }, [])

    const handleConfirm = async (id) => {
        try {
            await confirmAction(id)
            setActions(actions.filter(a => a._id !== id))
        } catch (error) {
            console.error('Error confirming:', error)
        }
    }

    const handleReject = async (id) => {
        try {
            await rejectAction(id)
            setActions(actions.filter(a => a._id !== id))
        } catch (error) {
            console.error('Error rejecting:', error)
        }
    }

    if (loading) return <p>Loading...</p>

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Pending Confirmations</h1>
            {actions.length === 0 ? (
                <p className="text-gray-500">No pending actions. Your Drive is organized!</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {actions.map(action => (
                        <div key={action._id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-900">{action.fileName}</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Move to → <span className="text-indigo-600 font-medium">{action.category}</span>
                                        <span className="ml-3 text-xs text-gray-400">
                                            Confidence: {Math.round(action.confidence * 100)}%
                                        </span>
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleConfirm(action._id)}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition"
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        onClick={() => handleReject(action._id)}
                                        className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default Confirmations