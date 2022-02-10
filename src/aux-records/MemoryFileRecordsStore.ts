import {
    AddFileResult,
    EraseFileStoreResult,
    FileRecordsStore,
    GetFileRecordResult,
    MarkFileRecordAsUploadedResult,
    PresignFileUploadRequest,
    PresignFileUploadResult,
} from './FileRecordsStore';

export class MemoryFileRecordsStore implements FileRecordsStore {
    private _files: Map<string, StoredFile> = new Map();

    presignFileUpload(
        request: PresignFileUploadRequest
    ): Promise<PresignFileUploadResult> {
        throw new Error('Method not implemented.');
    }

    async getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<GetFileRecordResult> {
        let file = this._files.get(fileName);

        if (file) {
            return {
                success: true,
                fileName: file.fileName,
                recordName: file.recordName,
                publisherId: file.publisherId,
                subjectId: file.subjectId,
                sizeInBytes: file.sizeInBytes,
                uploaded: file.uploaded,
                description: file.description,
                url: `${file.recordName}/${file.fileName}`,
            };
        } else {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }
    }

    async addFileRecord(
        recordName: string,
        fileName: string,
        publisherId: string,
        subjectId: string,
        sizeInBytes: number,
        description: string
    ): Promise<AddFileResult> {
        if (this._files.has(fileName)) {
            return {
                success: false,
                errorCode: 'file_already_exists',
                errorMessage: 'The file already exists in the store.',
            };
        }

        let file: StoredFile = {
            fileName: fileName,
            recordName: recordName,
            publisherId,
            subjectId,
            sizeInBytes,
            description,
            uploaded: false,
        };

        this._files.set(fileName, file);

        return {
            success: true,
        };
    }

    async setFileRecordAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<MarkFileRecordAsUploadedResult> {
        let file = this._files.get(fileName);

        if (!file) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        file.uploaded = true;
        return {
            success: true,
        };
    }

    async eraseFileRecord(
        recordName: string,
        fileName: string
    ): Promise<EraseFileStoreResult> {
        const deleted = this._files.delete(fileName);
        if (!deleted) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        return {
            success: true,
        };
    }
}

interface StoredFile {
    fileName: string;
    recordName: string;
    publisherId: string;
    subjectId: string;
    sizeInBytes: number;
    uploaded: boolean;
    description: string;
}
