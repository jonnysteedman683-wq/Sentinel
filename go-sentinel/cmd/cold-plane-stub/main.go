package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

func runBulkTraining(tenantID string, startTime, endTime time.Time) {
	fmt.Printf("[Visualization] Starting bulk training for tenant %s. Window: %v to %v\n", tenantID, startTime, endTime)

	file, err := os.Open("events.jsonl")
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Println("events.jsonl not found, skipping training")
			return
		}
		fmt.Printf("Error opening events.jsonl: %v\n", err)
		return
	}
	defer file.Close()

	reader := bufio.NewReader(file)
	actionCounts := make(map[string]int)

	for {
		line, err := reader.ReadString('\n')
		if err != nil && err != io.EOF {
			fmt.Printf("Error reading events.jsonl: %v\n", err)
			continue
		}
		if line == "" && err == io.EOF {
			break
		}

		var event struct {
			TenantID  string    `json:"tenantId"`
			Action    string    `json:"action"`
			Timestamp time.Time `json:"timestamp"`
		}

		if err := json.Unmarshal([]byte(line), &event); err != nil {
			continue // Skip malformed lines
		}

		// Filter
		if event.TenantID != tenantID {
			continue
		}
		if event.Timestamp.Before(startTime) || event.Timestamp.After(endTime) {
			continue
		}

		// Count
		actionCounts[event.Action]++
	}

	// Recalculate posterior distributions (Mocked logic: Alpha = 1 + count, Beta = 1)
	var arms []string
	var alphas []float64
	var betas []float64

	// Ensure we have some default if no events
	if len(actionCounts) == 0 {
		arms = append(arms, "default")
		alphas = append(alphas, 1.0)
		betas = append(betas, 1.0)
	} else {
		for action, count := range actionCounts {
			arms = append(arms, action)
			alphas = append(alphas, 1.0+float64(count))
			betas = append(betas, 1.0) // Assume a simple Beta(1,1) prior and count=success
		}
	}

	// Prepare request
	reqBody := struct {
		Arms   []string  `json:"arms"`
		Alphas []float64 `json:"alphas"`
		Betas  []float64 `json:"betas"`
	}{
		Arms:   arms,
		Alphas: alphas,
		Betas:  betas,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		fmt.Printf("Error marshaling request: %v\n", err)
		return
	}

	// Push updates
	url := fmt.Sprintf("http://localhost:8080/tenants/%s/model", tenantID)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("Error pushing model update: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Unexpected status code from decision service: %d\n", resp.StatusCode)
		return
	}

	// Visualization
	viz := fmt.Sprintf("[Visualization] Processed %d events for tenant %s. Posterior updated:", len(actionCounts), tenantID)
	for i := range arms {
		viz += fmt.Sprintf(" %s [Alpha: %.1f, Beta: %.1f]", arms[i], alphas[i], betas[i])
		if i < len(arms)-1 {
			viz += ","
		}
	}
	fmt.Println(viz)
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
