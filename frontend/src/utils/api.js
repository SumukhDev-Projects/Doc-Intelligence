/**
 * utils/api.js
 * ------------
 * WHY THIS FILE EXISTS:
 *   Centralizes ALL backend API calls in one place.
 *   Instead of calling axios directly in components, every component
 *   imports from here. This means if the API URL changes, you change
 *   one line here — not 20 scattered axios calls.
 *
 * PATTERN:
 *   Each function maps to one API endpoint.
 *   Returns data directly (throws on error — let React Error Boundaries handle it).
 */

import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // 60s — extraction can take a while
})

// ── Documents ──────────────────────────────────────────────────────────────

export const uploadDocument = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data
}

export const listDocuments = async () => {
  const { data } = await api.get('/documents')
  return data
}

export const deleteDocument = async (docId) => {
  const { data } = await api.delete(`/documents/${docId}`)
  return data
}

// ── Schemas ────────────────────────────────────────────────────────────────

export const createSchema = async (schema) => {
  const { data } = await api.post('/schemas', schema)
  return data
}

export const listSchemas = async () => {
  const { data } = await api.get('/schemas')
  return data
}

export const deleteSchema = async (schemaId) => {
  const { data } = await api.delete(`/schemas/${schemaId}`)
  return data
}

// ── Extraction ─────────────────────────────────────────────────────────────

export const runExtraction = async (documentId, schemaId, confidenceThreshold = 0.75) => {
  const { data } = await api.post('/extract', {
    document_id: documentId,
    schema_id: schemaId,
    confidence_threshold: confidenceThreshold,
  })
  return data
}

export const listResults = async (needsReview = null) => {
  const params = needsReview !== null ? { needs_review: needsReview } : {}
  const { data } = await api.get('/extract/results', { params })
  return data
}

// ── Review ─────────────────────────────────────────────────────────────────

export const submitReview = async (resultId, correctedData) => {
  const { data } = await api.post(`/review/${resultId}`, {
    corrected_data: correctedData
  })
  return data
}

// ── Export ─────────────────────────────────────────────────────────────────

export const exportResults = async (resultIds, format = 'json') => {
  const response = await api.post('/export', {
    result_ids: resultIds,
    format,
  }, { responseType: 'blob' })

  // Trigger browser download
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  const ext = { json: 'json', csv: 'csv', excel: 'xlsx' }[format] || 'json'
  link.setAttribute('download', `extractions.${ext}`)
  document.body.appendChild(link)
  link.click()
  link.remove()
}

// ── Stats ──────────────────────────────────────────────────────────────────

export const getStats = async () => {
  const { data } = await api.get('/stats')
  return data
}
