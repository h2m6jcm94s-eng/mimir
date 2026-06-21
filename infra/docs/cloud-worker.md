# Cloud worker lifecycle

The cloud worker is an air-gapped, single-use EC2 instance that runs a job and returns the result via a signed webhook.

## How it works

1. The API provisions an EC2 instance using `apps/api/src/services/cloud-worker/provision.ts`.
2. The instance receives a cloud-init script rendered from `infra/cloud-worker/cloud-init.yml`.
3. The script:
   - mounts a 2 GB tmpfs,
   - joins the Tailscale tailnet with `tag:cloud`,
   - writes the base64-encoded job payload,
   - runs the `mimir/cloud-worker:latest` container,
   - POSTs the result to the signed webhook URL,
   - wipes state and self-terminates.

## Terraform

The Terraform module lives in `infra/terraform/cloud-worker/`.

```bash
cd infra/terraform/cloud-worker
terraform init
terraform apply \
  -var="ami_id=ami-xxxxxxxx" \
  -var="tailscale_auth_key=tskey-xxx" \
  -var="webhook_url=https://..." \
  -var="job_payload=..."
```

## AMI requirements

- Amazon Linux 2023 or Ubuntu 22.04 LTS.
- Docker and Tailscale installed.
- No inbound ports required.
- IMDSv2 required.

## IAM permissions

The instance profile is scoped to:

- CloudWatch Logs (`logs:CreateLogGroup`, `CreateLogStream`, `PutLogEvents`).
- ECR pull (`ecr:GetAuthorizationToken`, `BatchCheckLayerAvailability`, `GetDownloadUrlForLayer`, `BatchGetImage`).

No S3 or EC2 write permissions are granted by default.

## Debugging

If a worker fails before returning:

1. Check the instance serial console in the AWS EC2 console.
2. Look for `/var/log/cloud-init-output.log`.
3. Verify the Tailscale ACL allows `tag:cloud` to reach the webhook host.
