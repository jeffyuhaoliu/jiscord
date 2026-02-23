import os
base = "/Users/jeff/projects/jiscord/services/gateway"

def w(rel, content):
    full = os.path.join(base, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, "w").write(content)
    print("wrote", rel)

print("write_files.py created successfully")
