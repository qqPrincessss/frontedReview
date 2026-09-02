import { Command } from 'commander';
import { apiClient } from '../utils/api';
import { getConfig, saveConfig, setServerUrl } from '../utils/config';

interface LoginOptions {
  username?: string;
  password?: string;
  server?: string;
}

interface RegisterOptions extends LoginOptions {
  email?: string;
}

export const loginCommand = new Command('login')
  .description('登录到 CodeReview AI 服务')
  .option('-u, --username <username>', '用户名')
  .option('-p, --password <password>', '密码')
  .option('--server <url>', 'API 地址，例如 https://example.com/api')
  .action(async (options: LoginOptions) => {
    const { username, password } = options;

    if (!username || !password) {
      console.error('请提供用户名和密码：review login -u <username> -p <password>');
      process.exitCode = 1;
      return;
    }

    try {
      if (options.server) setServerUrl(options.server);

      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });
      const { access_token, user } = (response.data as {
        data: {
          access_token: string;
          user: { username: string };
        };
      }).data;

      saveConfig({
        token: access_token,
        username: user.username,
        server: getConfig().server,
      });

      console.log(`✓ 登录成功，欢迎 ${user.username}`);
    } catch (error: unknown) {
      console.error(`✗ ${getErrorMessage(error, '登录失败')}`);
      process.exitCode = 1;
    }
  });

export const logoutCommand = new Command('logout')
  .description('退出登录，清除本地 token')
  .action(() => {
    saveConfig({ token: '', username: '', server: getConfig().server });
    console.log('✓ 已退出登录');
  });

export const registerCommand = new Command('register')
  .description('注册 CodeReview AI 账号')
  .option('-u, --username <username>', '用户名')
  .option('-e, --email <email>', '邮箱')
  .option('-p, --password <password>', '密码')
  .option('--server <url>', 'API 地址，例如 https://example.com/api')
  .action(async (options: RegisterOptions) => {
    const { username, email, password } = options;

    if (!username || !email || !password) {
      console.error(
        '请提供用户名、邮箱和密码：review register -u <username> -e <email> -p <password>',
      );
      process.exitCode = 1;
      return;
    }

    try {
      if (options.server) setServerUrl(options.server);

      const response = await apiClient.post('/auth/register', {
        username,
        email,
        password,
      });
      const user = (response.data as {
        data: { username: string };
      }).data;

      console.log(`✓ 注册成功，欢迎 ${user.username}`);
      console.log(`请继续登录：review login -u ${user.username} -p <password>`);
    } catch (error: unknown) {
      console.error(`✗ ${getErrorMessage(error, '注册失败')}`);
      process.exitCode = 1;
    }
  });

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}
