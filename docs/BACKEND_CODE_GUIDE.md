# 后端 Go 代码学习导读（backend）

这份文档面向“学习 Go + 学习网络/同步”的阅读方式：先从入口与协议开始，再看 WebSocket，再看 Hub/Room 的业务循环。

> 说明：`backend/internal/game/hub.go`（~500+ 行）和 `backend/internal/game/room.go`（~300+ 行）非常长，如果完全逐行写注释会变成几千行“注释噪音”。我在它们上采用“逐函数 + 关键行”方式，并配合 `rg -n`/`nl -ba` 给你精确定位。你如果希望我把某一个大文件也做成“逐行释义”，告诉我文件名即可（例如只做 `hub.go`）。

## 推荐阅读顺序

1. `backend/cmd/server/main.go`：程序入口、HTTP 路由、Hub 挂载
2. `backend/internal/game/messages.go`：所有 WebSocket 消息 payload 类型
3. `backend/internal/ws/ws.go`：WebSocket 握手与帧格式（读写）
4. `backend/internal/game/hub.go`：连接/房间管理、消息分发、tick 循环
5. `backend/internal/game/room.go`：移动/碰撞/射击/胜利条件
6. `backend/internal/game/map.go`：地图与墙体判断

## 工具：带行号阅读

你在项目根目录执行：

```bash
nl -ba backend/cmd/server/main.go
nl -ba backend/internal/game/messages.go
nl -ba backend/internal/ws/ws.go
rg -n "^func" backend/internal/game/hub.go
rg -n "^func" backend/internal/game/room.go
```

## 1) `backend/cmd/server/main.go`（逐行）

参考：`backend/cmd/server/main.go:1`

- L1：`package main`，可执行程序入口包。
- L3-L10：导入依赖（标准库 `flag/log/net/http/time` + 业务包 `fps-backend/internal/game`）。
- L12：`main()`，Go 程序从这里开始执行。
- L13：定义命令行参数 `-addr`，默认 `:8080`。
- L14：定义命令行参数 `-tick`，默认 `20`（20Hz）。
- L15：解析命令行参数，把值写入指针 `*addr`、`*tickRate`。
- L17：创建 `Hub`：`tick = time.Second / tickRate`（每 tick 的时间间隔）。
- L19：创建 `http.ServeMux`，用于注册路由。
- L20-L23：注册 `/healthz` 路由，方便健康检查与连通性测试。
- L24：注册 `/ws` 路由，Handler 是 `hub`（`Hub` 实现了 `ServeHTTP`）。
- L26-L30：构造 `http.Server`，设置监听地址、Handler、读取请求头超时时间。
- L32：日志输出监听地址。
- L33：`ListenAndServe()` 启动；`log.Fatal` 在返回错误时退出进程并打印错误。

## 2) `backend/internal/game/messages.go`（逐行）

参考：`backend/internal/game/messages.go:1`

核心：把 WebSocket 消息的 `payload` 结构体都集中定义在一个文件里，便于前后端对齐字段名。

- L5-L8：`Envelope` 是统一外层封装 `{type,payload}`，`payload` 用 `json.RawMessage` 延迟解析。
- L10-L17：`hello` / `hello_ack` 的 payload（仅名字登录，后端分配 `userId`）。
- L19-L21：`rooms` 列表消息的 payload。
- L23-L29：创建/加入房间请求 payload。
- L31-L33：准备状态 payload。
- L35-L45：房主开局/房主配置的 payload（指针字段表示“可选”：没传就不改后端当前值）。
- L51-L58：`input` 消息：前端只上传输入，不上传坐标。
- L60-L66：`game_start`：地图、tick 周期、胜利条件、小地图是否显示敌方、墙上标语。
- L68-L77：聊天消息（`chat_send` → `chat`）。
- L79-L85：应用层 ping/pong（测 RTT 延迟）。
- L87-L93：`game_over`：房间结算数据（冠军、胜利分、排名列表）。

## 3) `backend/internal/ws/ws.go`（逐段+关键行）

参考：`backend/internal/ws/ws.go:1`

### Upgrade：HTTP → WebSocket（L26-L66）

- L27-L39：校验 Upgrade 必需的请求头（`Connection/Upgrade/Sec-WebSocket-Version/Sec-WebSocket-Key`）。
- L40：根据 `Sec-WebSocket-Key` 计算 `Sec-WebSocket-Accept`（RFC 规范要求）。
- L42-L49：使用 `http.Hijacker` 劫持底层 TCP 连接（WebSocket 的握手需要切到“裸 TCP”）。
- L51-L59：写回 `101 Switching Protocols` 响应头，完成握手。
- L61-L65：把 `net.Conn` 包装成 `Conn`，带 `bufio.Reader/Writer`。

### 帧读：客户端 → 服务端（L114-L178）

- L115-L122：读两个字节：FIN/Opcode/Mask/Len。
- L124-L128：拒绝分片帧（本项目不支持 continuation）。
- L130-L133：客户端帧必须 masked（浏览器规范要求）。
- L135-L138：解析 payload 长度（支持 7-bit/16-bit/64-bit 三种长度表示）。
- L140-L151：读取 maskKey 和 payload，然后做 XOR 解 mask。

### 帧写：服务端 → 客户端（L180-L224）

- L181-L183：`writeMu` 保证并发写安全。
- L184：FIN=1 + opcode。
- L189-L218：写长度字段（<126 / 16bit / 64bit）。
- L220-L223：写 payload 并 flush。

## 4) `backend/internal/game/hub.go`（逐函数定位）

用下面命令列出函数与行号：

```bash
rg -n "^func" backend/internal/game/hub.go
```

重点函数（按执行路径）：

- `ServeHTTP`（连接入口）：升级 WebSocket、创建 `Client`、启动 `writeLoop`，然后进入 `readLoop`
- `readLoop`（消息分发）：解析 `Envelope`，按 `Type` 分派到各个 `handleXxx`
- `handleRoomCreate/Join/Leave/Ready/Config/Start`：房间状态机（大厅→房间→对局）
- `runRoom`：对局 tick 循环（`room.Tick()` + 广播 `game_state`，结束时广播 `game_over`）
- `broadcastRoom/broadcastRooms`：广播房间状态/大厅房间列表

典型调用链示例（房主点击“开始”）：

1. 前端发送 `room_start`（见 `docs/ARCHITECTURE.md` 的例子）
2. `hub.go` 的 `readLoop` 收到 `type:"room_start"` → `handleRoomStart`
3. `handleRoomStart`：
   - 校验是否房主/是否全部准备
   - `room.ConfigureForStart(...)` 保存胜利条件/小地图敌人开关/墙面标语
   - `room.Start()` 进入对局
   - 广播 `room_state`、`game_start`，并 `go runRoom(roomID)`

## 5) `backend/internal/game/room.go`（逐函数定位）

列出函数与行号：

```bash
rg -n "^func" backend/internal/game/room.go
```

你学习时建议重点看：

- `SetInput`：把前端 `input` 记录下来，并更新 `dir`
- `Tick`：每 tick 更新移动/射击/冷却
- `stepPlayer`：碰撞检测（用 `Map.IsWall` 做简单的圆形碰撞）
- `shoot`：射线前进，命中玩家则扣血；击杀则加分、检查胜利、重生目标
- `Rankings`：按 `Score` 排序，提供 `game_over` 的排名

## 6) 其它小文件（逐行很快）

### `backend/internal/game/map.go`

参考：`backend/internal/game/map.go:1`

- `DefaultMap()` 返回字符串数组地图：`#` 是墙、`.` 是空地。
- `IsWall(x,y)` 把浮点坐标转为格子索引并判断是否是墙。

### `backend/internal/game/id.go`

参考：`backend/internal/game/id.go:1`

- `newID(prefix)`：用 `crypto/rand` 生成 10 字节随机数，再 base32 编码，作为 `u_xxx`、`r_xxx` 这类 ID。

### `backend/internal/game/chat.go`

参考：`backend/internal/game/chat.go:1`

- `sanitizeChat`：去空格、限制最大 rune 数（防止 UI 过长）。
- `sanitizeWallText`：去换行、压缩空白、限制长度（用于“墙上标语”）。

### `backend/internal/game/types.go`

参考：`backend/internal/game/types.go:1`

- `Client`：代表一个 WebSocket 连接（包含 `conn` 与发送缓冲 `send`）。

