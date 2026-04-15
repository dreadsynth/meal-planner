'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase, MealPlan, currentWeekStart, DAYS, capitalise } from '@/lib/supabase'

interface Message { role: 'user' | 'assistant'; content: string }

export default function MealPlannerPage() {
  const [weekStart] = useState(currentWeekStart())
  const [mealPlan, setMealPlan] = useState<MealPlan[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [chatting, setChatting] = useState(false)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadPlan() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadPlan() {
    setLoading(true)
    const { data } = await supabase
      .from('meal_plans')
      .select('*, recipe:recipes(*)')
      .eq('week_start', weekStart)
      .order('day_of_week')
    setMealPlan(data ?? [])
    setLoading(false)
  }

  async function startChat() {
    setChatting(true)
    const greeting: Message = {
      role: 'assistant',
      content: "Hi! Let's plan your meals for this week 🍽️\n\nHow many evenings will you be eating at home this week?"
    }
    setMessages([greeting])
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/meal-planner-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, weekStart }),
      })
      const data = await res.json()

      const aiMsg: Message = { role: 'assistant', content: data.reply }
      setMessages(prev => [...prev, aiMsg])

      // If the AI saved a meal plan, reload it
      if (data.planSaved) { await loadPlan() }
      // If the AI generated a shopping list, it'll tell the user
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setSending(false)
    }
  }

  function weekLabel() {
    const d = new Date(weekStart + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  }

  const planByDay = Object.fromEntries(mealPlan.map(m => [m.day_of_week, m]))

  return (
    <div className="flex flex-col min-h-screen">
      <div className="page-header">
        <h1 className="section-title">Meal Planner</h1>
        <p className="text-sm text-stone-400 mt-0.5">Week of {weekLabel()}</p>
      </div>

      {/* Week overview */}
      {!chatting && (
        <div className="px-4 pt-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-stone-400">Loading…</div>
          ) : (
            <>
              {DAYS.map(day => {
                const meal = planByDay[day]
                return (
                  <div key={day} className="card flex items-center gap-3">
                    <div className="w-16 text-xs font-semibold text-stone-400 uppercase">{day.slice(0,3)}</div>
                    {meal ? (
                      <div className="flex-1">
                        <p className="font-medium text-stone-900">{meal.recipe?.name}</p>
                        <p className="text-xs text-stone-400">
                          {meal.num_people} people
                          {meal.is_double_batch && ' · double batch'}
                        </p>
                      </div>
                    ) : (
                      <p className="flex-1 text-stone-300 text-sm">Not planned</p>
                    )}
                  </div>
                )
              })}

              <button className="btn-primary mt-2" onClick={startChat}>
                ✨ Generate weekly meal plan
              </button>

              {mealPlan.length > 0 && (
                <button className="btn-secondary" onClick={async () => {
                  await supabase.from('meal_plans').delete().eq('week_start', weekStart)
                  await loadPlan()
                }}>
                  Clear this week
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Chat interface */}
      {chatting && (
        <div className="flex flex-col flex-1">
          <div className="flex-1 px-4 pt-4 pb-2 space-y-3 overflow-y-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}>
                  {msg.content.split('\n').map((line, j) => (
                    <span key={j}>{line}{j < msg.content.split('\n').length - 1 && <br/>}</span>
                  ))}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bubble-ai text-stone-400">Thinking…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-4 pb-4 pt-2 flex gap-2 items-end border-t border-stone-100 bg-stone-50">
            <textarea
              className="input flex-1 resize-none text-sm py-2.5"
              placeholder="Type your reply…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              rows={1}
            />
            <button onClick={sendMessage} disabled={!input.trim() || sending}
              className="bg-brand-500 text-white rounded-xl px-4 py-2.5 font-medium
                         active:bg-brand-600 disabled:opacity-40 transition-colors">
              Send
            </button>
          </div>

          <div className="px-4 pb-2">
            <button onClick={() => { setChatting(false); loadPlan() }} className="text-xs text-stone-400">
              ← Back to plan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
