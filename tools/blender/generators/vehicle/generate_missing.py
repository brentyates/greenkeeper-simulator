import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(SCRIPT_DIR)
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, create_cylinder, set_origin_to_base, join_objects
from _common.materials import create_solid_material


def generate_aerator_ride():
    ctx = setup_asset_context("vehicle.aerator.ride")

    body_mat = create_solid_material("Body", (0.15, 0.35, 0.15))
    seat_mat = create_solid_material("Seat", (0.2, 0.2, 0.22))
    wheel_mat = create_solid_material("Wheel", (0.1, 0.1, 0.1))
    metal_mat = create_solid_material("Metal", (0.5, 0.5, 0.52), roughness=0.4)

    body = create_box("Body", 1.2, 2.0, 0.4, location=(0, 0, 0.4))
    body.data.materials.append(body_mat)

    seat = create_box("Seat", 0.5, 0.4, 0.3, location=(0, -0.4, 0.8))
    seat.data.materials.append(seat_mat)

    drum = create_cylinder("Drum", 0.3, 1.0, segments=10, location=(0, 0.7, 0.3))
    drum.rotation_euler = (0, 1.5708, 0)
    drum.data.materials.append(metal_mat)

    parts = [body, seat, drum]
    for i, (x, y) in enumerate([(-0.5, -0.8), (0.5, -0.8), (-0.5, 0.2), (0.5, 0.2)]):
        wheel = create_cylinder(f"Wheel{i}", 0.2, 0.1, segments=8, location=(x, y, 0.2))
        wheel.rotation_euler = (1.5708, 0, 0)
        wheel.data.materials.append(wheel_mat)
        parts.append(wheel)

    result = join_objects(parts, name="AeratorRide")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_cart_utility():
    ctx = setup_asset_context("vehicle.cart.utility")

    body_mat = create_solid_material("Body", (0.15, 0.35, 0.15))
    seat_mat = create_solid_material("Seat", (0.2, 0.2, 0.22))
    wheel_mat = create_solid_material("Wheel", (0.1, 0.1, 0.1))
    bed_mat = create_solid_material("Bed", (0.4, 0.38, 0.35))

    cab = create_box("Cab", 1.1, 1.2, 0.8, location=(0, -0.6, 0.5))
    cab.data.materials.append(body_mat)

    roof = create_box("Roof", 1.2, 1.3, 0.05, location=(0, -0.6, 1.5))
    roof.data.materials.append(body_mat)

    posts = []
    for i, (x, y) in enumerate([(-0.5, -1.1), (0.5, -1.1), (-0.5, -0.1), (0.5, -0.1)]):
        p = create_cylinder(f"Post{i}", 0.02, 0.7, segments=6, location=(x, y, 0.8))
        p.data.materials.append(body_mat)
        posts.append(p)

    seat = create_box("Seat", 0.9, 0.4, 0.1, location=(0, -0.7, 0.5))
    seat.data.materials.append(seat_mat)

    bed = create_box("Bed", 1.1, 1.3, 0.3, location=(0, 0.75, 0.35))
    bed.data.materials.append(bed_mat)

    parts = [cab, roof, seat, bed] + posts
    for i, (x, y) in enumerate([(-0.5, -1.0), (0.5, -1.0), (-0.5, 0.8), (0.5, 0.8)]):
        wheel = create_cylinder(f"Wheel{i}", 0.18, 0.1, segments=8, location=(x, y, 0.18))
        wheel.rotation_euler = (1.5708, 0, 0)
        wheel.data.materials.append(wheel_mat)
        parts.append(wheel)

    result = join_objects(parts, name="CartUtility")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


if __name__ == "__main__":
    generate_aerator_ride()
    generate_cart_utility()
    print("\nAll missing vehicle assets generated.")
