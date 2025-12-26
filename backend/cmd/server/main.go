package main

import (
	"flag"
	"log"
	"net/http"
	"time"

	"fps-backend/internal/game"
)

func main() {
	addr := flag.String("addr", ":8080", "http listen address")
	tickRate := flag.Int("tick", 20, "game tick rate (Hz)")
	flag.Parse()

	hub := game.NewHub(time.Second / time.Duration(*tickRate))

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.Handle("/ws", hub)

	srv := &http.Server{
		Addr:              *addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("backend listening on %s", *addr)
	log.Fatal(srv.ListenAndServe())
}

