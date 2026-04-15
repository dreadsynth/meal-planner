# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
```

No test runner or linter is configured.

## Environment

Copy `.env.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `ANTHROPIC_API_KEY` — Anthropic API key for Claude

## Architecture

Next.js 16 App Router, Supabase (Postgres), Tailwind CSS, `@anthropic-ai/sdk`.

**Database (Supabase)** — three tables: `recipes`, `meal_plans`, `meal_plan_ids` (weekly, keyed by `week_start` as a Monday `YYYY-MM-DD` string), and `shopping_lists`. All types and the singleton `supabase` client live in `src/lib/supabase.ts`, which also exports `currentWeekStart()`, the `DAYS` array, and `capitalise()`.

**API routes** (all under `src/app/api/`):
- `scrape-recipe/route.ts` — fetches a URL, strips HTML to plain text, sends to Claude to extract structured recipe JSON (no DB write; the client saves it).
- `meal-planner-chat/route.ts` — stateless chat endpoint; receives the full message history + `weekStart`, fetches the cookbook, builds a system prompt, and calls Claude with two tools (`save_meal_plan`, `generate_shopping_list`). Tool execution (DB writes + ingredient aggregation) happens server-side in the same request.
- `shopping-list-feed/route.ts` — public `GET` endpoint returning the current week's shopping list in a flat format designed for iPhone Shortcuts.

**AI model** — both API routes use `claude-sonnet-4-6`. Update the model string in both files if you need to change it.

**Shopping list generation** — `generateShoppingList()` in `meal-planner-chat/route.ts` scales ingredient quantities by `(num_people / recipe.servings) * (is_double_batch ? 2 : 1)`, aggregates by `name__unit` key, then categorises via regex in `guessCategory()`.

**Frontend** — four pages (`cookbook`, `meal-planner`, `shopping-list`, `settings`) plus a `BottomNav` mobile tab bar. The app is a PWA (see `public/manifest.json`) intended to be added to an iPhone home screen via Safari.
