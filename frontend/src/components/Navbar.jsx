import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const initials = (name) => {
    const parts = (name || '?').trim().split(/\s+/)
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

const Navbar = () => {
    const navigate = useNavigate()
    const user = JSON.parse(localStorage.getItem('user'))
    const [imgFailed, setImgFailed] = useState(false)

    const handleLogout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/')
    }

    const showImg = user?.avatar && !imgFailed

    return (
        <div className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between">
            <h1 className="text-lg font-mono font-medium text-teal-400">DriveIQ</h1>
            <div className="flex items-center gap-4">
                {showImg ? (
                    <img
                        src={user.avatar}
                        alt={user?.name}
                        onError={() => setImgFailed(true)}
                        className="w-8 h-8 rounded-full border border-slate-700"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 text-teal-400 text-xs font-mono flex items-center justify-center">
                        {initials(user?.name)}
                    </div>
                )}
                <span className="text-sm text-slate-300">{user?.name}</span>
                <button
                    onClick={handleLogout}
                    className="text-sm text-slate-500 hover:text-slate-300 transition"
                >
                    Logout
                </button>
            </div>
        </div>
    )
}

export default Navbar