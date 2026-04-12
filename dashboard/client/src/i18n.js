import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translations
const resources = {
  en: {
    translation: {
      "dashboard_title": "CS Dashboard",
      "logout": "Logout",
      "login_title": "CS Dashboard Login",
      "email_label": "Email address",
      "password_label": "Password",
      "login_btn": "Log In",
      "chat_title": "Chat Interface",
      "loading_models": "Loading models...",
      "start_conversation": "Start a conversation...",
      "ask_placeholder": "Ask a question...",
      "send_btn": "Send",
      "invalid_credentials": "Invalid credentials",
      "language": "Language",
      "english": "English",
      "arabic": "عربي",
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
      "llm_recommended": "Recommended Models for CS"
    }
  },
  ar: {
    translation: {
      "dashboard_title": "لوحة تحكم خدمة العملاء",
      "logout": "تسجيل خروج",
      "login_title": "تسجيل الدخول",
      "email_label": "البريد الإلكتروني",
      "password_label": "كلمة المرور",
      "login_btn": "تسجيل الدخول",
      "chat_title": "واجهة المحادثة",
      "loading_models": "جاري تحميل النماذج...",
      "start_conversation": "ابدأ محادثة...",
      "ask_placeholder": "اسأل سؤالاً...",
      "send_btn": "إرسال",
      "invalid_credentials": "بيانات الدخول غير صحيحة",
      "language": "اللغة",
      "english": "English",
      "arabic": "عربي",
      "llm_manager_title": "إدارة النماذج (LLM)",
      "llm_manager_desc": "إدارة، مراقبة، وتنزيل نماذج Ollama المحلية.",
      "llm_installed_tab": "النماذج المثبتة",
      "llm_running_tab": "النماذج قيد التشغيل (VRAM)",
      "llm_pull_tab": "تنزيل نماذج جديدة",
      "llm_no_installed": "لا توجد نماذج مثبتة. اذهب إلى نافذة التنزيل لجلب واحد.",
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
      "llm_recommended": "نماذج مقترحة لخدمة العملاء"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
