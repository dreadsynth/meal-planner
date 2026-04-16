'use client'
import { useEffect, useState } from 'react'
import { supabase, Recipe, FreezerItem } from '@/lib/supabase'

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function FreezerPage() {
  const [items, setItems] = useState<FreezerItem[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [portions, setPortions] = useState(1)
  const [saving, setSaving] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [itemsRes, recipesRes] = await Promise.all([
      supabase.from('freezer_items').select('*, recipe:recipes(*)').order('created_at', { ascending: false }),
      supabase.from('recipes').select('*').order('name'),
    ])
    setItems(itemsRes.data ?? [])
    setRecipes(recipesRes.data ?? [])
    setLoading(false)
  }

  async function addItem() {
    if (!selectedRecipeId || portions < 1) return
    setSaving(true)
    await supabase.from('freezer_items').insert({
      recipe_id: selectedRecipeId,
      portions,
      cooked_on: todayISO(),
    })
    setAdding(false)
    setSelectedRecipeId('')
    setPortions(1)
    await loadData()
    setSaving(false)
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('freezer_items').delete().eq('id', id)
  }

  function toggleExpand(recipeId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(recipeId) ? next.delete(recipeId) : next.add(recipeId)
      return next
    })
  }

  // Group batches by recipe_id, preserving order of first appearance
  const recipeOrder: string[] = []
  const grouped: Record<string, FreezerItem[]> = {}
  for (const item of items) {
    if (!grouped[item.recipe_id]) {
      recipeOrder.push(item.recipe_id)
      grouped[item.recipe_id] = []
    }
    grouped[item.recipe_id].push(item)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="section-title">Freezer</h1>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">

        {/* Add form */}
        {!adding ? (
          <button className="btn-primary" onClick={() => setAdding(true)}>
            + Add to freezer
          </button>
        ) : (
          <div className="card space-y-4">
            <p className="font-semibold text-stone-800">Add to freezer</p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Recipe</label>
              <select
                value={selectedRecipeId}
                onChange={e => setSelectedRecipeId(e.target.value)}
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 bg-white">
                <option value="">Select a recipe…</option>
                {recipes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Meals</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button key={n}
                    onClick={() => setPortions(n)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors
                      ${portions === n
                        ? 'bg-brand-500 text-white'
                        : 'bg-stone-100 text-stone-600 active:bg-brand-100 active:text-brand-700'
                      }`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={addItem} disabled={!selectedRecipeId || saving}>
                {saving ? 'Saving…' : 'Add'}
              </button>
              <button className="btn-secondary" onClick={() => { setAdding(false); setSelectedRecipeId(''); setPortions(1) }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center py-16 text-stone-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone-400 mb-2">Your freezer is empty</p>
            <p className="text-sm text-stone-300">Batch cook a meal or add one manually</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recipeOrder.map(recipeId => {
              const batches = grouped[recipeId]
              const recipeName = batches[0].recipe?.name ?? 'Unknown recipe'
              const total = batches.reduce((sum, b) => sum + b.portions, 0)
              const isExpanded = expandedIds.has(recipeId)
              return (
                <div key={recipeId} className="card p-0 overflow-hidden">
                  {/* Collapsed header — always visible */}
                  <button
                    onClick={() => toggleExpand(recipeId)}
                    className="w-full flex items-center gap-3 p-4 text-left active:bg-stone-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-900">{recipeName}</p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {total} meal{total !== 1 ? 's' : ''} in freezer
                      </p>
                    </div>
                    <svg
                      className={`flex-shrink-0 text-stone-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>

                  {/* Expanded batch breakdown */}
                  {isExpanded && (
                    <div className="border-t border-stone-100 divide-y divide-stone-100">
                      {batches.map(batch => (
                        <div key={batch.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1">
                            <p className="text-sm text-stone-800">
                              {batch.portions} meal{batch.portions !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-stone-400">
                              {batch.cooked_on
                                ? `Cooked ${new Date(batch.cooked_on + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                : 'Added manually'
                              }
                            </p>
                          </div>
                          <button
                            onClick={() => deleteItem(batch.id)}
                            className="p-2 text-stone-300 active:text-red-400 transition-colors flex-shrink-0">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                              <path d="M10 11v6M14 11v6"/>
                              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
