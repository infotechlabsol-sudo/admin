import { useMemo } from "react";
import { Student, Payment } from "../types";
import { Users, UserCheck, CreditCard, AlertCircle, Award, TrendingUp, PieChart as PieIcon } from "lucide-react";
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

interface DashboardProps {
  students: Student[];
  payments: Payment[];
  onNavigate: (view: "admission" | "students" | "dashboard") => void;
}

export default function Dashboard({ students, payments, onNavigate }: DashboardProps) {
  // Compute Stats
  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter(s => s.status === "Active").length;
    
    // Certificates pending: Completed course status but certificate is "Not Issued"
    const certsPending = students.filter(
      s => s.status === "Completed" && s.certificate_status !== "Issued"
    ).length;

    // Total remaining fees (all students)
    const remaining = students.reduce((sum, s) => sum + (s.remaining_fees || 0), 0);

    // Total fees collected this month (July 2026 based on mock local date 2026-07-28)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `${currentYear}-${currentMonthStr}`; // e.g. "2026-07"

    const collectedThisMonth = payments
      .filter(p => p.date && p.date.startsWith(prefix))
      .reduce((sum, p) => sum + p.amount, 0);

    return { total, active, certsPending, remaining, collectedThisMonth };
  }, [students, payments]);

  // Chart 1: Admissions per month (last 6 months)
  const admissionsChartData = useMemo(() => {
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const yearMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
      months.push({ label: monthLabel, key: yearMonthKey, count: 0 });
    }

    students.forEach(s => {
      if (!s.admission_date) return;
      const key = s.admission_date.substring(0, 7); // "YYYY-MM"
      const match = months.find(m => m.key === key);
      if (match) {
        match.count += 1;
      }
    });

    return months;
  }, [students]);

  // Chart 2: Course-wise student distribution
  const courseChartData = useMemo(() => {
    const counts: Record<string, number> = {};

    students.forEach(s => {
      const course = s.course_type || "Other";
      counts[course] = (counts[course] || 0) + 1;
    });

    return Object.keys(counts).map(course => ({
      name: course,
      value: counts[course]
    })).filter(item => item.value > 0);
  }, [students]);

  const COLORS = ["#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7"];

  return (
    <div className="space-y-8" id="dashboard-workspace">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Academy Analytics</h1>
          <p className="text-sm text-slate-400">Real-time stats and distributions for Tech Lab Academy.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate("admission")}
            className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold rounded-lg py-2 px-4 transition-colors text-sm cursor-pointer"
          >
            New Admission
          </button>
          <button
            onClick={() => onNavigate("students")}
            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-semibold rounded-lg py-2 px-4 transition-colors text-sm cursor-pointer"
          >
            View Student Records
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Students */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Enrolled</span>
            <span className="text-3xl font-extrabold text-white block">{stats.total}</span>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: Active Students */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Active Students</span>
            <span className="text-3xl font-extrabold text-teal-400 block">{stats.active}</span>
          </div>
          <div className="p-3 bg-teal-500/10 text-teal-400 rounded-lg">
            <UserCheck className="h-6 w-6" />
          </div>
        </div>

        {/* Card 3: Collected This Month */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Fees Collected (Month)</span>
            <span className="text-3xl font-extrabold text-emerald-400 block">₹{stats.collectedThisMonth.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>

        {/* Card 4: Total Remaining Fees */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Pending Receivables</span>
            <span className="text-3xl font-extrabold text-rose-400 block">₹{stats.remaining.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-lg">
            <AlertCircle className="h-6 w-6" />
          </div>
        </div>

        {/* Card 5: Certificates Pending */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Certificates Pending</span>
            <span className="text-3xl font-extrabold text-indigo-400 block">{stats.certsPending}</span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Award className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Admissions per Month */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-teal-400" />
            <h3 className="text-base font-bold text-white">Monthly Enrolled Trend (Last 6 Months)</h3>
          </div>
          <div className="h-80 w-full">
            {admissionsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={admissionsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }}
                    labelStyle={{ color: "#94a3b8" }}
                    itemStyle={{ color: "#14b8a6" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Admissions"
                    stroke="#14b8a6"
                    strokeWidth={3}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No admission trends recorded yet.</div>
            )}
          </div>
        </div>

        {/* Chart 2: Course Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
          <div className="flex items-center gap-2">
            <PieIcon className="h-5 w-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Course-wise Distribution</h3>
          </div>
          <div className="h-80 w-full flex flex-col md:flex-row items-center justify-center gap-4">
            {courseChartData.length > 0 ? (
              <>
                <div className="h-64 w-64 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={courseChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {courseChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }}
                        itemStyle={{ color: "#ffffff" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2 w-full max-w-xs">
                  {courseChartData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-slate-300 truncate max-w-[160px]">{item.name}</span>
                      </div>
                      <span className="font-bold text-white">
                        {item.value} ({Math.round((item.value / students.length) * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No course distributions found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
