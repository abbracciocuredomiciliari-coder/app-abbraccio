import paramiko
import sys

host = '94.177.199.228'
user = 'root'
pass_file = sys.argv[1]
command = sys.argv[2]

with open(pass_file, 'r') as f:
    password = f.read().strip()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, timeout=20)
stdin, stdout, stderr = client.exec_command(command, timeout=120)
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'), file=sys.stderr)
client.close()
