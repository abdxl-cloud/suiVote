"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DateTimePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  label?: string
  error?: boolean
  required?: boolean
}

export function DateTimePicker({ date, setDate, label, error, required }: DateTimePickerProps) {
  const [selectedTime, setSelectedTime] = React.useState<string>(() => {
    return date ? format(date, "HH:mm") : "12:00"
  })

  // Update the time when the date changes
  React.useEffect(() => {
    if (date) {
      setSelectedTime(format(date, "HH:mm"))
    }
  }, [date])

  // Update the date with the selected time
  const handleTimeChange = React.useCallback(
    (time: string) => {
      setSelectedTime(time)
      if (date) {
        const [hours, minutes] = time.split(":").map(Number)
        const newDate = new Date(date)
        newDate.setHours(hours)
        newDate.setMinutes(minutes)
        setDate(newDate)
      }
    },
    [date, setDate],
  )

  // Handle date selection from calendar
  const handleSelect = React.useCallback(
    (day: Date | undefined) => {
      if (!day) {
        setDate(undefined)
        return
      }

      // If there's already a date, preserve the time
      if (date) {
        day.setHours(date.getHours())
        day.setMinutes(date.getMinutes())
      } else if (selectedTime) {
        // If there's no date but there is a selected time, use it
        const [hours, minutes] = selectedTime.split(":").map(Number)
        day.setHours(hours)
        day.setMinutes(minutes)
      }

      setDate(day)
    },
    [date, setDate, selectedTime],
  )

  // Generate time options (every 15 minutes)
  const timeOptions = React.useMemo(() => {
    const options = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const formattedHour = hour.toString().padStart(2, "0")
        const formattedMinute = minute.toString().padStart(2, "0")
        options.push(`${formattedHour}:${formattedMinute}`)
      }
    }
    return options
  }, [])

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-sm">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground",
                error && "border-red-500 focus-visible:ring-red-500",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={date} onSelect={handleSelect} initialFocus />
          </PopoverContent>
        </Popover>

        <Select value={selectedTime} onValueChange={handleTimeChange} disabled={!date}>
          <SelectTrigger className={cn("w-[120px]", error && "border-red-500 focus-visible:ring-red-500")}>
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            {timeOptions.map((time) => (
              <SelectItem key={time} value={time}>
                {time}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
