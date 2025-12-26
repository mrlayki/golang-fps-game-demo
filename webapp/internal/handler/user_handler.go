package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"fps-webapp/internal/service"
)

type UserHandler struct {
	svc *service.UserService
}

func NewUserHandler(svc *service.UserService) *UserHandler {
	return &UserHandler{svc: svc}
}

type CreateUserReq struct {
	Name  string `json:"name" binding:"required,min=1,max=64"`
	Email string `json:"email" binding:"required,email,max=120"`
}

func (h *UserHandler) Create(c *gin.Context) {
	var req CreateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	u, err := h.svc.Create(c.Request.Context(), req.Name, req.Email)
	if err != nil {
		FromErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, APIResponse{OK: true, Data: u})
}

func (h *UserHandler) Get(c *gin.Context) {
	id := c.Param("id")
	u, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		FromErr(c, err)
		return
	}
	OK(c, u)
}

func (h *UserHandler) List(c *gin.Context) {
	limit := parseInt(c.Query("limit"), 20)
	offset := parseInt(c.Query("offset"), 0)
	users, err := h.svc.List(c.Request.Context(), limit, offset)
	if err != nil {
		FromErr(c, err)
		return
	}
	OKList(c, users, limit, offset)
}

type UpdateUserReq struct {
	Name string `json:"name" binding:"required,min=1,max=64"`
}

func (h *UserHandler) UpdateName(c *gin.Context) {
	id := c.Param("id")
	var req UpdateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	u, err := h.svc.UpdateName(c.Request.Context(), id, req.Name)
	if err != nil {
		FromErr(c, err)
		return
	}
	OK(c, u)
}

func (h *UserHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		FromErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func parseInt(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

