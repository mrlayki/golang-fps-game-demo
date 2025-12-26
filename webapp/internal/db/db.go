package db

import (
	"errors"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"fps-webapp/internal/config"
	"fps-webapp/internal/model"
)

func Open(cfg config.DBConfig) (*gorm.DB, func() error, error) {
	switch cfg.Dialect {
	case "sqlite":
		gdb, err := gorm.Open(sqlite.Open(cfg.DSN), &gorm.Config{})
		if err != nil {
			return nil, nil, err
		}
		if err := gdb.AutoMigrate(&model.User{}); err != nil {
			return nil, nil, err
		}
		closeFn := func() error {
			sdb, err := gdb.DB()
			if err != nil {
				return err
			}
			return sdb.Close()
		}
		return gdb, closeFn, nil
	default:
		return nil, nil, errors.New("unsupported DB_DIALECT (only sqlite is wired in this demo)")
	}
}

