import { NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import {
  resolveTenantRequest,
  tenantCookieOptions,
  type TenantResolution,
} from './resolve';
import { runWithTenant, type TenantContext } from './context';
import { isPlatformConfigurationError } from '../platform/config';

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

/**
 * Convert platform database/configuration failures into an explicit 503.
 * Resolution happens before the route handler, so without this guard the
 * request would fail with an empty 500 response. No SQL or connection details
 * are returned to the client.
 */
function platformResolutionErrorResponse(error: unknown): Response {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const message = error instanceof Error ? error.message : 'unknown error';
  console.error(`[tenant] Platform resolution failed (${code || 'UNKNOWN'}): ${message}`);

  if (isPlatformConfigurationError(error)) {
    return NextResponse.json(
      {
        code: 'PLATFORM_CONFIGURATION_ERROR',
        message: 'خدمة المنصة غير مهيأة حاليًا. تواصل مع إدارة المنصة.',
        statusCode: 503,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (code === '42P01') {
    return NextResponse.json(
      {
        code: 'PLATFORM_SCHEMA_NOT_READY',
        message: 'مخطط قاعدة بيانات المنصة غير جاهز. تواصل مع إدارة المنصة.',
        statusCode: 503,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    {
      code: 'PLATFORM_UNAVAILABLE',
      message: 'خدمة المنصة غير متاحة مؤقتًا.',
      statusCode: 503,
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
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
    let resolution: TenantResolution;
    try {
      resolution = await resolveTenantRequest(req);
    } catch (error) {
      unstable_rethrow(error);
      return platformResolutionErrorResponse(error);
    }
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
  let resolution: TenantResolution;
  try {
    resolution = await resolveTenantRequest(req, explicitSlug);
  } catch (error) {
    unstable_rethrow(error);
    return platformResolutionErrorResponse(error);
  }
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
