#!/usr/bin/env python3
"""
seo_audit.py
SEO/AI metadata auditor with encoding auto-detection.
Usage: python3 seo_audit.py --output=reports/seo_report --formats=csv,json --root=.
"""

import os
import sys
import argparse
import csv
import json
from collections import defaultdict

try:
    import chardet
except Exception:
    chardet = None

from bs4 import BeautifulSoup

def read_file_with_encoding_detection(path):
    # read raw bytes then try decode
    with open(path, 'rb') as f:
        raw = f.read()
    # try utf-8 first
    try:
        txt = raw.decode('utf-8')
        return txt
    except Exception:
        pass
    # try chardet if available
    if chardet:
        info = chardet.detect(raw)
        enc = info.get('encoding') or 'utf-8'
        try:
            txt = raw.decode(enc, errors='replace')
            return txt
        except Exception:
            pass
    # fallback: replace errors with utf-8
    return raw.decode('utf-8', errors='replace')

def extract_meta_from_html(path):
    txt = read_file_with_encoding_detection(path)
    soup = BeautifulSoup(txt, 'html.parser')

    # title
    title = ''
    if soup.title and soup.title.string:
        title = soup.title.string.strip()

    def meta_content(name=None, prop=None):
        if name:
            tag = soup.find('meta', attrs={'name': name})
            if tag and tag.get('content'):
                return tag['content'].strip()
        if prop:
            tag = soup.find('meta', attrs={'property': prop})
            if tag and tag.get('content'):
                return tag['content'].strip()
        return ''

    meta_description = meta_content(name='description') or meta_content(prop='og:description')
    meta_keywords = meta_content(name='keywords')
    meta_ai_summary = meta_content(name='ai-summary')
    canonical_tag = soup.find('link', rel='canonical')
    canonical = canonical_tag['href'].strip() if canonical_tag and canonical_tag.get('href') else ''

    hreflangs = []
    for alt in soup.find_all('link', attrs={'rel': 'alternate'}):
        if alt.get('hreflang') and alt.get('href'):
            hreflangs.append({'hreflang': alt.get('hreflang'), 'href': alt.get('href')})

    og_title = meta_content(prop='og:title')
    og_description = meta_content(prop='og:description')
    og_image = meta_content(prop='og:image')
    twitter_card = meta_content(name='twitter:card')

    json_ld_blocks = []
    for s in soup.find_all('script', attrs={'type': 'application/ld+json'}):
        txt_block = s.string
        if not txt_block:
            txt_block = ''.join(s.contents) if s.contents else ''
        if not txt_block:
            continue
        txt_block = txt_block.strip()
        parsed = None
        try:
            parsed = json.loads(txt_block)
        except Exception:
            # try to replace problematic newlines, keep raw if cannot parse
            try:
                parsed = json.loads(txt_block.replace('\n', ' '))
            except Exception:
                parsed = None
        json_ld_blocks.append({'raw': txt_block, 'json': parsed})

    return {
        'title': title,
        'meta_description': meta_description,
        'meta_keywords': meta_keywords,
        'meta_ai_summary': meta_ai_summary,
        'canonical': canonical,
        'hreflangs': hreflangs,
        'og_title': og_title,
        'og_description': og_description,
        'og_image': og_image,
        'twitter_card': twitter_card,
        'json_ld_blocks': json_ld_blocks
    }

def main():
    parser = argparse.ArgumentParser(description='SEO & AI metadata auditor for static HTML files')
    parser.add_argument('--root', default='.', help='Root directory to scan')
    parser.add_argument('--output', required=True, help='Output base path (without extension)')
    parser.add_argument('--formats', default='csv,json', help='Comma separated formats: csv,json')
    parser.add_argument('--verbose', action='store_true')
    args = parser.parse_args()

    root = args.root
    out_base = args.output
    formats = set([x.strip().lower() for x in args.formats.split(',') if x.strip()])

    pages = []
    for dirpath, dirnames, filenames in os.walk(root):
        if '/.git' in dirpath or dirpath.startswith('.git') or '/node_modules' in dirpath:
            continue
        for fname in filenames:
            if fname.lower().endswith(('.html', '.htm')):
                fpath = os.path.join(dirpath, fname)
                pages.append(fpath)

    results = []
    title_map = defaultdict(list)
    desc_map = defaultdict(list)
    no_canonical = []

    for p in sorted(pages):
        try:
            data = extract_meta_from_html(p)
        except Exception as e:
            print(f'Error parsing {p}: {e}', file=sys.stderr)
            continue
        rec = {
            'path': p,
            'title': data['title'] or '',
            'meta_description': data['meta_description'] or '',
            'meta_keywords': data['meta_keywords'] or '',
            'meta_ai_summary': data['meta_ai_summary'] or '',
            'canonical': data['canonical'] or '',
            'hreflangs': ';'.join([f"{h['hreflang']}|{h['href']}" for h in data['hreflangs']]) if data['hreflangs'] else '',
            'og_title': data['og_title'] or '',
            'og_description': data['og_description'] or '',
            'og_image': data['og_image'] or '',
            'twitter_card': data['twitter_card'] or '',
            'json_ld_count': len(data['json_ld_blocks']),
            'json_ld_summaries': []
        }
        for blk in data['json_ld_blocks']:
            js = blk['json']
            if isinstance(js, dict):
                js_type = js.get('@type') or (isinstance(js.get('@graph'), list) and 'graph') or 'object'
            elif isinstance(js, list):
                js_type = 'list'
            else:
                js_type = 'raw'
            rec['json_ld_summaries'].append(js_type)

        rec['json_ld_summaries'] = ';'.join(rec['json_ld_summaries'])
        results.append({'meta': rec, 'json_ld_blocks': data['json_ld_blocks']})

        if rec['title']:
            title_map[rec['title']].append(p)
        if rec['meta_description']:
            desc_map[rec['meta_description']].append(p)
        if not rec['canonical']:
            no_canonical.append(p)

    duplicates = {'titles': {}, 'descriptions': {}}
    for t, paths in title_map.items():
        if len(paths) > 1:
            duplicates['titles'][t] = paths
    for d, paths in desc_map.items():
        if len(paths) > 1:
            duplicates['descriptions'][d] = paths

    out_dir = os.path.dirname(out_base) or '.'
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    if 'csv' in formats:
        csv_path = out_base + '.csv'
        with open(csv_path, 'w', newline='', encoding='utf-8') as csvf:
            fieldnames = ['path','title','meta_description','meta_keywords','meta_ai_summary','canonical','hreflangs','og_title','og_description','og_image','twitter_card','json_ld_count','json_ld_summaries']
            writer = csv.DictWriter(csvf, fieldnames=fieldnames)
            writer.writeheader()
            for item in results:
                writer.writerow(item['meta'])

    if 'json' in formats:
        json_path = out_base + '.json'
        out_obj = { 'pages': results }
        with open(json_path, 'w', encoding='utf-8') as jf:
            json.dump(out_obj, jf, ensure_ascii=False, indent=2)

    dup_path = out_base + '.duplicates.json'
    with open(dup_path, 'w', encoding='utf-8') as df:
        json.dump(duplicates, df, ensure_ascii=False, indent=2)

    total = len(results)
    json_ld_total = sum([r['meta']['json_ld_count'] for r in results])
    top_titles = sorted(duplicates['titles'].items(), key=lambda x: -len(x[1]))[:10]

    print('--- SEO AUDIT SUMMARY ---')
    print(f'Total HTML files scanned: {total}')
    print(f'Pages without canonical: {len(no_canonical)}')
    print(f'Total JSON-LD blocks found: {json_ld_total}')
    print('Top duplicated titles (exact matches):')
    for t, paths in top_titles:
        print(f'  \"{t}\" -> {len(paths)} pages')

    print('\nReports generated:')
    if 'csv' in formats:
        print('  - ' + csv_path)
    if 'json' in formats:
        print('  - ' + json_path)
    print('  - ' + dup_path)

if __name__ == '__main__':
    main()