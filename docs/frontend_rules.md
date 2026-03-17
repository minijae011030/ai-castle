# 🎨 AI Castle Frontend Development Rules

## 1. Naming Conventions

### 1.1. Variables & Functions

- Variables: 반드시 camelCase를 사용하며, 소문자로 시작합니다. (e.g., userData, isLoading)
- Functions: 반드시 camelCase를 사용하며, 소문자로 시작합니다. (e.g., handleClick, fetchUserInfo)
- General Rule: 모든 이름은 의도가 명확하고 알아보기 쉽게 작성합니다.

### 1.2. Files & Directories

- Pages & Components: 소문자와 하이픈(-)을 조합하는 kebab-case 사용
  - Examples: login-page.tsx, main-dashboard.tsx, submit-box.tsx, input.tsx
- Hooks: 앞에 use를 붙이고 camelCase 사용 (기존 유지)
  - Examples: useMember.ts, useAuth.ts, useTodoStream.ts

## 2. Component Standards

### 2.1. Declaration Style

- 모든 컴포넌트는 화살표 함수 기반의 선언형으로 작성합니다.
- 컴포넌트 이름 자체는 PascalCase를 유지하되, 파일명은 규칙 1.2를 따릅니다.

```ts
// Good
const ExampleComponent = () => {
  const helloWorld = "Hello"; // 변수는 snake_case
  const handlePrint = () => console.log(helloWorld); // 함수는 camelCase

  return <div onClick={handlePrint}>{helloWorld}</div>;
};
```

## 3. Type & Interface Rules

### 3.1. Interface Preference

- type 보다는 interface 사용을 권장합니다.
- Interface 명명 시 반드시 뒤에 Interface 접미사를 붙입니다.

```ts
// Good
interface UserInterface {
  userId: string;
  userName: string;
}

// Bad
type User = { ... }
interface UserData { ... }

```

### 3.2. API Request/Response 및 Interface 타입 위치

- **API 요청(Request body, params)·응답(Response)** 및 해당 도메인에서 쓰는 **interface**는 `src/types` 폴더에 **도메인별**로 정의합니다.
- **파일명**: `[도메인].type.ts` (kebab-case). 예: `health.type.ts`, `auth.type.ts`, `todo.type.ts`.
- 서비스(`src/services`), 훅(`src/hooks/queries`)에서는 해당 도메인 타입 파일만 import하여 사용합니다. 타입을 서비스/페이지 파일 안에 두지 않습니다.

```ts
// Good: src/types/health.type.ts
export interface HealthPayloadInterface {
  status: string;
}
export interface HealthResponseInterface {
  status: number;
  message: string;
  data: HealthPayloadInterface | null;
}

// Good: src/types/todo.type.ts (도메인별 분리)
export interface TodoItemInterface { ... }
export interface GetTodoListResponseInterface { ... }
export interface CreateTodoBodyInterface { ... }
```

```ts
// Bad: 서비스 파일 내부에 interface 정의
// src/services/health-service.ts 안에 HealthResponseInterface 정의 금지
```

## 4. Styling Rules (Tailwind CSS)

### 4.1. Color Management

- 모든 색상은 global.css에 정의된 **CSS Variable(컬러칩)**만 사용합니다.
- #000000과 같은 Hex Code 하드코딩은 엄격히 금지합니다.
- Example: text-primary, bg-background, border-accent-gold 등으로 사용.

### 4.2. Dynamic Class Handling

- 클래스명에 조건부 로직이나 변수를 넣을 때는 반드시 cn 유틸리티를 사용합니다.
- Array의 .join(' ') 방식은 테일윈드 클래스 충돌 방지를 위해 사용하지 않습니다.
- Example: className={cn("base-style", is_active && "active-style")}

### 4.3. Sizing & Spacing

- 임의의 픽셀 값인 대괄호 문법(font-[10px], w-[320px]) 사용을 지양합니다.
- tailwind의 기본 스페이싱 수치(0.5, 1, 2.5 등)를 우선적으로 사용합니다. (1 = 4px 기준)
- Example: font-2.5 (10px), p-4 (16px)

## 5. UI Library Standards (shadcn/ui)

### 5.1. Base Component

- 프로젝트의 모든 기본 UI 구성 요소는 shadcn/ui를 기반으로 합니다.
- 새로운 컴포넌트가 필요할 경우 pnpm dlx shadcn@latest add [component] 명령어로 추가한 뒤 프로젝트 스타일에 맞게 커스텀합니다.

### 5.2. Customization

- /components/ui 폴더 내의 코드는 필요에 따라 수정 가능하지만, 'VVIP 다크 모드' 테마를 해치지 않는 선에서 조정합니다.

## 6. Routing Rules (TanStack Router)

### 6.1. File Separation (Route vs. Page)

- Route Definition: 라우트 설정 파일(예: src/routes/...)에는 라우팅 로직과 데이터 로직(loader, search params 등)만 작성합니다.
- UI Implementation: 실제 화면을 그리는 로직은 반드시 src/pages 폴더 내에 별도의 파일로 작성하여 임포트합니다. 라우트 파일 내에 직접적인 JSX 코드를 작성하는 것을 금지합니다.

### 6.2. Search Parameter Validation

- URL의 쿼리 파라미터를 사용할 경우, 반드시 validateSearch 기능을 사용하여 데이터를 정규화하고 검증합니다.
- 이를 통해 잘못된 파라미터가 들어오는 것을 방지하고, 컴포넌트 내에서 타입 안정성을 확보합니다.

### 6.3. Route Definition Pattern

- 라우트 생성 시 아래의 구조를 정석으로 따릅니다.

```ts
// Good: src/routes/(auth)/ai.tsx
import { AiDashboardPage } from "@/pages/ai/ai-dashboard-page"; // 파일명 규칙 준수
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod"; // 검증을 위해 zod 사용 권장

// Search Params 검증 및 정규화
const aiSearchSchema = z.object({
  date: z.string().optional(),
  agentId: z.string().optional(),
});

export const Route = createFileRoute("/(auth)/ai")({
  validateSearch: (search) => aiSearchSchema.parse(search),
  component: AiDashboardPage,
});
```

## 7. API Management Rules

### 7.1. Base Client

- 모든 API 호출은 src/lib/client.ts에 정의된 API 클래스를 통해서만 이루어집니다.
- 직접적인 axios.get이나 fetch 사용은 엄격히 금지합니다.

### 7.2. Directory & File Naming

- Folder: src/services 폴더 내에 도메인별로 파일을 나누어 관리합니다.
- File Naming: 소문자와 kebab-case(-)를 사용합니다.
- Examples: auth-service.ts, todo-service.ts, agent-service.ts

### 7.3. API Function Pattern

- 각 API 호출은 독립적인 async 함수로 작성하며, 아래의 단계를 반드시 준수합니다.
- **타입 위치**: 요청/응답 Interface는 서비스 파일이 아닌 `src/types/[도메인].type.ts`에 정의합니다 (규칙 3.2).
- Status 체크: 응답의 res.status가 200이 아닐 경우 에러를 던집니다.
- Data 반환: 최종적으로 res.data를 반환하여 컴포넌트에서 비즈니스 로직에만 집중하게 합니다.

```ts
// Example: src/services/post-service.ts
// 1. 타입은 src/types/post.type.ts 에 정의 (CreatePostResponseInterface, CreatePostBodyInterface 등)
import type { CreatePostResponseInterface, CreatePostBodyInterface, CreatePostDataInterface } from "@/types/post.type";

// 2. 함수 작성 (camelCase 사용)
export async function createPost(
  params: CreatePostBodyInterface,
): Promise<CreatePostDataInterface> {
  const res = await API.post<CreatePostResponseInterface>("/posts", params);

  if (res.status !== 200) {
    throw new Error(res.message);
  }

  return res.data;
}
```

### 7.4. Request Options

- 쿼리 파라미터는 options.params를 사용하고, Body 데이터는 API.post 등의 두 번째 인자로 전달합니다.
- postForm은 파일 업로드 등 multipart/form-data가 필요한 경우에만 제한적으로 사용합니다.

## 8. Data Fetching Rules (TanStack Query v5)

### 8.1. Directory Structure

- Folder: src/hooks/queries 폴더 내에 도메인별로 파일을 관리합니다.
- File Naming: 소문자와 kebab-case(-)를 사용하며, 뒤에 -query.ts를 붙입니다.
- Examples: user_query.ts, todo_query.ts, agent_query.ts

### 8.2. Query Key Factory

- 각 도메인 파일 상단에 const [domain]QueryKeys 객체를 정의하여 키를 중앙 관리합니다.
- 반드시 as const를 사용하여 타입을 고정합니다.

### 8.3. Query Options & Custom Hooks

- queryOptions: 재사용 가능한 쿼리 설정을 위해 반드시 queryOptions를 사용합니다.
- Hook Wrapping: 모든 useQuery와 useMutation은 커스텀 훅으로 감싸서 내보냅니다.
- Selection: select 옵션을 사용할 때는 useCallback으로 메모이제이션하여 불필요한 리렌더링을 방지합니다.

### 8.4. Invalidation Logic

- useMutation 성공 시(onSuccess), 관련된 쿼리 키를 invalidateQueries 하여 데이터 일관성을 유지합니다.

```ts
// query key
export const agent_query_keys = {
  all: ['agent'] as const,
  list: () => [...agent_query_keys.all, 'list'] as const,
}

// useQuery
export const useAgentRoleList = (options?: UseQueryOptions<AgentRoleDataInterface[], Error>) => {
  return useQuery({
    queryKey: agent_query_keys.list(),
    queryFn: async () => {
      const res = await getAgentRoleList()
      return res
    },
    select: useCallback((data: AgentRoleDataInterface[]) => data, []),
    ...options,
  })
}

// useMutation
export const useCreateAgentRole = (
  options?: UseMutationOptions<AgentRoleDataInterface, Error, AgentRoleCreateBodyInterface>,
) => {
  const query_client = useQueryClient()

  return useMutation({
    mutationFn: async (body: AgentRoleCreateBodyInterface) => {
      const result = await createAgentRole(body)
      return result
    },
    onSuccess: () => {
      query_client.invalidateQueries({ queryKey: agent_query_keys.all })
      toast.success('에이전트가 생성되었습니다.')
    },
    onError: (error) => {
      toast.error(error.message ?? '에이전트를 생성하지 못했습니다.')
    },
    ...options,
  })
}
```

## 9. Project Folder Structure (Frontend)

Cursor는 모든 코드를 생성할 때 아래의 엄격한 디렉토리 구조를 준수해야 합니다. 모든 파일명은 kebab-case(-)를 원칙으로 합니다. (단, 훅은 useCamelCase)

```text
src/
├── assets/             # 이미지, 아이콘, 폰트 등 정적 자산
├── styles/             # global.css 및 테일윈드 설정 파일
├── lib/                # 외부 라이브러리 설정 및 공통 유틸리티
│   ├── client.ts       # API 클래스 및 Axios 인스턴스 (절대 규칙)
│   └── utils.ts        # cn() 유틸리티 등 공통 함수
├── types/              # API 요청/응답 및 도메인별 타입 (interface, 규칙 3.2)
│   ├── health.type.ts
│   ├── auth.type.ts
│   └── todo.type.ts
├── routes/             # TanStack Router 라우트 정의 (로직만 존재)
│   ├── __root.tsx      # 최상위 루트 라우트
│   └── (auth)/         # 그룹화된 라우트 폴더 (예: 인증 필요 섹션)
├── pages/              # 실제 화면 UI 컴포넌트 (Route 파일과 1:1 매칭)
│   ├── login/          # 도메인별 폴더 구성
│   │   └── login-page.tsx
│   └── ai/
│       └── ai-dashboard-page.tsx
├── components/         # 재사용 가능한 UI 컴포넌트
│   ├── ui/             # shadcn/ui 컴포넌트들
│   ├── common/         # 공통 컴포넌트 (Button, Input 등)
│   └── dashboard/      # 특정 도메인 전용 컴포넌트
├── services/           # 도메인별 API 호출 함수 (src/lib/client.ts 사용)
│   ├── auth-service.ts
│   └── todo-service.ts
└── hooks/              # 커스텀 훅 폴더
    ├── queries/        # TanStack Query (Query Key Factory 포함)
    │   ├── user-query.ts
    │   └── todo-query.ts
    └── useMember.ts   # 일반 비즈니스 로직 훅
```

### 9.1. 구조적 핵심 원칙

- Strict Separation: routes/는 길찾기(라우팅)만 하고, pages/는 실제 집(UI)을 짓습니다. 둘을 한 파일에 섞는 행위는 불합격 사유입니다.
- Domain Driven: pages/, components/, services/, queries/ 모두 도메인별로 하위 폴더를 만들어 관리함으로써 확장성을 확보합니다.
- No Exceptions: 모든 파일명은 앞선 규칙(snake_case)을 따르며, Cursor는 파일 생성 전 반드시 이 구조를 대조해야 합니다.

## 10. Package Manager Rules (pnpm)

### 10.1. Mandatory Use of pnpm

- 본 프로젝트의 모든 패키지 관리는 반드시 pnpm을 사용합니다.
- 새로운 라이브러리 설치, 스크립트 실행 시 npm이나 yarn 명령어를 사용하지 않습니다.

### 10.2. Installation Commands

- 패키지 설치 시: pnpm add [package_name]
- 개발 의존성 설치 시: pnpm add -D [package_name]

⚠️ Cursor 주의 사항: 새로운 컴포넌트나 라이브러리가 필요할 때, 사용자에게 명령어를 제안하거나 직접 실행할 경우 반드시 pnpm 명령어를 사용하십시오.

## 11. Error Handling Rules

### 11.1. API Error Propagation

- Service Level: 모든 서비스 함수(src/services)는 비정상 응답(res.status !== 200)을 받을 경우, 백엔드에서 내려준 message를 담은 Error 객체를 반드시 throw 합니다.
- Hook Level: useMutation의 onError나 useQuery의 에러 상태를 통해 에러를 포착합니다.

### 11.2. UI Feedback (Toast)

- 사용자가 즉각 알아야 하는 에러(로그인 실패, 저장 실패 등)는 sonner (또는 shadcn toast)를 사용하여 화면 하단에 알림을 띄웁니다.
- 에러 메시지는 하드코딩하지 않고, 가급적 백엔드에서 넘어온 메시지를 그대로 노출하거나 사용자 친화적인 문구로 치환합니다.

### 11.3. Global Error Boundary

- 예상치 못한 런타임 에러로 인해 전체 앱이 크래시되는 것을 방지하기 위해, 주요 페이지 단위(src/pages)로 React Error Boundary를 설정합니다.
- 에러 발생 시 "선생님과의 연결이 잠시 원활하지 않습니다" 같은 전용 에러 UI를 보여줍니다.

### 11.4. TanStack Query Global Setting

- src/lib/query_client.ts 설정 시, 전역 QueryCache와 MutationCache에 공통 에러 핸들러를 등록하여 인증 만료(401) 등의 공통 에러를 한곳에서 처리합니다.

```ts
// Example: useMutation에서의 에러 처리
export const useSaveTodo = () => {
  return useMutation({
    mutationFn: saveTodo,
    onSuccess: () => {
      toast.success("오늘의 학습 계획이 승인되었습니다.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "계획 승인 중 오류가 발생했습니다.");
    },
  });
};
```
