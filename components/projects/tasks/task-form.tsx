"use client"

import type { TaskWithAssignmentsDTO } from "@/actions/tasks/schemas"
import { Button } from "@/components/ui/button"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useTranslations } from "next-intl"
import { TaskFormDetailsStep } from "./task-form-details-step"
import { TaskFormScheduleStep } from "./task-form-schedule-step"
import { TaskStepIndicator } from "./task-step-indicator"
import { useTaskForm } from "./use-task-form"
import type { TaskFormSubmitValues } from "./use-task-form"

interface TaskFormProps {
  task?: TaskWithAssignmentsDTO
  onSubmit: (data: TaskFormSubmitValues) => void
  onCancel: () => void
}

export function TaskForm({ task, onSubmit, onCancel }: TaskFormProps) {
  const t = useTranslations()
  const { members } = useProjectContextState()
  const {
    values,
    errors,
    step,
    step1Done,
    protectedIds,
    handleSubmit,
    goNext,
    goBack,
    handleStepSelect,
    handleRepeatChange,
    handleAllDayChange,
    toggleDay,
    recordDisposition,
    onNameChange,
    onCostChange,
    onDescriptionChange,
    onPriorityChange,
    onAssigneeChange,
    onStartDateChange,
    onStartTimeChange,
    onEndDateChange,
    onEndTimeChange,
    onRecurrenceChange,
    onIntervalChange,
    onOccurrenceStartTimeChange,
    onOccurrenceEndTimeChange,
    onCancel: cancel,
  } = useTaskForm({ task, onSubmit, onCancel })
  const {
    name,
    cost,
    description,
    priority,
    assigneeIds,
    allDay,
    startDate,
    startTime,
    endDate,
    endTime,
    repeat,
    recurrence,
    interval,
    daysOfWeek,
    occurrenceStart,
    occurrenceEnd,
  } = values

  return (
    <form onSubmit={handleSubmit}>
      <TaskStepIndicator
        current={step}
        editMode={Boolean(task)}
        step1Done={step1Done}
        onSelect={handleStepSelect}
      />

      {step === 1 ? (
        <TaskFormDetailsStep
          name={name}
          cost={cost}
          description={description}
          priority={priority}
          assigneeIds={assigneeIds}
          members={members}
          protectedIds={protectedIds}
          errors={errors}
          onNameChange={onNameChange}
          onCostChange={onCostChange}
          onDescriptionChange={onDescriptionChange}
          onPriorityChange={onPriorityChange}
          onAssigneeChange={onAssigneeChange}
          onRemoveDisposition={recordDisposition}
          onNext={goNext}
          onCancel={cancel}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <TaskFormScheduleStep
            startDate={startDate}
            startTime={startTime}
            endDate={endDate}
            endTime={endTime}
            allDay={allDay}
            repeat={repeat}
            recurrence={recurrence}
            interval={interval}
            daysOfWeek={daysOfWeek}
            occurrenceStartTime={occurrenceStart}
            occurrenceEndTime={occurrenceEnd}
            errors={errors}
            onStartDateChange={onStartDateChange}
            onStartTimeChange={onStartTimeChange}
            onEndDateChange={onEndDateChange}
            onEndTimeChange={onEndTimeChange}
            onAllDayChange={handleAllDayChange}
            onRepeatChange={handleRepeatChange}
            onRecurrenceChange={onRecurrenceChange}
            onIntervalChange={onIntervalChange}
            onDayToggle={toggleDay}
            onOccurrenceStartTimeChange={onOccurrenceStartTimeChange}
            onOccurrenceEndTimeChange={onOccurrenceEndTimeChange}
          />
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={goBack}>
              {t("common.back")}
            </Button>
            <Button type="submit">
              {task ? t("common.saveChanges") : t("projects.tasks.createTask")}
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}
