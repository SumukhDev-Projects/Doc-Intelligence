/**
 * components/Dashboard.jsx
 * -------------------------
 * Overview page showing key metrics + quick action buttons.
 * Polls /stats every 30s to stay fresh.
 */

import { useEffect, useState } from 'react'
import { FileText, Zap, ClipboardCheck, TrendingUp, ArrowRight, AlertCircle } from 'lucide-react'
import { getStats } from '../utils/api'

const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="card flex items-start gap-4">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
      <Icon size={18} />
    </div>
    <div>
      <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
      <p className="text-sm text-gray-400">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  </div>
)

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const load = () => getStats().then(setStats).catch(() => {})
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const confidencePct = stats ? Math.round(stats.avg_confidence * 100) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">
          AI-powered document data extraction — upload PDFs, define schemas, get structured JSON.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Documents" value={stats?.total_documents}
          color="bg-sky-500/20 text-sky-400" />
        <StatCard icon={Zap} label="Extractions" value={stats?.total_extractions}
          color="bg-violet-500/20 text-violet-400" />
        <StatCard icon={TrendingUp} label="Avg Confidence" value={confidencePct ? `${confidencePct}%` : '—'}
          color="bg-emerald-500/20 text-emerald-400" />
        <StatCard icon={ClipboardCheck} label="Pending Review" value={stats?.pending_review}
          color="bg-amber-500/20 text-amber-400"
          sub={stats?.pending_review > 0 ? "needs attention" : undefined} />
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Quick Start</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { step: '1', label: 'Upload a PDF', action: 'upload', desc: 'Upload invoices, contracts, reports' },
            { step: '2', label: 'Define a Schema', action: 'schemas', desc: 'Tell the AI what to extract' },
            { step: '3', label: 'Run Extraction', action: 'extract', desc: 'Get structured JSON back' },
          ].map(({ step, label, action, desc }) => (
            <button key={step} onClick={() => onNavigate(action)}
              className="flex items-start gap-3 p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-sky-500/50 rounded-xl text-left transition-all group">
              <span className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {step}
              </span>
              <div>
                <p className="font-medium text-white text-sm">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <ArrowRight size={14} className="ml-auto text-gray-600 group-hover:text-sky-400 shrink-0 mt-1" />
            </button>
          ))}
        </div>
      </div>

      {/* Review alert */}
      {stats?.pending_review > 0 && (
        <button onClick={() => onNavigate('review')}
          className="w-full flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl hover:border-amber-500/60 transition-all text-left">
          <AlertCircle size={18} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">
              {stats.pending_review} extraction{stats.pending_review > 1 ? 's' : ''} need review
            </p>
            <p className="text-xs text-gray-500">Low confidence fields flagged by the AI → click to review</p>
          </div>
          <ArrowRight size={14} className="ml-auto text-amber-500" />
        </button>
      )}
    </div>
  )
}
