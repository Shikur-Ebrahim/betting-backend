const { pool } = require('./pool');

async function getDocument(collectionName, documentId) {
  const { rows } = await pool.query(
    `SELECT data, updated_at FROM app_documents WHERE collection_name = $1 AND document_id = $2`,
    [collectionName, String(documentId)]
  );
  if (!rows[0]) return null;
  return { data: rows[0].data, updatedAt: rows[0].updated_at };
}

async function upsertDocument(collectionName, documentId, data) {
  const json = JSON.stringify(data);
  await pool.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (collection_name, document_id) DO UPDATE SET
       data = EXCLUDED.data,
       updated_at = NOW()`,
    [collectionName, String(documentId), json]
  );
}

async function mergeDocumentData(collectionName, documentId, partial) {
  const json = JSON.stringify(partial);
  await pool.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (collection_name, document_id) DO UPDATE SET
       data = app_documents.data || EXCLUDED.data,
       updated_at = NOW()`,
    [collectionName, String(documentId), json]
  );
}

async function listCollection(collectionName) {
  const { rows } = await pool.query(
    `SELECT document_id, data FROM app_documents WHERE collection_name = $1`,
    [collectionName]
  );
  return rows;
}

async function listCollectionDataOnly(collectionName) {
  const { rows } = await pool.query(
    `SELECT data FROM app_documents WHERE collection_name = $1`,
    [collectionName]
  );
  return rows.map((r) => r.data);
}

async function deleteDocument(collectionName, documentId) {
  await pool.query(
    `DELETE FROM app_documents WHERE collection_name = $1 AND document_id = $2`,
    [collectionName, String(documentId)]
  );
}

module.exports = {
  getDocument,
  upsertDocument,
  mergeDocumentData,
  listCollection,
  listCollectionDataOnly,
  deleteDocument,
};
