import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'ar';

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    loadingMenu: 'Loading menu...',
    changeBranch: '← Change Branch',
    searchPlaceholder: 'Search products...',
    availableOnly: 'Available Only',
    noProducts: 'No products found matching your filters.',
    loyaltyTitle: 'Join our loyalty card',
    loyaltyName: 'Name (optional)',
    loyaltyPhone: 'Phone number',
    loyaltyCreate: 'Create my card',
    loyaltyCreating: 'Creating…',
    loyaltyCardTitle: 'Loyalty card',
    loyaltyStamps: 'stamps. Show this to staff to add a stamp.',
    feedbackThanks: 'Thank you for your feedback!',
    feedbackQuestion: 'How was your visit?',
    feedbackPlaceholder: 'Tell us more (optional)',
    feedbackError: 'Could not send. Try again.',
    send: 'Send',
    sending: 'Sending…',
    language: 'العربية',
    call: 'Call',
    whatsapp: 'WhatsApp',
    directions: 'Directions',
    review: 'Review',
    delivery: 'Delivery',
  },
  ar: {
    loadingMenu: 'جارٍ تحميل القائمة...',
    changeBranch: 'تغيير الفرع →',
    searchPlaceholder: 'ابحث عن منتج...',
    availableOnly: 'المتوفر فقط',
    noProducts: 'لا توجد منتجات تطابق البحث.',
    loyaltyTitle: 'انضم إلى بطاقة الولاء',
    loyaltyName: 'الاسم (اختياري)',
    loyaltyPhone: 'رقم الهاتف',
    loyaltyCreate: 'أنشئ بطاقتي',
    loyaltyCreating: 'جارٍ الإنشاء…',
    loyaltyCardTitle: 'بطاقة الولاء',
    loyaltyStamps: 'ختم. أظهر هذه الشاشة للموظف لإضافة ختم.',
    feedbackThanks: 'شكراً على ملاحظاتك!',
    feedbackQuestion: 'كيف كانت زيارتك؟',
    feedbackPlaceholder: 'أخبرنا المزيد (اختياري)',
    feedbackError: 'تعذّر الإرسال. حاول مرة أخرى.',
    send: 'إرسال',
    sending: 'جارٍ الإرسال…',
    language: 'English',
    call: 'اتصل',
    whatsapp: 'واتساب',
    directions: 'الاتجاهات',
    review: 'تقييم',
    delivery: 'توصيل',
  },
};

const KEY = 'milestones_lang';

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }>({
  lang: 'en',
  setLang: () => undefined,
  t: (k) => STRINGS.en[k] ?? k,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  function setLang(l: Lang) {
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* storage unavailable: keep for this page only */
    }
    setLangState(l);
  }

  const t = (k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k;
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
