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

    if (loading) return <p className="text-slate-500 font-mono text-sm">loading...</p>

    return (
        <div className="min-h-screen bg-slate-950">
            <h1 className="text-lg font-medium text-slate-100 mb-6">
                pending confirmations <span className="text-slate-500 font-mono text-sm">// {actions.length}</span>
            </h1>
            {actions.length === 0 ? (
                <p className="text-slate-500 text-sm">No pending actions. Your Drive is organized.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {actions.map(action => (
                        <div key={action._id} className="bg-slate-900 border border-slate-800 rounded p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-mono text-sm text-slate-100">{action.fileName}</p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        -&gt; <span className="text-teal-400">
                                            {action.category}{action.subject ? ` / ${action.subject}` : ''}
                                        </span>
                                        <span className="ml-3 font-mono text-xs text-slate-500">
                                            [{Math.round(action.confidence * 100) / 100}]
                                        </span>
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleConfirm(action._id)}
                                        className="border border-teal-700 text-teal-400 px-4 py-2 rounded text-sm hover:bg-teal-950/50 transition"
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        onClick={() => handleReject(action._id)}
                                        className="border border-red-800 text-red-400 px-4 py-2 rounded text-sm hover:bg-red-950/50 transition"
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