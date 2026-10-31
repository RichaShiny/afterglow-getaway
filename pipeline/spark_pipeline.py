"""Distributed batch feature engineering and baseline anomaly scoring with Spark ML."""
import argparse,json,time
from pyspark.sql import SparkSession,functions as F,types as T
from pyspark.ml import Pipeline,PipelineModel
from pyspark.ml.feature import VectorAssembler,StandardScaler
from pyspark.ml.clustering import KMeans
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--model',help='Existing model path: score without retraining');a=p.parse_args()
spark=SparkSession.builder.appName('AfterglowGameplayPipeline').getOrCreate();started=time.monotonic()
schema=T.StructType([T.StructField('id',T.StringType()),T.StructField('session',T.StringType()),T.StructField('time',T.DoubleType()),T.StructField('type',T.StringType()),T.StructField('speed',T.DoubleType()),T.StructField('x',T.DoubleType()),T.StructField('y',T.DoubleType()),T.StructField('source',T.StringType()),T.StructField('synthetic_anomaly',T.IntegerType()),T.StructField('_corrupt_record',T.StringType())])
raw=spark.read.schema(schema).option('mode','PERMISSIVE').json(a.input).cache();input_count=raw.count()
valid=raw.filter(F.col('_corrupt_record').isNull() & F.col('id').isNotNull() & F.col('session').isNotNull() & F.col('source').isin('gameplay','synthetic') & F.col('time').isNotNull() & ~F.isnan('time') & (F.abs(F.col('time'))<1e12) & (F.col('time')>=0) & F.col('type').isin('position','session_start','session_restart','vehicle_enter','vehicle_exit','collision','mission_checkpoint'))
valid_count=valid.count();dedup=valid.dropDuplicates(['session','id']);clean=dedup.count()
positions=dedup.filter((F.col('type')=='position') & F.col('speed').isNotNull() & ~F.isnan('speed') & (F.col('speed')>=0) & (F.col('speed')<1e8))
# Keep source partitions distinct so generated and real observations cannot mix.
features=positions.withColumn('window_id',F.floor(F.col('time')/30)).groupBy('source','session','window_id').agg(F.count('*').alias('samples'),F.avg('speed').alias('mean_speed'),F.max('speed').alias('max_speed'),F.stddev_pop('speed').alias('speed_std'),F.max('synthetic_anomaly').alias('synthetic_anomaly')).filter('samples >= 5').cache()
features.write.mode('overwrite').partitionBy('source').parquet(a.output+'/features')
feature_count=features.count()
if feature_count<10:raise ValueError('Need at least 10 windows with >=5 position samples each. Play longer or use the synthetic generator.')
# Stable per-session split prevents adjacent windows from leaking into evaluation.
features=features.withColumn('split',F.pmod(F.xxhash64('session'),F.lit(5)))
train=features.filter('split != 0 AND max_speed <= 330').cache();test=features.filter('split = 0').cache()
if a.model:model=PipelineModel.load(a.model)
else:
    if train.count()<4:raise ValueError('Insufficient normal training windows')
    model=Pipeline(stages=[VectorAssembler(inputCols=['mean_speed','max_speed','speed_std'],outputCol='raw_features'),StandardScaler(inputCol='raw_features',outputCol='features',withMean=True,withStd=True),KMeans(k=2,seed=42,featuresCol='features')]).fit(train)
    model.write().overwrite().save(a.output+'/model')
centers=[list(map(float,c)) for c in model.stages[-1].clusterCenters()]
@F.udf(T.DoubleType())
def distance(v,pred):return float(sum((float(x)-y)**2 for x,y in zip(v,centers[pred])))
def score(df):return model.transform(df).withColumn('anomaly_score',distance('features','prediction')).withColumn('rule_speed_violation',F.col('max_speed')>330)
train_scores=score(train);threshold=train_scores.approxQuantile('anomaly_score',[.99],.01)
if not threshold:raise ValueError('No training scores to calibrate threshold')
# Persist calibration with training model; reuse it unchanged for later scoring.
if a.model:
    threshold=spark.read.json(a.model.rsplit('/',1)[0]+'/calibration').first()['threshold']
else:
    threshold=threshold[0];spark.createDataFrame([(float(threshold),)],['threshold']).coalesce(1).write.mode('overwrite').json(a.output+'/calibration')
scored=score(features).withColumn('model_flag',F.col('anomaly_score')>threshold)
scored.select('source','session','window_id','samples','mean_speed','max_speed','anomaly_score','model_flag','rule_speed_violation','synthetic_anomaly').write.mode('overwrite').partitionBy('source').parquet(a.output+'/scores')
evaluation=score(test).filter("source = 'synthetic'").withColumn('predicted',(F.col('anomaly_score')>threshold)|F.col('rule_speed_violation'))
evaluation.groupBy('synthetic_anomaly','predicted').count().write.mode('overwrite').json(a.output+'/synthetic_evaluation')
spark.createDataFrame([(input_count,input_count-valid_count,valid_count-clean,feature_count,float(threshold),float(time.monotonic()-started))],['input_events','invalid_events','duplicate_events','feature_windows','threshold','elapsed_seconds']).coalesce(1).write.mode('overwrite').json(a.output+'/metrics')
print(json.dumps({'input_events':input_count,'feature_windows':feature_count,'threshold':threshold,'output':a.output}))
spark.stop()
