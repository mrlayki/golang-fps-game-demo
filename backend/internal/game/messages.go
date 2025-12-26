package game

import "encoding/json"

type Envelope struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type HelloReq struct {
	Name string `json:"name"`
}

type HelloAck struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
}

type RoomsMsg struct {
	Rooms []RoomSummary `json:"rooms"`
}

type RoomCreateReq struct {
	Name string `json:"name"`
}

type RoomJoinReq struct {
	RoomID string `json:"roomId"`
}

type RoomReadyReq struct {
	Ready bool `json:"ready"`
}

type RoomStartReq struct {
	WinScore         *int    `json:"winScore,omitempty"`
	ShowEnemiesOnMap *bool   `json:"showEnemiesOnMap,omitempty"`
	WallText         *string `json:"wallText,omitempty"`
}

type RoomConfigReq struct {
	WinScore         *int    `json:"winScore,omitempty"`
	ShowEnemiesOnMap *bool   `json:"showEnemiesOnMap,omitempty"`
	WallText         *string `json:"wallText,omitempty"`
}

type ErrorMsg struct {
	Message string `json:"message"`
}

type InputReq struct {
	Forward bool    `json:"forward"`
	Back    bool    `json:"back"`
	Left    bool    `json:"left"`
	Right   bool    `json:"right"`
	Turn    float64 `json:"turn"`
	Shoot   bool    `json:"shoot"`
}

type GameStartMsg struct {
	Map    Map `json:"map"`
	TickMS int `json:"tickMs"`
	WinScore int `json:"winScore"`
	ShowEnemiesOnMap bool `json:"showEnemiesOnMap"`
	WallText string `json:"wallText"`
}

type ChatSendReq struct {
	Text string `json:"text"`
}

type ChatMsg struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	Text   string `json:"text"`
	TS     int64  `json:"ts"`
}

type PingReq struct {
	T int64 `json:"t"`
}

type PongMsg struct {
	T int64 `json:"t"`
}

type GameOverMsg struct {
	RoomID   string        `json:"roomId"`
	RoomName string        `json:"roomName"`
	WinnerID string        `json:"winnerId"`
	WinScore int           `json:"winScore"`
	Rankings []PlayerFrame `json:"rankings"`
}
