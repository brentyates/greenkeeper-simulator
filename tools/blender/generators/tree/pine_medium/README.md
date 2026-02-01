# tree.pine.medium

Medium-sized pine tree for golf course decoration.

## Specs

- **Height**: 4.5-6.5m
- **Footprint**: 3x3m
- **Polygon target**: 100-400

## Generation

```bash
blender --background --python tools/blender/generators/tree/pine_medium/generate.py
```

## Parameters

Edit `generate.py` to tune:

| Parameter | Default | Description |
|-----------|---------|-------------|
| total_height | 5.5 | Tree height in meters |
| trunk_ratio | 0.25 | Proportion of height that is trunk |
| base_radius | 1.5 | Width of foliage at widest point |
| seed | 42 | Random seed for variation |

## Customization

To create variations:
1. Copy this folder
2. Adjust parameters
3. Change the seed for different random variation
