import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // ── App-level (overridden at runtime by /api/config/public) ──────────
      "app_name": "AI Customer Service",
      "app_tagline": "Powered by local AI",

      // ── Auth ─────────────────────────────────────────────────────────────
      "logout": "Logout",
      "login_title": "Sign In",
      "email_label": "Username",
      "password_label": "Password",
      "login_btn": "Log In",
      "invalid_credentials": "Invalid credentials",

      // ── Nav ──────────────────────────────────────────────────────────────
      "nav_chat": "Chat",
      "nav_documents": "Documents",
      "nav_knowledge": "Knowledge Base",
      "nav_channels": "Channels",
      "nav_llm": "LLM Manager",
      "nav_monitoring": "Monitoring",
      "nav_settings": "Settings",
      "nav_terminal": "Server Terminal",

      // ── Chat ─────────────────────────────────────────────────────────────
      "chat_title": "Chat Interface",
      "loading_models": "Loading models...",
      "start_conversation": "Start a conversation...",
      "ask_placeholder": "Ask a question...",
      "send_btn": "Send",

      // ── LLM Manager ──────────────────────────────────────────────────────
      "llm_manager_title": "LLM Manager",
      "llm_manager_desc": "Manage, monitor, and pull local Ollama models.",
      "llm_installed_tab": "Installed Server Models",
      "llm_running_tab": "Running in VRAM",
      "llm_pull_tab": "Pull New Models",
      "llm_no_installed": "No models installed. Go to Pull models to fetch one.",
      "llm_size": "Size",
      "llm_family": "Family",
      "llm_parameters": "Parameters",
      "llm_running_desc": "Models actively loaded into memory (RAM/VRAM).",
      "llm_running_subdesc": "If idle, Ollama unloads them automatically after 5 minutes.",
      "llm_no_running": "No models currently loaded in memory.",
      "llm_vram": "VRAM:",
      "llm_total": "Total:",
      "llm_pull_title": "Pull Model from Ollama Registry",
      "llm_pull_placeholder": "e.g. llama3, mistral, aya-expanse:32b",
      "llm_pull_button": "Pull Model",
      "llm_recommended": "Recommended Models for CS",

      // ── Documents ────────────────────────────────────────────────────────
      "docs_title": "Documents Manager",
      "docs_desc": "Upload and manage documents for RAG (Retrieval-Augmented Generation).",
      "docs_upload_btn": "Upload Document",
      "docs_table_name": "Filename",
      "docs_table_chunks": "Chunks",
      "docs_table_date": "Ingested At",
      "docs_no_files": "No documents ingested yet.",

      // ── Knowledge Base ───────────────────────────────────────────────────
      "kb_title": "Knowledge Base",
      "kb_desc": "Manually teach the AI specific problem-solution rules.",
      "kb_add_solution": "Add New Rule",
      "kb_problem_label": "Problem / Question",
      "kb_solution_label": "Target Solution / Answer",
      "kb_lang_label": "Language",
      "kb_save_btn": "Save Rule",
      "kb_table_problem": "Problem",
      "kb_table_solution": "Solution",
      "kb_no_solutions": "No learned solutions yet.",

      // ── Channel Bridge (was OpenClaw) ─────────────────────────────────────
      "bridge_title": "Channel Bridge",
      "bridge_desc": "Manage WhatsApp, Telegram, and ClickUp integrations.",
      "bridge_status_tab": "Status",
      "bridge_config_tab": "Configuration",
      "bridge_history_tab": "Live Conversations",
      "bridge_console_tab": "Console",
      "bridge_wa_status": "WhatsApp Status",
      "bridge_tg_status": "Telegram Status",
      "bridge_wa_reset_btn": "Reset WhatsApp Session",
      "bridge_clickup_title": "ClickUp Integration",
      "bridge_clickup_token": "API Token",
      "bridge_clickup_team": "Team ID (Workspace)",
      "bridge_clickup_list": "List ID",
      "bridge_save_config": "Save Settings",
      "bridge_tg_token": "Telegram Bot Token",

      // ── Terminal ─────────────────────────────────────────────────────────
      "terminal_title": "Server Terminal",
      "terminal_desc": "Direct shell access to the server. Super Admin only.",
      "terminal_warning": "This terminal provides full shell access to the server. Every command runs directly on the host. Use with extreme caution.",
    }
  },
  ar: {
    translation: {
      // ── App-level ────────────────────────────────────────────────────────
      "app_name": "خدمة العملاء بالذكاء الاصطناعي",
      "app_tagline": "مدعوم بالذكاء الاصطناعي المحلي",

      // ── Auth ─────────────────────────────────────────────────────────────
      "logout": "تسجيل خروج",
      "login_title": "تسجيل الدخول",
      "email_label": "اسم المستخدم",
      "password_label": "كلمة المرور",
      "login_btn": "دخول",
      "invalid_credentials": "بيانات الدخول غير صحيحة",

      // ── Nav ──────────────────────────────────────────────────────────────
      "nav_chat": "المحادثة",
      "nav_documents": "المستندات",
      "nav_knowledge": "قاعدة المعرفة",
      "nav_channels": "القنوات",
      "nav_llm": "إدارة النماذج",
      "nav_monitoring": "المراقبة",
      "nav_settings": "الإعدادات",
      "nav_terminal": "سطر الأوامر",

      // ── Chat ─────────────────────────────────────────────────────────────
      "chat_title": "واجهة المحادثة",
      "loading_models": "جاري تحميل النماذج...",
      "start_conversation": "ابدأ محادثة...",
      "ask_placeholder": "اسأل سؤالاً...",
      "send_btn": "إرسال",

      // ── LLM Manager ──────────────────────────────────────────────────────
      "llm_manager_title": "إدارة النماذج (LLM)",
      "llm_manager_desc": "إدارة، مراقبة، وتنزيل نماذج Ollama المحلية.",
      "llm_installed_tab": "النماذج المثبتة",
      "llm_running_tab": "النماذج قيد التشغيل",
      "llm_pull_tab": "تنزيل نماذج جديدة",
      "llm_no_installed": "لا توجد نماذج مثبتة.",
      "llm_size": "الحجم",
      "llm_family": "العائلة",
      "llm_parameters": "المُعلمات",
      "llm_running_desc": "النماذج المحملة حالياً في الذاكرة النشطة.",
      "llm_running_subdesc": "في حالة الخمول، يتم تفريغ الذاكرة تلقائياً بعد 5 دقائق.",
      "llm_no_running": "لا توجد نماذج محملة في الذاكرة حالياً.",
      "llm_vram": "ذاكرة الفيديو:",
      "llm_total": "الإجمالي:",
      "llm_pull_title": "تنزيل نموذج من خوادم Ollama",
      "llm_pull_placeholder": "مثال: llama3, mistral, aya-expanse:32b",
      "llm_pull_button": "تنزيل النموذج",
      "llm_recommended": "نماذج مقترحة لخدمة العملاء",

      // ── Documents ────────────────────────────────────────────────────────
      "docs_title": "إدارة المستندات",
      "docs_desc": "رفع وإدارة المستندات لاستخدامها في توليد الإجابات المعززة (RAG).",
      "docs_upload_btn": "رفع مستند",
      "docs_table_name": "اسم الملف",
      "docs_table_chunks": "عدد الأجزاء",
      "docs_table_date": "تاريخ المعالجة",
      "docs_no_files": "لا توجد مستندات معالجة بعد.",

      // ── Knowledge Base ───────────────────────────────────────────────────
      "kb_title": "قاعدة المعرفة",
      "kb_desc": "تعليم الذكاء الاصطناعي يدوياً قواعد المشكلة-الحل.",
      "kb_add_solution": "إضافة قاعدة جديدة",
      "kb_problem_label": "المشكلة / السؤال",
      "kb_solution_label": "الحل المستهدف",
      "kb_lang_label": "اللغة",
      "kb_save_btn": "حفظ القاعدة",
      "kb_table_problem": "المشكلة",
      "kb_table_solution": "الحل",
      "kb_no_solutions": "لا توجد حلول متعلمة بعد.",

      // ── Channel Bridge ────────────────────────────────────────────────────
      "bridge_title": "جسر القنوات",
      "bridge_desc": "إدارة تكامل واتساب، تيليجرام، وClickUp.",
      "bridge_status_tab": "الحالة",
      "bridge_config_tab": "الإعدادات",
      "bridge_history_tab": "المحادثات المباشرة",
      "bridge_console_tab": "وحدة التحكم",
      "bridge_wa_status": "حالة واتساب",
      "bridge_tg_status": "حالة تيليجرام",
      "bridge_wa_reset_btn": "إعادة ضبط جلسة واتساب",
      "bridge_clickup_title": "تكامل ClickUp",
      "bridge_clickup_token": "مفتاح API",
      "bridge_clickup_team": "رقم الفريق",
      "bridge_clickup_list": "رقم القائمة",
      "bridge_save_config": "حفظ الإعدادات",
      "bridge_tg_token": "مفتاح بوت تيليجرام",

      // ── Terminal ─────────────────────────────────────────────────────────
      "terminal_title": "سطر أوامر الخادم",
      "terminal_desc": "وصول مباشر إلى سطر أوامر الخادم. للمسؤول العام فقط.",
      "terminal_warning": "يوفر هذا الطرفية وصولاً كاملاً إلى الخادم. استخدم بحذر شديد.",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });

export default i18n;
