package logging

import (
	"io"
	"strings"
	"testing"
	"time"

	eventspb "sentinel/proto/sentinel/v1/events"
)

// chanWriter forwards each Write to a channel so the async write can be
// observed deterministically from the test.
type chanWriter struct{ ch chan string }

func (w *chanWriter) Write(p []byte) (int, error) {
	w.ch <- string(p)
	return len(p), nil
}

func TestLogWritesMarshaledEvent(t *testing.T) {
	cw := &chanWriter{ch: make(chan string, 1)}
	l := NewAsyncLogger(cw, 4)
	defer l.Close()

	if err := l.Log(&eventspb.DecisionEvent{TenantId: "tenant-1", DecisionId: "dec-1", Action: "buy"}); err != nil {
		t.Fatalf("Log returned error: %v", err)
	}

	select {
	case out := <-cw.ch:
		for _, want := range []string{"tenant-1", "dec-1", "buy"} {
			if !strings.Contains(out, want) {
				t.Errorf("written event %q missing %q", out, want)
			}
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for the async write")
	}
}

func TestLogDropsWhenBufferFull(t *testing.T) {
	// Build the logger without starting run(), so nothing drains the channel.
	l := &AsyncLogger{
		ch:     make(chan *eventspb.DecisionEvent, 1),
		writer: io.Discard,
		done:   make(chan struct{}),
	}

	if err := l.Log(&eventspb.DecisionEvent{}); err != nil {
		t.Fatalf("first Log should succeed, got: %v", err)
	}
	if err := l.Log(&eventspb.DecisionEvent{}); err == nil {
		t.Error("expected an error when the buffer is full, got nil")
	}
}

func TestCloseStopsLogger(t *testing.T) {
	l := NewAsyncLogger(io.Discard, 1)
	l.Close() // must not panic and should let the run goroutine return
}
