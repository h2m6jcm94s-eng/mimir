import { z } from 'zod';

export const SsoProviderKind = z.enum(['saml', 'oidc', 'scim']);
export const SsoProviderStatus = z.enum(['active', 'inactive']);

export const SsoProviderConfig = z.record(z.unknown()).default({});

export const SsoProvider = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  kind: SsoProviderKind,
  name: z.string().min(1),
  status: SsoProviderStatus,
  config: SsoProviderConfig,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateSsoProviderRequest = SsoProvider.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateSsoProviderRequest = CreateSsoProviderRequest.partial();

export const ScimUserName = z.object({
  formatted: z.string().optional(),
  familyName: z.string().optional(),
  givenName: z.string().optional(),
});

export const ScimUser = z.object({
  schemas: z.array(z.string()).default(['urn:ietf:params:scim:schemas:core:2.0:User']),
  id: z.string().uuid(),
  userName: z.string().min(1),
  name: ScimUserName.optional(),
  emails: z
    .array(
      z.object({
        value: z.string().email(),
        primary: z.boolean().optional(),
      })
    )
    .optional(),
  active: z.boolean().default(true),
  meta: z
    .object({
      resourceType: z.string().default('User'),
      created: z.string().datetime().optional(),
      lastModified: z.string().datetime().optional(),
    })
    .optional(),
});

export const ScimListResponse = z.object({
  schemas: z.array(z.string()).default(['urn:ietf:params:scim:api:messages:2.0:ListResponse']),
  totalResults: z.number().int().nonnegative(),
  Resources: z.array(ScimUser),
});

export const ScimCreateUserRequest = ScimUser.omit({ id: true, meta: true }).extend({
  password: z.string().optional(),
});

export const ScimError = z.object({
  schemas: z.array(z.string()).default(['urn:ietf:params:scim:api:messages:2.0:Error']),
  status: z.string(),
  detail: z.string().optional(),
});

export type SsoProvider = z.infer<typeof SsoProvider>;
export type CreateSsoProviderRequest = z.infer<typeof CreateSsoProviderRequest>;
export type UpdateSsoProviderRequest = z.infer<typeof UpdateSsoProviderRequest>;
export type ScimUser = z.infer<typeof ScimUser>;
export type ScimListResponse = z.infer<typeof ScimListResponse>;
export type ScimCreateUserRequest = z.infer<typeof ScimCreateUserRequest>;
export type ScimError = z.infer<typeof ScimError>;
