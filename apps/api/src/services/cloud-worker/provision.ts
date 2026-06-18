import { EC2Client, RunInstancesCommand, type RunInstancesCommandInput } from '@aws-sdk/client-ec2';
import { signReturnToken } from './token';

export interface ProvisionCloudWorkerInput {
  tenantId: string;
  jobId: string;
  region?: string;
  amiId?: string;
  instanceType?: string;
  webhookBaseUrl: string;
  jobPayload?: unknown;
}

export interface ProvisionCloudWorkerResult {
  instanceId: string;
  privateIp?: string;
  returnUrl: string;
}

export async function provisionCloudWorker(
  input: ProvisionCloudWorkerInput
): Promise<ProvisionCloudWorkerResult> {
  const region = input.region || process.env.AWS_REGION || 'us-east-1';
  const amiId = input.amiId || process.env.CLOUD_WORKER_AMI_ID;
  const instanceType = input.instanceType || process.env.CLOUD_WORKER_INSTANCE_TYPE || 't3.micro';

  if (!amiId) {
    throw new Error('CLOUD_WORKER_AMI_ID is required to provision a cloud worker');
  }

  const returnUrl = input.webhookBaseUrl.endsWith('/')
    ? `${input.webhookBaseUrl}webhooks/cloud-workers/return/${signReturnToken({ jobId: input.jobId, tenantId: input.tenantId })}`
    : `${input.webhookBaseUrl}/webhooks/cloud-workers/return/${signReturnToken({ jobId: input.jobId, tenantId: input.tenantId })}`;

  const tailscaleAuthKey = process.env.TAILSCALE_AUTH_KEY;
  if (!tailscaleAuthKey) {
    throw new Error('TAILSCALE_AUTH_KEY is required to provision a cloud worker');
  }

  const client = new EC2Client({ region });

  const params: RunInstancesCommandInput = {
    ImageId: amiId,
    InstanceType: instanceType as RunInstancesCommandInput['InstanceType'],
    MinCount: 1,
    MaxCount: 1,
    MetadataOptions: {
      HttpTokens: 'required',
    },
    TagSpecifications: [
      {
        ResourceType: 'instance',
        Tags: [
          { Key: 'Name', Value: 'mimir-cloud-worker' },
          { Key: 'mimir:tenantId', Value: input.tenantId },
          { Key: 'mimir:jobId', Value: input.jobId },
        ],
      },
    ],
    UserData: Buffer.from(
      JSON.stringify({
        tailscaleAuthKey,
        webhookUrl: returnUrl,
        jobPayload: Buffer.from(JSON.stringify(input.jobPayload ?? {})).toString('base64'),
      })
    ).toString('base64'),
  };

  const command = new RunInstancesCommand(params);
  const result = await client.send(command);
  const instance = result.Instances?.[0];
  if (!instance?.InstanceId) {
    throw new Error('EC2 RunInstances did not return an instance ID');
  }

  return {
    instanceId: instance.InstanceId,
    privateIp: instance.PrivateIpAddress,
    returnUrl,
  };
}
