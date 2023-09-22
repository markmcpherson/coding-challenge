#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AppInfrastructureStack } from '../lib/app-infrastructure-stack';

const app = new cdk.App();
new AppInfrastructureStack(app, 'AppInfrastructureStack', {
});
