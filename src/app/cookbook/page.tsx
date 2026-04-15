'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Recipe } from '@/lib/supabase'

export default function CookbookPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadRecipes()
  }, [])

  async function loadRecipes() {
    setLoading(true)
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .order('name')
    setRecipes(data ?? [])
    setLoading(false)
  }

  const filtered = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <h1 className="section-title">Cookbook</h1>
          <Link href="/cookbook/add" className="btn-ghost text-sm">+ Add</Link>
        </div>
        <input
          className="input mt-3"
          placeholder="Search recipes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading && (
          <div className="text-center py-16 text-stone-400">Loading…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-stone-400 mb-4">
              {recipes.length === 0
                ? 'Your cookbook is empty'
                : 'No recipes match your search'}
            </p>
            {recipes.length === 0 && (
              <Link href="/cookbook/add" className="btn-primary inline-block w-auto px-6">
                Add your first recipe
              </Link>
            )}
          </div>
        )}

        {filtered.map(recipe => (
          <Link key={recipe.id} href={`/cookbook/${recipe.id}`}
            className="card flex items-center gap-3 active:bg-stone-50 transition-colors block">
            <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center
                            text-brand-600 text-xl flex-shrink-0">
              🍽️
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-stone-900 truncate">{recipe.name}</p>
              <p className="text-sm text-stone-400">
                Serves {recipe.servings}
                {recipe.tags.length > 0 && ` · ${recipe.tags.join(', ')}`}
              </p>
            </div>
            <svg className="text-stone-300 flex-shrink-0" width="16" height="16"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
