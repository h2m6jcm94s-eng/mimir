import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CLOUD_INIT_TEMPLATE_PATH = resolve(
  __dirname,
  '../../../../../infra/cloud-worker/cloud-init.yml'
);

export interface CloudWorkerPayload {
  tailscaleAuthKey: string;
  webhookUrl: string;
  jobPayloadBase64: string;
}

export function renderCloudInit(payload: CloudWorkerPayload): string {
  const template = readFileSync(CLOUD_INIT_TEMPLATE_PATH, 'utf-8');

  const rendered = template
    .replace(/\{\{tailscale_auth_key\}\}/g, payload.tailscaleAuthKey)
    .replace(/\{\{webhook_url\}\}/g, payload.webhookUrl)
    .replace(/\{\{job_payload\}\}/g, payload.jobPayloadBase64);

  return Buffer.from(rendered).toString('base64');
}
