import { createHash } from 'crypto';
import { existsSync, readFileSync, statSync } from 'fs';
import { isAbsolute, join, resolve } from 'path';
import { Injectable } from '@nestjs/common';

const REVIEW_SKILL_NAMES = [
  'review-code-quality',
  'frontend-review',
] as const;
const SKILL_FILE_NAME = 'SKILL.md';
const MAX_SKILL_BYTES = 64 * 1024;
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface LoadedReviewSkill {
  readonly name: string;
  readonly description: string;
  readonly body: string;
  readonly contentHash: string;
}

@Injectable()
export class SkillLoader {
  loadReviewSkills(): readonly LoadedReviewSkill[] {
    const skillsDirectory = this.resolveSkillsDirectory();

    return REVIEW_SKILL_NAMES.map((expectedName) =>
      this.loadSkill(skillsDirectory, expectedName),
    );
  }

  private resolveSkillsDirectory(): string {
    const configuredDirectory = process.env.REVIEW_SKILLS_DIR?.trim();
    if (configuredDirectory) {
      return isAbsolute(configuredDirectory)
        ? configuredDirectory
        : resolve(process.cwd(), configuredDirectory);
    }

    const repositorySkillsDirectory = resolve(
      __dirname,
      '../../../..',
      '.agents',
      'skills',
    );
    if (existsSync(repositorySkillsDirectory)) {
      return repositorySkillsDirectory;
    }

    return join(__dirname, 'skills');
  }

  private loadSkill(
    skillsDirectory: string,
    expectedName: string,
  ): LoadedReviewSkill {
    const path = join(skillsDirectory, expectedName, SKILL_FILE_NAME);
    let rawContent: string;

    try {
      const stats = statSync(path);
      if (!stats.isFile()) {
        throw new Error('路径不是普通文件');
      }
      if (stats.size > MAX_SKILL_BYTES) {
        throw new Error(`文件超过 ${MAX_SKILL_BYTES} 字节限制`);
      }
      rawContent = readFileSync(path, 'utf-8');
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`无法加载审查 Skill ${expectedName}：${path}；${reason}`);
    }

    if (Buffer.byteLength(rawContent, 'utf-8') > MAX_SKILL_BYTES) {
      throw new Error(
        `审查 Skill 超过 ${MAX_SKILL_BYTES} 字节限制：${expectedName}`,
      );
    }

    const normalized = rawContent
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n')
      .trim();
    const parsed = this.parseSkill(normalized, path);

    if (parsed.name !== expectedName) {
      throw new Error(
        `审查 Skill 目录名与 name 不一致：期望 ${expectedName}，实际 ${parsed.name}`,
      );
    }

    return {
      ...parsed,
      contentHash: createHash('sha256').update(normalized).digest('hex'),
    };
  }

  private parseSkill(
    content: string,
    path: string,
  ): Omit<LoadedReviewSkill, 'contentHash'> {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]+)$/);
    if (!match) {
      throw new Error(`审查 Skill 缺少合法 frontmatter 或正文：${path}`);
    }

    const metadata = new Map<string, string>();
    for (const line of match[1].split('\n')) {
      const separator = line.indexOf(':');
      if (separator <= 0) {
        throw new Error(`审查 Skill frontmatter 行格式无效：${path}`);
      }

      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (!['name', 'description'].includes(key) || !value) {
        throw new Error(`审查 Skill frontmatter 字段无效：${path}#${key}`);
      }
      if (metadata.has(key)) {
        throw new Error(`审查 Skill frontmatter 字段重复：${path}#${key}`);
      }
      metadata.set(key, value);
    }

    const name = metadata.get('name');
    const description = metadata.get('description');
    const body = match[2].trim();

    if (!name || !SKILL_NAME_PATTERN.test(name)) {
      throw new Error(`审查 Skill name 无效：${path}`);
    }
    if (!description) {
      throw new Error(`审查 Skill description 不能为空：${path}`);
    }
    if (!body) {
      throw new Error(`审查 Skill 正文不能为空：${path}`);
    }

    return { name, description, body };
  }
}
