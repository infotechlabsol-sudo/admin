import React, { useState, useEffect, useMemo } from "react";
import { Student, Payment } from "../types";
import { db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Printer, X, FileText } from "lucide-react";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  selectedPayment?: Payment | null;
  paymentsList?: Payment[];
  receiptType?: "payment" | "admission";
}

export default function ReceiptModal({
  isOpen,
  onClose,
  student,
  selectedPayment = null,
  paymentsList,
  receiptType = "payment",
}: ReceiptModalProps) {
  const [fetchedPayments, setFetchedPayments] = useState<Payment[]>([]);
  const [activePayment, setActivePayment] = useState<Payment | null>(selectedPayment);
  const [activeType, setActiveType] = useState<"payment" | "admission">(receiptType);

  // Sync state when props change
  useEffect(() => {
    setActivePayment(selectedPayment || null);
    setActiveType(receiptType);
  }, [selectedPayment, receiptType, isOpen]);

  // Fetch payments for student if paymentsList is not provided
  useEffect(() => {
    if (!isOpen || !student) return;
    if (paymentsList && paymentsList.length > 0) {
      setFetchedPayments(paymentsList);
      return;
    }

    const q = query(
      collection(db, "payments"),
      where("student_id", "==", student.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Payment[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Payment);
      });
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setFetchedPayments(list);
    });

    return () => unsub();
  }, [isOpen, student, paymentsList]);

  const allPayments = paymentsList && paymentsList.length > 0 ? paymentsList : fetchedPayments;

  // Chronologically sorted payments (ascending by date)
  const sortedAscPayments = useMemo(() => {
    return [...allPayments].sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA !== timeB) return timeA - timeB;
      const tsA = a.created_timestamp?.seconds || 0;
      const tsB = b.created_timestamp?.seconds || 0;
      return tsA - tsB;
    });
  }, [allPayments]);

  // Default active payment if not specified and activeType is "payment"
  useEffect(() => {
    if (activeType === "payment" && !activePayment && sortedAscPayments.length > 0) {
      setActivePayment(sortedAscPayments[sortedAscPayments.length - 1]);
    }
  }, [activeType, activePayment, sortedAscPayments]);

  if (!isOpen || !student) return null;

  // Compute fee summary for the current view
  let receiptAmount = 0;
  let receiptDate = student.admission_date;
  let receiptMode = "UPI";
  let receiptDescription = "Admission Fee";
  let receiptNote = "";
  let cumulativePaid = 0;
  let remainingFees = 0;

  if (activeType === "admission" || !activePayment) {
    receiptAmount = student.admission_fees;
    receiptDate = student.admission_date;
    receiptDescription = "Admission Fee";
    const admPayment = sortedAscPayments.find((p) => p.type === "Admission Fee");
    receiptMode = admPayment ? admPayment.mode : "UPI";
    cumulativePaid = student.admission_fees;
    remainingFees = Math.max(0, student.total_fees - student.admission_fees);
  } else {
    receiptAmount = activePayment.amount;
    receiptDate = activePayment.date;
    receiptMode = activePayment.mode;
    receiptDescription = activePayment.type;
    receiptNote = activePayment.note || "";

    const targetIdx = sortedAscPayments.findIndex((p) => p.id === activePayment.id);
    if (targetIdx !== -1) {
      cumulativePaid = sortedAscPayments
        .slice(0, targetIdx + 1)
        .reduce((sum, p) => sum + (p.amount || 0), 0);
    } else {
      cumulativePaid = activePayment.amount;
    }
    remainingFees = Math.max(0, student.total_fees - cumulativePaid);
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print-backdrop">
      {/* Print styles injection */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
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

          #receipt-modal-print,
          #receipt-modal-print * {
            visibility: visible !important;
          }

          #receipt-modal-print {
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
      `,
        }}
      />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-6 my-auto">
        {/* Top Control Bar (no-print) */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 no-print">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white">Payment Receipt & Voucher</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Payment selector dropdown if multiple payments exist (no-print) */}
        {sortedAscPayments.length > 0 && (
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 no-print">
            <span className="text-xs font-semibold text-slate-400">Select Receipt Record:</span>
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <select
                className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                value={activeType === "admission" ? "admission" : activePayment?.id || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "admission") {
                    setActiveType("admission");
                    setActivePayment(null);
                  } else {
                    const found = sortedAscPayments.find((p) => p.id === val);
                    if (found) {
                      setActiveType("payment");
                      setActivePayment(found);
                    }
                  }
                }}
              >
                <option value="admission">Original Admission Slip ({student.admission_date})</option>
                {sortedAscPayments.map((p, idx) => (
                  <option key={p.id} value={p.id}>
                    Payment #{idx + 1}: {p.type} — ₹{p.amount.toLocaleString()} ({p.date})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* PRINTABLE RECEIPT CARD */}
        <div
          id="receipt-modal-print"
          className="bg-slate-950 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-5 print:p-5 print:space-y-3.5 print:bg-white print:text-black print:border-slate-300 print:shadow-none"
        >
          {/* Institute Header */}
          <div className="flex justify-between items-start border-b border-slate-800 pb-4 print:pb-2.5 print:border-slate-300">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-teal-400 print:text-black print:text-xl">TECH LAB ACADEMY</h1>
              <p className="text-xs text-slate-400 print:text-black">Professional Creative & Software Training Suite</p>
              <p className="text-xs text-slate-500 print:text-black mt-0.5">info.techlabsol@gmail.com</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block print:text-black">
                {activeType === "admission" ? "Admission Slip" : "Fee Payment Voucher"}
              </span>
              <span className="text-xs text-slate-400 print:text-black block mt-0.5">
                Receipt Date: <strong className="text-white print:text-black font-mono">{receiptDate}</strong>
              </span>
            </div>
          </div>

          {/* Registration highlight */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 sm:p-4 text-center print:bg-slate-100 print:border-slate-300 print:py-2">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block print:text-black">Registration Number</span>
            <span className="text-xl sm:text-2xl font-black text-teal-400 tracking-widest print:text-black print:text-xl">{student.registration_number}</span>
          </div>

          {/* Student Particulars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-xs sm:text-sm print:grid-cols-2 print:gap-4 print:text-xs">
            <div className="space-y-2 print:space-y-1">
              <h3 className="font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800 print:border-slate-300 print:text-black text-[11px]">
                Student Particulars
              </h3>
              <div className="flex justify-between"><span className="text-slate-400 print:text-black">Full Name</span><span className="font-bold text-white print:text-black">{student.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-400 print:text-black">Phone Number</span><span className="font-semibold text-white print:text-black">{student.phone}</span></div>
              <div className="flex justify-between"><span className="text-slate-400 print:text-black">Email ID</span><span className="font-semibold text-white print:text-black truncate max-w-[160px] sm:max-w-none">{student.email}</span></div>
            </div>

            <div className="space-y-2 print:space-y-1">
              <h3 className="font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800 print:border-slate-300 print:text-black text-[11px]">
                Course Particulars
              </h3>
              <div className="flex justify-between"><span className="text-slate-400 print:text-black">Course</span><span className="font-bold text-white print:text-black">{student.course_type}</span></div>
              <div className="flex justify-between"><span className="text-slate-400 print:text-black">Batch Start</span><span className="font-semibold text-white print:text-black">{student.batch_start_date}</span></div>
              <div className="flex justify-between"><span className="text-slate-400 print:text-black">Admission Date</span><span className="font-semibold text-white print:text-black">{student.admission_date}</span></div>
            </div>
          </div>

          {/* Specific Payment Box */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 space-y-3 print:bg-slate-50 print:border-slate-300 print:p-3 print:space-y-2">
            <h3 className="font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2 print:border-slate-300 print:pb-1 print:text-black text-[11px] flex justify-between items-center">
              <span>Receipt Particulars</span>
              <span className="text-teal-400 print:text-black font-extrabold">{receiptDescription}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs print:gap-2">
              <div>
                <span className="text-slate-500 print:text-black block">Amount Received</span>
                <span className="text-base font-extrabold text-emerald-400 print:text-black print:text-sm">₹{receiptAmount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 print:text-black block">Payment Mode</span>
                <span className="font-bold text-slate-200 print:text-black uppercase">{receiptMode}</span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-500 print:text-black block">Payment Date</span>
                <span className="font-mono text-slate-200 print:text-black">{receiptDate}</span>
              </div>
            </div>

            {receiptNote && (
              <div className="pt-2 border-t border-slate-800/60 print:border-slate-300 print:pt-1 text-xs text-slate-400 print:text-black">
                <span className="font-bold">Note / Reference:</span> {receiptNote}
              </div>
            )}
          </div>

          {/* Fee Ledger Summary as of this Receipt */}
          <div className="border-t border-slate-800 pt-4 print:border-slate-300 print:pt-2.5 space-y-2 print:space-y-1 text-xs sm:text-sm print:text-xs">
            <h3 className="font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800 print:border-slate-300 print:text-black text-[11px]">
              Fee Ledger Statement (As of this receipt)
            </h3>
            <div className="flex justify-between text-slate-400 print:text-black">
              <span>Total Course Fee</span>
              <span className="font-bold text-white print:text-black">₹{student.total_fees.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-teal-400 print:text-black">
              <span className="font-semibold">Total Paid So Far</span>
              <span className="font-extrabold">₹{cumulativePaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pt-2 print:pt-1 border-t border-slate-800 print:border-slate-300">
              <span className="font-bold text-slate-300 print:text-black">Remaining Balance Due</span>
              <span className="text-base font-black text-rose-400 print:text-black print:text-sm">₹{remainingFees.toLocaleString()}</span>
            </div>
          </div>

          {/* Receipt Footer */}
          <div className="pt-5 print:pt-3 border-t border-slate-800 print:border-slate-300 flex justify-between items-end text-[10px] text-slate-500 print:text-black">
            <div>
              <p>Generated on {new Date().toLocaleDateString("en-IN")}</p>
              <p className="mt-0.5">Tech Lab Academy Official Electronic Receipt.</p>
            </div>
            <div className="text-right w-36 border-t border-slate-700 print:border-slate-400 pt-2 text-slate-900">
              <p className="font-bold">Authorized Signatory</p>
            </div>
          </div>
        </div>

        {/* Action Controls (no-print) */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end no-print pt-2">
          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold rounded-lg py-2.5 px-5 transition-colors text-xs cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-lg py-2.5 px-6 transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print / Download PDF Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
