import { useState } from 'react';
import { setMetaDescription, setPageTitle } from './lib/seo';

// Questions and answers shown on /faq. Edit this list to change the content.
const FAQS: { q: string; a: string }[] = [
  {
    q: 'What are your opening hours?',
    a: 'Hours vary by branch. Open the Branches page to see each branch’s hours, or use "Open now" to filter.',
  },
  {
    q: 'How do I find the nearest branch?',
    a: 'Use the Map page to see every branch, or allow location on the Home page to see the nearest one.',
  },
  {
    q: 'Do you have allergen information?',
    a: 'Products with dietary tags (Vegan, Gluten-Free, Dairy-Free) are marked on the menu. For other allergens, please ask our staff before ordering.',
  },
  {
    q: 'How does the loyalty card work?',
    a: 'Sign up with your phone number on the Loyalty page. Collect 10 stamps and your next drink is on us. Show your card to staff when you order; they add one stamp per order.',
  },
  {
    q: 'Can I order ahead?',
    a: 'Ordering online is coming soon. For now, please order at the branch or call the branch using the number on its page.',
  },
  {
    q: 'How do I scan a branch QR code?',
    a: 'Open the camera scanner from the Home page and point it at the branch’s QR code. It opens that branch’s menu.',
  },
  {
    q: 'How can I give feedback?',
    a: 'Use the Feedback page to rate your visit and leave a short comment for the branch.',
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);
  setPageTitle('FAQ');
  setMetaDescription('Answers to common questions about Milestones Coffee branches, menu, loyalty card and more.');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Frequently asked questions</h1>
      <div className="space-y-2">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} className="bg-white rounded-xl shadow-sm">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full text-left px-4 py-3 font-semibold flex justify-between items-center gap-3"
              >
                <span>{item.q}</span>
                <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && <p className="px-4 pb-4 text-gray-700">{item.a}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
