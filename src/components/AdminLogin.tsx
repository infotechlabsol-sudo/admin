import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { ShieldCheck, LogIn, Mail, Lock, Sparkles, AlertCircle, CheckCircle, HelpCircle, ArrowLeft, Loader2 } from "lucide-react";

interface AdminLoginProps {
  onSuccess: () => void;
  onGoToVerify: () => void;
}

export default function AdminLogin({ onSuccess, onGoToVerify }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forgot Password modal/view state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Login with existing admin credentials only (No Sign Up / Registration allowed)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email.trim() || !password) {
      setError("Please enter your admin email and password.");
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      onSuccess();
    } catch (err: any) {
      console.error("Admin Login error:", err);
      let errMsg = "Invalid email or password. Only registered admin accounts are authorized to log in.";
      if (err.code === "auth/too-many-requests") {
        errMsg = "Too many failed login attempts. Please try again later or reset your password.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Please enter a valid email address.";
      } else if (err.code === "auth/user-disabled") {
        errMsg = "This admin account has been disabled. Please contact the system administrator.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Secure Password Reset for existing accounts (does not reveal if email exists)
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (!resetEmail.trim()) {
      setResetError("Please enter your registered admin email address.");
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      // Neutral message that does not disclose whether the email is registered
      setResetSuccess("If this email address is registered as an admin account, a password reset link has been sent to your inbox. Please check your spam folder as well.");
    } catch (err: any) {
      console.error("Password reset error:", err);
      // For privacy/security, show consistent messaging unless it's a structural format issue
      if (err.code === "auth/invalid-email") {
        setResetError("Please enter a valid email address.");
      } else {
        // Neutral response for security
        setResetSuccess("If this email address is registered as an admin account, a password reset link has been sent to your inbox.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12" id="login-container">
      <div className="w-full max-w-md space-y-8 bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-teal-500/10 text-teal-400 rounded-full mb-2">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Tech Lab Academy</h1>
          <p className="text-sm text-slate-400">Admission & Fees Management Portal</p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="flex items-start gap-3 bg-red-950/40 border border-red-800 text-red-200 text-sm p-3.5 rounded-lg animate-fadeIn">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {/* Admin Login Form - Existing accounts only */}
        <form onSubmit={handleLogin} className="space-y-4" id="admin-login-form">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="email"
                required
                autoComplete="username"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-600"
                placeholder="admin@techlabacademy.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                id="login-email-input"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Password</label>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setResetError(null);
                  setResetSuccess(null);
                  setShowForgotModal(true);
                }}
                className="text-[11px] text-teal-400 hover:underline bg-transparent border-none cursor-pointer"
                id="forgot-password-btn"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="password"
                required
                autoComplete="current-password"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-600"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                id="login-password-input"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold rounded-lg py-3 px-6 transition-colors text-sm flex items-center justify-center gap-2 mt-2 cursor-pointer shadow-md"
            id="admin-login-submit-btn"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Log In
              </>
            )}
          </button>
        </form>

        {/* Security Notice for Admins */}
        <div className="bg-slate-950/60 border border-slate-850 rounded-lg p-3 text-center">
          <p className="text-[11px] text-slate-400">
            Access is restricted to authorized Tech Lab Academy administrators. New accounts must be provisioned directly by the system administrator.
          </p>
        </div>

        {/* Public Certificate Verification (Accessible to everyone without logging in) */}
        <div className="flex flex-col items-center gap-4 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onGoToVerify}
            className="text-sm font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer bg-slate-950/80 hover:bg-slate-800/80 px-4 py-2.5 rounded-full border border-slate-800 transition-colors"
            id="public-verify-nav-btn"
          >
            <Sparkles className="h-4 w-4 text-teal-400" />
            Public Certificate Verification
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" id="forgot-password-modal">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-teal-400">
                <HelpCircle className="h-5 w-5" />
                <h3 className="text-base font-bold text-white">Reset Admin Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Enter your registered administrator email address below to receive a secure password reset link.
            </p>

            {resetSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3.5 rounded-lg flex items-start gap-2.5">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                <p className="leading-relaxed">{resetSuccess}</p>
              </div>
            )}

            {resetError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-lg flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <p className="leading-relaxed">{resetError}</p>
              </div>
            )}

            {!resetSuccess && (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Admin Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-white text-xs focus:outline-none focus:border-teal-500 transition-colors"
                      placeholder="admin@techlabacademy.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Sending Link...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>
                </div>
              </form>
            )}

            {resetSuccess && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
