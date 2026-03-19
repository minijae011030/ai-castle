import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { TodoItemInterface } from '@/types/chat.type'
import { format } from 'date-fns'

const priority_label: Record<TodoItemInterface['priority'], string> = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
}

const priority_class: Record<TodoItemInterface['priority'], string> = {
  LOW: 'border-muted-foreground/30 text-muted-foreground',
  MEDIUM: 'border-primary/40 text-primary',
  HIGH: 'border-destructive/50 text-destructive',
}

interface TodoMessageProps {
  items: TodoItemInterface[]
  className?: string
}

export const TodoMessage = ({ items, className }: TodoMessageProps) => {
  if (!items || items.length === 0) return null

  return (
    <div className={cn('mt-2 space-y-2', className)}>
      {items.map((item, idx) => {
        const is_done = item.status === 'DONE'
        const minutes = item.estimateMinutes ?? null
        const time_label = (() => {
          const start_date = new Date(item.startAt)
          const end_date = new Date(item.endAt)
          if (Number.isNaN(start_date.getTime()) || Number.isNaN(end_date.getTime())) return null
          return `${format(start_date, 'yyyy-MM-dd HH:mm')} ~ ${format(end_date, 'HH:mm')}`
        })()
        return (
          <Card key={`${item.title}-${idx}`} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-xs font-semibold',
                    is_done && 'line-through text-muted-foreground',
                  )}
                >
                  {item.title}
                </p>
                {item.description?.trim() ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
                {minutes != null ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">예상 {minutes}분</p>
                ) : null}
                {time_label ? (
                  <p className="mt-1 text-[11px] text-primary">{time_label}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-primary">{item.scheduledDate}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge
                  variant="outline"
                  className={cn('text-[10px]', priority_class[item.priority])}
                >
                  {priority_label[item.priority]}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {is_done ? 'DONE' : 'TODO'}
                </Badge>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
