import {
  Stack, StackProps,
  aws_eks as eks
} from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { ServiceResources } from './service-resources';
import { CICDResources } from './cicd-resources';

export class AppInfrastructureStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // create resources needed for this app
    const serviceResources = new ServiceResources(this, props);

    // create CI/CD pipeline for this app
    const cicdResources = new CICDResources(this, { });

  }
}

