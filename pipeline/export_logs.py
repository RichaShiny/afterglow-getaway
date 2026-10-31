"""Export persisted gameplay events to Spark-readable JSON Lines."""
import argparse,json,sqlite3
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--database',default='runtime/telemetry.sqlite3');p.add_argument('--output',default='data/raw/gameplay.jsonl');a=p.parse_args()
Path(a.output).parent.mkdir(parents=True,exist_ok=True)
count=0
with sqlite3.connect(a.database) as db,open(a.output,'w') as out:
    for event_id,session,received,payload in db.execute('SELECT id,session,received,payload FROM events ORDER BY received'):
        event=json.loads(payload)
        # Position speed is in world units per second; preserve source units.
        out.write(json.dumps({**event,'id':event_id,'session':session,'received':received,'source':'gameplay'})+'\n');count+=1
print(f'Exported {count} real gameplay events to {a.output}')
