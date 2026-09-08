import { useNavigate, useLocation } from 'react-router-dom'

const links = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Confirmations', path: '/confirmations' },
    { label: 'Needs Review', path: '/needs-review' },
    { label: 'Categories', path: '/categories' },
    { label: 'History', path: '/history' },
    { label: 'Drive Explorer', path: '/drive' },
    { label: 'Settings', path: '/settings' },
]

const Sidebar = () => {
    const navigate = useNavigate()
    const location = useLocation()

    return (
        <div className="w-56 bg-slate-900 border-r border-slate-800 min-h-screen p-4 flex flex-col gap-1">
            {links.map(link => (
                <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`text-left px-4 py-2.5 rounded text-sm transition font-mono border-l-2 ${location.pathname === link.path
                        ? 'bg-teal-950/60 text-teal-400 border-teal-500'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-transparent'
                        }`}
                >
                    {link.label}
                </button>
            ))}
        </div>
    )
}

export default Sidebar