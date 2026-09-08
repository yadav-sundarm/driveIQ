import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getMe } from '../services/auth.services'
import { triggerPoll, scanExisting, verifyOrganization, getPendingActions, getFileHistory } from '../services/drive.services'
import { getCategories } from '../services/category.services'

// Same mapping History.jsx already uses — kept in one place would be
// cleaner, but duplicating it here matches how the rest of the app
// currently does it rather than introducing a new shared-import pattern
// on its own.
const statusStyles = {
    confirmed: 'bg-teal-950 text-teal-400',
    auto_confirmed: 'bg-violet-950 text-violet-400',
    failed: 'bg-amber-950 text-amber-400',
    rejected: 'bg-red-950 text-red-400',
}

const leftEdgeStyles = {
    confirmed: 'border-l-teal-600',
    auto_confirmed: 'border-l-violet-600',
    failed: 'border-l-amber-600',
    rejected: 'border-l-red-600',
}

const slug = (name) => (name || '').trim().toLowerCase().replace(/\s+/g, '_')
const pad2 = (n) => String(n).padStart(2, '0')

const Dashboard = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [checking, setChecking] = useState(false)
    const [stats, setStats] = useState({ pending: 0, organized: 0, categories: 0 })
    const [recent, setRecent] = useState([])

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

        const fetchStats = async () => {
            try {
                const [pending, history, categories] = await Promise.all([
                    getPendingActions(),
                    getFileHistory(),
                    getCategories()
                ])
                setStats({
                    pending: pending.length,
                    organized: history.filter(a => a.status === 'confirmed' || a.status === 'auto_confirmed').length,
                    categories: categories.length
                })
                // history is already sorted newest-first, limit 50, server-side
                setRecent(history.slice(0, 6))
            } catch (error) {
                console.error('Stats error:', error)
            }
        }
        fetchStats()
    }, [])

    const handleCheckDrive = async () => {
        setChecking(true)
        try {
            // Sequential on purpose — avoids two functions racing to create
            // a FileAction for the same file before either write commits
            const pollResult = await triggerPoll()
            console.log('Poll result:', pollResult)

            const scanResult = await scanExisting()
            console.log('Scan result:', scanResult)

            const verifyResult = await verifyOrganization()
            console.log('Verify result:', verifyResult)
        } catch (error) {
            console.error('Check Drive failed:', error.response?.data || error.message)
        } finally {
            setChecking(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-950">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-mono text-slate-100">
                        {user ? slug(user.name) : 'loading'} <span className="text-slate-600">// dashboard</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 font-mono">watching drive, polling every 2m</p>
                </div>
                <button
                    onClick={handleCheckDrive}
                    disabled={checking}
                    className="border border-teal-700 text-teal-400 px-4 py-2 rounded text-sm font-mono hover:bg-teal-950/50 transition disabled:opacity-50"
                >
                    {checking ? 'running check_drive()...' : 'run check_drive()'}
                </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-8">
                <div className="bg-slate-900 border border-slate-800 rounded p-5">
                    <p className="text-xs text-slate-500 font-mono">pending</p>
                    <p className="text-3xl font-mono text-slate-100 mt-1">{pad2(stats.pending)}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-5">
                    <p className="text-xs text-slate-500 font-mono">organized</p>
                    <p className="text-3xl font-mono text-teal-400 mt-1">{pad2(stats.organized)}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-5">
                    <p className="text-xs text-slate-500 font-mono">categories</p>
                    <p className="text-3xl font-mono text-slate-100 mt-1">{pad2(stats.categories)}</p>
                </div>
            </div>

            <div className="mt-8">
                <p className="text-xs text-slate-500 font-mono mb-3">recent activity</p>
                {recent.length === 0 ? (
                    <p className="text-slate-600 text-sm font-mono">nothing yet — run check_drive() to scan your Drive</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {recent.map(action => (
                            <div
                                key={action._id}
                                className={`bg-slate-900 border-l-2 ${leftEdgeStyles[action.status] || 'border-l-slate-700'} border-y border-r border-slate-800 rounded px-4 py-2.5 flex items-center justify-between gap-3`}
                            >
                                <div className="min-w-0">
                                    <p className="font-mono text-sm text-slate-100 truncate">{action.fileName}</p>
                                    <p className="font-mono text-xs text-slate-500 truncate">
                                        {action.status === 'failed'
                                            ? (action.failReason || 'could not be moved automatically')
                                            : `${action.category}${action.subject ? ` / ${action.subject}` : ''}`}
                                        {typeof action.confidence === 'number' && (
                                            <span className="text-slate-600"> [{Math.round(action.confidence * 100) / 100}]</span>
                                        )}
                                    </p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded font-mono shrink-0 ${statusStyles[action.status] || 'bg-slate-800 text-slate-400'}`}>
                                    {action.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Dashboard