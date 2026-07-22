package main

import (
	_ "embed"
	"encoding/json"
	"log"
	"net/http"
)

//go:embed openapi.json
var openapi string

type Release struct {
	ID      string `json:"id"`
	Version string `json:"version"`
	Channel string `json:"channel"`
}

func main() {
	http.HandleFunc("/openapi.json", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(openapi))
	})

	http.HandleFunc("/releases", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]Release{
			{ID: "rel_1", Version: "1.0.0", Channel: "stable"},
		})
	})

	log.Println("Go example listening on http://127.0.0.1:8030")
	log.Fatal(http.ListenAndServe(":8030", nil))
}
