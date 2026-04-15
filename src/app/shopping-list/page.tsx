'use client'
import { useEffect, useState } from 'react'
import { supabase, ShoppingList, ShoppingListItem, currentWeekStart } from '@/lib/supabase'

const CATEGORIES = ['produce','meat','fish','dairy & eggs','grains & pasta','tins & jars','pantry','drinks','other']

export default function ShoppingListPage() {
  const weekStart = currentWeekStart()
  const [list, setList] = useState<ShoppingList | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.from('shopping_lists')
      .select('*')
      .eq('week_start', weekStart)
      .single()
      .then(({ data }) => { setList(data); setLoading(false) })
  }, [weekStart])

  function toggle(key: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function formatItem(item: ShoppingListItem) {
    if (!item.quantity || item.unit === 'whole' || !item.unit) {
      return item.quantity ? `${item.quantity}× ${item.name}` : item.name
    }
    return `${item.quantity}${item.unit} ${item.name}`
  }

  function copyToClipboard() {
    if (!list) return
    const text = CATEGORIES
      .filter(cat => list.items.some(i => i.category === cat))
      .map(cat => {
        const items = list.items.filter(i => i.category === cat)
        return `${cat.toUpperCase()}\n` + items.map(i => `• ${formatItem(i)}`).join('\n')
      }).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function weekLabel() {
    const d = new Date(weekStart + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-stone-400">Loading…</div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <h1 className="section-title">Shopping</h1>
          {list && (
            <button onClick={copyToClipboard} className="btn-ghost text-sm">
              {copied ? '✓ Copied' : 'Copy list'}
            </button>
          )}
        </div>
        <p className="text-sm text-stone-400 mt-0.5">Week of {weekLabel()}</p>
      </div>

      <div className="px-4 pt-4 pb-8">
        {!list ? (
          <div className="text-center py-16">
            <p className="text-stone-400 mb-2">No shopping list yet</p>
            <p className="text-sm text-stone-300">Complete the meal planner to generate your list</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-sm text-stone-400">
              <span>{list.items.length} items</span>
              {checked.size > 0 && (
                <button onClick={() => setChecked(new Set())} className="text-brand-500">
                  Clear ticks
                </button>
              )}
            </div>

            {CATEGORIES.map(cat => {
              const items = list.items.filter(i => i.category === cat)
              if (items.length === 0) return null
              return (
                <div key={cat}>
                  <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
                    {cat}
                  </h2>
                  <div className="card p-0 overflow-hidden divide-y divide-stone-100">
                    {items.map((item, i) => {
                      const key = `${item.name}-${item.unit}`
                      const done = checked.has(key)
                      return (
                        <button key={i} onClick={() => toggle(key)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left
                            transition-colors active:bg-stone-50
                            ${done ? 'opacity-40' : ''}`}>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                            flex-shrink-0 transition-colors
                            ${done ? 'bg-brand-500 border-brand-500' : 'border-stone-300'}`}>
                            {done && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2">
                                <polyline points="1.5 5 4 7.5 8.5 2"/>
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm flex-1 ${done ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                            {formatItem(item)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div className="pt-2 space-y-2">
              <p className="text-xs text-stone-300 text-center">
                Generated {new Date(list.created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
