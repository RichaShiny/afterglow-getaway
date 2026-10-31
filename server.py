"""Neon Coast local telemetry API. Run: python3 server.py"""
import json, sqlite3, time, uuid
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parent
DB=ROOT/'runtime'/'telemetry.sqlite3'
DB.parent.mkdir(exist_ok=True)
def connect():
    c=sqlite3.connect(DB,timeout=10)
    c.execute('CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, session TEXT NOT NULL, received REAL NOT NULL, payload TEXT NOT NULL)')
    c.execute('CREATE INDEX IF NOT EXISTS session_events ON events(session,received)')
    return c
with connect(): pass
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def reply(self,code,data):
        body=json.dumps(data).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_POST(self):
        if self.path!='/api/events': return self.reply(404,{'error':'Not found'})
        origin=self.headers.get('Origin')
        if origin and origin!=f'http://{self.headers.get("Host")}':return self.reply(403,{'error':'Origin rejected'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=150000:raise ValueError('Invalid body size')
            data=json.loads(self.rfile.read(size));batch=data['events'];session=str(uuid.UUID(data['session']))
            if not isinstance(batch,list) or len(batch)>100:raise ValueError('Invalid batch')
            rows=[]
            for e in batch:
                uuid.UUID(e['id'])
                if e.get('type') not in ['session_start','session_restart','position','vehicle_enter','vehicle_exit','collision','mission_checkpoint']:raise ValueError('Unknown event')
                if not isinstance(e.get('time'),(float,int)) or e['time']<0:raise ValueError('Invalid time')
                rows.append((e['id'],session,time.time(),json.dumps(e,allow_nan=False)))
            with connect() as c:c.executemany('INSERT OR IGNORE INTO events VALUES (?,?,?,?)',rows)
            self.reply(200,{'acknowledged':len(batch)})
        except (ValueError,KeyError,TypeError):self.reply(400,{'error':'Invalid telemetry batch'})
    def do_GET(self):
        if urlparse(self.path).path=='/api/live':
            with connect() as c:
                count=c.execute('SELECT COUNT(*) FROM events').fetchone()[0]
                sessions=c.execute('SELECT COUNT(DISTINCT session) FROM events').fetchone()[0]
                rows=c.execute('SELECT session,received,payload FROM events ORDER BY received DESC,rowid DESC LIMIT 12').fetchall()
            return self.reply(200,{'total_events':count,'total_sessions':sessions,'server_time':time.time(),'recent':[{'session':s,'received':t,'event':json.loads(p)} for s,t,p in rows]})
        if self.path.startswith('/api/'):return self.reply(404,{'error':'Not found'})
        super().do_GET()
if __name__=='__main__':
    print('Neon Coast + live telemetry: http://localhost:5174',flush=True)
    ThreadingHTTPServer(('127.0.0.1',5174),Handler).serve_forever()
