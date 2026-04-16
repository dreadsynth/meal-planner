import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface MealInput {
  day_of_week: string
  recipe_id: string
  num_people: number
  batch_multiplier: number
  meal_date?: string   // actual YYYY-MM-DD of this meal
}

function generatePlanId(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

export async function POST(req: NextRequest) {
  const { weekStart, meals }: { weekStart: string; meals: MealInput[] } = await req.json()

  const planGroupId = generatePlanId()

  // Insert new plan rows — never delete old ones
  await supabase.from('meal_plans').insert(
    meals.map(m => ({
      week_start: weekStart,
      plan_group_id: planGroupId,
      day_of_week: m.day_of_week,
      recipe_id: m.recipe_id,
      num_people: m.num_people,
      batch_multiplier: m.batch_multiplier,
    }))
  )

  // Fetch just this plan's rows for shopping list generation
  const { data: mealData } = await supabase
    .from('meal_plans')
    .select('*, recipe:recipes(*)')
    .eq('plan_group_id', planGroupId)

  if (mealData && mealData.length > 0) {
    const combined: Record<string, { quantity: number; unit: string; category: string }> = {}

    for (const meal of mealData) {
      const recipe = meal.recipe
      if (!recipe) continue
      const scale = (meal.num_people / recipe.servings) * (meal.batch_multiplier ?? 1)
      for (const ing of recipe.ingredients) {
        const key = `${ing.name.toLowerCase()}__${ing.unit}`
        if (combined[key]) {
          combined[key].quantity += ing.quantity * scale
        } else {
          combined[key] = { quantity: ing.quantity * scale, unit: ing.unit, category: guessCategory(ing.name) }
        }
      }
    }

    const items = Object.entries(combined).map(([key, val]) => ({
      name: key.split('__')[0],
      quantity: Math.round(val.quantity * 10) / 10,
      unit: val.unit,
      category: val.category,
    })).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

    const coveredDays = mealData.map(m => m.day_of_week)
    await supabase.from('shopping_lists').insert({
      week_start: weekStart,
      plan_group_id: planGroupId,
      covered_days: coveredDays,
      items,
      meal_plan_ids: mealData.map(m => m.id),
    })
  }

  // Auto-add excess batch-cooked meals to the freezer
  const freezerRows = meals
    .filter(m => m.batch_multiplier > 1)
    .map(m => ({
      recipe_id: m.recipe_id,
      portions: m.batch_multiplier - 1,
      cooked_on: m.meal_date ?? null,
      plan_group_id: planGroupId,
    }))
  if (freezerRows.length > 0) {
    await supabase.from('freezer_items').insert(freezerRows)
  }

  return NextResponse.json({ success: true, planGroupId })
}

function guessCategory(name: string): string {
  const n = name.toLowerCase()
  if (/chicken|beef|pork|lamb|mince|sausage|bacon|turkey|duck/.test(n)) return 'meat'
  if (/salmon|tuna|cod|prawn|fish|mussel|anchovy/.test(n)) return 'fish'
  if (/milk|cream|butter|cheese|yogurt|egg/.test(n)) return 'dairy & eggs'
  if (/bread|flour|rice|pasta|noodle|oat|cereal/.test(n)) return 'grains & pasta'
  if (/apple|banana|berry|lemon|lime|orange|tomato|avocado|pepper|onion|garlic|carrot|potato|courgette|spinach|lettuce|cucumber|mushroom|celery|leek/.test(n)) return 'produce'
  if (/tin|can|stock|sauce|paste|puree|coconut|bean|lentil|chickpea/.test(n)) return 'tins & jars'
  if (/oil|vinegar|soy|worcester|mustard|honey|sugar|salt|pepper|spice|herb|cumin|paprika|turmeric|coriander|oregano|thyme|basil/.test(n)) return 'pantry'
  if (/wine|beer|juice|water/.test(n)) return 'drinks'
  return 'other'
}
