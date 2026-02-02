"""
Blender GLB Export Script for Greenkeeper Simulator

Run from Blender's Text Editor or command line:
  blender model.blend --background --python export_glb.py -- asset_id output.glb

Arguments:
  asset_id   - The asset ID (e.g., "tree.pine.medium") for validation
  output.glb - Output file path

The script validates dimensions against asset_specs.py before exporting.
"""

import bpy
import sys
import os
import math

# Add tools directory to path for imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from asset_specs import get_spec, validate_dimensions, ASSET_SPECS

# =============================================================================
# EXPORT SETTINGS
# =============================================================================

EXPORT_SETTINGS = {
    "export_format": "GLB",
    "export_yup": True,
    "export_apply": True,
    "export_normals": True,
    "export_tangents": False,
    "export_colors": True,
    "export_animations": True,
    "export_frame_range": True,
    "export_nla_strips": True,
    "export_optimize_animation_size": True,
    "export_materials": "EXPORT",
    "export_image_format": "AUTO",
    "export_texcoords": True,
    "export_draco_mesh_compression_enable": False,
    "export_skins": True,
    "export_all_influences": False,
    "export_def_bones": True,
}


def parse_args():
    """Parse command line arguments."""
    argv = sys.argv
    args = {"asset_id": None, "output": None, "force": False}

    if "--" in argv:
        script_args = argv[argv.index("--") + 1:]
        for i, arg in enumerate(script_args):
            if arg == "--force":
                args["force"] = True
            elif arg == "--list":
                print("\nAvailable asset IDs:")
                for category in ["character", "tree", "shrub", "equipment", "irrigation", "prop"]:
                    assets = [k for k in ASSET_SPECS.keys() if k.startswith(category)]
                    if assets:
                        print(f"\n  {category}:")
                        for a in sorted(assets):
                            spec = ASSET_SPECS[a]
                            h = spec["height_range"]
                            print(f"    {a}: height {h[0]}-{h[1]}m")
                sys.exit(0)
            elif args["asset_id"] is None:
                args["asset_id"] = arg
            elif args["output"] is None:
                args["output"] = arg

    # Default output path
    if args["output"] is None:
        blend_path = bpy.data.filepath
        if blend_path:
            args["output"] = os.path.splitext(blend_path)[0] + ".glb"
        else:
            args["output"] = "//export.glb"

    return args


def get_exportable_objects():
    """Get all objects that should be exported (exclude REF_ objects)."""
    exportable = []
    for obj in bpy.context.scene.objects:
        if obj.name.startswith("REF_"):
            continue
        if obj.type in {'MESH', 'ARMATURE', 'EMPTY'}:
            exportable.append(obj)
    return exportable


def calculate_bounds(objects):
    """Calculate bounding box of all objects."""
    if not objects:
        return None

    min_co = [float('inf')] * 3
    max_co = [float('-inf')] * 3

    for obj in objects:
        if obj.type != 'MESH':
            continue

        # Get world-space bounds
        bbox = [obj.matrix_world @ bpy.mathutils.Vector(corner) for corner in obj.bound_box]
        for co in bbox:
            for i in range(3):
                min_co[i] = min(min_co[i], co[i])
                max_co[i] = max(max_co[i], co[i])

    if min_co[0] == float('inf'):
        return None

    return {
        "min": min_co,
        "max": max_co,
        "width": max_co[0] - min_co[0],   # X
        "depth": max_co[1] - min_co[1],   # Y (forward in Blender)
        "height": max_co[2] - min_co[2],  # Z (up in Blender)
    }


def check_origin(objects, spec):
    """Check if origin is correctly placed."""
    origin_type = spec.get("origin", "base_center")

    for obj in objects:
        if obj.type != 'MESH':
            continue

        bbox = obj.bound_box
        local_min_z = min(v[2] for v in bbox)

        if origin_type == "base_center":
            # Origin should be at Z=0 (base of object)
            if abs(local_min_z) > 0.01:
                return False, f"Origin should be at base (Z=0), but mesh bottom is at Z={local_min_z:.3f}"

        elif origin_type == "center":
            # Origin should be at center of object
            center_z = sum(v[2] for v in bbox) / 8
            if abs(center_z) > 0.05:
                return False, f"Origin should be at center, but center Z is {center_z:.3f}"

    return True, ""


def check_animations(asset_id, objects):
    """Check for required animations."""
    spec = get_spec(asset_id)
    if not spec:
        return True, ""

    required = spec.get("required_animations", [])
    if not required:
        return True, ""

    # Get all animation names
    found_anims = set()
    for action in bpy.data.actions:
        found_anims.add(action.name.lower())

    missing = []
    for req in required:
        if req.lower() not in found_anims:
            missing.append(req)

    if missing:
        return False, f"Missing required animations: {', '.join(missing)}"

    return True, ""


def validate_asset(asset_id, objects, force=False):
    """Validate asset against specifications."""
    spec = get_spec(asset_id)

    if not spec:
        if force:
            print(f"WARNING: Unknown asset ID '{asset_id}', skipping validation")
            return True
        else:
            print(f"ERROR: Unknown asset ID '{asset_id}'")
            print("Use --list to see available asset IDs, or --force to skip validation")
            return False

    print(f"\nValidating against spec: {asset_id}")
    print(f"  Expected height: {spec['height_range'][0]:.1f} - {spec['height_range'][1]:.1f}m")
    print(f"  Expected footprint: {spec['footprint'][0]:.1f} x {spec['footprint'][1]:.1f}m")

    bounds = calculate_bounds(objects)
    if not bounds:
        print("ERROR: No mesh objects found to export")
        return False

    print(f"\n  Actual dimensions:")
    print(f"    Height: {bounds['height']:.2f}m")
    print(f"    Width:  {bounds['width']:.2f}m")
    print(f"    Depth:  {bounds['depth']:.2f}m")

    # Validate dimensions
    errors = validate_dimensions(
        asset_id,
        bounds['height'],
        bounds['width'],
        bounds['depth']
    )

    # Check origin placement
    origin_ok, origin_msg = check_origin(objects, spec)
    if not origin_ok:
        errors.append(origin_msg)

    # Check animations
    anim_ok, anim_msg = check_animations(asset_id, objects)
    if not anim_ok:
        errors.append(anim_msg)

    if errors:
        print("\n  VALIDATION FAILED:")
        for err in errors:
            print(f"    - {err}")

        if force:
            print("\n  --force specified, exporting anyway...")
            return True
        else:
            print("\n  Use --force to export anyway")
            return False

    print("\n  VALIDATION PASSED")
    return True


def prepare_for_export(objects):
    """Prepare objects for export."""
    # Deselect all
    bpy.ops.object.select_all(action='DESELECT')

    # Select exportable objects
    for obj in objects:
        obj.select_set(True)

    if objects:
        bpy.context.view_layer.objects.active = objects[0]


def export_glb(output_path, objects):
    """Export selected objects to GLB."""
    prepare_for_export(objects)

    print(f"\nExporting to: {output_path}")

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        use_selection=True,
        **EXPORT_SETTINGS
    )

    print(f"Export complete!")


def main():
    args = parse_args()

    print("=" * 60)
    print("Greenkeeper Simulator Asset Exporter")
    print("=" * 60)

    objects = get_exportable_objects()
    print(f"\nFound {len(objects)} exportable objects")

    if not objects:
        print("ERROR: No objects to export (objects starting with REF_ are excluded)")
        sys.exit(1)

    # Validate if asset_id provided
    if args["asset_id"]:
        if not validate_asset(args["asset_id"], objects, args["force"]):
            sys.exit(1)
    else:
        print("\nWARNING: No asset_id provided, skipping validation")
        print("Usage: blender file.blend --background --python export_glb.py -- <asset_id> [output.glb]")

    export_glb(args["output"], objects)


if __name__ == "__main__":
    main()
