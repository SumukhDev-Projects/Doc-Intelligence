/**
 * components/UploadZone.jsx
 * --------------------------
 * Drag-and-drop PDF upload component.
 * Uses react-dropzone for file handling.
 * Shows upload progress and document list.
 */

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Trash2, CheckCircle, Clock, AlertCircle, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadDocument, listDocuments, deleteDocument } from '../utils/api'

const STATUS_ICON = {
  uploaded:   <CheckCircle size={14} className="text-emerald-400" />,
  processing: <Loader size={14} className="text-sky-400 animate-spin" />,
  done:       <CheckCircle size={14} className="text-emerald-400" />,
  error:      <AlertCircle size={14} className="text-red-400" />,
}

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function UploadZone() {
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)

  const load = () => listDocuments().then(setDocuments).catch(() => {})

  useEffect(() => { load() }, [])

  const onDrop = useCallback(async (acceptedFiles) => {
    const pdfs = acceptedFiles.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (pdfs.length === 0) {
      toast.error('Only PDF files are supported')
      return
    }

    setUploading(true)
    try {
      for (const file of pdfs) {
        await uploadDocument(file)
        toast.success(`Uploaded: ${file.name}`)
      }
      await load()
    } catch (e) {
      toast.error('Upload failed: ' + (e.response?.data?.detail || e.message))
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    disabled: uploading
  })

  const handleDelete = async (docId, filename) => {
    if (!confirm(`Delete "${filename}"?`)) return
    try {
      await deleteDocument(docId)
      setDocuments(prev => prev.filter(d => d.id !== docId))
      toast.success('Deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Documents</h1>
        <p className="text-gray-400 text-sm mt-1">Upload PDFs to extract structured data from them.</p>
      </div>

      {/* Drop zone */}
      <div {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-sky-400 bg-sky-500/10'
            : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/30'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {uploading
            ? <Loader size={40} className="text-sky-400 animate-spin" />
            : <Upload size={40} className={isDragActive ? 'text-sky-400' : 'text-gray-600'} />
          }
          <div>
            <p className="font-medium text-gray-200">
              {uploading ? 'Uploading...' : isDragActive ? 'Drop PDFs here' : 'Drag & drop PDFs here'}
            </p>
            <p className="text-sm text-gray-500 mt-1">or click to browse • PDF files only</p>
          </div>
        </div>
      </div>

      {/* Document list */}
      {documents.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">
            Uploaded Documents <span className="text-gray-500 font-normal text-sm">({documents.length})</span>
          </h2>
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id}
                className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <FileText size={18} className="text-sky-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{doc.filename}</p>
                  <p className="text-xs text-gray-500">
                    {formatSize(doc.file_size)}
                    {doc.page_count && ` • ${doc.page_count} pages`}
                    {' • '}{new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {STATUS_ICON[doc.status]}
                  <span className="text-xs text-gray-500 capitalize">{doc.status}</span>
                </div>
                <button onClick={() => handleDelete(doc.id, doc.filename)}
                  className="text-gray-600 hover:text-red-400 transition-colors p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {documents.length === 0 && !uploading && (
        <p className="text-center text-gray-600 text-sm">No documents uploaded yet.</p>
      )}
    </div>
  )
}
