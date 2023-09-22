import { Construct } from 'constructs';
import {
  SecretValue, RemovalPolicy,
  aws_ecr as ecr,
  aws_codebuild as codebuild,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as actions,
  aws_iam as iam
} from 'aws-cdk-lib';
import { Constants } from './consts';
import { Artifact } from 'aws-cdk-lib/aws-codepipeline';

export interface CICDResourcesProps {
}

export class CICDResources {
  constructor(scope: Construct, props: CICDResourcesProps) {

    // create ecr repository for our app
    const appECRRepo = new ecr.Repository(
      scope,
      'AppECRRepo',
      {
        imageTagMutability: ecr.TagMutability.IMMUTABLE,

        // wouldn't normally use these, but simplify cleanup for this test,
        autoDeleteImages: true,
        removalPolicy: RemovalPolicy.DESTROY
      }
    );

    // allow codebuild to read from it
    appECRRepo.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('codebuild.amazonaws.com',)],
      actions: [
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:BatchCheckLayerAvailability'
      ]
    }));

    // Create a role for the build CodeBuild project with required permissions
    // (here just need access to our ecr repo, and to log in CloudWatch)
    const buildProjectRole = new iam.Role(scope, 'BuildProjectRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      inlinePolicies: {
        buildPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecr:*'
              ],
              resources: [ appECRRepo.repositoryArn ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecr:GetAuthorizationToken'
              ],
              resources: [ '*' ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams',
                'logs:PutLogEvents'
              ],
              resources: [ '*' ]
            })
          ]
        })
      }
    });

    // create a CodeBuild project that will run the build/deploy script for our app
    const buildProject = new codebuild.PipelineProject(scope, 'BuildProject', {
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true
      },
      role: buildProjectRole,
      environmentVariables: {
        CLUSTER_NAME: { value: Constants.EKSClusterName },
        ECR_REPO_URI: { value: appECRRepo.repositoryUri }
      },
    });


    // get the pre-existing deploy project IAM role
    // this role needs to have permissions to EKS and needs to 
    // have been added to the aws-auth configmap so it has permissions 
    // (could create here and process here instead but generally would expect a single role shared across projects, and updating the configmap for an existing cluster from cdk is not supported)
    const deployProjectRole = iam.Role.fromRoleName(scope, 'DeployProjectRole', Constants.CodeBuildDeployProjectIAMRole);

    // deployment script 
    const deployProjectScript: any = {
      version: 0.2,
      phases: {
        install: {
          commands: [
            'curl -sSL https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3 | bash',
            'helm repo add stable https://charts.helm.sh/stable && helm repo update'
          ]
        },
        pre_build: {
          commands: [
            'helm version',
            'mkdir ~/.kube/',
            'aws eks --region $AWS_DEFAULT_REGION update-kubeconfig --name $CLUSTER_NAME',
            'chmod 0600 ~/.kube/config',
            'aws sts get-caller-identity'
          ]
        },
        build: {
          commands: [
            'helm upgrade --atomic --timeout 1m0s --wait -i $APP_NAME-$DEPLOY_ENV helm/$APP_NAME -n $DEPLOY_NS -f helm/$APP_NAME/values.$DEPLOY_ENV.yaml --set image.repository=$ECR_REPO_URI --set image.tag=$BUILD_VERSION'
          ]
        },
        post_build: {
          commands: [
            'bash -c "if [ /"$CODEBUILD_BUILD_SUCCEEDING/" == /"0/" ]; then exit 1; fi"',
            'sleep 60',
            'APP_ENDPOINT=`kubectl get svc $APP_NAME-$DEPLOY_ENV -n $DEPLOY_NS -o jsonpath="{.status.loadBalancer.ingress[*].hostname}"`',
            'echo -e "The application can be accessed now via http://$APP_ENDPOINT/"'
          ]
        }
      }
    };

    const deployProject = new codebuild.PipelineProject(scope, 'DeployProject', {
      buildSpec: codebuild.BuildSpec.fromObject(deployProjectScript),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true
      },
      role: deployProjectRole,
      environmentVariables: {
        CLUSTER_NAME: { value: Constants.EKSClusterName },
        ECR_REPO_URI: { value: appECRRepo.repositoryUri },
        APP_NAME: { value: Constants.ApplicationName },
        DEPLOY_ENV: { value: Constants.DeploymentEnvironment },
        DEPLOY_NS: { value: Constants.DeploymentNamespace }
      },
    });


    // Create a CodePipeline pipeline that will rebuild/deploy the app based on changes to the app source in github
    // This is fairly simple and a more complex pipeline could be written that deploys to a staging env, runs tests then deploys to prod, etc. with or without manual approval steps, if required
    const sourceArtifact = new Artifact();

    const buildPipeline = new codepipeline.Pipeline(scope, 'BuildPipeline', {
      pipelineName: 'Build-Deploy-' + Constants.GitHubRepo
    });

    // Add our source stage (pull code from github)
    buildPipeline.addStage({
      stageName: 'Source',
      actions: [
        new actions.GitHubSourceAction({
          actionName: 'Source',
          owner: Constants.GitHubOwner,
          repo: Constants.GitHubRepo,
          branch: Constants.GitHubBranch,
          oauthToken: SecretValue.secretsManager(Constants.GitHubTokenSecretName, { jsonField: 'oauthToken' }),
          output: sourceArtifact
        })
      ]
    });

    // build step will build and unit test the app, generate the docker image and upload to ECR
    // this script will be specific to the application so is defined in the buildspec.yml
    // could add extra stages for other tests, scanning, etc.
    buildPipeline.addStage({
      stageName: 'Build',
      actions: [
        new actions.CodeBuildAction({
          actionName: 'Build',
          input: sourceArtifact,
          project: buildProject,
          variablesNamespace: 'BuildVariables'
        })
      ]
    });

    // deploy step will deploy the app to eks
    buildPipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new actions.CodeBuildAction({
          actionName: 'Deploy',
          input: sourceArtifact,
          project: deployProject,
          environmentVariables: {
            BUILD_VERSION: {value: '#{BuildVariables.BUILD_VERSION}' }
          }
        })
      ]
    })

  }
}
