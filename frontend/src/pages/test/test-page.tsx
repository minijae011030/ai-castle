import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ResizablePanelGroup, ResizableHandle, ResizablePanel } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">{children}</CardContent>
    </Card>
  )
}

export function TestPage() {
  const [collapsibleOpen, setCollapsibleOpen] = useState(false)

  return (
    <ScrollArea className="h-screen">
      <div className="container max-w-4xl space-y-8 p-6">
        <h1 className="text-3xl font-bold">shadcn 컴포넌트 테스트</h1>

        <Section title="Button">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button onClick={() => toast.success('토스트 테스트')}>Toast 열기</Button>
        </Section>

        <Section title="Badge">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </Section>

        <Section title="Input & Label">
          <div className="grid w-64 gap-2">
            <Label htmlFor="test-input">이름</Label>
            <Input id="test-input" placeholder="입력하세요" />
          </div>
          <div className="grid w-64 gap-2">
            <Label>자기소개</Label>
            <Textarea placeholder="텍스트 영역" rows={3} />
          </div>
        </Section>

        <Section title="Checkbox & Switch & Radio">
          <div className="flex items-center gap-2">
            <Checkbox id="c1" />
            <Label htmlFor="c1">체크박스</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="s1" />
            <Label htmlFor="s1">스위치</Label>
          </div>
          <RadioGroup defaultValue="a" className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="a" id="r1" />
              <Label htmlFor="r1">A</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="b" id="r2" />
              <Label htmlFor="r2">B</Label>
            </div>
          </RadioGroup>
        </Section>

        <Section title="Select & NativeSelect">
          <Select>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">옵션 1</SelectItem>
              <SelectItem value="2">옵션 2</SelectItem>
            </SelectContent>
          </Select>
          <NativeSelect>
            <NativeSelectOption value="">선택</NativeSelectOption>
            <NativeSelectOption value="a">A</NativeSelectOption>
            <NativeSelectOption value="b">B</NativeSelectOption>
          </NativeSelect>
        </Section>

        <Section title="Slider & Progress">
          <div className="w-48 space-y-2">
            <Slider defaultValue={[50]} max={100} />
            <Progress value={60} className="w-full" />
          </div>
        </Section>

        <Section title="Alert">
          <Alert>
            <AlertTitle>알림 제목</AlertTitle>
            <AlertDescription>기본 알림 메시지입니다.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>destructive 알림입니다.</AlertDescription>
          </Alert>
        </Section>

        <Section title="Avatar">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="avatar" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>AB</AvatarFallback>
          </Avatar>
        </Section>

        <Section title="Skeleton">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </Section>

        <Section title="Table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>역할</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>김주영</TableCell>
                <TableCell>코디네이터</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>한예서</TableCell>
                <TableCell>학생</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="tab1" className="w-64">
            <TabsList>
              <TabsTrigger value="tab1">탭1</TabsTrigger>
              <TabsTrigger value="tab2">탭2</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">탭 1 내용</TabsContent>
            <TabsContent value="tab2">탭 2 내용</TabsContent>
          </Tabs>
        </Section>

        <Section title="Accordion">
          <Accordion type="single" collapsible className="w-64">
            <AccordionItem value="1">
              <AccordionTrigger>섹션 1</AccordionTrigger>
              <AccordionContent>아코디언 내용 1</AccordionContent>
            </AccordionItem>
            <AccordionItem value="2">
              <AccordionTrigger>섹션 2</AccordionTrigger>
              <AccordionContent>아코디언 내용 2</AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>

        <Section title="Collapsible">
          <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline">
                {collapsibleOpen ? '접기' : '펼치기'}
                <ChevronDownIcon
                  className={`size-4 transition-transform ${collapsibleOpen ? 'rotate-180' : ''}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="rounded-md border p-4">Collapsible 내용</p>
            </CollapsibleContent>
          </Collapsible>
        </Section>

        <Section title="Toggle & ToggleGroup">
          <Toggle>토글</Toggle>
          <ToggleGroup type="single">
            <ToggleGroupItem value="a">A</ToggleGroupItem>
            <ToggleGroupItem value="b">B</ToggleGroupItem>
            <ToggleGroupItem value="c">C</ToggleGroupItem>
          </ToggleGroup>
        </Section>

        <Section title="Tooltip & Popover & HoverCard">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">툴팁 위에 올려보기</Button>
            </TooltipTrigger>
            <TooltipContent>툴팁 내용</TooltipContent>
          </Tooltip>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Popover 열기</Button>
            </PopoverTrigger>
            <PopoverContent>Popover 내용</PopoverContent>
          </Popover>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="outline">HoverCard</Button>
            </HoverCardTrigger>
            <HoverCardContent>호버 시 표시</HoverCardContent>
          </HoverCard>
        </Section>

        <Section title="DropdownMenu">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">메뉴 열기</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>항목 1</DropdownMenuItem>
              <DropdownMenuItem>항목 2</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        <Section title="Dialog">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">다이얼로그 열기</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>다이얼로그 제목</DialogTitle>
                <DialogDescription>설명입니다.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">닫기</Button>
                </DialogClose>
                <Button>확인</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>

        <Section title="Sheet">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">시트 열기</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>시트 제목</SheetTitle>
                <SheetDescription>시트 설명</SheetDescription>
              </SheetHeader>
              <p className="py-4">시트 본문</p>
            </SheetContent>
          </Sheet>
        </Section>

        <Section title="AlertDialog">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">삭제 확인</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>정말 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Section>

        <Section title="Calendar">
          <Calendar mode="single" className="rounded-md border" />
        </Section>

        <Section title="Breadcrumb">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/test">Test</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>현재</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </Section>

        <Section title="Pagination">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive>
                  1
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#">2</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </Section>

        <Section title="Separator">
          <div className="flex h-8 items-center gap-2">
            <span>왼쪽</span>
            <Separator orientation="vertical" />
            <span>오른쪽</span>
          </div>
          <Separator className="w-48" />
        </Section>

        <Section title="InputOTP">
          <InputOTP maxLength={6}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
            </InputOTPGroup>
          </InputOTP>
        </Section>

        <Section title="Kbd">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Section>

        <Section title="AspectRatio">
          <AspectRatio ratio={16 / 9} className="w-48 overflow-hidden rounded-md border">
            <div className="flex h-full items-center justify-center bg-muted">16:9</div>
          </AspectRatio>
        </Section>

        <Section title="Resizable">
          <ResizablePanelGroup orientation="horizontal" className="w-64 border rounded-lg">
            <ResizablePanel defaultSize={50}>A</ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={50}>B</ResizablePanel>
          </ResizablePanelGroup>
        </Section>

        <Section title="Empty">
          <Empty className="w-48 border rounded-lg py-8">
            <EmptyMedia />
            <EmptyHeader>데이터 없음</EmptyHeader>
            <EmptyDescription>표시할 항목이 없습니다.</EmptyDescription>
          </Empty>
        </Section>

        <div className="h-12" />
      </div>
    </ScrollArea>
  )
}
