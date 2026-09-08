import { useState, useEffect } from 'react'
import { getFileHistory } from '../services/drive.services'

const statusStyles = {
    confirmed: 'bg-teal-950 text-teal-400',
    auto_confirmed: 'bg-violet-950 text-violet-400',
    failed: 'bg-amber-950 text-amber-400',
    rejected: 'bg-red-950 text-red-400',
}

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

    if (loading) return <p className="text-slate-500 font-mono text-sm">loading...</p>

    return (
        <div className="min-h-screen bg-slate-950">
            <h1 className="text-lg font-medium text-slate-100 mb-6">file history</h1>
            {history.length === 0 ? (
                <p className="text-slate-500 text-sm">No file actions yet.</p>
            ) : (
                <div className="flex flex-col gap-2">
                    {history.map(action => (
                        <div key={action._id} className="bg-slate-900 border border-slate-800 rounded p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-mono text-sm text-slate-100">{action.fileName}</p>
                                    {action.status === 'failed' ? (
                                        <p className="text-sm text-amber-400 mt-1">
                                            {action.failReason || 'Could not be moved automatically'}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-slate-500 mt-1">
                                            -&gt; <span className="text-teal-400">{action.category}{action.subject ? ` / ${action.subject}` : ''}</span>
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-600 mt-1 font-mono">
                                        {new Date(action.createdAt).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                <span className={`text-xs px-3 py-1 rounded font-mono ${statusStyles[action.status] || 'bg-slate-800 text-slate-400'}`}>
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