proto-gen:
	protoc --go_out=. --go-grpc_out=. proto/sentinel/v1/*.proto

build:
	go build -o bin/decision-service cmd/decision-service/main.go

run-decision:
	go run cmd/decision-service/main.go

run-cold-plane:
	go run cmd/cold-plane-stub/main.go
