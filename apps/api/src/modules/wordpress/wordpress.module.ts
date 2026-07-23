import { Module } from '@nestjs/common';
import { WordPressService } from './wordpress.service';

@Module({
  providers: [WordPressService],
  exports: [WordPressService],
})
export class WordPressModule {}
