import { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { auth, db } from "./firebase";
import { Student, Payment, Expense, CourseOption, BatchOption } from "./types";
import AdminLogin from "./components/AdminLogin";
import PublicVerify from "./components/PublicVerify";
import Dashboard from "./components/Dashboard";
import AdmissionForm from "./components/AdmissionForm";
import StudentList from "./components/StudentList";
import StudentDetail from "./components/StudentDetail";
import Finance from "./components/Finance";
import FeeReminders from "./components/FeeReminders";
import Birthdays from "./components/Birthdays";
import Settings from "./components/Settings";
import { 
  Award, LayoutDashboard, UserPlus, Users, LogOut, Loader2, Sparkles, TrendingUp, Bell, Cake, Sun, Moon, Sliders, Menu, X
} from "lucide-react";

export default function App() {
  // Authentication & Global States
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [dbLoading, setDbLoading] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Firestore Data Cache
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);

  // Theme state persisting in session
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (sessionStorage.getItem("theme") as "dark" | "light") || "dark";
  });

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    sessionStorage.setItem("theme", nextTheme);
  };

  // Navigation / View state
  const [currentView, setCurrentView] = useState<"dashboard" | "admission" | "students" | "detail" | "finance" | "reminders" | "birthdays" | "settings">("dashboard");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>(undefined);

  // Parse deep-linking query parameters on boot
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const leadIdParam = urlParams.get("lead_id");
    const verifyParam = urlParams.get("verify");

    if (verifyParam === "1" || verifyParam === "true") {
      setVerifyMode(true);
    }
    if (leadIdParam) {
      setSelectedLeadId(leadIdParam);
      setCurrentView("admission");
    }
  }, []);

  // Monitor Authentication State
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return unsubAuth;
  }, []);

  // Sync Students and Payments when authenticated
  useEffect(() => {
    if (!user) {
      setStudents([]);
      setPayments([]);
      setExpenses([]);
      return;
    }

    setDbLoading(true);

    // Stream Students collection
    const studentsQuery = query(collection(db, "students"));
    const unsubStudents = onSnapshot(
      studentsQuery,
      (snapshot) => {
        const studentList: Student[] = [];
        snapshot.forEach((doc) => {
          studentList.push({ id: doc.id, ...doc.data() } as Student);
        });
        setStudents(studentList);
        setDbLoading(false);
      },
      (err) => {
        console.error("Failed to sync students collection:", err);
        setDbLoading(false);
      }
    );

    // Stream Payments collection
    const paymentsQuery = query(collection(db, "payments"));
    const unsubPayments = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        const paymentsList: Payment[] = [];
        snapshot.forEach((doc) => {
          paymentsList.push({ id: doc.id, ...doc.data() } as Payment);
        });
        setPayments(paymentsList);
      },
      (err) => {
        console.error("Failed to sync payments collection:", err);
      }
    );

    // Stream Expenses collection
    const expensesQuery = query(collection(db, "expenses"));
    const unsubExpenses = onSnapshot(
      expensesQuery,
      (snapshot) => {
        const expensesList: Expense[] = [];
        snapshot.forEach((doc) => {
          expensesList.push({ id: doc.id, ...doc.data() } as Expense);
        });
        setExpenses(expensesList);
      },
      (err) => {
        console.error("Failed to sync expenses collection:", err);
      }
    );

    // Stream Courses collection (shared with Tech Lab CRM)
    const coursesQuery = query(collection(db, "courses"));
    const unsubCourses = onSnapshot(
      coursesQuery,
      (snapshot) => {
        const coursesList: CourseOption[] = [];
        snapshot.forEach((doc) => {
          coursesList.push({ id: doc.id, ...doc.data() } as CourseOption);
        });
        setCourses(coursesList);
      },
      (err) => {
        console.error("Failed to sync courses collection:", err);
      }
    );

    // Stream Batches collection (shared with Tech Lab CRM)
    const batchesQuery = query(collection(db, "batches"));
    const unsubBatches = onSnapshot(
      batchesQuery,
      (snapshot) => {
        const batchesList: BatchOption[] = [];
        snapshot.forEach((doc) => {
          batchesList.push({ id: doc.id, ...doc.data() } as BatchOption);
        });
        setBatches(batchesList);
      },
      (err) => {
        console.error("Failed to sync batches collection:", err);
      }
    );

    return () => {
      unsubStudents();
      unsubPayments();
      unsubExpenses();
      unsubCourses();
      unsubBatches();
    };
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentView("dashboard");
      setSelectedStudentId(null);
      setSelectedLeadId(undefined);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  // Render Loader during initial auth boot
  if (authChecking) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-slate-950 text-white ${theme === "light" ? "light" : ""}`} id="init-loader">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 text-teal-400 animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Synchronizing Security Tokens...</p>
        </div>
      </div>
    );
  }

  // Handle Public Certificate Verification Route (No Auth Needed)
  if (verifyMode) {
    return (
      <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative ${theme === "light" ? "light" : ""}`} id="app-root">
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={toggleTheme}
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer shadow-md flex items-center justify-center"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-teal-400" />}
          </button>
        </div>
        <PublicVerify 
          onBackToLogin={() => {
            setVerifyMode(false);
            // Clean URL parameters
            window.history.replaceState({}, '', window.location.pathname);
          }} 
        />
      </div>
    );
  }

  // Require Auth for workspace
  if (!user) {
    return (
      <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative ${theme === "light" ? "light" : ""}`} id="app-root">
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={toggleTheme}
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer shadow-md flex items-center justify-center"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-teal-400" />}
          </button>
        </div>
        <AdminLogin 
          onSuccess={() => {
            // If a lead was pre-loaded, automatically route there upon login
            if (selectedLeadId) {
              setCurrentView("admission");
            } else {
              setCurrentView("dashboard");
            }
          }} 
          onGoToVerify={() => setVerifyMode(true)} 
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans ${theme === "light" ? "light" : ""}`} id="app-root">
      {/* Navigation Header */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-3 sm:px-6 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 sm:p-2 bg-teal-500/10 text-teal-400 rounded-lg shrink-0">
              <Award className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight text-white block">Tech Lab Academy</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Admission & Fees Portal</span>
            </div>
          </div>

          {/* Desktop Navigation Controls */}
          <div className="hidden xl:flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => { setCurrentView("dashboard"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentView === "dashboard"
                  ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                  : "text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>

            <button
              onClick={() => { setCurrentView("admission"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentView === "admission"
                  ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                  : "text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <UserPlus className="h-4 w-4" />
              Enroll
            </button>

            <button
              onClick={() => { setCurrentView("students"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentView === "students" || currentView === "detail"
                  ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                  : "text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <Users className="h-4 w-4" />
              Registry
            </button>

            <button
              onClick={() => { setCurrentView("finance"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentView === "finance"
                  ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                  : "text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Finance
            </button>

            <button
              onClick={() => { setCurrentView("reminders"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentView === "reminders"
                  ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                  : "text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <Bell className="h-4 w-4" />
              Reminders
            </button>

            <button
              onClick={() => { setCurrentView("birthdays"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentView === "birthdays"
                  ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                  : "text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <Cake className="h-4 w-4" />
              Birthdays
            </button>

            <button
              onClick={() => { setCurrentView("settings"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentView === "settings"
                  ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                  : "text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              <Sliders className="h-4 w-4" />
              Settings
            </button>

            <button
              onClick={() => { setVerifyMode(true); setMobileMenuOpen(false); }}
              className="px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 border border-transparent"
            >
              <Sparkles className="h-4 w-4 text-teal-400" />
              Verify
            </button>
          </div>

          {/* User Sign-Out & Theme Actions */}
          <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-800">
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-teal-400" />}
            </button>

            <button
              onClick={handleSignOut}
              className="p-1.5 sm:p-2 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 sm:p-2 bg-slate-950 border border-slate-800 text-teal-400 rounded-lg xl:hidden transition-colors cursor-pointer shrink-0"
              title="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Quick Horizontal Scroll Bar (visible up to xl breakpoint) */}
        <div className="xl:hidden flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-1 no-scrollbar border-t border-slate-800/60 mt-2">
          <button
            onClick={() => { setCurrentView("dashboard"); setSelectedStudentId(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 ${
              currentView === "dashboard" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "bg-slate-950 text-slate-400 border border-slate-800"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </button>
          <button
            onClick={() => { setCurrentView("admission"); setSelectedStudentId(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 ${
              currentView === "admission" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "bg-slate-950 text-slate-400 border border-slate-800"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Enroll
          </button>
          <button
            onClick={() => { setCurrentView("students"); setSelectedStudentId(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 ${
              currentView === "students" || currentView === "detail" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "bg-slate-950 text-slate-400 border border-slate-800"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Registry
          </button>
          <button
            onClick={() => { setCurrentView("finance"); setSelectedStudentId(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 ${
              currentView === "finance" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "bg-slate-950 text-slate-400 border border-slate-800"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Finance
          </button>
          <button
            onClick={() => { setCurrentView("reminders"); setSelectedStudentId(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 ${
              currentView === "reminders" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "bg-slate-950 text-slate-400 border border-slate-800"
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            Reminders
          </button>
          <button
            onClick={() => { setCurrentView("birthdays"); setSelectedStudentId(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 ${
              currentView === "birthdays" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "bg-slate-950 text-slate-400 border border-slate-800"
            }`}
          >
            <Cake className="h-3.5 w-3.5" />
            Birthdays
          </button>
          <button
            onClick={() => { setCurrentView("settings"); setSelectedStudentId(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 ${
              currentView === "settings" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "bg-slate-950 text-slate-400 border border-slate-800"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Settings
          </button>
          <button
            onClick={() => setVerifyMode(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 bg-slate-950 text-slate-400 border border-slate-800"
          >
            <Sparkles className="h-3.5 w-3.5 text-teal-400" />
            Verify
          </button>
        </div>

        {/* Mobile Expanded Drawer Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden pt-3 pb-2 border-t border-slate-800 mt-2 space-y-1.5">
            <button
              onClick={() => { setCurrentView("dashboard"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 ${
                currentView === "dashboard" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-300 bg-slate-950/60"
              }`}
            >
              <LayoutDashboard className="h-4 w-4 text-teal-400" />
              Dashboard Overview
            </button>
            <button
              onClick={() => { setCurrentView("admission"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 ${
                currentView === "admission" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-300 bg-slate-950/60"
              }`}
            >
              <UserPlus className="h-4 w-4 text-teal-400" />
              New Student Admission Form
            </button>
            <button
              onClick={() => { setCurrentView("students"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 ${
                currentView === "students" || currentView === "detail" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-300 bg-slate-950/60"
              }`}
            >
              <Users className="h-4 w-4 text-teal-400" />
              Student Registry Directory
            </button>
            <button
              onClick={() => { setCurrentView("finance"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 ${
                currentView === "finance" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-300 bg-slate-950/60"
              }`}
            >
              <TrendingUp className="h-4 w-4 text-teal-400" />
              Financial Governance & Reports
            </button>
            <button
              onClick={() => { setCurrentView("reminders"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 ${
                currentView === "reminders" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-300 bg-slate-950/60"
              }`}
            >
              <Bell className="h-4 w-4 text-teal-400" />
              Fee Payment Reminders
            </button>
            <button
              onClick={() => { setCurrentView("birthdays"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 ${
                currentView === "birthdays" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-300 bg-slate-950/60"
              }`}
            >
              <Cake className="h-4 w-4 text-teal-400" />
              Birthday Greetings Engine
            </button>
            <button
              onClick={() => { setCurrentView("settings"); setSelectedStudentId(null); setMobileMenuOpen(false); }}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 ${
                currentView === "settings" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-300 bg-slate-950/60"
              }`}
            >
              <Sliders className="h-4 w-4 text-teal-400" />
              System Settings & Data Control
            </button>
            <button
              onClick={() => { setVerifyMode(true); setMobileMenuOpen(false); }}
              className="w-full px-3 py-2.5 rounded-lg text-xs font-bold text-teal-300 bg-slate-950/60 border border-teal-500/20 flex items-center gap-2.5"
            >
              <Sparkles className="h-4 w-4 text-teal-400" />
              Public Verification Portal
            </button>
          </div>
        )}
      </nav>

      {/* Main Workspace Frame */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {dbLoading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 text-teal-400 animate-spin mx-auto" />
              <p className="text-slate-400 text-sm">Streaming cloud data structures...</p>
            </div>
          </div>
        ) : (
          <div className="animate-fadeIn">
            {currentView === "dashboard" && (
              <Dashboard 
                students={students} 
                payments={payments} 
                onNavigate={(view) => {
                  if (view === "admission") setSelectedLeadId(undefined);
                  setCurrentView(view);
                }} 
              />
            )}

            {currentView === "admission" && (
              <AdmissionForm 
                courses={courses}
                batches={batches}
                leadId={selectedLeadId}
                onSuccess={() => {
                  setSelectedLeadId(undefined);
                  setCurrentView("students");
                }}
                onCancel={() => {
                  setSelectedLeadId(undefined);
                  setCurrentView("dashboard");
                }}
              />
            )}

            {currentView === "students" && (
              <StudentList 
                students={students} 
                courses={courses}
                batches={batches}
                onSelectStudent={(id) => {
                  setSelectedStudentId(id);
                  setCurrentView("detail");
                }} 
                onNavigateToAdmission={() => {
                  setSelectedLeadId(undefined);
                  setCurrentView("admission");
                }}
              />
            )}

            {currentView === "detail" && selectedStudentId && (
              <StudentDetail 
                studentId={selectedStudentId} 
                courses={courses}
                batches={batches}
                onBack={() => {
                  setSelectedStudentId(null);
                  setCurrentView("students");
                }}
              />
            )}

            {currentView === "finance" && (
              <Finance 
                students={students} 
                payments={payments} 
                expenses={expenses} 
              />
            )}

            {currentView === "reminders" && (
              <FeeReminders 
                students={students} 
                payments={payments} 
                onSelectStudent={(id) => {
                  setSelectedStudentId(id);
                  setCurrentView("detail");
                }} 
              />
            )}

            {currentView === "birthdays" && (
              <Birthdays students={students} />
            )}

            {currentView === "settings" && (
              <Settings adminEmail={user?.email} />
            )}
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="border-t border-slate-900 bg-slate-900/40 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Tech Lab Academy. CRM Integrated Admission Engine.</p>
      </footer>
    </div>
  );
}
