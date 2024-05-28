import * as cdk from 'aws-cdk-lib';
import { Peer, Port, Vpc } from 'aws-cdk-lib/aws-ec2';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket, BucketEncryption, EventType } from 'aws-cdk-lib/aws-s3';
import { BedrockFoundationModel, ChunkingStrategy, KnowledgeBase, S3DataSource } from '@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock';
import { Construct } from 'constructs';
import path = require('path');
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';

export class RaggedUpBedrockStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'app-vpc', {});

    const bucket = new Bucket(this, 'rag-bucket', {
        encryption: BucketEncryption.KMS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,        
    });

    const bucketEventSource = new S3EventSource(bucket, { events: [EventType.OBJECT_CREATED] });
    
    const kbModel = BedrockFoundationModel.TITAN_EMBED_TEXT_V1;
    const ragModel = new BedrockFoundationModel('anthropic.claude-3-sonnet-20240229-v1:0');

    const knowledgeBase = new KnowledgeBase(this, 'rag-kb', {
        embeddingsModel: kbModel,
    });

    const datasource = new S3DataSource(this, 'rag-ds', {
        dataSourceName: "ragged-up-bedrock",
        bucket,
        knowledgeBase,
        chunkingStrategy: ChunkingStrategy.FIXED_SIZE,
        maxTokens: 300,
        overlapPercentage: 20
    });

    const ragLoader = new NodejsFunction(this, 'rag-loader', {
        vpc,
        handler: 'handler',
        runtime: Runtime.NODEJS_20_X,
        entry: path.join(__dirname, '/../lambda/rag_loader.ts'),
        environment: {
          KNOWLEDGE_BASE_ID: knowledgeBase.knowledgeBaseId,
          DATA_SOURCE_ID: datasource.dataSourceId
        },
        timeout: cdk.Duration.minutes(2), //Max 2 minutes to load data
        logRetention: RetentionDays.ONE_DAY,
        tracing: Tracing.ACTIVE
    });

    ragLoader.addEventSource(bucketEventSource);
    
    ragLoader.addToRolePolicy(new PolicyStatement({
        actions: [
            'bedrock:StartIngestionJob'
        ],
        resources: [
            `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:knowledge-base/${knowledgeBase.knowledgeBaseId}`
        ]
    }));

    const model_runner = new NodejsFunction(this, 'model_caller', {
        vpc,
        handler: 'handler',
        runtime: Runtime.NODEJS_20_X,
        entry: path.join(__dirname, '/../lambda/model_caller.ts'),
        environment: {
          KNOWLEDGE_BASE_ID: knowledgeBase.knowledgeBaseId,
          MODEL_ARN: `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/${ragModel.modelId}`
        },
        timeout: cdk.Duration.minutes(1),
        logRetention: RetentionDays.ONE_DAY,
        tracing: Tracing.ACTIVE        
    });

    model_runner.addToRolePolicy(new PolicyStatement({
        actions: [
            'bedrock:InvokeModel',
            'bedrock:Retrieve',
            'bedrock:RetrieveAndGenerate'
        ],
        resources: [
            `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/${ragModel.modelId}`,
            `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:knowledge-base/${knowledgeBase.knowledgeBaseId}`
        ]
    }));

    const api = new LambdaRestApi(this, 'test-api', {
        handler: model_runner
    });    
  }
}
