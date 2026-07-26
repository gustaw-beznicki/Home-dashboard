import { useEffect, useState } from 'react'
import { CATEGORIES } from '../lib/constants'

// The category list is editable in Panel domu, so consumers (filter chips, the
// task sheet, card labels) read it from here instead of the constant. One
// module-level cache shared by every subscriber: the list changes rarely and
// several components need it on the same screen, so each render tree fetches
// at most once. The built-in list doubles as the answer while loading and the
// fallback when the request fails.
let cache = null
let inflight = null
const listeners = new Set()

function notify() {
  for (const listener of listeners) listener(cache)
}

function fetchCategories() {
  // Started inside a promise so environments where a relative-URL fetch throws
  // synchronously (jsdom under Node) degrade to the fallback like any failure.
  inflight ??= Promise.resolve()
    .then(() => fetch('/api/categories'))
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load categories'))))
    .then((data) => {
      cache = Array.isArray(data) && data.length > 0 ? data : CATEGORIES
    })
    .catch(() => {
      cache = CATEGORIES
    })
    .then(() => {
      inflight = null
      notify()
    })
  return inflight
}

// Panel domu calls this after adding or removing a category, so open screens
// pick the change up without a reload.
export function invalidateCategories() {
  cache = null
  fetchCategories()
}

export function useCategories() {
  const [categories, setCategories] = useState(cache ?? CATEGORIES)

  useEffect(() => {
    const listener = (next) => setCategories(next ?? CATEGORIES)
    listeners.add(listener)
    if (cache) setCategories(cache)
    else fetchCategories()
    return () => listeners.delete(listener)
  }, [])

  return categories
}

// Label lookup that tolerates keys of deleted or not-yet-loaded categories.
export function categoryLabel(categories, key) {
  return categories.find((c) => c.key === key)?.label ?? key
}
