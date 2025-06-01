import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { WalrusClient, RetryableWalrusClientError } from '@mysten/walrus';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { readFileSync, writeFileSync } from 'fs';

const suiClient = new SuiClient({
    url: getFullnodeUrl('mainnet'),
});

const walrusClient = new WalrusClient({
    network: 'mainnet',
    suiClient,
});

const keypair = Ed25519Keypair.fromSecretKey(
    '<KEY_PAIR>'
);

async function uploadPackageJson(path: string): Promise<string> {
    const content = readFileSync(path, 'utf-8');
    const fileBytes = new TextEncoder().encode(content);

    const { blobId, blobObject } = await walrusClient.writeBlob({
        blob: fileBytes,
        deletable: true,
        epochs: 3,
        signer: keypair,
    });

    console.log(`Uploaded with blobId: ${blobId}`);
    console.log(`Uploaded with blobObject: ${blobObject.id.id}`);
    return blobId;
}

//

(async () => {
    const blobId = await uploadPackageJson('./package.json');
})();

async function downloadPackageJson(blobId: string, outputPath: string): Promise<void> {
    try {
        const data = await walrusClient.readBlob({ blobId });
        const json = new TextDecoder().decode(data);
        writeFileSync(outputPath, json, 'utf-8');
        console.log(`Downloaded and saved to ${outputPath}`);
    } catch (error) {
        if (error instanceof RetryableWalrusClientError) {
            console.warn('Retryable error occurred. Resetting client and retrying...');
            walrusClient.reset();
            return downloadPackageJson(blobId, outputPath);
        }
        throw error;
    }
}

async function deleteBlobByObjectId(blobObjectId: string) {
    try {
        const { digest } = await walrusClient.executeDeleteBlobTransaction({
            blobObjectId,
            signer: keypair,
        });

        console.log(`✅ Blob deleted successfully. Transaction digest: ${digest}`);
    } catch (err) {
        if (err instanceof RetryableWalrusClientError) {
            walrusClient.reset();
            console.warn('⚠️ Retrying after client reset...');
            const { digest } = await walrusClient.executeDeleteBlobTransaction({
                blobObjectId,
                signer: keypair,
            });
            console.log(`✅ Blob deleted after retry. Digest: ${digest}`);
        } else {
            console.error('❌ Failed to delete blob:', err);
        }
    }
}