import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Papa from 'papaparse';
import { useStore } from '../zustand/store';
import { toast } from 'react-toastify';
import axios from '../services/axios';
import CsvComparisonModal from '../components/CsvComparisonModal';

const Dashboard = () => {
    const user = useStore((state) => state.user);
    const logout = useStore((state) => state.logout);
    const navigate = useNavigate();

    // Active Tab: 'documents' or 'upload'
    const [activeTab, setActiveTab] = useState('documents');

    // Documents state
    const [documents, setDocuments] = useState([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Cleaning & Analytics state
    const [cleaningDocId, setCleaningDocId] = useState(null);
    const [analyticsDoc, setAnalyticsDoc] = useState(null); // Document selected for CsvComparisonModal

    // Upload state
    const [file, setFile] = useState(null);
    const [rawRows, setRawRows] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [justUploadedDoc, setJustUploadedDoc] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const fileInputRef = useRef(null);

    // Fetch user's documents on mount
    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        setIsLoadingDocs(true);
        try {
            const res = await axios.get('/documents');
            if (res.data?.status === 1) {
                setDocuments(res.data.documents || []);
            } else {
                toast.error(res.data?.msg || 'Failed to load documents');
            }
        } catch (err) {
            console.error('Fetch documents error:', err);
        } finally {
            setIsLoadingDocs(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Client-side CSV validation and parsing using Papa Parse
    const handleFileChange = (e) => {
        const selected = e.target.files?.[0];
        if (selected) {
            validateAndSelectFile(selected);
        }
    };

    const validateAndSelectFile = (selected) => {
        setJustUploadedDoc(null);

        // 1. File extension validation
        if (!selected.name.toLowerCase().endsWith('.csv')) {
            toast.error('Invalid file type! Please upload a valid .csv file.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // 2. Empty file size check
        if (selected.size === 0) {
            toast.error('The selected file is 0 bytes (empty). Please select a valid CSV.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // 3. Papa Parse client-side parsing
        Papa.parse(selected, {
            header: false,
            skipEmptyLines: true,
            preview: 20, // Preview first 20 rows for fast client preview
            complete: (results) => {
                if (results.errors && results.errors.length > 0 && results.data.length === 0) {
                    toast.error(`CSV Parsing error: ${results.errors[0]?.message || 'Invalid format'}`);
                    handleClearFile();
                    return;
                }

                const data = results.data;
                if (!data || data.length === 0) {
                    toast.error('The selected CSV file has no readable data lines.');
                    handleClearFile();
                    return;
                }

                const detectedHeaders = data[0].map((h) => String(h || '').trim());
                if (detectedHeaders.length === 0 || (detectedHeaders.length === 1 && detectedHeaders[0] === '')) {
                    toast.error('CSV has no detectable column headers.');
                    handleClearFile();
                    return;
                }

                const previewRows = data.slice(1);
                setFile(selected);
                setHeaders(detectedHeaders);
                setRawRows(previewRows);
                toast.success(`Validated "${selected.name}" with Parse (${detectedHeaders.length} columns)`);
            },
            error: (err) => {
                toast.error(`Parse error reading file: ${err.message}`);
                handleClearFile();
            },
        });
    };

    // Upload CSV to Backend -> Cloudinary -> Database
    const handleUploadToBackend = async () => {
        if (!file) {
            toast.warn('Please select and validate a CSV file first');
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post('/documents/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (res.data?.status === 1) {
                toast.success('CSV uploaded to Cloudinary and saved to database!');
                const newDoc = res.data.document;
                setJustUploadedDoc(newDoc);
                handleClearFile();
                await fetchDocuments();
            } else {
                toast.error(res.data?.msg || 'Upload failed. Please ensure the file is a proper CSV.');
            }
        } catch (err) {
            console.error('Upload error:', err);
            const errorMsg = err.response?.data?.msg || err.response?.data?.detail || 'Failed to upload CSV to server';
            toast.error(errorMsg);
        } finally {
            setIsUploading(false);
        }
    };

    // Trigger AI Agent to Clean Document
    const handleCleanDocument = async (docId) => {
        setCleaningDocId(docId);
        toast.info('Starting AI Cleaning Agent... This will analyze schema, deduplicate, and clean the whole dataset.');

        try {
            const res = await axios.post(`/documents/${docId}/clean`);

            if (res.data?.status === 1) {
                const cleanedDoc = res.data.document;
                toast.success('AI Cleaning completed! Output file saved to Cloudinary.');
                setDocuments((prev) =>
                    prev.map((d) => (d.id === docId ? cleanedDoc : d))
                );
                if (justUploadedDoc?.id === docId) {
                    setJustUploadedDoc(cleanedDoc);
                }
                // Automatically open the Papa Parse Comparison & Analytics Modal
                setAnalyticsDoc(cleanedDoc);
            } else {
                toast.error(res.data?.msg || 'AI Cleaning failed.');
                await fetchDocuments();
            }
        } catch (err) {
            console.error('Clean error:', err);
            const errorMsg = err.response?.data?.msg || err.response?.data?.detail || 'Error running AI cleaning';
            toast.error(errorMsg);
            await fetchDocuments();
        } finally {
            setCleaningDocId(null);
        }
    };

    // Delete Document
    const handleDeleteDocument = async (id, filename) => {
        if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
            return;
        }

        setDeletingId(id);
        try {
            const res = await axios.delete(`/documents/${id}`);
            if (res.data?.status === 1) {
                toast.success('Document deleted successfully from database and Cloudinary');
                setDocuments((prev) => prev.filter((d) => d.id !== id));
                if (analyticsDoc?.id === id) {
                    setAnalyticsDoc(null);
                }
                if (justUploadedDoc?.id === id) {
                    setJustUploadedDoc(null);
                }
            } else {
                toast.error(res.data?.msg || 'Failed to delete document');
            }
        } catch (err) {
            console.error('Delete error:', err);
            toast.error('Error deleting document from server');
        } finally {
            setDeletingId(null);
        }
    };

    const handleClearFile = () => {
        setFile(null);
        setRawRows([]);
        setHeaders([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Just now';
        try {
            const d = new Date(dateString);
            return d.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const filteredDocuments = documents.filter((doc) =>
        (doc.filename || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Dashboard Aggregate Statistics
    const totalFiles = documents.length;
    const cleanedFiles = documents.filter((d) => d.status === 'cleaned').length;
    const totalRowsCleaned = documents
        .filter((d) => d.status === 'cleaned')
        .reduce((acc, d) => acc + (d.cleaned_row_count || 0), 0);
    const avgScore =
        cleanedFiles > 0
            ? (
                  documents
                      .filter((d) => d.status === 'cleaned' && d.review?.score !== undefined)
                      .reduce((acc, d) => acc + Number(d.review.score), 0) / cleanedFiles
              ).toFixed(1)
            : '10.0';

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <span className="text-lg font-bold tracking-tight text-slate-900">
                                CleanCSV<span className="text-indigo-600">.ai</span>
                            </span>
                        </Link>

                        {/* Navigation Tabs */}
                        <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveTab('documents')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                    activeTab === 'documents'
                                        ? 'bg-white text-indigo-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                My Documents ({documents.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('upload')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                    activeTab === 'upload'
                                        ? 'bg-white text-indigo-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Upload CSV
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] uppercase">
                                {user?.name ? user.name[0] : 'U'}
                            </span>
                            <span className="hidden sm:inline">{user?.name || user?.email}</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Mobile Tab Bar */}
                <div className="sm:hidden flex border-t border-slate-200 bg-slate-50 px-4 py-2 gap-2">
                    <button
                        onClick={() => setActiveTab('documents')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold text-center ${
                            activeTab === 'documents' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border'
                        }`}
                    >
                        My Documents ({documents.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold text-center ${
                            activeTab === 'upload' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border'
                        }`}
                    >
                        Upload CSV
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* 1. AGGREGATE DASHBOARD METRICS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Total Files
                            </span>
                            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                📁
                            </span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-900">{totalFiles}</span>
                            <span className="text-xs text-slate-400 font-medium">on Cloudinary</span>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Cleaned Files
                            </span>
                            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                                ⚡
                            </span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-black text-emerald-600">{cleanedFiles}</span>
                            <span className="text-xs text-slate-400 font-medium">
                                / {totalFiles} processed
                            </span>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Valid Cleaned Records
                            </span>
                            <span className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">
                                📊
                            </span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-900">
                                {totalRowsCleaned.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">rows saved</span>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Average Audit Score
                            </span>
                            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                                ★
                            </span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-black text-indigo-700">{avgScore}</span>
                            <span className="text-xs text-slate-400 font-medium">/ 10.0 Quality</span>
                        </div>
                    </div>
                </div>

                {/* 2. TAB 1: MY DOCUMENTS */}
                {activeTab === 'documents' && (
                    <div className="space-y-6">
                        {/* Title Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                                    My Documents Hub
                                </h1>
                                <p className="mt-1 text-sm text-slate-500">
                                    Inspect your CSV spreadsheets, launch AI cleaning, and compare datasets with Parse.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={fetchDocuments}
                                    disabled={isLoadingDocs}
                                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5"
                                >
                                    <svg className={`w-3.5 h-3.5 ${isLoadingDocs ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Refresh
                                </button>
                                <button
                                    onClick={() => setActiveTab('upload')}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-1.5"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                    Upload New CSV
                                </button>
                            </div>
                        </div>

                        {/* Search Bar */}
                        {documents.length > 0 && (
                            <div className="relative max-w-md">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by filename..."
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>
                        )}

                        {/* Documents Table */}
                        {isLoadingDocs ? (
                            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
                                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                                <p className="text-xs text-slate-500 font-medium">Loading your documents...</p>
                            </div>
                        ) : filteredDocuments.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-base font-bold text-slate-800 mb-1">
                                    {searchQuery ? 'No matching documents found' : 'No documents uploaded yet'}
                                </h3>
                                <p className="text-xs text-slate-500 max-w-sm mb-5">
                                    {searchQuery
                                        ? `No files match your query "${searchQuery}".`
                                        : 'Upload your raw CSV spreadsheets to store them in Cloudinary and run AI cleaning.'}
                                </p>
                                {!searchQuery && (
                                    <button
                                        onClick={() => setActiveTab('upload')}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition cursor-pointer"
                                    >
                                        Upload Your First CSV
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                                            <tr>
                                                <th className="py-3 px-4 font-semibold">Document Name</th>
                                                <th className="py-3 px-4 font-semibold">Raw Size & Rows</th>
                                                <th className="py-3 px-4 font-semibold">Status</th>
                                                <th className="py-3 px-4 font-semibold">Score / Retries</th>
                                                <th className="py-3 px-4 font-semibold">Cleaned CSV</th>
                                                <th className="py-3 px-4 font-semibold text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredDocuments.map((doc) => {
                                                const isCleaningThis = cleaningDocId === doc.id;
                                                const isCleaned = doc.status === 'cleaned';
                                                const score = doc.review?.score;

                                                return (
                                                    <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                                                        <td className="py-3.5 px-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs border ${
                                                                    isCleaned
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                                }`}>
                                                                    CSV
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-slate-900 flex items-center gap-2">
                                                                        <span>{doc.filename}</span>
                                                                        {isCleaned && (
                                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                                                                Cleaned
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400 font-mono">
                                                                        Uploaded: {formatDate(doc.created_at)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-4 text-slate-600">
                                                            <span className="font-semibold text-slate-800">
                                                                {(doc.row_count || 0).toLocaleString()}
                                                            </span>{' '}
                                                            rows •{' '}
                                                            <span className="font-mono text-[11px]">
                                                                {formatFileSize(doc.file_size)}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            {isCleaningThis ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                                                    <div className="w-2.5 h-2.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                                                    AI Cleaning...
                                                                </span>
                                                            ) : isCleaned ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                    Ready
                                                                </span>
                                                            ) : doc.status === 'failed' ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                                                    Failed
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                                                    Uploaded
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            {isCleaned && score !== undefined ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="px-2 py-0.5 rounded-md font-bold text-xs bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                                        {score} / 10
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400">
                                                                        ({doc.review?.attempt || 1} att.)
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 text-[11px]">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            {isCleaned && doc.cleaned_file_url ? (
                                                                <a
                                                                    href={doc.cleaned_file_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    download={`cleaned_${doc.filename}`}
                                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                    </svg>
                                                                    Download Cleaned
                                                                </a>
                                                            ) : (
                                                                <span className="text-slate-400 text-[11px]">Not cleaned yet</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {/* Clean Button */}
                                                                {!isCleaned && (
                                                                    <button
                                                                        onClick={() => handleCleanDocument(doc.id)}
                                                                        disabled={isCleaningThis}
                                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1"
                                                                    >
                                                                        {isCleaningThis ? (
                                                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                        ) : (
                                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                                            </svg>
                                                                        )}
                                                                        Clean with AI
                                                                    </button>
                                                                )}

                                                                {/* View Comparison & Analytics Button */}
                                                                {isCleaned && (
                                                                    <button
                                                                        onClick={() => setAnalyticsDoc(doc)}
                                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                                        </svg>
                                                                        Compare & Analytics
                                                                    </button>
                                                                )}

                                                                {/* Delete */}
                                                                <button
                                                                    onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                                                                    disabled={deletingId === doc.id || isCleaningThis}
                                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer disabled:opacity-50"
                                                                    title="Delete Document"
                                                                >
                                                                    {deletingId === doc.id ? (
                                                                        <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                                                                    ) : (
                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. TAB 2: UPLOAD CSV */}
                {activeTab === 'upload' && (
                    <div className="space-y-6">
                        {/* Title */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                                    Upload & Clean CSV
                                </h1>
                                <p className="mt-1 text-sm text-slate-500">
                                    Validated client-side with Parse, stored on Cloudinary, and cleaned automatically with AI.
                                </p>
                            </div>
                            {file && (
                                <button
                                    type="button"
                                    onClick={handleClearFile}
                                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer self-start sm:self-auto"
                                >
                                    Select Different File
                                </button>
                            )}
                        </div>

                        {/* File Dropzone */}
                        {!file && !justUploadedDoc ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="p-12 border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-indigo-50/20 group"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <h3 className="text-base font-bold text-slate-800 mb-1">
                                    Click to upload or drag & drop CSV file
                                </h3>
                                <p className="text-xs text-slate-500 max-w-sm mb-4">
                                    Parsed directly with Parse before streaming to Cloudinary
                                </p>
                                <span className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20">
                                    Browse .CSV File
                                </span>
                            </div>
                        ) : null}

                        {/* If file is selected (Pre-upload) */}
                        {file && (
                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base border border-emerald-200">
                                            CSV
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-slate-900 text-base">{file.name}</h3>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    PARSE VERIFIED
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                <span>{formatFileSize(file.size)}</span>
                                                <span>•</span>
                                                <span>{headers.length} columns detected</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 self-start sm:self-auto">
                                        <button
                                            type="button"
                                            onClick={handleClearFile}
                                            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleUploadToBackend}
                                            disabled={isUploading}
                                            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-600/20 disabled:opacity-60 transition cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                                        >
                                            {isUploading ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    Uploading to Cloudinary...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                    </svg>
                                                    Upload to Cloudinary
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Columns badge list */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                                    <h4 className="text-xs font-bold text-slate-800 mb-2">
                                        Detected Columns ({headers.length}):
                                    </h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {headers.map((head, idx) => (
                                            <span
                                                key={idx}
                                                className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200"
                                            >
                                                {head}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Raw Data Preview */}
                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                                    <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-700">
                                            Parse Sample Preview (First {rawRows.length} Rows)
                                        </span>
                                    </div>

                                    <div className="overflow-x-auto max-h-96">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200">
                                                <tr>
                                                    <th className="py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px] w-12">
                                                        #
                                                    </th>
                                                    {headers.map((head, idx) => (
                                                        <th
                                                            key={idx}
                                                            className="py-2.5 px-3 font-semibold text-slate-700 font-mono"
                                                        >
                                                            {head}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {rawRows.map((row, rIdx) => (
                                                    <tr key={rIdx} className="hover:bg-slate-50/80">
                                                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">
                                                            {rIdx + 1}
                                                        </td>
                                                        {row.map((cell, cIdx) => (
                                                            <td
                                                                key={cIdx}
                                                                className="py-2.5 px-3 text-slate-700 font-mono"
                                                            >
                                                                {cell || <span className="italic text-slate-400">empty</span>}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Post-Upload Banner with direct CLEAN button */}
                        {justUploadedDoc && (
                            <div className="bg-gradient-to-r from-indigo-50 via-violet-50 to-emerald-50 p-6 rounded-2xl border border-indigo-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                            UPLOADED TO CLOUDINARY
                                        </span>
                                        <h3 className="text-base font-bold text-slate-900">
                                            {justUploadedDoc.filename}
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        {(justUploadedDoc.row_count || 0).toLocaleString()} rows • Cloudinary URL saved to documents table.
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    {justUploadedDoc.status === 'cleaned' ? (
                                        <button
                                            onClick={() => setAnalyticsDoc(justUploadedDoc)}
                                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            Compare Both CSVs & Analytics
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleCleanDocument(justUploadedDoc.id)}
                                            disabled={cleaningDocId === justUploadedDoc.id}
                                            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-600/25 transition cursor-pointer flex items-center gap-2"
                                        >
                                            {cleaningDocId === justUploadedDoc.id ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    AI Agent is Cleaning Whole CSV...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                    ⚡ Clean File with AI Agent
                                                </>
                                            )}
                                        </button>
                                    )}

                                    <button
                                        onClick={() => {
                                            setJustUploadedDoc(null);
                                            setActiveTab('documents');
                                        }}
                                        className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                                    >
                                        Go to My Documents
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* 4. PAPA PARSE CSV COMPARISON & ANALYTICS MODAL */}
            {analyticsDoc && (
                <CsvComparisonModal
                    doc={analyticsDoc}
                    onClose={() => setAnalyticsDoc(null)}
                />
            )}
        </div>
    );
};

export { Dashboard };
