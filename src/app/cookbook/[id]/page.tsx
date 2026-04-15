'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Recipe } from '@/lib/supabase'

export default function RecipePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.from('recipes').select('*').eq('id', params.id).single()
      .then(({ data }) => { setRecipe(data); setLoading(false) })
  }, [params.id])

  async function deleteRecipe() {
    if (!confirm('Delete this recipe?')) return
    setDeleting(true)
    await supabase.from('recipes').delete().eq('id', params.id)
    router.push('/cookbook')
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-stone-400">Loading…</div>
  if (!recipe) return <div className="flex items-center justify-center min-h-screen text-stone-400">Recipe not found</div>

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="text-stone-400 -ml-1 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button onClick={deleteRecipe} disabled={deleting}
            className="text-sm text-red-400 active:text-red-600 px-2 py-1">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-5">
        {/* Hero */}
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{recipe.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-stone-500">
            <span>Serves {recipe.servings}</span>
            {recipe.tags.map(tag => (
              <span key={tag} className="bg-brand-100 text-brand-700 rounded-full px-2 py-0.5 text-xs">
                {tag}
              </span>
            ))}
          </div>
          {recipe.source_url && (
            <a href={recipe.source_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-brand-500 mt-1 block truncate">
              {recipe.source_url}
            </a>
          )}
        </div>

        {/* Ingredients */}
        <div className="card">
          <h2 className="font-semibold text-stone-700 mb-3">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2">
                <span className="text-stone-800">{ing.name}</span>
                <span className="text-stone-400 text-sm flex-shrink-0">
                  {ing.quantity > 0 && ing.quantity} {ing.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Method */}
        {recipe.method.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-stone-700 mb-3">Method</h2>
            <ol className="space-y-4">
              {recipe.method.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold
                                   flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-stone-700 text-sm leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {recipe.notes && (
          <div className="card bg-amber-50 border-amber-100">
            <h2 className="font-semibold text-amber-800 mb-1">Notes</h2>
            <p className="text-amber-700 text-sm">{recipe.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
