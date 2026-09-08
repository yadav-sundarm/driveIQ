import { googleLogin } from '../services/auth.services'

const Login = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-lg w-full max-w-md text-center">
                <h1 className="text-2xl font-medium text-slate-100 mb-1 font-mono">DriveIQ</h1>
                <p className="text-slate-500 text-sm mb-8">Google Drive, organized by an ML pipeline</p>
                <button
                    onClick={googleLogin}
                    className="flex items-center justify-center gap-3 w-full border border-teal-700 text-teal-400 rounded px-6 py-3 text-sm font-medium hover:bg-teal-950/50 transition"
                >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                    Continue with Google
                </button>
                <p className="text-xs text-slate-600 mt-6">
                    DriveIQ will access your Google Drive to organize files automatically.
                </p>
            </div>
        </div>
    )
}

export default Login