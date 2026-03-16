import {
  create_todo,
  get_todo_list_by_date,
  get_todo_list_by_status,
  update_todo,
  update_todo_status,
} from '@/services/todo-service'
import type {
  TodoCreateBodyInterface,
  TodoItemInterface,
  TodoStatus,
  TodoStatusUpdateBodyInterface,
  TodoUpdateBodyInterface,
} from '@/types/todo.type'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { toast } from 'sonner'

export const todo_query_keys = {
  all: ['todo'] as const,
  byDate: (date: string) => [...todo_query_keys.all, 'date', date] as const,
  byStatus: (status: TodoStatus) => [...todo_query_keys.all, 'status', status] as const,
}

export const todo_list_by_date_query_options = (date: string) =>
  queryOptions({
    queryKey: todo_query_keys.byDate(date),
    queryFn: () => get_todo_list_by_date(date),
  })

export const useTodoListByDate = (
  date: string,
  options?: Omit<UseQueryOptions<TodoItemInterface[], Error>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery({
    ...todo_list_by_date_query_options(date),
    ...options,
  })
}

export const useTodoListByStatus = (
  status: TodoStatus,
  options?: Omit<UseQueryOptions<TodoItemInterface[], Error>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery({
    queryKey: todo_query_keys.byStatus(status),
    queryFn: () => get_todo_list_by_status(status),
    ...options,
  })
}

export const useCreateTodo = (
  options?: UseMutationOptions<TodoItemInterface, Error, TodoCreateBodyInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: create_todo,
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: todo_query_keys.all })
      toast.success('Todo가 생성되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context) => {
      toast.error(error.message ?? 'Todo를 생성하지 못했습니다.')
      options?.onError?.(error, variables, context)
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
    mutationFn: ({ id, body }) => update_todo(id, body),
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: todo_query_keys.all })
      toast.success('Todo가 수정되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context) => {
      toast.error(error.message ?? 'Todo를 수정하지 못했습니다.')
      options?.onError?.(error, variables, context)
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
    mutationFn: ({ id, body }) => update_todo_status(id, body),
    onSuccess: (data, variables, context, mutation) => {
      query_client.invalidateQueries({ queryKey: todo_query_keys.all })
      toast.success('Todo 상태가 변경되었습니다.')
      options?.onSuccess?.(data, variables, context, mutation)
    },
    onError: (error, variables, context) => {
      toast.error(error.message ?? 'Todo 상태를 변경하지 못했습니다.')
      options?.onError?.(error, variables, context)
    },
  })
}
