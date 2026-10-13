export const i18n = {
  en: {
    call: 'Call',
    whatsapp: 'WhatsApp',
    directions: 'Directions',
    review: 'Review',
    delivery: 'Delivery',
    share: 'Share',
    linkCopied: 'Link copied',
    openNow: 'Open now',
    closed: 'Closed',
    opensAt: 'Opens at',
    hours: 'Hours',
    today: 'Today',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  },
  ar: {
    call: 'اتصل',
    whatsapp: 'واتساب',
    directions: 'الاتجاهات',
    review: 'تقييم',
    delivery: 'توصيل',
    share: 'شارك',
    linkCopied: 'تم نسخ الرابط',
    openNow: 'مفتوح الآن',
    closed: 'مغلق',
    opensAt: 'يفتح الساعة',
    hours: 'ساعات العمل',
    today: 'اليوم',
    monday: 'الاثنين',
    tuesday: 'الثلاثاء',
    wednesday: 'الأربعاء',
    thursday: 'الخميس',
    friday: 'الجمعة',
    saturday: 'السبت',
    sunday: 'الأحد',
  },
};

export type Language = 'en' | 'ar';

export function t(key: keyof typeof i18n.en, lang: Language = 'en'): string {
  return i18n[lang][key] || i18n.en[key];
}
