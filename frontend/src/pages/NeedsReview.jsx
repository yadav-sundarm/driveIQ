import { useState, useEffect } from 'react'
import { getNeedsReview, confirmAction, rejectAction } from '../services/drive.services'

// This is the fixed set the ML service actually classifies into (see
// KEYWORD_PATTERNS in classifier.py) — not the user-defined Categories
// page, which only supplies keyword hints, not real move targets.
const CATEGORY_OPTIONS = [
    'Assignments', 'Notes', 'Certificates', 'Documents', 'Archives', 'Images', 'Miscellaneous'
]

const NeedsReview = () => {
    const [actions, setActions] = useState([])
    const [loading, setLoading] = useState(true)
    const [choices, setChoices] = useState({}) // { [actionId]: { category, subject } }
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

    if (loading) return <p className="p-8">Loading...</p>

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Needs Review</h1>
            <p className="text-gray-500 mb-6">
                DriveIQ wasn't confident enough to guess these on its own — pick where they belong.
            </p>

            {actions.length === 0 ? (
                <p className="text-gray-500">Nothing needs review right now.</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {actions.map((action) => {
                        const choice = getChoice(action)
                        return (
                            <div key={action._id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                <p className="font-medium text-gray-900">{action.fileName}</p>
                                <p className="text-xs text-gray-400 mb-3">
                                    Best guess was {action.category}{action.subject ? ` / ${action.subject}` : ''} at {Math.round(action.confidence * 100)}%
                                </p>

                                <div className="flex items-center gap-3">
                                    <select
                                        value={choice.category}
                                        onChange={(e) => updateChoice(action._id, 'category', e.target.value)}
                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
                                    />

                                    <button
                                        onClick={() => handleSubmit(action)}
                                        disabled={submittingId === action._id}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition disabled:opacity-50"
                                    >
                                        {submittingId === action._id ? 'Moving...' : 'Confirm'}
                                    </button>

                                    <button
                                        onClick={() => handleReject(action._id)}
                                        className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
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