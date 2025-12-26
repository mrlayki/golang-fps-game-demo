package task

import (
	"io"
	"time"

	"fps-webapp/internal/config"
	"fps-webapp/internal/worker"
)

type Cron struct {
	ticker *time.Ticker
	stop   chan struct{}

	queue *worker.Queue
}

func NewCron(cfg config.CronConfig, queue *worker.Queue) *Cron {
	d := cfg.LogEvery
	if d <= 0 {
		d = 10 * time.Second
	}
	return &Cron{
		ticker: time.NewTicker(d),
		stop:   make(chan struct{}),
		queue:  queue,
	}
}

func (c *Cron) Start() {
	go func() {
		for {
			select {
			case <-c.stop:
				return
			case t := <-c.ticker.C:
				c.queue.Enqueue(worker.Job{
					Type:    "cron_heartbeat",
					Payload: map[string]any{"at": t.Format(time.RFC3339Nano)},
				})
			}
		}
	}()
}

func (c *Cron) Close() error {
	close(c.stop)
	c.ticker.Stop()
	return nil
}

var _ io.Closer = (*Cron)(nil)

