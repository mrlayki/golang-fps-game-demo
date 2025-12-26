package game

import "fps-backend/internal/ws"

type Client struct {
	id   string
	name string

	roomID string

	conn *ws.Conn
	send chan []byte
}
