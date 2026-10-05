"use client"

import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import type { OptimisticStore } from "@/lib/optimistic-store"
import { useRouter } from "next/navigation"
import type { StoreApi } from "zustand"

type StoreApiType<S, A> = StoreApi<OptimisticStore<S, A>>

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

interface RunOptions<Result, A> {
  /**
   * Action applied on commit *after* the original pending action, e.g.
   * swap a temp entry for the real server-returned one via replaceTemp.
   */
  commitAction?: A | ((result: Result) => A)
}

export function useOptimisticAction<S, A>(store: StoreApiType<S, A>) {
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const router = useRouter()

  /**
   * Optimistically pends `action`, runs the server mutation, then commits
   * (persists) on success or discards (auto-reverts) on failure. Drives the
   * global loading indicator.
   */
  async function run<Result>(
    action: A,
    execute: () => Promise<Result>,
    options: RunOptions<Result, A> = {}
  ): Promise<Result> {
    const id = store.getState().pend(action)
    startLoading()
    try {
      const result = await execute()
      if (defaultIsSuccess(result)) {
        const commitAction =
          typeof options.commitAction === "function"
            ? (options.commitAction as (result: Result) => A)(result)
            : options.commitAction
        store.getState().commit(id, commitAction)
        router.refresh()
      } else {
        store.getState().discard(id)
      }
      return result
    } catch (error) {
      store.getState().discard(id)
      throw error
    } finally {
      stopLoading()
    }
  }

  return { run }
}
