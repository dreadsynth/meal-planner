'use client'
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Ingredient } from '@/lib/supabase'

export default function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [servings, setServings] = useState(2)
  const [sourceUrl, setSourceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [method, setMethod] = useState<string[]>([])

  useEffect(() => {
    supabase.from('recipes').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (!data) return
        setName(data.name)
        setServings(data.servings)
        setSourceUrl(data.source_url ?? '')
        setNotes(data.notes ?? '')
        setTags((data.tags ?? []).join(', '))
        setIngredients(data.ingredients?.length ? data.ingredients : [{ name: '', quantity: 1, unit: '' }])
        setMethod(data.method?.length ? data.method : [''])
        setLoading(false)
      })
  }, [id])

  function addIngredient() {
    setIngredients(prev => [...prev, { name: '', quantity: 1, unit: '', notes: '' }])
  }
  function removeIngredient(i: number) {
    setIngredients(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateIngredient(i: number, field: keyof Ingredient, value: string | number) {
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing))
  }

  function addStep() { setMethod(prev => [...prev, '']) }
  function removeStep(i: number) { setMethod(prev => prev.filter((_, idx) => idx !== i)) }
  function updateStep(i: number, value: string) {
    setMethod(prev => prev.map((s, idx) => idx === i ? value : s))
  }

  async function saveRecipe() {
    if (!name.trim()) { setError('Recipe name is required'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('recipes').update({
      name: name.trim(),
      servings,
      source_url: sourceUrl.trim() || null,
      notes: notes.trim() || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      ingredients: ingredients.filter(i => i.name.trim()),
      method: method.filter(s => s.trim()),
    }).eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/cookbook/${id}`)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-stone-400">Loading…</div>

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-stone-400 -ml-1 p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <h1 className="section-title">Edit recipe</h1>
          </div>
          <button onClick={saveRecipe} disabled={saving}
            className="text-sm text-brand-600 active:text-brand-800 font-medium px-2 py-1 disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5 pb-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>
        )}

        {/* Basic info */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-stone-700">Basic info</h2>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Recipe name *</label>
            <input className="input" placeholder="e.g. Spaghetti Bolognese"
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Serves (people)</label>
            <input className="input" type="number" min={1} max={20} value={servings}
              onChange={e => setServings(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Source URL</label>
            <input className="input" type="url" placeholder="https://…"
              value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Tags (comma separated)</label>
            <input className="input" placeholder="e.g. quick, vegetarian, freezable"
              value={tags} onChange={e => setTags(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Notes</label>
            <textarea className="input resize-none" rows={2} placeholder="Any tips or variations…"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Ingredients */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-stone-700">Ingredients</h2>
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1.5">
                <input className="input text-sm py-2" placeholder="Ingredient name"
                  value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)} />
                <div className="flex gap-2">
                  <input className="input text-sm py-2 w-20" type="number" min={0} step={0.1}
                    placeholder="Qty" value={ing.quantity}
                    onChange={e => updateIngredient(i, 'quantity', parseFloat(e.target.value) || 0)} />
                  <input className="input text-sm py-2" placeholder="Unit (g, ml, whole…)"
                    value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} />
                </div>
              </div>
              <button onClick={() => removeIngredient(i)}
                className="mt-1 p-2 text-stone-300 active:text-red-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
          <button onClick={addIngredient} className="btn-secondary py-2 text-sm">
            + Add ingredient
          </button>
        </div>

        {/* Method */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-stone-700">Method</h2>
          {method.map((step, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-xs text-stone-400 mt-3 w-5 flex-shrink-0 text-right">{i + 1}</span>
              <textarea
                className="input text-sm py-2 resize-none flex-1" rows={2}
                placeholder={`Step ${i + 1}…`}
                value={step}
                onChange={e => updateStep(i, e.target.value)}
              />
              <button onClick={() => removeStep(i)}
                className="mt-1 p-2 text-stone-300 active:text-red-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
          <button onClick={addStep} className="btn-secondary py-2 text-sm">
            + Add step
          </button>
        </div>

        <button className="btn-primary" onClick={saveRecipe} disabled={saving}>
          {saving ? 'Saving…' : 'Save recipe'}
        </button>
      </div>
    </div>
  )
}
