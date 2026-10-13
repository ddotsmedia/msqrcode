import { t } from '../i18n';

interface Branch {
  phone?: string;
  whatsapp_number?: string;
  google_maps_url?: string;
  google_review_url?: string;
  delivery_links?: Record<string, string>;
}

export function ContactButtons({ branch }: { branch: Branch | null }) {
  if (!branch) return null;

  const buttons = [];

  if (branch.phone) {
    buttons.push(
      <a key="call" href={`tel:+${branch.phone}`} className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700">
        {t('call')}
      </a>
    );
  }

  if (branch.whatsapp_number) {
    buttons.push(
      <a key="wa" href={`https://wa.me/${branch.whatsapp_number}`} target="_blank" rel="noopener noreferrer" className="flex-1 px-3 py-2 bg-green-500 text-white rounded text-sm font-semibold hover:bg-green-600">
        {t('whatsapp')}
      </a>
    );
  }

  if (branch.google_maps_url) {
    buttons.push(
      <a key="maps" href={branch.google_maps_url} target="_blank" rel="noopener noreferrer" className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700">
        {t('directions')}
      </a>
    );
  }

  if (branch.google_review_url) {
    buttons.push(
      <a key="review" href={branch.google_review_url} target="_blank" rel="noopener noreferrer" className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded text-sm font-semibold hover:bg-yellow-700">
        {t('review')}
      </a>
    );
  }

  if (branch.delivery_links) {
    Object.entries(branch.delivery_links).forEach(([provider, url]) => {
      buttons.push(
        <a key={provider} href={url} target="_blank" rel="noopener noreferrer" className="flex-1 px-3 py-2 bg-brand-600 text-white rounded text-sm font-semibold hover:bg-brand-700">
          {provider}
        </a>
      );
    });
  }

  return buttons.length > 0 ? (
    <div className="flex gap-2 flex-wrap mb-4" aria-label="Contact and delivery options">
      {buttons}
    </div>
  ) : null;
}
