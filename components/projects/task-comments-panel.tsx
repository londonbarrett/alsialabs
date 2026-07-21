"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useAction } from "@/hooks/use-action"
import {
  createComment,
  deleteComment,
  getTaskComments,
} from "@/lib/actions/task-comments"
import { MessageSquare, Send, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

interface TaskCommentWithAuthor {
  id: string
  taskId: string
  authorId: string
  authorName: string | null
  authorImage: string | null
  content: string
  createdAt: Date
}

interface TaskCommentsPanelProps {
  taskId: string
  taskName: string
  projectName: string
  description?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  isOwner: boolean
  onCommentCountChange?: (taskId: string, delta: number) => void
}

function getInitials(name: string | null) {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatRelativeTime(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export function TaskCommentsPanel({
  taskId,
  taskName,
  projectName,
  description,
  open,
  onOpenChange,
  currentUserId,
  isOwner,
  onCommentCountChange,
}: TaskCommentsPanelProps) {
  const t = useTranslations()
  const [comments, setComments] = useState<TaskCommentWithAuthor[]>([])
  const [newComment, setNewComment] = useState("")
  const [isPending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchComments = useCallback(async () => {
    try {
      const result = await getTaskComments(taskId)
      setComments(result)
    } catch {
      toast.error(t("common.somethingWentWrong"))
    }
  }, [taskId, t])

  useEffect(() => {
    if (open) {
      startTransition(() => {
        fetchComments()
      })
    }
  }, [open, fetchComments, startTransition])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments])

  const { isPending: isCreating, execute: executeCreate } = useAction(
    createComment,
    {
      onSuccess: (data) => {
        const d = data as { taskId: string; comments: TaskCommentWithAuthor[] }
        setComments(d.comments)
        setNewComment("")
        onCommentCountChange?.(d.taskId, 1)
      },
    }
  )

  const { isPending: isDeleting, execute: executeDelete } = useAction(
    deleteComment,
    {
      onSuccess: (data) => {
        const d = data as {
          taskId: string
          comments: TaskCommentWithAuthor[]
        }
        setComments(d.comments)
        onCommentCountChange?.(d.taskId, -1)
        toast.success(t("projects.tasks.comments.commentDeleted"))
      },
    }
  )

  function handleSend() {
    const content = newComment.trim()
    if (!content) return
    executeCreate(taskId, content)
  }

  function handleDelete(commentId: string) {
    executeDelete(commentId, taskId)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const sending = isCreating || isDeleting

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetDescription className="truncate">
            {projectName}
          </SheetDescription>
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            {taskName}
          </SheetTitle>
          {description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {description}
            </p>
          )}
        </SheetHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3"
        >
          {isPending ? (
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
                <div key={comment.id} className="group flex gap-3">
                  <Avatar size="sm">
                    <AvatarImage src={comment.authorImage ?? undefined} />
                    <AvatarFallback>
                      {getInitials(comment.authorName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">
                        {comment.authorName || t("auth.user")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(new Date(comment.createdAt))}
                      </span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                  </div>
                  {(comment.authorId === currentUserId || isOwner) && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={() => handleDelete(comment.id)}
                      disabled={sending}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3">
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("projects.tasks.comments.addComment")}
              rows={2}
              className="resize-none"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!newComment.trim() || sending}
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
