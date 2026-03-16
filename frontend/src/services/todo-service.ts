import { API } from '@/lib/client'
import type {
  TodoCreateBodyInterface,
  TodoCreateResponseInterface,
  TodoItemInterface,
  TodoListResponseInterface,
  TodoStatus,
  TodoStatusUpdateBodyInterface,
  TodoStatusUpdateResponseInterface,
  TodoUpdateBodyInterface,
  TodoUpdateResponseInterface,
} from '@/types/todo.type'

const BASE = '/api/todos'

export async function get_todo_list_by_date(date: string): Promise<TodoItemInterface[]> {
  const res = await API.get<TodoListResponseInterface>(BASE, {
    params: { date },
  })

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? 'Todo 목록을 불러오지 못했습니다.')
  }

  return res.data
}

export async function get_todo_list_by_status(status: TodoStatus): Promise<TodoItemInterface[]> {
  const res = await API.get<TodoListResponseInterface>(`${BASE}/status`, {
    params: { status },
  })

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? 'Todo 목록을 불러오지 못했습니다.')
  }

  return res.data
}

export async function create_todo(body: TodoCreateBodyInterface): Promise<TodoItemInterface> {
  const res = await API.post<TodoCreateResponseInterface, TodoCreateBodyInterface>(BASE, body)

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? 'Todo를 생성하지 못했습니다.')
  }

  return res.data
}

export async function update_todo(
  id: number,
  body: TodoUpdateBodyInterface,
): Promise<TodoItemInterface> {
  const res = await API.put<TodoUpdateResponseInterface, TodoUpdateBodyInterface>(
    `${BASE}/${id}`,
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? 'Todo를 수정하지 못했습니다.')
  }

  return res.data
}

export async function update_todo_status(
  id: number,
  body: TodoStatusUpdateBodyInterface,
): Promise<TodoItemInterface> {
  const res = await API.put<TodoStatusUpdateResponseInterface, TodoStatusUpdateBodyInterface>(
    `${BASE}/${id}/status`,
    body,
  )

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? 'Todo 상태를 변경하지 못했습니다.')
  }

  return res.data
}
