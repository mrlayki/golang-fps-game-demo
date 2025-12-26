package game

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"fps-backend/internal/ws"
)

type Hub struct {
	tick time.Duration

	mu      sync.Mutex
	clients map[string]*Client
	rooms   map[string]*Room
}

func NewHub(tick time.Duration) *Hub {
	return &Hub{
		tick:    tick,
		clients: map[string]*Client{},
		rooms:   map[string]*Room{},
	}
}

func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := ws.Upgrade(w, r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	client := &Client{
		id:   newID("u_"),
		conn: conn,
		send: make(chan []byte, 64),
	}

	h.mu.Lock()
	h.clients[client.id] = client
	h.mu.Unlock()

	go h.writeLoop(client)
	h.readLoop(client)
}

func (h *Hub) writeLoop(c *Client) {
	defer func() {
		_ = c.conn.Close()
	}()
	for msg := range c.send {
		if err := c.conn.WriteText(msg); err != nil {
			return
		}
	}
}

func (h *Hub) readLoop(c *Client) {
	defer h.disconnect(c)

	for {
		text, err := c.conn.ReadText()
		if err != nil {
			return
		}

		var env Envelope
		if err := json.Unmarshal(text, &env); err != nil {
			h.sendError(c, "invalid json")
			continue
		}

		switch env.Type {
		case "hello":
			var req HelloReq
			if err := json.Unmarshal(env.Payload, &req); err != nil || req.Name == "" {
				h.sendError(c, "name required")
				continue
			}
			h.handleHello(c, req.Name)
		case "rooms_list":
			if !h.requireAuthed(c) {
				continue
			}
			h.sendRooms(c)
		case "room_create":
			if !h.requireAuthed(c) {
				continue
			}
			var req RoomCreateReq
			if err := json.Unmarshal(env.Payload, &req); err != nil {
				h.sendError(c, "invalid payload")
				continue
			}
			h.handleRoomCreate(c, req.Name)
		case "room_join":
			if !h.requireAuthed(c) {
				continue
			}
			var req RoomJoinReq
			if err := json.Unmarshal(env.Payload, &req); err != nil {
				h.sendError(c, "invalid payload")
				continue
			}
			h.handleRoomJoin(c, req.RoomID)
		case "room_leave":
			if !h.requireAuthed(c) {
				continue
			}
			h.handleRoomLeave(c)
		case "room_ready":
			if !h.requireAuthed(c) {
				continue
			}
			var req RoomReadyReq
			if err := json.Unmarshal(env.Payload, &req); err != nil {
				h.sendError(c, "invalid payload")
				continue
			}
			h.handleRoomReady(c, req.Ready)
		case "room_start":
			if !h.requireAuthed(c) {
				continue
			}
			var req RoomStartReq
			if len(env.Payload) > 0 {
				_ = json.Unmarshal(env.Payload, &req)
			}
			h.handleRoomStart(c, req)
		case "room_config":
			if !h.requireAuthed(c) {
				continue
			}
			var req RoomConfigReq
			if len(env.Payload) > 0 {
				_ = json.Unmarshal(env.Payload, &req)
			}
			h.handleRoomConfig(c, req)
		case "input":
			if !h.requireAuthed(c) {
				continue
			}
			var req InputReq
			if err := json.Unmarshal(env.Payload, &req); err != nil {
				continue
			}
			h.handleInput(c, req)
		case "chat_send":
			if !h.requireAuthed(c) {
				continue
			}
			var req ChatSendReq
			if err := json.Unmarshal(env.Payload, &req); err != nil {
				h.sendError(c, "invalid payload")
				continue
			}
			h.handleChatSend(c, req.Text)
		case "ping":
			// app-level ping/pong (RTT measurement)
			var req PingReq
			if err := json.Unmarshal(env.Payload, &req); err != nil {
				continue
			}
			h.send(c, "pong", PongMsg{T: req.T})
		default:
			h.sendError(c, "unknown type")
		}
	}
}

func (h *Hub) requireAuthed(c *Client) bool {
	if c.name == "" {
		h.sendError(c, "send hello first")
		return false
	}
	return true
}

func (h *Hub) disconnect(c *Client) {
	h.mu.Lock()
	delete(h.clients, c.id)
	h.mu.Unlock()

	h.handleRoomLeave(c)
	close(c.send)
	_ = c.conn.Close()
}

func (h *Hub) handleHello(c *Client, name string) {
	h.mu.Lock()
	c.name = name
	h.mu.Unlock()

	h.send(c, "hello_ack", HelloAck{UserID: c.id, Name: c.name})
	h.sendRooms(c)
}

func (h *Hub) sendRooms(c *Client) {
	h.mu.Lock()
	rooms := make([]RoomSummary, 0, len(h.rooms))
	for _, r := range h.rooms {
		rooms = append(rooms, r.Summary())
	}
	h.mu.Unlock()

	h.send(c, "rooms", RoomsMsg{Rooms: rooms})
}

func (h *Hub) broadcastRooms() {
	h.mu.Lock()
	rooms := make([]RoomSummary, 0, len(h.rooms))
	for _, r := range h.rooms {
		rooms = append(rooms, r.Summary())
	}
	clients := make([]*Client, 0, len(h.clients))
	for _, c := range h.clients {
		if c.name != "" && c.roomID == "" {
			clients = append(clients, c)
		}
	}
	h.mu.Unlock()

	msg, _ := json.Marshal(Envelope{Type: "rooms", Payload: mustJSON(RoomsMsg{Rooms: rooms})})
	for _, c := range clients {
		h.trySendRaw(c, msg)
	}
}

func (h *Hub) handleRoomCreate(c *Client, name string) {
	if name == "" {
		name = "Room"
	}

	h.mu.Lock()
	if c.roomID != "" {
		h.mu.Unlock()
		h.sendError(c, "already in room")
		return
	}
	room := NewRoom(newID("r_"), name, c.id)
	h.rooms[room.id] = room
	h.mu.Unlock()

	h.handleRoomJoin(c, room.id)
	h.broadcastRooms()
}

func (h *Hub) handleRoomJoin(c *Client, roomID string) {
	h.mu.Lock()
	room, ok := h.rooms[roomID]
	if !ok {
		h.mu.Unlock()
		h.sendError(c, "room not found")
		return
	}
	if room.started {
		h.mu.Unlock()
		h.sendError(c, "room already started")
		return
	}
	if c.roomID != "" {
		h.mu.Unlock()
		h.sendError(c, "already in room")
		return
	}
	room.AddPlayer(c.id, c.name)
	c.roomID = room.id
	state := room.State()
	h.mu.Unlock()

	h.send(c, "room_state", state)
	h.broadcastRoom(room.id)
	h.broadcastRooms()
}

func (h *Hub) handleRoomLeave(c *Client) {
	h.mu.Lock()
	roomID := c.roomID
	if roomID == "" {
		h.mu.Unlock()
		return
	}
	room, ok := h.rooms[roomID]
	if !ok {
		c.roomID = ""
		h.mu.Unlock()
		return
	}
	room.RemovePlayer(c.id)
	c.roomID = ""
	shouldDelete := len(room.players) == 0
	if shouldDelete {
		delete(h.rooms, room.id)
	}
	h.mu.Unlock()

	if shouldDelete {
		h.broadcastRooms()
		return
	}
	h.broadcastRoom(roomID)
	h.broadcastRooms()
}

func (h *Hub) handleRoomReady(c *Client, ready bool) {
	h.mu.Lock()
	room, ok := h.rooms[c.roomID]
	if !ok {
		h.mu.Unlock()
		return
	}
	room.SetReady(c.id, ready)
	h.mu.Unlock()
	h.broadcastRoom(room.id)
}

func (h *Hub) handleRoomStart(c *Client, req RoomStartReq) {
	h.mu.Lock()
	room, ok := h.rooms[c.roomID]
	if !ok {
		h.mu.Unlock()
		return
	}
	if room.hostID != c.id {
		h.mu.Unlock()
		h.sendError(c, "only host can start")
		return
	}
	if room.started {
		h.mu.Unlock()
		return
	}
	if !room.AllReady() {
		h.mu.Unlock()
		h.sendError(c, "everyone must be ready")
		return
	}
	room.ConfigureForStart(req.WinScore, req.ShowEnemiesOnMap, req.WallText)
	room.Start()
	roomID := room.id
	h.mu.Unlock()

	h.broadcastRoom(roomID)
	h.broadcastGameStart(roomID)
	go h.runRoom(roomID)
	h.broadcastRooms()
}

func (h *Hub) handleRoomConfig(c *Client, req RoomConfigReq) {
	h.mu.Lock()
	room, ok := h.rooms[c.roomID]
	if !ok {
		h.mu.Unlock()
		return
	}
	if room.hostID != c.id {
		h.mu.Unlock()
		h.sendError(c, "only host can config")
		return
	}
	if room.started {
		h.mu.Unlock()
		h.sendError(c, "room already started")
		return
	}
	room.ConfigureForStart(req.WinScore, req.ShowEnemiesOnMap, req.WallText)
	roomID := room.id
	h.mu.Unlock()

	h.broadcastRoom(roomID)
	h.broadcastRooms()
}

func (h *Hub) handleInput(c *Client, req InputReq) {
	h.mu.Lock()
	room, ok := h.rooms[c.roomID]
	if !ok || !room.started || room.finished {
		h.mu.Unlock()
		return
	}
	room.SetInput(c.id, req)
	h.mu.Unlock()
}

func (h *Hub) handleChatSend(c *Client, text string) {
	text = sanitizeChat(text)
	if text == "" {
		return
	}

	h.mu.Lock()
	roomID := c.roomID
	if roomID == "" {
		h.mu.Unlock()
		h.sendError(c, "not in room")
		return
	}
	_, ok := h.rooms[roomID]
	if !ok {
		h.mu.Unlock()
		return
	}
	msg := ChatMsg{
		UserID: c.id,
		Name:   c.name,
		Text:   text,
		TS:     time.Now().UnixMilli(),
	}
	h.mu.Unlock()

	h.broadcastChat(roomID, msg)
}

func (h *Hub) broadcastChat(roomID string, msg ChatMsg) {
	h.mu.Lock()
	clients := h.roomClientsLocked(roomID)
	h.mu.Unlock()

	raw, _ := json.Marshal(Envelope{Type: "chat", Payload: mustJSON(msg)})
	for _, c := range clients {
		h.trySendRaw(c, raw)
	}
}

func (h *Hub) broadcastRoom(roomID string) {
	h.mu.Lock()
	room, ok := h.rooms[roomID]
	if !ok {
		h.mu.Unlock()
		return
	}
	state := room.State()
	clients := h.roomClientsLocked(roomID)
	h.mu.Unlock()

	msg, _ := json.Marshal(Envelope{Type: "room_state", Payload: mustJSON(state)})
	for _, c := range clients {
		h.trySendRaw(c, msg)
	}
}

func (h *Hub) broadcastGameStart(roomID string) {
	h.mu.Lock()
	room, ok := h.rooms[roomID]
	if !ok {
		h.mu.Unlock()
		return
	}
	clients := h.roomClientsLocked(roomID)
	start := GameStartMsg{
		Map:              room.m,
		TickMS:           int(h.tick / time.Millisecond),
		WinScore:         room.winScore,
		ShowEnemiesOnMap: room.showEnemiesOnMap,
		WallText:         room.wallText,
	}
	h.mu.Unlock()

	msg, _ := json.Marshal(Envelope{Type: "game_start", Payload: mustJSON(start)})
	for _, c := range clients {
		h.trySendRaw(c, msg)
	}
}

func (h *Hub) runRoom(roomID string) {
	ticker := time.NewTicker(h.tick)
	defer ticker.Stop()

	for range ticker.C {
		h.mu.Lock()
		room, ok := h.rooms[roomID]
		if !ok || !room.started {
			h.mu.Unlock()
			return
		}
		room.Tick()
		state := room.GameState()
		clients := h.roomClientsLocked(roomID)
		ended := room.finished && !room.gameOverSent
		var over GameOverMsg
		if ended {
			room.gameOverSent = true
			over = GameOverMsg{
				RoomID:   room.id,
				RoomName: room.name,
				WinnerID: room.winnerID,
				WinScore: room.winScore,
				Rankings: room.Rankings(),
			}
		}
		h.mu.Unlock()

		msg, _ := json.Marshal(Envelope{Type: "game_state", Payload: mustJSON(state)})
		for _, c := range clients {
			h.trySendRaw(c, msg)
		}

		if ended {
			msg2, _ := json.Marshal(Envelope{Type: "game_over", Payload: mustJSON(over)})
			for _, c := range clients {
				h.trySendRaw(c, msg2)
			}
			return
		}
	}
}

func (h *Hub) roomClientsLocked(roomID string) []*Client {
	clients := make([]*Client, 0, 8)
	for _, c := range h.clients {
		if c.roomID == roomID && c.name != "" {
			clients = append(clients, c)
		}
	}
	return clients
}

func (h *Hub) sendError(c *Client, msg string) {
	h.send(c, "error", ErrorMsg{Message: msg})
}

func (h *Hub) send(c *Client, typ string, payload any) {
	env := Envelope{Type: typ, Payload: mustJSON(payload)}
	raw, err := json.Marshal(env)
	if err != nil {
		log.Printf("json marshal: %v", err)
		return
	}
	h.trySendRaw(c, raw)
}

func (h *Hub) trySendRaw(c *Client, raw []byte) {
	select {
	case c.send <- raw:
	default:
	}
}

func mustJSON(v any) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}
