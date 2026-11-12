import { NextResponse } from 'next/server';
import {
  resolveTenantRequest,
  tenantCookieOptions,
  type TenantResolution,
} from './resolve';
import { runWithTenant, type TenantContext } from './context';

export type TenantRouteHandler = (
  req: Request,
  ...rest: never[]
) => Promise<Response>;

function blockedResponse(tenant: TenantContext): Response {
  return NextResponse.json(
    {
      code: `CHURCH_${tenant.status.toUpperCase()}`,
      message:
        tenant.status === 'suspended'
          ? 'تم إيقاف هذا الحساب مؤقتًا. تواصل مع إدارة المنصة.'
          : 'هذه الكنيسة غير مفعّلة بعد.',
      statusCode: tenant.status === 'suspended' ? 403 : 503,
    },
    { status: tenant.status === 'suspended' ? 403 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

export function tenantErrorResponse(result: Extract<TenantResolution, { ok: false }>): Response {
  return NextResponse.json(
    { code: result.code, message: result.message, statusCode: result.status },
    { status: result.status, headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Wrap a tenant route handler. Tenant resolution happens before any handler
 * code runs, and the database connection is scoped with AsyncLocalStorage.
 * The handler's own arguments (including dynamic route params) are unchanged.
 */
export function withTenant<
  T extends (req: Request, ...rest: any[]) => Promise<Response>,
>(handler: T): T {
  return (async (req: Request, ...rest: any[]) => {
    const resolution = await resolveTenantRequest(req);
    if (!resolution.ok) return tenantErrorResponse(resolution);
    if (resolution.tenant.status !== 'active') return blockedResponse(resolution.tenant);
    return runWithTenant(resolution.tenant, () => handler(req, ...rest));
  }) as T;
}

/**
 * Resolve a tenant explicitly for an auth endpoint (login / member signup),
 * where the church code may be sent in a JSON body because the request is on
 * the central domain. The Host header still wins; a conflicting explicit slug
 * is rejected by the resolver.
 */
export async function withResolvedTenant(
  req: Request,
  explicitSlug: string | null | undefined,
  handler: (req: Request, tenant: TenantContext) => Promise<Response>,
): Promise<Response> {
  const resolution = await resolveTenantRequest(req, explicitSlug);
  if (!resolution.ok) return tenantErrorResponse(resolution);
  if (resolution.tenant.status !== 'active') return blockedResponse(resolution.tenant);
  return runWithTenant(resolution.tenant, () => handler(req, resolution.tenant));
}

export function applyTenantCookie(response: NextResponse, slug: string): NextResponse {
  response.cookies.set(
    'tenant_slug',
    slug,
    tenantCookieOptions(process.env.NODE_ENV === 'production'),
  );
  return response;
}
