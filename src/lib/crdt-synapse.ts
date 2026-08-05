// FILE: src/lib/crdt-synapse.ts — [CRDT for distributed synaptic weight federation]

export interface SynapticPayload {
  source: string;
  target: string;
  weightAdds: Record<string, number>;
  weightSubs: Record<string, number>;
  lastCoaccess: number;
}

export class CRDTSynapse {
  private state: Map<string, SynapticPayload> = new Map();
  private clientId: string;

  constructor(clientId: string, initialState?: SynapticPayload[]) {
    this.clientId = clientId;
    if (initialState) {
      initialState.forEach(payload => {
        // Deep copy to prevent reference mutation
        this.state.set(this.edgeId(payload.source, payload.target), JSON.parse(JSON.stringify(payload)));
      });
    }
  }

  public edgeId(source: string, target: string): string {
    // Undirected edge ID
    return [source, target].sort().join(':');
  }

  public getWeight(source: string, target: string): number {
    const edge = this.state.get(this.edgeId(source, target));
    if (!edge) return 0;
    
    let w = 0;
    for (const val of Object.values(edge.weightAdds)) w += val;
    for (const val of Object.values(edge.weightSubs)) w -= val;
    // Numerical stability floor
    return Math.max(0, w + 1e-9) - 1e-9;
  }

  public getLastCoaccess(source: string, target: string): number {
    const edge = this.state.get(this.edgeId(source, target));
    return edge ? edge.lastCoaccess : 0;
  }

  public updateWeight(source: string, target: string, delta: number, timestamp: number = Date.now()) {
    const id = this.edgeId(source, target);
    let edge = this.state.get(id);
    if (!edge) {
      edge = {
        source,
        target,
        weightAdds: {},
        weightSubs: {},
        lastCoaccess: timestamp
      };
      this.state.set(id, edge);
    }

    if (delta > 0) {
      edge.weightAdds[this.clientId] = (edge.weightAdds[this.clientId] || 0) + delta;
    } else {
      edge.weightSubs[this.clientId] = (edge.weightSubs[this.clientId] || 0) + Math.abs(delta);
    }
    
    edge.lastCoaccess = Math.max(edge.lastCoaccess, timestamp);
  }

  public merge(remotePayloads: SynapticPayload[]) {
    remotePayloads.forEach(remote => {
      const id = this.edgeId(remote.source, remote.target);
      const local = this.state.get(id);
      if (!local) {
        this.state.set(id, JSON.parse(JSON.stringify(remote)));
      } else {
        // Merge weightAdds using max (monotonic)
        for (const [client, val] of Object.entries(remote.weightAdds)) {
          local.weightAdds[client] = Math.max(local.weightAdds[client] || 0, val);
        }
        // Merge weightSubs using max (monotonic)
        for (const [client, val] of Object.entries(remote.weightSubs)) {
          local.weightSubs[client] = Math.max(local.weightSubs[client] || 0, val);
        }
        // Merge lastCoaccess using LWW max
        local.lastCoaccess = Math.max(local.lastCoaccess, remote.lastCoaccess);
      }
    });
  }

  public exportState(): SynapticPayload[] {
    return Array.from(this.state.values()).map(p => JSON.parse(JSON.stringify(p)));
  }
}
