import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function currentWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

export async function GET() {
  const weekStart = currentWeekStart()
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('*')
    .eq('week_start', weekStart)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No shopping list for this week' }, { status: 404 })
  }

  // Return in a format easy for iPhone Shortcuts to consume
  return NextResponse.json({
    week_start: data.week_start,
    generated_at: data.created_at,
    items: data.items.map((item: { name: string; quantity: number; unit: string; category: string }) => ({
      name: item.quantity
        ? `${item.quantity}${item.unit && item.unit !== 'whole' ? item.unit : '×'} ${item.name}`
        : item.name,
      category: item.category,
    }))
  })
}
