import { useState, useEffect } from 'react'
import { getThreshold, updateThreshold } from '../services/user.services'

const Settings = () => {
    const [threshold, setThreshold] = useState(0.8)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

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

    if (loading) return <p className="p-8">Loading...</p>

    return (
        <div className="min-h-screen bg-gray-50 p-8 max-w-xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <p className="font-medium text-gray-900 mb-1">Auto-organize confidence threshold</p>
                <p className="text-sm text-gray-500 mb-4">
                    Files classified above this confidence are moved automatically, with no confirmation needed.
                    Files below 50% confidence are flagged for manual review instead of showing a normal suggestion.
                </p>

                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400 w-28">Always confirm</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={threshold}
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                        className="flex-1"
                    />
                    <span className="text-xs text-gray-400 w-28 text-right">Auto-move everything</span>
                </div>

                <p className="text-center text-indigo-600 font-medium mt-2">
                    {Math.round(threshold * 100)}%
                </p>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="mt-6 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save'}
                </button>
                {saved && <span className="ml-3 text-sm text-green-600">Saved</span>}
            </div>
        </div>
    )
}

export default Settings