import { Request } from 'express';

/** JWT 认证成功后挂载到 request.user 的用户信息。 */
export interface AuthenticatedUser {
  id: string;
  username: string;
}

/** 仅用于已经通过 JwtAuthGuard 的 Controller 请求。 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
