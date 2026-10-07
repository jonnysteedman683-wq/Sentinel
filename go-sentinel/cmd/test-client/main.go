package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	pb "sentinel/proto/sentinel/v1"
)

func main() {
	conn, _ := grpc.Dial("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	client := pb.NewDecisionServiceClient(conn)

	for i := 0; i < 1000; i++ {
		resp, err := client.GetAction(context.Background(), &pb.GetActionRequest{
			TenantId: "tenant-1",
		})
		if err != nil {
			log.Printf("err: %v", err)
			continue
		}
		fmt.Printf("Decision: %s\n", resp.Action)
		time.Sleep(10 * time.Millisecond)
	}
}
