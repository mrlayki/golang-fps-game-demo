# fps（网页 FPS 房间对战 Demo）

这是一个纯前端 Canvas + 纯 Go 后端（无第三方依赖）的多人房间射击 Demo：
- 像素风：低分辨率渲染再放大（`image-rendering: pixelated`）
- 房间：创建 / 加入 / 准备 / 房主开始
- 用户：仅输入名字即可进入（WebSocket 会话分配 `userId`）

## 目录结构

- `backend/`：后端服务（Go），提供 WebSocket 实时对战与房间管理
- `frontend/`：前端服务（Go 静态服务器 + 原生 HTML/JS），提供游戏页面
- `webapp/`：典型 Gin+GORM 分层 Web 示例（CRUD/中间件/定时任务/异步队列）

## 运行方式（本地）

前置：安装 Go（建议 1.21+）。

### 1) 启动后端

```bash
cd backend
go run ./cmd/server -addr :8080
```

### 2) 启动前端

```bash
cd frontend
go run ./cmd/frontend -addr :5173 -ws ws://localhost:8080/ws
```

浏览器打开：`http://localhost:5173`

## 文档

- 架构说明：`docs/ARCHITECTURE.md`
- 后端阅读导读：`docs/BACKEND_CODE_GUIDE.md`

## 操作说明

- 大厅：创建房间 / 加入房间
- 房间：准备 → 房主开始
- 邀请朋友：在房间页点“复制邀请链接”，朋友打开链接后输入名字即可自动加入
- 对局：WASD 移动｜鼠标转向（点击画面锁定）｜左键射击｜ESC 退出指针锁定
- 胜利条件：先达到 `10` 击杀获胜，结束后按击杀排名结算（第一名 👑）
