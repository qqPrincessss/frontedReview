import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ModelClient,
  ModelRequest,
  ModelResponse,
} from './model-client';
@Injectable()
export class AnthropicClient implements ModelClient {
    constructor(
        private readonly configService: ConfigService,
    ){}
}{

}