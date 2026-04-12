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
      "arabic": "عربي"
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
      "arabic": "عربي"
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
