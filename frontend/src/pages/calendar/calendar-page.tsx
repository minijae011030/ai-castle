import { ko } from 'date-fns/locale'
import { CalendarDayCell } from '@/components/calendar/calendar-day-cell'
import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'

export const CalendarPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())

  return (
    <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
      {/* 왼쪽: 월별 캘린더 격자 (큰 셀, 날짜 + 일정 2줄 + +N) */}
      <div className="w-[42rem] shrink-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => {
            if (!d) return
            setSelectedDate(d)
          }}
          locale={ko}
          className="[--cell-size:6rem]"
          classNames={{
            table: 'table-fixed w-full',
            day: 'min-h-[5rem] min-w-[var(--cell-size)] w-[var(--cell-size)] max-w-[var(--cell-size)] aspect-auto align-top',
          }}
          components={{
            DayButton: (props) => (
              <CalendarDayCell events={[]} recurringSchedules={[]} locale={ko} {...props} />
            ),
          }}
        />
      </div>
    </div>
  )
}
