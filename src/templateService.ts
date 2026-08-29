export interface MessageTemplate {
  id: string;
  title: string;
  category: "fee_reminder" | "birthday" | "admission" | "payment_receipt" | "general";
  body: string;
}

export interface LeadOrStudentData {
  name: string;
  phone: string;
  email?: string;
  registration_number?: string;
  course_type?: string;
  total_fees?: number;
  totalPaid?: number;
  remaining_fees?: number;
  admission_date?: string;
  batch_start_date?: string;
  dob?: string;
}

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "tpl_fee_reminder",
    title: "Fee Payment Reminder",
    category: "fee_reminder",
    body: "Hi {{name}}, this is a reminder from Tech Lab Academy that your fee payment of ₹{{remaining_fees}} is pending (Reg No: {{registration_number}}). Please pay at your earliest convenience via UPI or Cash. If you've already paid, kindly ignore this message. Thank you! - Tech Lab Academy"
  },
  {
    id: "tpl_birthday_wish",
    title: "Birthday Celebration Wish",
    category: "birthday",
    body: "Happy Birthday, {{name}}! 🎉🎂 Wishing you a fantastic day and an amazing year ahead, from all of us at Tech Lab Academy. Thank you for being part of our Tech Lab family! - Team Tech Lab Academy"
  },
  {
    id: "tpl_admission_welcome",
    title: "Admission Welcome & Confirmation",
    category: "admission",
    body: "Hi {{name}}, congratulations and welcome to Tech Lab Academy! You are successfully registered for {{course_type}} with Registration Number {{registration_number}}. Your batch starts on {{batch_start_date}}. Feel free to reach out if you need any assistance. - Team Tech Lab Academy"
  },
  {
    id: "tpl_payment_acknowledgment",
    title: "Payment Received Acknowledgment",
    category: "payment_receipt",
    body: "Hi {{name}}, we have successfully received your payment at Tech Lab Academy. Your current remaining fee balance is ₹{{remaining_fees}} (Reg No: {{registration_number}}). Thank you! - Team Tech Lab Academy"
  },
  {
    id: "tpl_general_followup",
    title: "General Class & Course Follow-up",
    category: "general",
    body: "Hi {{name}}, this is regarding your classes at Tech Lab Academy (Course: {{course_type}}). Please let us know if you have any questions or require any assistance with your coursework. - Team Tech Lab Academy"
  }
];

const STORAGE_KEY = "tla_message_templates_v1";

export function getMessageTemplates(): MessageTemplate[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.debug("Failed to read templates from storage:", err);
  }
  return DEFAULT_MESSAGE_TEMPLATES;
}

export function saveMessageTemplates(templates: MessageTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (err) {
    console.error("Failed to save message templates:", err);
  }
}

export function resetMessageTemplatesToDefault(): MessageTemplate[] {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.debug("Failed to reset templates:", err);
  }
  return DEFAULT_MESSAGE_TEMPLATES;
}

export function cleanPhoneNumber(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.length === 10) {
    clean = `91${clean}`;
  }
  return clean;
}

export function formatDisplayPhone(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.length === 10) {
    return `+91${clean}`;
  }
  if (clean.length === 12 && clean.startsWith("91")) {
    return `+${clean}`;
  }
  if (clean.startsWith("+")) {
    return clean;
  }
  return clean ? `+${clean}` : "";
}

export function populateTemplate(templateText: string, data: LeadOrStudentData): string {
  let result = templateText;
  result = result.replace(/{{name}}/g, data.name || "Student");
  result = result.replace(/{{phone}}/g, data.phone || "");
  result = result.replace(/{{email}}/g, data.email || "");
  result = result.replace(/{{registration_number}}/g, data.registration_number || "TLA-PENDING");
  result = result.replace(/{{course_type}}/g, data.course_type || "Selected Course");
  result = result.replace(/{{course}}/g, data.course_type || "Selected Course");
  result = result.replace(/{{total_fees}}/g, (data.total_fees !== undefined ? data.total_fees.toLocaleString() : "0"));
  result = result.replace(/{{total_paid}}/g, (data.totalPaid !== undefined ? data.totalPaid.toLocaleString() : "0"));
  result = result.replace(/{{remaining_fees}}/g, (data.remaining_fees !== undefined ? data.remaining_fees.toLocaleString() : "0"));
  result = result.replace(/{{admission_date}}/g, data.admission_date || "");
  result = result.replace(/{{batch_start_date}}/g, data.batch_start_date || "Upcoming Batch");
  result = result.replace(/{{dob}}/g, data.dob || "");
  return result;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleaned = cleanPhoneNumber(phone);
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}
