import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isNative, setupDeepLinks, setupPush, updateNeeded } from './lib/native';

// App only: push, links that open in the app, and the "please update" screen. Renders nothing on the website.
export default function NativeBridge() {
  const navigate = useNavigate();
  const [update, setUpdate] = useState<string | null>(null);
  useEffect(() => {
    if (!isNative) return;
    const go = (path: string) => navigate(path);
    setupDeepLinks(go).catch(() => undefined);
    setupPush(go).catch(() => undefined);
    updateNeeded()
      .then(setUpdate)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (update === null) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-900/90 p-6 text-center text-white">
      <div>
        <p className="font-display text-3xl">Please update the app</p>
        <p className="mt-2 text-brand-100">This version is too old for ordering. The new one takes a minute to install.</p>
        {update && (
          <a href={update} className="mt-6 inline-block rounded-full bg-copper-500 px-6 py-3 font-semibold">
            Update now
          </a>
        )}
      </div>
    </div>
  );
}
