import type { RoutineRecurrence } from "@/lib/util/schedule"

export interface RoutineTemplate {
  id: string
  nameKey: string
  descriptionKey: string
  recurrence: RoutineRecurrence
  interval: number
  daysOfWeek?: string[]
}

export const routineTemplates: RoutineTemplate[] = [
  {
    id: "irrigation",
    nameKey: "routineTemplates.irrigation.name",
    descriptionKey: "routineTemplates.irrigation.description",
    recurrence: "weekly",
    interval: 1,
    daysOfWeek: ["monday"],
  },
  {
    id: "fertilization",
    nameKey: "routineTemplates.fertilization.name",
    descriptionKey: "routineTemplates.fertilization.description",
    recurrence: "weekly",
    interval: 2,
    daysOfWeek: ["monday"],
  },
  {
    id: "pest-monitoring",
    nameKey: "routineTemplates.pestMonitoring.name",
    descriptionKey: "routineTemplates.pestMonitoring.description",
    recurrence: "weekly",
    interval: 1,
    daysOfWeek: ["wednesday"],
  },
  {
    id: "weeding",
    nameKey: "routineTemplates.weeding.name",
    descriptionKey: "routineTemplates.weeding.description",
    recurrence: "weekly",
    interval: 1,
    daysOfWeek: ["friday"],
  },
  {
    id: "harvest",
    nameKey: "routineTemplates.harvest.name",
    descriptionKey: "routineTemplates.harvest.description",
    recurrence: "weekly",
    interval: 1,
    daysOfWeek: ["sunday"],
  },
]
