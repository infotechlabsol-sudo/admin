import React, { useState, useEffect, useMemo } from "react";
import {
  MessageSquare,
  X,
  User,
  Phone,
  FileText,
  Send,
  Info
} from "lucide-react";
import {
  getMessageTemplates,
  populateTemplate,
  formatDisplayPhone,
  buildWhatsAppUrl,
  LeadOrStudentData,
  MessageTemplate
} from "../templateService";

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: LeadOrStudentData | null;
  defaultTemplateCategory?: "fee_reminder" | "birthday" | "admission" | "payment_receipt" | "general";
  initialCustomMessage?: string;
}

export default function WhatsAppModal({
  isOpen,
  onClose,
  recipient,
  defaultTemplateCategory,
  initialCustomMessage
}: WhatsAppModalProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [messageText, setMessageText] = useState<string>("");

  // Load templates from store and initialize on recipient change / open
  useEffect(() => {
    if (!isOpen || !recipient) {
      setSelectedTemplateId("");
      setMessageText("");
      return;
    }

    const availableTemplates = getMessageTemplates();
    setTemplates(availableTemplates);

    if (initialCustomMessage) {
      setMessageText(initialCustomMessage);
      setSelectedTemplateId("");
    } else if (defaultTemplateCategory) {
      const match = availableTemplates.find((t) => t.category === defaultTemplateCategory);
      if (match) {
        setSelectedTemplateId(match.id);
        setMessageText(populateTemplate(match.body, recipient));
      } else {
        setSelectedTemplateId("");
        setMessageText("");
      }
    } else {
      setSelectedTemplateId("");
      setMessageText("");
    }
  }, [isOpen, recipient, defaultTemplateCategory, initialCustomMessage]);

  // Handle template selection change
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value;
    setSelectedTemplateId(templateId);

    if (!templateId) {
      // Empty selection - keep current text or clear
      return;
    }

    const tpl = templates.find((t) => t.id === templateId);
    if (tpl && recipient) {
      const populated = populateTemplate(tpl.body, recipient);
      setMessageText(populated);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !recipient) return null;

  const formattedPhone = formatDisplayPhone(recipient.phone);
  const characterCount = messageText.length;

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    const url = buildWhatsAppUrl(recipient.phone, messageText);
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      id="whatsapp-compose-modal-backdrop"
    >
      <div
        className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all"
        onClick={(e) => e.stopPropagation()}
        id="whatsapp-compose-modal"
      >
        {/* 1. HEADER: Green Gradient Header Bar */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-4 sm:px-5 py-3.5 flex items-center justify-between text-white shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/15 rounded-lg backdrop-blur-xs flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
              Send WhatsApp Message
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Close (Esc)"
            id="whatsapp-modal-close-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* 2. LEAD / RECIPIENT INFO CARD */}
          <div
            className="bg-emerald-950/30 border border-emerald-800/40 border-l-4 border-l-emerald-500 rounded-xl p-3.5 flex items-center gap-3.5 shadow-xs"
            id="whatsapp-lead-info-card"
          >
            {/* Circular Avatar Icon */}
            <div className="h-11 w-11 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <User className="h-6 w-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  {recipient.name || "Recipient"}
                </h3>
                {recipient.registration_number && (
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 rounded font-semibold shrink-0">
                    {recipient.registration_number}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-emerald-300/90 mt-0.5 font-mono">
                <Phone className="h-3 w-3 text-emerald-400 shrink-0" />
                <span>{formattedPhone || recipient.phone}</span>
                {recipient.course_type && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-300 font-sans truncate text-[11px]">
                      {recipient.course_type}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 3. TEMPLATE SELECTOR */}
          <div className="space-y-1.5" id="whatsapp-template-selector-section">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-emerald-400" />
              <span>Select Message Template</span>
            </label>

            <select
              value={selectedTemplateId}
              onChange={handleTemplateChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              id="whatsapp-template-dropdown"
            >
              <option value="">Select a template...</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title}
                </option>
              ))}
            </select>
          </div>

          {/* 4. MESSAGE PREVIEW / EDIT BOX */}
          <div className="space-y-1.5" id="whatsapp-message-preview-section">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-teal-400" />
              <span>Message Preview</span>
            </label>

            <textarea
              rows={6}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message or select a template..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600 min-h-[140px] leading-relaxed resize-y"
              id="whatsapp-message-textarea"
            />

            {/* 5. Helper Note & Live Character Count */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 px-0.5">
              <div className="flex items-center gap-1 text-emerald-400/90 font-medium">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>Customize the message before sending</span>
              </div>
              <span className="font-mono text-slate-500" id="whatsapp-char-count">
                {characterCount} character{characterCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        {/* 6. FOOTER: Cancel and Send Message Buttons */}
        <div
          className="border-t border-slate-800 bg-slate-950/60 px-4 sm:px-5 py-3.5 flex items-center justify-end gap-3 shrink-0"
          id="whatsapp-modal-footer"
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            id="whatsapp-modal-cancel-btn"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!messageText.trim()}
            onClick={handleSendMessage}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            id="whatsapp-modal-send-btn"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send Message</span>
          </button>
        </div>
      </div>
    </div>
  );
}
