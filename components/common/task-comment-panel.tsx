"use client"

import { TaskCommentBubble } from "@/components/common/task-comment-bubble"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { TaskCommentWithAuthor } from "@/lib/types"
import { RefreshCw, Send } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

/**
 * The comments slide-over, with no data access of its own.
 *
 * Each domain supplies a controller: `ProjectTaskCommentsPanel` for project
 * tasks (backed by `ProjectTasksProvider`) and `MyTaskCommentsPanel` for
 * `my-tasks` (local `useOptimistic` state until that domain gets a store).
 * Both render this, so the markup and scroll behaviour exist once instead of
 * drifting apart per domain.
 *
 * Only ephemeral form state lives here — the draft text and the scroll
 * position; each comment's edit-in-place state lives in its own
 * `TaskCommentBubble`. Loading, fetching and mutations belong to the
 * controller.
 */
interface TaskCommentPanelProps {
  taskName: string
  description?: string | null
  comments: TaskCommentWithAuthor[]
  loading: boolean
  currentUserId: string
  /** Whether the viewer may delete any comment on the task. */
  canModerate: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
  onCreate: (content: string) => void
  onEdit: (commentId: string, content: string) => void
  onDelete: (commentId: string) => void
}

export function TaskCommentPanel({
  taskName,
  description,
  comments,
  loading,
  currentUserId,
  canModerate,
  open,
  onOpenChange,
  onRefresh,
  onCreate,
  onEdit,
  onDelete,
}: TaskCommentPanelProps) {
  const t = useTranslations()
  const [newComment, setNewComment] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments])

  function handleCreate() {
    const content = newComment.trim()
    if (!content) return
    setNewComment("")
    onCreate(content)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-base">{taskName}</SheetTitle>
          {description && (
            <SheetDescription>{description}</SheetDescription>
          )}
        </SheetHeader>

        <div className="flex items-center justify-between px-4 pt-2">
          <span className="text-sm font-medium">
            {t("projects.tasks.comments.title")}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3"
        >
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("projects.tasks.comments.noComments")}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {comments.map((comment) => (
                <TaskCommentBubble
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  canModerate={canModerate}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3">
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleCreate()
                }
              }}
              placeholder={t("projects.tasks.comments.addComment")}
              rows={2}
              className="resize-none"
            />
            <Button
              size="icon"
              onClick={handleCreate}
              disabled={!newComment.trim()}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
