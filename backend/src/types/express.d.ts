import { AuthenticatedUser } from '@shared/types/auth.types';
import { TenantContext } from '@shared/types/tenant.types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenant?: TenantContext;
      rawBody?: Buffer | string;
    }
  }
}

export {};
