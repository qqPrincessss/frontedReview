import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class PromptBuilder {
  private readonly logger = new Logger(PromptBuilder.name);
  private system: string;
  private outputFormat: string;
  private examples: { bad: string; medium: string; good: string };

  constructor() {
    this.loadTemplates();
  }

  /**
   * 组装最终的 prompt
   */
  build(diff: string, language?: string): { system: string; user: string } {
    const fullSystem = `${this.system}

${this.outputFormat}

# 校准示例

以下是不同分数档位的审查结果示例，用于帮助你校准打分标准：

## 低分示例 (32分 - 屎山级别)
${this.examples.bad}

## 中等示例 (62分 - 有待改进)
${this.examples.medium}

## 高分示例 (88分 - 优质代码)
${this.examples.good}
`;

    const lang = language || '未知语言';
    const user = `请审查以下 ${lang} 代码的 git diff，按照你的审查维度进行评分和分析：

\`\`\`diff
${diff}
\`\`\``;

    return { system: fullSystem, user };
  }

  private loadTemplates(): void {
    const promptsDir = join(__dirname, 'prompts');

    try {
      this.system = readFileSync(join(promptsDir, 'system.md'), 'utf-8');
      this.outputFormat = readFileSync(
        join(promptsDir, 'output-format.md'),
        'utf-8',
      );
      this.examples = {
        bad: readFileSync(
          join(promptsDir, 'examples', 'bad-review.json'),
          'utf-8',
        ),
        medium: readFileSync(
          join(promptsDir, 'examples', 'medium-review.json'),
          'utf-8',
        ),
        good: readFileSync(
          join(promptsDir, 'examples', 'good-review.json'),
          'utf-8',
        ),
      };
      this.logger.log('Prompt 模板加载成功');
    } catch (error: any) {
      this.logger.warn(`Prompt 模板加载失败: ${error.message}，使用默认值`);
      this.system = '你是一位资深前端架构师，专注代码质量审查。';
      this.outputFormat = '请以 JSON 格式输出审查结果。';
      this.examples = { bad: '{}', medium: '{}', good: '{}' };
    }
  }
}
