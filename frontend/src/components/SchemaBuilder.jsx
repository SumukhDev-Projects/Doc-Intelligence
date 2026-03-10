/**
 * components/SchemaBuilder.jsx
 * ----------------------------
 * Lets users define extraction schemas — which fields to extract
 * from documents and what type each field is.
 * 
 * Includes pre-built templates for common document types
 * (invoices, contracts, resumes) so users can get started immediately.
 */

import { useState, useEffect } from 'react'
import { Plus, Trash2, Database, ChevronDown, Loader, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { createSchema, listSchemas, deleteSchema } from '../utils/api'

const FIELD_TYPES = ['string', 'number', 'date', 'boolean', 'list']

const TEMPLATES = {
  invoice: {
    name: 'Invoice Extractor',
    description: 'Extract key fields from invoices and purchase orders',
    fields: [
      { name: 'invoice_number', type: 'string', description: 'Invoice or PO number', required: true, example: 'INV-2024-001' },
      { name: 'vendor_name',    type: 'string', description: 'Name of the vendor or supplier', required: true, example: 'Acme Corp' },
      { name: 'invoice_date',   type: 'date',   description: 'Date the invoice was issued', required: true, example: '2024-01-15' },
      { name: 'due_date',       type: 'date',   description: 'Payment due date', required: false, example: '2024-02-15' },
      { name: 'total_amount',   type: 'number', description: 'Total amount due including tax', required: true, example: '1250.00' },
      { name: 'tax_amount',     type: 'number', description: 'Tax amount', required: false, example: '112.50' },
      { name: 'line_items',     type: 'list',   description: 'List of line items with descriptions', required: false, example: 'Software license - $1000' },
    ]
  },
  contract: {
    name: 'Contract Analyzer',
    description: 'Extract key clauses and parties from contracts',
    fields: [
      { name: 'party_one',       type: 'string', description: 'First party name', required: true, example: 'Company A Inc.' },
      { name: 'party_two',       type: 'string', description: 'Second party name', required: true, example: 'Vendor B LLC' },
      { name: 'contract_date',   type: 'date',   description: 'Contract signing date', required: true, example: '2024-01-01' },
      { name: 'expiry_date',     type: 'date',   description: 'Contract expiry date', required: false, example: '2025-01-01' },
      { name: 'contract_value',  type: 'number', description: 'Total contract value', required: false, example: '50000' },
      { name: 'governing_law',   type: 'string', description: 'Governing law / jurisdiction', required: false, example: 'State of Delaware' },
      { name: 'key_obligations', type: 'list',   description: 'Key obligations of each party', required: false, example: 'Deliver software by Q2' },
    ]
  },
  resume: {
    name: 'Resume Parser',
    description: 'Extract candidate information from resumes',
    fields: [
      { name: 'full_name',   type: 'string', description: 'Candidate full name', required: true, example: 'John Smith' },
      { name: 'email',       type: 'string', description: 'Email address', required: true, example: 'john@email.com' },
      { name: 'phone',       type: 'string', description: 'Phone number', required: false, example: '+1 555 123 4567' },
      { name: 'location',    type: 'string', description: 'City and state/country', required: false, example: 'Chicago, IL' },
      { name: 'skills',      type: 'list',   description: 'Technical and professional skills', required: false, example: 'Python, SQL, Tableau' },
      { name: 'experience_years', type: 'number', description: 'Total years of work experience', required: false, example: '5' },
      { name: 'education',   type: 'string', description: 'Highest degree and institution', required: false, example: 'MS Computer Science, MIT' },
    ]
  }
}

const emptyField = () => ({ name: '', type: 'string', description: '', required: true, example: '' })

export default function SchemaBuilder() {
  const [schemas, setSchemas] = useState([])
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState([emptyField()])

  const load = () => listSchemas().then(setSchemas).catch(() => {})
  useEffect(() => { load() }, [])

  const loadTemplate = (key) => {
    const t = TEMPLATES[key]
    setName(t.name)
    setDescription(t.description)
    setFields(t.fields)
    setCreating(true)
  }

  const addField = () => setFields(prev => [...prev, emptyField()])
  const removeField = (i) => setFields(prev => prev.filter((_, idx) => idx !== i))
  const updateField = (i, key, val) => setFields(prev =>
    prev.map((f, idx) => idx === i ? { ...f, [key]: val } : f)
  )

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Schema name is required'); return }
    const validFields = fields.filter(f => f.name.trim() && f.type)
    if (validFields.length === 0) { toast.error('Add at least one field'); return }

    setSaving(true)
    try {
      await createSchema({ name, description, fields: validFields })
      toast.success('Schema saved!')
      setCreating(false)
      setName(''); setDescription(''); setFields([emptyField()])
      await load()
    } catch (e) {
      toast.error('Save failed: ' + (e.response?.data?.detail || e.message))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, schemaName) => {
    if (!confirm(`Delete "${schemaName}"?`)) return
    try {
      await deleteSchema(id)
      setSchemas(prev => prev.filter(s => s.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Delete failed') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Extraction Schemas</h1>
          <p className="text-gray-400 text-sm mt-1">Define what fields to extract from your documents.</p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-primary text-sm">
            <Plus size={16} /> New Schema
          </button>
        )}
      </div>

      {/* Templates */}
      {!creating && (
        <div className="card">
          <p className="text-sm font-medium text-gray-400 mb-3">Start from a template:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <button key={key} onClick={() => loadTemplate(key)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Builder Form */}
      {creating && (
        <div className="card space-y-5">
          <h2 className="font-semibold text-white">New Schema</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Schema Name *</label>
              <input className="input" placeholder="e.g. Invoice Extractor"
                value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" placeholder="What documents does this extract from?"
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Fields</label>
              <button onClick={addField} className="btn-ghost text-xs">
                <Plus size={13} /> Add Field
              </button>
            </div>

            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <input className="input col-span-3" placeholder="field_name"
                    value={field.name} onChange={e => updateField(i, 'name', e.target.value)} />
                  <select className="input col-span-2" value={field.type}
                    onChange={e => updateField(i, 'type', e.target.value)}>
                    {FIELD_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input className="input col-span-4" placeholder="What this field represents"
                    value={field.description} onChange={e => updateField(i, 'description', e.target.value)} />
                  <input className="input col-span-2" placeholder="Example value"
                    value={field.example || ''} onChange={e => updateField(i, 'example', e.target.value)} />
                  <button onClick={() => removeField(i)}
                    className="col-span-1 text-gray-600 hover:text-red-400 transition-colors flex justify-center">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {saving ? 'Saving...' : 'Save Schema'}
            </button>
            <button onClick={() => setCreating(false)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Schema List */}
      {schemas.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-white">
            Saved Schemas <span className="text-gray-500 font-normal text-sm">({schemas.length})</span>
          </h2>
          {schemas.map(schema => (
            <div key={schema.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-sky-400" />
                  <span className="font-medium text-white">{schema.name}</span>
                  <span className="badge bg-sky-500/20 text-sky-400">{schema.fields.length} fields</span>
                </div>
                <button onClick={() => handleDelete(schema.id, schema.name)}
                  className="text-gray-600 hover:text-red-400 transition-colors p-1">
                  <Trash2 size={14} />
                </button>
              </div>
              {schema.description && (
                <p className="text-sm text-gray-500 mt-1 ml-6">{schema.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3 ml-6">
                {schema.fields.map((f, i) => (
                  <span key={i} className="badge bg-gray-800 text-gray-400 border border-gray-700">
                    {f.name} <span className="text-gray-600">({f.type})</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
