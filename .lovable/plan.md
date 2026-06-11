I will implement the integration with Google Drive to allow uploading files directly to the GED system.

### Phase 1: Preparation
- I will check the available standard connectors and verify the `google_drive` connector configuration.
- I will use the `standard_connectors--connect` tool to ensure the project can link to a Google Drive account.

### Phase 2: Backend (Edge Function)
- I will create a new Supabase Edge Function `google-drive-integration` to:
  - List files from Google Drive using the connector gateway.
  - Download file content from Google Drive to be passed back to the frontend or directly uploaded to Supabase Storage.
  - *Note*: Using an Edge Function is safer for handling OAuth tokens and large file streams.

### Phase 3: Frontend Integration
- **New Component `GoogleDrivePicker`**: A modal component that allows users to:
  - Connect/Disconnect their Google account.
  - Browse folders and files in their Google Drive.
  - Search for files.
  - Select one or multiple files to import.
- **Update `MultiFileUploader`**:
  - Add a "Import from Google Drive" button.
  - When files are selected from Google Drive, they will be downloaded and added to the local upload queue so the user can still add descriptions and metadata before the final save.

### Technical Details
- **Connector**: `google_drive` standard connector.
- **Gateway**: I'll use the Lovable Connector Gateway to make authenticated requests to Google Drive API (`https://www.googleapis.com/drive/v3/files`).
- **File Handling**: Files from Google Drive will be fetched as Blobs and converted to `File` objects in the browser to maintain compatibility with the existing `MultiFileUploader` logic.

### Steps:
1. Connect the `google_drive` connector.
2. Create `src/components/dashboard/ged/GoogleDrivePicker.tsx`.
3. Modify `src/components/dashboard/ged/MultiFileUploader.tsx` to include the Google Drive button.
4. Implement the file listing and downloading logic using the connector gateway.
