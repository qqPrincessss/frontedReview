import { Command } from 'commander';
import { apiClient } from '../utils/api';
import { saveConfig, getConfig } from '../utils/config';

export const loginCommand = new Command('login')
  .description('登录到 CodeReview AI 服务')
  .option('-u, --username <username>', '用户名')
  .option('-p, --password <password>', '密码')
  .action(async (options) => {
    const { username, password } = options;

    if (!username || !password) {
      console.error('请提供用户名和密码：review login -u <username> -p <password>');
      process.exit(1);
    }

    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });

      const { access_token, user } = response.data.data;

      // 保存 token 到本地
      saveConfig({
        token: access_token,
        username: user.username,
        server: getConfig().server,
      });

      console.log(`✓ 登录成功，欢迎 ${user.username}`);
    } catch (error: any) {
      const message =
        error.response?.data?.message || error.message || '登录失败';
      console.error(`✗ ${message}`);
      process.exit(1);
    }
  });

export const logoutCommand = new Command('logout')
  .description('退出登录，清除本地 token')
  .action(() => {
    saveConfig({ token: '', username: '', server: getConfig().server });
    console.log('✓ 已退出登录');
  });

interface RegisterOptions {
  username?: string;
  email?: string;
  password?: string;
}

export const registerCommand = new Command('register')
  .description('注册 CodeReview AI 账号')
  .option('-u, --username <username>', '用户名')
  .option('-e, --email <email>', '邮箱')
  .option('-p, --password <password>', '密码')
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
      const message = error instanceof Error ? error.message : '注册失败';
      console.error(`✗ ${message}`);
      process.exitCode = 1;
    }
  });
