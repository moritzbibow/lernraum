'use client'

import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Topic } from '@/lib/db/schema'

type ReadingState = {
  activeTopic: string | null
  progress: Record<string, number>
  jumpTo: (topicId: string) => void
}

const ReadingContext = createContext<ReadingState>({ activeTopic: null, progress: {}, jumpTo: () => {} })

export function useReading() {
  return useContext(ReadingContext)
}

type Props = {
  pageId: string
  topics: Topic[]
  initialProgress: Record<string, number>
  articleId: string
  children: ReactNode
}

/**
 * Tracks what has been read: per topic (## section) the share that has
 * scrolled into view. ≥ 80 % counts as done. Also drives the scroll spy.
 */
export function ReadingProvider({ pageId, topics, initialProgress, articleId, children }: Props) {
  const router = useRouter()
  const [activeTopic, setActiveTopic] = useState<string | null>(topics[0]?.id ?? null)
  const [progress, setProgress] = useState<Record<string, number>>(initialProgress)
  const progressRef = useRef<Record<string, number>>({ ...initialProgress })
  const sentRef = useRef<Record<string, number>>({ ...initialProgress })

  // "Opened" – marks the inbox entry as seen and feeds "Weiterlernen".
  useEffect(() => {
    let cancelled = false
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'page-open', pageId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { hadUnseen?: boolean } | null) => {
        if (!cancelled && data?.hadUnseen) router.refresh()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pageId, router])

  useEffect(() => {
    const article = document.getElementById(articleId)
    if (!article) return
    const keys = topics.length ? topics.map((t) => t.id) : ['_all']

    const flush = (beacon = false) => {
      const changed: Record<string, number> = {}
      for (const [k, v] of Object.entries(progressRef.current)) {
        if (v > (sentRef.current[k] ?? 0) + 0.02 || (v >= 0.8 && (sentRef.current[k] ?? 0) < 0.8)) changed[k] = v
      }
      if (Object.keys(changed).length === 0) return
      Object.assign(sentRef.current, changed)
      const body = JSON.stringify({ type: 'progress', pageId, topics: changed })
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/activity', new Blob([body], { type: 'application/json' }))
      } else {
        fetch('/api/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
      }
    }

    let timer: number | undefined
    let frame = 0
    const measure = () => {
      frame = 0
      const viewTop = window.scrollY
      const viewBottom = viewTop + window.innerHeight
      const rect = article.getBoundingClientRect()
      const articleTop = rect.top + viewTop
      const articleEnd = rect.bottom + viewTop
      const starts = topics.length
        ? topics.map((t) => {
            const el = document.getElementById(`t-${t.id}`)
            return el ? el.getBoundingClientRect().top + viewTop : articleEnd
          })
        : [articleTop]

      let changed = false
      const next = { ...progressRef.current }
      keys.forEach((key, i) => {
        const start = starts[i]
        const end = i + 1 < starts.length ? starts[i + 1] : articleEnd
        const height = Math.max(1, end - start)
        const seen = Math.max(0, Math.min(1, (viewBottom - start) / height))
        if (seen > (next[key] ?? 0) + 0.005) {
          next[key] = Math.round(seen * 1000) / 1000
          changed = true
        }
      })
      if (changed) {
        progressRef.current = next
        setProgress(next)
        window.clearTimeout(timer)
        timer = window.setTimeout(() => flush(), 1500)
      }

      // Scroll spy: last topic whose heading passed 30 % of the viewport.
      if (topics.length) {
        const line = viewTop + window.innerHeight * 0.3
        let current = topics[0].id
        topics.forEach((t, i) => {
          if (starts[i] <= line) current = t.id
        })
        if (viewBottom >= document.documentElement.scrollHeight - 4) current = topics[topics.length - 1].id
        setActiveTopic(current)
      }
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush(true)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('visibilitychange', onHide)
      window.clearTimeout(timer)
      if (frame) window.cancelAnimationFrame(frame)
      flush(true)
    }
  }, [pageId, topics, articleId])

  const jumpTo = (topicId: string) => {
    const el = document.getElementById(`t-${topicId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', `#t-${topicId}`)
  }

  return <ReadingContext.Provider value={{ activeTopic, progress, jumpTo }}>{children}</ReadingContext.Provider>
}
