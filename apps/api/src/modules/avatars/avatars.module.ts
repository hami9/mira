import {
  BadRequestException,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import type { Response } from 'express';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { AgentJwtGuard } from '../../common/guards/agent-jwt.guard';
import { RequirePermission } from '../../common/guards/require-permission.decorator';
import { CurrentAgent } from '../../common/decorators/current-agent.decorator';
import { AgentAccessTokenPayload } from '../../common/token/token.service';

sharp.cache({ memory: 8, files: 0, items: 16 });
sharp.concurrency(1);
const upload = FileInterceptor('image', {
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
});
type ImageFile = { buffer: Buffer; size: number };

@Controller('v1/avatars')
export class AvatarsController {
  private processing = 0;
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Post('assistant')
  @RequirePermission('manageSiteSettings')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(upload)
  assistant(@CurrentAgent() agent: AgentAccessTokenPayload, @UploadedFile() file?: ImageFile) {
    return this.save(agent, true, file);
  }

  @Post('me')
  @UseGuards(AgentJwtGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(upload)
  me(@CurrentAgent() agent: AgentAccessTokenPayload, @UploadedFile() file?: ImageFile) {
    return this.save(agent, false, file);
  }

  @Get(':siteId/:ownerId/:version.png')
  async image(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Param('version', ParseUUIDPipe) version: string,
    @Res() response: Response,
  ): Promise<void> {
    const [row] = await this.db.query(
      'SELECT data FROM avatars WHERE "siteId"=$1 AND "ownerId"=$2 AND version=$3',
      [siteId, ownerId, version],
    );
    if (!row) throw new NotFoundException('تصویر پیدا نشد');
    response.setHeader('Cache-Control', 'public, max-age=300');
    response.type('image/png').send(row.data);
  }

  private async save(agent: AgentAccessTokenPayload, assistant: boolean, file?: ImageFile) {
    if (!file?.buffer.length || file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('عکس با حجم حداکثر ۱۰ مگابایت انتخاب کنید');
    }
    if (this.processing >= 2) throw new ServiceUnavailableException('کمی بعد دوباره تلاش کنید');
    this.processing++;
    try {
      let data: Buffer;
      try {
        const bytes = file.buffer;
        const supported =
          bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
          bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
          (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
        if (!supported) throw new Error('format');
        const image = sharp(file.buffer, { limitInputPixels: 16_777_216, animated: false });
        const metadata = await image.metadata();
        if (!['png', 'jpeg', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) {
          throw new Error('format');
        }
        data = await image
          .rotate()
          .resize(256, 256, { fit: 'cover' })
          .composite([
            {
              input: Buffer.from(
                '<svg width="256" height="256"><circle cx="128" cy="128" r="128" fill="white"/></svg>',
              ),
              blend: 'dest-in',
            },
          ])
          .png()
          .toBuffer();
        if (data.length > 300000) throw new Error('size');
      } catch {
        throw new BadRequestException('تصویر معتبر PNG، JPEG یا WebP انتخاب کنید');
      }
      const ownerId = assistant ? agent.siteId : agent.sub;
      const version = randomUUID();
      const base = this.config.getOrThrow<string>('PUBLIC_API_URL').replace(/\/$/, '');
      const url = `${base}/v1/avatars/${agent.siteId}/${ownerId}/${version}.png`;
      await this.db.transaction(async (manager) => {
        const [member] = await manager.query(
          'SELECT id FROM agents WHERE id=$1 AND "siteId"=$2 FOR UPDATE',
          [agent.sub, agent.siteId],
        );
        if (!member) throw new NotFoundException('اپراتور پیدا نشد');
        if (assistant)
          await manager.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE', [agent.siteId]);
        await manager.query(
          `INSERT INTO avatars ("siteId","ownerId","agentId",version,data) VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT ("siteId","ownerId") DO UPDATE SET version=EXCLUDED.version,data=EXCLUDED.data`,
          [agent.siteId, ownerId, assistant ? null : agent.sub, version, data],
        );
        if (assistant)
          await manager.query('UPDATE sites SET "aiBotAvatarUrl"=$1 WHERE id=$2', [
            url,
            agent.siteId,
          ]);
        else
          await manager.query('UPDATE agents SET "avatarUrl"=$1 WHERE id=$2 AND "siteId"=$3', [
            url,
            agent.sub,
            agent.siteId,
          ]);
      });
      return { url };
    } finally {
      this.processing--;
    }
  }
}

@Module({ controllers: [AvatarsController] })
export class AvatarsModule {}
