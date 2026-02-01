"""
Common material utilities for procedural asset generation.

These create simple, game-friendly materials that export well to GLB.
"""

import bpy


def create_solid_material(name: str, color: tuple, roughness: float = 1.0) -> bpy.types.Material:
    """
    Create a simple solid-color material.

    Args:
        name: Material name
        color: RGB or RGBA tuple (0-1 range)
        roughness: Surface roughness (0=shiny, 1=matte)

    Returns:
        The created material.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes

    principled = nodes.get("Principled BSDF")
    if principled:
        # Handle RGB vs RGBA
        if len(color) == 3:
            principled.inputs['Base Color'].default_value = (*color, 1.0)
        else:
            principled.inputs['Base Color'].default_value = color

        principled.inputs['Roughness'].default_value = roughness
        principled.inputs['Metallic'].default_value = 0.0

    return mat


def create_vertex_color_material(name: str, roughness: float = 1.0) -> bpy.types.Material:
    """
    Create a material that uses vertex colors.

    Useful for assets where you paint colors directly on vertices.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Clear existing nodes
    for node in nodes:
        nodes.remove(node)

    # Create nodes
    output = nodes.new('ShaderNodeOutputMaterial')
    principled = nodes.new('ShaderNodeBsdfPrincipled')
    vertex_color = nodes.new('ShaderNodeVertexColor')

    # Position nodes
    output.location = (300, 0)
    principled.location = (0, 0)
    vertex_color.location = (-300, 0)

    # Connect
    links.new(vertex_color.outputs['Color'], principled.inputs['Base Color'])
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    principled.inputs['Roughness'].default_value = roughness
    principled.inputs['Metallic'].default_value = 0.0

    return mat


# Common color palettes for the game
COLORS = {
    # Vegetation
    "grass_healthy": (0.3, 0.6, 0.2),
    "grass_dry": (0.6, 0.5, 0.2),
    "tree_bark_light": (0.4, 0.3, 0.2),
    "tree_bark_dark": (0.25, 0.18, 0.12),
    "leaves_green": (0.2, 0.5, 0.15),
    "leaves_light": (0.35, 0.6, 0.25),
    "pine_needles": (0.15, 0.35, 0.15),

    # Character/clothing
    "skin_light": (0.9, 0.75, 0.65),
    "skin_medium": (0.7, 0.55, 0.45),
    "shirt_green": (0.2, 0.4, 0.2),
    "shirt_polo": (0.9, 0.9, 0.85),
    "pants_khaki": (0.6, 0.55, 0.4),
    "pants_dark": (0.2, 0.2, 0.25),
    "shoes_brown": (0.35, 0.25, 0.15),

    # Equipment
    "metal_painted_green": (0.15, 0.35, 0.15),
    "metal_painted_red": (0.6, 0.15, 0.1),
    "metal_silver": (0.7, 0.7, 0.72),
    "rubber_black": (0.1, 0.1, 0.1),
    "plastic_yellow": (0.9, 0.75, 0.1),

    # Course features
    "bunker_sand": (0.85, 0.75, 0.5),
    "water_blue": (0.2, 0.4, 0.65),
    "cart_path": (0.5, 0.5, 0.5),
    "wood_light": (0.65, 0.5, 0.35),

    # Buildings
    "brick_red": (0.5, 0.25, 0.2),
    "roof_shingle": (0.3, 0.25, 0.22),
    "window_glass": (0.6, 0.75, 0.85),
}


def get_color(name: str) -> tuple:
    """Get a predefined color by name."""
    return COLORS.get(name, (0.5, 0.5, 0.5))
