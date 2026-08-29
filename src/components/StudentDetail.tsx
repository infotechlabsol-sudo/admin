import React, { useState, useEffect, useMemo } from "react";
import { Student, Payment, CourseType, StudentStatus, CertificateStatus, CourseOption, BatchOption, StatusHistoryEntry } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, updateDoc, collection, addDoc, query, where, onSnapshot, getDocs, deleteField } from "firebase/firestore";
import { sendPaymentEmail, sendCertificateEmail } from "../emailService";
import { getReminderEmailUrl } from "../reminderService";
import ReceiptModal from "./ReceiptModal";
import WhatsAppModal from "./WhatsAppModal";
import { 
  ArrowLeft, CreditCard, Award, Calendar, Phone, Mail, MapPin, 
  User, CheckCircle2, AlertCircle, Plus, Edit, ShieldCheck, Loader, FileText, AlertTriangle,
  MessageSquare, Send, Clock, Printer
} from "lucide-react";

interface StudentDetailProps {
  studentId: string;
  courses?: CourseOption[];
  batches?: BatchOption[];
  onBack: () => void;
}

export default function StudentDetail({ studentId, courses = [], batches = [], onBack }: StudentDetailProps) {
  const activeCourses = useMemo(() => {
    return courses.filter((c) => c.active !== false);
  }, [courses]);

  const activeBatches = useMemo(() => {
    return batches.filter((b) => b.active !== false);
  }, [batches]);
  // Real-time Student & Payments States
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingDetails, setUpdatingDetails] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [updatingCertificate, setUpdatingCertificate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  // Edit Mode States
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editAdmissionDate, setEditAdmissionDate] = useState("");
  const [editCourseType, setEditCourseType] = useState<CourseType>("Video Editing");
  const [editBatchStartDate, setEditBatchStartDate] = useState("");
  const [editStatus, setEditStatus] = useState<StudentStatus>("Active");
  const [editTotalFees, setEditTotalFees] = useState<number>(0);
  const [editDropoutDate, setEditDropoutDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [editDropoutReason, setEditDropoutReason] = useState("");

  // New Payment Form States
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [payMode, setPayMode] = useState<"UPI" | "Cash">("UPI");
  const [payNote, setPayNote] = useState("");
  const [payOverrideWarning, setPayOverrideWarning] = useState<string | null>(null);
  const [payForceOverride, setPayForceOverride] = useState(false);

  // Certificate Form States
  const [certStatus, setCertStatus] = useState<CertificateStatus>("Not Issued");
  const [certIssueDate, setCertIssueDate] = useState("");

  // Receipt Modal States
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);
  const [receiptModalType, setReceiptModalType] = useState<"payment" | "admission">("payment");

  // WhatsApp Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  // Set up listeners for student details and associated payments
  useEffect(() => {
    if (!studentId) return;

    setLoading(true);
    setError(null);

    // 1. Listen to Student document changes
    const studentRef = doc(db, "students", studentId);
    const unsubStudent = onSnapshot(
      studentRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Student;
          setStudent(data);

          // Populate edit fields
          setEditName(data.name || "");
          setEditPhone(data.phone || "");
          setEditEmail(data.email || "");
          setEditAddress(data.address || "");
          setEditDob(data.dob || "");
          setEditAdmissionDate(data.admission_date || "");
          setEditCourseType(data.course_type || "Video Editing");
          setEditBatchStartDate(data.batch_start_date || "");
          setEditStatus(data.status || "Active");
          setEditTotalFees(data.total_fees || 0);
          setEditDropoutDate(data.dropout_date || new Date().toISOString().substring(0, 10));
          setEditDropoutReason(data.dropout_reason || "");

          // Populate certificate status
          setCertStatus(data.certificate_status || "Not Issued");
          setCertIssueDate(data.certificate_issue_date || "");
        } else {
          setError("Student record not found in database.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Student listen error:", err);
        setError("Failed to stream student record from cloud.");
        try {
          handleFirestoreError(err, OperationType.GET, `students/${studentId}`);
        } catch (inner) {}
        setLoading(false);
      }
    );

    // 2. Listen to student's payment registry changes
    const paymentsQuery = query(
      collection(db, "payments"),
      where("student_id", "==", studentId)
    );
    const unsubPayments = onSnapshot(
      paymentsQuery,
      (querySnap) => {
        const paymentsList: Payment[] = [];
        querySnap.forEach((docSnap) => {
          paymentsList.push({ id: docSnap.id, ...docSnap.data() } as Payment);
        });
        // Sort by date descending
        paymentsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPayments(paymentsList);
      },
      (err) => {
        console.error("Payments listen error:", err);
        try {
          handleFirestoreError(err, OperationType.GET, "payments_stream");
        } catch (inner) {}
      }
    );

    return () => {
      unsubStudent();
      unsubPayments();
    };
  }, [studentId]);

  // Aggregate stats
  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const liveRemainingFees = useMemo(() => {
    if (!student) return 0;
    return Math.max(0, student.total_fees - totalPaid);
  }, [student, totalPaid]);

  // Handle student particulars update
  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    setError(null);
    setEmailWarning(null);
    setUpdatingDetails(true);

    try {
      const studentRef = doc(db, "students", student.id);
      
      // Live calculate remaining fees based on new total fees
      const updatedRemaining = Math.max(0, editTotalFees - totalPaid);

      const todayStr = new Date().toISOString().substring(0, 10);
      const previousStatus = student.status;
      const newStatus = editStatus as StudentStatus;

      const updatePayload: any = {
        name: editName,
        phone: editPhone,
        email: editEmail,
        address: editAddress,
        dob: editDob,
        admission_date: editAdmissionDate,
        course_type: editCourseType,
        batch_start_date: editBatchStartDate,
        status: newStatus,
        total_fees: editTotalFees,
        remaining_fees: updatedRemaining
      };

      const currentHistory = [...(student.status_history || [])];

      // 1. Changing status FROM "Dropped" TO another status (Active, Completed, On Hold)
      if (previousStatus === "Dropped" && newStatus !== "Dropped") {
        const oldDropoutDate = student.dropout_date || editDropoutDate || "N/A";
        const oldDropoutReason = student.dropout_reason || editDropoutReason || "None provided";
        const note = `Student re-activated on ${todayStr}. Previously marked Dropped on ${oldDropoutDate} (Reason: ${oldDropoutReason}).`;

        const historyEntry: StatusHistoryEntry = {
          previous_status: previousStatus,
          new_status: newStatus,
          changed_date: todayStr,
          note
        };
        currentHistory.push(historyEntry);

        updatePayload.dropout_date = deleteField();
        updatePayload.dropout_reason = deleteField();
        updatePayload.status_history = currentHistory;
      }
      // 2. Changing status TO "Dropped" from any other status
      else if (newStatus === "Dropped") {
        const newDropoutDate = editDropoutDate || todayStr;
        const newDropoutReason = editDropoutReason || "";
        updatePayload.dropout_date = newDropoutDate;
        updatePayload.dropout_reason = newDropoutReason;

        if (previousStatus !== "Dropped") {
          const note = `Student marked Dropped on ${newDropoutDate}${newDropoutReason ? ` (Reason: ${newDropoutReason})` : ""}.`;
          const historyEntry: StatusHistoryEntry = {
            previous_status: previousStatus,
            new_status: newStatus,
            changed_date: todayStr,
            note
          };
          currentHistory.push(historyEntry);
          updatePayload.status_history = currentHistory;
        }
      }
      // 3. Status change between Active, Completed, On Hold (neither is Dropped)
      else if (previousStatus !== newStatus) {
        const note = `Status changed from ${previousStatus} to ${newStatus} on ${todayStr}.`;
        const historyEntry: StatusHistoryEntry = {
          previous_status: previousStatus,
          new_status: newStatus,
          changed_date: todayStr,
          note
        };
        currentHistory.push(historyEntry);
        updatePayload.status_history = currentHistory;
      }

      await updateDoc(studentRef, updatePayload);

      setIsEditMode(false);
    } catch (err: any) {
      console.error("Update details error:", err);
      setError("Failed to save edited student particulars.");
      handleFirestoreError(err, OperationType.UPDATE, `students/${student.id}`);
    } finally {
      setUpdatingDetails(false);
    }
  };

  // Handle recording new payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    setError(null);
    setEmailWarning(null);
    setRecordingPayment(true);

    if (payAmount <= 0) {
      setError("Payment amount must be greater than 0.");
      setRecordingPayment(false);
      return;
    }

    // Excess Payment Warning Validation
    if (payAmount > liveRemainingFees && !payForceOverride) {
      setPayOverrideWarning(
        `Warning: The amount of ₹${payAmount.toLocaleString()} exceeds the student's remaining due balance of ₹${liveRemainingFees.toLocaleString()}.`
      );
      setRecordingPayment(false);
      return;
    }

    try {
      // 1. Save payment record
      const paymentRef = collection(db, "payments");
      const payDoc = await addDoc(paymentRef, {
        student_id: student.id,
        amount: payAmount,
        mode: payMode,
        date: payDate,
        type: "Installment",
        note: payNote,
        timestamp: new Date().toISOString()
      });

      // 2. Update remaining fees on student
      const studentRef = doc(db, "students", student.id);
      const newRemaining = Math.max(0, student.remaining_fees - payAmount);
      await updateDoc(studentRef, {
        remaining_fees: newRemaining
      });

      // Clear Form
      setPayAmount(0);
      setPayNote("");
      setPayOverrideWarning(null);
      setPayForceOverride(false);

      // 3. Trigger EmailJS payment received notification
      try {
        const emailResult = await sendPaymentEmail({
          student_email: student.email,
          student_name: student.name,
          registration_number: student.registration_number,
          amount_paid: payAmount,
          payment_mode: payMode,
          date: payDate,
          total_paid_so_far: totalPaid + payAmount,
          remaining_fees: newRemaining
        });

        if (!emailResult.success) {
          setEmailWarning(`Payment saved, but email receipt failed to send: ${emailResult.error}`);
        }
      } catch (err: any) {
        console.error("Non-blocking payment email failed:", err);
        setEmailWarning("Payment recorded, but email notification failed — check EmailJS setup.");
      }

    } catch (err: any) {
      console.error("Payment registration error:", err);
      setError("Failed to register payment.");
      handleFirestoreError(err, OperationType.CREATE, "payments");
    } finally {
      setRecordingPayment(false);
    }
  };

  // Handle certificate issuance update
  const handleUpdateCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    setError(null);
    setEmailWarning(null);
    setUpdatingCertificate(true);

    try {
      const studentRef = doc(db, "students", student.id);
      
      const payload: { certificate_status: CertificateStatus; certificate_issue_date?: string } = {
        certificate_status: certStatus
      };

      if (certStatus === "Issued") {
        if (!certIssueDate) {
          setError("Please select a valid Issue Date.");
          setUpdatingCertificate(false);
          return;
        }
        payload.certificate_issue_date = certIssueDate;
      } else {
        payload.certificate_issue_date = "";
      }

      await updateDoc(studentRef, payload);

      // If newly marked as Issued, trigger EmailJS certificate issued alert
      if (certStatus === "Issued") {
        try {
          const verifyLink = `${window.location.origin}?verify=1&reg=${student.registration_number}&dob=${student.dob}`;
          const emailResult = await sendCertificateEmail({
            student_email: student.email,
            student_name: student.name,
            registration_number: student.registration_number,
            course: student.course_type,
            verification_link: verifyLink
          });

          if (!emailResult.success) {
            setEmailWarning(`Certificate saved, but email notification failed: ${emailResult.error}`);
          }
        } catch (err: any) {
          console.error("Non-blocking certificate email failed:", err);
          setEmailWarning("Certificate recorded, but email notification failed — check EmailJS setup.");
        }
      }
    } catch (err: any) {
      console.error("Certificate update error:", err);
      setError("Failed to update certificate status.");
      handleFirestoreError(err, OperationType.UPDATE, `students/${student.id}`);
    } finally {
      setUpdatingCertificate(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-950 min-h-[50vh] flex items-center justify-center py-12" id="student-detail-loading">
        <div className="text-center space-y-3">
          <Loader className="h-8 w-8 text-teal-400 animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Streaming student records from Tech Lab databases...</p>
        </div>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4 max-w-lg mx-auto">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">Student Records Mismatch</h3>
        <p className="text-slate-400 text-sm">{error}</p>
        <button
          onClick={onBack}
          className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-lg py-2 px-4 transition-colors text-sm cursor-pointer"
        >
          Return to Registry
        </button>
      </div>
    );
  }

  if (!student) return null;

  return (
    <div className="space-y-8" id="student-detail-workspace">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-4 sm:pb-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">{student.name}</h1>
              <span className="text-[10px] sm:text-xs font-bold font-mono tracking-widest text-teal-400 bg-teal-500/10 px-2 sm:px-2.5 py-0.5 rounded-full border border-teal-500/10 shrink-0">
                {student.registration_number}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 truncate">{student.course_type} — Batch Start {student.batch_start_date}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSelectedReceiptPayment(null);
              setReceiptModalType("admission");
              setShowReceiptModal(true);
            }}
            className="flex-1 sm:flex-none justify-center bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 font-semibold rounded-lg py-2 px-3 transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
            title="View Admission Confirmation Slip"
          >
            <FileText className="h-3.5 w-3.5 text-amber-400" />
            Admission Receipt
          </button>

          <a
            href={getReminderEmailUrl({
              name: student.name,
              phone: student.phone,
              email: student.email,
              registration_number: student.registration_number,
              course_type: student.course_type,
              total_fees: student.total_fees,
              totalPaid: totalPaid,
              remaining_fees: liveRemainingFees
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none justify-center bg-slate-900 hover:bg-slate-800 border border-slate-800 text-teal-400 font-semibold rounded-lg py-2 px-3 transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
            title="Send Email Reminder via Gmail"
          >
            <Mail className="h-3.5 w-3.5" />
            Email Reminder
          </a>

          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            className="flex-1 sm:flex-none justify-center bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-400 font-semibold rounded-lg py-2 px-3 transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
            title="Send WhatsApp Message"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            WhatsApp
          </button>

          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`w-full sm:w-auto justify-center font-semibold rounded-lg py-2 px-4 transition-colors text-xs sm:text-sm flex items-center gap-2 cursor-pointer ${
              isEditMode
                ? "bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white"
                : "bg-teal-500 hover:bg-teal-600 text-slate-950"
            }`}
          >
            <Edit className="h-4 w-4" />
            {isEditMode ? "View Profile" : "Edit Particulars"}
          </button>
        </div>
      </div>

      {/* Warning Panels */}
      {(error || emailWarning) && (
        <div className="space-y-2 animate-fadeIn">
          {error && (
            <div className="flex items-start gap-3 bg-red-950/40 border border-red-850 text-red-200 text-sm p-4 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
          {emailWarning && (
            <div className="flex items-start gap-3 bg-amber-950/40 border border-amber-850 text-amber-200 text-sm p-4 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <p>{emailWarning}</p>
            </div>
          )}
        </div>
      )}

      {/* KPI Fee Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Course Fee</span>
            <span className="text-2xl font-extrabold text-white block">₹{student.total_fees.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-slate-800 text-slate-400 rounded-lg">
            <FileText className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Admission Fees Paid</span>
            <span className="text-2xl font-extrabold text-teal-400 block">₹{student.admission_fees.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-teal-500/10 text-teal-400 rounded-lg">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Fees Paid</span>
            <span className="text-2xl font-extrabold text-emerald-400 block">₹{totalPaid.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-sm border-rose-950 bg-rose-950/5">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Remaining Due</span>
            <span className="text-2xl font-extrabold text-rose-400 block">₹{liveRemainingFees.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-lg">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Student Info or Edit Particulars Form */}
        <div className="lg:col-span-2 space-y-6">
          {isEditMode ? (
            /* Editing student form */
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
              <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                <Edit className="h-5 w-5 text-teal-400" />
                Edit Student Particulars
              </h3>
              <form onSubmit={handleUpdateDetails} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 block">Full Name</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 block">Phone Number</label>
                    <input
                      type="tel"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 block">Email Address</label>
                    <input
                      type="email"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 block">Date of Birth</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                      value={editDob}
                      onChange={(e) => setEditDob(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 block">Admission Date</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                      value={editAdmissionDate}
                      onChange={(e) => setEditAdmissionDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 block">Course Enrolled</label>
                    <select
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                      value={editCourseType}
                      onChange={(e) => setEditCourseType(e.target.value)}
                    >
                      {activeCourses.length > 0 ? (
                        activeCourses.map((c) => (
                          <option key={c.id || c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Video Editing">Video Editing</option>
                          <option value="Graphic Design">Graphic Design</option>
                          <option value="Custom Software Training">Custom Software Training</option>
                          <option value="Full Video Editor Roadmap 365-day">Full Video Editor Roadmap 365-day</option>
                          <option value="Other">Other</option>
                        </>
                      )}
                      {editCourseType && activeCourses.length > 0 && !activeCourses.some(c => c.name === editCourseType) && (
                        <option value={editCourseType}>{editCourseType}</option>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 block">Batch / Start Date</label>
                    {activeBatches.length > 0 ? (
                      <select
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                        value={editBatchStartDate}
                        onChange={(e) => setEditBatchStartDate(e.target.value)}
                      >
                        {!editBatchStartDate && <option value="">-- Select Batch --</option>}
                        {activeBatches.map((b) => (
                          <option key={b.id || b.name} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                        {editBatchStartDate && !activeBatches.some((b) => b.name === editBatchStartDate) && (
                          <option value={editBatchStartDate}>{editBatchStartDate}</option>
                        )}
                      </select>
                    ) : (
                      <input
                        type="date"
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                        value={editBatchStartDate}
                        onChange={(e) => setEditBatchStartDate(e.target.value)}
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 block">Enrollment Status</label>
                    <select
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as StudentStatus)}
                    >
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                      <option value="Dropped">Dropped</option>
                      <option value="On Hold">On Hold</option>
                    </select>
                  </div>

                  {editStatus === "Dropped" && (
                    <div className="md:col-span-2 bg-rose-950/20 border border-rose-900/40 p-4 rounded-lg space-y-3">
                      <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                        <AlertCircle className="h-4 w-4" />
                        Dropout Details
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-400 block">Dropout Date *</label>
                          <input
                            type="date"
                            required
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-rose-500 font-mono"
                            value={editDropoutDate}
                            onChange={(e) => setEditDropoutDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-400 block">Dropout Reason (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Relocated to another city / Financial constraint"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-rose-500"
                            value={editDropoutReason}
                            onChange={(e) => setEditDropoutReason(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 block">Total Fees (INR)</label>
                    <input
                      type="number"
                      min={0}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                      value={editTotalFees || ""}
                      onChange={(e) => setEditTotalFees(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-400 block">Residential Address</label>
                    <textarea
                      rows={2}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors resize-none"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => setIsEditMode(false)}
                    className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold rounded-lg py-2 px-4 transition-colors text-sm cursor-pointer"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    disabled={updatingDetails}
                    className="bg-teal-500 hover:bg-teal-600 disabled:bg-teal-800 text-slate-950 font-bold rounded-lg py-2 px-6 transition-colors text-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {updatingDetails ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Save Particulars
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Student info display card */
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-6">
              <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">Student Particulars</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block">Full Name</span>
                      <span className="font-bold text-white text-base">{student.name}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block">Phone Number</span>
                      <span className="font-medium text-white">{student.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block">Email Address</span>
                      <span className="font-medium text-white">{student.email}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block">Residential Address</span>
                      <span className="font-medium text-slate-200">{student.address}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block">Date of Birth</span>
                      <span className="font-medium text-white font-mono">{student.dob}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block">Admission Confirmed</span>
                      <span className="font-medium text-white font-mono">{student.admission_date}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Award className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block">Enrollment Status</span>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider mt-1 ${
                          student.status === "Active"
                            ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                            : student.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : student.status === "On Hold"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {student.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {student.status === "Dropped" && (
                    <div className="flex items-start gap-3 bg-rose-950/20 border border-rose-900/40 p-3 rounded-lg col-span-1 md:col-span-2 mt-2">
                      <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs">
                        <span className="font-bold text-rose-400 block uppercase tracking-wider">Dropout Info</span>
                        <p className="text-slate-300">
                          <strong className="text-slate-400">Dropout Date:</strong> <span className="font-mono text-white">{student.dropout_date || "Not recorded"}</span>
                        </p>
                        {student.dropout_reason && (
                          <p className="text-slate-300">
                            <strong className="text-slate-400">Reason:</strong> {student.dropout_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment History Register */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-teal-400" />
              Fee Payment History
            </h3>
            {payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-bold">
                      <th className="py-3 px-2">Payment Date</th>
                      <th className="py-3 px-2">Description</th>
                      <th className="py-3 px-2">Mode</th>
                      <th className="py-3 px-2 text-right">Amount</th>
                      <th className="py-3 px-2 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-850/30 text-slate-300">
                        <td className="py-3 px-2 font-mono text-xs">{p.date}</td>
                        <td className="py-3 px-2 text-slate-200">
                          <span className="font-bold text-white">{p.type}</span>
                          {p.note && <p className="text-xs text-slate-500 italic mt-0.5">{p.note}</p>}
                        </td>
                        <td className="py-3 px-2 font-mono text-xs uppercase text-slate-400">{p.mode}</td>
                        <td className="py-3 px-2 text-right font-bold text-emerald-400">₹{p.amount.toLocaleString()}</td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={() => {
                              setSelectedReceiptPayment(p);
                              setReceiptModalType("payment");
                              setShowReceiptModal(true);
                            }}
                            className="p-1.5 bg-slate-950 hover:bg-teal-500 hover:text-slate-950 text-teal-400 border border-slate-800 hover:border-teal-500 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-xs font-semibold"
                            title="View Receipt for this payment"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-sm italic py-4">No payments recorded in history.</p>
            )}
          </div>

          {/* Status & Activity History Log */}
          {student.status_history && student.status_history.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
              <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-teal-400" />
                Status & Activity History Log
              </h3>
              <div className="space-y-3">
                {[...student.status_history].reverse().map((entry, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-semibold text-slate-300">
                        Status: <span className="text-amber-400 font-mono">{entry.previous_status}</span> &rarr; <span className="text-teal-400 font-mono">{entry.new_status}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">{entry.changed_date}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{entry.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Ledger / Record Payments & Certificates */}
        <div className="space-y-6">
          {/* Record Payment Board */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-400" />
              Record Fee Payment
            </h3>

            {/* Validation override message if warning occurs */}
            {payOverrideWarning && (
              <div className="bg-amber-950/40 border border-amber-900/50 p-4 rounded-lg space-y-3 animate-fadeIn text-xs">
                <div className="flex items-start gap-2.5 text-amber-300">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-400 shrink-0 mt-0.5" />
                  <p>{payOverrideWarning}</p>
                </div>
                <label className="flex items-center gap-2 text-white font-bold cursor-pointer bg-slate-950 p-2 rounded border border-slate-800 hover:border-amber-500/50">
                  <input
                    type="checkbox"
                    className="rounded border-slate-800 text-teal-500 bg-slate-950 accent-teal-400"
                    checked={payForceOverride}
                    onChange={(e) => setPayForceOverride(e.target.checked)}
                  />
                  Override balance & record
                </label>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Payment Amount (INR) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={payAmount || ""}
                  onChange={(e) => {
                    setPayAmount(Number(e.target.value));
                    setPayOverrideWarning(null); // Reset warning as amount changes
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Payment Date *</label>
                <input
                  type="date"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Payment Mode *</label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setPayMode("UPI")}
                    className={`py-2 px-4 rounded-lg font-bold text-xs border cursor-pointer transition-all ${
                      payMode === "UPI"
                        ? "bg-teal-500/10 border-teal-500/40 text-teal-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMode("Cash")}
                    className={`py-2 px-4 rounded-lg font-bold text-xs border cursor-pointer transition-all ${
                      payMode === "Cash"
                        ? "bg-teal-500/10 border-teal-500/40 text-teal-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    CASH
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Received via GPay"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-750"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={recordingPayment || (payAmount > liveRemainingFees && !payForceOverride)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-lg py-2.5 px-4 transition-colors text-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {recordingPayment ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Registering Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Record Payment
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Certificate Generation & Issued Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <Award className="h-5 w-5 text-indigo-400" />
              Certificate Authentications
            </h3>

            <form onSubmit={handleUpdateCertificate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Certificate Status</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  value={certStatus}
                  onChange={(e) => setCertStatus(e.target.value as CertificateStatus)}
                >
                  <option value="Not Issued">Not Issued</option>
                  <option value="Issued">Issued (Confirm details below)</option>
                </select>
              </div>

              {certStatus === "Issued" && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="text-xs font-semibold text-slate-400 block">Certificate Issue Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                    value={certIssueDate}
                    onChange={(e) => setCertIssueDate(e.target.value)}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={updatingCertificate}
                className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-800 text-slate-950 font-bold rounded-lg py-2.5 px-4 transition-colors text-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {updatingCertificate ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Updating Record...
                  </>
                ) : (
                  <>
                    <Award className="h-4 w-4" />
                    Update Certificate
                  </>
                )}
              </button>
            </form>

            <div className="bg-slate-950 border border-slate-850 rounded-lg p-3 text-xs text-slate-500 space-y-1">
              <p className="font-bold text-slate-400">Verification Integrity Info:</p>
              <p>Marking "Issued" publishes graduation credentials securely on the public lookup page immediately.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        student={student}
        selectedPayment={selectedReceiptPayment}
        paymentsList={payments}
        receiptType={receiptModalType}
      />

      {/* WhatsApp Message Compose Modal */}
      <WhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        recipient={
          student
            ? {
                name: student.name,
                phone: student.phone,
                email: student.email,
                registration_number: student.registration_number,
                course_type: student.course_type,
                total_fees: student.total_fees,
                totalPaid: totalPaid,
                remaining_fees: liveRemainingFees,
                admission_date: student.admission_date,
                batch_start_date: student.batch_start_date,
                dob: student.dob
              }
            : null
        }
        defaultTemplateCategory={liveRemainingFees > 0 ? "fee_reminder" : "general"}
      />
    </div>
  );
}
