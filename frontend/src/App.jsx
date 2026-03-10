/**
 * App.jsx
 * -------
 * Root component. Manages tab navigation and global state.
 * Tabs: Dashboard → Upload → Schemas → Extract → Review → Export
 */

import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import {
  LayoutDashboard, Upload, Database, Zap,
  ClipboardCheck, Download, FileText
} from 'lucide-react'
import Dashboard from './components/Dashboard'
import UploadZone from './components/UploadZone'
import SchemaBuilder from './components/SchemaBuilder'
import ExtractPanel from './components/ExtractPanel'
import ReviewQueue from './components/ReviewQueue'
import ExportPanel from './components/ExportPanel'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'upload',    label: 'Upload',    icon: Upload },
  { id: 'schemas',   label: 'Schemas',   icon: Database },
  { id: 'extract',   label: 'Extract',   icon: Zap },
  { id: 'review',    label: 'Review',    icon: ClipboardCheck },
  { id: 'export',    label: 'Export',    icon: Download },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151' }
      }} />

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
              <FileText size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg text-white">DocIntel</span>
            <span className="text-gray-500 text-sm hidden sm:block">/ Document Intelligence API</span>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span>
            Claude 3.5 Sonnet
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar Nav */}
        <nav className="w-48 shrink-0">
          <ul className="space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === id
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
          {activeTab === 'upload'    && <UploadZone />}
          {activeTab === 'schemas'   && <SchemaBuilder />}
          {activeTab === 'extract'   && <ExtractPanel />}
          {activeTab === 'review'    && <ReviewQueue />}
          {activeTab === 'export'    && <ExportPanel />}
        </main>
      </div>
    </div>
  )
}
