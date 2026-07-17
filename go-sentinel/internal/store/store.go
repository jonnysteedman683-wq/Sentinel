package store

import (
	"sync"
	"sync/atomic"

	"sentinel/internal/model"
)

// Store manages tenant model state
type Store struct {
	mu     sync.RWMutex
	models map[string]*atomic.Value
}

// NewStore initializes a new Store
func NewStore() *Store {
	return &Store{
		models: make(map[string]*atomic.Value),
	}
}

// GetModel loads the model for a tenant
func (s *Store) GetModel(tenantID string) model.Model {
	s.mu.RLock()
	atomicVal, exists := s.models[tenantID]
	s.mu.RUnlock()

	if !exists {
		return nil // Caller handles fallback
	}
	return atomicVal.Load().(model.Model)
}

// UpdateModel updates the model for a tenant
func (s *Store) UpdateModel(tenantID string, m model.Model) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.models[tenantID]; !exists {
		s.models[tenantID] = &atomic.Value{}
	}
	s.models[tenantID].Store(m)
}

// ListTenants returns all tenant IDs
func (s *Store) ListTenants() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	tenants := make([]string, 0, len(s.models))
	for k := range s.models {
		tenants = append(tenants, k)
	}
	return tenants
}
