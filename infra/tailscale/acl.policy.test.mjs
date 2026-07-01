import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function stripComments(input) {
  return input.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function parseTagPort(entry) {
  const parts = entry.split(':');
  if (parts.length < 2 || parts[0] !== 'tag') {
    throw new Error(`Invalid ACL dst entry: ${entry}`);
  }
  const tag = `tag:${parts[1]}`;
  const port = parts.length > 2 ? parts.slice(2).join(':') : undefined;
  return { tag, port };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const raw = readFileSync(join(__dirname, 'acl.hujson'), 'utf8');
const acl = JSON.parse(stripComments(raw));

const allTags = ['tag:brain', 'tag:desktop', 'tag:phone', 'tag:cloud', 'tag:control'];

// 1. tagOwners: only group:admins may own tags.
for (const tag of allTags) {
  const owners = acl.tagOwners?.[tag];
  assert(
    Array.isArray(owners) && owners.length === 1 && owners[0] === 'group:admins',
    `${tag} must be owned solely by group:admins`
  );
}

// 2. tag:cloud cannot reach any non-cloud tag.
for (const rule of acl.acls ?? []) {
  if (rule.action !== 'accept') continue;
  const src = Array.isArray(rule.src) ? rule.src : [];
  const dst = Array.isArray(rule.dst) ? rule.dst : [];

  if (src.includes('tag:cloud')) {
    for (const entry of dst) {
      const { tag } = parseTagPort(entry);
      assert(tag === 'tag:cloud', `tag:cloud must not reach ${tag} (entry: ${entry})`);
    }
  }
}

// 3. tag:control may only reach tag:brain:3001.
for (const rule of acl.acls ?? []) {
  if (rule.action !== 'accept') continue;
  const src = Array.isArray(rule.src) ? rule.src : [];
  const dst = Array.isArray(rule.dst) ? rule.dst : [];

  if (src.includes('tag:control')) {
    assert(dst.length === 1, 'tag:control must have exactly one dst entry');
    const { tag, port } = parseTagPort(dst[0]);
    assert(tag === 'tag:brain', `tag:control must only reach tag:brain, got ${tag}`);
    assert(port === '3001', `tag:control must only reach port 3001, got ${port}`);
  }
}

// 4. tag:cloud must not accept SSH.
for (const rule of acl.ssh ?? []) {
  const dst = Array.isArray(rule.dst) ? rule.dst : [];
  for (const entry of dst) {
    assert(entry !== 'tag:cloud', 'tag:cloud must not accept SSH');
  }
}

// 5. No broad wildcard allow rules that would undermine default-deny.
for (const rule of acl.acls ?? []) {
  if (rule.action !== 'accept') continue;
  const src = Array.isArray(rule.src) ? rule.src : [];
  const dst = Array.isArray(rule.dst) ? rule.dst : [];
  assert(!src.includes('*'), 'Broad wildcard src is not allowed');
  for (const entry of dst) {
    const parts = entry.split(':');
    assert(parts[0] === 'tag', `Broad wildcard dst is not allowed: ${entry}`);
  }
}

if (process.exitCode === 1) {
  console.error('\nACL policy invariants failed.');
} else {
  console.log('ACL policy invariants passed.');
}
