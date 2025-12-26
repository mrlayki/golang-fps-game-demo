# webapp（典型 Gin + GORM 分层示例）

这个目录是一个“更接近常规 Web 项目”的后端示例，用来对比本仓库的 FPS WebSocket 对战后端：

- Gin：路由/中间件/参数绑定与校验
- GORM：ORM + 自动迁移
- 分层：handler（controller）→ service → repository → db
- 额外示例：定时任务（ticker）+ 进程内异步队列（worker）

## 运行

首次运行需要下载依赖（会联网）：

```bash
cd webapp
go mod tidy
go run ./cmd/api -config ""
```

默认监听：`http://localhost:8090`

环境变量：

- `WEBAPP_ADDR`：例如 `:8090`
- `GIN_MODE`：`debug|release|test`
- `DB_DIALECT`：默认 `sqlite`
- `DB_DSN`：默认 `file:webapp.db?cache=shared&_fk=1`
- `CRON_LOG_EVERY`：例如 `10s`
- `WORKER_QUEUE_SIZE`：默认 `128`

## 示例请求

创建用户：

```bash
curl -sS -X POST http://localhost:8090/api/v1/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

列表：

```bash
curl -sS 'http://localhost:8090/api/v1/users?limit=20&offset=0'
```

## 学习文档

整体架构与请求链路请看：`docs/WEBAPP_GUIDE.md`。

