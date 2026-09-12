path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\vendor-dashboard.html'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("Line 5823-5830:")
for i in range(5822, 5832):
    print(f'{i+1}: {repr(lines[i])}')
