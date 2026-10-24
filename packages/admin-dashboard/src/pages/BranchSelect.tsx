import { useEffect, useState } from 'react';
import { api } from '../api';

// Branch dropdown for the analytics panels. Empty value = all branches.
export default function BranchSelect({ token, value, onChange }: { token: string; value: string; onChange: (id: string) => void }) {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let live = true;
    api<{ id: string; name: string }[]>('/branches', token)
      .then((list) => live && setBranches(list))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [token]);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white" aria-label="Branch">
      <option value="">All branches</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
