"use client"

import type { Routine } from "@/lib/drizzle/schema"
import { routineTemplates } from "@/lib/routines/templates"
import { useTranslations } from "next-intl"
import { useState } from "react"
import type { ProjectMember } from "./routine-details-step"
import { RoutineDetailsStep } from "./routine-details-step"
import { RoutineScheduleStep } from "./routine-schedule-step"
import { StepIndicator } from "./routine-step-indicator"

interface RoutineFormProps {
  routine?: Routine
  projectMembers: ProjectMember[]
  onSubmit: (data: {
    name: string
    description: string
    cost: string
    recurrence: string
    interval: string
    daysOfWeek: string[]
    time: string
    startDate: string
    endDate: string
    assigneeId: string | null
  }) => Promise<{
    success: boolean
    fieldErrors?: Record<string, string[]>
    error?: string
  }>
  onCancel: () => void
}

export function RoutineForm({
  routine,
  projectMembers,
  onSubmit,
  onCancel,
}: RoutineFormProps) {
  const t = useTranslations()
  const [step, setStep] = useState(1)
  const [step1Done, setStep1Done] = useState(false)
  const [name, setName] = useState(routine?.name ?? "")
  const [description, setDescription] = useState(
    routine?.description ?? ""
  )
  const [cost, setCost] = useState(routine?.cost ?? "")
  const [recurrence, setRecurrence] = useState<string>(
    routine?.recurrence ?? "weekly"
  )
  const [interval, setInterval] = useState<string>(
    routine ? String(routine.interval) : "1"
  )
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(
    routine?.daysOfWeek ?? []
  )
  const [time, setTime] = useState(routine?.time ?? "")
  const [startDate, setStartDate] = useState(routine?.startDate ?? "")
  const [endDate, setEndDate] = useState(routine?.endDate ?? "")
  const [assigneeId, setAssigneeId] = useState<string>(
    routine?.assigneeId ?? ""
  )

  function applyTemplate(templateId: string) {
    const template = routineTemplates.find(
      (tpl) => tpl.id === templateId
    )
    if (!template) return
    setName(t(template.nameKey))
    setDescription(t(template.descriptionKey))
    setRecurrence(template.recurrence)
    setInterval(String(template.interval))
    setDaysOfWeek(template.daysOfWeek ?? [])
  }

  function handleRecurrenceChange(value: string) {
    setRecurrence(value)
    if (value === "weekly" && daysOfWeek.length === 0) {
      setDaysOfWeek(["monday"])
    }
    if (value === "daily") {
      setInterval("1")
      setDaysOfWeek([])
    }
  }

  function toggleWeekday(day: string) {
    setDaysOfWeek((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    )
  }

  function goNext() {
    setStep1Done(true)
    setStep(2)
  }

  function submitRoutine() {
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      cost: cost.trim(),
      recurrence,
      interval,
      daysOfWeek,
      time: time.trim(),
      startDate,
      endDate,
      assigneeId: assigneeId || null,
    })
  }

  return (
    <>
      <StepIndicator
        current={step}
        editMode={!!routine}
        step1Done={step1Done}
        onSelect={setStep}
      />
      {step === 1 ? (
        <RoutineDetailsStep
          projectMembers={projectMembers}
          showTemplate={!routine}
          name={name}
          description={description}
          cost={cost}
          assigneeId={assigneeId}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onCostChange={setCost}
          onAssigneeChange={setAssigneeId}
          onApplyTemplate={applyTemplate}
          onNext={goNext}
          onCancel={onCancel}
        />
      ) : (
        <RoutineScheduleStep
          isEdit={!!routine}
          name={name}
          recurrence={recurrence}
          interval={interval}
          daysOfWeek={daysOfWeek}
          time={time}
          startDate={startDate}
          endDate={endDate}
          onRecurrenceChange={handleRecurrenceChange}
          onIntervalChange={setInterval}
          onDayToggle={toggleWeekday}
          onTimeChange={setTime}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onSubmit={submitRoutine}
          onBack={() => setStep(1)}
        />
      )}
    </>
  )
}
