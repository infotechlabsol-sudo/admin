import React, { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Search, Award, Calendar, BookOpen, AlertCircle, ShieldAlert, ArrowLeft, Loader } from "lucide-react";

interface PublicVerifyProps {
  onBackToLogin: () => void;
}

interface VerifiedData {
  name: string;
  course_type: string;
  batch_start_date: string;
  certificate_status: "Issued" | "Not Issued";
  certificate_issue_date?: string;
  registration_number: string;
}

export default function PublicVerify({ onBackToLogin }: PublicVerifyProps) {
  const [regNum, setRegNum] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifiedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(true);

    const formattedReg = regNum.trim().toUpperCase();
    if (!formattedReg || !dob) {
      setError("Please fill in both Registration Number and Date of Birth.");
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, "students"),
        where("registration_number", "==", formattedReg),
        where("dob", "==", dob)
      );
      
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setError("No matching student record found. Please verify the Registration Number and Date of Birth.");
      } else {
        const studentDoc = snap.docs[0];
        const data = studentDoc.data();
        setResult({
          name: data.name,
          course_type: data.course_type,
          batch_start_date: data.batch_start_date,
          certificate_status: data.certificate_status || "Not Issued",
          certificate_issue_date: data.certificate_issue_date,
          registration_number: data.registration_number
        });
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setError("An error occurred during verification. Please check your credentials or network.");
      // Capture detailed telemetry as requested by security specs, but don't crash
      try {
        handleFirestoreError(err, OperationType.GET, "students_verification");
      } catch (inner) {}
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-white" id="public-verify-container">
      {/* Top Bar */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className="h-6 w-6 text-teal-400" />
            <span className="font-bold text-lg tracking-tight">Tech Lab Academy</span>
          </div>
          <button
            onClick={onBackToLogin}
            className="text-sm font-medium text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Admin Portal
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Certificate Verification
            </h1>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              Verify student graduation and certificate authenticity securely.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 md:p-8 shadow-xl space-y-6">
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Registration Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., TLA-2026-0001"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors uppercase placeholder:text-slate-700"
                  value={regNum}
                  onChange={(e) => setRegNum(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Student Date of Birth
                </label>
                <input
                  type="date"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-700"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-800 text-slate-950 font-semibold rounded-lg py-3 px-6 transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Verify Certificate
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 bg-red-950/30 border border-red-900/50 text-red-300 text-sm p-4 rounded-lg animate-fadeIn">
                <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Result Display */}
            {result && (
              <div className="border border-teal-900/50 bg-teal-950/10 rounded-lg p-6 space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                  <Award className="h-5 w-5 text-teal-400 animate-pulse" />
                  <h3 className="font-bold text-teal-400 uppercase tracking-wide text-xs">
                    Verification Certificate Found
                  </h3>
                </div>

                <div className="space-y-3.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Student Name</span>
                    <span className="font-semibold text-white">{result.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Registration ID</span>
                    <span className="font-semibold text-teal-400 tracking-wider">{result.registration_number}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Course Type</span>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-slate-500" />
                      {result.course_type}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Batch Start</span>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      {result.batch_start_date}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                    <span className="text-slate-400">Certificate Status</span>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wider ${
                        result.certificate_status === "Issued"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {result.certificate_status === "Issued" ? "OFFICIALLY ISSUED" : "NOT ISSUED YET"}
                    </span>
                  </div>

                  {result.certificate_status === "Issued" && result.certificate_issue_date && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Issue Date</span>
                      <span className="font-semibold text-emerald-400">{result.certificate_issue_date}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {searched && !loading && !result && !error && (
              <div className="flex items-start gap-3 bg-slate-950 border border-slate-800 text-slate-400 text-sm p-4 rounded-lg">
                <AlertCircle className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                <p>No verified graduation records found.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Tech Lab Academy. All Rights Reserved. Secure SSL Verification Portal.</p>
      </footer>
    </div>
  );
}
