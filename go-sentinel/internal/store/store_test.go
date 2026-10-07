package store

import (
	"sort"
	"sync"
	"testing"

	"sentinel/internal/model"
	eventspb "sentinel/proto/sentinel/v1/events"
)

// stubModel is a minimal model.Model implementation for identity checks.
type stubModel struct{ id string }

func (stubModel) Score(map[string]*eventspb.FeatureValue) (string, float64, []*eventspb.ActionProbability, error) {
	return "noop", 0, nil, nil
}

func TestNewStoreIsEmpty(t *testing.T) {
	s := NewStore()
	if s == nil {
		t.Fatal("NewStore returned nil")
	}
	if got := s.ListTenants(); len(got) != 0 {
		t.Errorf("ListTenants = %v, want empty", got)
	}
}

func TestGetModelUnknownTenant(t *testing.T) {
	s := NewStore()
	if m := s.GetModel("missing"); m != nil {
		t.Errorf("GetModel(missing) = %v, want nil", m)
	}
}

func TestUpdateAndGetModel(t *testing.T) {
	s := NewStore()
	m := &stubModel{id: "first"}
	s.UpdateModel("tenant-1", m)

	got := s.GetModel("tenant-1")
	if got != model.Model(m) {
		t.Errorf("GetModel returned a different instance than was stored")
	}
}

func TestUpdateModelOverwrites(t *testing.T) {
	s := NewStore()
	first := &stubModel{id: "first"}
	second := &stubModel{id: "second"}
	s.UpdateModel("tenant-1", first)
	s.UpdateModel("tenant-1", second)

	if got := s.GetModel("tenant-1"); got != model.Model(second) {
		t.Errorf("GetModel returned the stale model after an overwrite")
	}
	if got := s.ListTenants(); len(got) != 1 {
		t.Errorf("ListTenants = %v, want a single tenant", got)
	}
}

func TestListTenants(t *testing.T) {
	s := NewStore()
	s.UpdateModel("a", &stubModel{})
	s.UpdateModel("b", &stubModel{})
	s.UpdateModel("c", &stubModel{})

	got := s.ListTenants()
	sort.Strings(got)
	want := []string{"a", "b", "c"}
	if len(got) != len(want) {
		t.Fatalf("ListTenants = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("ListTenants[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

// Concurrent readers and writers must not race; run with -race.
func TestStoreConcurrentAccess(t *testing.T) {
	s := NewStore()
	var wg sync.WaitGroup
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			s.UpdateModel("tenant", &stubModel{})
			_ = s.GetModel("tenant")
			_ = s.ListTenants()
		}()
	}
	wg.Wait()
}
