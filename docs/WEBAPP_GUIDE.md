# Gin+GORM 分层 Web 架构学习（webapp）

本仓库有两类后端：

- `backend/`：WebSocket 实时对战（tick 驱动、状态广播）
- `webapp/`：更传统的“Gin 路由 + GORM + 分层（controller/service/repo）”CRUD 示例

如果你从 PHP/Laravel 或传统 MVC 过来，`webapp/` 的结构会更熟悉。

## 目录结构（webapp）

- `webapp/cmd/api/main.go`：程序入口、优雅停机
- `webapp/internal/router/router.go`：路由注册（`/api/v1/...`）+ 中间件
- `webapp/internal/middleware/request_id.go`：示例中间件（RequestId）
- `webapp/internal/handler/`：HTTP 层（Controller）
  - `user_handler.go`：解析参数、校验、返回 JSON
  - `response.go`：统一响应结构与错误映射
- `webapp/internal/service/`：业务层（Service）
  - `user_service.go`：业务规则、组装数据
- `webapp/internal/repository/`：数据访问层（Repo/DAO）
  - `user_repo.go`：GORM CRUD
- `webapp/internal/db/db.go`：数据库初始化与迁移
- `webapp/internal/model/user.go`：GORM Model
- `webapp/internal/task/cron.go`：定时任务示例（ticker）
- `webapp/internal/worker/queue.go`：异步队列示例（channel + goroutine）

## 典型请求链路（示例）

以“创建用户”接口为例：

### 1) 路由注册

- `webapp/internal/router/router.go`
  - `POST /api/v1/users` → `userHandler.Create`

### 2) Controller：参数绑定与校验

- `webapp/internal/handler/user_handler.go`
  - `CreateUserReq` 用 gin binding 标签做校验（`required/email/max`）
  - `c.ShouldBindJSON(&req)`：把 JSON 绑定到 struct
  - 校验通过后调用 service：`h.svc.Create(ctx, req.Name, req.Email)`

知识点：

- Gin 的 binding/validator 机制（和你在 PHP 里“FormRequest/validate()”很像）
- `context.Context` 从 `c.Request.Context()` 往下传（用于超时、取消、链路追踪）

### 3) Service：业务规则 + 生成 ID

- `webapp/internal/service/user_service.go`
  - 清洗字符串：TrimSpace/Lower
  - 生成 UUID：`uuid.NewString()`
  - 调用 repo：`s.repo.Create(ctx, u)`

知识点：

- Service 层只关心业务（不要把 HTTP/JSON 的细节带进来）
- 生成/校验业务字段属于 Service（而不是 repo）

### 4) Repository：GORM 写入 DB

- `webapp/internal/repository/user_repo.go`
  - `db.WithContext(ctx).Create(u)` 写入
  - 把“唯一键冲突”映射成 `repository.ErrConflict`

知识点：

- GORM 的 `WithContext`、`Create/First/Find/Save/Delete`
- 把底层错误翻译成领域错误（Repo 层做 “DB error → domain error”）

### 5) Response：统一返回结构

- `webapp/internal/handler/response.go`
  - `APIResponse{ok,data,error,meta}`
  - `FromErr` 统一把 `ErrNotFound/ErrConflict` 映射为 HTTP 状态码

知识点：

- 统一错误格式（对前端更友好，也更便于日志/监控）

## 定时任务与异步队列（示例）

在传统 Web 架构里，你提到的“定时任务、异步队列”通常会这样落：

- 小项目：进程内 `time.Ticker` + channel worker（本示例）
  - `webapp/internal/task/cron.go`：每隔一段时间 enqueue 一个 job
  - `webapp/internal/worker/queue.go`：后台 goroutine 消费 job
- 生产：独立队列（RabbitMQ/Kafka/Redis stream/asynq）、独立 worker 进程、重试/DLQ/可观测性

## 与 FPS 对战后端的关键差异（为什么它不像“Controller/Service/Repo”）

实时对战后端更像“事件驱动 + 状态机 + tick 模拟”：

- 连接生命周期（WebSocket）比 HTTP 请求更长
- 核心是“房间内权威状态”而不是“数据库中的记录”
- 每 tick 广播状态，而不是“一次请求一次响应”

对应实现参考：

- `backend/internal/game/hub.go`：消息分发 + 房间 tick 循环
- `backend/internal/game/room.go`：权威模拟与胜利条件

