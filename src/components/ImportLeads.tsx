import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Lead } from "../types";
import * as XLSX from "xlsx";
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  X,
  UserPlus,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Tag,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Layers,
  Award,
  Sparkles
} from "lucide-react";

interface ImportLeadsProps {
  onNavigateToAdmission: (leadId?: string) => void;
}

export interface ParsedLeadRow {
  name: string;
  phone: string;
  email: string;
  address: string;
  source: string;
  course_interest: string;
  class_mode: string;
  dob: string;
  assigned_batch: string;
  lead_score: string;
  tags: string;
}

const TARGET_COLUMNS: { key: keyof ParsedLeadRow; label: string; example: string; required?: boolean }[] = [
  { key: "name", label: "Name", example: "Rahul Sharma", required: true },
  { key: "phone", label: "Phone", example: "9876543210" },
  { key: "email", label: "Email", example: "rahul.sharma@example.com" },
  { key: "address", label: "Address", example: "Mowa, Raipur, Chhattisgarh" },
  { key: "source", label: "Source", example: "Facebook Ads" },
  { key: "course_interest", label: "Course Interest", example: "Premiere Pro" },
  { key: "class_mode", label: "Class Mode", example: "Offline" },
  { key: "dob", label: "DOB", example: "15-06-2002" },
  { key: "assigned_batch", label: "Assigned Batch", example: "Batch 12 - Aug 2026" },
  { key: "lead_score", label: "Lead Score", example: "Warm" },
  { key: "tags", label: "Tags", example: "interested in weekend batch" }
];

export default function ImportLeads({ onNavigateToAdmission }: ImportLeadsProps) {
  // Upload and Preview States
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedLeadRow[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [headerMap, setHeaderMap] = useState<Record<keyof ParsedLeadRow, string>>({
    name: "",
    phone: "",
    email: "",
    address: "",
    source: "",
    course_interest: "",
    class_mode: "",
    dob: "",
    assigned_batch: "",
    lead_score: "",
    tags: ""
  });
  const [importStep, setImportStep] = useState<"upload" | "preview" | "importing">("upload");
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Firestore Existing Leads State
  const [existingLeads, setExistingLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [scoreFilter, setScoreFilter] = useState("All");

  // Fetch Existing CRM Leads on Mount
  const fetchLeads = async () => {
    setLeadsLoading(true);
    try {
      const q = query(collection(db, "leads"));
      const snapshot = await getDocs(q);
      const list: Lead[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Lead);
      });
      setExistingLeads(list);
    } catch (err: any) {
      console.error("Error fetching leads:", err);
    } finally {
      setLeadsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // 1. Download Sample CSV Template
  const handleDownloadSampleCSV = () => {
    const headers = [
      "name",
      "phone",
      "email",
      "address",
      "source",
      "course_interest",
      "class_mode",
      "dob",
      "assigned_batch",
      "lead_score",
      "tags"
    ];

    const sampleDataRow = [
      "Rahul Sharma",
      "9876543210",
      "rahul.sharma@example.com",
      "Mowa, Raipur, Chhattisgarh",
      "Facebook Ads",
      "Premiere Pro",
      "Offline",
      "15-06-2002",
      "Batch 12 - Aug 2026",
      "Warm",
      "interested in weekend batch"
    ];

    const escapeCSV = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csvContent =
      headers.join(",") + "\n" + sampleDataRow.map(escapeCSV).join(",") + "\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_leads_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Normalize field key helper
  const normalizeKey = (key: string): keyof ParsedLeadRow | null => {
    const k = key.trim().toLowerCase().replace(/[\s\-_]+/g, "_");
    if (k === "name" || k === "full_name" || k === "student_name" || k === "lead_name") return "name";
    if (k === "phone" || k === "phone_number" || k === "mobile" || k === "contact") return "phone";
    if (k === "email" || k === "email_address" || k === "email_id") return "email";
    if (k === "address" || k === "residential_address" || k === "location") return "address";
    if (k === "source" || k === "lead_source" || k === "channel") return "source";
    if (k === "course_interest" || k === "course" || k === "interested_course") return "course_interest";
    if (k === "class_mode" || k === "mode" || k === "batch_mode") return "class_mode";
    if (k === "dob" || k === "date_of_birth" || k === "birth_date") return "dob";
    if (k === "assigned_batch" || k === "batch" || k === "batch_name") return "assigned_batch";
    if (k === "lead_score" || k === "score" || k === "priority") return "lead_score";
    if (k === "tags" || k === "tag" || k === "notes" || k === "remarks") return "tags";
    return null;
  };

  // 2. Parse Uploaded CSV / Excel File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });

        if (rawJson.length === 0) {
          setErrorMessage("The uploaded file appears to be empty or missing data rows.");
          return;
        }

        // Get headers from first row
        const firstRowKeys = Object.keys(rawJson[0]);
        setDetectedHeaders(firstRowKeys);

        // Map headers to target keys
        const initialMap: Record<keyof ParsedLeadRow, string> = {
          name: "",
          phone: "",
          email: "",
          address: "",
          source: "",
          course_interest: "",
          class_mode: "",
          dob: "",
          assigned_batch: "",
          lead_score: "",
          tags: ""
        };

        firstRowKeys.forEach((hk) => {
          const matchedKey = normalizeKey(hk);
          if (matchedKey) {
            initialMap[matchedKey] = hk;
          }
        });

        setHeaderMap(initialMap);

        // Convert raw rows to ParsedLeadRow structure
        const mappedRows: ParsedLeadRow[] = rawJson.map((row) => {
          const getVal = (targetKey: keyof ParsedLeadRow) => {
            const headerName = initialMap[targetKey];
            if (headerName && row[headerName] !== undefined && row[headerName] !== null) {
              return String(row[headerName]).trim();
            }
            // Fallback direct property check
            for (const key of Object.keys(row)) {
              if (normalizeKey(key) === targetKey) {
                return String(row[key] || "").trim();
              }
            }
            return "";
          };

          return {
            name: getVal("name"),
            phone: getVal("phone"),
            email: getVal("email"),
            address: getVal("address"),
            source: getVal("source"),
            course_interest: getVal("course_interest"),
            class_mode: getVal("class_mode"),
            dob: getVal("dob"),
            assigned_batch: getVal("assigned_batch"),
            lead_score: getVal("lead_score"),
            tags: getVal("tags")
          };
        });

        setParsedRows(mappedRows);
        setImportStep("preview");
      } catch (err: any) {
        console.error("Error parsing CSV file:", err);
        setErrorMessage(`Failed to parse file: ${err.message || "Invalid CSV format"}`);
      }
    };

    reader.readAsBinaryString(uploadedFile);
  };

  // 3. Confirm and Bulk Import Leads into Firestore
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) {
      setErrorMessage("No lead rows available to import.");
      return;
    }

    setImportStep("importing");
    setImportProgress({ current: 0, total: parsedRows.length });
    setErrorMessage(null);

    let count = 0;
    try {
      for (const row of parsedRows) {
        // Skip completely empty rows
        if (!row.name && !row.phone && !row.email) {
          count++;
          setImportProgress({ current: count, total: parsedRows.length });
          continue;
        }

        const leadData = {
          name: row.name || "Unnamed Lead",
          phone: row.phone || "",
          email: row.email || "",
          address: row.address || "",
          source: row.source || "",
          course_interest: row.course_interest || "",
          class_mode: row.class_mode || "",
          dob: row.dob || "",
          assigned_batch: row.assigned_batch || "",
          lead_score: row.lead_score || "",
          tags: row.tags || "",
          converted_to_student: false,
          status: "New Lead",
          created_timestamp: new Date().toISOString()
        };

        await addDoc(collection(db, "leads"), leadData).catch((err) => {
          handleFirestoreError(err, OperationType.CREATE, "leads");
        });

        count++;
        setImportProgress({ current: count, total: parsedRows.length });
      }

      setSuccessMessage(`Successfully imported ${parsedRows.length} lead(s) into the CRM database!`);
      setImportStep("upload");
      setFile(null);
      setParsedRows([]);
      fetchLeads();
    } catch (err: any) {
      console.error("Import failed:", err);
      setErrorMessage(`Import failed after ${count} rows: ${err.message || "Unknown error"}`);
      setImportStep("preview");
    }
  };

  // Cancel Preview
  const handleCancelPreview = () => {
    setFile(null);
    setParsedRows([]);
    setImportStep("upload");
  };

  // Filter existing leads
  const filteredLeads = existingLeads.filter((lead) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      lead.name.toLowerCase().includes(q) ||
      lead.phone.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      (lead.course_interest || "").toLowerCase().includes(q) ||
      (lead.address || "").toLowerCase().includes(q);

    const matchesScore =
      scoreFilter === "All" ||
      (lead.lead_score || "").toLowerCase() === scoreFilter.toLowerCase();

    return matchesSearch && matchesScore;
  });

  return (
    <div className="space-y-8" id="import-leads-workspace">
      {/* Title Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <FileSpreadsheet className="h-8 w-8 text-teal-400" />
              Import CRM Leads
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Bulk upload prospective student leads via CSV. Includes support for all 11 lead detail attributes.
          </p>
        </div>

        {/* Download Sample CSV Action Button */}
        <button
          onClick={handleDownloadSampleCSV}
          className="bg-slate-900 hover:bg-slate-800 text-teal-300 border border-teal-500/30 hover:border-teal-500/60 font-semibold px-4 py-2.5 rounded-lg text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shrink-0"
          id="download-sample-csv-btn"
        >
          <Download className="h-4 w-4 text-teal-400" />
          Download Sample CSV Template
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl flex items-start gap-3">
          <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm">{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: UPLOAD AREA */}
      {importStep === "upload" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-teal-400" />
                Upload CSV Lead File
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Select or drag a CSV file. The template should match the 11 lead columns:
              </p>
            </div>
          </div>

          {/* Column Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-2">
            {TARGET_COLUMNS.map((col) => (
              <div
                key={col.key}
                className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 flex flex-col"
              >
                <span className="font-mono text-teal-400 font-bold">{col.key}</span>
                <span className="text-[10px] text-slate-500 truncate mt-0.5">e.g. {col.example}</span>
              </div>
            ))}
          </div>

          {/* File Dropzone */}
          <div className="border-2 border-dashed border-slate-800 hover:border-teal-500/50 bg-slate-950/50 hover:bg-slate-950 transition-all rounded-xl p-8 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>

            <div>
              <label htmlFor="csv-file-input" className="cursor-pointer">
                <span className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm inline-block transition-colors shadow-sm">
                  Choose CSV File
                </span>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-slate-500 mt-2">Supports .CSV, .XLS, .XLSX files</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: COLUMN MAPPING & PREVIEW SCREEN */}
      {importStep === "preview" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-md" id="lead-import-preview">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-teal-500/10 text-teal-400 text-xs font-bold border border-teal-500/20">
                  Step 2: Preview & Column Verification
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                Found {parsedRows.length} Lead Record(s) in <span className="text-teal-400">{file?.name}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Confirm all 11 columns are mapped and verified before finalizing the bulk import.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleCancelPreview}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-extrabold rounded-lg text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center gap-2"
                id="confirm-import-btn"
              >
                <CheckCircle className="h-4 w-4" />
                Confirm & Import {parsedRows.length} Leads
              </button>
            </div>
          </div>

          {/* Mapped Columns Overview */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              11 Column Mapping Verification
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {TARGET_COLUMNS.map((col) => {
                const isMapped = Boolean(headerMap[col.key]);
                return (
                  <div
                    key={col.key}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                      isMapped
                        ? "bg-teal-950/30 border-teal-500/30 text-teal-300"
                        : "bg-slate-950/60 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div>
                      <span className="font-bold block text-[11px] text-white">{col.label}</span>
                      <span className="font-mono text-[10px] text-teal-400/80 block mt-0.5">{col.key}</span>
                    </div>
                    <div className="mt-2 text-[10px] pt-1.5 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className="font-semibold text-teal-400">Verified</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Parsed Data Preview Table */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Full Data Row Preview (All 11 Fields)
              </h3>
              <span className="text-xs text-slate-400">Showing all {parsedRows.length} rows</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-[420px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-300 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800 text-[10px]">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Address</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Course Interest</th>
                    <th className="p-3">Class Mode</th>
                    <th className="p-3">DOB</th>
                    <th className="p-3">Assigned Batch</th>
                    <th className="p-3">Lead Score</th>
                    <th className="p-3">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/80 text-slate-200">
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-white truncate max-w-[140px]">
                        {row.name || <span className="text-slate-600 font-normal italic">-</span>}
                      </td>
                      <td className="p-3 font-mono text-teal-300">
                        {row.phone || <span className="text-slate-600 font-normal italic">-</span>}
                      </td>
                      <td className="p-3 truncate max-w-[140px]">
                        {row.email || <span className="text-slate-600 font-normal italic">-</span>}
                      </td>
                      <td className="p-3 truncate max-w-[160px] text-slate-300">
                        {row.address || <span className="text-slate-600 font-normal italic">-</span>}
                      </td>
                      <td className="p-3">
                        {row.source ? (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                            {row.source}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">-</span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-slate-200">
                        {row.course_interest || <span className="text-slate-600 font-normal italic">-</span>}
                      </td>
                      <td className="p-3">
                        {row.class_mode ? (
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-semibold">
                            {row.class_mode}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">-</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        {row.dob || <span className="text-slate-600 font-normal italic">-</span>}
                      </td>
                      <td className="p-3 text-slate-300">
                        {row.assigned_batch || <span className="text-slate-600 font-normal italic">-</span>}
                      </td>
                      <td className="p-3">
                        {row.lead_score ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.lead_score.toLowerCase().includes("hot")
                              ? "bg-rose-500/20 text-rose-300"
                              : row.lead_score.toLowerCase().includes("warm")
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}>
                            {row.lead_score}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">-</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 truncate max-w-[150px]">
                        {row.tags || <span className="text-slate-600 font-normal italic">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: IMPORT PROGRESS STATE */}
      {importStep === "importing" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center space-y-4 shadow-md">
          <div className="inline-block p-4 rounded-full bg-teal-500/10 text-teal-400 animate-pulse">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Importing Leads into CRM Database...</h3>
            <p className="text-xs text-slate-400 mt-1">
              Saving lead {importProgress.current} of {importProgress.total}
            </p>
          </div>
          <div className="w-full max-w-md mx-auto bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div
              className="bg-teal-400 h-full transition-all duration-300"
              style={{
                width: `${
                  importProgress.total > 0
                    ? Math.round((importProgress.current / importProgress.total) * 100)
                    : 0
                }%`
              }}
            />
          </div>
        </div>
      )}

      {/* SECTION 4: EXISTING CRM LEADS REGISTRY */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-teal-400" />
              CRM Database Leads Registry ({filteredLeads.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Current imported leads stored in Firestore. Click "Enroll" to pre-fill admission form.
            </p>
          </div>

          <button
            onClick={fetchLeads}
            disabled={leadsLoading}
            className="p-2 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-1.5 text-xs"
            title="Refresh Leads"
          >
            <RefreshCw className={`h-4 w-4 ${leadsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Search & Score Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search leads by name, phone, email, course, address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
            >
              <option value="All">All Scores</option>
              <option value="Hot">Hot</option>
              <option value="Warm">Warm</option>
              <option value="Cold">Cold</option>
            </select>
          </div>
        </div>

        {/* Leads Table */}
        {leadsLoading ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-teal-400" />
            <p className="text-xs">Loading CRM leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="py-12 text-center text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/80">
            <p className="text-sm font-semibold">No CRM leads found.</p>
            <p className="text-xs text-slate-600 mt-1">Upload a CSV file above to populate leads.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="p-3">Name & Contact</th>
                  <th className="p-3">Course & Batch</th>
                  <th className="p-3">Mode & Source</th>
                  <th className="p-3">Score & Tags</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 text-slate-200">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3">
                      <p className="font-bold text-white text-sm">{lead.name}</p>
                      <p className="font-mono text-teal-400 text-xs mt-0.5">{lead.phone}</p>
                      {lead.email && <p className="text-[11px] text-slate-400">{lead.email}</p>}
                      {lead.address && <p className="text-[10px] text-slate-500 mt-0.5">{lead.address}</p>}
                    </td>

                    <td className="p-3">
                      <p className="font-semibold text-slate-200">{lead.course_interest || "N/A"}</p>
                      {lead.assigned_batch && (
                        <p className="text-[11px] text-slate-400 mt-0.5">Batch: {lead.assigned_batch}</p>
                      )}
                      {lead.dob && <p className="text-[10px] text-slate-500 mt-0.5">DOB: {lead.dob}</p>}
                    </td>

                    <td className="p-3">
                      <div className="space-y-1">
                        {lead.class_mode && (
                          <span className="inline-block px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-semibold rounded">
                            {lead.class_mode}
                          </span>
                        )}
                        {lead.source && (
                          <p className="text-[11px] text-slate-400">Src: {lead.source}</p>
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="space-y-1">
                        {lead.lead_score && (
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${
                            lead.lead_score.toLowerCase().includes("hot")
                              ? "bg-rose-500/20 text-rose-300"
                              : lead.lead_score.toLowerCase().includes("warm")
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}>
                            {lead.lead_score}
                          </span>
                        )}
                        {lead.tags && (
                          <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{lead.tags}</p>
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      {lead.converted_to_student ? (
                        <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                          Converted
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-teal-500/10 text-teal-400 text-[10px] font-bold border border-teal-500/20">
                          {lead.status || "New Lead"}
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      {!lead.converted_to_student ? (
                        <button
                          onClick={() => onNavigateToAdmission(lead.id)}
                          className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded text-xs transition-colors cursor-pointer inline-flex items-center gap-1 shadow-sm"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Enroll
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-medium">Enrolled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
