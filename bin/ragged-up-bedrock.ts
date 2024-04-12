#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RaggedUpBedrockStack } from '../lib/ragged-up-bedrock-stack';

const app = new cdk.App();
new RaggedUpBedrockStack(app, 'RaggedUpBedrockStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});