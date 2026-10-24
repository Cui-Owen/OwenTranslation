"""Package only the verified build inventory; exclude Edge-generated caches."""
from pathlib import Path
from hashlib import sha256
import json
import zipfile

root = Path(__file__).resolve().parent.parent
extension = root / 'extension'
info = json.loads((extension / 'OWEN-BUILD.json').read_text())
for name, expected in info['files'].items():
    content = (extension / name).read_bytes()
    assert len(content) == expected['bytes'], name
    assert sha256(content).hexdigest() == expected['sha256'], name

output = root / 'outputs'
output.mkdir(exist_ok=True)
archive = output / f"{info['version']}.zip"
names = sorted([*info['files'], 'OWEN-BUILD.json'])
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as package:
    for name in names:
        package.write(extension / name, '欧文翻译/' + name)
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert len(package.namelist()) == len(names)
    for name in names:
        assert package.read('欧文翻译/' + name) == (extension / name).read_bytes(), name

before = sum(p.stat().st_size for p in (root / 'upstream').rglob('*') if p.is_file() and '_metadata' not in p.parts)
after = sum((extension / name).stat().st_size for name in names)
report = {
    'version': info['version'], 'scope': info['scope'],
    'archive': str(archive.relative_to(root)), 'archiveBytes': archive.stat().st_size,
    'sha256': sha256(archive.read_bytes()).hexdigest(),
    'files': len(names), 'baselineBytes': before, 'extensionBytes': after,
    'reductionBytes': before - after, 'reductionPercent': round(100 * (before - after) / before, 2)
}
previous = output / '欧文翻译-0.2-B.zip'
if previous.exists():
    with zipfile.ZipFile(previous) as package:
        entries = [entry for entry in package.infolist() if not entry.is_dir()]
        previous_bytes = sum(entry.file_size for entry in entries)
    report['previousRelease'] = {
        'archive': str(previous.relative_to(root)), 'files': len(entries),
        'extensionBytes': previous_bytes,
        'reductionBytes': previous_bytes - after,
        'reductionPercent': round(100 * (previous_bytes - after) / previous_bytes, 2)
    }
(output / 'release.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
(output / 'SHA256SUMS.txt').write_text(f"{report['sha256']}  {archive.name}\n")
print(json.dumps(report, indent=2, ensure_ascii=False))
