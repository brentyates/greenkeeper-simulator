//! A tiny, fully deterministic PRNG (SplitMix64).
//!
//! Hand-rolled so the engine has zero dependencies and identical output on every
//! platform. The RNG lives inside `World`, so a run is reproducible from its seed
//! and a save/replay is exact. (Can be swapped for `rand_chacha` later if needed;
//! determinism is the only contract that matters.)

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Rng {
    state: u64,
}

impl Rng {
    pub fn new(seed: u64) -> Self {
        Rng { state: seed }
    }

    pub fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// Uniform in [0.0, 1.0).
    pub fn next_f64(&mut self) -> f64 {
        // Top 53 bits → a double in [0,1).
        (self.next_u64() >> 11) as f64 / ((1u64 << 53) as f64)
    }

    /// Uniform in [lo, hi).
    pub fn range(&mut self, lo: f64, hi: f64) -> f64 {
        lo + (hi - lo) * self.next_f64()
    }
}
