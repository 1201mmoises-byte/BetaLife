class_name BLRotator
extends Node3D

## Continuous slow Y-axis rotation, in degrees/second. Used for the Shrine's
## floating crystal (village-base-3d-scene-design spec: "slow rotation of the
## crystal is welcome... your own script or via village_base — your call,
## keep it simple"). Generic enough to reuse anywhere else a structure wants
## a cheap idle spin.

@export var degrees_per_second: float = 24.0


func _process(delta: float) -> void:
	rotate_y(deg_to_rad(degrees_per_second) * delta)
