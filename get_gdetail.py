import subprocess, re

# Get the full gdetail function
r = subprocess.run(['ssh', '-i', r'C:\Users\Administrator\.ssh\id_qclaw', 'root@47.98.36.35',
    "sed -n '116,117p' /var/www/fortune/index.html"],
    capture_output=True, text=True, encoding='utf-8', errors='replace')

with open(r'C:\Users\Administrator\Desktop\fortune-mvp\gdetail_full.txt', 'w', encoding='utf-8') as f:
    f.write(r.stdout)
print('Done, length:', len(r.stdout))