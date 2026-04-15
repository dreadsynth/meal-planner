'use client'
import { useState } from 'react'

export default function SettingsPage() {
  const [copied, setCopied] = useState(false)

  async function copyShortcutInstructions() {
    const text = `iPhone Shortcut — Push shopping list to Reminders

1. Open the Shortcuts app on your iPhone
2. Tap the + button to create a new shortcut
3. Add action: "Get Contents of URL"
   - URL: https://YOUR-APP-URL/api/shopping-list-feed
   - Method: GET
4. Add action: "Get Dictionary from Input"
5. Add action: "Repeat with each item in Dictionary Value for key: items"
   Inside the repeat block:
   - Add action: "Add New Reminder"
   - Title: Repeat Item > name
   - List: [select your shared list]
6. Tap the shortcut name at the top to rename it "Add Shopping List"
7. Add it to your home screen`

    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="section-title">Settings</h1>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">

        {/* About */}
        <div className="card space-y-1">
          <h2 className="font-semibold text-stone-700 mb-3">About this app</h2>
          <p className="text-sm text-stone-500 leading-relaxed">
            A family meal planner for two. Add recipes to your cookbook, generate a weekly
            meal plan by chatting with the assistant, and get an automatic shopping list.
          </p>
        </div>

        {/* Reminders integration */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-stone-700">iPhone Reminders</h2>
          <p className="text-sm text-stone-500 leading-relaxed">
            You can push your shopping list to a shared Reminders list using an iPhone Shortcut.
            Tap below to copy the setup instructions.
          </p>
          <button onClick={copyShortcutInstructions} className="btn-secondary py-2.5 text-sm">
            {copied ? '✓ Instructions copied!' : 'Copy Shortcut setup instructions'}
          </button>
          <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
            <p className="text-xs text-stone-400 leading-relaxed">
              <strong className="text-stone-500">Shortcut API endpoint:</strong><br/>
              <code className="font-mono text-xs break-all">/api/shopping-list-feed</code>
              <br/>Returns this week&apos;s shopping list as JSON so the Shortcut can read it.
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-stone-700">Tips</h2>
          <ul className="space-y-2 text-sm text-stone-500">
            {[
              'Add the app to your home screen from Safari — tap Share → Add to Home Screen',
              'Your partner can do the same — you\'ll share the same recipes and meal plans',
              'Tag recipes as "freezable" so the meal planner knows what to suggest for batch cooking',
              'The shopping list ticks are just for your session — they reset when you reload',
            ].map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-brand-400 flex-shrink-0">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center text-xs text-stone-300 pt-2">
          Built with Next.js, Supabase &amp; Claude
        </div>
      </div>
    </div>
  )
}
