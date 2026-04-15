# 🍽️ Family Meal Planner

A mobile-optimised meal planning app built with Next.js, Supabase, and Claude AI.

## First-time setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add the Anthropic SDK
```bash
npm install @anthropic-ai/sdk
```

### 3. Set up environment variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Run locally
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your computer.
To test on your phone while developing, use your computer's local IP instead of localhost.

## Deploying to Vercel

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. In Vercel's Environment Variables section, add the same three variables from your `.env.local`
4. Click Deploy

Your app will be live at `https://your-project.vercel.app`.

## Adding to iPhone home screen

1. Open the app URL in Safari on your iPhone
2. Tap the Share button (box with arrow)
3. Scroll down and tap **Add to Home Screen**
4. Tap Add — it now works like a native app

## Project structure

```
src/
  app/
    cookbook/          # Recipe list + add + detail pages
    meal-planner/      # Conversational meal planning
    shopping-list/     # Tick-off shopping list
    settings/          # Tips and Reminders setup
    api/
      scrape-recipe/   # AI-powered recipe importer
      meal-planner-chat/ # Conversational meal planning AI
      shopping-list-feed/ # JSON feed for iPhone Shortcut
  components/
    BottomNav.tsx      # Mobile tab bar
  lib/
    supabase.ts        # DB client + shared types
```

## Database

Run the SQL in `database.sql` (or the SQL you already ran in Supabase) to create the three tables:
- `recipes` — your cookbook
- `meal_plans` — weekly plan (one row per day)
- `shopping_lists` — generated shopping list per week
