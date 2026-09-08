import { useState, useEffect } from 'react'
import { getThreshold, updateThreshold, getTrainingStatus } from '../services/user.services'

const Settings = () => {
    const [threshold, setThreshold] = useState(0.8)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [mlStatus, setMlStatus] = useState(null)

    useEffect(() => {
        const fetchThreshold = async () => {
            try {
                const data = await getThreshold()
                setThreshold(data.confidenceThreshold)
            } catch (error) {
                console.error('Error fetching threshold:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchThreshold()

        const fetchStatus = async () => {
            try {
                const status = await getTrainingStatus()
                setMlStatus(status)
            } catch (error) {
                console.error('Error fetching ML status:', error)
                setMlStatus({
                    trained: false,
                    detail: "Couldn't load smart suggestions status.",
                })
            }
        }
        fetchStatus()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        setSaved(false)
        try {
            await updateThreshold(threshold)
            setSaved(true)
        } catch (error) {
            console.error('Error saving threshold:', error)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <p className="text-slate-500 font-mono text-sm">loading...</p>

    return (
        <div className="min-h-screen bg-slate-950 max-w-xl">
            <h1 className="text-lg font-medium text-slate-100 mb-6">settings</h1>

            <div className="bg-slate-900 border border-slate-800 rounded p-6">
                <p className="font-medium text-slate-100 mb-1 text-sm">Auto-organize confidence threshold</p>
                <p className="text-sm text-slate-500 mb-4">
                    Files classified above this confidence are moved automatically, with no confirmation needed.
                    Files below 50% confidence are flagged for manual review instead of showing a normal suggestion.
                </p>

                <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-600 w-28 font-mono">always confirm</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={threshold}
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                        className="flex-1 accent-teal-500"
                    />
                    <span className="text-xs text-slate-600 w-28 text-right font-mono">auto-move all</span>
                </div>

                <p className="text-center text-teal-400 font-mono font-medium mt-2">
                    [{Math.round(threshold * 100)}%]
                </p>

                {mlStatus && (
                    <div className="mt-6 pt-4 border-t border-slate-800">
                        <p className="font-medium text-slate-100 mb-1 text-sm font-mono">smart_suggestions</p>
                        {mlStatus.trained ? (
                            <div>
                                <p className="text-sm text-teal-400 font-mono">[active]</p>
                                <p className="text-sm text-slate-500 mt-1">
                                    Trained on: {mlStatus.eligible_categories.join(', ')}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-sm text-amber-400 font-mono">[not yet active]</p>
                                <p className="text-sm text-slate-500 mt-1">{mlStatus.detail}</p>
                            </div>
                        )}
                    </div>
                )}

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="mt-6 border border-teal-700 text-teal-400 px-4 py-2 rounded text-sm hover:bg-teal-950/50 transition disabled:opacity-50"
                >
                    {saving ? 'saving...' : 'Save'}
                </button>
                {saved && <span className="ml-3 text-sm text-teal-400 font-mono">saved</span>}
            </div>
        </div>
    )
}

export default Settings