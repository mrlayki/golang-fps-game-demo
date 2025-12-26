# 项目架构说明（fps）

## 总览

本项目由两个可独立运行的 Go 服务组成：

- `backend/`：对战与房间逻辑（HTTP + WebSocket）
- `frontend/`：静态站点服务（HTTP）+ 浏览器内游戏渲染与输入采集（Canvas + WebSocket）

核心思想：

- 浏览器只上传“输入”（WASD、鼠标转向、射击），不直接上传坐标（防作弊/简化同步）
- 后端做权威模拟（tick 驱动的房间循环），并广播权威状态（所有玩家位置、血量、击杀等）

## 后端架构（backend）

### 入口

- `backend/cmd/server/main.go`
  - 启动 HTTP 服务
  - `GET /ws`：升级为 WebSocket，进入 Hub
  - `GET /healthz`：健康检查

### 核心模块

- `backend/internal/game/hub.go`
  - 维护所有在线连接（client）
  - 维护房间列表（room）
  - 处理 WebSocket 收到的消息（`hello`、`room_create`、`room_join`、`room_ready`、`room_config`、`room_start`、`input`、`chat_send`、`ping`…）
  - 房间开始后启动房间 tick 循环：每 tick 更新模拟，并广播 `game_state`

- `backend/internal/game/room.go`
  - 房间内权威状态：玩家位置/朝向/血量/击杀、地图、胜利条件
  - `Tick()`：每一帧更新移动、射击、命中判定
  - 达到 `winScore` 时设置 `finished/winnerID`，由 Hub 广播 `game_over`

- `backend/internal/ws/ws.go`
  - 无第三方依赖的 WebSocket 升级与帧读写（文本帧）
  - 处理握手、mask、ping/pong、close 等基础协议

### 数据协议（JSON）

消息统一封装为：

```json
{ "type": "xxx", "payload": { ... } }
```

关键消息（部分）：

- `hello` → `hello_ack`
- `rooms_list` → `rooms`
- `room_create` / `room_join` / `room_leave` → `room_state`
- `room_config`：房主修改设置并同步（胜利击杀数/小地图显示敌人/墙上标语）
- `room_start`：房主开局（携带设置），后端回 `game_start`
- `input`：对局中每 tick 上传输入
- `game_state`：后端每 tick 下发权威状态
- `game_over`：胜利后结算（排名/冠军）
- `chat_send` → `chat`
- `ping` → `pong`：用于 RTT（Ping）估算

协议类型定义集中在：`backend/internal/game/messages.go`。

## 前端架构（frontend）

### 静态服务

- `frontend/cmd/frontend/main.go`
  - 启动 HTTP 静态服务，提供 `frontend/web/` 下的资源
  - `/config.js` 注入后端 ws 地址（`wsUrl`）

### 游戏客户端

- `frontend/web/app.js`
  - 连接 WebSocket 并维持会话（登录、房间、对局）
  - 监听键盘/鼠标，采集输入
  - 按后端 tick 间隔发送 `input`
  - 接收 `game_state` 并渲染

提示：为了方便你查找“与后端交互的代码”，我在前端加了统一标识符 `@BE`（Backend）。
你可以在编辑器里搜索 `@BE` 快速定位发送/接收逻辑。

## 前后端如何交互（输入 → 后端模拟 → 状态回传）

### 例子：玩家在对局中按下 W 并左键射击

1) 前端监听输入

- 键盘按下：在 `frontend/web/app.js` 的 `keydown/keyup` 里修改 `app.input.forward` 等字段
- 鼠标射击：`mousedown` 触发 `app.input.shootEdge = true`

2) 前端按固定间隔上传 `input`

- `startGameLoops()` 中 `setInterval(...)` 会把本 tick 的输入打包并 `send("input", payload)`
- payload 示例：

```json
{
  "forward": true,
  "back": false,
  "left": false,
  "right": false,
  "turn": 0.06,
  "shoot": true
}
```

3) 后端接收并缓存输入

- `backend/internal/game/hub.go`：收到 `type:"input"` → `handleInput(...)`
- `backend/internal/game/room.go`：`room.SetInput(playerID, input)` 把输入写到玩家对象上

4) 后端 tick 计算权威结果

- Hub 中 `runRoom(roomID)` 每 tick 调用 `room.Tick()`
- `room.Tick()` 里做：
  - `stepPlayer()`：按输入更新坐标/碰撞
  - `shoot()`：射线命中判定，扣血/击杀/重生
  - 达到 `winScore`：标记 `finished` 并设置 `winnerID`

5) 后端广播结果

- 每 tick 广播 `game_state`：包含所有玩家的 `x/y/dir/hp/score`
- 如果本 tick 触发胜利：广播 `game_over`（带击杀排名），并结束该房间的 tick 循环

6) 前端接收并渲染

- `frontend/web/app.js` 的 `onMessage(...)` 里处理：
  - `game_state`：更新 `app.gameState`
  - `game_over`：弹出结算面板（冠军 👑 + 祝福）
- 渲染循环 `renderFrame()` 会根据 `app.gameState` 画出墙、敌人、HUD、血条名字等
