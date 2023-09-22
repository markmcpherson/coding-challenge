// Create any service-specific resources
// (e.g. S3 buckets, SQS queues, database stuff, Lambda functions, etc.)
// In this case there is nothing but leaving this here as an example

import { Construct } from 'constructs';
import {
    StackProps,
  } from 'aws-cdk-lib';
  
export class ServiceResources {

    constructor(scope: Construct, props: StackProps) {
    }
}
