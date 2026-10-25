import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { toast } from 'react-toastify';

const CsvComparisonModal = ({ doc, onClose }) => {
    // Active Tab in the Analytics Modal: 'summary', 'data-comparison', 'column-matrix'
    const [activeTab, setActiveTab] = useState('summary');

    // Papa Parse state for Raw CSV
    const [rawRows, setRawRows] = useState([]);
    const [rawHeaders, setRawHeaders] = useState([]);
    const [isLoadingRaw, setIsLoadingRaw] = useState(false);
    const [rawParseError, setRawParseError] = useState(null);

    // Papa Parse state for Cleaned CSV
    const [cleanedRows, setCleanedRows] = useState([]);
    const [cleanedHeaders, setCleanedHeaders] = useState([]);
    const [isLoadingCleaned, setIsLoadingCleaned] = useState(false);
    const [cleanedParseError, setCleanedParseError] = useState(null);

    // Data table controls
    const [viewMode, setViewMode] = useState('side-by-side'); // 'side-by-side', 'cleaned-only', 'raw-only'
    const [dataSearch, setDataSearch] = useState('');
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Copy to clipboard helper
    const handleCopyUrl = (url, label) => {
        if (!url) return;
        navigator.clipboard.writeText(url);
        toast.success(`Copied ${label} Cloudinary URL to clipboard!`);
    };

    // Load CSVs via Papa Parse when modal mounts or doc changes
    useEffect(() => {
        if (!doc) return;

        // 1. Parse Original Raw CSV via Papa Parse
        if (doc.file_url) {
            setIsLoadingRaw(true);
            setRawParseError(null);
            Papa.parse(doc.file_url, {
                download: true,
                header: true,
                skipEmptyLines: true,
                preview: 200, // Load first 200 rows for smooth high-speed interactive inspection
                complete: (results) => {
                    if (results.errors && results.errors.length > 0 && results.data.length === 0) {
                        setRawParseError(results.errors[0]?.message || 'Failed to parse raw CSV');
                    } else {
                        setRawHeaders(results.meta?.fields || []);
                        setRawRows(results.data || []);
                    }
                    setIsLoadingRaw(false);
                },
                error: (err) => {
                    console.error('Papa Parse raw error:', err);
                    setRawParseError('Could not download raw CSV from Cloudinary');
                    setIsLoadingRaw(false);
                },
            });
        }

        // 2. Parse Cleaned CSV via Papa Parse
        if (doc.cleaned_file_url) {
            setIsLoadingCleaned(true);
            setCleanedParseError(null);
            Papa.parse(doc.cleaned_file_url, {
                download: true,
                header: true,
                skipEmptyLines: true,
                preview: 200,
                complete: (results) => {
                    if (results.errors && results.errors.length > 0 && results.data.length === 0) {
                        setCleanedParseError(results.errors[0]?.message || 'Failed to parse cleaned CSV');
                    } else {
                        setCleanedHeaders(results.meta?.fields || []);
                        setCleanedRows(results.data || []);
                    }
                    setIsLoadingCleaned(false);
                },
                error: (err) => {
                    console.error('Papa Parse cleaned error:', err);
                    setCleanedParseError('Could not download cleaned CSV from Cloudinary');
                    setIsLoadingCleaned(false);
                },
            });
        }
    }, [doc]);

    if (!doc) return null;

    const initial = doc.initial_analysis || {};
    const final = doc.final_analysis || {};
    const review = doc.review || {};
    const rules = review.column_rules || [];

    const rawRowCount = doc.row_count || initial.total_rows || rawRows.length || 0;
    const cleanedRowCount = doc.cleaned_row_count || final.final_rows || cleanedRows.length || 0;
    const prunedCount = final.rows_removed !== undefined ? final.rows_removed : Math.max(0, rawRowCount - cleanedRowCount);
    const retentionRate = rawRowCount > 0 ? ((cleanedRowCount / rawRowCount) * 100).toFixed(1) : '100.0';

    const rawDuplicates = initial.duplicate_rows !== undefined ? initial.duplicate_rows : 0;
    const cleanedDuplicates = final.duplicate_rows !== undefined ? final.duplicate_rows : 0;

    const rawMissing = initial.total_missing_values !== undefined ? initial.total_missing_values : 0;
    const rawMissingPct = initial.missing_percentage !== undefined ? initial.missing_percentage : 0;
    const cleanedMissing = final.total_missing_values !== undefined ? final.total_missing_values : 0;
    const cleanedMissingPct = final.missing_percentage !== undefined ? final.missing_percentage : 0;

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Filter parsed rows based on search
    const filterRows = (rows) => {
        if (!dataSearch) return rows;
        const q = dataSearch.toLowerCase();
        return rows.filter((row) =>
            Object.values(row).some((val) => String(val || '').toLowerCase().includes(q))
        );
    };

    const filteredRawRows = filterRows(rawRows);
    const filteredCleanedRows = filterRows(cleanedRows);

    const maxItems = Math.max(filteredRawRows.length, filteredCleanedRows.length);
    const totalPages = Math.ceil(maxItems / rowsPerPage) || 1;
    const paginatedRaw = filteredRawRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);
    const paginatedCleaned = filteredCleanedRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
            <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* 1. MODAL HEADER */}
                <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-emerald-500 text-white flex items-center justify-center font-bold text-base shadow-md shadow-indigo-500/25">
                            AI
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                                    {doc.filename}
                                </h2>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                                    Cleaned & Audited
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Powered by Papa Parse client streaming • Files securely hosted on Cloudinary
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Quick Cloudinary Download Links */}
                        <a
                            href={doc.cleaned_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={`cleaned_${doc.filename}`}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Cleaned CSV
                        </a>

                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* 2. SUB-NAVIGATION TABS */}
                <div className="bg-slate-100/80 px-6 py-2 border-b border-slate-200 flex items-center justify-between shrink-0 overflow-x-auto">
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'summary'
                                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Executive Summary & Audit
                        </button>

                        <button
                            onClick={() => setActiveTab('data-comparison')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'data-comparison'
                                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            Papa Parse CSV Comparison ({rawRows.length > 0 ? `${rawRows.length} vs ${cleanedRows.length}` : 'Live Grid'})
                        </button>

                        <button
                            onClick={() => setActiveTab('column-matrix')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'column-matrix'
                                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Column Schema Matrix ({rules.length || initial.column_count || 0})
                        </button>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
                        <span>ID #{doc.id}</span>
                        <span>•</span>
                        <span>{doc.cleaned_at ? `Cleaned ${doc.cleaned_at}` : 'Stored in Cloudinary'}</span>
                    </div>
                </div>

                {/* 3. MODAL CONTENT BODY */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* TAB 1: EXECUTIVE SUMMARY */}
                    {activeTab === 'summary' && (
                        <div className="space-y-6">
                            {/* Cloudinary Asset Links Bar */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span className="text-xs font-bold text-slate-700">
                                        Cloudinary Asset Endpoints:
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => handleCopyUrl(doc.file_url, 'Original Raw')}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1.5"
                                    >
                                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copy Raw CSV URL
                                    </button>

                                    <button
                                        onClick={() => handleCopyUrl(doc.cleaned_file_url, 'Cleaned')}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1.5"
                                    >
                                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copy Cleaned CSV URL
                                    </button>

                                    <a
                                        href={doc.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={doc.filename}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition"
                                    >
                                        Download Raw
                                    </a>

                                    <a
                                        href={doc.cleaned_file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={`cleaned_${doc.filename}`}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-xs"
                                    >
                                        Download Cleaned
                                    </a>
                                </div>
                            </div>

                            {/* Top 4 KPI Metrics */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Score */}
                                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 shadow-2xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                                            Data Quality Audit Score
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-600 text-white">
                                            {review.score !== undefined ? `${review.score}/10` : '10/10'}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-1.5">
                                        <span className="text-3xl font-black text-indigo-900">
                                            {review.score !== undefined ? review.score : '10.0'}
                                        </span>
                                        <span className="text-sm font-semibold text-indigo-400">/ 10.0</span>
                                    </div>
                                    <p className="mt-2 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        {review.passed !== false ? 'Passed Quality Threshold (≥ 6.5)' : 'Needs Further Review'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        Completed in attempt {review.attempt || 1} of {review.max_retries || 5}
                                    </p>
                                </div>

                                {/* Rows */}
                                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        Cleaned vs Raw Rows
                                    </span>
                                    <div className="mt-2 flex items-baseline gap-1.5">
                                        <span className="text-3xl font-black text-slate-900">
                                            {cleanedRowCount.toLocaleString()}
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium">
                                            / {rawRowCount.toLocaleString()} raw
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-600">
                                            {retentionRate}% Retention
                                        </span>
                                        <span className="text-rose-600 font-semibold">
                                            -{prunedCount.toLocaleString()} pruned
                                        </span>
                                    </div>
                                    <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="bg-indigo-600 h-1.5 rounded-full"
                                            style={{ width: `${Math.min(100, retentionRate)}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Duplicate Rows */}
                                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        Duplicate Rows Eliminated
                                    </span>
                                    <div className="mt-2 flex items-baseline gap-1.5">
                                        <span className="text-3xl font-black text-emerald-600">
                                            {cleanedDuplicates}
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium">
                                            (was {rawDuplicates})
                                        </span>
                                    </div>
                                    <p className="mt-2 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        100% Deduplicated
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        PK and duplicate records cleanly purged
                                    </p>
                                </div>

                                {/* Missing Values */}
                                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        Missing Value Reduction
                                    </span>
                                    <div className="mt-2 flex items-baseline gap-1.5">
                                        <span className="text-3xl font-black text-slate-900">
                                            {cleanedMissing.toLocaleString()}
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium">
                                            ({cleanedMissingPct}%)
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs">
                                        <span className="text-slate-500">
                                            Raw: {rawMissing.toLocaleString()} ({rawMissingPct}%)
                                        </span>
                                        <span className="text-emerald-600 font-bold">
                                            {rawMissing > cleanedMissing ? `-${(rawMissing - cleanedMissing).toLocaleString()}` : 'Handled'}
                                        </span>
                                    </div>
                                    <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="bg-emerald-500 h-1.5 rounded-full"
                                            style={{ width: `${Math.max(5, 100 - cleanedMissingPct)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {/* What Actually Improved vs Things to Improve */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 shadow-2xs">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                                            ✓
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                                                What Actually Improved
                                            </h4>
                                            <p className="text-[11px] text-emerald-700">Verified by Data Quality Audit Engine</p>
                                        </div>
                                    </div>

                                    <ul className="space-y-2.5 text-xs text-emerald-900 font-medium">
                                        {(review.improved_list || []).map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-2 bg-white/70 p-2.5 rounded-xl border border-emerald-100">
                                                <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                                    ✓
                                                </span>
                                                <span className="leading-snug">{item}</span>
                                            </li>
                                        ))}
                                        {(!review.improved_list || review.improved_list.length === 0) && (
                                            <li className="text-slate-400 italic">No specific improvements reported.</li>
                                        )}
                                    </ul>
                                </div>

                                <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200/80 shadow-2xs">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                                            !
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                                                Things to Improve & Schema Notes
                                            </h4>
                                            <p className="text-[11px] text-amber-700">Actionable advice for downstream models</p>
                                        </div>
                                    </div>

                                    <ul className="space-y-2.5 text-xs text-amber-900 font-medium">
                                        {(review.things_to_improve || []).map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-2 bg-white/70 p-2.5 rounded-xl border border-amber-100">
                                                <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                                    •
                                                </span>
                                                <span className="leading-snug">{item}</span>
                                            </li>
                                        ))}
                                        {(!review.things_to_improve || review.things_to_improve.length === 0) && (
                                            <li className="text-emerald-700 italic bg-white/70 p-2.5 rounded-xl border border-emerald-100">
                                                No remaining issues detected. All constraints satisfied!
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: LIVE PAPA PARSE CSV COMPARISON GRID */}
                    {activeTab === 'data-comparison' && (
                        <div className="space-y-4">
                            {/* Toolbar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700">Display:</span>
                                    <div className="bg-white p-0.5 rounded-xl border border-slate-200 flex items-center">
                                        <button
                                            onClick={() => setViewMode('side-by-side')}
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                                                viewMode === 'side-by-side' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600'
                                            }`}
                                        >
                                            Side-by-Side
                                        </button>
                                        <button
                                            onClick={() => setViewMode('cleaned-only')}
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                                                viewMode === 'cleaned-only' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600'
                                            }`}
                                        >
                                            Cleaned CSV ({cleanedRows.length})
                                        </button>
                                        <button
                                            onClick={() => setViewMode('raw-only')}
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                                                viewMode === 'raw-only' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600'
                                            }`}
                                        >
                                            Raw CSV ({rawRows.length})
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={dataSearch}
                                        onChange={(e) => {
                                            setDataSearch(e.target.value);
                                            setPage(1);
                                        }}
                                        placeholder="Filter rows..."
                                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none w-48"
                                    />
                                    <select
                                        value={rowsPerPage}
                                        onChange={(e) => {
                                            setRowsPerPage(Number(e.target.value));
                                            setPage(1);
                                        }}
                                        className="px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700"
                                    >
                                        <option value={10}>10 rows</option>
                                        <option value={25}>25 rows</option>
                                        <option value={50}>50 rows</option>
                                    </select>
                                </div>
                            </div>

                            {/* Loading / Error Indicators */}
                            {(isLoadingRaw || isLoadingCleaned) && (
                                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                                    <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                    <p className="text-xs text-slate-600 font-medium">
                                        Papa Parse is streaming & parsing CSV files directly from Cloudinary...
                                    </p>
                                </div>
                            )}

                            {rawParseError && (
                                <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 border border-amber-200">
                                    Raw CSV Note: {rawParseError}
                                </div>
                            )}
                            {cleanedParseError && (
                                <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 border border-amber-200">
                                    Cleaned CSV Note: {cleanedParseError}
                                </div>
                            )}

                            {/* Grid View */}
                            {!isLoadingRaw && !isLoadingCleaned && (
                                <div className={`grid gap-4 ${viewMode === 'side-by-side' ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                                    {/* RAW CSV TABLE */}
                                    {(viewMode === 'side-by-side' || viewMode === 'raw-only') && (
                                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                                            <div className="p-3.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                                                    <span className="text-xs font-bold text-slate-800">
                                                        Original Raw CSV
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-slate-500 font-mono">
                                                    {filteredRawRows.length} sample rows
                                                </span>
                                            </div>

                                            <div className="overflow-x-auto max-h-96">
                                                <table className="w-full text-left border-collapse text-xs">
                                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-mono text-[11px]">
                                                        <tr>
                                                            <th className="py-2 px-3 w-10">#</th>
                                                            {rawHeaders.map((head, idx) => (
                                                                <th key={idx} className="py-2 px-3 whitespace-nowrap">
                                                                    {head}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                                        {paginatedRaw.map((row, rIdx) => (
                                                            <tr key={rIdx} className="hover:bg-slate-50/80">
                                                                <td className="py-2 px-3 text-slate-400">
                                                                    {(page - 1) * rowsPerPage + rIdx + 1}
                                                                </td>
                                                                {rawHeaders.map((col, cIdx) => {
                                                                    const val = row[col];
                                                                    const isNull = val === null || val === undefined || val === '';
                                                                    return (
                                                                        <td key={cIdx} className="py-2 px-3 whitespace-nowrap text-slate-800">
                                                                            {isNull ? (
                                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-rose-50 text-rose-600 font-bold">
                                                                                    null
                                                                                </span>
                                                                            ) : (
                                                                                String(val)
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                        {paginatedRaw.length === 0 && (
                                                            <tr>
                                                                <td colSpan={rawHeaders.length + 1} className="py-8 text-center text-slate-400 italic">
                                                                    No rows available
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* CLEANED CSV TABLE */}
                                    {(viewMode === 'side-by-side' || viewMode === 'cleaned-only') && (
                                        <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden shadow-2xs">
                                            <div className="p-3.5 bg-emerald-50/70 border-b border-emerald-200 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                                    <span className="text-xs font-bold text-emerald-950">
                                                        AI-Cleaned CSV (Standardized)
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-emerald-700 font-mono font-semibold">
                                                    {filteredCleanedRows.length} sample rows
                                                </span>
                                            </div>

                                            <div className="overflow-x-auto max-h-96">
                                                <table className="w-full text-left border-collapse text-xs">
                                                    <thead className="bg-emerald-50/40 sticky top-0 border-b border-emerald-100 text-emerald-900 font-mono text-[11px]">
                                                        <tr>
                                                            <th className="py-2 px-3 w-10">#</th>
                                                            {cleanedHeaders.map((head, idx) => (
                                                                <th key={idx} className="py-2 px-3 whitespace-nowrap">
                                                                    {head}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-emerald-50 font-mono text-[11px]">
                                                        {paginatedCleaned.map((row, rIdx) => (
                                                            <tr key={rIdx} className="hover:bg-emerald-50/30">
                                                                <td className="py-2 px-3 text-emerald-600/70">
                                                                    {(page - 1) * rowsPerPage + rIdx + 1}
                                                                </td>
                                                                {cleanedHeaders.map((col, cIdx) => {
                                                                    const val = row[col];
                                                                    const isNull = val === null || val === undefined || val === '';
                                                                    return (
                                                                        <td key={cIdx} className="py-2 px-3 whitespace-nowrap text-slate-800">
                                                                            {isNull ? (
                                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-slate-100 text-slate-400">
                                                                                    empty
                                                                                </span>
                                                                            ) : (
                                                                                String(val)
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                        {paginatedCleaned.length === 0 && (
                                                            <tr>
                                                                <td colSpan={cleanedHeaders.length + 1} className="py-8 text-center text-slate-400 italic">
                                                                    No rows available
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Pagination bar */}
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                                <span>
                                    Page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong>
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages}
                                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: COLUMN SCHEMA MATRIX */}
                    {activeTab === 'column-matrix' && (
                        <div className="space-y-4">
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                            Column-by-Column Health & Constraint Matrix
                                        </h4>
                                        <p className="text-[11px] text-slate-500">
                                            Audit of data types, nulls, unique constraints, and cleaning rules applied per column
                                        </p>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-600">
                                        {rules.length || initial.column_count || 0} Total Columns
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold text-[10px] uppercase">
                                            <tr>
                                                <th className="py-3 px-4">Column Name</th>
                                                <th className="py-3 px-4">Inferred Type</th>
                                                <th className="py-3 px-4">Primary Key</th>
                                                <th className="py-3 px-4">Unique Constraint</th>
                                                <th className="py-3 px-4">Nullability</th>
                                                <th className="py-3 px-4">Cleaning Actions Applied</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {rules.map((col, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/70 transition">
                                                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                                                        {col.name}
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                            {col.type}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        {col.primary_key ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                                PRIMARY KEY
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        {col.unique ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                Unique Key
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">No</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-slate-600">
                                                        {col.nullable ? (
                                                            <span className="text-slate-500">Nullable</span>
                                                        ) : (
                                                            <span className="font-semibold text-rose-600">Required (Not Null)</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                                                        <div className="flex flex-wrap gap-1">
                                                            {(col.cleaning_actions || []).map((action, aIdx) => (
                                                                <span
                                                                    key={aIdx}
                                                                    className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
                                                                >
                                                                    {action}
                                                                </span>
                                                            ))}
                                                            {(!col.cleaning_actions || col.cleaning_actions.length === 0) && (
                                                                <span className="text-slate-400">Standard clean</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {rules.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                                                        No column rule specifications recorded.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. MODAL FOOTER */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Original Size: {formatBytes(doc.file_size)}</span>
                        <span>•</span>
                        <span>Cleaned Size: {formatBytes(doc.cleaned_file_size)}</span>
                    </div>

                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
                    >
                        Close Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CsvComparisonModal;

