use std::collections::BinaryHeap;
use std::cmp::Ordering;

const SQRT2: f32 = std::f32::consts::SQRT_2;

#[derive(Clone)]
struct Node {
    x: u32,
    z: u32,
    f: f32,
}

impl PartialEq for Node {
    fn eq(&self, other: &Self) -> bool {
        self.f == other.f
    }
}
impl Eq for Node {}

impl PartialOrd for Node {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Node {
    fn cmp(&self, other: &Self) -> Ordering {
        other.f.partial_cmp(&self.f).unwrap_or(Ordering::Equal)
    }
}

fn heuristic(x: u32, z: u32, gx: u32, gz: u32) -> f32 {
    let dx = (x as f32 - gx as f32).abs();
    let dz = (z as f32 - gz as f32).abs();
    dx.max(dz) + (SQRT2 - 1.0) * dx.min(dz)
}

fn idx(x: u32, z: u32, width: u32) -> usize {
    (z * width + x) as usize
}

const NEIGHBORS: [(i32, i32, bool); 8] = [
    (1, 0, false),
    (-1, 0, false),
    (0, 1, false),
    (0, -1, false),
    (1, 1, true),
    (1, -1, true),
    (-1, 1, true),
    (-1, -1, true),
];

pub fn astar_grid(
    grid: &[u8],
    width: u32,
    height: u32,
    sx: u32,
    sz: u32,
    gx: u32,
    gz: u32,
    max_nodes: u32,
) -> Option<Vec<(u32, u32)>> {
    if sx == gx && sz == gz {
        return Some(vec![(gx, gz)]);
    }

    let size = (width * height) as usize;
    let mut g_cost = vec![f32::INFINITY; size];
    let mut parent = vec![u32::MAX; size];
    let mut closed = vec![false; size];

    let start_idx = idx(sx, sz, width);
    g_cost[start_idx] = 0.0;

    let mut open = BinaryHeap::new();
    open.push(Node {
        x: sx,
        z: sz,
        f: heuristic(sx, sz, gx, gz),
    });

    let mut expanded: u32 = 0;

    while let Some(current) = open.pop() {
        let ci = idx(current.x, current.z, width);

        if current.x == gx && current.z == gz {
            let mut path = Vec::new();
            let mut trace = ci;
            while trace != start_idx {
                let tz = trace as u32 / width;
                let tx = trace as u32 % width;
                path.push((tx, tz));
                trace = parent[trace] as usize;
            }
            path.reverse();
            return Some(path);
        }

        if closed[ci] {
            continue;
        }
        closed[ci] = true;

        expanded += 1;
        if expanded > max_nodes {
            return None;
        }

        let current_g = g_cost[ci];

        for &(dx, dz, is_diagonal) in &NEIGHBORS {
            let nx = current.x as i32 + dx;
            let nz = current.z as i32 + dz;

            if nx < 0 || nz < 0 || nx >= width as i32 || nz >= height as i32 {
                continue;
            }

            let nx = nx as u32;
            let nz = nz as u32;
            let ni = idx(nx, nz, width);

            if closed[ni] {
                continue;
            }
            if grid[ni] == 0 {
                continue;
            }

            if is_diagonal {
                let perp1 = idx((current.x as i32 + dx) as u32, current.z, width);
                let perp2 = idx(current.x, (current.z as i32 + dz) as u32, width);
                if grid[perp1] == 0 || grid[perp2] == 0 {
                    continue;
                }
            }

            let cost = if is_diagonal { SQRT2 } else { 1.0 };
            let tentative_g = current_g + cost;

            if tentative_g < g_cost[ni] {
                g_cost[ni] = tentative_g;
                parent[ni] = ci as u32;
                let f = tentative_g + heuristic(nx, nz, gx, gz);
                open.push(Node { x: nx, z: nz, f });
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_grid(width: u32, height: u32, blocked: &[(u32, u32)]) -> Vec<u8> {
        let mut grid = vec![1u8; (width * height) as usize];
        for &(x, z) in blocked {
            grid[idx(x, z, width)] = 0;
        }
        grid
    }

    #[test]
    fn open_grid_straight_path() {
        let grid = make_grid(10, 10, &[]);
        let path = astar_grid(&grid, 10, 10, 0, 0, 5, 0, 10000).unwrap();
        assert_eq!(*path.last().unwrap(), (5, 0));
        assert!(!path.is_empty());
    }

    #[test]
    fn start_equals_goal() {
        let grid = make_grid(5, 5, &[]);
        let path = astar_grid(&grid, 5, 5, 2, 2, 2, 2, 10000).unwrap();
        assert_eq!(path, vec![(2, 2)]);
    }

    #[test]
    fn fully_blocked() {
        let grid = vec![0u8; 25];
        let result = astar_grid(&grid, 5, 5, 0, 0, 4, 4, 10000);
        assert!(result.is_none());
    }

    #[test]
    fn wall_with_gap() {
        let mut blocked = Vec::new();
        for z in 0..10 {
            if z != 5 {
                blocked.push((5, z));
            }
        }
        let grid = make_grid(10, 10, &blocked);
        let path = astar_grid(&grid, 10, 10, 0, 5, 9, 5, 10000).unwrap();
        assert_eq!(*path.last().unwrap(), (9, 5));
        assert!(path.iter().all(|&(x, z)| grid[idx(x, z, 10)] == 1));
    }

    #[test]
    fn diagonal_cutoff() {
        let blocked = vec![(1, 0)];
        let grid = make_grid(3, 3, &blocked);
        let path = astar_grid(&grid, 3, 3, 0, 0, 1, 1, 10000).unwrap();
        assert!(path.iter().all(|&(x, z)| grid[idx(x, z, 3)] == 1));
        assert!(!path.contains(&(1, 0)));
    }

    #[test]
    fn max_node_limit() {
        let mut blocked = Vec::new();
        for z in 0..100 {
            if z != 50 {
                blocked.push((50, z));
            }
        }
        let grid = make_grid(100, 100, &blocked);
        let result = astar_grid(&grid, 100, 100, 0, 0, 99, 99, 10);
        assert!(result.is_none());
    }

    #[test]
    fn large_grid() {
        let grid = make_grid(200, 200, &[]);
        let path = astar_grid(&grid, 200, 200, 0, 0, 199, 199, 100_000).unwrap();
        assert_eq!(*path.last().unwrap(), (199, 199));
    }

    #[test]
    fn path_avoids_blocked_diagonal() {
        let blocked = vec![(1, 0), (0, 1)];
        let grid = make_grid(3, 3, &blocked);
        let result = astar_grid(&grid, 3, 3, 0, 0, 2, 2, 10000);
        assert!(result.is_none());
    }
}
