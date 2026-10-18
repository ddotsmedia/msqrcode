// Run: node --experimental-strip-types src/lib/drinkQuiz.test.ts
import { recommend } from './drinkQuiz.ts';

const menu = [
  { id: '1', name: 'Espresso', category: 'Espresso' },
  { id: '2', name: 'Latte', category: 'Coffee' },
  { id: '3', name: 'Iced Latte', category: 'Cold Beverages' },
  { id: '4', name: 'Spanish Latte', category: 'Coffee' },
  { id: '5', name: 'Green Tea', category: 'Tea' },
  { id: '6', name: 'Hot Chocolate', category: 'Coffee' },
  { id: '7', name: 'Croissant', category: 'Pastries & Food' },
  { id: '8', name: 'Iced Caramel Frappe', category: 'Cold Beverages' },
];
const names = (r: { name: string }[]) => r.map((x) => x.name);
const check = (ok: boolean, what: string) => {
  if (!ok) throw new Error(`Failed: ${what}`);
};

check(names(recommend(menu, 'hot', 'bold', 'high'))[0] === 'Espresso', 'hot + bold + high gives espresso');
check(names(recommend(menu, 'iced', 'sweet', 'some'))[0] === 'Iced Caramel Frappe', 'iced + sweet gives a frappe');
const none = names(recommend(menu, 'hot', 'sweet', 'none'));
check(none[0] === 'Hot Chocolate' && !none.includes('Espresso'), 'no caffeine avoids coffee');
check(!names(recommend(menu, 'any', 'milky', 'some')).includes('Croissant'), 'never suggests food');
check(names(recommend(menu, 'hot', 'light', 'some'))[0] === 'Green Tea', 'light gives tea');

console.log('✅ All drink quiz tests passed');
