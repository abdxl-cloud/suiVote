"use client"

import * as React from "react"
import { format, addHours, isAfter, isBefore, addMinutes } from "date-fns"
import { CalendarIcon, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface DateTimePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  label?: string
  error?: boolean
  required?: boolean
  minDate?: Date
  maxDate?: Date
}

export function DateTimePicker({
  date,
  setDate,
  label,
  error,
  required,
  minDate: propMinDate,
  maxDate,
}: DateTimePickerProps) {
  // Set minimum date to be at least 5 minutes from now
  const defaultMinDate = React.useMemo(() => {
    return addMinutes(new Date(), 5)
  }, [])

  const minDate = propMinDate || defaultMinDate

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

  // Set default date to one hour ahead if not provided
  React.useEffect(() => {
    if (!date) {
      const defaultDate = addHours(new Date(), 1)
      // Round to nearest 15 minutes
      const minutes = defaultDate.getMinutes()
      const roundedMinutes = Math.ceil(minutes / 15) * 15
      defaultDate.setMinutes(roundedMinutes % 60)
      if (roundedMinutes === 60) {
        defaultDate.setHours(defaultDate.getHours() + 1)
      }
      setDate(defaultDate)
    }
  }, [date, setDate])

  // Update the time when the date changes
  const [selectedTime, setSelectedTime] = React.useState<string>(() => {
    return date ? format(date, "HH:mm") : format(addHours(new Date(), 1), "HH:mm")
  })

  React.useEffect(() => {
    if (date) {
      setSelectedTime(format(date, "HH:mm"))
    }
  }, [date])

  // Check if the selected date and time is valid (after minDate)
  const isValidDateTime = React.useMemo(() => {
    if (!date) return false

    // Check if date is after minDate
    return isAfter(date, minDate) && (!maxDate || isBefore(date, maxDate))
  }, [date, minDate, maxDate])

  // Error message for invalid date/time
  const [timeError, setTimeError] = React.useState<string | null>(null)

  // Update the date with the selected time
  const handleTimeChange = React.useCallback(
    (time: string) => {
      setSelectedTime(time)
      if (date) {
        const [hours, minutes] = time.split(":").map(Number)
        const newDate = new Date(date)
        newDate.setHours(hours)
        newDate.setMinutes(minutes)

        // Validate the new date is after minDate
        if (isBefore(newDate, minDate)) {
          setTimeError(`Time must be at least ${format(minDate, "h:mm a")} today`)
        } else if (maxDate && isAfter(newDate, maxDate)) {
          setTimeError(`Time must be before ${format(maxDate, "h:mm a")}`)
        } else {
          setTimeError(null)
          setDate(newDate)
        }
      }
    },
    [date, setDate, minDate, maxDate],
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

      // Validate the new date
      if (isBefore(day, minDate)) {
        // If day is valid but time makes it invalid, adjust time to minDate's time
        if (isBefore(new Date(day).setHours(0, 0, 0, 0), new Date(minDate).setHours(0, 0, 0, 0))) {
          // Day is before minDate, don't allow selection
          setTimeError(`Date must be today or later`)
          return
        } else {
          // Day is valid but time is before minDate, adjust time
          day.setHours(minDate.getHours())
          day.setMinutes(minDate.getMinutes())
          setSelectedTime(format(day, "HH:mm"))
          setTimeError(null)
        }
      } else if (maxDate && isAfter(day, maxDate)) {
        setTimeError(`Date must be before ${format(maxDate, "PPP")}`)
        return
      } else {
        setTimeError(null)
      }

      setDate(day)
    },
    [date, setDate, selectedTime, minDate, maxDate],
  )

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
                (error || timeError) && "border-red-500 focus-visible:ring-red-500",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleSelect}
              initialFocus
              disabled={(day) => isBefore(day, new Date().setHours(0, 0, 0, 0))}
              fromDate={new Date()}
            />
          </PopoverContent>
        </Popover>

        <Select value={selectedTime} onValueChange={handleTimeChange} disabled={!date}>
          <SelectTrigger
            className={cn("w-[120px]", (error || timeError) && "border-red-500 focus-visible:ring-red-500")}
          >
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

      {timeError && (
        <Alert variant="destructive" className="py-2 mt-1">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{timeError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
