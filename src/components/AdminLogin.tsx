import React, { useState } from "react";
import { auth, googleProvider } from "../firebase";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { ShieldCheck, LogIn, Mail, Lock, Sparkles, AlertCircle } from "lucide-react";

interface AdminLoginProps {
  onSuccess: () => void;
  onGoToVerify: () => void;
}

export default function AdminLogin({ onSuccess, onGoToVerify }: AdminLoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError("Please fill in all fields.");
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess();
    } catch (err: any) {
      console.error("Auth error:", err);
      let errMsg = "Authentication failed. Please check your credentials.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        errMsg = "Invalid email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        errMsg = "This email is already registered.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "Password should be at least 6 characters.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onSuccess();
    } catch (err: any) {
      console.error("Google Auth error:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12" id="login-container">
      <div className="w-full max-w-md space-y-8 bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-teal-500/10 text-teal-400 rounded-full mb-2">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Tech Lab Academy</h1>
          <p className="text-sm text-slate-400">Admission & Fees Management Portal</p>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-red-950/40 border border-red-800 text-red-200 text-sm p-3 rounded-lg animate-fadeIn">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="email"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-600"
                placeholder="admin@techlabacademy.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="password"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-600"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-800 text-slate-950 font-semibold rounded-lg py-3 px-6 transition-colors text-sm flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Processing..." : isSignUp ? "Create Admin Account" : "Sign In to Portal"}
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-4 text-xs uppercase tracking-widest text-slate-600">or</span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-white font-medium rounded-lg py-3 px-6 transition-colors text-sm flex items-center justify-center gap-3 cursor-pointer"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.63z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.85 2.99c.87-2.6 3.3-4.67 6.16-4.67z"
            />
          </svg>
          Sign In with Google
        </button>

        <div className="flex flex-col items-center gap-4 pt-4 border-t border-slate-800">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-teal-400 hover:underline bg-transparent border-none cursor-pointer"
          >
            {isSignUp ? "Already have an account? Sign In" : "Need to register for first-time setup? Sign Up"}
          </button>

          <button
            onClick={onGoToVerify}
            className="text-sm font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer bg-slate-950/80 hover:bg-slate-800/80 px-4 py-2 rounded-full border border-slate-800"
          >
            <Sparkles className="h-4 w-4 text-teal-400" />
            Public Certificate Verification
          </button>
        </div>
      </div>
    </div>
  );
}
