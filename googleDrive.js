const { google } = require('googleapis');
const stream = require('stream');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN; // Debes obtenerlo una vez y guardarlo

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function uploadFileToDrive(fileBuffer, fileName, mimeType, folderId) {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileBuffer);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: bufferStream,
    },
    fields: 'id, webViewLink, webContentLink',
  });

  // Hacer el archivo público
  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return response.data.webViewLink;
}

module.exports = { uploadFileToDrive, oauth2Client, drive };
