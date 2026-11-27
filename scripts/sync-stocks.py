#!/usr/bin/env python3
"""Trusted cache worker. SUPABASE_SERVICE_ROLE_KEY must never be shipped to the app."""
import datetime as dt
import json
import math
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_SYMBOLS = {'005930.KS': '삼성전자', '000660.KS': 'SK하이닉스', '035420.KS': 'NAVER'}
SYMBOL = re.compile(r'^[A-Z0-9][A-Z0-9.\^-]{0,19}$')
KST = dt.timezone(dt.timedelta(hours=9))


def in_session(now):
    local = now.astimezone(KST)
    return local.weekday() < 5 and '09:00' <= local.strftime('%H:%M') <= '14:30'


def request_json(url, headers=None, data=None):
    req = urllib.request.Request(url, data=None if data is None else json.dumps(data, ensure_ascii=False, allow_nan=False).encode(), headers=headers or {})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                body = response.read()
                return json.loads(body) if body else None
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(0.5 * 2**attempt)


def parse_quote(symbol, name, data):
    meta = data['chart']['result'][0]['meta']
    price = float(meta['regularMarketPrice'])
    previous = float(meta.get('chartPreviousClose') or meta.get('previousClose') or price)
    timestamp = float(meta['regularMarketTime'])
    if not all(math.isfinite(n) for n in (price, previous, timestamp)) or not 0 < price <= 1_000_000_000 or previous <= 0 or meta.get('currency') != 'KRW':
        raise ValueError('Invalid KRW quote')
    stamp = dt.datetime.fromtimestamp(timestamp, dt.timezone.utc)
    if stamp > dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=1):
        raise ValueError('Future quote')
    return {'id': 'market:' + symbol, 'class_id': None, 'symbol': symbol, 'name': name,
            'price_krw': round(price, 4), 'change_krw': round(price - previous, 4),
            'change_percent': round((price / previous - 1) * 100, 4),
            'updated_at': stamp.isoformat(), 'source': 'market'}


def sync(environ=os.environ, fetch=request_json):
    if environ.get('GITHUB_EVENT_NAME') != 'workflow_dispatch' and not in_session(dt.datetime.now(dt.timezone.utc)):
        print('Outside weekday session; cache unchanged.')
        return
    base = environ['SUPABASE_URL'].rstrip('/')
    if not base.startswith('https://'):
        raise ValueError('SUPABASE_URL must use HTTPS')
    key = environ['SUPABASE_SERVICE_ROLE_KEY']
    headers = {'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}
    def all_rows(table, select, extra=''):
        rows = []
        for offset in range(0, 100000, 1000):
            batch = fetch(f'{base}/rest/v1/{table}?select={select}&limit=1000&offset={offset}{extra}', headers)
            if not isinstance(batch, list):
                raise ValueError('Invalid database response')
            rows.extend(batch)
            if len(batch) < 1000:
                return rows
        raise ValueError('Cache source pagination limit exceeded')
    symbols = {}
    for row in all_rows('startoday_settings', 'data'):
        config = (row.get('data') or {}).get('stockConfig') or {}
        configured = config.get('symbols')
        if configured is None:
            configured = [{'symbol': s, 'name': n} for s, n in DEFAULT_SYMBOLS.items()]
        for item in configured:
            if SYMBOL.fullmatch(item.get('symbol', '')):
                symbols[item['symbol']] = str(item.get('name') or item['symbol'])[:80]
    for row in all_rows('startoday_stock_holdings', 'symbol', '&shares=gt.0'):
        if SYMBOL.fullmatch(row.get('symbol', '')):
            symbols.setdefault(row['symbol'], row['symbol'])
    success = 0
    failures = 0
    for symbol, name in sorted(symbols.items()):
        try:
            url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + urllib.parse.quote(symbol, safe='') + '?interval=1m&range=1d'
            data = fetch(url, {'User-Agent': 'Mozilla/5.0 StarTodayQuoteCache/1.0'})
            quote = parse_quote(symbol, name, data)
            # The workflow concurrency group serializes writers; skip unchanged or older market ticks.
            existing = fetch(base + '/rest/v1/startoday_stock_quotes?id=eq.' + urllib.parse.quote(quote['id'], safe='') + '&select=updated_at', headers)
            if existing and dt.datetime.fromisoformat(existing[0]['updated_at'].replace('Z', '+00:00')) >= dt.datetime.fromisoformat(quote['updated_at']):
                continue
            fetch(base + '/rest/v1/startoday_stock_quotes?on_conflict=id', {**headers, 'Prefer': 'resolution=merge-duplicates,return=minimal'}, [quote])
            success += 1
        except (KeyError, TypeError, ValueError, IndexError, urllib.error.URLError, TimeoutError):
            failures += 1
            print(f'Quote unavailable: {symbol}; previous cache retained.')
    print(f'Cache sync: {success} updated / {len(symbols)} symbols.')
    if symbols and failures == len(symbols):
        raise RuntimeError('All quote requests failed; previous cache retained.')
    if symbols and success == 0:
        # Unchanged source ticks are legitimate; failures must never be rewritten with fresh timestamps.
        print('No newer quotes written. Check the provider if this persists during the session.')


if __name__ == '__main__':
    sync()
