/**
 * Calculates multipart request size including boundaries and headers.
 * @param {Object} payload - JSON payload object
 * @returns {number} estimated size in bytes
 */
function calculateJsonPartSize(payload) {
  if (!payload) {
    return 0;
  }

  const jsonString = JSON.stringify(payload);
  const jsonSize = Buffer.byteLength(jsonString, 'utf8');
  // Overhead for multipart boundaries and headers
  const boundaryOverhead = 100;
  return jsonSize + boundaryOverhead;
}

function calculateFilePartSize(file) {
  if (!file || !file.content) {
    return 0;
  }

  let fileSize = 0;

  if (Buffer.isBuffer(file.content)) {
    fileSize = file.content.length;
  } else if (typeof file.content === 'string') {
    fileSize = Buffer.byteLength(file.content, 'utf8');
  } else if (file.content.length !== undefined) {
    fileSize = file.content.length;
  }

  // Overhead for multipart boundaries, headers, and filename
  const boundaryOverhead = 150;
  return fileSize + boundaryOverhead;
}

function calculateMultipartSize(payload, file) {
  const jsonSize = calculateJsonPartSize(payload);
  const fileSize = calculateFilePartSize(file);
  // Final boundary overhead (--boundary--\r\n)
  const finalBoundaryOverhead = 50;

  return jsonSize + fileSize + finalBoundaryOverhead;
}

module.exports = {
  calculateJsonPartSize,
  calculateFilePartSize,
  calculateMultipartSize,
};
