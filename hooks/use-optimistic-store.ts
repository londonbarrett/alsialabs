"use client"

import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import type { ApplyAction, OptimisticStore } from "@/lib/optimistic-store"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import type { StoreApi, UseBoundStore } from "zustand"

type StoreHook<S, A> = UseBoundStore<StoreApi<OptimisticStore<S, A>>>

/**
 * Derives the optimistic state (committed + pending actions applied in order)
 * so any component can render it without needing to own a useOptimistic hook.
 */
export function useOptimisticDerived<S, A>(
  store: StoreHook<S, A>,
  applyAction: ApplyAction<S, A>
): S {
  const committed = store((s) => s.committed)
  const pending = store((s) => s.pending)
  return useMemo(
    () =>
      pending.reduce(
        (acc, item) => applyAction(acc, item.key, item.action),
        committed
      ),
    [committed, pending, applyAction]
  )
}

function defaultIsSuccess(result: unknown): boolean {
  const r = result as {
    success?: boolean
    data?: unknown
    hasRedirected?: boolean
    serverError?: unknown
    error?: unknown
    validationErrors?: unknown
  }
  if (r.serverError !== undefined || r.validationErrors !== undefined)
    return false
  if (r.success !== undefined) return r.success !== false
  return r.data !== undefined || r.hasRedirected === true
}

export interface RunOptions<Result, A> {
  /** Scope key — e.g. clientId for keyed stores. */
  key?: string
  /**
   * Action applied on commit *after* the original pending action, e.g.
   * swap a temp entry for the real server-returned one via replaceTemp.
   */
  commitAction?: A | ((result: Result) => A)
  isSuccess?: (result: Result) => boolean
  onSuccess?: (result: Result) => void
  onFailure?: (result: Result) => void
}

export function useOptimisticAction<S, A>(store: StoreHook<S, A>) {
  const { start: startLoading, stop: stopLoading } = useLoadingIndicator()
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  /**
   * Optimistically pends `action`, runs the server mutation, then commits
   * (persists) on success or discards (auto-reverts) on failure. Drives the
   * global loading indicator plus a local `isPending` flag.
   */
  async function run<Result>(
    action: A,
    execute: () => Promise<Result>,
    options: RunOptions<Result, A> = {}
  ): Promise<Result> {
    const id = store.getState().pend(action, options.key)
    setIsPending(true)
    startLoading()
    try {
      const result = await execute()
      const isSuccess = options.isSuccess
        ? options.isSuccess(result)
        : defaultIsSuccess(result)
      if (isSuccess) {
        const resolvedAction =
          typeof options.commitAction === "function"
            ? (options.commitAction as (result: Result) => A)(result)
            : options.commitAction
        store.getState().commit(id, resolvedAction)
        options.onSuccess?.(result)
        router.refresh()
      } else {
        store.getState().discard(id)
        options.onFailure?.(result)
      }
      return result
    } catch (error) {
      store.getState().discard(id)
      options.onFailure?.(error as Result)
      throw error
    } finally {
      setIsPending(false)
      stopLoading()
    }
  }

  return { run, isPending }
}