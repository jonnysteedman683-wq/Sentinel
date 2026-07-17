package logging

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"

	"google.golang.org/protobuf/encoding/protojson"
	pb "sentinel/proto/sentinel/v1"
)

// AsyncLogger buffers and writes DecisionEvents
type AsyncLogger struct {
	ch     chan *pb.DecisionEvent
	writer io.Writer
	done   chan struct{}
}

// NewAsyncLogger starts the logging goroutine
func NewAsyncLogger(w io.Writer, bufferSize int) *AsyncLogger {
	l := &AsyncLogger{
		ch:     make(chan *pb.DecisionEvent, bufferSize),
		writer: w,
		done:   make(chan struct{}),
	}
	go l.run()
	return l
}

func (l *AsyncLogger) run() {
	for {
		select {
		case event := <-l.ch:
			b, err := protojson.Marshal(event)
			if err != nil {
				slog.Error("failed to marshal event", "error", err)
				continue
			}
			fmt.Fprintln(l.writer, string(b))
		case <-l.done:
			return
		}
	}
}

// Log sends an event to the buffer
func (l *AsyncLogger) Log(event *pb.DecisionEvent) error {
	select {
	case l.ch <- event:
		return nil
	default:
		slog.Warn("event buffer full, dropping event")
		return fmt.Errorf("buffer full")
	}
}

// Close stops the logger
func (l *AsyncLogger) Close() {
	close(l.done)
}
