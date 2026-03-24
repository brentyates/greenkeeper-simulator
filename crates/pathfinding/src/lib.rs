mod astar;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn find_path(
    grid: &[u8],
    grid_width: u32,
    grid_height: u32,
    grid_step: f32,
    origin_x: f32,
    origin_z: f32,
    start_x: f32,
    start_z: f32,
    goal_x: f32,
    goal_z: f32,
    max_nodes: u32,
) -> Option<Box<[f32]>> {
    let to_grid = |world: f32, origin: f32| -> u32 {
        ((world - origin) / grid_step).round().max(0.0) as u32
    };

    let sx = to_grid(start_x, origin_x).min(grid_width.saturating_sub(1));
    let sz = to_grid(start_z, origin_z).min(grid_height.saturating_sub(1));
    let gx = to_grid(goal_x, origin_x).min(grid_width.saturating_sub(1));
    let gz = to_grid(goal_z, origin_z).min(grid_height.saturating_sub(1));

    let path = astar::astar_grid(grid, grid_width, grid_height, sx, sz, gx, gz, max_nodes)?;

    let mut result = Vec::with_capacity(path.len() * 2);
    for (i, &(gx_i, gz_i)) in path.iter().enumerate() {
        if i == path.len() - 1 {
            result.push(goal_x);
            result.push(goal_z);
        } else {
            result.push(origin_x + gx_i as f32 * grid_step);
            result.push(origin_z + gz_i as f32 * grid_step);
        }
    }

    Some(result.into_boxed_slice())
}
