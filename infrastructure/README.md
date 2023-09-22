# CDK for AWS infrastructure for this application

This is a CDK project for deploying the necessary AWS infrastructure to support this application.

It includes
* ECR repo for the app
* A basic CI/CD pipeline to build and deploy in EKS


## Pre-Requisites

* NodeJS
* `npm install -g typescript cdk`

## Build/Deploy
* `cdk synth`
* `cdk bootstrap` (once per AWS account/region)
* `cdk deploy`


## Getting started with the code

The app entry point is in bin/app-infrastructure.ts.
The CloudFormation stack is defined in lib/app-infrastructure-stack.ts
The CI/CD pipeline is defined in lib/app-infrastructure-stack
There are some constants and overridable values (from the local ENV) in lib/constants.ts
