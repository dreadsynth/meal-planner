import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { messages, weekStart } = await req.json()

  // Fetch the cookbook so the AI knows what recipes are available
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, servings, tags')
    .order('name')

  const recipeList = (recipes ?? [])
    .map((r: { id: string; name: string; servings: number; tags: string[] }) =>
      `- ${r.name} (serves ${r.servings}, tags: ${r.tags.join(', ') || 'none'}) [id: ${r.id}]`)
    .join('\n')

  const systemPrompt = `You are a friendly, concise meal planning assistant for a family of 2 adults.
You help plan evening meals for the week, building the plan conversationally step by step.

Available recipes in their cookbook:
${recipeList || 'No recipes yet — tell the user to add some in the Cookbook tab first.'}

Today's date: ${new Date().toISOString().split('T')[0]}
Week start (Monday): ${weekStart}

CONVERSATION FLOW — follow this order:
1. Ask how many evenings they're eating at home (1–7)
2. If fewer than 7, ask WHICH days they're not eating at home (list the days)
3. Ask if any of those evenings are for more or fewer than 2 people (2 is default)
4. Generate a randomised meal plan from the cookbook for the days they need. Present it clearly day by day.
5. Ask if they'd like to swap any meals. Handle swaps conversationally.
6. Ask if they'd like to double-batch (cook double and freeze) any meals.
7. Ask "Ready to save this plan and generate your shopping list?"
8. If yes: call the save_meal_plan function, then call generate_shopping_list.

RULES:
- Be warm, brief, and conversational. No long paragraphs.
- When presenting the plan, format it clearly: "Monday: Spaghetti Bolognese" etc.
- Never suggest a recipe not in the cookbook.
- If the cookbook is empty, tell them to add recipes first.
- After saving, confirm with "✅ Plan saved! Your shopping list is ready in the Shopping tab."

FUNCTION CALLING:
When the user confirms they're happy with the plan, you MUST call save_meal_plan with the complete plan data.
After saving, call generate_shopping_list.`

  // Build Anthropic messages (strip any special fields)
  const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const tools: Anthropic.Tool[] = [
    {
      name: 'save_meal_plan',
      description: 'Save the confirmed meal plan to the database',
      input_schema: {
        type: 'object' as const,
        properties: {
          meals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day_of_week: { type: 'string', enum: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] },
                recipe_id: { type: 'string' },
                num_people: { type: 'number' },
                batch_multiplier: { type: 'number' },
              },
              required: ['day_of_week', 'recipe_id', 'num_people', 'batch_multiplier']
            }
          }
        },
        required: ['meals']
      }
    },
    {
      name: 'generate_shopping_list',
      description: 'Generate and save a shopping list from the current meal plan',
      input_schema: {
        type: 'object' as const,
        properties: {
          week_start: { type: 'string' }
        },
        required: ['week_start']
      }
    }
  ]

  let planSaved = false

  try {
    // Agentic loop — keep calling Claude until it stops using tools
    const currentMessages: Anthropic.MessageParam[] = [...anthropicMessages]
    let reply = ''

    while (true) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: currentMessages,
        tools,
      })

      // Collect text and execute any tool calls in this turn
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type === 'text') {
          reply += block.text
        } else if (block.type === 'tool_use') {
          let result = 'ok'

          if (block.name === 'save_meal_plan') {
            const input = block.input as { meals: Array<{ day_of_week: string; recipe_id: string; num_people: number; batch_multiplier: number }> }
            await supabase.from('meal_plans').delete().eq('week_start', weekStart)
            const rows = input.meals.map((m) => ({
              week_start: weekStart,
              day_of_week: m.day_of_week,
              recipe_id: m.recipe_id,
              num_people: m.num_people,
              batch_multiplier: m.batch_multiplier,
            }))
            await supabase.from('meal_plans').insert(rows)
            planSaved = true
            result = 'Meal plan saved successfully.'
          }

          if (block.name === 'generate_shopping_list') {
            await generateShoppingList(weekStart)
            result = 'Shopping list generated successfully.'
          }

          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
        }
      }

      // If Claude is done with tools, we're finished
      if (response.stop_reason !== 'tool_use') break

      // Otherwise feed the assistant turn + tool results back and loop
      currentMessages.push({ role: 'assistant', content: response.content })
      currentMessages.push({ role: 'user', content: toolResults })
    }

    if (!reply) {
      reply = planSaved
        ? '✅ Plan saved! Your shopping list is ready in the Shopping tab.'
        : 'Done!'
    }

    return NextResponse.json({ reply, planSaved })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ reply: `Sorry, something went wrong: ${msg}`, planSaved: false })
  }
}

async function generateShoppingList(weekStart: string) {
  // Fetch the meal plan with full recipe data
  const { data: meals } = await supabase
    .from('meal_plans')
    .select('*, recipe:recipes(*)')
    .eq('week_start', weekStart)

  if (!meals || meals.length === 0) return

  // Aggregate ingredients
  const combined: Record<string, { quantity: number; unit: string; category: string }> = {}

  for (const meal of meals) {
    const recipe = meal.recipe
    if (!recipe) continue

    const scale = (meal.num_people / recipe.servings) * (meal.batch_multiplier ?? 1)

    for (const ing of recipe.ingredients) {
      const key = `${ing.name.toLowerCase()}__${ing.unit}`
      if (combined[key]) {
        combined[key].quantity += ing.quantity * scale
      } else {
        combined[key] = {
          quantity: ing.quantity * scale,
          unit: ing.unit,
          category: guessCategory(ing.name),
        }
      }
    }
  }

  const items = Object.entries(combined).map(([key, val]) => ({
    name: key.split('__')[0],
    quantity: Math.round(val.quantity * 10) / 10,
    unit: val.unit,
    category: val.category,
  })).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

  const mealPlanIds = meals.map(m => m.id)

  // Upsert shopping list for this week
  await supabase.from('shopping_lists').delete().eq('week_start', weekStart)
  await supabase.from('shopping_lists').insert({
    week_start: weekStart,
    items,
    meal_plan_ids: mealPlanIds,
  })
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
