'use client'
import { useEffect, useState } from 'react'
import { supabase, ShoppingList, ShoppingListItem, DAYS, DayOfWeek, capitalise } from '@/lib/supabase'

const CATEGORIES = ['produce','meat','fish','dairy & eggs','grains & pasta','tins & jars','pantry','drinks','other']
const COMPACT_UNITS = new Set(['g', 'ml', 'kg', 'l', 'mg', 'cl'])

function formatItem(item: ShoppingListItem) {
  const name = item.name.charAt(0).toUpperCase() + item.name.slice(1)
  if (!item.quantity || item.unit === 'whole' || !item.unit) {
    return item.quantity ? `${item.quantity} × ${name}` : name
  }
  const sep = COMPACT_UNITS.has(item.unit.toLowerCase()) ? '' : ' '
  return `${item.quantity}${sep}${item.unit} ${name}`
}

function dayDate(planStart: string, dayOfWeek: string, format: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  const startDate = new Date(planStart + 'T00:00:00')
  const startDow = (startDate.getDay() + 6) % 7
  const targetDow = DAYS.indexOf(dayOfWeek as DayOfWeek)
  const offset = (targetDow - startDow + 7) % 7
  const d = new Date(startDate)
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-GB', format)
}

function dayOffset(weekStart: string, dayOfWeek: string): number {
  const startDow = (new Date(weekStart + 'T00:00:00').getDay() + 6) % 7
  const targetDow = DAYS.indexOf(dayOfWeek as DayOfWeek)
  return (targetDow - startDow + 7) % 7
}

function listDateRange(list: ShoppingList): string {
  const days = (list.covered_days ?? []).filter(d => DAYS.includes(d as typeof DAYS[number]))
  if (days.length === 0) {
    const d = new Date(list.week_start + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const sorted = [...days].sort((a, b) => dayOffset(list.week_start, a) - dayOffset(list.week_start, b))
  const first = sorted[0], last = sorted[sorted.length - 1]
  const firstLabel = `${capitalise(first.slice(0, 3))} ${dayDate(list.week_start, first)}`
  const lastLabel = `${capitalise(last.slice(0, 3))} ${dayDate(list.week_start, last)}`
  return first === last ? firstLabel : `${firstLabel} – ${lastLabel}`
}

export default function ShoppingListPage() {
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Record<string, Set<string>>>({})
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { loadLists() }, [])

  async function loadLists() {
    setLoading(true)
    const { data } = await supabase
      .from('shopping_lists')
      .select('*')
      .order('created_at', { ascending: false })
    setLists(data ?? [])
    setLoading(false)
  }

  function toggleItem(listId: string, key: string) {
    setChecked(prev => {
      const set = new Set(prev[listId] ?? [])
      set.has(key) ? set.delete(key) : set.add(key)
      return { ...prev, [listId]: set }
    })
  }

  function copyList(list: ShoppingList) {
    const text = CATEGORIES
      .filter(cat => list.items.some(i => i.category === cat))
      .map(cat => {
        const items = list.items.filter(i => i.category === cat)
        return `${cat.toUpperCase()}\n` + items.map(i => `• ${formatItem(i)}`).join('\n')
      }).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(list.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="section-title">Shopping</h1>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-2">
        {loading ? (
          <div className="text-center py-16 text-stone-400">Loading…</div>
        ) : lists.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone-400 mb-2">No shopping lists yet</p>
            <p className="text-sm text-stone-300">Generate a meal plan to create your first list</p>
          </div>
        ) : (
          lists.map(list => {
            const isExpanded = expandedId === list.id
            const listChecked = checked[list.id] ?? new Set<string>()
            const planId = list.plan_group_id

            return (
              <div key={list.id} className="card p-0 overflow-hidden">
                {/* Collapsed header */}
                <div className="flex items-start">
                  <button
                    className="flex-1 flex items-start gap-3 p-4 text-left active:bg-stone-50 transition-colors min-w-0"
                    onClick={() => setExpandedId(isExpanded ? null : list.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {planId && (
                          <span className="font-mono text-xs font-semibold text-brand-600 bg-brand-50 rounded px-1.5 py-0.5">
                            #{planId}
                          </span>
                        )}
                        <span className="text-xs text-stone-400">
                          {new Date(list.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-stone-800 mt-1">{listDateRange(list)}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{list.items.length} items</p>
                    </div>
                    <svg
                      className={`flex-shrink-0 mt-1 text-stone-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>

                {/* Expanded shopping list */}
                {isExpanded && (
                  <div className="border-t border-stone-100">
                    {/* Copy button */}
                    <div className="flex justify-end px-4 pt-3">
                      <button onClick={() => copyList(list)} className="btn-ghost text-sm">
                        {copied === list.id ? '✓ Copied' : 'Copy list'}
                      </button>
                    </div>

                    <div className="px-4 pb-4 space-y-4">
                      {/* Tick-off progress */}
                      <div className="flex items-center justify-between text-sm text-stone-400">
                        <span>{list.items.length} items</span>
                        {listChecked.size > 0 && (
                          <button
                            onClick={() => setChecked(prev => ({ ...prev, [list.id]: new Set() }))}
                            className="text-brand-500">
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
                                const done = listChecked.has(key)
                                return (
                                  <button key={i} onClick={() => toggleItem(list.id, key)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-stone-50 ${done ? 'opacity-40' : ''}`}>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
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
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
