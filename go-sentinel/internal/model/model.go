package model

import (
	"math/rand"
	"sync"
	"time"

	"gonum.org/v1/gonum/stat/distuv"
	eventspb "sentinel/proto/sentinel/v1/events"
)

// Model interface
type Model interface {
	Score(context map[string]*eventspb.FeatureValue) (action string, propensity float64, actionProbs []*eventspb.ActionProbability, err error)
}

// BetaBanditModel holds arms and Beta parameters
type BetaBanditModel struct {
	arms   []string
	alphas []float64
	betas  []float64
	rngPool *sync.Pool
}

// NewBetaBanditModel constructs an immutable BetaBanditModel
func NewBetaBanditModel(arms []string, alphas, betas []float64) *BetaBanditModel {
	return &BetaBanditModel{
		arms:   arms,
		alphas: alphas,
		betas:  betas,
		rngPool: &sync.Pool{
			New: func() interface{} {
				return rand.New(rand.NewSource(time.Now().UnixNano()))
			},
		},
	}
}

// Score uses Thompson sampling to choose an arm
func (m *BetaBanditModel) Score(context map[string]*eventspb.FeatureValue) (action string, propensity float64, actionProbs []*eventspb.ActionProbability, err error) {
	rng := m.rngPool.Get().(*rand.Rand)
	defer m.rngPool.Put(rng)

	samples := make([]float64, len(m.arms))
	maxSample := -1.0
	bestArmIdx := 0

	// 1. Thompson Sampling
	for i := range m.arms {
		dist := distuv.Beta{Alpha: m.alphas[i], Beta: m.betas[i], Src: rng}
		samples[i] = dist.Rand()
		if samples[i] > maxSample {
			maxSample = samples[i]
			bestArmIdx = i
		}
	}

	// 2. Propensity (Monte Carlo approximation)
	// For simplicity, we'll implement a basic one: frequency of choosing best arm in N trials
	const N = 1000
	counts := make([]int, len(m.arms))
	for j := 0; j < N; j++ {
		bestInTrial := 0
		maxInTrial := -1.0
		for i := range m.arms {
			dist := distuv.Beta{Alpha: m.alphas[i], Beta: m.betas[i], Src: rng}
			sample := dist.Rand()
			if sample > maxInTrial {
				maxInTrial = sample
				bestInTrial = i
			}
		}
		counts[bestInTrial]++
	}

	actionProbs = make([]*eventspb.ActionProbability, len(m.arms))
	for i := range m.arms {
		prob := float64(counts[i]) / float64(N)
		actionProbs[i] = &eventspb.ActionProbability{
			Action:      m.arms[i],
			Probability: prob,
		}
	}

	return m.arms[bestArmIdx], actionProbs[bestArmIdx].Probability, actionProbs, nil
}
