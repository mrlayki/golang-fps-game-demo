package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"fps-webapp/internal/repository"
)

type APIResponse struct {
	OK    bool        `json:"ok"`
	Data  any         `json:"data,omitempty"`
	Error *APIError   `json:"error,omitempty"`
	Meta  *APIMeta    `json:"meta,omitempty"`
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type APIMeta struct {
	Limit  int `json:"limit,omitempty"`
	Offset int `json:"offset,omitempty"`
}

func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, APIResponse{OK: true, Data: data})
}

func OKList(c *gin.Context, data any, limit, offset int) {
	c.JSON(http.StatusOK, APIResponse{OK: true, Data: data, Meta: &APIMeta{Limit: limit, Offset: offset}})
}

func Fail(c *gin.Context, status int, code, msg string) {
	c.JSON(status, APIResponse{OK: false, Error: &APIError{Code: code, Message: msg}})
}

func FromErr(c *gin.Context, err error) {
	switch err {
	case nil:
		OK(c, gin.H{"status": "ok"})
	case repository.ErrNotFound:
		Fail(c, http.StatusNotFound, "NOT_FOUND", "resource not found")
	case repository.ErrConflict:
		Fail(c, http.StatusConflict, "CONFLICT", "resource already exists")
	default:
		Fail(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
	}
}

