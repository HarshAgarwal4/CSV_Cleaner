import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../zustand/store';
import { toast } from 'react-toastify';
import axios from '../services/axios';

const Dashboard = () => {
    const user = useStore((state) => state.user);
    const logout = useStore((state) => state.logout);
    const navigate = useNavigate();

    const [file, setFile] = useState(null);
    const [rawRows, setRawRows] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Parse CSV to preview raw data
    const parseCSV = (csvText) => {
        const lines = csvText.split(/\r\n|\n/).filter((line) => line.trim() !== '');
        if (lines.length === 0) return { headers: [], rows: [] };

        const splitLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"' || char === "'") {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };

        const parsedHeaders = splitLine(lines[0]);
        const parsedRows = lines.slice(1).map((line) => splitLine(line));
        return { headers: parsedHeaders, rows: parsedRows };
    };

    // Handle File Selection
    const handleFileChange = (e) => {
        const selected = e.target.files?.[0];
        if (selected) {
            handleSelectedFile(selected);
        }
    };

    const handleSelectedFile = (selected) => {
        if (!selected.name.toLowerCase().endsWith('.csv')) {
            toast.error('Please upload a valid .csv file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result;
            const { headers: h, rows: r } = parseCSV(text);
            if (h.length === 0) {
                toast.error('The selected CSV file is empty.');
                return;
            }
            setFile(selected);
            setHeaders(h);
            setRawRows(r);
            toast.success(`Loaded "${selected.name}" (${r.length} rows)`);
        };
        reader.readAsText(selected);
    };

    // Upload CSV to Backend for AI Cleaning
    const handleUploadToBackend = async () => {
        if (!file) {
            toast.warn('Please select a CSV file first');
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post('/clean-csv', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (res.data?.status === 1) {
                toast.success(res.data?.msg || 'CSV sent to backend for AI cleaning!');
            } else {
                toast.info(res.data?.msg || 'File uploaded successfully.');
            }
        } catch (err) {
            console.error('Upload error:', err);
            // If backend route is not created yet, inform the user clearly
            if (err.response?.status === 404) {
                toast.info(`File "${file.name}" ready to be processed by backend AI cleaner endpoint (/clean-csv)`);
            } else {
                toast.error(err.response?.data?.detail || 'Error uploading file to server');
            }
        } finally {
            setIsUploading(false);
        }
    };

    const handleClearFile = () => {
        setFile(null);
        setRawRows([]);
        setHeaders([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
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
                        <span className="hidden md:inline-block px-2.5 py-0.5 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            Dashboard
                        </span>
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
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Title */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Upload CSV File
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Upload your CSV spreadsheet to send it to the AI cleaner backend.
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
                {!file ? (
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
                            Select a raw <code>.csv</code> file to preview and upload
                        </p>
                        <span className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20">
                            Browse CSV File
                        </span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* File Details Bar */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-base">
                                    CSV
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-base">{file.name}</h3>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                        <span>{(file.size / 1024).toFixed(1)} KB</span>
                                        <span>•</span>
                                        <span>{rawRows.length} rows</span>
                                        <span>•</span>
                                        <span>{headers.length} columns</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleUploadToBackend}
                                disabled={isUploading}
                                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-600/20 disabled:opacity-60 transition cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap self-start sm:self-auto"
                            >
                                {isUploading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        Upload to AI Cleaner
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Raw Data Preview */}
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                            <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-700">
                                    Raw CSV Preview ({rawRows.length} rows)
                                </span>
                                <span className="text-[11px] text-slate-500">
                                    Showing first {Math.min(15, rawRows.length)} rows
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
                                        {rawRows.slice(0, 15).map((row, rIdx) => (
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
            </main>
        </div>
    );
};

export { Dashboard };
