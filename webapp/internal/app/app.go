package app

import (
	"io"

	"github.com/gin-gonic/gin"

	"fps-webapp/internal/config"
	"fps-webapp/internal/db"
	"fps-webapp/internal/handler"
	"fps-webapp/internal/repository"
	"fps-webapp/internal/router"
	"fps-webapp/internal/service"
	"fps-webapp/internal/task"
	"fps-webapp/internal/worker"
)

type App struct {
	Router *gin.Engine

	dbClose   func() error
	taskClose io.Closer
	workClose io.Closer
}

func New(cfg config.Config) (*App, error) {
	gin.SetMode(cfg.GinMode)

	database, closeDB, err := db.Open(cfg.DB)
	if err != nil {
		return nil, err
	}

	userRepo := repository.NewUserRepo(database)
	userSvc := service.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userSvc)

	queue := worker.NewQueue(cfg.Worker)
	cron := task.NewCron(cfg.Cron, queue)
	cron.Start()

	r := router.New(cfg, userHandler, queue)

	return &App{
		Router:    r,
		dbClose:   closeDB,
		taskClose: cron,
		workClose: queue,
	}, nil
}

func (a *App) Close() {
	if a.taskClose != nil {
		_ = a.taskClose.Close()
	}
	if a.workClose != nil {
		_ = a.workClose.Close()
	}
	if a.dbClose != nil {
		_ = a.dbClose()
	}
}

