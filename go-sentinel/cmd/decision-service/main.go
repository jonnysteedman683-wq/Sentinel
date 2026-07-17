package main

import (
	"encoding/json"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	
	"sentinel/internal/logging"
	"sentinel/internal/model"
	"sentinel/internal/service"
	"sentinel/internal/store"
	pb "sentinel/proto/sentinel/v1"
)

func main() {
	grpcPort := flag.String("grpcPort", ":50051", "gRPC port")
	httpPort := flag.String("httpPort", ":8080", "HTTP port for model updates")
	eventsFile := flag.String("eventsFile", "events.jsonl", "Events log file")
	flag.Parse()

	st := store.NewStore()
	
	f, _ := os.OpenFile(*eventsFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	logger := logging.NewAsyncLogger(f, 1000)
	defer logger.Close()

	// gRPC
	grpcServer := grpc.NewServer()
	decisionSvc := service.NewDecisionService(st, logger, "v1")
	pb.RegisterDecisionServiceServer(grpcServer, decisionSvc)

	go func() {
		lis, _ := net.Listen("tcp", *grpcPort)
		log.Fatal(grpcServer.Serve(lis))
	}()

	// HTTP Model Update Endpoint
	http.HandleFunc("/tenants/", func(w http.ResponseWriter, r *http.Request) {
		// Simplified route parsing: /tenants/{id}/model
		// Real implementation should use chi/mux
		tenantID := r.URL.Path[len("/tenants/") : len(r.URL.Path)-len("/model")]
		var req struct {
			Arms   []string  `json:"arms"`
			Alphas []float64 `json:"alphas"`
			Betas  []float64 `json:"betas"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		st.UpdateModel(tenantID, model.NewBetaBanditModel(req.Arms, req.Alphas, req.Betas))
		w.WriteHeader(http.StatusOK)
	})

	go log.Fatal(http.ListenAndServe(*httpPort, nil))

	// Shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)
	<-sigChan
	log.Println("Shutting down")
}
