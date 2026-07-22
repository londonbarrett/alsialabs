"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  createComment,
  deleteComment,
  getTaskComments,
  updateComment,
} from "@/lib/actions/task-comments"
import { MessageSquare, Pencil, Send, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"

interface TaskCommentWithAuthor {
  id: string
  taskId: string
  authorId: string
  authorName: string | null
  authorImage: string | null
  content: string
  createdAt: Date
  updatedAt: Date
}

type CommentAction =
  | { type: "add"; comment: TaskCommentWithAuthor }
  | { type: "delete"; commentId: string }
  | { type: "update"; commentId: string; content: string }

function commentReducer(
  state: TaskCommentWithAuthor[],
  action: CommentAction
): TaskCommentWithAuthor[] {
  switch (action.type) {
    case "add":
      return [...state, action.comment]
    case "delete":
      return state.filter((c) => c.id !== action.commentId)
    case "update":
      return state.map((c) =>
        c.id === action.commentId
          ? { ...c, content: action.content, updatedAt: new Date() }
          : c
      )
  }
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
  const [optimisticComments, addOptimistic] = useOptimistic(
    comments,
    commentReducer
  )
  const [newComment, setNewComment] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true)
      const result = await getTaskComments(taskId)
      setComments(result)
    } catch {
      toast.error(t("common.somethingWentWrong"))
    } finally {
      setLoading(false)
    }
  }, [taskId, t])

  useEffect(() => {
    if (open) {
      startTransition(() => {
        fetchComments()
      })
    }
  }, [open, fetchComments])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [optimisticComments])

  function handleSend() {
    const content = newComment.trim()
    if (!content) return

    const existingComment = comments.find(
      (c) => c.authorId === currentUserId
    )
    const tempComment: TaskCommentWithAuthor = {
      id: `temp-${Date.now()}`,
      taskId,
      authorId: currentUserId,
      authorName: existingComment?.authorName ?? null,
      authorImage: existingComment?.authorImage ?? null,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setNewComment("")

    startTransition(async () => {
      addOptimistic({ type: "add", comment: tempComment })
      const result = await createComment(taskId, content)
      if (result.success) {
        setComments((prev) => [...prev, result.data.comment])
        onCommentCountChange?.(taskId, 1)
      } else {
        toast.error(result.error || t("common.somethingWentWrong"))
      }
    })
  }

  function handleDelete(commentId: string) {
    startTransition(async () => {
      addOptimistic({ type: "delete", commentId })
      const result = await deleteComment(commentId, taskId)
      if (result.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
        onCommentCountChange?.(taskId, -1)
      } else {
        toast.error(result.error || t("common.somethingWentWrong"))
      }
    })
  }

  function handleEditStart(comment: TaskCommentWithAuthor) {
    setEditingId(comment.id)
    setEditContent(comment.content)
  }

  function handleEditCancel() {
    setEditingId(null)
    setEditContent("")
  }

  function handleEditSave() {
    if (!editingId || !editContent.trim()) return

    const content = editContent.trim()
    setEditingId(null)
    setEditContent("")

    startTransition(async () => {
      addOptimistic({
        type: "update",
        commentId: editingId,
        content,
      })
      const result = await updateComment(editingId, taskId, content)
      if (result.success) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === result.data.comment.id ? result.data.comment : c
          )
        )
      } else {
        toast.error(result.error || t("common.somethingWentWrong"))
      }
    })
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleEditSave()
    }
    if (e.key === "Escape") {
      handleEditCancel()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            {taskName}
          </SheetTitle>
          {description && (
            <SheetDescription>{description}</SheetDescription>
          )}
        </SheetHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3"
        >
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : optimisticComments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("projects.tasks.comments.noComments")}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {optimisticComments.map((comment) => (
                <div key={comment.id} className="group flex gap-3">
                  <Avatar size="sm">
                    <AvatarImage
                      src={comment.authorImage ?? undefined}
                    />
                    <AvatarFallback>
                      {getInitials(comment.authorName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">
                        {comment.authorName || t("auth.user")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(
                          new Date(comment.createdAt)
                        )}
                        {comment.updatedAt > comment.createdAt && (
                          <> ({t("projects.tasks.comments.edited")})</>
                        )}
                      </span>
                    </div>
                    {editingId === comment.id ? (
                      <div className="mt-1 flex flex-col gap-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) =>
                            setEditContent(e.target.value)
                          }
                          onKeyDown={handleEditKeyDown}
                          rows={2}
                          className="resize-none text-sm"
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={handleEditSave}
                            disabled={!editContent.trim()}
                          >
                            {t("common.save")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleEditCancel}
                          >
                            {t("common.cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm wrap-break-word whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    )}
                  </div>
                  {comment.authorId === currentUserId &&
                    editingId !== comment.id && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={() => handleEditStart(comment)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  {comment.authorId === currentUserId || isOwner
                    ? editingId !== comment.id && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 opacity-0 group-hover:opacity-100"
                          onClick={() => handleDelete(comment.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )
                    : null}
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={t("projects.tasks.comments.addComment")}
              rows={2}
              className="resize-none"
            />
            <Button
              size="icon"
              onClick={handleSend}
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
