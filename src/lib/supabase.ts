import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Types matching our database schema ───────────────────────

export interface Ingredient {
  name: string
  quantity: number
  unit: string        // e.g. "g", "ml", "whole", "tbsp"
  notes?: string
}

export interface Recipe {
  id: string
  created_at: string
  updated_at: string
  name: string
  source_url?: string
  servings: number
  notes?: string
  ingredients: Ingredient[]
  method: string[]
  image_url?: string
  tags: string[]
}

export interface MealPlan {
  id: string
  created_at: string
  week_start: string  // ISO date string e.g. "2025-04-14"
  day_of_week: DayOfWeek
  recipe_id: string
  num_people: number
  is_double_batch: boolean
  recipe?: Recipe     // joined
}

export type DayOfWeek =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday'

export interface ShoppingListItem {
  name: string
  quantity: number
  unit: string
  category: string    // e.g. "produce", "meat", "dairy"
}

export interface ShoppingList {
  id: string
  created_at: string
  week_start: string
  items: ShoppingListItem[]
  meal_plan_ids: string[]
  pushed_to_reminders_at?: string
}

// ── Date helpers ──────────────────────────────────────────────

/** Returns the Monday of the current week as a YYYY-MM-DD string */
export function currentWeekStart(): string {
  const now = new Date()
  const day = now.getDay()               // 0 = Sun, 1 = Mon …
  const diff = day === 0 ? -6 : 1 - day // offset to Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

/** Returns an ordered list of days */
export const DAYS: DayOfWeek[] = [
  'monday','tuesday','wednesday','thursday','friday','saturday','sunday'
]

export function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
