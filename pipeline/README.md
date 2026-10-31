# Gameplay log processing and ML pipeline

This is a distributed **batch** pipeline alongside the game's live ingestion API. It demonstrates Spark APIs and an HDFS-compatible layout; it has not been benchmarked at production scale. Generated events are labeled `source=synthetic` and kept separate in the output partitions.

## Environment

Use Python 3.10 or 3.11 and Java 17. Install the optional pipeline dependencies in a virtual environment:

```sh
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements-ml.txt
```

The game itself requires no pip dependencies. The pipeline needs a Java runtime available through JAVA_HOME or PATH.

## Process actual gameplay

Play using `python3 server.py` first, then export the SQLite event table:

```sh
python pipeline/export_logs.py
spark-submit --master 'local[2]' pipeline/spark_pipeline.py --input data/raw/gameplay.jsonl --output artifacts/gameplay-run-001
```

At least 10 feature windows with 5 position samples each are required. The training split needs 4 normal windows. Short play sessions may not provide enough data. Start with synthetic data to check pipeline execution.

## Reproducible scale experiment

```sh
python pipeline/generate_logs.py --sessions 1000 --events-per-session 200
spark-submit --master 'local[2]' pipeline/spark_pipeline.py --input data/synthetic/events.jsonl --output artifacts/synthetic-run-001
```

This generates 200,000 events incrementally without holding the dataset in memory. Increase session/event counts only as local resources permit. One in twenty sessions has artificial excessive speed. These are deliberately easy test anomalies; evaluation on them does not establish real anti-cheat accuracy.

## Pipeline stages

1. Read JSON Lines using an explicit schema.
2. Reject malformed records and invalid required fields, deduplicate session/event IDs, and record counts.
3. Select valid position samples and aggregate 30-second simulation-time windows per source and session.
4. Write partitioned Parquet features.
5. Split by a stable session hash: approximately 80% train, 20% held out. Adjacent windows from a session stay together.
6. Train Spark ML VectorAssembler → StandardScaler → two-cluster KMeans on windows whose maximum speed is within the game's limit of 330 world units/second.
7. Score squared standardized distance from the assigned center and flag values above an approximate 99th-percentile training threshold. Also report a separate speed-limit rule.
8. Save model, calibration, Parquet scores, run metrics, and held-out synthetic confusion counts.

KMeans distance is a baseline anomaly score, not a probability or a validated cheating verdict. Training-window thresholds and generated labels are not substitutes for manual review and real labeled evaluation. Input and output paths must differ; use a new output directory per run because outputs use overwrite mode. This is not a streaming job or scheduler.

Reuse a trained model and its adjacent calibration directory:

```sh
spark-submit --master 'local[2]' pipeline/spark_pipeline.py --input data/synthetic/events.jsonl --output artifacts/scoring-run-002 --model artifacts/synthetic-run-001/model
```

The initial version expects enough normal windows even when scoring another dataset. Cluster/model drift monitoring, automatic retraining, robust dirty-data quarantine, and production scheduling are future work.

## Hadoop / HDFS

HDFS stores distributed files; Spark handles distributed computation. The same pipeline accepts HDFS paths on a configured Spark/Hadoop cluster:

```sh
hdfs dfs -mkdir -p /afterglow/raw
hdfs dfs -put data/synthetic/events.jsonl /afterglow/raw/events.jsonl
spark-submit --master yarn --deploy-mode cluster pipeline/spark_pipeline.py --input hdfs:///afterglow/raw/events.jsonl --output hdfs:///afterglow/runs/run-001
```

These commands require an existing HDFS/YARN environment with appropriate permissions and Spark configuration. This repository does not provision or claim to operate such a cluster. Local Spark uses one computer and does not demonstrate distributed production operation.

## Validation status

Python syntax and the streaming synthetic generator were checked. A full Spark training run was not executed in the authoring environment because no Java runtime was installed. Measure event count, execution time, resources, invalid/duplicate counts, and held-out false positives after running in a compatible environment before making performance claims.
