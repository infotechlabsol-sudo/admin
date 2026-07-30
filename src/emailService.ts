import emailjs from "@emailjs/browser";

export const EMAILJS_CONFIG = {
  serviceId: "service_hv17bsm",
  publicKey: "SYrUNedhS73w-XPDz",
  templates: {
    admissionConfirmation: "template_t7q4v5b",
    paymentReceipt: "template_v8fpmm9",
    certificateIssued: "template_t7q4v5b" // reuse or fallback if no separate certificate template is defined
  },
  fromName: "Tech Lab Academy",
  replyTo: "info.techlabsol@gmail.com"
};

// Initialize EmailJS with the public key
emailjs.init(EMAILJS_CONFIG.publicKey);

export interface AdmissionEmailParams {
  student_email: string;
  student_name: string;
  registration_number: string;
  course: string;
  batch_start_date: string;
  admission_date: string;
  total_fees: number;
  admission_fees_paid: number;
  remaining_fees: number;
}

export interface PaymentEmailParams {
  student_email: string;
  student_name: string;
  registration_number: string;
  amount_paid: number;
  payment_mode: string;
  date: string;
  total_paid_so_far: number;
  remaining_fees: number;
}

export interface CertificateEmailParams {
  student_email: string;
  student_name: string;
  registration_number: string;
  course: string;
  verification_link: string;
}

export async function sendAdmissionEmail(params: AdmissionEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const templateParams = {
      to_email: params.student_email,
      student_name: params.student_name,
      registration_number: params.registration_number,
      course_name: params.course,
      batch_start_date: params.batch_start_date,
      admission_date: params.admission_date,
      total_fees: params.total_fees,
      admission_fees: params.admission_fees_paid,
      remaining_fees: params.remaining_fees,
      from_name: EMAILJS_CONFIG.fromName,
      reply_to: EMAILJS_CONFIG.replyTo,
      subject: "Admission Confirmed — Tech Lab Academy"
    };

    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templates.admissionConfirmation,
      templateParams,
      EMAILJS_CONFIG.publicKey
    );
    return { success: true };
  } catch (err: any) {
    console.error("EmailJS Error sending Admission Email:", err);
    return { success: false, error: err?.text || err?.message || String(err) };
  }
}

export async function sendPaymentEmail(params: PaymentEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const templateParams = {
      to_email: params.student_email,
      student_name: params.student_name,
      registration_number: params.registration_number,
      amount_paid: params.amount_paid,
      payment_mode: params.payment_mode,
      payment_date: params.date,
      total_paid: params.total_paid_so_far,
      remaining_fees: params.remaining_fees,
      from_name: EMAILJS_CONFIG.fromName,
      reply_to: EMAILJS_CONFIG.replyTo,
      subject: "Payment Received — Tech Lab Academy"
    };

    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templates.paymentReceipt,
      templateParams,
      EMAILJS_CONFIG.publicKey
    );
    return { success: true };
  } catch (err: any) {
    console.error("EmailJS Error sending Payment Email:", err);
    return { success: false, error: err?.text || err?.message || String(err) };
  }
}

export async function sendCertificateEmail(params: CertificateEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    // We send this as a certificate notification. If we reuse the general confirmation template, we configure the custom body
    const templateParams = {
      to_email: params.student_email,
      student_name: params.student_name,
      registration_number: params.registration_number,
      course_name: params.course,
      verification_link: params.verification_link,
      from_name: EMAILJS_CONFIG.fromName,
      reply_to: EMAILJS_CONFIG.replyTo,
      subject: "Certificate Issued — Tech Lab Academy",
      // Add custom body text if the template allows dynamic text insertion
      message: `Dear ${params.student_name},\n\nYour certificate for the course "${params.course}" has been officially issued by Tech Lab Academy!\n\nYou can verify and view your certificate status on our public verification portal here:\n${params.verification_link}\n\nRegistration Number: ${params.registration_number}\n\nWarm regards,\nTech Lab Academy Team`
    };

    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templates.certificateIssued,
      templateParams,
      EMAILJS_CONFIG.publicKey
    );
    return { success: true };
  } catch (err: any) {
    console.error("EmailJS Error sending Certificate Email:", err);
    return { success: false, error: err?.text || err?.message || String(err) };
  }
}
