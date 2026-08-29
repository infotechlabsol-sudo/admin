import React, { useState, useMemo } from "react";
import { Student } from "../types";
import WhatsAppModal from "./WhatsAppModal";
import { LeadOrStudentData } from "../templateService";
import { Cake, Mail, MessageSquare, Calendar, Gift, Info } from "lucide-react";

// EDITABLE CONSTANTS FOR BIRTHDAY MESSAGES
export const BIRTHDAY_EMAIL_TEMPLATE = {
  subject: "Happy Birthday, {{name}}! 🎉 — Tech Lab Academy",
  body: `Dear {{name}},

Wishing you a very Happy Birthday from all of us at Tech Lab Academy! 🎂

We hope your day is filled with joy, laughter, and everything you love. Thank you for being a valued part of our Tech Lab family — we're grateful to have you with us on your creative journey.

Have a wonderful year ahead, filled with growth, creativity, and success!

Warm wishes,
Team Tech Lab Academy
Mowa, Raipur, Chhattisgarh`
};

export const BIRTHDAY_WHATSAPP_TEMPLATE = `Happy Birthday, {{name}}! 🎉🎂 Wishing you a fantastic day and an amazing year ahead, from all of us at Tech Lab Academy. Thank you for being part of our Tech Lab family! - Team Tech Lab Academy`;

// Helper functions for links
export function getBirthdayEmailUrl(name: string, email: string): string {
  const subject = BIRTHDAY_EMAIL_TEMPLATE.subject.replace("{{name}}", name);
  const body = BIRTHDAY_EMAIL_TEMPLATE.body.replace(/{{name}}/g, name);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function getBirthdayWhatsAppUrl(name: string, phone: string): string {
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }
  const message = BIRTHDAY_WHATSAPP_TEMPLATE.replace(/{{name}}/g, name);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

interface BirthdaysProps {
  students: Student[];
}

export default function Birthdays({ students }: BirthdaysProps) {
  const [whatsAppRecipient, setWhatsAppRecipient] = useState<LeadOrStudentData | null>(null);
  const today = useMemo(() => new Date(), []);

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Process and compute birthday statuses
  const processedBirthdays = useMemo(() => {
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const currentYear = today.getFullYear();

    return students
      .filter((s) => s.dob && s.dob.trim() !== "")
      .map((s) => {
        // dob format should be YYYY-MM-DD
        const parts = s.dob!.split("-");
        if (parts.length !== 3) return null;

        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);

        if (isNaN(month) || isNaN(day)) return null;

        // Birthday Date this year
        let bDayThisYear = new Date(currentYear, month - 1, day);
        bDayThisYear.setHours(0, 0, 0, 0);

        let daysAway = 0;
        if (bDayThisYear.getTime() < todayZero.getTime()) {
          // If birthday has passed, next one is next year
          const bDayNextYear = new Date(currentYear + 1, month - 1, day);
          bDayNextYear.setHours(0, 0, 0, 0);
          const diffTime = bDayNextYear.getTime() - todayZero.getTime();
          daysAway = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } else {
          const diffTime = bDayThisYear.getTime() - todayZero.getTime();
          daysAway = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        const isToday = today.getMonth() + 1 === month && today.getDate() === day;

        return {
          student: s,
          isToday,
          daysAway,
          month,
          day,
          dobFormatted: `${day} ${MONTH_NAMES[month - 1]}`
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [students, today]);

  // Today's Birthdays
  const todaysBirthdays = useMemo(() => {
    return processedBirthdays.filter((item) => item.isToday);
  }, [processedBirthdays]);

  // Upcoming Birthdays (Next 30 Days)
  const upcomingBirthdays = useMemo(() => {
    return processedBirthdays
      .filter((item) => !item.isToday && item.daysAway <= 30)
      .sort((a, b) => a.daysAway - b.daysAway);
  }, [processedBirthdays]);

  return (
    <div className="space-y-6" id="birthdays-workspace">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Cake className="h-8 w-8 text-teal-400" />
              Student Birthdays
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            View student birthdays and send celebratory wishes via Gmail or WhatsApp in 1-click.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Today's Birthdays</span>
            <span className="text-lg font-extrabold text-teal-400">{todaysBirthdays.length} Active</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Next 30 Days</span>
            <span className="text-lg font-extrabold text-white">{upcomingBirthdays.length} Upcoming</span>
          </div>
        </div>
      </div>

      {/* Today's Birthdays Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Gift className="h-5 w-5 text-rose-400 animate-bounce" />
          Today's Birthdays
        </h2>

        {todaysBirthdays.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todaysBirthdays.map(({ student, dobFormatted }) => (
              <div 
                key={student.id}
                className="bg-slate-900 border-2 border-teal-500/40 rounded-xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between hover:border-teal-400 transition-all"
              >
                {/* Visual Party Accent */}
                <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-br from-teal-500/20 to-transparent pointer-events-none" />
                
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base text-white">{student.name}</h3>
                      <span className="text-[10px] font-mono text-teal-400 uppercase tracking-wider">Reg No: {student.registration_number}</span>
                    </div>
                    <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Cake className="h-3 w-3" /> Today
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    <p>Course: <strong className="text-slate-200">{student.course_type}</strong></p>
                    <p>Phone: <strong className="text-slate-200">{student.phone}</strong></p>
                    <p>Email: <strong className="text-slate-200">{student.email}</strong></p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800">
                  <a
                    href={getBirthdayEmailUrl(student.name, student.email)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white px-2 py-2 rounded-lg text-[11px] font-semibold transition-colors text-center cursor-pointer"
                    title="Send Birthday Email via Gmail"
                  >
                    <Mail className="h-3.5 w-3.5 text-teal-400" />
                    Send Email
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      setWhatsAppRecipient({
                        name: student.name,
                        phone: student.phone,
                        email: student.email,
                        registration_number: student.registration_number,
                        course_type: student.course_type,
                        dob: student.dob
                      })
                    }
                    className="flex items-center justify-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 px-2 py-2 rounded-lg text-[11px] font-bold transition-colors text-center cursor-pointer"
                    title="Send Birthday WhatsApp Wish"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    WhatsApp Wish
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
            No student birthdays today. Check the upcoming list below!
          </div>
        )}
      </div>

      {/* Upcoming Birthdays Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="h-5 w-5 text-teal-400" />
          Upcoming Birthdays (Next 30 Days)
        </h2>

        {upcomingBirthdays.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-md">
            <table className="w-full text-left border-collapse text-sm bg-slate-900">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60 font-medium">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Date of Birth</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {upcomingBirthdays.map(({ student, dobFormatted, daysAway }) => (
                  <tr key={student.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{student.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">Reg No: {student.registration_number}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-teal-300">{dobFormatted}</span>
                      <span className="ml-2 bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {daysAway === 1 ? "tomorrow" : `in ${daysAway} days`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{student.course_type}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{student.phone}</td>
                    <td className="py-3 px-4 text-slate-400">{student.email}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <a
                          href={getBirthdayEmailUrl(student.name, student.email)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                          title="Send Birthday Email via Gmail"
                        >
                          <Mail className="h-4 w-4 text-teal-400" />
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            setWhatsAppRecipient({
                              name: student.name,
                              phone: student.phone,
                              email: student.email,
                              registration_number: student.registration_number,
                              course_type: student.course_type,
                              dob: student.dob
                            })
                          }
                          className="p-2 bg-teal-500 hover:bg-teal-600 text-slate-950 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                          title="Send Birthday WhatsApp Wish"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
            No upcoming birthdays in the next 30 days.
          </div>
        )}
      </div>

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={!!whatsAppRecipient}
        onClose={() => setWhatsAppRecipient(null)}
        recipient={whatsAppRecipient}
        defaultTemplateCategory="birthday"
      />
    </div>
  );
}
