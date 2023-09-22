export class Constants {
    public static readonly CodeBuildDeployProjectIAMRole = 'CodeBuild-BuildDeployEKS-Role'; // Name of the (pre-existing) IAM Role for the CodeBuild deploy project in CI/CD pipeline. This role should have access to EKS and be added in the aws-auth configmap

    public static readonly GitHubRepo = 'coding-challenge';  // Name of the source repo for our app in github
    public static readonly GitHubOwner = 'markmcpherson';  // Owner of the source repo for our app in github
    public static readonly GitHubBranch = 'main'; // Branch to build/deploy
    public static readonly GitHubTokenSecretName = 'dev/github-access-token'; // Name of the secret in AWS SecretsManager containing the github oauth token

    // overridable constants 
    public static readonly EKSClusterName = process.env.EKS_CLUSTER_NAME || ' eks-blueprint';
    public static readonly DeploymentEnvironment = process.env.DEPLOY_ENVIRONMENT || 'dev'; // e.g. dev/staging/prod. There is helm chart values file for dev.
    public static readonly DeploymentNamespace = process.env.DEPLOY_NAMESPACE || 'dev';
    public static readonly ApplicationName = process.env.APPLICATION_NAME || 'application';
}
