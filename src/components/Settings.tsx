import React, { useState, useRef, useEffect } from "react";
import { collection, getDocs, doc, deleteDoc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import {
  getMessageTemplates,
  saveMessageTemplates,
  resetMessageTemplatesToDefault,
  MessageTemplate
} from "../templateService";
import {
  Sliders,
  ShieldAlert,
  Trash2,
  Database,
  AlertTriangle,
  CheckCircle,
  Download,
  Upload,
  FileJson,
  Info,
  Archive,
  RefreshCw,
  X,
  FileSpreadsheet,
  MessageSquare,
  FileText,
  Save,
  RotateCcw,
  Plus
} from "lucide-react";

interface SettingsProps {
  adminEmail?: string | null;
}

interface BackupPayload {
  backup_date?: string;
  students?: Array<{ id?: string; [key: string]: any }>;
  payments?: Array<{ id?: string; [key: string]: any }>;
  expenses?: Array<{ id?: string; [key: string]: any }>;
  courses?: Array<{ id?: string; [key: string]: any }>;
  batches?: Array<{ id?: string; [key: string]: any }>;
}

export default function Settings({ adminEmail }: SettingsProps) {
  // Clear Demo Data states
  const [typedConfirm, setTypedConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Backup & Restore states
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [backupFileToRestore, setBackupFileToRestore] = useState<{
    filename: string;
    data: BackupPayload;
    counts: {
      students: number;
      payments: number;
      expenses: number;
      courses: number;
      batches: number;
    };
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Message Templates states
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateForEdit, setSelectedTemplateForEdit] = useState<string>("tpl_fee_reminder");
  const [templateEditTitle, setTemplateEditTitle] = useState("");
  const [templateEditBody, setTemplateEditBody] = useState("");
  const [isTemplateSaved, setIsTemplateSaved] = useState(false);

  useEffect(() => {
    const loaded = getMessageTemplates();
    setTemplates(loaded);
    const initial = loaded.find((t) => t.id === "tpl_fee_reminder") || loaded[0];
    if (initial) {
      setSelectedTemplateForEdit(initial.id);
      setTemplateEditTitle(initial.title);
      setTemplateEditBody(initial.body);
    }
  }, []);

  const handleSelectTemplateToEdit = (id: string) => {
    setSelectedTemplateForEdit(id);
    const match = templates.find((t) => t.id === id);
    if (match) {
      setTemplateEditTitle(match.title);
      setTemplateEditBody(match.body);
      setIsTemplateSaved(false);
    }
  };

  const handleSaveCurrentTemplate = () => {
    const updated = templates.map((t) => {
      if (t.id === selectedTemplateForEdit) {
        return {
          ...t,
          title: templateEditTitle,
          body: templateEditBody
        };
      }
      return t;
    });
    setTemplates(updated);
    saveMessageTemplates(updated);
    setIsTemplateSaved(true);
    setSuccessMessage(`Template "${templateEditTitle}" saved successfully.`);
    setTimeout(() => setIsTemplateSaved(false), 3000);
  };

  const handleResetTemplates = () => {
    const reset = resetMessageTemplatesToDefault();
    setTemplates(reset);
    const initial = reset.find((t) => t.id === selectedTemplateForEdit) || reset[0];
    if (initial) {
      setSelectedTemplateForEdit(initial.id);
      setTemplateEditTitle(initial.title);
      setTemplateEditBody(initial.body);
    }
    setSuccessMessage("Message templates have been reset to default.");
  };

  // 1. Download Complete Backup
  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Fetch all required collections in parallel
      const [studentsSnap, paymentsSnap, expensesSnap, coursesSnap, batchesSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "payments")),
        getDocs(collection(db, "expenses")),
        getDocs(collection(db, "courses")),
        getDocs(collection(db, "batches"))
      ]);

      const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const payments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const courses = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const batches = batchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const backupData = {
        backup_date: new Date().toISOString(),
        students,
        payments,
        expenses,
        courses,
        batches
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const todayStr = new Date().toISOString().substring(0, 10);
      const filename = `TechLabAcademy_AdmissionPortal_Backup_${todayStr}.json`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccessMessage(
        `Backup complete: ${students.length} students, ${payments.length} payments, ${expenses.length} expenses, ${courses.length} courses, ${batches.length} batches backed up.`
      );
    } catch (err: any) {
      console.error("Failed to generate backup:", err);
      setErrorMessage(err.message || "Failed to fetch database collections for backup.");
    } finally {
      setIsBackingUp(false);
    }
  };

  // 2. Select Backup JSON File
  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected if cancelled
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        if (!content || !content.trim()) {
          setErrorMessage("The selected backup file is empty.");
          return;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(content);
        } catch {
          setErrorMessage("Invalid JSON format: Unable to parse backup content. Please verify the file is a valid JSON document.");
          return;
        }

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setErrorMessage("Invalid backup format: The file must contain a root JSON object.");
          return;
        }

        const students = Array.isArray(parsed.students) ? parsed.students : [];
        const payments = Array.isArray(parsed.payments) ? parsed.payments : [];
        const expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
        const courses = Array.isArray(parsed.courses) ? parsed.courses : [];
        const batches = Array.isArray(parsed.batches) ? parsed.batches : [];

        const totalRecords = students.length + payments.length + expenses.length + courses.length + batches.length;
        if (totalRecords === 0 && !parsed.backup_date) {
          setErrorMessage("Invalid backup structure: No valid collections (students, payments, expenses, courses, batches) found in the file.");
          return;
        }

        setBackupFileToRestore({
          filename: file.name,
          data: {
            backup_date: parsed.backup_date,
            students,
            payments,
            expenses,
            courses,
            batches
          },
          counts: {
            students: students.length,
            payments: payments.length,
            expenses: expenses.length,
            courses: courses.length,
            batches: batches.length
          }
        });
        setShowRestoreModal(true);
      } catch (err: any) {
        console.error("Error reading restore file:", err);
        setErrorMessage(err.message || "Failed to process the backup file.");
      }
    };

    reader.onerror = () => {
      setErrorMessage("Failed to read the selected backup file from your device.");
    };

    reader.readAsText(file);
  };

  // 3. Confirm and Execute Restore
  const handleConfirmRestore = async () => {
    if (!backupFileToRestore) return;

    setIsRestoring(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { students = [], payments = [], expenses = [], courses = [], batches = [] } = backupFileToRestore.data;

      let restoredStudents = 0;
      let restoredPayments = 0;
      let restoredExpenses = 0;
      let restoredCourses = 0;
      let restoredBatches = 0;

      // 1. Restore Students
      for (const s of students) {
        if (!s || typeof s !== "object") continue;
        const { id, ...docData } = s;
        if (id) {
          await setDoc(doc(db, "students", id), docData);
          restoredStudents++;
        }
      }

      // 2. Restore Payments
      for (const p of payments) {
        if (!p || typeof p !== "object") continue;
        const { id, ...docData } = p;
        if (id) {
          await setDoc(doc(db, "payments", id), docData);
          restoredPayments++;
        }
      }

      // 3. Restore Expenses
      for (const e of expenses) {
        if (!e || typeof e !== "object") continue;
        const { id, ...docData } = e;
        if (id) {
          await setDoc(doc(db, "expenses", id), docData);
          restoredExpenses++;
        }
      }

      // 4. Restore Courses
      for (const c of courses) {
        if (!c || typeof c !== "object") continue;
        const { id, ...docData } = c;
        if (id) {
          await setDoc(doc(db, "courses", id), docData);
          restoredCourses++;
        }
      }

      // 5. Restore Batches
      for (const b of batches) {
        if (!b || typeof b !== "object") continue;
        const { id, ...docData } = b;
        if (id) {
          await setDoc(doc(db, "batches", id), docData);
          restoredBatches++;
        }
      }

      setSuccessMessage(
        `Restore complete: ${restoredStudents} students, ${restoredPayments} payments, ${restoredExpenses} expenses, ${restoredCourses} courses, ${restoredBatches} batches restored into the database.`
      );
      setShowRestoreModal(false);
      setBackupFileToRestore(null);
    } catch (err: any) {
      console.error("Failed to restore backup:", err);
      setErrorMessage(err.message || "An error occurred while restoring data into the database.");
    } finally {
      setIsRestoring(false);
    }
  };

  // Clear Demo Data Handler
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
          <p className="text-sm text-slate-400 mt-1">
            View system preferences, manage database backups, and perform administrative cleanup operations.
          </p>
        </div>
      </div>

      {/* Success/Error Notifications */}
      {successMessage && (
        <div className="bg-teal-500/15 border border-teal-500/30 text-teal-400 px-4 py-3.5 rounded-xl flex items-start gap-3">
          <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">Operation Successful</p>
            <p className="text-xs text-slate-300 mt-0.5">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-500/15 border border-rose-500/30 text-rose-400 px-4 py-3.5 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">Operation Failed</p>
            <p className="text-xs text-slate-300 mt-0.5">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
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

      {/* SECTION 1: DATA BACKUP (Placed above Danger Zone) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5" id="data-backup-section">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5 text-teal-400">
            <Archive className="h-6 w-6" />
            <div>
              <h2 className="text-lg font-bold text-white">Data Backup</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Export and import complete database snapshots for peace of mind and data redundancy.
              </p>
            </div>
          </div>
        </div>

        {/* Explanatory Note */}
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3.5 flex items-start gap-3">
          <Info className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-300 leading-relaxed">
            We recommend downloading a backup at least once a month and saving it somewhere safe (like Google Drive or your computer), in addition to Firebase&apos;s own reliability.
          </p>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Download Complete Backup Card */}
          <div className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-teal-400 font-bold text-sm">
                <FileJson className="h-4 w-4" />
                <span>Complete Database Snapshot</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Fetches all students, payment records, expense logs, courses, and batches into a single JSON archive.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={isBackingUp}
              className="w-full py-2.5 px-4 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold rounded-lg text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              id="download-complete-backup-btn"
            >
              {isBackingUp ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating Backup...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download Complete Backup
                </>
              )}
            </button>
          </div>

          {/* Restore from Backup Card */}
          <div className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                <Upload className="h-4 w-4 text-teal-400" />
                <span>Database Restoration</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Select a previously saved backup JSON file to restore records directly into Firestore with ID preservation.
              </p>
            </div>

            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                onChange={handleSelectFile}
                className="hidden"
                id="restore-file-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isRestoring}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-bold rounded-lg text-xs sm:text-sm shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                id="restore-from-backup-btn"
              >
                <Upload className="h-4 w-4 text-teal-400" />
                Restore from Backup
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: MESSAGE TEMPLATES */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5" id="message-templates-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <MessageSquare className="h-6 w-6" />
            <div>
              <h2 className="text-lg font-bold text-white">WhatsApp & Message Templates</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize predefined message templates for reminders, birthday wishes, and admission communications.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetTemplates}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-center"
            title="Reset templates to factory defaults"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </button>
        </div>

        {/* Template Selector Tabs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplateToEdit(tpl.id)}
                className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedTemplateForEdit === tpl.id
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                    : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                {tpl.title}
              </button>
            ))}
          </div>

          {/* Template Editor Box */}
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Template Title</label>
              <input
                type="text"
                value={templateEditTitle}
                onChange={(e) => setTemplateEditTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Template Title"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 block">Message Body</label>
                <span className="text-[11px] text-slate-500 font-mono">
                  {templateEditBody.length} chars
                </span>
              </div>
              <textarea
                rows={5}
                value={templateEditBody}
                onChange={(e) => setTemplateEditBody(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors leading-relaxed font-sans"
                placeholder="Write your template text with placeholders..."
              />
            </div>

            {/* Placeholders Help Box */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Available Dynamic Placeholders
              </span>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {["{{name}}", "{{phone}}", "{{registration_number}}", "{{course_type}}", "{{remaining_fees}}", "{{total_fees}}", "{{total_paid}}", "{{batch_start_date}}"].map((token) => (
                  <span
                    key={token}
                    onClick={() => setTemplateEditBody((prev) => prev + " " + token)}
                    className="font-mono bg-slate-950 text-emerald-400 hover:text-white hover:bg-emerald-950/60 border border-slate-800 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    title="Click to insert at end"
                  >
                    {token}
                  </span>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-850">
              <button
                type="button"
                onClick={handleSaveCurrentTemplate}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-md"
              >
                {isTemplateSaved ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: DANGER ZONE */}
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

      {/* Restore Confirmation Dialog Modal */}
      {showRestoreModal && backupFileToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" id="confirm-restore-modal">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-amber-400">
                <AlertTriangle className="h-6 w-6 shrink-0" />
                <h3 className="text-lg font-bold text-white">Confirm Database Restore</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isRestoring) {
                    setShowRestoreModal(false);
                    setBackupFileToRestore(null);
                  }
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
                disabled={isRestoring}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Warning Text Mandated by Requirement */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3.5">
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Restoring a backup will add all records from this file into the database. If a record with the same ID already exists, it will be overwritten with the backup version. This does not delete any current data that isn&apos;t in the backup file. Are you sure you want to continue?
              </p>
            </div>

            {/* Backup Summary Breakdown */}
            <div className="bg-slate-950 border border-slate-850 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-850">
                <span className="text-slate-400 font-medium">Selected Backup File:</span>
                <span className="font-mono text-teal-400 font-bold truncate max-w-[240px]">{backupFileToRestore.filename}</span>
              </div>
              {backupFileToRestore.data.backup_date && (
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-850">
                  <span className="text-slate-400 font-medium">Backup Timestamp:</span>
                  <span className="text-slate-300 font-mono text-[11px]">{new Date(backupFileToRestore.data.backup_date).toLocaleString()}</span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                <div className="bg-slate-900 border border-slate-800 rounded p-2 text-center">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Students</span>
                  <span className="text-sm font-bold text-white">{backupFileToRestore.counts.students}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-2 text-center">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Payments</span>
                  <span className="text-sm font-bold text-white">{backupFileToRestore.counts.payments}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-2 text-center">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Expenses</span>
                  <span className="text-sm font-bold text-white">{backupFileToRestore.counts.expenses}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-2 text-center">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Courses</span>
                  <span className="text-sm font-bold text-white">{backupFileToRestore.counts.courses}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-2 text-center">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Batches</span>
                  <span className="text-sm font-bold text-white">{backupFileToRestore.counts.batches}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreModal(false);
                  setBackupFileToRestore(null);
                }}
                className="px-4 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                disabled={isRestoring}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-lg text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-2 shadow-md"
                id="confirm-restore-btn"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Restoring Database Records...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirm &amp; Restore
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Data Confirmation Modal */}
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
