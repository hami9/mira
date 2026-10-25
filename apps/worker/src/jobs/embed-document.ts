import { AiEmbedDocumentJobData } from '@mira/shared-types';
import { pool } from '../db';
import { chunkText } from '../ai/chunk';
import { embedTexts } from '../ai/embeddings';
import { plainText } from '../ai/guardrails';

export async function processEmbedDocument(data: AiEmbedDocumentJobData): Promise<void> {
  const document = (
    await pool.query<{
      content: string;
      title: string;
      keywords: string[];
      revision: number;
      enabled: boolean;
    }>(
      `SELECT content,title,keywords,revision,enabled FROM knowledge_base_documents WHERE id=$1 AND "siteId"=$2`,
      [data.documentId, data.siteId],
    )
  ).rows[0];
  if (!document?.enabled || (data.revision !== undefined && data.revision !== document.revision))
    return;
  try {
    const chunks = chunkText(document.content);
    if (!chunks.length) throw new Error('متن سند خالی است');
    const context = plainText(`${document.title}\n${document.keywords.join('، ')}`, 1600);
    const embeddings = await embedTexts(
      chunks.map((chunk) => `${context}\n\n${chunk}`),
      { siteId: data.siteId, kind: 'document' },
    );
    if (
      embeddings.length !== chunks.length ||
      embeddings.some((vector) => vector.length !== 768 || !vector.every(Number.isFinite))
    )
      throw new Error('بردار سند معتبر نیست');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const fresh = await client.query(
        `SELECT id FROM knowledge_base_documents WHERE id=$1 AND "siteId"=$2 AND revision=$3 AND enabled=true FOR UPDATE`,
        [data.documentId, data.siteId, document.revision],
      );
      if (!fresh.rowCount) {
        await client.query('ROLLBACK');
        return;
      }
      await client.query(
        `DELETE FROM knowledge_base_chunks WHERE "documentId"=$1 AND "siteId"=$2`,
        [data.documentId, data.siteId],
      );
      for (let index = 0; index < chunks.length; index++)
        await client.query(
          `INSERT INTO knowledge_base_chunks ("siteId","documentId",content,embedding) VALUES ($1,$2,$3,$4::vector)`,
          [data.siteId, data.documentId, chunks[index], `[${embeddings[index].join(',')}]`],
        );
      await client.query(
        `UPDATE knowledge_base_documents SET status='ready' WHERE id=$1 AND "siteId"=$2 AND revision=$3`,
        [data.documentId, data.siteId, document.revision],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await pool.query(
      `UPDATE knowledge_base_documents SET status='failed' WHERE id=$1 AND "siteId"=$2 AND revision=$3`,
      [data.documentId, data.siteId, document.revision],
    );
    throw error;
  }
}
