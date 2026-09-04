import { googleLogin } from '../services/auth.services'

const Login = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white p-10 rounded-2xl shadow-md w-full max-w-md text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">DriveIQ</h1>
                <p className="text-gray-500 mb-8">Smart Google Drive Organizer</p>
                <button
                    onClick={googleLogin}
                    className="flex items-center justify-center gap-3 w-full border border-gray-300 rounded-lg px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                    Continue with Google
                </button>
                <p className="text-xs text-gray-400 mt-6">
                    DriveIQ will access your Google Drive to organize files automatically.
                </p>
            </div>
        </div>
    )
}

export default Login