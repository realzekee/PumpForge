import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Globe,
  Check,
  Sparkles,
} from "lucide-react";
import {
  getDeviceTimezoneInfo,
  formatToDeviceTimezone,
  parseDateSafe,
} from "../utils/timezone";

interface LiquidGlassDatePickerProps {
  value: string; // ISO date string or date representation
  onChange: (isoString: string) => void;
  minDate?: Date;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function LiquidGlassDatePicker({
  value,
  onChange,
  minDate = new Date(),
}: LiquidGlassDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tzInfo = useMemo(() => getDeviceTimezoneInfo(), []);

  // Parse initial selected date or default to 7 days from now at 5:00 PM local time
  const initialDate = useMemo(() => {
    const parsed = parseDateSafe(value);
    if (parsed && !isNaN(parsed.getTime())) {
      return parsed;
    }
    const defaultD = new Date();
    defaultD.setDate(defaultD.getDate() + 7);
    defaultD.setHours(17, 0, 0, 0); // 5:00 PM
    return defaultD;
  }, [value]);

  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());

  // Time state in 12-hour format
  const [hours12, setHours12] = useState<number>(() => {
    const h = initialDate.getHours() % 12;
    return h === 0 ? 12 : h;
  });
  const [minutes, setMinutes] = useState<number>(() => initialDate.getMinutes());
  const [period, setPeriod] = useState<"AM" | "PM">(() =>
    initialDate.getHours() >= 12 ? "PM" : "AM"
  );

  // Sync internal state if external value changes
  useEffect(() => {
    const parsed = parseDateSafe(value);
    if (parsed && !isNaN(parsed.getTime())) {
      setSelectedDate(parsed);
      setViewMonth(parsed.getMonth());
      setViewYear(parsed.getFullYear());
      const h = parsed.getHours() % 12;
      setHours12(h === 0 ? 12 : h);
      setMinutes(parsed.getMinutes());
      setPeriod(parsed.getHours() >= 12 ? "PM" : "AM");
    }
  }, [value]);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Construct target Date from selected date + time state
  const constructTargetDate = (
    baseDate: Date,
    h12: number,
    m: number,
    amPm: "AM" | "PM"
  ): Date => {
    const newDate = new Date(baseDate);
    let hour24 = h12 % 12;
    if (amPm === "PM") hour24 += 12;
    newDate.setHours(hour24, m, 0, 0);
    return newDate;
  };

  // Emit change
  const applyDateChange = (
    newBaseDate: Date,
    h12 = hours12,
    m = minutes,
    amPm = period
  ) => {
    const combined = constructTargetDate(newBaseDate, h12, m, amPm);
    setSelectedDate(combined);
    onChange(combined.toISOString());
  };

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      dayNumber: number;
      isCurrentMonth: boolean;
      date: Date;
      isPast: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    // Previous month tail days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, daysInPrevMonth - i);
      d.setHours(0, 0, 0, 0);
      days.push({
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        date: d,
        isPast: d < today,
        isToday: isSameDay(d, today),
        isSelected: isSameDay(d, selectedDate),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(viewYear, viewMonth, i);
      d.setHours(0, 0, 0, 0);
      days.push({
        dayNumber: i,
        isCurrentMonth: true,
        date: d,
        isPast: d < today,
        isToday: isSameDay(d, today),
        isSelected: isSameDay(d, selectedDate),
      });
    }

    // Next month front days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      d.setHours(0, 0, 0, 0);
      days.push({
        dayNumber: i,
        isCurrentMonth: false,
        date: d,
        isPast: d < today,
        isToday: isSameDay(d, today),
        isSelected: isSameDay(d, selectedDate),
      });
    }

    return days;
  }, [viewYear, viewMonth, selectedDate]);

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Quick Preset Handlers
  const applyPreset = (daysToAdd: number, hours = 17, mins = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    d.setHours(hours, mins, 0, 0);

    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    const amPm = hours >= 12 ? "PM" : "AM";

    setSelectedDate(d);
    setViewMonth(d.getMonth());
    setViewYear(d.getFullYear());
    setHours12(h12);
    setMinutes(mins);
    setPeriod(amPm);

    onChange(d.toISOString());
  };

  const handleDaySelect = (dayDate: Date) => {
    applyDateChange(dayDate, hours12, minutes, period);
  };

  const handleHourChange = (newHour: number) => {
    setHours12(newHour);
    applyDateChange(selectedDate, newHour, minutes, period);
  };

  const handleMinuteChange = (newMin: number) => {
    setMinutes(newMin);
    applyDateChange(selectedDate, hours12, newMin, period);
  };

  const handlePeriodToggle = (newPeriod: "AM" | "PM") => {
    setPeriod(newPeriod);
    applyDateChange(selectedDate, hours12, minutes, newPeriod);
  };

  return (
    <div className="flex flex-col gap-2 relative w-full" ref={containerRef}>
      {/* Trigger Button - Liquid Glass Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/15 backdrop-blur-xl transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] group text-left cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/20 to-fuchsia-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-105 transition">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white font-mono tracking-tight truncate">
                {formatToDeviceTimezone(selectedDate, {
                  includeTime: true,
                  includeTz: false,
                })}
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25 shrink-0">
                {tzInfo.gmtOffset}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 truncate flex items-center gap-1 font-mono">
              <Globe className="w-3 h-3 text-zinc-500 shrink-0" />
              <span>Device Timezone: {tzInfo.formattedName}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold text-rose-400 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl shrink-0 group-hover:border-rose-500/40 transition">
          <Clock className="w-3.5 h-3.5" />
          <span>{isOpen ? "Close" : "Change"}</span>
        </div>
      </button>

      {/* Popdown / Inline Liquid Glass Calendar Picker */}
      {isOpen && (
        <div className="z-30 w-full mt-1 bg-zinc-950/95 border border-white/20 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-2xl flex flex-col gap-4 animate-fade-in relative overflow-hidden">
          {/* Specular Liquid Light Effect */}
          <div className="absolute -right-16 -top-16 w-48 h-48 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Timezone Info Banner */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-xs font-mono">
            <div className="flex items-center gap-2 text-zinc-300">
              <Globe className="w-4 h-4 text-rose-400" />
              <span>
                Your Device Timezone:{" "}
                <strong className="text-white">{tzInfo.formattedName}</strong>
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              Auto Synced
            </span>
          </div>

          {/* Quick Presets Chips */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 tracking-wider">
              Quick Shortcuts
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[
                { label: "+24 Hours", days: 1 },
                { label: "+3 Days", days: 3 },
                { label: "+1 Week", days: 7 },
                { label: "+2 Weeks", days: 14 },
                { label: "+1 Month", days: 30 },
                { label: "Friday 5PM", days: ((5 - new Date().getDay() + 7) % 7) || 7 },
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(preset.days)}
                  className="py-1.5 px-2 rounded-xl text-[11px] font-mono font-bold bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/10 transition active:scale-95 text-center shadow-sm"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Navigation Header */}
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <h4 className="text-base font-black text-white font-mono flex items-center gap-2">
              <span>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
            </h4>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.15] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition active:scale-90"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.15] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition active:scale-90"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_NAMES.map((wd, i) => (
              <div
                key={i}
                className="text-center text-[10px] font-mono font-black text-zinc-500 py-1 uppercase"
              >
                {wd}
              </div>
            ))}

            {calendarDays.map((cell, idx) => {
              const isDisabled = cell.isPast;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleDaySelect(cell.date)}
                  className={`
                    h-9 rounded-xl font-mono text-xs font-bold transition-all relative flex items-center justify-center
                    ${
                      isDisabled
                        ? "text-zinc-700 cursor-not-allowed opacity-40"
                        : cell.isSelected
                        ? "bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white font-black shadow-lg shadow-rose-500/30 border border-white/30 scale-105 z-10"
                        : cell.isToday
                        ? "bg-white/10 text-rose-400 border border-rose-500/40 hover:bg-white/15"
                        : cell.isCurrentMonth
                        ? "text-zinc-200 hover:bg-white/10 border border-transparent hover:border-white/10"
                        : "text-zinc-600 hover:bg-white/5 border border-transparent"
                    }
                  `}
                >
                  <span>{cell.dayNumber}</span>
                  {cell.isToday && !cell.isSelected && (
                    <div className="absolute bottom-1 w-1 h-1 rounded-full bg-rose-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Liquid Glass Time Selector */}
          <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase font-black text-zinc-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                <span>Time of Resolution ({tzInfo.gmtOffset})</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                Adjusts to user device clocks
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 bg-white/[0.03] p-3 rounded-2xl border border-white/10">
              {/* Hour selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400 uppercase font-mono font-bold">
                  Hour
                </span>
                <select
                  value={hours12}
                  onChange={(e) => handleHourChange(parseInt(e.target.value))}
                  className="bg-black/60 border border-white/15 text-white rounded-xl px-2.5 py-1.5 text-sm font-mono font-black outline-none focus:border-rose-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h} className="bg-zinc-900 text-white">
                      {h.toString().padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-zinc-500 font-mono font-black">:</span>

              {/* Minute selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400 uppercase font-mono font-bold">
                  Min
                </span>
                <select
                  value={minutes}
                  onChange={(e) => handleMinuteChange(parseInt(e.target.value))}
                  className="bg-black/60 border border-white/15 text-white rounded-xl px-2.5 py-1.5 text-sm font-mono font-black outline-none focus:border-rose-500"
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 59].map((m) => (
                    <option key={m} value={m} className="bg-zinc-900 text-white">
                      {m.toString().padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>

              {/* AM / PM Toggle */}
              <div className="flex items-center rounded-xl bg-black/60 p-1 border border-white/15">
                <button
                  type="button"
                  onClick={() => handlePeriodToggle("AM")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-black transition ${
                    period === "AM"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodToggle("PM")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-black transition ${
                    period === "PM"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            {/* Quick Time Presets */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setHours12(12);
                  setMinutes(0);
                  setPeriod("PM");
                  applyDateChange(selectedDate, 12, 0, "PM");
                }}
                className="flex-1 py-1 text-[10px] font-mono font-bold rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 transition"
              >
                12:00 PM (Noon)
              </button>
              <button
                type="button"
                onClick={() => {
                  setHours12(5);
                  setMinutes(0);
                  setPeriod("PM");
                  applyDateChange(selectedDate, 5, 0, "PM");
                }}
                className="flex-1 py-1 text-[10px] font-mono font-bold rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 transition"
              >
                5:00 PM (Close)
              </button>
              <button
                type="button"
                onClick={() => {
                  setHours12(11);
                  setMinutes(59);
                  setPeriod("PM");
                  applyDateChange(selectedDate, 11, 59, "PM");
                }}
                className="flex-1 py-1 text-[10px] font-mono font-bold rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 transition"
              >
                11:59 PM (Midnight)
              </button>
            </div>
          </div>

          {/* Confirmation & UTC conversion preview */}
          <div className="border-t border-white/10 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold">
                Stored as Universal Timestamp (UTC)
              </span>
              <span className="text-xs font-mono text-zinc-300">
                {selectedDate.toISOString()}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500 text-white font-mono text-xs font-black shadow-lg shadow-rose-950/40 border border-white/20 flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm Date & Time</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
