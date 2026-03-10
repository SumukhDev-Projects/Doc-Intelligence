/**
 * components/ExportPanel.jsx
 * --------------------------
 * Lets users select extraction results and download them as JSON/CSV/Excel.
 */

import { useState, useEffect } from 'react'
import { Download, CheckSquare, Square, FileText, Loader, FileJson, Table } from 'lucide-react'
import toast from 'react-hot-toast'
import { listResults, exportResults } from '../utils/api'

const FORMAT_OPTIONS = [
  { id: 'json',  label: 'JSON',  desc: 'Nested data structure',     icon: FileJson },
  { id: 'csv',   label: 'CSV',   desc: 'Flat table, Excel-friendly', icon: Table },
  { id: 'excel', label: 'Excel', desc: '.xlsx with auto-sized cols', icon: Table },
]

export default function ExportPanel() {
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [format, setFormat] = useState('csv')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    listResults().then(data => { setResults(data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set())
    else setSelected(new Set(results.map(r => r.id)))
  }

  const toggle = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const handleExport = async () => {
    if (selected.size === 0) { toast.error('Select at least one result'); return }
    setExporting(true)
    try {
      await exportResults([...selected], format)
      toast.success(`Downloaded ${selected.size} result(s) as ${format.toUpperCase()}`)
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader size={24} className="animate-spin text-sky-400" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Export Results</h1>
        <p className="text-gray-400 text-sm mt-1">Download extraction results as JSON, CSV, or Excel.</p>
      </div>

      {/* Format selector */}
      <div className="card">
        <label className="label">Export Format</label>
        <div className="flex gap-3">
          {FORMAT_OPTIONS.map(({ id, label, desc, icon: Icon }) => (
            <button key={id} onClick={() => setFormat(id)}
              className={`flex-1 p-3 rounded-lg border text-left transition-all ${
                format === id ? 'border-sky-500 bg-sky-500/10' : 'border-gray-700 hover:border-gray-600'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className={format === id ? 'text-sky-400' : 'text-gray-500'} />
                <span className={`text-sm font-medium ${format === id ? 'text-sky-400' : 'text-gray-300'}`}>{label}</span>
              </div>
              <p className="text-xs text-gray-600">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Results table */}
      {results.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          No extraction results yet. Run an extraction first.
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={toggleAll} className="btn-ghost text-xs">
              {selected.size === results.length
                ? <><CheckSquare size={14} /> Deselect all</>
                : <><Square size={14} /> Select all</>
              }
            </button>
            <span className="text-xs text-gray-500">{selected.size} selected</span>
          </div>

          <div className="space-y-2">
            {results.map(r => (
              <div key={r.id} onClick={() => toggle(r.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selected.has(r.id)
                    ? 'border-sky-500/40 bg-sky-500/5'
                    : 'border-gray-700/50 hover:border-gray-600'
                }`}>
                {selected.has(r.id)
                  ? <CheckSquare size={16} className="text-sky-400 shrink-0" />
                  : <Square size={16} className="text-gray-600 shrink-0" />
                }
                <FileText size={14} className="text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-mono truncate">{r.id.slice(0, 12)}...</p>
                  <p className="text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleDateString()} •
                    Confidence: {Math.round(r.overall_confidence * 100)}%
                    {r.reviewed && ' • ✓ Reviewed'}
                    {r.needs_review && !r.reviewed && ' • ⚠ Needs review'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={handleExport} disabled={exporting || selected.size === 0}
        className="btn-primary w-full justify-center py-3">
        {exporting ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
        {exporting ? 'Exporting...' : `Export ${selected.size} Result${selected.size !== 1 ? 's' : ''} as ${format.toUpperCase()}`}
      </button>
    </div>
  )
}
