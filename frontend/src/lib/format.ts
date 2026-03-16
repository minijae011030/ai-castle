import { format, parseISO } from 'date-fns'

/** ISO 문자열(예: 2026-03-19T09:00) → `yyyy-MM-dd HH:mm` */
export function format_date_time(iso_string: string | null | undefined): string {
  if (!iso_string) {
    return ''
  }

  try {
    const parsed = parseISO(iso_string)
    if (Number.isNaN(parsed.getTime())) {
      return iso_string
    }
    return format(parsed, 'yyyy-MM-dd HH:mm')
  } catch {
    return iso_string
  }
}

/** datetime-local 값 → API용 ISO 형식 (초 포함) */
export function toApiDatetime(value: string): string {
  if (!value) return ''
  return value.length === 16 ? `${value}:00` : value
}
