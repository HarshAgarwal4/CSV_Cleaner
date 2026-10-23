import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from '../services/axios';
import { useStore } from "../zustand/store";

const SignupForm = () => {
    const user = useStore((state) => state.user);
    const [otpSent, setOtpSent] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        watch,
        setError,
        clearErrors,
        reset
    } = useForm();

    const email = watch("email");

    const onSubmit = async (data) => {
        if (!otpSent) {
            setError("otp", { type: "manual", message: "Please click 'Send OTP' and verify your email first." });
            toast.warn("Please send and enter the OTP first");
            return;
        }

        try {
            const res = await axios.post('/signup', data);
            if (res.status === 200) {
                const status = res.data?.status;
                if (status === 1) {
                    toast.success("Account created successfully! Please sign in.");
                    reset();
                    navigate('/login');
                } else if (status === 6) {
                    toast.error("An account with this email already exists.");
                } else if (status === 2 || status === 10) {
                    toast.error("Invalid or expired OTP. Please try again.");
                } else if (status === 7) {
                    toast.error("Please fill in all required fields.");
                } else {
                    toast.error(res.data?.msg || "Error creating account.");
                }
            }
        } catch (err) {
            console.error(err);
            toast.error("Network or server error. Please try again.");
        }
    };

    const handleSendOtp = async () => {
        if (!email) {
            setError("email", { type: "manual", message: "Enter email first before requesting an OTP." });
            return;
        }

        setIsSendingOtp(true);
        try {
            const res = await axios.post('/sendotp', { email });
            if (res.status === 200) {
                if (res.data?.status === 1) {
                    toast.success("OTP sent to " + email);
                    setOtpSent(true);
                    clearErrors("email");
                } else if (res.data?.status === 7) {
                    toast.error("Invalid email address format.");
                } else {
                    toast.error("Failed to send OTP. Please verify your email.");
                }
            }
        } catch (err) {
            console.error(err);
            toast.error("Could not send OTP. Server unreachable.");
        } finally {
            setIsSendingOtp(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
            {/* Background Decorative Blur */}
            <div className="absolute top-0 -right-40 w-96 h-96 bg-indigo-200/50 rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute bottom-0 -left-40 w-96 h-96 bg-violet-200/50 rounded-full blur-3xl pointer-events-none -z-10" />

            {/* Header Brand */}
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <Link to="/" className="inline-flex items-center gap-2 group mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <span className="text-2xl font-bold tracking-tight text-slate-900">
                        CleanCSV<span className="text-indigo-600">.ai</span>
                    </span>
                </Link>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Create your account ✨
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">
                    Get started with AI-driven CSV cleaning in seconds
                </p>
            </div>

            {/* Form Card */}
            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
                <div className="bg-white py-8 px-6 sm:px-10 shadow-xl shadow-slate-200/50 border border-slate-200/80 rounded-2xl">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Name Field */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                                Full Name
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Sarah Connor"
                                    {...register("name", { required: "Full name is required" })}
                                    className={`w-full pl-10 pr-3 py-2.5 bg-slate-50 border ${errors.name ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-500'} rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition`}
                                />
                            </div>
                            {errors.name && (
                                <p className="mt-1.5 text-xs text-rose-500 font-medium">{errors.name.message}</p>
                            )}
                        </div>

                        {/* Email Field with Send OTP Button */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                                Email Address
                            </label>
                            <div className="relative flex items-center">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                    </svg>
                                </div>
                                <input
                                    type="email"
                                    placeholder="name@company.com"
                                    {...register("email", {
                                        required: "Email is required",
                                        pattern: {
                                            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                            message: "Please enter a valid email",
                                        },
                                    })}
                                    className={`w-full pl-10 pr-28 py-2.5 bg-slate-50 border ${errors.email ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-500'} rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition`}
                                />
                                <button
                                    type="button"
                                    onClick={handleSendOtp}
                                    disabled={isSendingOtp}
                                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition cursor-pointer flex items-center gap-1"
                                >
                                    {isSendingOtp ? "Sending..." : (otpSent ? "Resend" : "Send OTP")}
                                </button>
                            </div>
                            {errors.email && (
                                <p className="mt-1.5 text-xs text-rose-500 font-medium">{errors.email.message}</p>
                            )}
                        </div>

                        {/* OTP Field (shows once OTP requested) */}
                        {otpSent && (
                            <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-900">
                                        Verification OTP
                                    </label>
                                    <span className="text-[11px] text-indigo-600 font-medium">Valid for 5 mins</span>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Enter 6-digit code"
                                    {...register("otp", {
                                        required: "OTP is required",
                                        minLength: { value: 4, message: "Code must be at least 4 digits" }
                                    })}
                                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-mono text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300 transition tracking-widest text-center"
                                />
                                {errors.otp && (
                                    <p className="text-xs text-rose-500 font-medium">{errors.otp.message}</p>
                                )}
                            </div>
                        )}

                        {/* Password Field */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                                Create Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="At least 6 characters"
                                    {...register("password", {
                                        required: "Password is required",
                                        minLength: { value: 6, message: "Password must be at least 6 characters" },
                                    })}
                                    className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border ${errors.password ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-500'} rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    {showPassword ? (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1.5 text-xs text-rose-500 font-medium">{errors.password.message}</p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Creating Account...
                                </>
                            ) : (
                                "Create Account"
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-500">
                            Already have an account?{" "}
                            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="mt-4 text-center">
                    <Link to="/" className="text-xs text-slate-500 hover:text-slate-800 transition">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default SignupForm;
