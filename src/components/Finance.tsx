import React, { useState, useMemo } from "react";
import { Student, Payment, Expense, ExpenseCategory } from "../types";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { getFinancialYear } from "../utils/financialYear";
import * as XLSX from "xlsx";
import { 
  TrendingUp, CreditCard, AlertCircle, Plus, Download, 
  Filter, Calendar, FileText, ArrowDownRight, ArrowUpRight, 
  Percent, IndianRupee, PieChart as PieIcon, BarChart3 as BarIcon, 
  Users, UserCheck, Loader2, RefreshCw, CheckCircle2, ShieldAlert
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface FinanceProps {
  students: Student[];
  payments: Payment[];
  expenses: Expense[];
  onAddExpenseSuccess?: () => void;
}

export default function Finance({ students, payments, expenses }: FinanceProps) {
  // Expense Form States
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("Faculty Salary");
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [expenseNote, setExpenseNote] = useState("");
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseFormError, setExpenseFormError] = useState<string | null>(null);
  const [expenseFormSuccess, setExpenseFormSuccess] = useState<boolean>(false);

  // Date Range Filters for currently selected date range
  const { firstDayStr, lastDayStr, todayStr } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    
    // First day of current month
    const firstDay = `${year}-${month}-01`;
    // Last day of current month
    const lastDayVal = new Date(year, now.getMonth() + 1, 0).getDate();
    const lastDay = `${year}-${month}-${String(lastDayVal).padStart(2, "0")}`;
    
    return {
      firstDayStr: firstDay,
      lastDayStr: lastDay,
      todayStr: `${year}-${month}-${day}`
    };
  }, []);

  const [startDate, setStartDate] = useState(firstDayStr);
  const [endDate, setEndDate] = useState(lastDayStr);

  // Helper for human readable date formatting label
  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  // Expense List Filters
  const [expenseListCategory, setExpenseListCategory] = useState<string>("All");
  const [expenseListStartDate, setExpenseListStartDate] = useState(firstDayStr);
  const [expenseListEndDate, setExpenseListEndDate] = useState(lastDayStr);

  // Outstanding Fees List Filter
  const [outstandingFilter, setOutstandingFilter] = useState<"All" | "Due Today" | "Due This Week" | "Due This Month" | "Overdue">("All");

  // Dropdown options for Profit & Loss
  const plMonths = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("default", { month: "long", year: "numeric" });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ label, key });
    }
    return months;
  }, []);

  const [selectedPLMonth, setSelectedPLMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Week helper
  const getWeekRange = (refDateStr: string) => {
    const refDate = new Date(refDateStr);
    const day = refDate.getDay(); // 0 is Sunday
    const diff = refDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    const monday = new Date(refDate.setDate(diff));
    const sunday = new Date(refDate.setDate(diff + 6));
    
    return {
      startStr: monday.toISOString().substring(0, 10),
      endStr: sunday.toISOString().substring(0, 10)
    };
  };

  // Submit new expense to firestore
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0) {
      setExpenseFormError("Expense amount must be greater than zero.");
      return;
    }

    setIsSubmittingExpense(true);
    setExpenseFormError(null);
    setExpenseFormSuccess(false);

    try {
      await addDoc(collection(db, "expenses"), {
        category: expenseCategory,
        amount: expenseAmount,
        date: expenseDate,
        note: expenseNote,
        created_timestamp: new Date().toISOString()
      });

      setExpenseAmount(0);
      setExpenseNote("");
      setExpenseFormSuccess(true);
      setTimeout(() => setExpenseFormSuccess(false), 4000);
    } catch (err: any) {
      console.error("Error adding expense document:", err);
      setExpenseFormError("Failed to add expense to cloud database.");
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Indian Financial Year info for current date
  const currentFY = useMemo(() => getFinancialYear(new Date()), []);

  // Available Financial Years calculated from existing data
  const availableFYKeys = useMemo(() => {
    const setKeys = new Set<string>();
    setKeys.add(currentFY.fyKey);
    payments.forEach(p => {
      if (p.date) {
        setKeys.add(getFinancialYear(p.date).fyKey);
      }
    });
    expenses.forEach(e => {
      if (e.date) {
        setKeys.add(getFinancialYear(e.date).fyKey);
      }
    });
    students.forEach(s => {
      if (s.admission_date) {
        setKeys.add(getFinancialYear(s.admission_date).fyKey);
      }
    });
    return Array.from(setKeys).sort().reverse();
  }, [currentFY, payments, expenses, students]);

  const [selectedFYForExport, setSelectedFYForExport] = useState<string>(currentFY.fyKey);

  const EXPENSE_CATEGORIES: ExpenseCategory[] = useMemo(() => [
    "Faculty Salary",
    "Staff Salary",
    "Rent",
    "Electricity",
    "Internet",
    "Marketing",
    "Software Subscription",
    "Equipment Purchase",
    "Maintenance",
    "Miscellaneous"
  ], []);

  // Multi-sheet Excel Export Generator for Chartered Accountants / Audit
  const handleExportExcelFYReport = () => {
    const parts = selectedFYForExport.split("-");
    const startYear = parseInt(parts[0], 10);
    const endYear = startYear + 1;
    const startDateStr = `${startYear}-04-01`;
    const endDateStr = `${endYear}-03-31`;

    // 12 FY months (April startYear to March endYear)
    const fyMonths = [
      { label: "April", key: `${startYear}-04` },
      { label: "May", key: `${startYear}-05` },
      { label: "June", key: `${startYear}-06` },
      { label: "July", key: `${startYear}-07` },
      { label: "August", key: `${startYear}-08` },
      { label: "September", key: `${startYear}-09` },
      { label: "October", key: `${startYear}-10` },
      { label: "November", key: `${startYear}-11` },
      { label: "December", key: `${startYear}-12` },
      { label: "January", key: `${endYear}-01` },
      { label: "February", key: `${endYear}-02` },
      { label: "March", key: `${endYear}-03` },
    ];

    const fyPayments = payments.filter(p => p.date && p.date >= startDateStr && p.date <= endDateStr);
    const fyExpenses = expenses.filter(e => e.date && e.date >= startDateStr && e.date <= endDateStr);

    const studentMap = new Map<string, Student>();
    students.forEach(s => studentMap.set(s.id, s));

    // --- Sheet 1: Revenue Summary ---
    const revSummaryData: any[][] = [
      ["Month", "Fees Collected (₹)", "Number of Payments"]
    ];
    let totalRevFees = 0;
    let totalRevCount = 0;

    fyMonths.forEach(m => {
      const monthPayments = fyPayments.filter(p => p.date && p.date.startsWith(m.key));
      const fees = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const count = monthPayments.length;
      revSummaryData.push([m.label, fees, count]);
      totalRevFees += fees;
      totalRevCount += count;
    });
    revSummaryData.push([`Total FY ${selectedFYForExport}`, totalRevFees, totalRevCount]);

    const ws1 = XLSX.utils.aoa_to_sheet(revSummaryData);
    ws1["!cols"] = [{ wch: 18 }, { wch: 22 }, { wch: 22 }];

    // --- Sheet 2: Expense Summary ---
    const expSummaryHeader = ["Month", ...EXPENSE_CATEGORIES, "Total Expense (₹)"];
    const expSummaryData: any[][] = [expSummaryHeader];
    const catTotals = new Array(EXPENSE_CATEGORIES.length).fill(0);
    let grandTotalExpenses = 0;

    fyMonths.forEach(m => {
      const monthExpenses = fyExpenses.filter(e => e.date && e.date.startsWith(m.key));
      let monthTotal = 0;
      const catAmounts = EXPENSE_CATEGORIES.map((cat, idx) => {
        const amt = monthExpenses
          .filter(e => e.category === cat)
          .reduce((sum, e) => sum + (e.amount || 0), 0);
        catTotals[idx] += amt;
        monthTotal += amt;
        return amt;
      });
      grandTotalExpenses += monthTotal;
      expSummaryData.push([m.label, ...catAmounts, monthTotal]);
    });
    expSummaryData.push([`Total FY ${selectedFYForExport}`, ...catTotals, grandTotalExpenses]);

    const ws2 = XLSX.utils.aoa_to_sheet(expSummaryData);
    ws2["!cols"] = [{ wch: 15 }, ...EXPENSE_CATEGORIES.map(() => ({ wch: 20 })), { wch: 22 }];

    // --- Sheet 3: Profit & Loss ---
    const plData: any[][] = [
      ["Month", "Income / Fees Collected (₹)", "Total Expenses (₹)", "Net Profit / Loss (₹)"]
    ];
    let totalPlInc = 0;
    let totalPlExp = 0;

    fyMonths.forEach(m => {
      const monthPayments = fyPayments.filter(p => p.date && p.date.startsWith(m.key));
      const monthExpenses = fyExpenses.filter(e => e.date && e.date.startsWith(m.key));
      const inc = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const exp = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const profit = inc - exp;
      plData.push([m.label, inc, exp, profit]);
      totalPlInc += inc;
      totalPlExp += exp;
    });
    plData.push([`Total FY ${selectedFYForExport}`, totalPlInc, totalPlExp, totalPlInc - totalPlExp]);

    const ws3 = XLSX.utils.aoa_to_sheet(plData);
    ws3["!cols"] = [{ wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 22 }];

    // --- Sheet 4: All Payments (Detail) ---
    const payDetailData: any[][] = [
      ["Student Name", "Registration Number", "Amount (₹)", "Payment Mode", "Date", "Type"]
    ];
    const sortedPayments = [...fyPayments].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    let totalDetailPayments = 0;

    sortedPayments.forEach(p => {
      const st = studentMap.get(p.student_id);
      const name = st ? st.name : "N/A";
      const regNo = st ? st.registration_number : "N/A";
      payDetailData.push([name, regNo, p.amount || 0, p.mode || "N/A", p.date || "N/A", p.type || "N/A"]);
      totalDetailPayments += p.amount || 0;
    });
    payDetailData.push(["Total", "", totalDetailPayments, "", "", ""]);

    const ws4 = XLSX.utils.aoa_to_sheet(payDetailData);
    ws4["!cols"] = [{ wch: 25 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];

    // --- Sheet 5: All Expenses (Detail) ---
    const expDetailData: any[][] = [
      ["Category", "Amount (₹)", "Date", "Note"]
    ];
    const sortedExpenses = [...fyExpenses].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    let totalDetailExpenses = 0;

    sortedExpenses.forEach(e => {
      expDetailData.push([e.category || "N/A", e.amount || 0, e.date || "N/A", e.note || ""]);
      totalDetailExpenses += e.amount || 0;
    });
    expDetailData.push(["Total", totalDetailExpenses, "", ""]);

    const ws5 = XLSX.utils.aoa_to_sheet(expDetailData);
    ws5["!cols"] = [{ wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 35 }];

    // --- Sheet 6: Outstanding Fees (as of export date) ---
    const outFeesData: any[][] = [
      ["Student Name", "Registration Number", "Course", "Total Fees (₹)", "Paid Fees (₹)", "Remaining Fees (₹)"]
    ];
    const activeDueStudents = students.filter(s => s.status !== "Dropped" && (s.remaining_fees || 0) > 0);
    let sumTotalFees = 0;
    let sumPaidFees = 0;
    let sumRemFees = 0;

    activeDueStudents.forEach(s => {
      const paid = (s.total_fees || 0) - (s.remaining_fees || 0);
      outFeesData.push([s.name, s.registration_number, s.course_type, s.total_fees || 0, paid, s.remaining_fees || 0]);
      sumTotalFees += s.total_fees || 0;
      sumPaidFees += paid;
      sumRemFees += s.remaining_fees || 0;
    });
    outFeesData.push(["Total Outstanding", "", "", sumTotalFees, sumPaidFees, sumRemFees]);

    const ws6 = XLSX.utils.aoa_to_sheet(outFeesData);
    ws6["!cols"] = [{ wch: 25 }, { wch: 22 }, { wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];

    // Build Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Revenue Summary");
    XLSX.utils.book_append_sheet(wb, ws2, "Expense Summary");
    XLSX.utils.book_append_sheet(wb, ws3, "Profit & Loss");
    XLSX.utils.book_append_sheet(wb, ws4, "All Payments (Detail)");
    XLSX.utils.book_append_sheet(wb, ws5, "All Expenses (Detail)");
    XLSX.utils.book_append_sheet(wb, ws6, "Outstanding Fees");

    XLSX.writeFile(wb, `TechLabAcademy_FY${selectedFYForExport}_FinancialReport.xlsx`);
  };

  // KPI Calculations (Change 1 & CHANGE 2)
  const kpis = useMemo(() => {
    // 1. Total Expected Revenue: Sum of total_fees across all students
    const totalExpected = students.reduce((sum, s) => sum + (s.total_fees || 0), 0);

    // 2. All-time Collected Revenue
    const totalCollectedAllTime = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // 3. Collected Revenue in Analysis Range [startDate, endDate]
    const collectedInRange = payments
      .filter(p => p.date && p.date >= startDate && p.date <= endDate)
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // 4. Expenses in Analysis Range [startDate, endDate]
    const selectedExpensesTotal = expenses
      .filter(e => e.date && e.date >= startDate && e.date <= endDate)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // 5. Net Profit in Analysis Range [startDate, endDate]
    const netProfitInRange = collectedInRange - selectedExpensesTotal;

    // 6. Revenue Lost (Dropouts) in Analysis Range [startDate, endDate]
    const revenueLostDropoutsInRange = students
      .filter(s => {
        if (s.status !== "Dropped") return false;
        const dDate = s.dropout_date || s.admission_date;
        return dDate && dDate >= startDate && dDate <= endDate;
      })
      .reduce((sum, s) => sum + (s.remaining_fees || 0), 0);

    // Monthly & Yearly Dropout Loss Totals
    const currentMonthPrefix = todayStr.substring(0, 7);

    const monthlyDropoutLoss = students
      .filter(s => {
        if (s.status !== "Dropped") return false;
        const dDate = s.dropout_date || s.admission_date;
        return dDate && dDate.startsWith(currentMonthPrefix);
      })
      .reduce((sum, s) => sum + (s.remaining_fees || 0), 0);

    const yearlyDropoutLoss = students
      .filter(s => {
        if (s.status !== "Dropped") return false;
        const dDate = s.dropout_date || s.admission_date;
        return dDate && dDate >= currentFY.startDateStr && dDate <= currentFY.endDateStr;
      })
      .reduce((sum, s) => sum + (s.remaining_fees || 0), 0);

    // Outstanding Fees overall
    const outstanding = Math.max(0, totalExpected - totalCollectedAllTime);

    // Today's Collection
    const todaysCollection = payments
      .filter(p => p.date === todayStr)
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // This Week's Collection
    const { startStr: weekStart, endStr: weekEnd } = getWeekRange(todayStr);
    const weeksCollection = payments
      .filter(p => p.date && p.date >= weekStart && p.date <= weekEnd)
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // This Month's Collection
    const monthsCollection = payments
      .filter(p => p.date && p.date.startsWith(currentMonthPrefix))
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    // Collection Percentage
    const collectionPercentage = totalExpected > 0 ? (totalCollectedAllTime / totalExpected) * 100 : 0;

    return {
      totalExpected,
      totalCollectedAllTime,
      collectedInRange,
      selectedExpensesTotal,
      netProfitInRange,
      revenueLostDropoutsInRange,
      monthlyDropoutLoss,
      yearlyDropoutLoss,
      outstanding,
      todaysCollection,
      weeksCollection,
      monthsCollection,
      collectionPercentage
    };
  }, [students, payments, expenses, startDate, endDate, todayStr]);

  // Chart 1: Monthly Revenue Trend (Dynamic to selected range)
  const monthlyRevenueChartData = useMemo(() => {
    const months: { label: string; key: string; amount: number }[] = [];
    if (!startDate || !endDate) return months;

    const startD = new Date(startDate + "T00:00:00");
    const endD = new Date(endDate + "T00:00:00");

    let current = new Date(startD.getFullYear(), startD.getMonth(), 1);
    const endMonth = new Date(endD.getFullYear(), endD.getMonth(), 1);

    while (current <= endMonth) {
      const label = current.toLocaleString("default", { month: "short", year: "2-digit" });
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
      months.push({ label, key, amount: 0 });
      current.setMonth(current.getMonth() + 1);
    }

    payments
      .filter(p => p.date && p.date >= startDate && p.date <= endDate)
      .forEach(p => {
        const monthPrefix = p.date.substring(0, 7);
        const match = months.find(m => m.key === monthPrefix);
        if (match) {
          match.amount += p.amount;
        }
      });

    return months;
  }, [payments, startDate, endDate]);

  // Chart 2: Expense Breakdown Pie Chart (Grouped by Category, Filtered by Date Range) (Change 3)
  const expensePieChartData = useMemo(() => {
    const categories: Record<string, number> = {};
    expenses
      .filter(e => e.date && e.date >= startDate && e.date <= endDate)
      .forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + e.amount;
      });

    return Object.keys(categories).map(cat => ({
      name: cat,
      value: categories[cat]
    })).filter(item => item.value > 0);
  }, [expenses, startDate, endDate]);

  // Chart 3: Payment Methods Breakdown (UPI vs Cash, Filtered by Date Range) (Change 4)
  const paymentMethodsData = useMemo(() => {
    let upi = 0;
    let cash = 0;
    payments
      .filter(p => p.date && p.date >= startDate && p.date <= endDate)
      .forEach(p => {
        const mode = (p as any).payment_mode || p.mode;
        if (mode === "UPI") upi += p.amount;
        else if (mode === "Cash") cash += p.amount;
      });

    const total = upi + cash;
    return {
      upi,
      cash,
      upiPercent: total > 0 ? Math.round((upi / total) * 100) : 0,
      cashPercent: total > 0 ? Math.round((cash / total) * 100) : 0,
      total
    };
  }, [payments, startDate, endDate]);

  // Chart 4: Revenue by Course (Grouped by student's course, Filtered by Date Range) (Change 5)
  const courseRevenueData = useMemo(() => {
    const courseRevenue: Record<string, number> = {};

    payments
      .filter(p => p.date && p.date >= startDate && p.date <= endDate)
      .forEach(p => {
        const student = students.find(s => s.id === p.student_id);
        const course = student ? (student.course_type || "Other") : "Other";
        courseRevenue[course] = (courseRevenue[course] || 0) + p.amount;
      });

    return Object.keys(courseRevenue).map(course => ({
      name: course,
      amount: courseRevenue[course]
    })).filter(item => item.amount > 0);
  }, [payments, students, startDate, endDate]);

  // Table 1: All Expenses List (Filtered by Category and Date Range) (Change 1)
  const filteredExpensesList = useMemo(() => {
    return expenses
      .filter(e => {
        const matchesCategory = expenseListCategory === "All" || e.category === expenseListCategory;
        const matchesDate = e.date && e.date >= expenseListStartDate && e.date <= expenseListEndDate;
        return matchesCategory && matchesDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, expenseListCategory, expenseListStartDate, expenseListEndDate]);

  const runningExpensesTotal = useMemo(() => {
    return filteredExpensesList.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredExpensesList]);

  // Table 2: Outstanding Fees (Sorted by longest since last payment) (Change 6)
  const outstandingStudentsList = useMemo(() => {
    const list = students
      .filter(s => (s.remaining_fees || 0) > 0)
      .map(s => {
        // Find latest payment date
        const studentPayments = payments.filter(p => p.student_id === s.id);
        let lastPaymentDate = "";
        let totalPaid = 0;

        if (studentPayments.length > 0) {
          const sorted = [...studentPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          lastPaymentDate = sorted[0].date;
          totalPaid = studentPayments.reduce((sum, p) => sum + p.amount, 0);
        } else {
          totalPaid = s.admission_fees || 0; // standard admission deposit if no payments
        }

        return {
          ...s,
          lastPaymentDate,
          totalPaid,
          lastPaymentTimestamp: lastPaymentDate ? new Date(lastPaymentDate).getTime() : 0
        };
      });

    // Filter based on "Due Today", "Due This Week", "Due This Month", "Overdue"
    return list
      .filter(s => {
        if (outstandingFilter === "All") return true;

        // Use batch start date as due reference
        const referenceDate = s.batch_start_date || s.admission_date;
        const { startStr: weekStart, endStr: weekEnd } = getWeekRange(todayStr);
        const currentMonthPrefix = todayStr.substring(0, 7);

        if (outstandingFilter === "Due Today") {
          return referenceDate === todayStr;
        }
        if (outstandingFilter === "Due This Week") {
          return referenceDate >= weekStart && referenceDate <= weekEnd;
        }
        if (outstandingFilter === "Due This Month") {
          return referenceDate && referenceDate.startsWith(currentMonthPrefix);
        }
        if (outstandingFilter === "Overdue") {
          return referenceDate && referenceDate < todayStr;
        }
        return true;
      })
      // Sort: longest ago since last payment first.
      // If no payment was ever made (lastPaymentTimestamp = 0), sort them to the top (i.e. oldest/most overdue)
      .sort((a, b) => a.lastPaymentTimestamp - b.lastPaymentTimestamp);
  }, [students, payments, outstandingFilter, todayStr]);

  // Section 7: Profit & Loss Summary calculations
  const plSummary = useMemo(() => {
    const monthKey = selectedPLMonth; // "YYYY-MM"

    // Income: collected fees in selectedPLMonth
    const monthlyIncome = payments
      .filter(p => p.date && p.date.startsWith(monthKey))
      .reduce((sum, p) => sum + p.amount, 0);

    // Expenses: grouped by category in selectedPLMonth
    const categoryExpenses: Record<string, number> = {};
    let totalMonthlyExpenses = 0;

    expenses
      .filter(e => e.date && e.date.startsWith(monthKey))
      .forEach(e => {
        categoryExpenses[e.category] = (categoryExpenses[e.category] || 0) + e.amount;
        totalMonthlyExpenses += e.amount;
      });

    const netProfit = monthlyIncome - totalMonthlyExpenses;

    return {
      income: monthlyIncome,
      expensesByCategory: categoryExpenses,
      totalExpenses: totalMonthlyExpenses,
      netProfit
    };
  }, [payments, expenses, selectedPLMonth]);

  // CSV Exporter for Expenses
  const handleExportExpensesCSV = () => {
    if (filteredExpensesList.length === 0) return;

    const headers = ["ID", "Category", "Amount (INR)", "Date", "Note"];
    const rows = filteredExpensesList.map(e => [
      e.id,
      e.category,
      e.amount,
      e.date,
      `"${(e.note || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `TLA_Expenses_Export_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Exporter for Outstanding Fees
  const handleExportOutstandingCSV = () => {
    if (outstandingStudentsList.length === 0) return;

    const headers = [
      "Student Name", 
      "Registration Number", 
      "Course Enrolled", 
      "Batch Start Date", 
      "Total Fees (INR)", 
      "Paid (INR)", 
      "Remaining Due (INR)", 
      "Last Payment Date"
    ];
    const rows = outstandingStudentsList.map(s => [
      `"${s.name.replace(/"/g, '""')}"`,
      s.registration_number,
      s.course_type,
      s.batch_start_date,
      s.total_fees,
      s.totalPaid,
      s.remaining_fees,
      s.lastPaymentDate || "Never"
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `TLA_Outstanding_Fees_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Table 3: Dropout / Lost Revenue Report
  const dropoutReportList = useMemo(() => {
    return students
      .filter(s => {
        if (s.status !== "Dropped") return false;
        const dDate = s.dropout_date || s.admission_date;
        return dDate && dDate >= startDate && dDate <= endDate;
      })
      .map(s => {
        const studentPayments = payments.filter(p => p.student_id === s.id);
        const collected = studentPayments.reduce((sum, p) => sum + p.amount, 0);
        return {
          ...s,
          collected
        };
      })
      .sort((a, b) => {
        const dateA = a.dropout_date || a.admission_date || "";
        const dateB = b.dropout_date || b.admission_date || "";
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
  }, [students, payments, startDate, endDate]);

  // CSV Exporter for Dropout Report
  const handleExportDropoutCSV = () => {
    if (dropoutReportList.length === 0) return;

    const headers = [
      "Student Name",
      "Registration Number",
      "Course Enrolled",
      "Total Fees (INR)",
      "Amount Collected (INR)",
      "Remaining Fees / Lost (INR)",
      "Dropout Reason",
      "Dropout Date"
    ];
    const rows = dropoutReportList.map(s => [
      `"${s.name.replace(/"/g, '""')}"`,
      s.registration_number,
      s.course_type,
      s.total_fees,
      s.collected,
      s.remaining_fees,
      `"${(s.dropout_reason || "N/A").replace(/"/g, '""')}"`,
      s.dropout_date || s.admission_date || "N/A"
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `TLA_Dropout_Report_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const PIE_COLORS = ["#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f59e0b", "#10b981", "#64748b"];

  return (
    <div className="space-y-8" id="finance-workspace">
      
      {/* Title & Date Range Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Financial Governance</h1>
          <p className="text-xs sm:text-sm text-slate-400">Manage institutional revenue, log expense cycles, and track fee collection health.</p>
        </div>
        
        {/* Global Selected Date Range for charts and totals */}
        <div className="bg-slate-900 border border-slate-800 p-3 sm:p-3.5 rounded-xl space-y-3 w-full lg:w-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Analysis Range:</span>
            </div>

            {/* Quick Preset Range Buttons */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => { setStartDate(todayStr); setEndDate(todayStr); }}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer border ${
                  startDate === todayStr && endDate === todayStr
                    ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => {
                  const { startStr, endStr } = getWeekRange(todayStr);
                  setStartDate(startStr);
                  setEndDate(endStr);
                }}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer border ${
                  startDate === getWeekRange(todayStr).startStr && endDate === getWeekRange(todayStr).endStr
                    ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                This Week
              </button>

              <button
                type="button"
                onClick={() => { setStartDate(firstDayStr); setEndDate(lastDayStr); }}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer border ${
                  startDate === firstDayStr && endDate === lastDayStr
                    ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                This Month
              </button>

              <button
                type="button"
                onClick={() => {
                  setStartDate(currentFY.startDateStr);
                  setEndDate(currentFY.endDateStr);
                }}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer border ${
                  startDate === currentFY.startDateStr && endDate === currentFY.endDateStr
                    ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                This Year ({currentFY.fyLabel})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <span className="text-[11px] font-bold text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded border border-teal-500/20">
              Active: {formatDateLabel(startDate)} – {formatDateLabel(endDate)}
            </span>
          </div>
        </div>
      </div>

      {/* CA Audit Financial Year Excel Export Banner */}
      <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-lg shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs sm:text-sm font-bold text-white block">Chartered Accountant (CA) Audit Financial Report</span>
            <span className="text-[11px] text-slate-400 block">Generate 6-sheet Excel statement (Revenue, Expenses, P&L, Payment Details, Expense Details & Outstanding)</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <span className="text-xs text-slate-400 font-semibold">Select FY:</span>
            <select
              value={selectedFYForExport}
              onChange={(e) => setSelectedFYForExport(e.target.value)}
              className="bg-transparent text-xs text-teal-400 font-bold focus:outline-none cursor-pointer"
            >
              {availableFYKeys.map(fy => (
                <option key={fy} value={fy} className="bg-slate-900 text-white">
                  FY {fy}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportExcelFYReport}
            className="w-full sm:w-auto px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export Financial Year Report (Excel)
          </button>
        </div>
      </div>

      {/* CHANGE 1 & CHANGE 2: KPI Metrics Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* Total Collected Revenue (Range) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Collected Revenue</span>
            <span className="text-xl font-extrabold text-emerald-400 block">₹{kpis.collectedInRange.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 block">All-time: ₹{kpis.totalCollectedAllTime.toLocaleString()}</span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <CreditCard className="h-4 w-4" />
          </div>
        </div>

        {/* Total Expenses (Range) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Expenses</span>
            <span className="text-xl font-extrabold text-orange-400 block">₹{kpis.selectedExpensesTotal.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 block">Selected range</span>
          </div>
          <div className="p-2.5 bg-orange-500/10 text-orange-400 rounded-lg">
            <ArrowDownRight className="h-4 w-4" />
          </div>
        </div>

        {/* Net Profit (Range) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Net Profit</span>
            <span className={`text-xl font-extrabold block ${kpis.netProfitInRange >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
              ₹{kpis.netProfitInRange.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500 block">Collected - Expenses</span>
          </div>
          <div className={`p-2.5 rounded-lg ${kpis.netProfitInRange >= 0 ? 'bg-teal-500/10 text-teal-400' : 'bg-red-500/10 text-red-400'}`}>
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>

        {/* Revenue Lost (Dropouts) */}
        <div className="bg-slate-900 border border-rose-900/40 rounded-xl p-4 flex items-center justify-between shadow-sm bg-rose-950/10">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider block">Revenue Lost (Dropouts)</span>
            <span className="text-xl font-extrabold text-rose-400 block">₹{kpis.revenueLostDropoutsInRange.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block">Dropped remaining due</span>
          </div>
          <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-lg">
            <AlertCircle className="h-4 w-4" />
          </div>
        </div>

        {/* Expected Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Expected Revenue</span>
            <span className="text-xl font-extrabold text-white block">₹{kpis.totalExpected.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 block">All student registries</span>
          </div>
          <div className="p-2.5 bg-slate-800 text-slate-400 rounded-lg">
            <FileText className="h-4 w-4" />
          </div>
        </div>

        {/* Outstanding Fees */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm border-amber-900/40">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Outstanding Fees</span>
            <span className="text-xl font-extrabold text-amber-400 block">₹{kpis.outstanding.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 block">Remaining active due</span>
          </div>
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg">
            <ShieldAlert className="h-4 w-4" />
          </div>
        </div>

      </div>

      {/* Interval Fees Collections Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Today's collections */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Today's Collections</span>
          <span className="text-3xl font-extrabold text-white block">₹{kpis.todaysCollection.toLocaleString()}</span>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-2">
            <div className="bg-teal-500 h-full rounded-full" style={{ width: kpis.todaysCollection > 0 ? '100%' : '0%' }} />
          </div>
        </div>

        {/* This Week's collections */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">This Week's Collections</span>
          <span className="text-3xl font-extrabold text-white block">₹{kpis.weeksCollection.toLocaleString()}</span>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-2">
            <div className="bg-indigo-500 h-full rounded-full" style={{ width: kpis.weeksCollection > 0 ? '100%' : '0%' }} />
          </div>
        </div>

        {/* This Month's collections */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">This Month's Collections</span>
          <span className="text-3xl font-extrabold text-white block">₹{kpis.monthsCollection.toLocaleString()}</span>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-2">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: kpis.monthsCollection > 0 ? '100%' : '0%' }} />
          </div>
        </div>

      </div>

      {/* CHANGE 3, 4, 5: Visual Analytics and breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Monthly Revenue Trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-teal-400" />
            <h3 className="text-base font-bold text-white">Monthly Revenue Trend (Last 6 Months)</h3>
          </div>
          <div className="h-80 w-full">
            {monthlyRevenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyRevenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }}
                    labelStyle={{ color: "#94a3b8" }}
                    itemStyle={{ color: "#10b981" }}
                    formatter={(value: any) => [`₹${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#10b981"
                    strokeWidth={3}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No transaction records found.</div>
            )}
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
          <div className="flex items-center gap-2">
            <PieIcon className="h-5 w-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Expense Breakdown (Selected Date Range)</h3>
          </div>
          <div className="h-80 w-full flex flex-col md:flex-row items-center justify-center gap-4">
            {expensePieChartData.length > 0 ? (
              <>
                <div className="h-64 w-64 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensePieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {expensePieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }}
                        itemStyle={{ color: "#ffffff" }}
                        formatter={(value: any) => [`₹${value.toLocaleString()}`, "Expense"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5 w-full max-w-xs overflow-y-auto max-h-64 pr-2">
                  {expensePieChartData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="text-slate-300 truncate max-w-[130px]">{item.name}</span>
                      </div>
                      <span className="font-bold text-white text-[11px]">
                        ₹{item.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No expenses recorded for this range.</div>
            )}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CHANGE 5: Revenue by Course */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarIcon className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white font-sans">Collected Revenue by Course Type</h3>
            </div>
          </div>
          <div className="h-80 w-full">
            {courseRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseRevenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }}
                    labelStyle={{ color: "#94a3b8" }}
                    itemStyle={{ color: "#14b8a6" }}
                    formatter={(value: any) => [`₹${value.toLocaleString()}`, "Collected"]}
                  />
                  <Bar dataKey="amount" fill="#14b8a6" radius={[4, 4, 0, 0]}>
                    {courseRevenueData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No course revenue mapped in this range.</div>
            )}
          </div>
        </div>

        {/* CHANGE 4: Payment Methods Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-teal-400" />
              <h3 className="text-base font-bold text-white">Payment Method Breakdown</h3>
            </div>
            <p className="text-xs text-slate-400">Comparing total funds routed via UPI networks vs direct cash deposit in the selected date range.</p>
          </div>

          <div className="space-y-6 my-6">
            {/* UPI Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-teal-400 flex items-center gap-1.5">
                  <span className="h-3 w-3 bg-teal-400 rounded-full" />
                  Unified Payments (UPI)
                </span>
                <span className="font-bold text-white">{paymentMethodsData.upiPercent}%</span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden">
                <div className="bg-teal-400 h-full rounded-full" style={{ width: `${paymentMethodsData.upiPercent}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Direct bank node transfer</span>
                <span className="font-bold text-slate-400">₹{paymentMethodsData.upi.toLocaleString()}</span>
              </div>
            </div>

            {/* Cash Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span className="h-3 w-3 bg-emerald-400 rounded-full" />
                  Direct Institutional Cash
                </span>
                <span className="font-bold text-white">{paymentMethodsData.cashPercent}%</span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${paymentMethodsData.cashPercent}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Hand-delivery register</span>
                <span className="font-bold text-slate-400">₹{paymentMethodsData.cash.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 flex justify-between items-center text-xs">
            <span className="text-slate-400">Total Filtered Inflow:</span>
            <span className="font-extrabold text-white text-sm">₹{paymentMethodsData.total.toLocaleString()}</span>
          </div>
        </div>

      </div>

      {/* CHANGE 7: Profit & Loss Statement Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Monthly Profit & Loss Ledger</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold uppercase">Selected Ledger:</span>
            <select
              className="bg-slate-950 border border-slate-800 text-white text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-500 transition-colors font-mono"
              value={selectedPLMonth}
              onChange={(e) => setSelectedPLMonth(e.target.value)}
            >
              {plMonths.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          {/* Income Column */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-5 space-y-4">
            <h4 className="font-bold text-emerald-400 text-xs uppercase tracking-wider flex items-center justify-between">
              Income / Fees Collected
              <span className="text-slate-500 font-normal">Inflow</span>
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-400">Total Course Receipts</span>
                <span className="font-bold text-white">₹{plSummary.income.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-white pt-2 text-base">
                <span>Total Income</span>
                <span className="text-emerald-400">₹{plSummary.income.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Expenses Column */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-5 space-y-4">
            <h4 className="font-bold text-rose-400 text-xs uppercase tracking-wider flex items-center justify-between">
              Expenses / Outflows
              <span className="text-slate-500 font-normal">Debits</span>
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {Object.keys(plSummary.expensesByCategory).length > 0 ? (
                Object.keys(plSummary.expensesByCategory).map(cat => (
                  <div key={cat} className="flex justify-between border-b border-slate-900/50 pb-1.5 text-xs">
                    <span className="text-slate-400">{cat}</span>
                    <span className="text-slate-200">₹{plSummary.expensesByCategory[cat].toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-600 text-xs italic">No expenses logged in this ledger cycle.</p>
              )}
            </div>
            <div className="flex justify-between font-bold text-white pt-2 text-base border-t border-slate-800">
              <span>Total Debits</span>
              <span className="text-rose-400">₹{plSummary.totalExpenses.toLocaleString()}</span>
            </div>
          </div>

          {/* Ledger Net Profit */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="font-bold text-teal-400 text-xs uppercase tracking-wider">
                Cycle Performance Summaries
              </h4>
              <p className="text-xs text-slate-400">Showing the operational profit surplus or deficit compiled of raw income receipts minus recorded utility debits.</p>
            </div>
            <div className="pt-4 space-y-1">
              <span className="text-xs text-slate-500 block font-semibold uppercase">Operational Net Profit:</span>
              <span className={`text-3xl font-extrabold block ${plSummary.netProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                ₹{plSummary.netProfit.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono">Formula: Inflow - Debits</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHANGE 1: Expenses Input & Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Expense Registration Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4 h-fit">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Plus className="h-5 w-5 text-teal-400" />
            <h3 className="text-base font-bold text-white">Log Expense Disbursement</h3>
          </div>

          {expenseFormError && (
            <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-800 text-red-200 text-xs p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p>{expenseFormError}</p>
            </div>
          )}

          {expenseFormSuccess && (
            <div className="flex items-start gap-2.5 bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs p-3 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <p>Expense logged securely in cloud registries.</p>
            </div>
          )}

          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 block">Expense Category *</label>
              <select
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors font-sans"
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
              >
                <option value="Faculty Salary">Faculty Salary</option>
                <option value="Staff Salary">Staff Salary</option>
                <option value="Rent">Rent</option>
                <option value="Electricity">Electricity</option>
                <option value="Internet">Internet</option>
                <option value="Marketing">Marketing</option>
                <option value="Software Subscription">Software Subscription</option>
                <option value="Equipment Purchase">Equipment Purchase</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 block">Disbursement Amount (INR) *</label>
              <input
                type="number"
                min={1}
                required
                placeholder="0"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors font-sans"
                value={expenseAmount || ""}
                onChange={(e) => setExpenseAmount(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 block">Disbursement Date *</label>
              <input
                type="date"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 block">Particular / Note (Optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Paid Rent for Ground Floor office Space"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-700 resize-none font-sans"
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingExpense}
              className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 text-slate-950 font-bold rounded-lg py-2.5 px-4 transition-colors text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSubmittingExpense ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin animate-infinite" />
                  Recording cycle...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Record Expense
                </>
              )}
            </button>
          </form>
        </div>

        {/* Expenses List & Ledger Table */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-400" />
                Ledger Expense Registry
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Showing total disbursement of <strong className="text-orange-400">₹{runningExpensesTotal.toLocaleString()}</strong> in filtered scope.
              </p>
            </div>
            
            <button
              onClick={handleExportExpensesCSV}
              disabled={filteredExpensesList.length === 0}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-850 disabled:opacity-50 text-white font-semibold rounded-lg py-1.5 px-3.5 transition-colors text-xs flex items-center gap-2 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-teal-400" />
              Export Expenses
            </button>
          </div>

          {/* Filtering controls inside Expense ledger */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <select
                className="w-full bg-transparent text-white text-xs focus:outline-none"
                value={expenseListCategory}
                onChange={(e) => setExpenseListCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Faculty Salary">Faculty Salary</option>
                <option value="Staff Salary">Staff Salary</option>
                <option value="Rent">Rent</option>
                <option value="Electricity">Electricity</option>
                <option value="Internet">Internet</option>
                <option value="Marketing">Marketing</option>
                <option value="Software Subscription">Software Subscription</option>
                <option value="Equipment Purchase">Equipment Purchase</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <input
                type="date"
                className="w-full bg-transparent text-white text-[11px] focus:outline-none font-mono"
                value={expenseListStartDate}
                onChange={(e) => setExpenseListStartDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 font-mono text-[11px]">
              <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <input
                type="date"
                className="w-full bg-transparent text-white text-[11px] focus:outline-none"
                value={expenseListEndDate}
                onChange={(e) => setExpenseListEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Expenses Table */}
          <div className="overflow-x-auto max-h-[340px] border border-slate-850 rounded-lg">
            {filteredExpensesList.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-850">
                    <th className="py-2.5 px-4">Disbursement Date</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Particular / Note</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {filteredExpensesList.map(e => (
                    <tr key={e.id} className="hover:bg-slate-850/30 text-slate-300">
                      <td className="py-2.5 px-4 font-mono">{e.date}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 bg-slate-800 rounded font-semibold text-slate-300">
                          {e.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 max-w-[150px] truncate" title={e.note}>
                        {e.note || "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-orange-400">
                        ₹{e.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-slate-500 italic">No expense disbursements meet the filter criteria.</div>
            )}
          </div>

        </div>

      </div>

      {/* CHANGE 6: Outstanding Fees View */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-400" />
              Outstanding Fees Registry
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Identifies active student registries with remaining due fee balances. Sorted by how long ago last installment was received.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportOutstandingCSV}
              disabled={outstandingStudentsList.length === 0}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-850 disabled:opacity-50 text-white font-semibold rounded-lg py-1.5 px-3.5 transition-colors text-xs flex items-center gap-2 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-teal-400" />
              Export Outstanding
            </button>
          </div>
        </div>

        {/* Outstanding filter selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider pr-1">Cycle Filters:</span>
          {(["All", "Due Today", "Due This Week", "Due This Month", "Overdue"] as const).map(filterOption => (
            <button
              key={filterOption}
              onClick={() => setOutstandingFilter(filterOption)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                outstandingFilter === filterOption
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  : "bg-slate-950 border-slate-850 text-slate-400 hover:text-white"
              }`}
            >
              {filterOption}
            </button>
          ))}
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto border border-slate-850 rounded-lg">
          {outstandingStudentsList.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-850">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Reg Number</th>
                  <th className="py-3 px-4">Course Enrolled</th>
                  <th className="py-3 px-4">Batch Start</th>
                  <th className="py-3 px-4 text-right">Total Fees</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Remaining Due</th>
                  <th className="py-3 px-4 text-center">Last Payment Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/50">
                {outstandingStudentsList.map(s => (
                  <tr key={s.id} className="hover:bg-slate-850/30 text-slate-300">
                    <td className="py-3 px-4 font-bold text-white">{s.name}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-teal-400 tracking-wider">
                      {s.registration_number}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{s.course_type}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{s.batch_start_date}</td>
                    <td className="py-3 px-4 text-right text-slate-300">₹{s.total_fees.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-semibold">₹{s.totalPaid.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-rose-400 font-extrabold text-sm">
                      ₹{s.remaining_fees.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {s.lastPaymentDate ? (
                        <span className="text-slate-200">{s.lastPaymentDate}</span>
                      ) : (
                        <span className="text-rose-500/80 italic font-sans font-bold">Never Paid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-slate-500 italic">No outstanding ledger accounts matching criteria.</div>
          )}
        </div>

      </div>

      {/* CHANGE 1: Dropout / Lost Revenue Report Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-400" />
              Dropout Report & Lost Revenue Analysis
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tracks students marked as Dropped and their uncollected remaining fees treated as Lost Revenue.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportDropoutCSV}
              disabled={dropoutReportList.length === 0}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-850 disabled:opacity-50 text-white font-semibold rounded-lg py-1.5 px-3.5 transition-colors text-xs flex items-center gap-2 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-rose-400" />
              Export Dropout Report
            </button>
          </div>
        </div>

        {/* Top Summary Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-400">This Month's Loss: </span>
            <strong className="text-rose-400 font-bold ml-1">₹{kpis.monthlyDropoutLoss.toLocaleString()}</strong>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-400">{currentFY.fyLabel} Loss: </span>
            <strong className="text-rose-400 font-bold ml-1">₹{kpis.yearlyDropoutLoss.toLocaleString()}</strong>
          </div>
          <div className="bg-rose-950/30 border border-rose-900/50 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-rose-200 font-medium">Loss in Selected Range: </span>
            <strong className="text-rose-400 font-extrabold ml-1">₹{kpis.revenueLostDropoutsInRange.toLocaleString()}</strong>
          </div>
        </div>

        {/* Dropout Table */}
        <div className="overflow-x-auto border border-slate-850 rounded-lg">
          {dropoutReportList.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-850">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Reg Number</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4 text-right">Total Fees</th>
                  <th className="py-3 px-4 text-right">Collected</th>
                  <th className="py-3 px-4 text-right text-rose-400">Remaining (Lost)</th>
                  <th className="py-3 px-4">Dropout Reason</th>
                  <th className="py-3 px-4 text-center">Dropout Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/50">
                {dropoutReportList.map(s => (
                  <tr key={s.id} className="hover:bg-slate-850/30 text-slate-300">
                    <td className="py-3 px-4 font-bold text-white">{s.name}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-teal-400">{s.registration_number}</td>
                    <td className="py-3 px-4 text-slate-400">{s.course_type}</td>
                    <td className="py-3 px-4 text-right text-slate-300">₹{s.total_fees.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-semibold">₹{s.collected.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-rose-400 font-extrabold text-sm">
                      ₹{s.remaining_fees.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-[200px] truncate" title={s.dropout_reason || "N/A"}>
                      {s.dropout_reason || "Not specified"}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300">
                      {s.dropout_date || s.admission_date || "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-slate-500 italic">No dropped students recorded in the selected date range.</div>
          )}
        </div>
      </div>

    </div>
  );
}
