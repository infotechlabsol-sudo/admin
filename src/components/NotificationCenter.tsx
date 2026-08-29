import React, { useState, useEffect, useRef, useMemo } from "react";
import { Student, Payment } from "../types";
import { getReminderEmailUrl } from "../reminderService";
import { getBirthdayEmailUrl } from "./Birthdays";
import WhatsAppModal from "./WhatsAppModal";
import { LeadOrStudentData } from "../templateService";
import {
  Bell,
  Mail,
  MessageSquare,
  Check,
  CheckCircle2,
  AlertCircle,
  Cake,
  Calendar,
  X,
  CreditCard,
  RotateCcw
} from "lucide-react";

interface NotificationCenterProps {
  students: Student[];
  payments: Payment[];
  onNavigate?: (view: "dashboard" | "admission" | "import-leads" | "students" | "detail" | "finance" | "reminders" | "birthdays" | "settings") => void;
  onSelectStudent?: (studentId: string) => void;
}

// Built-in Web Audio API chime (zero external dependencies, 100% reliable)
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Two pleasant harmonic tones in sequence (C6 -> G6)
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1046.5, now); // C6 note
    gain1.gain.setValueAtTime(0.09, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1567.98, now + 0.08); // G6 note
    gain2.gain.setValueAtTime(0.09, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.4);
  } catch (err) {
    console.debug("Chime playback notice:", err);
  }
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function NotificationCenter({
  students,
  payments,
  onNavigate,
  onSelectStudent
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);

  // Dismissed items state persisted in sessionStorage for today's session
  const storageKey = `tla_dismissed_notifications_${todayStr}`;
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [whatsAppRecipient, setWhatsAppRecipient] = useState<LeadOrStudentData | null>(null);
  const [whatsAppCategory, setWhatsAppCategory] = useState<"fee_reminder" | "birthday" | "admission" | "payment_receipt" | "general">("fee_reminder");

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => {
      const updated = [...prev, id];
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // storage fallback
      }
      return updated;
    });
  };

  const handleRestoreAllDismissed = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds([]);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // storage fallback
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const togglePanel = () => {
    if (!isOpen) {
      playNotificationChime();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // 1. Compute Fee Reminders Due (remaining_fees > 0 & 7+ days elapsed)
  const feeRemindersDue = useMemo(() => {
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

        const refDate = new Date(lastPaymentDate + "T00:00:00");
        const diffTime = Math.max(0, today.getTime() - refDate.getTime());
        const daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const isDue = daysElapsed >= 7;

        const dismissId = `fee_${s.id}_${lastPaymentDate}_${s.remaining_fees}`;

        return {
          student: s,
          totalPaid,
          lastPaymentDate,
          daysElapsed,
          isDue,
          dismissId,
          reminderData: {
            name: s.name,
            phone: s.phone,
            email: s.email,
            registration_number: s.registration_number,
            course_type: s.course_type,
            total_fees: s.total_fees,
            totalPaid,
            remaining_fees: s.remaining_fees
          }
        };
      })
      .filter((item) => item.isDue && !dismissedIds.includes(item.dismissId));
  }, [students, payments, todayStr, dismissedIds]);

  // 2. Compute Birthdays (Today & Next 3 Days)
  const { todaysBirthdays, upcomingBirthdays } = useMemo(() => {
    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const currentYear = today.getFullYear();

    const todays: Array<{
      student: Student;
      dobFormatted: string;
      dismissId: string;
    }> = [];

    const upcoming: Array<{
      student: Student;
      dobFormatted: string;
      daysAway: number;
      dismissId: string;
    }> = [];

    students
      .filter((s) => s.dob && s.dob.trim() !== "")
      .forEach((s) => {
        const parts = s.dob!.split("-");
        if (parts.length !== 3) return;

        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        if (isNaN(month) || isNaN(day)) return;

        const isToday = today.getMonth() + 1 === month && today.getDate() === day;
        const dobFormatted = `${day} ${MONTH_NAMES[month - 1]}`;

        if (isToday) {
          const dismissId = `bday_today_${s.id}_${todayStr}`;
          if (!dismissedIds.includes(dismissId)) {
            todays.push({
              student: s,
              dobFormatted,
              dismissId
            });
          }
          return;
        }

        // Calculate days away
        let bDayThisYear = new Date(currentYear, month - 1, day);
        bDayThisYear.setHours(0, 0, 0, 0);

        let daysAway = 0;
        if (bDayThisYear.getTime() < todayZero.getTime()) {
          const bDayNextYear = new Date(currentYear + 1, month - 1, day);
          bDayNextYear.setHours(0, 0, 0, 0);
          const diffTime = bDayNextYear.getTime() - todayZero.getTime();
          daysAway = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } else {
          const diffTime = bDayThisYear.getTime() - todayZero.getTime();
          daysAway = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        // Upcoming within next 3 days only (1 to 3 days away)
        if (daysAway >= 1 && daysAway <= 3) {
          const dismissId = `bday_up3_${s.id}_${currentYear}_${month}_${day}`;
          if (!dismissedIds.includes(dismissId)) {
            upcoming.push({
              student: s,
              dobFormatted,
              daysAway,
              dismissId
            });
          }
        }
      });

    // Sort upcoming by closest day first
    upcoming.sort((a, b) => a.daysAway - b.daysAway);

    return {
      todaysBirthdays: todays,
      upcomingBirthdays: upcoming
    };
  }, [students, todayStr, dismissedIds]);

  const totalPendingCount = feeRemindersDue.length + todaysBirthdays.length + upcomingBirthdays.length;

  return (
    <div className="relative" ref={containerRef} id="notification-center-container">
      {/* Notification Bell Button in Header */}
      <button
        type="button"
        onClick={togglePanel}
        className={`relative p-1.5 sm:p-2 bg-slate-950 border rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 ${
          isOpen
            ? "border-teal-500 text-teal-400 bg-slate-900 shadow-sm"
            : "border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white"
        }`}
        title="Notification Bell & Action Center"
        id="notification-bell-button"
        aria-expanded={isOpen}
      >
        <Bell className={`h-4 w-4 ${totalPendingCount > 0 ? "text-teal-300" : ""}`} />

        {/* Red Badge for Active Pending Items */}
        {totalPendingCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-md animate-pulse"
            id="notification-bell-badge"
          >
            {totalPendingCount > 99 ? "99+" : totalPendingCount}
          </span>
        )}
      </button>

      {/* Dropdown Notification Panel */}
      {isOpen && (
        <div
          className="absolute right-0 sm:right-0 top-full mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm sm:max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[82vh] sm:max-h-[34rem] animate-fadeIn"
          id="notification-dropdown-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-teal-400" />
              <h2 className="text-sm font-bold text-white">Action Center</h2>
              {totalPendingCount > 0 && (
                <span className="bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {totalPendingCount} Pending
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {dismissedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleRestoreAllDismissed}
                  className="text-[11px] text-slate-400 hover:text-teal-400 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Restore dismissed notifications"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Restore</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                title="Close Panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Notification Items List */}
          <div className="overflow-y-auto p-3 space-y-4 flex-1">
            {totalPendingCount === 0 ? (
              /* Empty State */
              <div className="py-10 px-4 text-center space-y-2.5" id="notification-empty-state">
                <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-white">You&apos;re all caught up!</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  No pending reminders or birthdays requiring immediate attention right now.
                </p>
                {dismissedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRestoreAllDismissed}
                    className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:underline pt-2 cursor-pointer font-semibold"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Unhide {dismissedIds.length} dismissed item{dismissedIds.length > 1 ? "s" : ""}
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* SECTION A: Fee Reminders Due */}
                {feeRemindersDue.length > 0 && (
                  <div className="space-y-2" id="fee-reminders-section">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold uppercase tracking-wider">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Fee Reminders Due ({feeRemindersDue.length})</span>
                      </div>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onNavigate("reminders");
                          }}
                          className="text-[11px] text-teal-400 hover:underline cursor-pointer"
                        >
                          View all →
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {feeRemindersDue.map(({ student, reminderData, daysElapsed, dismissId }) => (
                        <div
                          key={dismissId}
                          className="bg-slate-950 border border-rose-900/40 hover:border-rose-700/60 rounded-xl p-3 space-y-2.5 transition-all shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onSelectStudent) {
                                      setIsOpen(false);
                                      onSelectStudent(student.id);
                                    }
                                  }}
                                  className="text-xs font-bold text-white hover:text-teal-400 truncate text-left cursor-pointer"
                                >
                                  {student.name}
                                </button>
                                <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-1.5 py-0.2 rounded border border-teal-500/20">
                                  {student.registration_number}
                                </span>
                              </div>
                              <p className="text-[11px] text-rose-300 font-medium leading-tight">
                                Fee payment pending — <strong className="text-white font-bold">₹{student.remaining_fees.toLocaleString()}</strong> remaining ({daysElapsed} days elapsed)
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {student.course_type} • {student.phone}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleDismiss(dismissId, e)}
                              className="text-slate-400 hover:text-teal-300 hover:bg-slate-850 p-1 rounded transition-colors cursor-pointer shrink-0"
                              title="Dismiss from Action Center"
                            >
                              <span className="text-[10px] font-bold flex items-center gap-0.5">
                                <Check className="h-3 w-3" />
                                <span className="hidden sm:inline">Dismiss</span>
                              </span>
                            </button>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-850">
                            <a
                              href={getReminderEmailUrl(reminderData)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-teal-400 rounded-lg text-[11px] font-semibold text-center transition-colors flex items-center justify-center gap-1 cursor-pointer"
                              title="Send Reminder via Gmail"
                            >
                              <Mail className="h-3 w-3" />
                              <span>Email</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setWhatsAppCategory("fee_reminder");
                                setWhatsAppRecipient(reminderData);
                              }}
                              className="flex-1 py-1.5 px-2 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 rounded-lg text-[11px] font-semibold text-center transition-colors flex items-center justify-center gap-1 cursor-pointer"
                              title="Send Reminder via WhatsApp"
                            >
                              <MessageSquare className="h-3 w-3 text-emerald-400" />
                              <span>WhatsApp</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SECTION B: Today's Birthdays */}
                {todaysBirthdays.length > 0 && (
                  <div className="space-y-2" id="todays-birthdays-section">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5 text-teal-400 text-xs font-bold uppercase tracking-wider">
                        <Cake className="h-3.5 w-3.5 text-rose-400" />
                        <span>Today&apos;s Birthdays ({todaysBirthdays.length})</span>
                      </div>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onNavigate("birthdays");
                          }}
                          className="text-[11px] text-teal-400 hover:underline cursor-pointer"
                        >
                          View all →
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {todaysBirthdays.map(({ student, dismissId }) => (
                        <div
                          key={dismissId}
                          className="bg-slate-950 border border-teal-500/40 hover:border-teal-400 rounded-xl p-3 space-y-2.5 transition-all shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onSelectStudent) {
                                      setIsOpen(false);
                                      onSelectStudent(student.id);
                                    }
                                  }}
                                  className="text-xs font-bold text-white hover:text-teal-400 truncate text-left cursor-pointer"
                                >
                                  {student.name}
                                </button>
                                <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full flex items-center gap-1">
                                  <Cake className="h-2.5 w-2.5 text-rose-400" /> Today
                                </span>
                              </div>
                              <p className="text-[11px] text-teal-300 font-medium leading-tight">
                                Birthday today! 🎂 ({student.course_type})
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {student.phone} • {student.email}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleDismiss(dismissId, e)}
                              className="text-slate-400 hover:text-teal-300 hover:bg-slate-850 p-1 rounded transition-colors cursor-pointer shrink-0"
                              title="Dismiss from Action Center"
                            >
                              <span className="text-[10px] font-bold flex items-center gap-0.5">
                                <Check className="h-3 w-3" />
                                <span className="hidden sm:inline">Dismiss</span>
                              </span>
                            </button>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-850">
                            <a
                              href={getBirthdayEmailUrl(student.name, student.email)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-teal-400 rounded-lg text-[11px] font-semibold text-center transition-colors flex items-center justify-center gap-1 cursor-pointer"
                              title="Send Birthday Email via Gmail"
                            >
                              <Mail className="h-3 w-3" />
                              <span>Email Wish</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setWhatsAppCategory("birthday");
                                setWhatsAppRecipient({
                                  name: student.name,
                                  phone: student.phone,
                                  email: student.email,
                                  registration_number: student.registration_number,
                                  course_type: student.course_type,
                                  dob: student.dob
                                });
                              }}
                              className="flex-1 py-1.5 px-2 bg-teal-500 hover:bg-teal-600 text-slate-950 rounded-lg text-[11px] font-bold text-center transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                              title="Send Birthday WhatsApp Wish"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>WhatsApp</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SECTION C: Upcoming Birthdays (Next 3 Days) */}
                {upcomingBirthdays.length > 0 && (
                  <div className="space-y-2" id="upcoming-birthdays-section">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5 text-slate-300 text-xs font-bold uppercase tracking-wider">
                        <Calendar className="h-3.5 w-3.5 text-teal-400" />
                        <span>Upcoming Birthdays (Next 3 Days) ({upcomingBirthdays.length})</span>
                      </div>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onNavigate("birthdays");
                          }}
                          className="text-[11px] text-teal-400 hover:underline cursor-pointer"
                        >
                          View 30 days →
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {upcomingBirthdays.map(({ student, dobFormatted, daysAway, dismissId }) => (
                        <div
                          key={dismissId}
                          className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3 space-y-2.5 transition-all shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onSelectStudent) {
                                      setIsOpen(false);
                                      onSelectStudent(student.id);
                                    }
                                  }}
                                  className="text-xs font-bold text-white hover:text-teal-400 truncate text-left cursor-pointer"
                                >
                                  {student.name}
                                </button>
                                <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                                  {daysAway === 1 ? "Tomorrow" : `In ${daysAway} days`}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-300 font-medium leading-tight">
                                Birthday on <strong className="text-teal-300 font-bold">{dobFormatted}</strong> ({student.course_type})
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {student.phone} • {student.email}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleDismiss(dismissId, e)}
                              className="text-slate-400 hover:text-teal-300 hover:bg-slate-850 p-1 rounded transition-colors cursor-pointer shrink-0"
                              title="Dismiss from Action Center"
                            >
                              <span className="text-[10px] font-bold flex items-center gap-0.5">
                                <Check className="h-3 w-3" />
                                <span className="hidden sm:inline">Dismiss</span>
                              </span>
                            </button>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-850">
                            <a
                              href={getBirthdayEmailUrl(student.name, student.email)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-teal-400 rounded-lg text-[11px] font-semibold text-center transition-colors flex items-center justify-center gap-1 cursor-pointer"
                              title="Send Birthday Email via Gmail"
                            >
                              <Mail className="h-3 w-3" />
                              <span>Email</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setWhatsAppCategory("birthday");
                                setWhatsAppRecipient({
                                  name: student.name,
                                  phone: student.phone,
                                  email: student.email,
                                  registration_number: student.registration_number,
                                  course_type: student.course_type,
                                  dob: student.dob
                                });
                              }}
                              className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 rounded-lg text-[11px] font-semibold text-center transition-colors flex items-center justify-center gap-1 cursor-pointer"
                              title="Send Birthday WhatsApp Wish"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>WhatsApp</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={!!whatsAppRecipient}
        onClose={() => setWhatsAppRecipient(null)}
        recipient={whatsAppRecipient}
        defaultTemplateCategory={whatsAppCategory}
      />
    </div>
  );
}
