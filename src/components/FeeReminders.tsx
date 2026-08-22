import React, { useState, useMemo } from "react";
import { Student, Payment } from "../types";
import { getReminderEmailUrl, getReminderWhatsAppUrl } from "../reminderService";
import ReceiptModal from "./ReceiptModal";
import { 
  Bell, Search, Filter, Mail, MessageSquare, AlertCircle, 
  Calendar, CreditCard, ChevronRight, CheckCircle2, Info, Clock, FileText
} from "lucide-react";

interface FeeRemindersProps {
  students: Student[];
  payments: Payment[];
  onSelectStudent: (studentId: string) => void;
}

export default function FeeReminders({ students, payments, onSelectStudent }: FeeRemindersProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"All" | "Due" | "NotDue">("All");
  const [receiptModalStudent, setReceiptModalStudent] = useState<Student | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);

  // Process all students with remaining_fees > 0
  const reminderStudents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return students
      .filter((s) => (s.remaining_fees || 0) > 0 && s.status !== "Dropped")
      .map((s) => {
        const studentPayments = payments.filter((p) => p.student_id === s.id);
        let lastPaymentDate = "";
        let totalPaid = 0;

        if (studentPayments.length > 0) {
          const sorted = [...studentPayments].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          lastPaymentDate = sorted[0].date;
          totalPaid = studentPayments.reduce((sum, p) => sum + p.amount, 0);
        } else {
          lastPaymentDate = s.admission_date || s.batch_start_date || todayStr;
          totalPaid = s.admission_fees || 0;
        }

        // Calculate days elapsed
        const refDate = new Date(lastPaymentDate + "T00:00:00");
        const diffTime = Math.max(0, today.getTime() - refDate.getTime());
        const daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        // Flagged if >= 7 days
        const isDue = daysElapsed >= 7;

        return {
          ...s,
          totalPaid,
          lastPaymentDate,
          daysElapsed,
          isDue,
          hasPayments: studentPayments.length > 0
        };
      })
      .sort((a, b) => {
        // Flagged (due) students first, then by daysElapsed descending
        if (a.isDue !== b.isDue) {
          return a.isDue ? -1 : 1;
        }
        return b.daysElapsed - a.daysElapsed;
      });
  }, [students, payments, todayStr]);

  // Filtered results by search & status tab
  const filteredList = useMemo(() => {
    return reminderStudents.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.registration_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.course_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone.includes(searchTerm);

      if (!matchesSearch) return false;

      if (filterMode === "Due") return s.isDue;
      if (filterMode === "NotDue") return !s.isDue;
      return true;
    });
  }, [reminderStudents, searchTerm, filterMode]);

  const dueCount = useMemo(() => reminderStudents.filter((s) => s.isDue).length, [reminderStudents]);
  const totalOutstandingCount = reminderStudents.length;
  const totalOutstandingAmount = useMemo(
    () => reminderStudents.reduce((sum, s) => sum + s.remaining_fees, 0),
    [reminderStudents]
  );

  return (
    <div className="space-y-6" id="fee-reminders-workspace">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">Fee Reminders</h1>
            {dueCount > 0 && (
              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {dueCount} Action Required
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            Automatically flags students due for payment reminders. Send pre-filled reminders via Gmail or WhatsApp in 1-click.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Outstanding</span>
            <span className="text-lg font-extrabold text-white">₹{totalOutstandingAmount.toLocaleString()}</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Pending Accounts</span>
            <span className="text-lg font-extrabold text-teal-400">{totalOutstandingCount} Students</span>
          </div>
        </div>
      </div>

      {/* Mandatory Notice Box */}
      <div className="bg-teal-950/30 border border-teal-800/40 rounded-xl p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-0.5 text-teal-200">
          <p className="font-bold">Automated Flagging & Manual One-Click Dispatch</p>
          <p className="text-teal-300/80">
            Students are flagged automatically when <strong className="text-white">7+ days have passed</strong> since their last payment (or since admission date if no payment made yet).
            <span className="ml-1 text-teal-100 italic">Reminders are flagged automatically but sent manually with one click — no message is sent without your action.</span>
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, reg #, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilterMode("All")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              filterMode === "All"
                ? "bg-teal-500/10 text-teal-400 border border-teal-500/30"
                : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            All Pending ({totalOutstandingCount})
          </button>
          <button
            onClick={() => setFilterMode("Due")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterMode === "Due"
                ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
            Reminder Due ({dueCount})
          </button>
          <button
            onClick={() => setFilterMode("NotDue")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              filterMode === "NotDue"
                ? "bg-teal-500/10 text-teal-400 border border-teal-500/30"
                : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Recent / Under 7 Days ({totalOutstandingCount - dueCount})
          </button>
        </div>
      </div>

      {/* Reminder Student List */}
      <div className="space-y-3">
        {filteredList.length > 0 ? (
          filteredList.map((s) => {
            const reminderData = {
              name: s.name,
              phone: s.phone,
              email: s.email,
              registration_number: s.registration_number,
              course_type: s.course_type,
              total_fees: s.total_fees,
              totalPaid: s.totalPaid,
              remaining_fees: s.remaining_fees
            };

            return (
              <div
                key={s.id}
                className={`bg-slate-900 border rounded-xl p-4 sm:p-5 transition-all shadow-sm ${
                  s.isDue
                    ? "border-rose-900/50 bg-rose-950/10 hover:border-rose-700/60"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Student Basic Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        onClick={() => onSelectStudent(s.id)}
                        className="text-base font-bold text-white hover:text-teal-400 cursor-pointer transition-colors"
                      >
                        {s.name}
                      </h3>
                      <span className="font-mono text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full font-bold">
                        {s.registration_number}
                      </span>

                      {s.isDue ? (
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                          <AlertCircle className="h-3 w-3 text-rose-400" />
                          Reminder Due ({s.daysElapsed} days since last payment)
                        </span>
                      ) : (
                        <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {s.daysElapsed} days elapsed
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>Course: <strong className="text-slate-200">{s.course_type}</strong></span>
                      <span>Phone: <strong className="text-slate-200">{s.phone}</strong></span>
                      <span>Email: <strong className="text-slate-200">{s.email}</strong></span>
                      <span>
                        Last Activity:{" "}
                        <strong className="text-slate-200 font-mono">
                          {s.hasPayments ? s.lastPaymentDate : `Admission (${s.lastPaymentDate})`}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Financial Amounts & Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6 shrink-0 border-t lg:border-t-0 border-slate-800/80 pt-3 lg:pt-0">
                    <div className="text-left sm:text-right space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Remaining Due</span>
                      <span className="text-xl font-extrabold text-rose-400 block">
                        ₹{s.remaining_fees.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Paid ₹{s.totalPaid.toLocaleString()} of ₹{s.total_fees.toLocaleString()}
                      </span>
                    </div>

                    {/* Action Group */}
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={getReminderEmailUrl(reminderData)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-teal-400 font-semibold rounded-lg py-2 px-3 transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
                        title="Send Email Reminder via Gmail"
                      >
                        <Mail className="h-3.5 w-3.5 text-teal-400" />
                        Email Reminder
                      </a>

                      <a
                        href={getReminderWhatsAppUrl(reminderData)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-400 font-semibold rounded-lg py-2 px-3 transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
                        title="Send WhatsApp Reminder via WhatsApp Web"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                        WhatsApp
                      </a>

                      <button
                        onClick={() => setReceiptModalStudent(s)}
                        className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-teal-400 font-semibold rounded-lg py-2 px-3 transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
                        title="View Quick Receipt"
                      >
                        <FileText className="h-3.5 w-3.5 text-teal-400" />
                        Receipt
                      </button>

                      <button
                        onClick={() => onSelectStudent(s.id)}
                        className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="View Full Student Details"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Outstanding Reminders</h3>
            <p className="text-slate-400 text-xs max-w-md mx-auto">
              All students are up to date or no accounts match your current filter criteria.
            </p>
          </div>
        )}
      </div>

      {/* Quick Receipt Modal */}
      <ReceiptModal
        isOpen={!!receiptModalStudent}
        onClose={() => setReceiptModalStudent(null)}
        student={receiptModalStudent}
        paymentsList={payments.filter((p) => p.student_id === receiptModalStudent?.id)}
      />
    </div>
  );
}
