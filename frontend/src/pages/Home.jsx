import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useStore } from "../zustand/store";

const Home = () => {
    const navigate = useNavigate();
    const user = useStore((state) => state.user);

    const handleGetStarted = () => {
        if (user) {
            navigate("/dashboard");
        } else {
            navigate("/signup");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
            <Navbar />

            {/* Hero Section */}
            <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32">
                {/* Background decorative glows */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-indigo-200/40 via-violet-200/30 to-purple-100/20 blur-3xl -z-10 rounded-full pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-8 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                        AI-Powered CSV Cleaning Agent
                    </div>

                    {/* Headline */}
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight sm:leading-none">
                        Transform Messy CSVs Into{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                            Flawless Datasets
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
                        Stop spending hours manually fixing null values, malformed dates, and duplicate rows.
                        Upload your file and let our AI clean, standardize, and format your CSV in seconds.
                    </p>

                    {/* Action Buttons */}
                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={handleGetStarted}
                            className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            {user ? "Open CSV Cleaner Dashboard" : "Start Cleaning for Free"}
                        </button>
                        {!user && (
                            <button
                                onClick={() => navigate("/login")}
                                className="w-full sm:w-auto px-7 py-4 rounded-xl text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition-all hover:border-slate-300 cursor-pointer"
                            >
                                Sign In to Account
                            </button>
                        )}
                    </div>

                    {/* Interactive Comparison Preview Card */}
                    <div className="mt-16 max-w-5xl mx-auto rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden text-left">
                        <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                                <span className="ml-2 text-xs font-mono text-slate-400">cleaner_pipeline_preview.csv</span>
                            </div>
                            <span className="text-xs font-medium text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800">
                                AI Ready
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                            {/* Raw Data Column */}
                            <div className="p-6 bg-rose-50/30">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                                        Before (Raw & Messy)
                                    </span>
                                    <span className="text-[11px] text-rose-500 font-mono">4 issues detected</span>
                                </div>
                                <div className="space-y-2 font-mono text-xs text-slate-700">
                                    <div className="p-2.5 rounded bg-white border border-rose-200 line-through text-rose-400">
                                        "John Doe", "johndoe@@gmail.com", "2024/02/31", "NULL"
                                    </div>
                                    <div className="p-2.5 rounded bg-white border border-rose-200 text-rose-600">
                                        "Sarah Smith", "sarah@acme", "N/A", "$1,200.00"
                                    </div>
                                    <div className="p-2.5 rounded bg-white border border-rose-200 text-rose-400 opacity-60">
                                        "Sarah Smith", "sarah@acme", "N/A", "$1,200.00" (Duplicate)
                                    </div>
                                </div>
                            </div>

                            {/* Cleaned Data Column */}
                            <div className="p-6 bg-emerald-50/30">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        After (AI Cleaned & Normalized)
                                    </span>
                                    <span className="text-[11px] text-emerald-600 font-mono">100% Validated</span>
                                </div>
                                <div className="space-y-2 font-mono text-xs text-slate-800">
                                    <div className="p-2.5 rounded bg-white border border-emerald-200 flex items-center justify-between shadow-xs">
                                        <span>"John Doe", "johndoe@gmail.com", "2024-03-01", 0.00</span>
                                        <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Fixed</span>
                                    </div>
                                    <div className="p-2.5 rounded bg-white border border-emerald-200 flex items-center justify-between shadow-xs">
                                        <span>"Sarah Smith", "sarah@acme.com", "2024-01-15", 1200.00</span>
                                        <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Imputed</span>
                                    </div>
                                    <div className="p-2.5 rounded bg-emerald-100/60 border border-emerald-300 text-emerald-800 text-[11px] italic">
                                        ✓ Duplicate row removed automatically
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 bg-white border-t border-slate-200/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                            Intelligent Capabilities
                        </h2>
                        <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                            Everything You Need to Clean Data Fast
                        </p>
                        <p className="mt-4 text-slate-600">
                            Engineered for data analysts, engineers, and machine learning teams who value clean datasets.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-indigo-300 transition-all hover:shadow-md">
                            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl mb-5">
                                🪄
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Smart Missing Value Imputation</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Automatically detects empty, null, or corrupted fields and intelligently infers realistic values based on surrounding context.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-indigo-300 transition-all hover:shadow-md">
                            <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-2xl mb-5">
                                📑
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Duplicate & Anomaly Removal</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Pinpoint exact and fuzzy duplicates across tens of thousands of rows while flagging structural data anomalies instantly.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-indigo-300 transition-all hover:shadow-md">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mb-5">
                                ⚡
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Standardized Formats & Export</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Unify ISO dates, phone numbers, addresses, and currencies. Export clean CSV ready for PostgreSQL, Pandas, or Excel.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="py-20 bg-slate-50 border-t border-slate-200/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                        Simple Workflow
                    </h2>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                        Clean Any CSV in 3 Quick Steps
                    </p>

                    <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative">
                            <span className="text-4xl font-extrabold text-indigo-100 absolute top-4 right-4">01</span>
                            <div className="text-sm font-bold text-indigo-600 mb-1">Step 1</div>
                            <h4 className="text-base font-bold text-slate-900 mb-2">Upload Your CSV</h4>
                            <p className="text-sm text-slate-600">Drag and drop your messy spreadsheet file directly into the dashboard uploader.</p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative">
                            <span className="text-4xl font-extrabold text-indigo-100 absolute top-4 right-4">02</span>
                            <div className="text-sm font-bold text-indigo-600 mb-1">Step 2</div>
                            <h4 className="text-base font-bold text-slate-900 mb-2">AI Analyzes & Cleans</h4>
                            <p className="text-sm text-slate-600">The cleaning agent scans column types, detects corrupt entries, and fixes schema issues.</p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative">
                            <span className="text-4xl font-extrabold text-indigo-100 absolute top-4 right-4">03</span>
                            <div className="text-sm font-bold text-indigo-600 mb-1">Step 3</div>
                            <h4 className="text-base font-bold text-slate-900 mb-2">Preview & Download</h4>
                            <p className="text-sm text-slate-600">Inspect the cleaned table preview, review cleaning metrics, and download your clean CSV.</p>
                        </div>
                    </div>

                    <div className="mt-14">
                        <button
                            onClick={handleGetStarted}
                            className="px-8 py-3.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all cursor-pointer"
                        >
                            Try It Now — Clean Your First File
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 bg-white border-t border-slate-200 text-center text-xs text-slate-500">
                <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p>© 2026 CleanCSV.ai — Intelligent Data Cleaning Agent. All rights reserved.</p>
                    <div className="flex gap-4">
                        <button onClick={() => navigate("/login")} className="hover:text-indigo-600 transition-colors cursor-pointer">Login</button>
                        <button onClick={() => navigate("/signup")} className="hover:text-indigo-600 transition-colors cursor-pointer">Sign Up</button>
                        <button onClick={() => navigate("/dashboard")} className="hover:text-indigo-600 transition-colors cursor-pointer">Dashboard</button>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Home;
