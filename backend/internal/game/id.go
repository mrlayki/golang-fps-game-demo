package game

import (
	"crypto/rand"
	"encoding/base32"
	"strings"
)

func newID(prefix string) string {
	var buf [10]byte
	_, _ = rand.Read(buf[:])
	id := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(buf[:])
	return prefix + strings.ToLower(id)
}

