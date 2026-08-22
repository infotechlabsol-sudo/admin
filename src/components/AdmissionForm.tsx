import React, { useState, useEffect } from "react";
import { doc, getDoc, runTransaction, collection } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { sendAdmissionEmail } from "../emailService";
import { CourseType, StudentStatus, CertificateStatus, Lead, Student, CourseOption, BatchOption } from "../types";
import { getFinancialYear } from "../utils/financialYear";
import { 
  User, Phone, Mail, MapPin, Calendar, BookOpen, AlertCircle, 
  CreditCard, ShieldCheck, CheckCircle2, ArrowLeft, Printer, Loader, AlertTriangle
} from "lucide-react";

interface AdmissionFormProps {
  courses?: CourseOption[];
  batches?: BatchOption[];
  leadId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function mapCourseInterest(interest: string, availableCourses: CourseOption[]): string {
  const norm = (interest || "").toLowerCase();
  if (availableCourses.length > 0) {
    const match = availableCourses.find(c => c.name.toLowerCase() === norm || c.name.toLowerCase().includes(norm) || norm.includes(c.name.toLowerCase()));
    if (match) return match.name;
  }
  if (norm.includes("365") || norm.includes("roadmap")) return "Full Video Editor Roadmap 365-day";
  if (norm.includes("video") || norm.includes("edit")) return "Video Editing";
  if (norm.includes("graphic") || norm.includes("design")) return "Graphic Design";
  if (norm.includes("software") || norm.includes("custom")) return "Custom Software Training";
  return interest || "Other";
}

export default function AdmissionForm({ courses = [], batches = [], leadId, onSuccess, onCancel }: AdmissionFormProps) {
  // Active courses & batches filtering
  const activeCourses = React.useMemo(() => {
    return courses.filter((c) => c.active !== false);
  }, [courses]);

  const activeBatches = React.useMemo(() => {
    return batches.filter((b) => b.active !== false);
  }, [batches]);

  // Loading & Error States
  const [leadLoading, setLeadLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  // Form Field States
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState("");
  const [admissionDate, setAdmissionDate] = useState(() => {
    return new Date().toISOString().substring(0, 10);
  });
  const [courseType, setCourseType] = useState<string>("");
  const [batchStartDate, setBatchStartDate] = useState("");
  const [totalFees, setTotalFees] = useState<number>(0);
  const [admissionFees, setAdmissionFees] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<"UPI" | "Cash">("UPI");

  // Set initial default course if activeCourses available
  useEffect(() => {
    if (!courseType) {
      if (activeCourses.length > 0) {
        setCourseType(activeCourses[0].name);
      } else {
        setCourseType("Video Editing");
      }
    }
  }, [activeCourses]);

  // Set initial default batch if activeBatches available
  useEffect(() => {
    if (!batchStartDate && activeBatches.length > 0) {
      setBatchStartDate(activeBatches[0].name);
    }
  }, [activeBatches]);

  // Success State
  const [successData, setSuccessData] = useState<{
    registrationNumber: string;
    studentId: string;
    studentName: string;
    course: string;
    batchStart: string;
    admissionDate: string;
    totalFees: number;
    paidAmount: number;
    remainingFees: number;
  } | null>(null);

  // Live Remaining Calculation
  const remainingFees = Math.max(0, totalFees - admissionFees);

  // Fetch Lead on Mount
  useEffect(() => {
    if (!leadId) return;

    const fetchLead = async () => {
      setLeadLoading(true);
      setError(null);
      try {
        const leadRef = doc(db, "leads", leadId);
        const snap = await getDoc(leadRef);
        if (snap.exists()) {
          const data = snap.data() as Lead;
          setName(data.name || "");
          setPhone(data.phone || "");
          setEmail(data.email || "");
          setAddress(data.address || "");
          if (data.dob) setDob(data.dob);
          if (data.course_interest) {
            setCourseType(mapCourseInterest(data.course_interest, activeCourses));
          }
        } else {
          setError(`CRM Lead with ID "${leadId}" was not found.`);
        }
      } catch (err: any) {
        console.error("Error fetching lead:", err);
        setError("Failed to fetch CRM lead data. You can still enter details manually.");
      } finally {
        setLeadLoading(false);
      }
    };

    fetchLead();
  }, [leadId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailWarning(null);

    // Basic Validation
    if (!name || !phone || !email || !address || !dob || !batchStartDate || !admissionDate) {
      setError("Please fill in all required fields.");
      return;
    }
    if (totalFees <= 0) {
      setError("Total fees must be greater than 0.");
      return;
    }
    if (admissionFees < 0 || admissionFees > totalFees) {
      setError("Admission fees must be between 0 and the total fee amount.");
      return;
    }

    setSubmitting(true);

    try {
      const { fyKey } = getFinancialYear(admissionDate);

      // Execute atomic transaction for sequential counter and multi-record insertions
      const result = await runTransaction(db, async (transaction) => {
        // Separate counter per financial year (e.g. keyed by "2026-27", "2027-28", etc.)
        const counterRef = doc(db, "counters", fyKey);
        const counterSnap = await transaction.get(counterRef);
        
        let nextSeq = 1;
        if (counterSnap.exists()) {
          const data = counterSnap.data();
          nextSeq = (data.current_seq || 0) + 1;
        }

        // Set the incremented counter
        transaction.set(counterRef, { current_seq: nextSeq }, { merge: true });

        // Generate the unique Registration Number in Indian Financial Year format (e.g. TLA-2026-27-0001)
        const registrationNumber = `TLA-${fyKey}-${String(nextSeq).padStart(4, "0")}`;

        // Create doc references
        const studentRef = doc(collection(db, "students"));
        const paymentRef = doc(collection(db, "payments"));

        // Build records
        const studentPayload: Omit<Student, "id"> = {
          registration_number: registrationNumber,
          linked_lead_id: leadId || "",
          name,
          phone,
          email,
          address,
          dob,
          admission_date: admissionDate,
          course_type: courseType,
          batch_start_date: batchStartDate,
          total_fees: totalFees,
          admission_fees: admissionFees,
          remaining_fees: remainingFees,
          status: "Active" as StudentStatus,
          certificate_status: "Not Issued" as CertificateStatus,
          created_timestamp: new Date().toISOString()
        };

        const paymentPayload = {
          student_id: studentRef.id,
          amount: admissionFees,
          mode: paymentMode,
          date: admissionDate,
          type: "Admission Fee",
          note: "Paid at time of admission",
          timestamp: new Date().toISOString()
        };

        // Write both records atomic-safely
        transaction.set(studentRef, { id: studentRef.id, ...studentPayload });
        transaction.set(paymentRef, { id: paymentRef.id, ...paymentPayload });

        // If converting a CRM lead, update its status
        if (leadId) {
          const leadRef = doc(db, "leads", leadId);
          transaction.update(leadRef, {
            converted_to_student: true,
            status: "Enrolled",
            student_id: studentRef.id
          });
        }

        return {
          registrationNumber,
          studentId: studentRef.id
        };
      });

      // Show success details
      setSuccessData({
        registrationNumber: result.registrationNumber,
        studentId: result.studentId,
        studentName: name,
        course: courseType,
        batchStart: batchStartDate,
        admissionDate,
        totalFees,
        paidAmount: admissionFees,
        remainingFees
      });

      // Trigger non-blocking EmailJS notification
      try {
        const emailResult = await sendAdmissionEmail({
          student_email: email,
          student_name: name,
          registration_number: result.registrationNumber,
          course: courseType,
          batch_start_date: batchStartDate,
          admission_date: admissionDate,
          total_fees: totalFees,
          admission_fees_paid: admissionFees,
          remaining_fees: remainingFees
        });

        if (!emailResult.success) {
          setEmailWarning(`Record saved, but email notification failed: ${emailResult.error || "Check EmailJS configuration"}`);
        }
      } catch (err: any) {
        console.error("Non-blocking email sending failed:", err);
        setEmailWarning("Record saved, but email notification failed — check EmailJS configuration.");
      }

    } catch (err: any) {
      console.error("Submit transaction error:", err);
      setError("An error occurred during submission. The transaction has been rolled back.");
      handleFirestoreError(err, OperationType.WRITE, "students_admission");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCloseSuccess = () => {
    onSuccess();
  };

  if (successData) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto py-4" id="admission-success-panel">
        {/* Print only CSS styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: portrait;
              margin: 8mm 10mm;
            }

            html, body, #root {
              height: 100% !important;
              max-height: 100vh !important;
              overflow: hidden !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
            }

            body * {
              visibility: hidden !important;
            }

            .no-print,
            .no-print * {
              display: none !important;
              height: 0 !important;
              overflow: hidden !important;
              visibility: hidden !important;
            }

            #admission-slip-print,
            #admission-slip-print * {
              visibility: visible !important;
            }

            #admission-slip-print {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              max-height: 100% !important;
              margin: 0 !important;
              padding: 16px 20px !important;
              box-shadow: none !important;
              border: 1px solid #cbd5e1 !important;
              border-radius: 8px !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              z-index: 999999 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: visible !important;
              box-sizing: border-box !important;
            }
          }
        `}} />

        {/* Success Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-3 no-print">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 text-emerald-400 rounded-full mb-1 animate-bounce">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-white">Admission Successful!</h2>
          <p className="text-slate-400 text-sm">
            Student record created and initial fee payment registered successfully.
          </p>

          {emailWarning && (
            <div className="flex items-center justify-center gap-2 text-xs text-amber-400 bg-amber-950/20 border border-amber-900/50 p-2.5 rounded-lg max-w-md mx-auto mt-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{emailWarning}</span>
            </div>
          )}
        </div>

        {/* Printable Slips & Details */}
        <div 
          className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-xl space-y-5 print:p-5 print:space-y-3.5 print:bg-white print:text-black print:border-slate-300 print:shadow-none"
          id="admission-slip-print"
        >
          {/* Slip Header */}
          <div className="flex justify-between items-start border-b border-slate-800 pb-4 print:pb-2.5 print:border-slate-300">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-teal-400 print:text-black print:text-lg">TECH LAB ACADEMY</h1>
              <p className="text-xs text-slate-400 print:text-black">Professional Creative & Software Training Suite</p>
              <p className="text-xs text-slate-500 print:text-black mt-0.5">info.techlabsol@gmail.com</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block print:text-black">Admission Slip</span>
              <span className="text-xs text-slate-400 print:text-black block mt-0.5">Date: {successData.admissionDate}</span>
            </div>
          </div>

          {/* Registration highlight */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 sm:p-4 text-center print:bg-slate-100 print:border-slate-300 print:py-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block print:text-black">Registration Number</span>
            <span className="text-2xl font-black text-teal-400 tracking-widest print:text-black print:text-xl">{successData.registrationNumber}</span>
          </div>

          {/* Student & Course Particulars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm print:grid-cols-2 print:gap-4 print:text-xs">
            <div className="space-y-2.5 print:space-y-1">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800 print:border-slate-300 print:text-black">
                Student Details
              </h3>
              <div className="flex justify-between"><span className="text-slate-400 print:text-black">Full Name</span><span className="font-semibold text-white print:text-black">{successData.studentName}</span></div>
              <div className="flex justify-between"><span className="text-slate-400 print:text-black">Email ID</span><span className="font-semibold text-white print:text-black">{email}</span></div>
              <div className="flex justify-between"><span className="text-slate-400 print:text-black">Phone Number</span><span className="font-semibold text-white print:text-black">{phone}</span></div>
            </div>

            <div className="space-y-2.5 print:space-y-1">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800 print:border-slate-300 print:text-black">
                Course Particulars
              </h3>
              <div className="flex justify-between"><span className="text-slate-400 print:text-black">Course Enrolled</span><span className="font-semibold text-white print:text-black">{successData.course}</span></div>
              <div className="flex justify-between"><span className="text-slate-400 print:text-black">Batch Start</span><span className="font-semibold text-white print:text-black">{successData.batchStart}</span></div>
              <div className="flex justify-between"><span className="text-slate-400 print:text-black">Payment Mode</span><span className="font-semibold text-teal-400 print:text-black uppercase">{paymentMode}</span></div>
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className="border-t border-slate-800 pt-4 print:pt-2.5 print:border-slate-300">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 pb-2 print:pb-1 border-b border-slate-800 print:border-slate-300 print:text-black mb-2.5 print:mb-1.5">
              Fee Ledger Summary
            </h3>
            <div className="space-y-2.5 print:space-y-1 text-sm print:text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 print:text-black">Total Course Fee</span>
                <span className="font-bold text-white print:text-black">₹{successData.totalFees.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-teal-400 print:text-black">
                <span className="font-medium">Admission Fees Paid</span>
                <span className="font-extrabold">₹{successData.paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2 print:pt-1 border-t border-slate-800 print:border-slate-300">
                <span className="font-bold text-slate-300 print:text-black">Remaining Balance Due</span>
                <span className="text-lg font-black text-rose-400 print:text-black print:text-sm">₹{successData.remainingFees.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Footer of receipt */}
          <div className="pt-5 print:pt-3 border-t border-slate-800 print:border-slate-300 flex justify-between items-end text-[10px] text-slate-500 print:text-black">
            <div>
              <p>Verified on {successData.admissionDate}</p>
              <p className="mt-0.5">System Generated Admission Slip.</p>
            </div>
            <div className="text-right w-40 border-t border-slate-700 print:border-slate-400 pt-2 text-slate-900">
              <p className="font-bold">Authorized Signature</p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex gap-4 justify-end no-print">
          <button
            onClick={handlePrint}
            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-semibold rounded-lg py-3 px-6 transition-colors text-sm flex items-center gap-2 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print / Download Slip
          </button>
          <button
            onClick={handleCloseSuccess}
            className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-lg py-3 px-6 transition-colors text-sm cursor-pointer"
          >
            Return to Workspaces
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="admission-form-workspace">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-900 pb-5">
        <button
          onClick={onCancel}
          className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">New Course Admission</h1>
          <p className="text-sm text-slate-400">
            {leadId ? "Enrolling student converted from CRM lead data" : "Starting fresh manual admission"}
          </p>
        </div>
      </div>

      {leadLoading && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
          <Loader className="h-8 w-8 text-teal-400 animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Pre-filling student information from lead profile...</p>
        </div>
      )}

      {error && !leadLoading && (
        <div className="flex items-start gap-3 bg-red-950/40 border border-red-850 text-red-200 text-sm p-4 rounded-lg animate-fadeIn">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {!leadLoading && (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
          {/* Section A: Student Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <User className="h-5 w-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">Section A: Student Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Enter student's full name"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-700"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 9876543210"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-700"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="student@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-700"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Date of Birth *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-700"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 block">Residential Address *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <textarea
                    required
                    rows={2}
                    placeholder="Enter permanent home address"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-700 resize-none"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Course Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <BookOpen className="h-5 w-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">Section B: Course Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Course Type *</label>
                <select
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  value={courseType}
                  onChange={(e) => setCourseType(e.target.value)}
                >
                  {!courseType && <option value="">-- Select Course --</option>}
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
                  {courseType && activeCourses.length > 0 && !activeCourses.some(c => c.name === courseType) && (
                    <option value={courseType}>{courseType}</option>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Batch / Start Date *</label>
                {activeBatches.length > 0 ? (
                  <select
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                    value={batchStartDate}
                    onChange={(e) => setBatchStartDate(e.target.value)}
                  >
                    {!batchStartDate && <option value="">-- Select Batch --</option>}
                    {activeBatches.map((b) => (
                      <option key={b.id || b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                    {batchStartDate && !activeBatches.some((b) => b.name === batchStartDate) && (
                      <option value={batchStartDate}>{batchStartDate}</option>
                    )}
                  </select>
                ) : (
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                    value={batchStartDate}
                    onChange={(e) => setBatchStartDate(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Admission Date *</label>
                <input
                  type="date"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section C: Fee Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <CreditCard className="h-5 w-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">Section C: Fee Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Total Fees (INR) *</label>
                <input
                  type="number"
                  min={0}
                  required
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={totalFees || ""}
                  onChange={(e) => setTotalFees(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Admission Fees Paid Now *</label>
                <input
                  type="number"
                  min={0}
                  required
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={admissionFees || ""}
                  onChange={(e) => setAdmissionFees(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Payment Mode *</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as "UPI" | "Cash")}
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              {/* Live calculations widget */}
              <div className="bg-slate-950 border border-slate-850 rounded-lg p-3 flex flex-col justify-center h-10.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Remaining Balance</span>
                <span className="text-sm font-black text-rose-400">₹{remainingFees.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold rounded-lg py-2.5 px-6 transition-colors text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 disabled:bg-teal-800 text-slate-950 font-bold rounded-lg py-2.5 px-6 transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Admitting Student...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Confirm & Enroll Student
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
