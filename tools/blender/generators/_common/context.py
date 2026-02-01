"""
Asset generation context setup and export utilities.

Provides a standardized workflow:
1. setup_asset_context() - Clears scene, sets up collections
2. Generate your asset geometry
3. export_asset() - Validates and exports to GLB
"""

import bpy
import os
import sys

# Add parent tools directory for imports
GENERATORS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.dirname(GENERATORS_DIR)
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

from asset_specs import get_spec, validate_dimensions


def setup_asset_context(asset_id: str):
    """
    Set up a clean context for generating an asset.

    Returns a context dict with asset_id and output_path info.
    """
    # Clear scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    # Remove orphan data
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)

    # Set up scene units
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = 'METERS'

    # Create asset collection
    if "Asset" not in bpy.data.collections:
        asset_collection = bpy.data.collections.new("Asset")
        bpy.context.scene.collection.children.link(asset_collection)

    # Get spec info
    spec = get_spec(asset_id)

    # Calculate output path (public/assets/models/category/name.glb)
    parts = asset_id.split(".")
    category = parts[0]
    name = "_".join(parts[1:]) if len(parts) > 1 else parts[0]

    # Output to project's public/assets/models/
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(TOOLS_DIR)))
    output_dir = os.path.join(project_root, "public", "assets", "models", category)
    output_path = os.path.join(output_dir, f"{name}.glb")

    return {
        "asset_id": asset_id,
        "spec": spec,
        "output_path": output_path,
        "output_dir": output_dir,
    }


def calculate_bounds(obj):
    """Calculate world-space bounding box of an object."""
    if obj.type != 'MESH':
        return None

    import mathutils
    bbox = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]

    min_co = [min(v[i] for v in bbox) for i in range(3)]
    max_co = [max(v[i] for v in bbox) for i in range(3)]

    return {
        "min": min_co,
        "max": max_co,
        "width": max_co[0] - min_co[0],   # X
        "depth": max_co[1] - min_co[1],   # Y
        "height": max_co[2] - min_co[2],  # Z (up in Blender)
    }


def validate_asset(context: dict, root_object) -> list[str]:
    """
    Validate the generated asset against specs.
    Returns list of error messages (empty if valid).
    """
    spec = context.get("spec")
    if not spec:
        return [f"Unknown asset ID: {context['asset_id']}"]

    bounds = calculate_bounds(root_object)
    if not bounds:
        return ["No mesh object found"]

    return validate_dimensions(
        context["asset_id"],
        bounds["height"],
        bounds["width"],
        bounds["depth"]
    )


def export_asset(context: dict, validate: bool = True, force: bool = False) -> bool:
    """
    Export the generated asset to GLB.

    Args:
        context: Context dict from setup_asset_context()
        validate: Whether to validate dimensions (default True)
        force: Export even if validation fails (default False)

    Returns:
        True if export succeeded, False otherwise.
    """
    # Get all mesh objects
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == 'MESH']

    if not mesh_objects:
        print("ERROR: No mesh objects to export")
        return False

    # Validate
    if validate:
        errors = []
        for obj in mesh_objects:
            errors.extend(validate_asset(context, obj))

        if errors:
            print(f"\nValidation errors for {context['asset_id']}:")
            for err in errors:
                print(f"  - {err}")

            if not force:
                print("\nUse force=True to export anyway")
                return False
            print("\nForcing export despite errors...")

    # Ensure output directory exists
    os.makedirs(context["output_dir"], exist_ok=True)

    # Select all mesh objects
    bpy.ops.object.select_all(action='DESELECT')
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]

    # Export
    print(f"\nExporting to: {context['output_path']}")

    bpy.ops.export_scene.gltf(
        filepath=context["output_path"],
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_normals=True,
        export_colors=True,
        export_materials='EXPORT',
    )

    print(f"Export complete: {context['output_path']}")
    return True
