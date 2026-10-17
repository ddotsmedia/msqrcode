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
    loyaltyReady: 'Your free drink is ready! Show this screen to staff to redeem it.',
    loyaltyToGo: '{n} more stamps for your free drink.',
    loyaltyRedeemed: 'Free drinks redeemed: {n}',
    loyaltyReward: 'Reward: {r}',
    loyaltyActivity: 'Recent activity',
    loyaltyEvEnroll: 'Card created',
    loyaltyEvStamp: 'Stamp added',
    loyaltyEvRedeem: 'Reward redeemed',
    loyaltyEvAdjust: 'Stamps updated',
    loyaltyEvBonus: 'Bonus stamps',
    loyaltyBirthday: 'Birthday (optional, for a birthday bonus)',
    loyaltyShowQr: 'Show this code to staff to add a stamp.',
    loyaltyDoubleNow: 'Double stamps now! Each visit earns 2 stamps.',
    loyaltySelfAdded: '{n} stamp(s) added at {b}. Enjoy your coffee!',
    loyaltySelfJoin: 'Create your card below, then scan the counter code again to collect your stamp.',
    loyaltySelfAdding: 'Adding your stamp…',
    loyaltyInvite: 'Invite a friend',
    loyaltyInviteText: 'You both get {n} bonus stamp(s) after your friend\'s first visit.',
    loyaltyShare: 'Share invite link',
    loyaltyCopied: 'Link copied',
    loyaltyAddBirthday: 'Add your birthday to get a birthday bonus',
    loyaltySave: 'Save',
    loyaltyJoinedRef: 'You are joining with a friend\'s invite.',
    feedbackThanks: 'Thank you for your feedback!',
    feedbackQuestion: 'How was your visit?',
    feedbackPlaceholder: 'Tell us more (optional)',
    feedbackError: 'Could not send. Try again.',
    send: 'Send',
    sending: 'Sending…',
    language: 'العربية',
    call: 'Call',
    whatsapp: 'WhatsApp',
    tableLabel: 'Table',
    tableCallStaff: 'Call staff',
    tableBill: 'Ask for bill',
    tableWhatsapp: 'Order on WhatsApp',
    tableStaffSent: 'Staff notified. Someone is coming to table {t}.',
    tableBillSent: 'Bill requested for table {t}.',
    tableDone: 'A team member has seen your request.',
    tableAgain: 'New request',
    tableError: 'Could not reach staff. Please wave to a team member.',
    tableOrderIntro: "I'd like to order:",
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
    loyaltyReady: 'مشروبك المجاني جاهز! أظهر هذه الشاشة للموظف لاستبداله.',
    loyaltyToGo: 'باقي {n} أختام للحصول على مشروبك المجاني.',
    loyaltyRedeemed: 'مشروبات مجانية مستلمة: {n}',
    loyaltyReward: 'المكافأة: {r}',
    loyaltyActivity: 'آخر النشاطات',
    loyaltyEvEnroll: 'تم إنشاء البطاقة',
    loyaltyEvStamp: 'تمت إضافة ختم',
    loyaltyEvRedeem: 'تم استبدال المكافأة',
    loyaltyEvAdjust: 'تم تعديل الأختام',
    loyaltyEvBonus: 'أختام إضافية',
    loyaltyBirthday: 'تاريخ الميلاد (اختياري، لمكافأة عيد الميلاد)',
    loyaltyShowQr: 'أظهر هذا الرمز للموظف لإضافة ختم.',
    loyaltyDoubleNow: 'أختام مضاعفة الآن! كل زيارة تمنحك ختمين.',
    loyaltySelfAdded: 'تمت إضافة {n} ختم في {b}. استمتع بقهوتك!',
    loyaltySelfJoin: 'أنشئ بطاقتك أدناه، ثم امسح رمز الكاونتر مرة أخرى للحصول على ختمك.',
    loyaltySelfAdding: 'جارٍ إضافة ختمك…',
    loyaltyInvite: 'ادعُ صديقاً',
    loyaltyInviteText: 'تحصلان معاً على {n} ختم إضافي بعد أول زيارة لصديقك.',
    loyaltyShare: 'مشاركة رابط الدعوة',
    loyaltyCopied: 'تم نسخ الرابط',
    loyaltyAddBirthday: 'أضف تاريخ ميلادك لتحصل على مكافأة عيد الميلاد',
    loyaltySave: 'حفظ',
    loyaltyJoinedRef: 'أنت تنضم بدعوة من صديق.',
    feedbackThanks: 'شكراً على ملاحظاتك!',
    feedbackQuestion: 'كيف كانت زيارتك؟',
    feedbackPlaceholder: 'أخبرنا المزيد (اختياري)',
    feedbackError: 'تعذّر الإرسال. حاول مرة أخرى.',
    send: 'إرسال',
    sending: 'جارٍ الإرسال…',
    language: 'English',
    call: 'اتصل',
    whatsapp: 'واتساب',
    tableLabel: 'طاولة',
    tableCallStaff: 'نداء الموظف',
    tableBill: 'طلب الفاتورة',
    tableWhatsapp: 'اطلب عبر واتساب',
    tableStaffSent: 'تم إبلاغ الموظفين. أحدهم في الطريق إلى الطاولة {t}.',
    tableBillSent: 'تم طلب الفاتورة للطاولة {t}.',
    tableDone: 'رأى أحد الموظفين طلبك.',
    tableAgain: 'طلب جديد',
    tableError: 'تعذر الوصول إلى الموظفين. يرجى التلويح لأحد أعضاء الفريق.',
    tableOrderIntro: 'أود أن أطلب:',
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
