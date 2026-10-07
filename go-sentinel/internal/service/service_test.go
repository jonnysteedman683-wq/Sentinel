package service

import (
	"context"
	"io"
	"testing"

	"sentinel/internal/logging"
	"sentinel/internal/store"
	pb "sentinel/proto/sentinel/v1"
	eventspb "sentinel/proto/sentinel/v1/events"
)

// stubModel returns a fixed decision so the service path can be asserted
// without depending on Thompson-sampling randomness.
type stubModel struct {
	action     string
	propensity float64
}

func (s stubModel) Score(map[string]*eventspb.FeatureValue) (string, float64, []*eventspb.ActionProbability, error) {
	return s.action, s.propensity, []*eventspb.ActionProbability{{Action: s.action, Probability: s.propensity}}, nil
}

func newService(t *testing.T, s *store.Store, policyID string) *DecisionService {
	t.Helper()
	lg := logging.NewAsyncLogger(io.Discard, 16)
	t.Cleanup(lg.Close)
	return NewDecisionService(s, lg, policyID)
}

func TestGetActionFallsBackToDefaultModel(t *testing.T) {
	svc := newService(t, store.NewStore(), "policy-x")

	resp, err := svc.GetAction(context.Background(), &pb.GetActionRequest{TenantId: "unknown"})
	if err != nil {
		t.Fatalf("GetAction returned error: %v", err)
	}
	if resp.Action != "default" {
		t.Errorf("Action = %q, want %q", resp.Action, "default")
	}
	if resp.Propensity != 1.0 {
		t.Errorf("Propensity = %v, want 1", resp.Propensity)
	}
	if resp.TenantId != "unknown" {
		t.Errorf("TenantId = %q, want %q", resp.TenantId, "unknown")
	}
	if resp.PolicyId != "policy-x" {
		t.Errorf("PolicyId = %q, want %q", resp.PolicyId, "policy-x")
	}
	if resp.DecisionId == "" {
		t.Error("DecisionId is empty, want a generated id")
	}
}

func TestGetActionUsesStoredModel(t *testing.T) {
	s := store.NewStore()
	s.UpdateModel("tenant-2", stubModel{action: "buy", propensity: 0.75})
	svc := newService(t, s, "policy-x")

	resp, err := svc.GetAction(context.Background(), &pb.GetActionRequest{TenantId: "tenant-2"})
	if err != nil {
		t.Fatalf("GetAction returned error: %v", err)
	}
	if resp.Action != "buy" {
		t.Errorf("Action = %q, want %q", resp.Action, "buy")
	}
	if resp.Propensity != 0.75 {
		t.Errorf("Propensity = %v, want 0.75", resp.Propensity)
	}
}

func TestGetActionGeneratesUniqueDecisionIds(t *testing.T) {
	svc := newService(t, store.NewStore(), "policy-x")

	resp1, err1 := svc.GetAction(context.Background(), &pb.GetActionRequest{TenantId: "t"})
	resp2, err2 := svc.GetAction(context.Background(), &pb.GetActionRequest{TenantId: "t"})
	if err1 != nil || err2 != nil {
		t.Fatalf("GetAction returned errors: %v, %v", err1, err2)
	}
	if resp1.DecisionId == resp2.DecisionId {
		t.Errorf("decision ids should be unique, both were %q", resp1.DecisionId)
	}
}
