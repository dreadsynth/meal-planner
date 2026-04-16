'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, MealPlan, FreezerItem, DAYS } from '@/lib/supabase'

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function computeActualDate(weekStart: string, dayOfWeek: string): string {
  const start = new Date(weekStart + 'T00:00:00')
  const startDow = (start.getDay() + 6) % 7
  const targetDow = DAYS.indexOf(dayOfWeek as typeof DAYS[number])
  const offset = (targetDow - startDow + 7) % 7
  const d = new Date(start)
  d.setDate(d.getDate() + offset)
  return localDateStr(d)
}

export default function HomePage() {
  const [mealMap, setMealMap] = useState<Record<string, string>>({})
  const [freezerItems, setFreezerItems] = useState<FreezerItem[]>([])
  const [recipeCount, setRecipeCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const next7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    return {
      date: localDateStr(d),
      label: i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'long' }),
      short: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    }
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const todayStr = localDateStr(new Date())
      const earliest = localDateStr(new Date(new Date().setDate(new Date().getDate() - 6)))

      const [plansRes, freezerRes, recipesRes] = await Promise.all([
        supabase
          .from('meal_plans')
          .select('week_start, day_of_week, recipe:recipes(name)')
          .gte('week_start', earliest)
          .order('created_at', { ascending: false }),
        supabase.from('freezer_items').select('*, recipe:recipes(name)'),
        supabase.from('recipes').select('*', { count: 'exact', head: true }),
      ])

      // Build date → recipe name (newest plan wins for each date)
      const map: Record<string, string> = {}
      for (const row of (plansRes.data ?? []) as (MealPlan & { recipe: { name: string } | null })[]) {
        const actualDate = computeActualDate(row.week_start, row.day_of_week)
        if (actualDate >= todayStr && !map[actualDate]) {
          map[actualDate] = row.recipe?.name ?? 'Unknown'
        }
      }

      setMealMap(map)
      setFreezerItems(freezerRes.data ?? [])
      setRecipeCount(recipesRes.count ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  // Freezer summary grouped by recipe
  const freezerByRecipe: Record<string, { name: string; total: number }> = {}
  for (const item of freezerItems) {
    if (!freezerByRecipe[item.recipe_id]) {
      freezerByRecipe[item.recipe_id] = { name: item.recipe?.name ?? 'Unknown', total: 0 }
    }
    freezerByRecipe[item.recipe_id].total += item.portions
  }
  const freezerSummary = Object.values(freezerByRecipe)
  const freezerTotal = freezerItems.reduce((sum, i) => sum + i.portions, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-stone-400">Loading…</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="section-title">Home</h1>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-6">

        {/* ── Next 7 days ── */}
        <section>
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Next 7 days</h2>
          <div className="card p-0 divide-y divide-stone-100">
            {next7.map(({ date, label, short }) => {
              const meal = mealMap[date]
              return (
                <div key={date} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-20 flex-shrink-0">
                    <p className="text-xs font-semibold text-stone-700">{label}</p>
                    <p className="text-xs text-stone-400">{short}</p>
                  </div>
                  <p className={`text-sm flex-1 ${meal ? 'text-stone-900 font-medium' : 'text-stone-300 italic'}`}>
                    {meal ?? 'No meal planned'}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Freezer ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Freezer</h2>
            <Link href="/freezer" className="text-xs text-brand-500 font-medium">View all</Link>
          </div>
          {freezerTotal === 0 ? (
            <div className="card py-4 text-center text-stone-400 text-sm italic">Freezer is empty</div>
          ) : (
            <div className="card p-0 divide-y divide-stone-100">
              {freezerSummary.map(({ name, total }) => (
                <div key={name} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-stone-800">{name}</p>
                  <span className="text-xs font-semibold text-brand-600 bg-brand-50 rounded-full px-2 py-0.5">
                    {total} meal{total !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Cookbook ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Cookbook</h2>
            <Link href="/cookbook" className="text-xs text-brand-500 font-medium">View all</Link>
          </div>
          <div className="card p-0 divide-y divide-stone-100">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-stone-500">Recipes saved</p>
              <span className="text-xs font-semibold text-brand-600 bg-brand-50 rounded-full px-2 py-0.5">
                {recipeCount}
              </span>
            </div>
            <Link href="/cookbook/add" className="flex items-center gap-3 px-4 py-3 active:bg-stone-50 transition-colors">
              <p className="text-sm text-stone-800 flex-1">Import recipe from URL</p>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-300 flex-shrink-0">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
            <Link href="/cookbook/add" className="flex items-center gap-3 px-4 py-3 active:bg-stone-50 transition-colors">
              <p className="text-sm text-stone-800 flex-1">Add recipe manually</p>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-300 flex-shrink-0">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          </div>
        </section>

      </div>
    </div>
  )
}
