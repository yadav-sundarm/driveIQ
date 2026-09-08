import { useState, useEffect } from 'react'
import { getNeedsReview, confirmAction, rejectAction } from '../services/drive.services'

const CATEGORY_OPTIONS = [
    'Assignments', 'Notes', 'Certificates', 'Documents', 'Archives', 'Images', 'Miscellaneous'
]

const NeedsReview = () => {
    const [actions, setActions] = useState([])
    const [loading, setLoading] = useState(true)
    const [choices, setChoices] = useState({})
    const [submittingId, setSubmittingId] = useState(null)

    const fetchActions = async () => {
        try {
            const data = await getNeedsReview()
            setActions(data)
        } catch (error) {
            console.error('Error fetching needs-review actions:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchActions()
    }, [])

    const getChoice = (action) => {
        const stored = choices[action._id] || {}
        return {
            category: stored.category ?? action.category ?? CATEGORY_OPTIONS[0],
            subject: stored.subject ?? action.subject ?? '',
        }
    }

    const updateChoice = (actionId, field, value) => {
        setChoices((prev) => ({
            ...prev,
            [actionId]: { ...(prev[actionId] || {}), [field]: value },
        }))
    }

    const handleSubmit = async (action) => {
        const choice = getChoice(action)
        setSubmittingId(action._id)
        try {
            await confirmAction(action._id, {
                category: choice.category,
                subject: choice.subject || null,
            })
            setActions(actions.filter((a) => a._id !== action._id))
        } catch (error) {
            console.error('Error confirming needs-review item:', error.response?.data || error.message)
        } finally {
            setSubmittingId(null)
        }
    }

    const handleReject = async (id) => {
        try {
            await rejectAction(id)
            setActions(actions.filter((a) => a._id !== id))
        } catch (error) {
            console.error('Error rejecting:', error)
        }
    }

    if (loading) return <p className="text-slate-500 font-mono text-sm">loading...</p>

    return (
        <div className="min-h-screen bg-slate-950">
            <h1 className="text-lg font-medium text-slate-100 mb-1">needs review</h1>
            <p className="text-slate-500 text-sm mb-6">
                Confidence was too low to guess automatically — pick where these belong.
            </p>

            {actions.length === 0 ? (
                <p className="text-slate-500 text-sm">Nothing needs review right now.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {actions.map((action) => {
                        const choice = getChoice(action)
                        return (
                            <div key={action._id} className="bg-slate-900 border-l-2 border-l-amber-600 border-y border-r border-slate-800 rounded p-4">
                                <p className="font-mono text-sm text-slate-100">{action.fileName}</p>
                                <p className="text-xs text-slate-500 mb-3 font-mono">
                                    best guess: {action.category}{action.subject ? ` / ${action.subject}` : ''} <span className="text-amber-400">[{Math.round(action.confidence * 100) / 100}]</span>
                                </p>

                                <div className="flex items-center gap-3">
                                    <select
                                        value={choice.category}
                                        onChange={(e) => updateChoice(action._id, 'category', e.target.value)}
                                        className="bg-slate-950 border border-slate-700 text-slate-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-teal-600"
                                    >
                                        {CATEGORY_OPTIONS.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>

                                    <input
                                        type="text"
                                        placeholder="Subject (optional)"
                                        value={choice.subject}
                                        onChange={(e) => updateChoice(action._id, 'subject', e.target.value)}
                                        className="bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-600 rounded px-3 py-2 text-sm flex-1 focus:outline-none focus:border-teal-600"
                                    />

                                    <button
                                        onClick={() => handleSubmit(action)}
                                        disabled={submittingId === action._id}
                                        className="border border-teal-700 text-teal-400 px-4 py-2 rounded text-sm hover:bg-teal-950/50 transition disabled:opacity-50"
                                    >
                                        {submittingId === action._id ? 'moving...' : 'Confirm'}
                                    </button>

                                    <button
                                        onClick={() => handleReject(action._id)}
                                        className="border border-red-800 text-red-400 px-4 py-2 rounded text-sm hover:bg-red-950/50 transition"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default NeedsReview