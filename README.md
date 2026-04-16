# Family Meal Planner

A mobile-optimised meal planning PWA built with Next.js, Supabase, and Claude AI. Designed to be added to an iPhone home screen via Safari.

## Features

- **Home** — 7-day meal overview, freezer summary, and quick cookbook links
- **Cookbook** — import recipes by URL (Claude AI extracts them) or add manually
- **Meal Planner** — generate a weekly plan with recipe suggestions; supports batch cooking (×2/×3) and pulling meals from the freezer
- **Shopping List** — auto-generated from the meal plan, tick items off as you shop; deleted only by deleting the meal plan
- **Freezer** — track batch-cooked meals stored in the freezer; automatically depleted when used in a meal plan

## First-time setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env.local
```

Fill in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Create the database tables

Run the SQL in `database.sql` in the Supabase SQL editor. This creates four tables:
- `recipes` — the cookbook
- `meal_plans` — one row per planned meal (grouped by `plan_group_id`)
- `shopping_lists` — auto-generated per meal plan
- `freezer_items` — batch-cooked meals stored in the freezer

### 4. Run locally
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To test on your phone during development, use your computer's local IP instead of `localhost`.

## Deploying to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add the three environment variables from `.env.local` in Vercel's project settings
4. Deploy

## Adding to iPhone home screen

1. Open the app URL in Safari
2. Tap the Share button → **Add to Home Screen**
3. Tap Add — it behaves like a native app

## Project structure

```
src/
  app/
    page.tsx                    # Home dashboard
    cookbook/                   # Recipe list, detail, add, edit pages
    meal-planner/               # Meal plan wizard + history
    shopping-list/              # Tick-off shopping list
    freezer/                    # Freezer inventory
    settings/                   # App settings
    api/
      scrape-recipe/            # AI-powered recipe URL importer
      save-meal-plan/           # Saves plan + generates shopping list + updates freezer
      meal-planner-chat/        # Conversational AI meal planner (legacy)
      shopping-list-feed/       # JSON feed for iPhone Shortcuts
  components/
    BottomNav.tsx               # Mobile tab bar (Home, Cookbook, Meal Plan, Shopping, Freezer, Settings)
  lib/
    supabase.ts                 # Supabase client + shared TypeScript types
```

## Meal planning flow

1. Pick a start date
2. Select which evenings you're eating at home
3. Choose any evenings to use a freezer meal (shown only if freezer has stock)
4. Set how many people each evening
5. Review the generated plan — swap recipes, reorder days, set batch multiplier (×2 or ×3)
6. Save — shopping list is auto-generated; batch-cooked excess portions are added to the freezer

## Batch cooking & freezer

- Setting a meal to ×2 cooks double: you eat one portion and one goes to the freezer
- Setting a meal to ×3 cooks triple: you eat one, two go to the freezer
- Freezer stock can also be added manually from the Freezer tab
- When a freezer meal is used in a plan, the inventory is decremented automatically on save
