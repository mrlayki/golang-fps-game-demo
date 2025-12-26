package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTPAddr string
	GinMode  string

	DB     DBConfig
	Worker WorkerConfig
	Cron   CronConfig
}

type DBConfig struct {
	Dialect string
	DSN     string
}

type WorkerConfig struct {
	QueueSize int
}

type CronConfig struct {
	LogEvery time.Duration
}

func Load(_ string) (Config, error) {
	cfg := Config{
		HTTPAddr: envString("WEBAPP_ADDR", ":8090"),
		GinMode:  envString("GIN_MODE", "release"),
		DB: DBConfig{
			Dialect: envString("DB_DIALECT", "sqlite"),
			DSN:     envString("DB_DSN", "file:webapp.db?cache=shared&_fk=1"),
		},
		Worker: WorkerConfig{
			QueueSize: envInt("WORKER_QUEUE_SIZE", 128),
		},
		Cron: CronConfig{
			LogEvery: envDuration("CRON_LOG_EVERY", 10*time.Second),
		},
	}

	cfg.GinMode = strings.ToLower(cfg.GinMode)
	if cfg.GinMode != "debug" && cfg.GinMode != "release" && cfg.GinMode != "test" {
		return Config{}, errors.New("invalid GIN_MODE (debug/release/test)")
	}
	return cfg, nil
}

func envString(key, def string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	return v
}

func envInt(key string, def int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func envDuration(key string, def time.Duration) time.Duration {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil || d <= 0 {
		return def
	}
	return d
}
