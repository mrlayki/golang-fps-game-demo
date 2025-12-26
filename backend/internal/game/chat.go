package game

import "strings"

func sanitizeChat(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	// keep messages compact (UI friendly)
	const max = 120
	r := []rune(s)
	if len(r) > max {
		r = r[:max]
	}
	return strings.TrimSpace(string(r))
}

func sanitizeWallText(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.ReplaceAll(s, "\r", " ")
	s = strings.Join(strings.Fields(s), " ")
	if s == "" {
		return ""
	}
	const max = 24
	r := []rune(s)
	if len(r) > max {
		r = r[:max]
	}
	return strings.TrimSpace(string(r))
}
