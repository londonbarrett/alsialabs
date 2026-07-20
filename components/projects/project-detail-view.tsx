import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ProjectTask } from "@/lib/drizzle/schema"
import type { ExpenseWithCategory } from "@/lib/actions/expenses"
import {
  ArrowLeft,
  ClipboardList,
  ListTodo,
  MapPin,
  Receipt,
  Users,
} from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { ProjectDetails } from "./project-details"
import { ProjectPeople } from "./project-people"
import { ProjectTasks } from "./project-tasks"
import { ProjectExpenses } from "./expenses/project-expenses"

export interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

interface ProjectDetailViewProps {
  project: {
    id: string
    primaryOwnerId: string
    name: string
    categoryId: string
    description: string | null
    status: string
    startDate: string
    endDate: string | null
    location: string | null
    budget: string | null
    categorySlug: string | null
  }
  tasks: ProjectTask[]
  categories: { id: string; slug: string }[]
  owners: ProjectMember[]
  collaborators: ProjectMember[]
  allUsers: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }[]
  expenses: ExpenseWithCategory[]
  expenseCategories: { id: string; slug: string }[]
  currentUserId: string
  isCurrentUserAdmin: boolean
  permissions?: string[]
}

const statusColors: Record<string, string> = {
  active:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  archived:
    "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400",
}

export function ProjectDetailView({
  project,
  tasks,
  categories,
  owners,
  collaborators,
  expenses,
  expenseCategories,
  currentUserId,
  isCurrentUserAdmin,
  permissions = [],
}: ProjectDetailViewProps) {
  const t = useTranslations()
  const isPrimaryOwner = project.primaryOwnerId === currentUserId
  const isOwner =
    owners.some((o) => o.userId === currentUserId) || isCurrentUserAdmin
  const canEdit =
    (isOwner || isCurrentUserAdmin) &&
    permissions.includes("projects:edit")
  const canManageUsers = isPrimaryOwner || isCurrentUserAdmin
  const canDelete = isPrimaryOwner || isCurrentUserAdmin

  const primaryOwner = owners.find(
    (o) => o.userId === project.primaryOwnerId
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          {project.location && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {project.location}
            </p>
          )}
        </div>
        <div className="ml-auto">
          <Badge className={statusColors[project.status]}>
            {t(`projects.status.${project.status}`)}
          </Badge>
        </div>
      </div>

      <Tabs className="gap-4" defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="details">
            <ClipboardList />
            {t("projects.detail.tabs.details")}
          </TabsTrigger>
          <TabsTrigger value="people">
            <Users />
            {t("projects.detail.tabs.people")}
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ListTodo />
            {t("projects.tasks.title")}
          </TabsTrigger>
          <TabsTrigger value="expenses">
            <Receipt />
            {t("projects.detail.tabs.expenses")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <ProjectTasks
            tasks={tasks}
            projectId={project.id}
            canEdit={canEdit}
            isOwner={isOwner}
            isCollaborator={
              !isOwner &&
              collaborators.some((c) => c.userId === currentUserId)
            }
            currentUserId={currentUserId}
            permissions={permissions}
            projectMembers={[...owners, ...collaborators]}
          />
        </TabsContent>

        <TabsContent value="people">
          <ProjectPeople
            projectId={project.id}
            owners={owners}
            collaborators={collaborators}
            primaryOwnerId={project.primaryOwnerId}
            canManageUsers={canManageUsers}
            isOwner={isOwner}
          />
        </TabsContent>

        <TabsContent value="details">
          <ProjectDetails
            project={project}
            categories={categories}
            primaryOwner={primaryOwner}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </TabsContent>

        <TabsContent value="expenses">
          <ProjectExpenses
            expenses={expenses}
            tasks={tasks}
            projectId={project.id}
            budget={project.budget}
            categories={expenseCategories}
            canEdit={!!permissions.includes("expenses:create") || canEdit}
            canDelete={!!permissions.includes("expenses:delete") || canDelete}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
