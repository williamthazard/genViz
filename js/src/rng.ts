// Seeded PRNG with a numpy-style surface. Mulberry32 core — fast, small,
// good enough for procedural art (not cryptographic).

export class Rng {
  private state: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  random(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(lo: number, hi: number): number {
    return lo + (hi - lo) * this.random();
  }

  integers(lo: number, hi: number): number {
    return lo + Math.floor(this.random() * (hi - lo));
  }

  normal(mean = 0, std = 1): number {
    if (this.spare !== null) {
      const s = this.spare;
      this.spare = null;
      return mean + std * s;
    }
    const u1 = Math.max(this.random(), 1e-12);
    const u2 = this.random();
    const mag = Math.sqrt(-2 * Math.log(u1));
    const z0 = mag * Math.cos(2 * Math.PI * u2);
    const z1 = mag * Math.sin(2 * Math.PI * u2);
    this.spare = z1;
    return mean + std * z0;
  }

  // Jöhnk's algorithm for Beta(a, b).
  beta(a: number, b: number): number {
    while (true) {
      const u = Math.pow(this.random(), 1 / a);
      const v = Math.pow(this.random(), 1 / b);
      const s = u + v;
      if (s > 0 && s <= 1) return u / s;
    }
  }

  choice<T>(arr: readonly T[], weights?: readonly number[]): T {
    if (!weights) return arr[this.integers(0, arr.length)];
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.random() * total;
    for (let i = 0; i < arr.length; i++) {
      r -= weights[i];
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  }
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
