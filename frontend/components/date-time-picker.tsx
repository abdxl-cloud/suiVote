"use client"

import * as React from "react"
import { CalendarIcon, Clock } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DateTimePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  label?: string
  error?: boolean
}

export function DateTimePicker({ date, setDate, label, error }: DateTimePickerProps) {
  const [selectedHour, setSelectedHour] = React.useState<string>(
    date ? date.getHours().toString().padStart(2, "0") : "",
  )
  const [selectedMinute, setSelectedMinute] = React.useState<string>(
    date ? date.getMinutes().toString().padStart(2, "0") : "",
  )

  // Update the hour and minute when the date changes
  React.useEffect(() => {
    if (date) {
      setSelectedHour(date.getHours().toString().padStart(2, "0"))
      setSelectedMinute(date.getMinutes().toString().padStart(2, "0"))
    }
  }, [date])

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate)

      // If we already have a date, preserve the time
      if (date) {
        newDate.setHours(date.getHours(), date.getMinutes())
      } else {
        // Default to current time if no previous time
        const now = new Date()
        newDate.setHours(now.getHours(), now.getMinutes())
      }

      setDate(newDate)
    } else {
      setDate(undefined)
    }
  }

  const handleTimeChange = (type: "hour" | "minute", value: string) => {
    if (!date) {
      // If no date is set, use today
      const newDate = new Date()
      if (type === "hour") {
        newDate.setHours(Number.parseInt(value, 10), newDate.getMinutes())
        setSelectedHour(value)
      } else {
        newDate.setHours(newDate.getHours(), Number.parseInt(value, 10))
        setSelectedMinute(value)
      }
      setDate(newDate)
    } else {
      // Update existing date
      const newDate = new Date(date)
      if (type === "hour") {
        newDate.setHours(Number.parseInt(value, 10), newDate.getMinutes())
        setSelectedHour(value)
      } else {
        newDate.setHours(newDate.getHours(), Number.parseInt(value, 10))
        setSelectedMinute(value)
      }
      setDate(newDate)
    }
  }

  return (
    <div className="flex flex-col space-y-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      <div className="flex flex-col sm:flex-row gap-2">
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
              {date ? format(date, "PPP") : "Select date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={handleSelect} initialFocus />
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-1 bg-background border rounded-md px-3 py-2 w-full sm:w-auto">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center flex-1 justify-between sm:justify-start">
            <Select value={selectedHour} onValueChange={(value) => handleTimeChange("hour", value)}>
              <SelectTrigger className="w-[65px] h-8 border-0 p-0 pl-1 focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[300px]">
                {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                  <SelectItem key={hour} value={hour.toString().padStart(2, "0")} className="cursor-pointer">
                    {hour.toString().padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="mx-1 text-muted-foreground">:</span>
            <Select value={selectedMinute} onValueChange={(value) => handleTimeChange("minute", value)}>
              <SelectTrigger className="w-[65px] h-8 border-0 p-0 pl-1 focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Min" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[300px]">
                {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                  <SelectItem key={minute} value={minute.toString().padStart(2, "0")} className="cursor-pointer">
                    {minute.toString().padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}
