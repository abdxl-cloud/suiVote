"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Clock, CalendarIcon } from "lucide-react"
import { format, addMonths, isSameDay, isSameMonth, isToday, isAfter, addMinutes } from "date-fns"

// Generate unique IDs for components
const generateId = () => `calendar-${Math.random().toString(36).substring(2, 9)}`;

export function DateTimePicker({
  id: externalId,
  value,
  onChange,
  disabledDates = [],
  className = "",
  label = "Pick a date and time"
}) {
  // Create a unique ID for this calendar instance
  const [instanceId] = React.useState(() => externalId || generateId());

  // Set default time 10 minutes ahead of current time
  const getDefaultDateTime = () => {
    const now = new Date();
    return addMinutes(now, 10); // Handles day boundaries correctly
  };

  // Local state for this specific calendar instance
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(value || getDefaultDateTime());
  const [hour, setHour] = React.useState(
    value ? format(value, "HH") : format(getDefaultDateTime(), "HH")
  );
  const [minute, setMinute] = React.useState(
    value ? format(value, "mm") : format(getDefaultDateTime(), "mm")
  );

  // State for time validation
  const [timeError, setTimeError] = React.useState("");

  // Refs specific to this calendar instance
  const containerRef = React.useRef(null);

  // Effect to update the component when the external value changes
  React.useEffect(() => {
    if (value) {
      // setSelectedDate(value);
      setHour(format(value, "HH"));
      setMinute(format(value, "mm"));
    }
  }, [value]);

  // Close the dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    }
  }, []);

  // Update parent component when selection changes
  React.useEffect(() => {
    validateTimeSelection(selectedDate, hour, minute);
    // We validate on each change but don't auto-adjust here
  }, [selectedDate, hour, minute]);

  // Check if a date is in the past (before today)
  const isDateInPast = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  // Check if a date is disabled
  const isDateDisabled = (date) => {
    return isDateInPast(date) || disabledDates.some(disabledDate => isSameDay(disabledDate, date));
  };

  // Check if a date is selected
  const isDateSelected = (date) => {
    return selectedDate && isSameDay(date, selectedDate);
  };

  // Handle hour change with validation
  const handleHourChange = (e) => {
    const newHour = e.target.value;
    if (newHour >= 0 && newHour <= 23) {
      setHour(newHour.padStart(2, '0'));
      validateTimeSelection(selectedDate, newHour, minute);
    }
  };

  // Handle minute change with validation
  const handleMinuteChange = (e) => {
    const newMinute = e.target.value;
    if (newMinute >= 0 && newMinute <= 59) {
      setMinute(newMinute.padStart(2, '0'));
      validateTimeSelection(selectedDate, hour, newMinute);
    }
  };

  // Validate time is at least 10 minutes in the future
  const validateTimeSelection = (date, hrs, mins) => {
    const now = new Date();
    const selectedDateTime = new Date(date);
    selectedDateTime.setHours(parseInt(hrs, 10), parseInt(mins, 10), 0, 0);

    // Check if the selected time is at least 10 minutes ahead
    const minAllowedTime = addMinutes(now, 5);

    if (isAfter(selectedDateTime, minAllowedTime)) {
      setTimeError("");
      onChange?.(selectedDateTime);
    } else {
      setTimeError("Time must be at least 5 minutes from now");
    }
  };

  // Generate calendar grid
  const generateCalendarDays = () => {
    const result = [];
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();

    // Previous month days
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, -i);
      result.unshift(prevMonthDay);
    }

    // Current month days
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      result.push(new Date(year, month, i));
    }

    // Next month days to complete the grid (6 rows of 7 days)
    const remainingDays = 42 - result.length;
    for (let i = 1; i <= remainingDays; i++) {
      result.push(new Date(year, month + 1, i));
    }

    return result;
  };

  // Days of the week header
  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Calendar days
  const calendarDays = generateCalendarDays();

  return (
    <div className={`relative ${className}`} ref={containerRef} data-calendar-id={instanceId}>
      {/* Label above the input */}
      <label htmlFor={`datetime-input-${instanceId}`} className="block text-sm font-medium text-foreground mb-2">
        {label}
      </label>

      {/* Main trigger button */}
      <button
        id={`datetime-input-${instanceId}`}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 bg-background text-foreground rounded-md border border-input hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all btn-hover-effect"
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span>
            {value
              ? format(value, "MMM d, yyyy 'at' h:mm a")
              : "Select date and time"}
          </span>
        </div>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground">
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Calendar dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-[320px] bg-popover border border-border rounded-md shadow-lg animate-fade-in">
          {/* Calendar header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <button
              type="button"
              onClick={() => setSelectedDate(date => addMonths(date, -1))}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none transition-all"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <h2 className="text-sm font-medium text-foreground">
              {format(selectedDate, "MMMM yyyy")}
            </h2>

            <button
              type="button"
              onClick={() => setSelectedDate(date => addMonths(date, 1))}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none transition-all"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 text-center text-xs text-muted-foreground py-2 px-1">
            {daysOfWeek.map(day => (
              <div key={`${instanceId}-dow-${day}`}>{day}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="p-1 grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const isDayInCurrentMonth = isSameMonth(day, selectedDate);
              const isDisabled = isDateDisabled(day);
              const isSelected = isDateSelected(day);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={`${instanceId}-day-${index}`}
                  type="button"
                  onClick={() => {
                    if (!isDisabled && isDayInCurrentMonth) {
                      const newDate = new Date(day);
                      // Preserve the current time when changing date
                      newDate.setHours(
                        selectedDate.getHours(),
                        selectedDate.getMinutes(),
                        0,
                        0
                      );
                      setSelectedDate(newDate);
                      // Validate after date selection
                      validateTimeSelection(newDate, hour, minute);
                    }
                  }}
                  disabled={isDisabled || !isDayInCurrentMonth}
                  className={`
                    relative flex items-center justify-center h-10 w-10 text-sm rounded-full
                    ${!isDayInCurrentMonth ? 'text-muted-foreground/40' : isDisabled ? 'text-muted-foreground/60 cursor-not-allowed' : 'cursor-pointer hover:bg-accent transition-colors'}
                    ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                    ${!isSelected && isDayInCurrentMonth && !isDisabled ? 'text-foreground' : ''}
                    ${isTodayDate && !isSelected ? 'font-bold' : ''}
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                    transition-all
                  `}
                >
                  <span>{format(day, "d")}</span>
                </button>
              );
            })}
          </div>

          {/* Time selection with number inputs */}
          <div className="px-4 py-3 border-t border-border">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-foreground">Select Time</label>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Hour and minute inputs */}
            <div className="flex items-center space-x-2">
              <div className="w-1/2">
                <input
                  id={`${instanceId}-hour-input`}
                  type="number"
                  min="0"
                  max="23"
                  value={hour}
                  onChange={handleHourChange}
                  className="w-full px-3 py-2 bg-background text-foreground rounded-md border border-input hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all"
                />
              </div>
              <div className="w-1/2">
                <input
                  id={`${instanceId}-minute-input`}
                  type="number"
                  min="0"
                  max="59"
                  value={minute}
                  onChange={handleMinuteChange}
                  className="w-full px-3 py-2 bg-background text-foreground rounded-md border border-input hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all"
                />
              </div>
            </div>

            {/* Time validation error */}
            {timeError && (
              <div className="mt-2 text-xs text-red-500">
                {timeError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}