import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { ReviewModule } from './modules/review/review.module';
import { ReportModule } from './modules/report/report.module';
import { AgentModule } from './agent/agent.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    DatabaseModule,
    AuthModule,
    ReviewModule,
    ReportModule,
    AgentModule,
  ],
})
export class AppModule {}
