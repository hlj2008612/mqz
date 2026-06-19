import os

folder = 'images/zmq/'
files = [f for f in os.listdir(folder) if f.lower().endswith(('.jpg', '.png', '.jpeg', '.webp'))]
files.sort()

for i, filename in enumerate(files, start=1):
    ext = os.path.splitext(filename)[1]
    new_name = f"{i}{ext}"
    old_path = os.path.join(folder, filename)
    new_path = os.path.join(folder, new_name)
    os.rename(old_path, new_path)
    print(f"{filename} -> {new_name}")