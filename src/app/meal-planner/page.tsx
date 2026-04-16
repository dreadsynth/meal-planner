'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase, Recipe, MealPlan, FreezerItem, DAYS, capitalise } from '@/lib/supabase'

interface PlanEntry {
  day: string
  date: string
  recipeId: string
  recipeName: string
  numPeople: number
  batchMultiplier: number
  fromFreezer: boolean
  freezerItemId?: string
}

interface DayOption {
  date: string
  dow: string
  label: string
  dateLabel: string
}

interface PlanGroup {
  planId: string
  weekStart: string
  createdAt: string
  entries: MealPlan[]
}

type WizardStep = 'start' | 'days' | 'freezer' | 'people' | 'review'

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDayOptions(fromDate: string): DayOption[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(fromDate + 'T00:00:00')
    d.setDate(d.getDate() + i)
    const date = localDateStr(d)
    const dow = DAYS[(d.getDay() + 6) % 7]
    return {
      date, dow,
      label: capitalise(dow.slice(0, 3)),
      dateLabel: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    }
  })
}

function todayStr(): string { return localDateStr(new Date()) }

function dayDate(
  planStart: string,
  dayOfWeek: string,
  format: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
): string {
  const startDate = new Date(planStart + 'T00:00:00')
  const startDow = (startDate.getDay() + 6) % 7
  const targetDow = DAYS.indexOf(dayOfWeek as typeof DAYS[number])
  const offset = (targetDow - startDow + 7) % 7
  const d = new Date(startDate)
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-GB', format)
}

function entryDateOffset(planStart: string, dayOfWeek: string): number {
  const startDow = (new Date(planStart + 'T00:00:00').getDay() + 6) % 7
  const targetDow = DAYS.indexOf(dayOfWeek as typeof DAYS[number])
  return (targetDow - startDow + 7) % 7
}

export default function MealPlannerPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [planGroups, setPlanGroups] = useState<PlanGroup[]>([])
  const [freezerItems, setFreezerItems] = useState<FreezerItem[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const deletedIds = useRef<Set<string>>(new Set())

  // Wizard state
  const [planning, setPlanning] = useState(false)
  const [step, setStep] = useState<WizardStep>('start')
  const [planStart, setPlanStart] = useState('')
  const [homeDates, setHomeDates] = useState<string[]>([])
  const [freezerDates, setFreezerDates] = useState<string[]>([])
  const [peoplePerDate, setPeoplePerDate] = useState<Record<string, number>>({})
  const [plan, setPlan] = useState<PlanEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [plansRes, recipesRes, freezerRes] = await Promise.all([
      supabase.from('meal_plans').select('*, recipe:recipes(*)').order('created_at', { ascending: false }),
      supabase.from('recipes').select('*').order('name'),
      supabase.from('freezer_items').select('*, recipe:recipes(*)').order('created_at', { ascending: true }),
    ])
    setRecipes(recipesRes.data ?? [])
    setFreezerItems(freezerRes.data ?? [])

    const rows: MealPlan[] = plansRes.data ?? []
    const map: Record<string, PlanGroup> = {}
    for (const row of rows) {
      const gid = row.plan_group_id ?? 'legacy'
      if (!map[gid]) {
        map[gid] = { planId: gid, weekStart: row.week_start, createdAt: row.created_at, entries: [] }
      }
      map[gid].entries.push(row)
    }
    for (const g of Object.values(map)) {
      g.entries.sort((a, b) => entryDateOffset(g.weekStart, a.day_of_week) - entryDateOffset(g.weekStart, b.day_of_week))
    }
    const groups = Object.values(map)
      .filter(g => !deletedIds.current.has(g.planId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    setPlanGroups(groups)
    setLoading(false)
  }

  function startPlanning() {
    setStep('start')
    setPlanStart('')
    setHomeDates([])
    setFreezerDates([])
    setPeoplePerDate({})
    setPlan([])
    setPlanning(true)
  }

  function toggleDate(date: string) {
    setHomeDates(prev => {
      if (prev.includes(date)) {
        setFreezerDates(fd => fd.filter(d => d !== date))
        return prev.filter(d => d !== date)
      }
      return [...prev, date]
    })
  }

  function toggleFreezerDate(date: string) {
    setFreezerDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    )
  }

  const freezerTotal = freezerItems.reduce((sum, i) => sum + i.portions, 0)

  function initPeopleStep() {
    const defaults: Record<string, number> = {}
    homeDates.forEach(d => { defaults[d] = peoplePerDate[d] ?? 2 })
    setPeoplePerDate(defaults)
    setStep('people')
  }

  function buildPlan(): PlanEntry[] {
    const sorted = [...homeDates].sort()
    const shuffled = [...recipes].sort(() => Math.random() - 0.5)

    // Build FIFO queue of freezer allocations (oldest first, expand multi-portion rows)
    const queue: { recipeId: string; recipeName: string; itemId: string }[] = []
    for (const item of freezerItems) {
      for (let i = 0; i < item.portions; i++) {
        queue.push({ recipeId: item.recipe_id, recipeName: item.recipe?.name ?? '', itemId: item.id })
      }
    }

    let freezerIdx = 0
    let recipeIdx = 0

    return sorted.map(date => {
      const d = new Date(date + 'T00:00:00')
      const dow = DAYS[(d.getDay() + 6) % 7]

      if (freezerDates.includes(date) && freezerIdx < queue.length) {
        const f = queue[freezerIdx++]
        return {
          day: dow, date,
          recipeId: f.recipeId, recipeName: f.recipeName,
          numPeople: peoplePerDate[date] ?? 2,
          batchMultiplier: 1,
          fromFreezer: true, freezerItemId: f.itemId,
        }
      }

      const pick = shuffled[recipeIdx % shuffled.length]
      recipeIdx++
      return {
        day: dow, date,
        recipeId: pick.id, recipeName: pick.name,
        numPeople: peoplePerDate[date] ?? 2,
        batchMultiplier: 1,
        fromFreezer: false,
      }
    })
  }

  function swapRecipe(index: number) {
    if (plan[index].fromFreezer) return
    const usedIds = new Set(plan.filter((_, i) => i !== index).map(e => e.recipeId))
    const current = plan[index].recipeId
    const unused = recipes.filter(r => !usedIds.has(r.id) && r.id !== current)
    const pool = unused.length > 0 ? unused : recipes.filter(r => r.id !== current)
    const candidates = pool.length > 0 ? pool : recipes
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    setPlan(prev => prev.map((e, i) => i === index ? { ...e, recipeId: pick.id, recipeName: pick.name } : e))
  }

  function cycleBatch(index: number) {
    if (plan[index].fromFreezer) return
    setPlan(prev => prev.map((e, i) => i === index
      ? { ...e, batchMultiplier: e.batchMultiplier >= 3 ? 1 : e.batchMultiplier + 1 }
      : e
    ))
  }

  function swapDays(a: number, b: number) {
    setPlan(prev => {
      const next = [...prev]
      const { recipeId, recipeName, batchMultiplier, fromFreezer, freezerItemId } = next[a]
      next[a] = { ...next[a], recipeId: next[b].recipeId, recipeName: next[b].recipeName, batchMultiplier: next[b].batchMultiplier, fromFreezer: next[b].fromFreezer, freezerItemId: next[b].freezerItemId }
      next[b] = { ...next[b], recipeId, recipeName, batchMultiplier, fromFreezer, freezerItemId }
      return next
    })
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex !== null && dragIndex !== targetIndex) swapDays(dragIndex, targetIndex)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  async function savePlan() {
    setSaving(true)

    await fetch('/api/save-meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekStart: planStart,
        meals: plan.map(p => ({
          day_of_week: p.day,
          recipe_id: p.recipeId,
          num_people: p.numPeople,
          batch_multiplier: p.batchMultiplier,
          meal_date: p.date,
        })),
      }),
    })

    // Deplete freezer items used in this plan
    const freezerMeals = plan.filter(p => p.fromFreezer && p.freezerItemId)
    if (freezerMeals.length > 0) {
      const depletions: Record<string, number> = {}
      for (const meal of freezerMeals) {
        const id = meal.freezerItemId!
        depletions[id] = (depletions[id] ?? 0) + 1
      }
      await Promise.all(Object.entries(depletions).map(async ([id, count]) => {
        const item = freezerItems.find(f => f.id === id)
        if (!item) return
        const remaining = item.portions - count
        if (remaining <= 0) {
          await supabase.from('freezer_items').delete().eq('id', id)
        } else {
          await supabase.from('freezer_items').update({ portions: remaining }).eq('id', id)
        }
      }))
    }

    await loadData()
    setPlanning(false)
    setSaving(false)
  }

  function planDateRange(group: PlanGroup): string {
    const sorted = [...group.entries].sort((a, b) => entryDateOffset(group.weekStart, a.day_of_week) - entryDateOffset(group.weekStart, b.day_of_week))
    const first = sorted[0], last = sorted[sorted.length - 1]
    const firstLabel = `${capitalise(first.day_of_week.slice(0, 3))} ${dayDate(group.weekStart, first.day_of_week)}`
    const lastLabel = `${capitalise(last.day_of_week.slice(0, 3))} ${dayDate(group.weekStart, last.day_of_week)}`
    return first.day_of_week === last.day_of_week ? firstLabel : `${firstLabel} – ${lastLabel}`
  }

  function planDayChips(group: PlanGroup): string {
    return group.entries
      .map(e => `${capitalise(e.day_of_week.slice(0, 3))} ${dayDate(group.weekStart, e.day_of_week, { day: 'numeric' })}`)
      .join(', ')
  }

  async function deletePlan(planId: string) {
    if (!confirm('Delete this meal plan?')) return
    deletedIds.current.add(planId)
    setPlanGroups(prev => prev.filter(g => g.planId !== planId))
    if (expandedId === planId) setExpandedId(null)
    await Promise.all([
      supabase.from('meal_plans').delete().eq('plan_group_id', planId),
      supabase.from('shopping_lists').delete().eq('plan_group_id', planId),
    ])
  }

  const startOptions = getDayOptions(todayStr())
  const dayOptions = planStart ? getDayOptions(planStart) : []

  return (
    <div>
      <div className="page-header">
        <h1 className="section-title">Meal Planner</h1>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">

        {/* ── Plan history ── */}
        {!planning && (
          <>
            <button className="btn-primary" onClick={startPlanning}>
              ✨ Generate meal plan
            </button>

            {loading ? (
              <div className="text-center py-8 text-stone-400">Loading…</div>
            ) : planGroups.length === 0 ? (
              <p className="text-center py-8 text-stone-400">No meal plans yet</p>
            ) : (
              <div className="space-y-2">
                {planGroups.map(group => {
                  const isExpanded = expandedId === group.planId
                  return (
                    <div key={group.planId} className="card p-0 overflow-hidden">
                      <div className="flex items-start">
                        <button
                          className="flex-1 flex items-start gap-3 p-4 text-left active:bg-stone-50 transition-colors min-w-0"
                          onClick={() => setExpandedId(isExpanded ? null : group.planId)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-semibold text-brand-600 bg-brand-50 rounded px-1.5 py-0.5">
                                #{group.planId}
                              </span>
                              <span className="text-xs text-stone-400">
                                {new Date(group.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-stone-800 mt-1">{planDateRange(group)}</p>
                            <p className="text-xs text-stone-400 mt-0.5">{planDayChips(group)}</p>
                          </div>
                          <svg
                            className={`flex-shrink-0 mt-1 text-stone-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => deletePlan(group.planId)}
                          className="p-4 text-stone-300 active:text-red-400 transition-colors flex-shrink-0">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                          </svg>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-stone-100 divide-y divide-stone-100">
                          {group.entries.map(entry => (
                            <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="w-12 flex-shrink-0">
                                <p className="text-xs font-semibold text-stone-500 uppercase">{entry.day_of_week.slice(0, 3)}</p>
                                <p className="text-xs text-stone-400">{dayDate(group.weekStart, entry.day_of_week)}</p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-stone-900 truncate">{entry.recipe?.name}</p>
                                <p className="text-xs text-stone-400">
                                  {entry.num_people} people{entry.batch_multiplier > 1 && ` · ×${entry.batch_multiplier} batch`}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── Step 1: pick start date ── */}
        {planning && step === 'start' && (
          <div className="space-y-5">
            <p className="text-lg font-semibold text-stone-800">What day does this meal plan start?</p>
            <div className="grid grid-cols-7 gap-2">
              {startOptions.map(opt => {
                const selected = planStart === opt.date
                return (
                  <button key={opt.date} onClick={() => setPlanStart(opt.date)}
                    className={`flex flex-col items-center justify-center aspect-square rounded-2xl
                                text-xs font-semibold transition-colors shadow-sm gap-0.5
                      ${selected
                        ? 'bg-brand-500 text-white'
                        : 'bg-white border border-stone-200 text-stone-700 active:bg-brand-50 active:border-brand-400 active:text-brand-700'
                      }`}>
                    <span>{opt.label}</span>
                    <span className={`text-xs ${selected ? 'text-brand-100' : 'text-stone-400'}`}>{opt.dateLabel}</span>
                  </button>
                )
              })}
            </div>
            {planStart && (
              <button className="btn-primary" onClick={() => { setHomeDates([]); setStep('days') }}>
                Continue →
              </button>
            )}
            <button onClick={() => setPlanning(false)} className="text-xs text-stone-400 block">← Cancel</button>
          </div>
        )}

        {/* ── Step 2: which evenings ── */}
        {planning && step === 'days' && (
          <div className="space-y-5">
            <p className="text-lg font-semibold text-stone-800">Which evenings are you eating at home?</p>
            <div className="grid grid-cols-7 gap-2">
              {dayOptions.map(opt => {
                const selected = homeDates.includes(opt.date)
                return (
                  <button key={opt.date} onClick={() => toggleDate(opt.date)}
                    className={`flex flex-col items-center justify-center aspect-square rounded-2xl
                                text-xs font-semibold transition-colors shadow-sm gap-0.5
                      ${selected
                        ? 'bg-brand-500 text-white'
                        : 'bg-white border border-stone-200 text-stone-700 active:bg-brand-50 active:border-brand-400 active:text-brand-700'
                      }`}>
                    <span>{opt.label}</span>
                    <span className={`text-xs ${selected ? 'text-brand-100' : 'text-stone-400'}`}>{opt.dateLabel}</span>
                  </button>
                )
              })}
            </div>
            {homeDates.length > 0 && (
              <button className="btn-primary" onClick={() => {
                setFreezerDates([])
                freezerTotal > 0 ? setStep('freezer') : initPeopleStep()
              }}>
                Continue →
              </button>
            )}
            <button onClick={() => setStep('start')} className="text-xs text-stone-400 block">← Back</button>
          </div>
        )}

        {/* ── Step 3: freezer meals ── */}
        {planning && step === 'freezer' && (
          <div className="space-y-5">
            <div>
              <p className="text-lg font-semibold text-stone-800">Would you like any freezer meals?</p>
              <p className="text-sm text-stone-400 mt-1">
                {freezerTotal} meal{freezerTotal !== 1 ? 's' : ''} available in the freezer
              </p>
            </div>

            <div className="space-y-2">
              {[...homeDates].sort().map(date => {
                const d = new Date(date + 'T00:00:00')
                const dow = DAYS[(d.getDay() + 6) % 7]
                const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                const isSelected = freezerDates.includes(date)
                const wouldExceed = !isSelected && freezerDates.length >= freezerTotal

                return (
                  <div key={date} className="card flex items-center gap-3 py-3">
                    <div className="w-12 flex-shrink-0">
                      <p className="text-xs font-semibold text-stone-500 uppercase">{capitalise(dow.slice(0, 3))}</p>
                      <p className="text-xs text-stone-400">{dateLabel}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      {wouldExceed && (
                        <p className="text-xs text-amber-500 font-medium">No freezer meals left</p>
                      )}
                    </div>
                    <button
                      onClick={() => { if (!wouldExceed) toggleFreezerDate(date) }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0
                        ${isSelected
                          ? 'bg-blue-100 text-blue-700'
                          : wouldExceed
                            ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                            : 'bg-stone-100 text-stone-500 active:bg-blue-50 active:text-blue-600'
                        }`}>
                      <span>❄️</span>
                      <span>{isSelected ? 'Freezer' : 'Use freezer'}</span>
                    </button>
                  </div>
                )
              })}
            </div>

            <button className="btn-primary" onClick={initPeopleStep}>Continue →</button>
            <button onClick={() => setStep('days')} className="text-xs text-stone-400 block">← Back</button>
          </div>
        )}

        {/* ── Step 4: how many people per day ── */}
        {planning && step === 'people' && (
          <div className="space-y-5">
            <p className="text-lg font-semibold text-stone-800">How many people each evening?</p>
            {recipes.length === 0 ? (
              <p className="text-stone-400 text-sm">You need to add some recipes to your cookbook first.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {[...homeDates].sort().map(date => {
                    const d = new Date(date + 'T00:00:00')
                    const dow = DAYS[(d.getDay() + 6) % 7]
                    const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    return (
                      <div key={date} className="card flex items-center gap-3 py-3">
                        <div className="w-12 flex-shrink-0">
                          <p className="text-xs font-semibold text-stone-500 uppercase">{capitalise(dow.slice(0, 3))}</p>
                          <p className="text-xs text-stone-400">{dateLabel}</p>
                        </div>
                        <div className="flex gap-1.5 flex-1">
                          {[1, 2, 3, 4, 5, 6].map(n => (
                            <button key={n}
                              onClick={() => setPeoplePerDate(prev => ({ ...prev, [date]: n }))}
                              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors
                                ${peoplePerDate[date] === n
                                  ? 'bg-brand-500 text-white'
                                  : 'bg-stone-100 text-stone-600 active:bg-brand-100 active:text-brand-700'
                                }`}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button className="btn-primary" onClick={() => { setPlan(buildPlan()); setStep('review') }}>
                  Continue →
                </button>
              </>
            )}
            <button onClick={() => freezerTotal > 0 ? setStep('freezer') : setStep('days')} className="text-xs text-stone-400 block">
              ← Back
            </button>
          </div>
        )}

        {/* ── Step 5: review & confirm ── */}
        {planning && step === 'review' && (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold text-stone-800">Here's your plan</p>
              <p className="text-sm text-stone-400 mt-1">
                Drag to reorder · tap 🔄 to swap · tap ×2/×3 to batch cook
              </p>
            </div>

            <div className="space-y-2">
              {plan.map((entry, i) => {
                const d = new Date(entry.date + 'T00:00:00')
                const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                return (
                  <div key={entry.date}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={e => { e.preventDefault(); setDragOverIndex(i) }}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={e => { e.preventDefault(); handleDrop(i) }}
                    onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
                    className={`card flex items-center gap-3 cursor-grab active:cursor-grabbing transition-all
                      ${dragIndex === i ? 'opacity-40 scale-95' : ''}
                      ${dragOverIndex === i && dragIndex !== i ? 'ring-2 ring-brand-400 bg-brand-50' : ''}`}>
                    <div className="w-12 flex-shrink-0">
                      <p className="text-xs font-semibold text-stone-500 uppercase">{entry.day.slice(0, 3)}</p>
                      <p className="text-xs text-stone-400">{dateLabel}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {entry.fromFreezer && <span className="text-sm leading-none">❄️</span>}
                        <p className="font-medium text-stone-900 truncate">{entry.recipeName}</p>
                      </div>
                      <p className="text-xs text-stone-400">
                        {entry.numPeople} people{entry.fromFreezer ? ' · from freezer' : ''}
                      </p>
                    </div>
                    {!entry.fromFreezer && (
                      <div className="flex items-center gap-1.5 flex-shrink-0" onDragStart={e => e.stopPropagation()}>
                        <button onClick={() => cycleBatch(i)}
                          className={`text-xs rounded-lg px-2 py-1 font-medium transition-colors
                            ${entry.batchMultiplier > 1 ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-400'}`}>
                          ×{entry.batchMultiplier}
                        </button>
                        <button onClick={() => swapRecipe(i)}
                          className="text-base p-1 text-stone-400 active:text-brand-500 transition-colors">
                          🔄
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button className="btn-primary" onClick={savePlan} disabled={saving}>
              {saving ? 'Saving…' : '✅ Save & generate shopping list'}
            </button>
            <button className="btn-secondary" onClick={() => setPlanning(false)}>Cancel</button>
          </div>
        )}

      </div>
    </div>
  )
}
