import { useNavigate } from 'react-router-dom'

const Navbar = () => {
    const navigate = useNavigate()
    const user = JSON.parse(localStorage.getItem('user'))

    const handleLogout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/')
    }

    return (
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-indigo-600">DriveIQ</h1>
            <div className="flex items-center gap-4">
                <img
                    src={user?.avatar}
                    alt={user?.name}
                    className="w-8 h-8 rounded-full"
                />
                <span className="text-sm text-gray-700">{user?.name}</span>
                <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-gray-700 transition"
                >
                    Logout
                </button>
            </div>
        </div>
    )
}

export default Navbar