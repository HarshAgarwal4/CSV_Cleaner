import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../zustand/store';

const Navbar = () => {
    const navigate = useNavigate();
    const user = useStore((state) => state.user);
    const logout = useStore((state) => state.logout);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/85 border-b border-slate-100/80 transition-all duration-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                {/* Brand Logo */}
                <Link to="/" className="flex items-center gap-2.5 group">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                            CleanCSV<span className="text-indigo-600">.ai</span>
                        </span>
                        <span className="text-[10px] -mt-1 font-medium text-slate-400 uppercase tracking-widest">
                            AI CSV Cleaner
                        </span>
                    </div>
                </Link>

                {/* Navigation Links */}
                <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
                    <Link to="/" className="hover:text-indigo-600 transition-colors">
                        Home
                    </Link>
                    <a href="/#features" className="hover:text-indigo-600 transition-colors">
                        Features
                    </a>
                    <a href="/#how-it-works" className="hover:text-indigo-600 transition-colors">
                        How It Works
                    </a>
                    {user && (
                        <Link to="/dashboard" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Dashboard
                        </Link>
                    )}
                </nav>

                {/* Auth Controls */}
                <div className="flex items-center gap-3">
                    {user ? (
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
                                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center uppercase text-[11px]">
                                    {user.name ? user.name[0] : 'U'}
                                </span>
                                <span className="font-medium max-w-[120px] truncate">{user.name || user.email}</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 rounded-lg transition-colors cursor-pointer"
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5">
                            <button
                                onClick={() => navigate('/login')}
                                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                            >
                                Login
                            </button>
                            <button
                                onClick={() => navigate('/signup')}
                                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                            >
                                Sign Up
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Navbar;
