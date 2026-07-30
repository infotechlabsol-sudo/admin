export const EMAIL_REMINDER_TEMPLATE = {
  subject: "Fee Payment Reminder — {{name}} | Tech Lab Academy",
  body: `Hi {{name}},

This is a friendly reminder that your fee payment is pending at Tech Lab Academy.

Registration Number: {{registration_number}}
Course: {{course_type}}
Total Fees: ₹{{total_fees}}
Amount Paid So Far: ₹{{total_paid}}
Remaining Fees: ₹{{remaining_fees}}

Please make your payment at your earliest convenience to continue enjoying uninterrupted access to your classes. You can pay via UPI or Cash at our institute.

If you've already made this payment, please ignore this message or let us know so we can update our records.

For any questions, feel free to reach out to us at info.techlabsol@gmail.com.

Warm regards,
Team Tech Lab Academy
Mowa, Raipur, Chhattisgarh`
};

export const WHATSAPP_REMINDER_TEMPLATE = `Hi {{name}}, this is a reminder from Tech Lab Academy that your fee payment of ₹{{remaining_fees}} is pending (Reg No: {{registration_number}}). Please pay at your earliest convenience via UPI or Cash. If you've already paid, kindly ignore this message. Thank you! - Tech Lab Academy`;

export interface ReminderStudentData {
  name: string;
  phone: string;
  email: string;
  registration_number: string;
  course_type: string;
  total_fees: number;
  totalPaid: number;
  remaining_fees: number;
}

export function getReminderEmailUrl(student: ReminderStudentData): string {
  const subject = EMAIL_REMINDER_TEMPLATE.subject.replace("{{name}}", student.name);
  const body = EMAIL_REMINDER_TEMPLATE.body
    .replace(/{{name}}/g, student.name)
    .replace("{{registration_number}}", student.registration_number)
    .replace("{{course_type}}", student.course_type)
    .replace("{{total_fees}}", student.total_fees.toLocaleString())
    .replace("{{total_paid}}", student.totalPaid.toLocaleString())
    .replace("{{remaining_fees}}", student.remaining_fees.toLocaleString());

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(student.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function getReminderWhatsAppUrl(student: ReminderStudentData): string {
  let cleanPhone = student.phone.replace(/[^0-9]/g, "");
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }

  const message = WHATSAPP_REMINDER_TEMPLATE
    .replace("{{name}}", student.name)
    .replace("{{remaining_fees}}", student.remaining_fees.toLocaleString())
    .replace("{{registration_number}}", student.registration_number);

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
