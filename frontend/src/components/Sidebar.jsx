import { useNavigate, useLocation } from 'react-router-dom'

const links = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Confirmations', path: '/confirmations' },
    { label: 'Categories', path: '/categories' },
    { label: 'History', path: '/history' },
    { label: 'Drive Explorer', path: '/drive' },
]

const Sidebar = () => {
    const navigate = useNavigate()
    const location = useLocation()

    return (
        <div className="w-56 bg-white border-r border-gray-100 min-h-screen p-4 flex flex-col gap-1">
            {links.map(link => (
                <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`text-left px-4 py-2.5 rounded-lg text-sm transition ${location.pathname === link.path
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    {link.label}
                </button>
            ))}
        </div>
    )
}

export default Sidebar