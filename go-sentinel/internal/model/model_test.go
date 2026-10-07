package model

import (
	"math"
	"testing"
)

func TestNewBetaBanditModel(t *testing.T) {
	m := NewBetaBanditModel([]string{"a"}, []float64{1}, []float64{1})
	if m == nil {
		t.Fatal("NewBetaBanditModel returned nil")
	}
}

func TestScoreSingleArm(t *testing.T) {
	m := NewBetaBanditModel([]string{"only"}, []float64{2}, []float64{3})

	action, propensity, probs, err := m.Score(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if action != "only" {
		t.Errorf("action = %q, want %q", action, "only")
	}
	if len(probs) != 1 {
		t.Fatalf("len(probs) = %d, want 1", len(probs))
	}
	// A single arm is always the best, so it wins every Monte Carlo trial.
	if probs[0].Action != "only" || probs[0].Probability != 1.0 {
		t.Errorf("probs[0] = %+v, want {only 1}", probs[0])
	}
	if propensity != 1.0 {
		t.Errorf("propensity = %v, want 1", propensity)
	}
}

func TestScoreProbabilitiesFormValidDistribution(t *testing.T) {
	arms := []string{"a", "b", "c"}
	m := NewBetaBanditModel(arms, []float64{2, 2, 2}, []float64{2, 2, 2})

	action, propensity, probs, err := m.Score(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(probs) != len(arms) {
		t.Fatalf("len(probs) = %d, want %d", len(probs), len(arms))
	}

	sum := 0.0
	var chosenProb float64
	actionIsAnArm := false
	for _, p := range probs {
		if p.Probability < 0 || p.Probability > 1 {
			t.Errorf("probability for %q out of range: %v", p.Action, p.Probability)
		}
		sum += p.Probability
		if p.Action == action {
			chosenProb = p.Probability
			actionIsAnArm = true
		}
	}
	if !actionIsAnArm {
		t.Errorf("chosen action %q is not among the arms", action)
	}
	if math.Abs(sum-1.0) > 1e-9 {
		t.Errorf("probabilities sum to %v, want 1", sum)
	}
	// The returned propensity is the chosen arm's probability.
	if propensity != chosenProb {
		t.Errorf("propensity = %v, want chosen arm probability %v", propensity, chosenProb)
	}
}

func TestScoreFavoursDominantArm(t *testing.T) {
	// "strong" has an overwhelmingly higher Beta mean than "weak", so Thompson
	// sampling should pick it essentially every time.
	arms := []string{"strong", "weak"}
	m := NewBetaBanditModel(arms, []float64{100, 1}, []float64{1, 100})

	action, propensity, _, err := m.Score(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if action != "strong" {
		t.Errorf("action = %q, want %q", action, "strong")
	}
	if propensity < 0.9 {
		t.Errorf("propensity = %v, want >= 0.9 for the dominant arm", propensity)
	}
}

// Exercises the sync.Pool-backed RNG under concurrency; run with -race.
func TestScoreConcurrent(t *testing.T) {
	m := NewBetaBanditModel([]string{"a", "b"}, []float64{2, 5}, []float64{5, 2})
	done := make(chan struct{})
	for i := 0; i < 8; i++ {
		go func() {
			defer func() { done <- struct{}{} }()
			for j := 0; j < 50; j++ {
				if _, _, _, err := m.Score(nil); err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		}()
	}
	for i := 0; i < 8; i++ {
		<-done
	}
}
