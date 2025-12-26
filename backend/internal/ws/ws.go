package ws

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
)

const wsGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

type Conn struct {
	c  net.Conn
	br *bufio.Reader
	bw *bufio.Writer

	writeMu sync.Mutex
}

func Upgrade(w http.ResponseWriter, r *http.Request) (*Conn, error) {
	if !headerContainsToken(r.Header, "Connection", "Upgrade") {
		return nil, errors.New("missing Connection: Upgrade")
	}
	if !headerContainsToken(r.Header, "Upgrade", "websocket") {
		return nil, errors.New("missing Upgrade: websocket")
	}
	if r.Header.Get("Sec-WebSocket-Version") != "13" {
		return nil, errors.New("unsupported websocket version")
	}
	key := strings.TrimSpace(r.Header.Get("Sec-WebSocket-Key"))
	if key == "" {
		return nil, errors.New("missing Sec-WebSocket-Key")
	}
	accept := computeAccept(key)

	hj, ok := w.(http.Hijacker)
	if !ok {
		return nil, errors.New("hijacking not supported")
	}
	netConn, buf, err := hj.Hijack()
	if err != nil {
		return nil, err
	}

	_, _ = fmt.Fprintf(buf, "HTTP/1.1 101 Switching Protocols\r\n")
	_, _ = fmt.Fprintf(buf, "Upgrade: websocket\r\n")
	_, _ = fmt.Fprintf(buf, "Connection: Upgrade\r\n")
	_, _ = fmt.Fprintf(buf, "Sec-WebSocket-Accept: %s\r\n", accept)
	_, _ = fmt.Fprintf(buf, "\r\n")
	if err := buf.Flush(); err != nil {
		_ = netConn.Close()
		return nil, err
	}

	return &Conn{
		c:  netConn,
		br: bufio.NewReader(netConn),
		bw: bufio.NewWriter(netConn),
	}, nil
}

func computeAccept(key string) string {
	h := sha1.New()
	_, _ = io.WriteString(h, key)
	_, _ = io.WriteString(h, wsGUID)
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func headerContainsToken(h http.Header, name, token string) bool {
	for _, v := range h.Values(name) {
		parts := strings.Split(v, ",")
		for _, p := range parts {
			if strings.EqualFold(strings.TrimSpace(p), token) {
				return true
			}
		}
	}
	return false
}

func (c *Conn) Close() error {
	return c.c.Close()
}

func (c *Conn) ReadText() ([]byte, error) {
	for {
		op, payload, err := c.readFrame()
		if err != nil {
			return nil, err
		}
		switch op {
		case 0x1:
			return payload, nil
		case 0x8:
			return nil, io.EOF
		case 0x9:
			_ = c.writeFrame(0xA, payload)
		case 0xA:
		default:
		}
	}
}

func (c *Conn) WriteText(b []byte) error {
	return c.writeFrame(0x1, b)
}

func (c *Conn) readFrame() (opcode byte, payload []byte, err error) {
	b0, err := c.br.ReadByte()
	if err != nil {
		return 0, nil, err
	}
	b1, err := c.br.ReadByte()
	if err != nil {
		return 0, nil, err
	}

	fin := (b0 & 0x80) != 0
	opcode = b0 & 0x0F
	if !fin {
		return 0, nil, errors.New("fragmented frames not supported")
	}

	masked := (b1 & 0x80) != 0
	if !masked {
		return 0, nil, errors.New("client frames must be masked")
	}
	length7 := int(b1 & 0x7F)
	length, err := c.readLength(length7)
	if err != nil {
		return 0, nil, err
	}

	var maskKey [4]byte
	if _, err := io.ReadFull(c.br, maskKey[:]); err != nil {
		return 0, nil, err
	}
	payload = make([]byte, length)
	if _, err := io.ReadFull(c.br, payload); err != nil {
		return 0, nil, err
	}
	for i := 0; i < length; i++ {
		payload[i] ^= maskKey[i%4]
	}
	return opcode, payload, nil
}

func (c *Conn) readLength(length7 int) (int, error) {
	switch length7 {
	case 126:
		var b [2]byte
		if _, err := io.ReadFull(c.br, b[:]); err != nil {
			return 0, err
		}
		return int(b[0])<<8 | int(b[1]), nil
	case 127:
		var b [8]byte
		if _, err := io.ReadFull(c.br, b[:]); err != nil {
			return 0, err
		}
		n := 0
		for i := 0; i < 8; i++ {
			n = (n << 8) | int(b[i])
		}
		if n < 0 || n > 1<<20 {
			return 0, errors.New("payload too large")
		}
		return n, nil
	default:
		return length7, nil
	}
}

func (c *Conn) writeFrame(opcode byte, payload []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()

	b0 := byte(0x80) | (opcode & 0x0F)
	if err := c.bw.WriteByte(b0); err != nil {
		return err
	}

	n := len(payload)
	switch {
	case n < 126:
		if err := c.bw.WriteByte(byte(n)); err != nil {
			return err
		}
	case n <= 0xFFFF:
		if err := c.bw.WriteByte(126); err != nil {
			return err
		}
		if err := c.bw.WriteByte(byte(n >> 8)); err != nil {
			return err
		}
		if err := c.bw.WriteByte(byte(n)); err != nil {
			return err
		}
	default:
		if err := c.bw.WriteByte(127); err != nil {
			return err
		}
		var b [8]byte
		x := uint64(n)
		for i := 7; i >= 0; i-- {
			b[i] = byte(x)
			x >>= 8
		}
		if _, err := c.bw.Write(b[:]); err != nil {
			return err
		}
	}

	if _, err := c.bw.Write(payload); err != nil {
		return err
	}
	return c.bw.Flush()
}

