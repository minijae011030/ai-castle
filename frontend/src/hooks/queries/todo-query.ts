import {
  createTodo,
  getTodoListByDate,
  getTodoListByStatus,
  updateTodo,
  updateTodoStatus,
} from '@/services/todo-service'
import type {
  TodoCreateBodyInterface,
  TodoItemInterface,
  TodoStatus,
  TodoStatusUpdateBodyInterface,
  TodoUpdateBodyInterface,
} from '@/types/todo.type'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

export const todo_query_keys = {
  all: ['todo'] as const,
  byDate: (date: string) => [...todo_query_keys.all, 'date', date] as const,
  byStatus: (status: TodoStatus) => [...todo_query_keys.all, 'status', status] as const,
}

export const useTodoListByDate = (
  date: string,
  options?: UseQueryOptions<TodoItemInterface[], Error>,
) => {
  return useQuery({
    queryKey: todo_query_keys.byDate(date),
    queryFn: async () => {
      const res = await getTodoListByDate(date)
      return res
    },
    select: useCallback((data: TodoItemInterface[]) => data, []),
    ...options,
  })
}

export const useTodoListByStatus = (
  status: TodoStatus,
  options?: UseQueryOptions<TodoItemInterface[], Error>,
) => {
  return useQuery({
    queryKey: todo_query_keys.byStatus(status),
    queryFn: async () => {
      const res = await getTodoListByStatus(status)
      return res
    },
    select: useCallback((data: TodoItemInterface[]) => data, []),
    ...options,
  })
}

export const useCreateTodo = (
  options?: UseMutationOptions<TodoItemInterface, Error, TodoCreateBodyInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: createTodo,
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: todo_query_keys.all })
      toast.success('Todo가 생성되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? 'Todo를 생성하지 못했습니다.')
    },
  })
}

export const useUpdateTodo = (
  options?: UseMutationOptions<
    TodoItemInterface,
    Error,
    { id: number; body: TodoUpdateBodyInterface }
  >,
) => {
  const query_client = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: ({ id, body }) => updateTodo(id, body),
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: todo_query_keys.all })
      toast.success('Todo가 수정되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? 'Todo를 수정하지 못했습니다.')
    },
  })
}

export const useUpdateTodoStatus = (
  options?: UseMutationOptions<
    TodoItemInterface,
    Error,
    { id: number; body: TodoStatusUpdateBodyInterface }
  >,
) => {
  const query_client = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: ({ id, body }) => updateTodoStatus(id, body),
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: todo_query_keys.all })
      toast.success('Todo 상태가 변경되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? 'Todo 상태를 변경하지 못했습니다.')
    },
  })
}
