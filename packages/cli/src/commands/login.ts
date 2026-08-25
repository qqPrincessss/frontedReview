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
