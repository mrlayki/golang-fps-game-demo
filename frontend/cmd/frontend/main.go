package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"time"
)

func main() {
	addr := flag.String("addr", ":5173", "http listen address")
	wsURL := flag.String("ws", "ws://localhost:8080/ws", "backend websocket url")
	flag.Parse()

	webDir := filepath.Join(".", "web")

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/config.js", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		_, _ = fmt.Fprintf(w, "window.__CONFIG__ = %s;\n", fmt.Sprintf(`{"wsUrl":%q}`, *wsURL))
	})
	mux.Handle("/", http.FileServer(http.Dir(webDir)))

	srv := &http.Server{
		Addr:              *addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("frontend listening on %s (backend ws: %s)", *addr, *wsURL)
	log.Fatal(srv.ListenAndServe())
}

