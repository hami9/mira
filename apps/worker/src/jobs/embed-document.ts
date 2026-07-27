import { AiEmbedDocumentJobData } from '@mira/shared-types';
import { pool } from '../db';
import { chunkText } from '../ai/chunk';
import { embedTexts } from '../ai/embeddings';

export async function processEmbedDocument(data: AiEmbedDocumentJobData): Promise<void> {
  const result = await pool.query<{ content: string }>(
    `SELECT content FROM knowledge_base_documents WHERE id = $1 AND "siteId" = $2`,
    [data.documentId, data.siteId],
  );
  const document = result.rows[0];
  if (!document) return;

  try {
    const chunks = chunkText(document.content);
    if (chunks.length === 0) {
      await setStatus(data.documentId, 'failed');
      return;
    }

    const embeddings = await embedTexts(chunks);

    // idempotent: اگه قبلاً chunk داشته (re-embed دستی)، اول پاکش کن
    await pool.query(`DELETE FROM knowledge_base_chunks WHERE "documentId" = $1`, [
      data.documentId,
    ]);

    for (let i = 0; i < chunks.length; i++) {
      const vectorLiteral = `[${embeddings[i].join(',')}]`;
      await pool.query(
        `INSERT INTO knowledge_base_chunks ("siteId", "documentId", content, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [data.siteId, data.documentId, chunks[i], vectorLiteral],
      );
    }

    await setStatus(data.documentId, 'ready');
  } catch (error) {
    await setStatus(data.documentId, 'failed');
    throw error;
  }
}

async function setStatus(documentId: string, status: 'ready' | 'failed'): Promise<void> {
  await pool.query(`UPDATE knowledge_base_documents SET status = $1 WHERE id = $2`, [
    status,
    documentId,
  ]);
}
