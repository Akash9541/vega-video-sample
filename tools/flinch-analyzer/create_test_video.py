import cv2
import numpy as np
from pathlib import Path

output = Path(__file__).resolve().parent / "test-flashes.mp4"
fps = 30
duration = 10
width, height = 320, 240

writer = cv2.VideoWriter(
    str(output),
    cv2.VideoWriter_fourcc(*"mp4v"),
    fps,
    (width, height),
)

if not writer.isOpened():
    raise RuntimeError("Could not create test video")

for frame_number in range(fps * duration):
    time_seconds = frame_number / fps

    if 2 <= time_seconds < 4:
        brightness = 255 if int(time_seconds * 5) % 2 == 0 else 0
    else:
        brightness = 80

    frame = np.full((height, width, 3), brightness, dtype=np.uint8)
    writer.write(frame)

writer.release()
print(f"Created test video: {output.name}")
