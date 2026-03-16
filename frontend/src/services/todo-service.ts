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

export async function getTodoListByDate(date: string): Promise<TodoItemInterface[]> {
  const res = await API.get<TodoListResponseInterface>(BASE, {
    params: { date },
  })

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? 'Todo 목록을 불러오지 못했습니다.')
  }

  return res.data
}

export async function getTodoListByStatus(status: TodoStatus): Promise<TodoItemInterface[]> {
  const res = await API.get<TodoListResponseInterface>(`${BASE}/status`, {
    params: { status },
  })

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? 'Todo 목록을 불러오지 못했습니다.')
  }

  return res.data
}

export async function createTodo(body: TodoCreateBodyInterface): Promise<TodoItemInterface> {
  const res = await API.post<TodoCreateResponseInterface, TodoCreateBodyInterface>(BASE, body)

  if (res.status !== 200 || !res.data) {
    throw new Error(res.message ?? 'Todo를 생성하지 못했습니다.')
  }

  return res.data
}

export async function updateTodo(
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

export async function updateTodoStatus(
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
