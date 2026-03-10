/**
 * components/ReviewQueue.jsx
 * ---------------------------
 * Human-in-the-loop review for low-confidence extractions.
 * Shows flagged extractions with editable fields.
 * Corrected values are stored separately from AI values in the DB.
 */

import { useState, useEffect } from 'react'
import { ClipboardCheck, CheckCircle, AlertTriangle, Loader, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { listResults, submitReview } from '../utils/api'

const ConfBadge = ({ score }) => {
  const pct = Math.round(score * 100)
  const color = score >= 0.85 ? 'text-emerald-400' : score >= 0.65 ? 'text-amber-400' : 'text-red-400'
  return <span className={`text-xs font-mono ${color}`}>{pct}%</span>
}

function ReviewCard({ result, onReviewed }) {
  const [expanded, setExpanded] = useState(true)
  const [values, setValues] = useState(
    Object.fromEntries(
      Object.entries(result.extracted_data || {}).map(([k, v]) => [k, v ?? ''])
    )
  )
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await submitReview(result.id, values)
      toast.success('Review submitted!')
      onReviewed(result.id)
    } catch {
      toast.error('Failed to submit review')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card border-amber-500/20">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <AlertTriangle size={16} className="text-amber-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Result ID: {result.id.slice(0, 8)}...</p>
          <p className="text-xs text-gray-500">
            Overall confidence: {Math.round(result.overall_confidence * 100)}% •
            {Object.entries(result.confidence_scores || {}).filter(([_, v]) => v < 0.75).length} low-confidence fields
          </p>
        </div>
        {expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500">Edit any incorrect values, then click Approve:</p>
          {Object.entries(result.extracted_data || {}).map(([field, aiValue]) => {
            const conf = result.confidence_scores?.[field] ?? 0
            const isLow = conf < 0.75
            return (
              <div key={field}
                className={`p-3 rounded-lg border ${isLow ? 'border-amber-500/40 bg-amber-500/5' : 'border-gray-700/50 bg-gray-800/30'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono text-gray-400">{field}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">AI: </span>
                    <ConfBadge score={conf} />
                    {isLow && <span className="badge bg-amber-500/20 text-amber-400 text-xs">review</span>}
                  </div>
                </div>
                <input
                  className="input text-sm"
                  value={values[field] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [field]: e.target.value }))}
                  placeholder={isLow ? 'Correct this value...' : 'Looks correct — edit if needed'}
                />
              </div>
            )
          })}

          <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full justify-center">
            {saving ? <Loader size={15} className="animate-spin" /> : <CheckCircle size={15} />}
            {saving ? 'Saving...' : 'Approve & Submit Review'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ReviewQueue() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const data = await listResults(true) // only needs_review=true
      setResults(data.filter(r => !r.reviewed))
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleReviewed = (id) => setResults(prev => prev.filter(r => r.id !== id))

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader size={24} className="animate-spin text-sky-400" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Review Queue</h1>
        <p className="text-gray-400 text-sm mt-1">
          Low-confidence extractions flagged by the AI for human review.
        </p>
      </div>

      {results.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle size={40} className="text-emerald-400" />
          <p className="font-medium text-white">Queue is empty</p>
          <p className="text-sm text-gray-500">All extractions are either high-confidence or already reviewed.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-amber-400 flex items-center gap-2">
            <AlertTriangle size={14} /> {results.length} extraction{results.length > 1 ? 's' : ''} pending review
          </p>
          {results.map(r => (
            <ReviewCard key={r.id} result={r} onReviewed={handleReviewed} />
          ))}
        </>
      )}
    </div>
  )
}
