/**
 * components/ExtractPanel.jsx
 * ---------------------------
 * The core extraction UI: pick a document, pick a schema, run AI extraction.
 * Shows per-field results with color-coded confidence scores.
 *
 * CONFIDENCE COLOR CODING:
 *   Green  (≥ 0.85) — high confidence, likely correct
 *   Yellow (0.65-0.84) — medium confidence, worth checking
 *   Red    (< 0.65) — low confidence, flagged for review
 */

import { useState, useEffect } from 'react'
import { Zap, FileText, Database, ChevronDown, Loader, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { listDocuments, listSchemas, runExtraction } from '../utils/api'

const ConfidenceBadge = ({ score }) => {
  const pct = Math.round(score * 100)
  const color = score >= 0.85 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : score >= 0.65 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-red-400 bg-red-500/10 border-red-500/30'
  return (
    <span className={`badge border ${color} font-mono text-xs`}>{pct}%</span>
  )
}

const ConfidenceBar = ({ score }) => {
  const pct = score * 100
  const color = score >= 0.85 ? 'bg-emerald-500' : score >= 0.65 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="w-full bg-gray-800 rounded-full h-1 mt-1">
      <div className={`h-1 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function ExtractPanel() {
  const [documents, setDocuments] = useState([])
  const [schemas, setSchemas] = useState([])
  const [selectedDoc, setSelectedDoc] = useState('')
  const [selectedSchema, setSelectedSchema] = useState('')
  const [threshold, setThreshold] = useState(0.75)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    listDocuments().then(setDocuments).catch(() => {})
    listSchemas().then(setSchemas).catch(() => {})
  }, [])

  const handleExtract = async () => {
    if (!selectedDoc || !selectedSchema) {
      toast.error('Select a document and schema first')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await runExtraction(selectedDoc, selectedSchema, threshold)
      setResult(res)
      if (res.needs_review) {
        toast('Extraction complete — some fields flagged for review', { icon: '⚠️' })
      } else {
        toast.success('Extraction complete!')
      }
    } catch (e) {
      toast.error('Extraction failed: ' + (e.response?.data?.detail || e.message))
    } finally {
      setLoading(false)
    }
  }

  const overallPct = result ? Math.round(result.overall_confidence * 100) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Run Extraction</h1>
        <p className="text-gray-400 text-sm mt-1">Select a document and schema, then let the AI extract structured data.</p>
      </div>

      {/* Config panel */}
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Document</label>
            <select className="input" value={selectedDoc} onChange={e => setSelectedDoc(e.target.value)}>
              <option value="">— Select a document —</option>
              {documents.map(d => (
                <option key={d.id} value={d.id}>{d.filename}</option>
              ))}
            </select>
            {documents.length === 0 && (
              <p className="text-xs text-amber-400 mt-1">No documents yet — upload one first</p>
            )}
          </div>

          <div>
            <label className="label">Extraction Schema</label>
            <select className="input" value={selectedSchema} onChange={e => setSelectedSchema(e.target.value)}>
              <option value="">— Select a schema —</option>
              {schemas.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {schemas.length === 0 && (
              <p className="text-xs text-amber-400 mt-1">No schemas yet — create one first</p>
            )}
          </div>
        </div>

        <div>
          <label className="label">
            Review Threshold: <span className="text-sky-400">{Math.round(threshold * 100)}%</span>
            <span className="text-gray-600 ml-1">— fields below this confidence get flagged for human review</span>
          </label>
          <input type="range" min="0.5" max="0.95" step="0.05"
            value={threshold} onChange={e => setThreshold(parseFloat(e.target.value))}
            className="w-full accent-sky-500 mt-1" />
          <div className="flex justify-between text-xs text-gray-600 mt-0.5">
            <span>50% (lenient)</span><span>95% (strict)</span>
          </div>
        </div>

        <button onClick={handleExtract} disabled={loading || !selectedDoc || !selectedSchema}
          className="btn-primary w-full justify-center py-3">
          {loading
            ? <><Loader size={16} className="animate-spin" /> Running AI Extraction...</>
            : <><Zap size={16} /> Extract Data</>
          }
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div className="card flex flex-col items-center gap-3 py-12">
          <Loader size={32} className="text-sky-400 animate-spin" />
          <p className="text-gray-400">Calling Claude 3.5 Sonnet...</p>
          <p className="text-xs text-gray-600">Running 2-pass extraction with confidence scoring</p>
        </div>
      )}

      {result && !loading && (
        <div className="card space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Extraction Results</h2>
            <div className="flex items-center gap-3">
              {result.needs_review
                ? <span className="badge bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <AlertTriangle size={12} /> Needs Review
                  </span>
                : <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle size={12} /> High Confidence
                  </span>
              }
              <span className="text-xs text-gray-500">{result.processing_time_ms}ms</span>
            </div>
          </div>

          {/* Overall confidence */}
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <div className="text-2xl font-bold text-white">{overallPct}%</div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Overall Confidence</p>
              <ConfidenceBar score={result.overall_confidence} />
            </div>
            <div className="text-xs text-gray-600 text-right">
              <div>{result.model_used?.split('-').slice(0,3).join('-')}</div>
            </div>
          </div>

          {/* Per-field results */}
          <div className="space-y-2">
            {Object.entries(result.extracted_data || {}).map(([field, value]) => {
              const conf = result.confidence_scores?.[field] ?? 0
              return (
                <div key={field}
                  className={`p-3 rounded-lg border ${
                    conf < 0.65 ? 'border-red-500/30 bg-red-500/5'
                    : conf < 0.85 ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-gray-700/50 bg-gray-800/30'
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-400">{field}</span>
                    <ConfidenceBadge score={conf} />
                  </div>
                  <p className="text-sm text-white font-medium">
                    {value === null || value === undefined
                      ? <span className="text-gray-600 italic">not found</span>
                      : Array.isArray(value)
                        ? value.join(', ')
                        : String(value)
                    }
                  </p>
                  <ConfidenceBar score={conf} />
                </div>
              )
            })}
          </div>

          {result.needs_review && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-300">
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>Some fields have low confidence — go to the Review tab to correct them.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
