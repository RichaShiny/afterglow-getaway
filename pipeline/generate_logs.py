"""Generate synthetic scale-test data; never presented as real player activity."""
import argparse,json,random,uuid
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--sessions',type=int,default=1000);p.add_argument('--events-per-session',type=int,default=200);p.add_argument('--output',default='data/synthetic/events.jsonl');p.add_argument('--seed',type=int,default=42);a=p.parse_args()
if a.sessions<1 or a.events_per_session<2:p.error('Need at least one session and two events per session')
r=random.Random(a.seed);Path(a.output).parent.mkdir(parents=True,exist_ok=True)
with open(a.output,'w') as out:
    for s in range(a.sessions):
        session=str(uuid.UUID(int=s+1));x,y=2200.,1900.;suspicious=s%20==0
        for n in range(a.events_per_session):
            speed=r.uniform(450,650) if suspicious else r.uniform(10,300)
            x+=speed*.5;y+=r.uniform(-10,10)
            e={'id':str(uuid.UUID(int=s*a.events_per_session+n+1)),'session':session,'time':n*.5,'received':1800000000+n*.5,'type':'position','x':x,'y':y,'speed':speed,'vehicle':True,'source':'synthetic','synthetic_anomaly':int(suspicious)}
            out.write(json.dumps(e)+'\n')
print(f'Wrote {a.sessions*a.events_per_session:,} SYNTHETIC events to {a.output}')
