import { useState, useMemo } from "react";
import { Student, CourseOption, BatchOption } from "../types";
import { Search, Filter, Download, User, ArrowRight, Eye, RefreshCw, FileText } from "lucide-react";
import ReceiptModal from "./ReceiptModal";

interface StudentListProps {
  students: Student[];
  courses?: CourseOption[];
  batches?: BatchOption[];
  onSelectStudent: (studentId: string) => void;
  onNavigateToAdmission: () => void;
}

export default function StudentList({ students, courses = [], batches = [], onSelectStudent, onNavigateToAdmission }: StudentListProps) {
  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [courseFilter, setCourseFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [batchFilter, setBatchFilter] = useState("All");

  // Quick Receipt Modal State
  const [receiptModalStudent, setReceiptModalStudent] = useState<Student | null>(null);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setCourseFilter("All");
    setStatusFilter("All");
    setBatchFilter("All");
  };

  // Find unique courses for the dropdown filter (from active Firestore courses + student records)
  const availableCourseOptions = useMemo(() => {
    const courseSet = new Set<string>();
    courses.filter(c => c.active !== false).forEach(c => courseSet.add(c.name));
    students.forEach(s => {
      if (s.course_type) courseSet.add(s.course_type);
    });
    return Array.from(courseSet).sort();
  }, [courses, students]);

  // Find unique batches for the dropdown filter (from active Firestore batches + student records)
  const availableBatchOptions = useMemo(() => {
    const batchSet = new Set<string>();
    batches.filter(b => b.active !== false).forEach(b => batchSet.add(b.name));
    students.forEach(s => {
      if (s.batch_start_date) batchSet.add(s.batch_start_date);
    });
    return Array.from(batchSet).sort();
  }, [batches, students]);

  // Apply Search and Filters
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch = 
        !query ||
        student.name.toLowerCase().includes(query) ||
        student.registration_number.toLowerCase().includes(query) ||
        student.phone.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query);

      const matchesCourse = courseFilter === "All" || student.course_type === courseFilter;
      const matchesStatus = statusFilter === "All" || student.status === statusFilter;
      const matchesBatch = batchFilter === "All" || student.batch_start_date === batchFilter;

      return matchesSearch && matchesCourse && matchesStatus && matchesBatch;
    });
  }, [students, searchTerm, courseFilter, statusFilter, batchFilter]);

  // CSV Exporter
  const handleExportCSV = () => {
    if (students.length === 0) return;

    const headers = [
      "Registration Number",
      "Full Name",
      "Phone",
      "Email",
      "Residential Address",
      "Date of Birth",
      "Admission Date",
      "Course Type",
      "Batch Start Date",
      "Total Fees (INR)",
      "Admission Fees (INR)",
      "Remaining Fees (INR)",
      "Status",
      "Certificate Status",
      "Certificate Issue Date"
    ];

    const rows = students.map(s => [
      s.registration_number,
      `"${s.name.replace(/"/g, '""')}"`,
      s.phone,
      s.email,
      `"${(s.address || "").replace(/"/g, '""')}"`,
      s.dob,
      s.admission_date,
      s.course_type,
      s.batch_start_date,
      s.total_fees,
      s.admission_fees,
      s.remaining_fees,
      s.status,
      s.certificate_status,
      s.certificate_issue_date || ""
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `TLA_Students_Export_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="student-list-workspace">
      {/* List Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Student Enrollment Registry</h1>
          <p className="text-xs sm:text-sm text-slate-400">Search, filter, edit, or export registered student records.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleExportCSV}
            disabled={students.length === 0}
            className="flex-1 sm:flex-none bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-lg py-2 px-3 sm:px-4 transition-colors text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="h-4 w-4 text-teal-400" />
            Export CSV
          </button>
          <button
            onClick={onNavigateToAdmission}
            className="flex-1 sm:flex-none bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold rounded-lg py-2 px-3 sm:px-4 transition-colors text-xs sm:text-sm cursor-pointer text-center"
          >
            Add Admission
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Text Search */}
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search Name, Reg No, Contact..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Course filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500 shrink-0" />
            <select
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
            >
              <option value="All">All Courses</option>
              {availableCourseOptions.map(course => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500 shrink-0" />
            <select
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Dropped">Dropped</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>

          {/* Batch start date filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500 shrink-0" />
            <select
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            >
              <option value="All">All Batches</option>
              {availableBatchOptions.map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear filter indicator */}
        {(searchTerm || courseFilter !== "All" || statusFilter !== "All" || batchFilter !== "All") && (
          <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs">
            <span className="text-slate-400">
              Found <strong className="text-teal-400">{filteredStudents.length}</strong> matching students out of {students.length}
            </span>
            <button
              onClick={handleResetFilters}
              className="text-teal-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none"
            >
              <RefreshCw className="h-3 w-3" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Tabular Student Directory */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {filteredStudents.length > 0 ? (
          <div className="overflow-x-auto">
            {/* Desktop Table */}
            <table className="w-full text-left border-collapse hidden md:table">
              <thead>
                <tr className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-bold border-b border-slate-800">
                  <th className="py-4 px-6">Reg Number</th>
                  <th className="py-4 px-6">Student Name</th>
                  <th className="py-4 px-6">Course Enrolled</th>
                  <th className="py-4 px-6">Batch Start</th>
                  <th className="py-4 px-6 text-right">Total Fees</th>
                  <th className="py-4 px-6 text-right">Remaining Due</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredStudents.map(s => (
                  <tr key={s.id} className="hover:bg-slate-850/50 transition-colors text-sm">
                    <td className="py-4 px-6 font-bold text-teal-400 tracking-wider">
                      {s.registration_number}
                    </td>
                    <td className="py-4 px-6 font-semibold text-white">
                      {s.name}
                    </td>
                    <td className="py-4 px-6 text-slate-300">
                      {s.course_type}
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-mono">
                      {s.batch_start_date}
                    </td>
                    <td className="py-4 px-6 text-right text-slate-300 font-semibold">
                      ₹{s.total_fees.toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-rose-400">
                      ₹{(s.remaining_fees ?? 0).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                          s.status === "Active"
                            ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                            : s.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : s.status === "On Hold"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                        }`}
                      >
                        {s.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setReceiptModalStudent(s)}
                          className="p-1.5 bg-slate-950 hover:bg-slate-800 text-teal-400 border border-slate-800 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold"
                          title="View Quick Receipt"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Receipt
                        </button>
                        <button
                          onClick={() => onSelectStudent(s.id)}
                          className="p-1.5 bg-slate-950 hover:bg-teal-500 hover:text-slate-950 text-slate-400 border border-slate-800 hover:border-teal-500 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Fallback Card Grid */}
            <div className="md:hidden divide-y divide-slate-850">
              {filteredStudents.map(s => (
                <div key={s.id} className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-teal-400 tracking-wider">{s.registration_number}</span>
                      <h4 className="text-base font-bold text-white mt-0.5">{s.name}</h4>
                    </div>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                        s.status === "Active"
                          ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                          : s.status === "Completed"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : s.status === "On Hold"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                      }`}
                    >
                      {s.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">Course</span>
                      <span className="text-slate-200">{s.course_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Batch Start</span>
                      <span className="text-slate-200 font-mono">{s.batch_start_date}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Fees</span>
                      <span className="text-slate-200 font-semibold">₹{s.total_fees.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Remaining Due</span>
                      <span className="text-rose-400 font-extrabold">₹{(s.remaining_fees ?? 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setReceiptModalStudent(s)}
                      className="flex-1 py-2 bg-slate-950 hover:bg-slate-800 text-teal-400 font-bold rounded-lg border border-slate-800 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Receipt
                    </button>
                    <button
                      onClick={() => onSelectStudent(s.id)}
                      className="flex-1 py-2 bg-slate-950 hover:bg-teal-500 hover:text-slate-950 text-slate-300 font-bold rounded-lg border border-slate-800 hover:border-teal-500 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3 bg-slate-950 border border-slate-800 text-slate-600 rounded-full mb-2">
              <User className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-300">No Student Records Found</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              There are no student enrollments matching the current search parameters or database states.
            </p>
          </div>
        )}
      </div>

      {/* Quick Receipt Modal */}
      <ReceiptModal
        isOpen={!!receiptModalStudent}
        onClose={() => setReceiptModalStudent(null)}
        student={receiptModalStudent}
      />
    </div>
  );
}
