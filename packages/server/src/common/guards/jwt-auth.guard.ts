import {
  ExecutionContext,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../interfaces/authenticated-request.interface';

interface PassportAuthInfo {
  name?: string;
  message?: string;
}

/**
 * JWT 路由守卫。
 *
 * AuthGuard('jwt') 负责读取 Authorization Bearer Token 并调用 JwtStrategy；
 * 此类负责把 Passport 的失败原因转换成稳定、可理解的 401 响应。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    error: unknown,
    user: AuthenticatedUser | false | null | undefined,
    info: unknown,
    _context: ExecutionContext,
    _status?: unknown,
  ): TUser {
    // 保留 Strategy 主动抛出的 Nest HTTP 异常。
    if (error instanceof HttpException) {
      throw error;
    }

    if (error) {
      throw new UnauthorizedException('身份验证失败');
    }

    const authInfo = this.toAuthInfo(info);
    if (authInfo.name === 'TokenExpiredError') {
      throw new UnauthorizedException('登录凭证已过期，请重新登录');
    }

    if (
      authInfo.name === 'JsonWebTokenError' ||
      authInfo.name === 'NotBeforeError'
    ) {
      throw new UnauthorizedException('登录凭证无效');
    }

    if (authInfo.message === 'No auth token') {
      throw new UnauthorizedException('请先登录');
    }

    if (!this.isAuthenticatedUser(user)) {
      throw new UnauthorizedException('身份验证失败');
    }

    return user as TUser;
  }

  private toAuthInfo(info: unknown): PassportAuthInfo {
    if (typeof info !== 'object' || info === null) return {};

    const value = info as Record<string, unknown>;
    return {
      name: typeof value.name === 'string' ? value.name : undefined,
      message: typeof value.message === 'string' ? value.message : undefined,
    };
  }

  private isAuthenticatedUser(user: unknown): user is AuthenticatedUser {
    if (typeof user !== 'object' || user === null) return false;

    const value = user as Record<string, unknown>;
    return (
      typeof value.id === 'string' &&
      value.id.length > 0 &&
      typeof value.username === 'string' &&
      value.username.length > 0
    );
  }
}
