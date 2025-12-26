package router

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"fps-webapp/internal/config"
	"fps-webapp/internal/handler"
	"fps-webapp/internal/middleware"
	"fps-webapp/internal/worker"
)

func New(cfg config.Config, userHandler *handler.UserHandler, queue *worker.Queue) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())

	// Keep logs similar to production access logs.
	r.Use(gin.LoggerWithFormatter(func(p gin.LogFormatterParams) string {
		rid := ""
		if p.Keys != nil {
			rid, _ = p.Keys[middleware.RequestIDKey].(string)
		}
		return fmtAccess(rid, p)
	}))

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	api := r.Group("/api/v1")
	{
		api.POST("/users", userHandler.Create)
		api.GET("/users/:id", userHandler.Get)
		api.GET("/users", userHandler.List)
		api.PUT("/users/:id/name", userHandler.UpdateName)
		api.DELETE("/users/:id", userHandler.Delete)

		// async demo: enqueue a background job
		api.POST("/jobs/demo", func(c *gin.Context) {
			queue.Enqueue(worker.Job{
				Type:    "demo",
				Payload: map[string]any{"at": time.Now().Format(time.RFC3339Nano)},
			})
			handler.OK(c, gin.H{"queued": true})
		})
	}

	return r
}

func fmtAccess(rid string, p gin.LogFormatterParams) string {
	// keep it simple: timestamp method path status latency rid clientIP
	return fmt.Sprintf(
		"%s %s %s %d %s rid=%s ip=%s\n",
		p.TimeStamp.Format(time.RFC3339),
		p.Method,
		p.Path,
		p.StatusCode,
		p.Latency,
		rid,
		p.ClientIP,
	)
}
