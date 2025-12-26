package worker

import (
	"context"
	"io"
	"log"
	"sync"
	"time"

	"fps-webapp/internal/config"
)

type Job struct {
	Type    string
	Payload any
}

type Queue struct {
	ch chan Job

	wg     sync.WaitGroup
	cancel context.CancelFunc
}

func NewQueue(cfg config.WorkerConfig) *Queue {
	size := cfg.QueueSize
	if size <= 0 {
		size = 128
	}

	ctx, cancel := context.WithCancel(context.Background())
	q := &Queue{
		ch:     make(chan Job, size),
		cancel: cancel,
	}
	q.wg.Add(1)
	go q.workerLoop(ctx)
	return q
}

func (q *Queue) Enqueue(job Job) {
	select {
	case q.ch <- job:
	default:
		// demo policy: drop when full; production: backpressure / retry / DLQ
		log.Printf("worker queue full, drop job type=%s", job.Type)
	}
}

func (q *Queue) Close() error {
	q.cancel()
	q.wg.Wait()
	return nil
}

var _ io.Closer = (*Queue)(nil)

func (q *Queue) workerLoop(ctx context.Context) {
	defer q.wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case job := <-q.ch:
			q.handle(job)
		}
	}
}

func (q *Queue) handle(job Job) {
	switch job.Type {
	case "demo":
		log.Printf("[job] demo payload=%v", job.Payload)
	case "cron_heartbeat":
		log.Printf("[job] cron heartbeat %v", job.Payload)
	default:
		log.Printf("[job] unknown type=%s payload=%v", job.Type, job.Payload)
	}
	time.Sleep(10 * time.Millisecond) // simulate work
}

