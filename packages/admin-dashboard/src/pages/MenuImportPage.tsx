import { useState, ChangeEvent } from 'react';

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  not_in_file: string[];
}

export default function MenuImportPage({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  }

  async function doImport(dryRun: boolean) {
    if (!file) {
      setError('Select a file first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/admin/menu/import?dry_run=${dryRun}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ImportResult;
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function downloadTemplate() {
    try {
      const res = await fetch('/api/admin/menu/template.xlsx', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'menu-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    }
  }

  async function downloadExport() {
    try {
      const res = await fetch('/api/admin/menu/export.xlsx', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'menu-export.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</p>}

      <section className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <h2 className="font-semibold text-gray-800">Import Menu</h2>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileChange}
            className="flex-1 border border-gray-300 rounded px-3 py-2"
          />
          <button
            onClick={() => doImport(true)}
            disabled={!file || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded font-semibold disabled:opacity-60"
          >
            {loading ? 'Loading...' : 'Preview'}
          </button>
          {result && (
            <button
              onClick={() => doImport(false)}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded font-semibold disabled:opacity-60"
            >
              {loading ? 'Applying...' : 'Apply'}
            </button>
          )}
        </div>
      </section>

      {result && (
        <section className="bg-white rounded-lg shadow-sm p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">Results</h3>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="bg-green-50 p-2 rounded">
              <p className="text-green-700 font-semibold">{result.created}</p>
              <p className="text-green-600">Created</p>
            </div>
            <div className="bg-blue-50 p-2 rounded">
              <p className="text-blue-700 font-semibold">{result.updated}</p>
              <p className="text-blue-600">Updated</p>
            </div>
            <div className="bg-yellow-50 p-2 rounded">
              <p className="text-yellow-700 font-semibold">{result.skipped}</p>
              <p className="text-yellow-600">Skipped</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 p-2 rounded">
              <p className="font-semibold text-red-700 text-sm mb-2">Errors ({result.errors.length})</p>
              <ul className="text-sm text-red-600 space-y-1">
                {result.errors.map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.not_in_file.length > 0 && (
            <div className="bg-gray-50 p-2 rounded">
              <p className="font-semibold text-gray-700 text-sm mb-2">Not in file ({result.not_in_file.length})</p>
              <p className="text-sm text-gray-600">These products exist in the database but were not in the import file:</p>
              <ul className="text-sm text-gray-600 mt-1 max-h-32 overflow-y-auto">
                {result.not_in_file.slice(0, 20).map((name) => (
                  <li key={name}>• {name}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="bg-white rounded-lg shadow-sm p-4 space-y-2">
        <h3 className="font-semibold text-gray-800">Tools</h3>
        <button
          onClick={downloadTemplate}
          className="w-full px-4 py-2 bg-gray-600 text-white rounded font-semibold hover:bg-gray-700"
        >
          Download template
        </button>
        <button
          onClick={downloadExport}
          className="w-full px-4 py-2 bg-gray-600 text-white rounded font-semibold hover:bg-gray-700"
        >
          Export current menu
        </button>
      </section>
    </div>
  );
}
