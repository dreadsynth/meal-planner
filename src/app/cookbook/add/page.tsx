'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, Ingredient } from '@/lib/supabase'

type Mode = 'choose' | 'url' | 'manual'

export default function AddRecipePage() {
  return <Suspense><AddRecipePageInner /></Suspense>
}

function AddRecipePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialMode = (searchParams.get('mode') as Mode) ?? 'choose'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [error, setError] = useState('')

  // Manual form state
  const [name, setName] = useState('')
  const [servings, setServings] = useState(2)
  const [sourceUrl, setSourceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', quantity: 1, unit: '', notes: '' }
  ])
  const [method, setMethod] = useState<string[]>([''])
  const [saving, setSaving] = useState(false)

  async function scrapeUrl() {
    if (!url.trim()) return
    setScraping(true)
    setError('')
    try {
      const res = await fetch('/api/scrape-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scrape failed')
      // Pre-fill manual form with scraped data
      setName(data.name ?? '')
      setServings(data.servings ?? 2)
      setSourceUrl(url)
      setNotes(data.notes ?? '')
      setTags((data.tags ?? []).join(', '))
      setIngredients(data.ingredients?.length ? data.ingredients : [{ name: '', quantity: 1, unit: '' }])
      setMethod(data.method?.length ? data.method : [''])
      setMode('manual')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setScraping(false)
    }
  }

  function addIngredient() {
    setIngredients(prev => [...prev, { name: '', quantity: 1, unit: '', notes: '' }])
  }

  function removeIngredient(i: number) {
    setIngredients(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateIngredient(i: number, field: keyof Ingredient, value: string | number) {
    setIngredients(prev => prev.map((ing, idx) =>
      idx === i ? { ...ing, [field]: value } : ing
    ))
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
    const { error: err } = await supabase.from('recipes').insert({
      name: name.trim(),
      servings,
      source_url: sourceUrl.trim() || null,
      notes: notes.trim() || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      ingredients: ingredients.filter(i => i.name.trim()),
      method: method.filter(s => s.trim()),
    })
    if (err) { setError(err.message); setSaving(false); return }
    router.push('/cookbook')
  }

  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="page-header">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-stone-400 -ml-1 p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <h1 className="section-title">Add recipe</h1>
          </div>
        </div>
        <div className="px-4 pt-6 space-y-4">
          <button onClick={() => setMode('url')} className="card w-full text-left active:bg-stone-50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">🔗</div>
              <div>
                <p className="font-semibold">Import from URL</p>
                <p className="text-sm text-stone-400">Paste a link from BBC Good Food, etc.</p>
              </div>
            </div>
          </button>
          <button onClick={() => setMode('manual')} className="card w-full text-left active:bg-stone-50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">✏️</div>
              <div>
                <p className="font-semibold">Add manually</p>
                <p className="text-sm text-stone-400">Type in a recipe you already know</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'url') {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="page-header">
          <div className="flex items-center gap-3">
            <button onClick={() => setMode('choose')} className="text-stone-400 -ml-1 p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <h1 className="section-title">Import recipe</h1>
          </div>
        </div>
        <div className="px-4 pt-6 space-y-4">
          <p className="text-stone-500 text-sm">Paste the URL of any recipe page — BBC Good Food, Delicious Magazine, etc.</p>
          <input
            className="input"
            placeholder="https://www.bbcgoodfood.com/recipes/…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            type="url"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            className="btn-primary"
            onClick={scrapeUrl}
            disabled={!url.trim() || scraping}
          >
            {scraping ? 'Importing…' : 'Import recipe'}
          </button>
        </div>
      </div>
    )
  }

  // Manual form (also used after scrape)
  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('choose')} className="text-stone-400 -ml-1 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1 className="section-title">
            {sourceUrl ? 'Review imported recipe' : 'Add recipe'}
          </h1>
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
            <input className="input" placeholder="e.g. Spaghetti Bolognese" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Serves (people)</label>
            <input className="input" type="number" min={1} max={20} value={servings}
              onChange={e => setServings(Number(e.target.value))} />
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
