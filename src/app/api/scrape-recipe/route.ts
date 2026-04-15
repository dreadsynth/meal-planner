import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

  try {
    // Fetch the page HTML
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MealPlannerBot/1.0)' }
    })
    if (!pageRes.ok) throw new Error(`Could not fetch page: ${pageRes.status}`)
    const html = await pageRes.text()

    // Strip tags for Claude (keep it concise)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000) // keep within token budget

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract the recipe from this page text and return ONLY valid JSON (no markdown, no backticks).

Return this exact structure:
{
  "name": "Recipe name",
  "servings": 4,
  "notes": "Any tips or notes from the recipe",
  "tags": ["tag1", "tag2"],
  "ingredients": [
    {"name": "ingredient name", "quantity": 1.5, "unit": "g", "notes": "optional note"}
  ],
  "method": ["Step 1 text", "Step 2 text"]
}

Rules:
- quantity must be a number (0 if unknown)
- unit should be: g, kg, ml, l, tsp, tbsp, cup, whole, or a descriptive word
- tags: pick from [vegetarian, vegan, quick, freezable, meat, fish, pasta, soup, bake]
- method: each step as a plain string
- If a field is unknown, use null

Page text:
${text}`
      }]
    })

    const raw = (message.content[0] as { text: string }).text.trim()
    const recipe = JSON.parse(raw)
    return NextResponse.json(recipe)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
