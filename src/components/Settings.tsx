import React, { useState } from "react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Sliders, ShieldAlert, Trash2, Database, AlertTriangle, CheckCircle } from "lucide-react";

interface SettingsProps {
  adminEmail?: string | null;
}

export default function Settings({ adminEmail }: SettingsProps) {
  const [typedConfirm, setTypedConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleClearDemoData = async () => {
    if (typedConfirm !== "DELETE") {
      setErrorMessage("Confirmation word does not match.");
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Delete Students
      const studentsSnap = await getDocs(collection(db, "students")).catch((err) => {
        handleFirestoreError(err, OperationType.GET, "students");
      });
      if (studentsSnap) {
        const studentPromises = studentsSnap.docs.map((studentDoc) =>
          deleteDoc(doc(db, "students", studentDoc.id)).catch((err) => {
            handleFirestoreError(err, OperationType.DELETE, `students/${studentDoc.id}`);
          })
        );
        await Promise.all(studentPromises);
      }

      // 2. Delete Payments
      const paymentsSnap = await getDocs(collection(db, "payments")).catch((err) => {
        handleFirestoreError(err, OperationType.GET, "payments");
      });
      if (paymentsSnap) {
        const paymentPromises = paymentsSnap.docs.map((paymentDoc) =>
          deleteDoc(doc(db, "payments", paymentDoc.id)).catch((err) => {
            handleFirestoreError(err, OperationType.DELETE, `payments/${paymentDoc.id}`);
          })
        );
        await Promise.all(paymentPromises);
      }

      // 3. Delete Expenses
      const expensesSnap = await getDocs(collection(db, "expenses")).catch((err) => {
        handleFirestoreError(err, OperationType.GET, "expenses");
      });
      if (expensesSnap) {
        const expensePromises = expensesSnap.docs.map((expenseDoc) =>
          deleteDoc(doc(db, "expenses", expenseDoc.id)).catch((err) => {
            handleFirestoreError(err, OperationType.DELETE, `expenses/${expenseDoc.id}`);
          })
        );
        await Promise.all(expensePromises);
      }

      setSuccessMessage("All student, payment, and expense data has been cleared.");
      setTypedConfirm("");
      setShowConfirmModal(false);
    } catch (err: any) {
      console.error("Failed to clear collections:", err);
      setErrorMessage(err.message || "An error occurred while clearing data.");
    } finally {
      setIsDeleting(false);
    }
  };

  const openConfirmation = () => {
    setTypedConfirm("");
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowConfirmModal(true);
  };

  return (
    <div className="space-y-6" id="settings-workspace">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sliders className="h-8 w-8 text-teal-400" />
              Settings & Administration
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            View system preferences, manage database maintenance, and perform administrative cleanup operations.
          </p>
        </div>
      </div>

      {/* Success/Error Notifications */}
      {successMessage && (
        <div className="bg-teal-500/15 border border-teal-500/30 text-teal-400 px-4 py-3.5 rounded-xl flex items-start gap-3">
          <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Operation Successful</p>
            <p className="text-xs text-slate-300 mt-0.5">{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-500/15 border border-rose-500/30 text-rose-400 px-4 py-3.5 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Operation Failed</p>
            <p className="text-xs text-slate-300 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* System Status Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Database className="h-4 w-4 text-teal-400" />
          Database Connection Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Connected User</span>
            <span className="text-xs font-mono text-slate-300 truncate block mt-1">{adminEmail || "Administrator"}</span>
          </div>
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Database Server</span>
            <span className="text-xs font-semibold text-teal-400 block mt-1">Firestore Enterprise</span>
          </div>
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Tech Lab CRM Sync</span>
            <span className="text-xs font-semibold text-emerald-400 block mt-1">Live & Active</span>
          </div>
        </div>
      </div>

      {/* Danger Zone Section */}
      <div className="border border-rose-500/30 bg-rose-500/5 rounded-xl p-6 shadow-sm space-y-4" id="danger-zone-section">
        <div className="flex items-center gap-2 text-rose-400">
          <ShieldAlert className="h-6 w-6" />
          <h2 className="text-lg font-bold">Danger Zone</h2>
        </div>
        <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
          The operations in this section are destructive and permanent. Please exercise extreme caution before proceeding.
        </p>

        <div className="pt-2 border-t border-rose-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">Clear Demo Data</h3>
            <p className="text-xs text-slate-400 mt-1">
              Delete all student registrations, payment logs, and center expense entries.
            </p>
          </div>
          <button
            onClick={openConfirmation}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm self-start sm:self-center"
          >
            <Trash2 className="h-4 w-4" />
            Clear All Students, Payments & Expenses Data
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" id="confirm-delete-modal">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <ShieldAlert className="h-6 w-6 shrink-0 animate-pulse" />
              <h3 className="text-lg font-bold text-white">Permanent Deletion Warning</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently delete ALL student records, payment history, and expense entries from the database. This action cannot be undone. This does NOT affect courses, batches, or any leads in the connected CRM.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 block">
                To confirm, type the word <strong className="text-white font-mono uppercase bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">DELETE</strong> below:
              </label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors placeholder:text-slate-600 font-semibold"
                placeholder="Type DELETE to enable action"
                value={typedConfirm}
                onChange={(e) => setTypedConfirm(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={typedConfirm !== "DELETE" || isDeleting}
                onClick={handleClearDemoData}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-transparent text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? "Processing Deletion..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
