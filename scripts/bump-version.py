#!/usr/bin/env python3
"""Stamp static CSS/JS URLs in root HTML files with ?v=<ver> and bump sw.js CACHE_VERSION.

Usage:
    python3 scripts/bump-version.py [version]
"""
import datetime
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1].strip():
        ver = re.sub(r'[^a-zA-Z0-9._-]', '', sys.argv[1].strip())
    else:
        ver = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M')

    if not ver:
        print('Invalid version string', file=sys.stderr)
        sys.exit(1)

    # 1. Update sw.js CACHE_VERSION
    sw_path = os.path.join(ROOT, 'sw.js')
    with open(sw_path, 'r', encoding='utf-8') as f:
        sw_src = f.read()

    sw_new, sw_count = re.subn(
        r"const CACHE_VERSION = 'valuon-static-[^']+';",
        f"const CACHE_VERSION = 'valuon-static-{ver}';",
        sw_src,
        count=1,
    )
    if sw_count != 1:
        print('Could not find CACHE_VERSION in sw.js', file=sys.stderr)
        sys.exit(1)

    with open(sw_path, 'w', encoding='utf-8') as f:
        f.write(sw_new)

    # 2. Stamp local css/*.css and js/*.js in root *.html files
    # Matches href="css/foo.css", href="/css/foo.css?v=old", src="js/bar.js", src="/js/bar.js?v=old"
    asset_re = re.compile(
        r'''(?P<attr>\b(?:href|src)=["'])(?P<path>/?(?:css|js)/[^"'?\s#]+\.(?:css|js))(?:\?v=[^"'#\s]+)?(?P<quote>["'])'''
    )

    updated_files = 0
    total_refs = 0
    for html_path in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
        with open(html_path, 'r', encoding='utf-8') as f:
            src = f.read()

        new_src, count = asset_re.subn(
            lambda m: f"{m.group('attr')}{m.group('path')}?v={ver}{m.group('quote')}",
            src,
        )
        if count > 0 and new_src != src:
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(new_src)
            updated_files += 1
            total_refs += count

    print(f'Bumped static version to {ver}: sw.js updated, {total_refs} refs across {updated_files} HTML files.')


if __name__ == '__main__':
    main()
