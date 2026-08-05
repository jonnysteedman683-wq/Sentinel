package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

func runBulkTraining(tenantID string, startTime, endTime time.Time) {
	fmt.Printf("[Visualization] Starting bulk training for tenant %s. Window: %v to %v\n", tenantID, startTime, endTime)

	// TODO: Implement training logic:
	// 1. Read events.jsonl
	// 2. Filter by TenantID and time range
	// 3. Recalculate posterior distributions
	// 4. Push updates to decision-service via POST /tenants/{tenant_id}/model

	// Mock visualization of progress
	fmt.Printf("[Visualization] Processed 1000 events. Posterior updated for tenant %s: Arm A [Alpha: 12.5, Beta: 2.1], Arm B [Alpha: 8.2, Beta: 4.5]\n", tenantID)
}

func handleTriggerTraining(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		TenantID string `json:"tenant_id"`
		StartTime time.Time `json:"start_time"`
		EndTime   time.Time `json:"end_time"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	runBulkTraining(req.TenantID, req.StartTime, req.EndTime)

	w.WriteHeader(http.StatusAccepted)
	fmt.Fprintf(w, "Training triggered for %s", req.TenantID)
}

func main() {
	// Start event processing
	go func() {
		file, _ := os.Open("events.jsonl")
		reader := bufio.NewReader(file)
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				time.Sleep(1 * time.Second)
				continue
			}

			var event map[string]interface{}
			json.Unmarshal([]byte(line), &event)

			// Simulate reward
			go func(e map[string]interface{}) {
				time.Sleep(1 * time.Second)
				// fmt.Println("Processed decision, rewarding...") // Reduced noise
			}(event)
		}
	}()

	// Start recurring training timer
	go func() {
		ticker := time.NewTicker(4 * time.Hour)
		for range ticker.C {
			fmt.Println("[Visualization] Timer triggered: Running scheduled bulk training...")
			runBulkTraining("default", time.Now().Add(-4*time.Hour), time.Now())
		}
	}()

	// Start HTTP server for training trigger
	http.HandleFunc("/trigger-training", handleTriggerTraining)
	fmt.Println("Cold plane stub listening on :8081 for training triggers...")
	http.ListenAndServe(":8081", nil)
}
