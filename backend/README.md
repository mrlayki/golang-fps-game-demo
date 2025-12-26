# backend

Go 后端：房间管理 + WebSocket 实时对局状态同步。

## 运行

```bash
go run ./cmd/server -addr :8080
```

## 接口

- `GET /healthz`
- `GET /ws`：WebSocket（JSON 消息）

