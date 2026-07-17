package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
	
	"sentinel/internal/logging"
	"sentinel/internal/model"
	"sentinel/internal/store"
	pb "sentinel/proto/sentinel/v1"
	"sentinel/proto/sentinel/v1/events"
)

// DecisionService implements the gRPC DecisionServiceServer
type DecisionService struct {
	pb.UnimplementedDecisionServiceServer
	store    *store.Store
	logger   *logging.AsyncLogger
	policyID string
}

func NewDecisionService(s *store.Store, l *logging.AsyncLogger, policyID string) *DecisionService {
	return &DecisionService{store: s, logger: l, policyID: policyID}
}

func (s *DecisionService) GetAction(ctx context.Context, req *pb.GetActionRequest) (*pb.GetActionResponse, error) {
	decisionID := uuid.New().String()
	
	// 1. Get Model
	m := s.store.GetModel(req.TenantId)
	if m == nil {
		// Fallback logic could be complex, for now assume uniform if nil
		// Simplified for Phase 1
		m = model.NewBetaBanditModel([]string{"default"}, []float64{1}, []float64{1})
	}

	// 2. Score
	action, propensity, actionProbs, _ := m.Score(req.Context)

	// 3. Log Event
	event := &events.DecisionEvent{
		TenantId:         req.TenantId,
		DecisionId:       decisionID,
		Timestamp:        timestamppb.New(time.Now()),
		ContextFeatures:  req.Context,
		Action:           action,
		Propensity:       propensity,
		ActionProbabilities: actionProbs,
		PolicyId:         s.policyID,
	}
	s.logger.Log(event)

	return &pb.GetActionResponse{
		DecisionId: decisionID,
		TenantId:   req.TenantId,
		Action:     action,
		Propensity: propensity,
		PolicyId:   s.policyID,
	}, nil
}
