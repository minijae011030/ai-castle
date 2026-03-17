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
