export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  source?: string;
  course_interest?: string;
  class_mode?: string;
  dob?: string;
  assigned_batch?: string;
  lead_score?: string;
  tags?: string;
  converted_to_student?: boolean;
  status?: string;
  student_id?: string;
  created_timestamp?: any;
}

export interface CourseOption {
  id: string;
  name: string;
  active?: boolean;
  created_timestamp?: any;
}

export interface BatchOption {
  id: string;
  name: string;
  active?: boolean;
  created_timestamp?: any;
}

export type CourseType = string;

export type StudentStatus = "Active" | "Completed" | "Dropped" | "On Hold";

export type CertificateStatus = "Not Issued" | "Issued";

export interface StatusHistoryEntry {
  previous_status: StudentStatus;
  new_status: StudentStatus;
  changed_date: string;
  note: string;
}

export interface Student {
  id: string; // Document ID (auto-generated)
  registration_number: string; // TLA-YYYY-####, transaction-safely generated
  linked_lead_id?: string; // empty if walk-in
  name: string;
  phone: string;
  email: string;
  address: string;
  dob: string; // YYYY-MM-DD
  admission_date: string; // YYYY-MM-DD
  course_type: CourseType;
  batch_start_date: string; // YYYY-MM-DD
  total_fees: number;
  admission_fees: number;
  remaining_fees: number; // total_fees - sum(all payments)
  status: StudentStatus;
  certificate_status: CertificateStatus;
  certificate_issue_date?: string; // YYYY-MM-DD
  dropout_date?: string; // YYYY-MM-DD
  dropout_reason?: string;
  status_history?: StatusHistoryEntry[];
  created_timestamp: any;
}

export interface Payment {
  id: string; // Document ID
  student_id: string;
  amount: number;
  mode: "UPI" | "Cash";
  date: string; // YYYY-MM-DD
  type: string; // "Admission Fee", "Installment", etc.
  note?: string;
  timestamp: any;
}

export type ExpenseCategory =
  | "Faculty Salary"
  | "Staff Salary"
  | "Rent"
  | "Electricity"
  | "Internet"
  | "Marketing"
  | "Software Subscription"
  | "Equipment Purchase"
  | "Maintenance"
  | "Miscellaneous";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  created_timestamp: any;
}

