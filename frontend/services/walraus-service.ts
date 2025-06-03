// App.tsx - Complete single file version
import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  SuiClientProvider, 
  WalletProvider, 
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction
} from '@mysten/dapp-kit';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { WalrusClient } from '@mysten/walrus';
import '@mysten/dapp-kit/dist/index.css';

const queryClient = new QueryClient();
const networks = {
  testnet: { url: getFullnodeUrl('testnet') },
};

const suiClient = new SuiClient({
  url: getFullnodeUrl('testnet'),
});

const walrusClient = new WalrusClient({
  network: 'testnet',
  suiClient,
  storageNodeClientOptions: {
    timeout: 120_000, // Increased timeout
    retries: 3, // Add retry attempts
  },
});

function FileUpload() {
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const currentAccount = useCurrentAccount();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobId, setBlobId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setBlobId(null);
    }
  };

  const uploadFile = async () => {
    if (!currentAccount || !selectedFile) return;
    
    // Check file size
    const maxSize = 10 * 1024 * 1024; // 10MB limit for testing
    if (selectedFile.size > maxSize) {
      setError(`File too large. Please select a file smaller than ${maxSize / 1024 / 1024}MB for testnet.`);
      return;
    }
    
    setIsUploading(true);
    setError(null);
    setBlobId(null);

    try {
      // Read the file as bytes
      const fileBuffer = await selectedFile.arrayBuffer();
      const file = new Uint8Array(fileBuffer);

      console.log('Encoding blob...');
      const encoded = await walrusClient.encodeBlob(file);

      console.log('Registering blob transaction...');
      const registerBlobTransaction = await walrusClient.registerBlobTransaction({
        blobId: encoded.blobId,
        rootHash: encoded.rootHash,
        size: file.length,
        deletable: true,
        epochs: 3,
        owner: currentAccount.address,
      });
      registerBlobTransaction.setSender(currentAccount.address);

      console.log('Signing and executing register transaction...');
      const { digest } = await signAndExecuteTransaction({ 
        transaction: registerBlobTransaction 
      });

      console.log('Waiting for transaction confirmation...');
      const { objectChanges, effects } = await suiClient.waitForTransaction({
        digest,
        options: { showObjectChanges: true, showEffects: true },
      });

      if (effects?.status.status !== 'success') {
        throw new Error('Failed to register blob');
      }

      const blobType = await walrusClient.getBlobType();

      const blobObject = objectChanges?.find(
        (change) => change.type === 'created' && change.objectType === blobType,
      );

      if (!blobObject || blobObject.type !== 'created') {
        throw new Error('Blob object not found');
      }

      console.log('Writing encoded blob to nodes...');
      let confirmations;
      try {
        confirmations = await walrusClient.writeEncodedBlobToNodes({
          blobId: encoded.blobId,
          metadata: encoded.metadata,
          sliversByNode: encoded.sliversByNode,
          deletable: true,
          objectId: blobObject.objectId,
        });
      } catch (storageError) {
        console.error('Storage node error:', storageError);
        throw new Error(`Failed to store file data on Walrus nodes. This might be due to testnet instability. Error: ${storageError instanceof Error ? storageError.message : 'Unknown storage error'}`);
      }

      console.log('Certifying blob...');
      const certifyBlobTransaction = await walrusClient.certifyBlobTransaction({
        blobId: encoded.blobId,
        blobObjectId: blobObject.objectId,
        confirmations,
        deletable: true,
      });
      certifyBlobTransaction.setSender(currentAccount.address);

      const { digest: certifyDigest } = await signAndExecuteTransaction({
        transaction: certifyBlobTransaction,
      });

      const { effects: certifyEffects } = await suiClient.waitForTransaction({
        digest: certifyDigest,
        options: { showEffects: true },
      });

      if (certifyEffects?.status.status !== 'success') {
        throw new Error('Failed to certify blob');
      }

      setBlobId(encoded.blobId);
      console.log('Upload successful! Blob ID:', encoded.blobId);
      
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* File Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '10px', 
          fontWeight: 'bold' 
        }}>
          Select File to Upload:
        </label>
        <input
          type="file"
          onChange={handleFileSelect}
          style={{
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            width: '100%',
            maxWidth: '400px'
          }}
        />
        <div style={{
          marginTop: '5px',
          fontSize: '12px',
          color: '#666'
        }}>
          ⚠️ Testnet limit: Max 10MB. Some storage nodes may be unstable.
        </div>
      </div>

      {/* Selected File Info */}
      {selectedFile && (
        <div style={{
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: selectedFile.size > 5 * 1024 * 1024 ? '#fff3cd' : '#e7f3ff',
          border: selectedFile.size > 5 * 1024 * 1024 ? '1px solid #ffeaa7' : '1px solid #b3d9ff',
          borderRadius: '4px'
        }}>
          <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Selected File:</p>
          <p style={{ margin: '0', fontSize: '14px' }}>
            <strong>Name:</strong> {selectedFile.name}<br/>
            <strong>Size:</strong> {(selectedFile.size / 1024).toFixed(2)} KB
            {selectedFile.size > 5 * 1024 * 1024 && (
              <span style={{ color: '#856404', marginLeft: '10px' }}>⚠️ Large file - may fail</span>
            )}<br/>
            <strong>Type:</strong> {selectedFile.type || 'Unknown'}
          </p>
        </div>
      )}

      {/* Upload Button */}
      <button 
        onClick={uploadFile} 
        disabled={isUploading || !selectedFile}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: isUploading || !selectedFile ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isUploading || !selectedFile ? 'not-allowed' : 'pointer'
        }}
      >
        {isUploading ? 'Uploading...' : !selectedFile ? 'Select a file first' : 'Upload File'}
      </button>

      {error && (
        <div style={{ 
          marginTop: '10px', 
          padding: '15px', 
          backgroundColor: '#f8d7da', 
          border: '1px solid #f5c6cb', 
          borderRadius: '4px',
          color: '#721c24'
        }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>❌ Upload Failed</p>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>{error}</p>
          
          {error.includes('storage') || error.includes('nodes') ? (
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffeaa7', 
              borderRadius: '4px',
              color: '#856404',
              fontSize: '12px'
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>💡 Troubleshooting Tips:</p>
              <ul style={{ margin: '0', paddingLeft: '20px' }}>
                <li>Try a smaller file (under 1MB)</li>
                <li>Wait a few minutes and try again</li>
                <li>Check your internet connection</li>
                <li>Walrus testnet nodes may be temporarily down</li>
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {blobId && selectedFile && (
        <div style={{ 
          marginTop: '10px', 
          padding: '10px', 
          backgroundColor: '#d4edda', 
          border: '1px solid #c3e6cb', 
          borderRadius: '4px',
          color: '#155724'
        }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>
            ✅ Upload Successful!
          </p>
          <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>
            <strong>File:</strong> {selectedFile.name}
          </p>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontFamily: 'monospace' }}>
            <strong>Blob ID:</strong> {blobId}
          </p>
          <p style={{ margin: '0', fontSize: '12px', color: '#0f5132' }}>
            Your file is now stored on Walrus and can be accessed using this Blob ID.
            Use the retrieval section below to download it back!
          </p>
        </div>
      )}
    </div>
  );
}

function FileRetrieval() {
  const [blobId, setBlobId] = useState<string>('');
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [retrievedData, setRetrievedData] = useState<{
    content: Uint8Array;
    fileName?: string;
    fileType?: string;
    size: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retrieveFile = async () => {
    const trimmedBlobId = blobId?.trim();
    
    console.log('retrieveFile called with blobId:', blobId);
    console.log('trimmedBlobId:', trimmedBlobId);
    
    if (!trimmedBlobId) {
      setError('Please enter a blob ID');
      return;
    }

    setIsRetrieving(true);
    setError(null);
    setRetrievedData(null);

    try {
      console.log('Retrieving blob:', trimmedBlobId);
      console.log('Blob ID length:', trimmedBlobId.length);
      
      // Validate blob ID format (should be base64-like)
      if (trimmedBlobId.length < 10) {
        throw new Error('Blob ID appears to be too short. Please check the ID.');
      }
      
      console.log('Calling walrusClient.readBlob...');
      
      // Read the blob from Walrus
      const blobData = await walrusClient.readBlob({ blobId: trimmedBlobId });
      
      console.log('File retrieved successfully, size:', blobData.length, 'bytes');
      
      setRetrievedData({
        content: blobData,
        size: blobData.length,
        fileName: `walrus_file_${trimmedBlobId.slice(0, 8)}`,
      });
      
    } catch (err) {
      console.error('Retrieval failed:', err);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to retrieve file';
      if (err instanceof Error) {
        if (err.message.includes('400')) {
          errorMessage = `Bad Request (400): The blob ID "${trimmedBlobId}" may be invalid or the file may not exist on Walrus.`;
        } else if (err.message.includes('404')) {
          errorMessage = `File not found (404): The blob with ID "${trimmedBlobId}" does not exist.`;
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          errorMessage = `Network error: Unable to connect to Walrus storage nodes. Please check your internet connection and try again.`;
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsRetrieving(false);
    }
  };

  const downloadFile = () => {
    if (!retrievedData) return;

    const blob = new Blob([retrievedData.content]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = retrievedData.fileName || 'downloaded_file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFilePreview = () => {
    if (!retrievedData) return null;

    // Try to decode as text first
    try {
      const text = new TextDecoder('utf-8').decode(retrievedData.content);
      
      // Check if it looks like text (no null bytes, mostly printable chars)
      const hasNullBytes = text.includes('\0');
      const printableRatio = (text.match(/[\x20-\x7E\s]/g) || []).length / text.length;
      
      if (!hasNullBytes && printableRatio > 0.8) {
        return (
          <div style={{
            marginTop: '15px',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            <h4 style={{ margin: '0 0 10px 0' }}>File Preview (Text):</h4>
            <pre style={{ 
              margin: '0', 
              whiteSpace: 'pre-wrap', 
              fontSize: '14px',
              fontFamily: 'monospace'
            }}>
              {text}
            </pre>
          </div>
        );
      }
    } catch (e) {
      // Not valid UTF-8 text
    }

    // Check if it's an image by trying to create a data URL
    const uint8Array = new Uint8Array(retrievedData.content);
    
    // Check for common image magic bytes
    const isJPEG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8;
    const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47;
    const isGIF = uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46;
    const isWebP = uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && uint8Array[10] === 0x42 && uint8Array[11] === 0x50;

    if (isJPEG || isPNG || isGIF || isWebP) {
      const mimeType = isJPEG ? 'image/jpeg' : isPNG ? 'image/png' : isGIF ? 'image/gif' : 'image/webp';
      const blob = new Blob([retrievedData.content], { type: mimeType });
      const imageUrl = URL.createObjectURL(blob);
      
      return (
        <div style={{
          marginTop: '15px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px'
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>File Preview (Image):</h4>
          <img 
            src={imageUrl} 
            alt="Retrieved file" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '300px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
            onLoad={() => URL.revokeObjectURL(imageUrl)}
          />
        </div>
      );
    }

    // For binary files, just show hex preview
    const hexPreview = Array.from(retrievedData.content.slice(0, 64))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');

    return (
      <div style={{
        marginTop: '15px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px'
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>File Preview (Binary):</h4>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
          First 64 bytes (hex):
        </p>
        <code style={{ 
          fontSize: '12px', 
          fontFamily: 'monospace',
          wordBreak: 'break-all',
          backgroundColor: '#fff',
          padding: '5px',
          borderRadius: '3px'
        }}>
          {hexPreview}
          {retrievedData.content.length > 64 && '...'}
        </code>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ margin: '0 0 20px 0' }}>Retrieve File by Blob ID</h3>
      
      {/* Blob ID Input */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '10px', 
          fontWeight: 'bold' 
        }}>
          Enter Blob ID:
        </label>
        <input
          type="text"
          value={blobId}
          onChange={(e) => {
            console.log('Blob ID input changed:', e.target.value);
            setBlobId(e.target.value);
          }}
          placeholder="e.g., 5NFglzelMz_ZezfNWTC0Y-k2ltSOfo2UGIvwu1hcS_Y"
          style={{
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            width: '100%',
            maxWidth: '500px',
            fontFamily: 'monospace',
            fontSize: '14px'
          }}
        />
        {blobId && (
          <div style={{ 
            marginTop: '5px', 
            fontSize: '12px', 
            color: '#666',
            fontFamily: 'monospace'
          }}>
            Current ID: {blobId} (Length: {blobId.length})
          </div>
        )}
      </div>

      {/* Retrieve Button */}
      <button 
        onClick={retrieveFile} 
        disabled={isRetrieving || !blobId.trim()}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: isRetrieving || !blobId.trim() ? '#ccc' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isRetrieving || !blobId.trim() ? 'not-allowed' : 'pointer',
          marginRight: '10px'
        }}
      >
        {isRetrieving ? 'Retrieving...' : 'Retrieve File'}
      </button>

      {/* Quick Test Button */}
      <button 
        onClick={() => {
          const testBlobId = '5NFglzelMz_ZezfNWTC0Y-k2ltSOfo2UGIvwu1hcS_Y';
          console.log('Setting test blob ID:', testBlobId);
          setBlobId(testBlobId);
          setError(null);
          setRetrievedData(null);
        }}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#17a2b8',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Test with Your Blob ID
      </button>

      {/* Debug info */}
      <div style={{ 
        marginTop: '10px', 
        fontSize: '12px', 
        color: '#666',
        backgroundColor: '#f8f9fa',
        padding: '8px',
        borderRadius: '4px'
      }}>
        Debug: Current blob ID state = "{blobId}" (type: {typeof blobId}, length: {blobId?.length || 0})
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ 
          marginTop: '15px', 
          padding: '15px', 
          backgroundColor: '#f8d7da', 
          border: '1px solid #f5c6cb', 
          borderRadius: '4px',
          color: '#721c24'
        }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>❌ Retrieval Failed</p>
          <p style={{ margin: '0', fontSize: '14px' }}>{error}</p>
        </div>
      )}

      {/* Success Display */}
      {retrievedData && (
        <div style={{ 
          marginTop: '15px', 
          padding: '15px', 
          backgroundColor: '#d4edda', 
          border: '1px solid #c3e6cb', 
          borderRadius: '4px',
          color: '#155724'
        }}>
          <p style={{ margin: '0 0 15px 0', fontWeight: 'bold' }}>
            ✅ File Retrieved Successfully!
          </p>
          
          <div style={{ marginBottom: '15px' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}>
              <strong>Size:</strong> {(retrievedData.size / 1024).toFixed(2)} KB ({retrievedData.size} bytes)
            </p>
            <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
              <strong>Blob ID:</strong> 
              <code style={{ 
                marginLeft: '5px', 
                backgroundColor: '#f0f0f0', 
                padding: '2px 4px', 
                borderRadius: '3px',
                fontSize: '12px'
              }}>
                {blobId}
              </code>
            </p>
            
            <button 
              onClick={downloadFile}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              💾 Download File
            </button>
          </div>

          {/* File Preview */}
          {getFilePreview()}
        </div>
      )}
    </div>
  );
}

function WalletSection() {
  const currentAccount = useCurrentAccount();

  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #ddd', 
      borderRadius: '8px', 
      marginBottom: '20px',
      backgroundColor: '#f9f9f9'
    }}>
      <h2 style={{ margin: '0 0 15px 0' }}>Wallet Connection</h2>
      
      {!currentAccount ? (
        <div>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            Connect your Sui wallet to upload files to Walrus
          </p>
          <ConnectButton />
        </div>
      ) : (
        <div>
          <p style={{ marginBottom: '10px', color: '#155724' }}>
            ✅ Wallet Connected
          </p>
          <p style={{ 
            fontSize: '14px', 
            color: '#666', 
            fontFamily: 'monospace',
            backgroundColor: '#f0f0f0',
            padding: '8px',
            borderRadius: '4px',
            wordBreak: 'break-all'
          }}>
            Address: {currentAccount.address}
          </p>
          <ConnectButton />
        </div>
      )}
    </div>
  );
}

function AppContent() {
  const currentAccount = useCurrentAccount();

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
        Walrus File Upload & Retrieval
      </h1>
      
      <WalletSection />
      
      {currentAccount ? (
        <div>
          {/* File Upload Section */}
          <div style={{ 
            padding: '20px', 
            border: '1px solid #ddd', 
            borderRadius: '8px',
            backgroundColor: '#fff',
            marginBottom: '20px'
          }}>
            <h2 style={{ margin: '0 0 20px 0' }}>📤 Upload Files</h2>
            <FileUpload />
          </div>

          {/* File Retrieval Section */}
          <div style={{ 
            padding: '20px', 
            border: '1px solid #ddd', 
            borderRadius: '8px',
            backgroundColor: '#fff'
          }}>
            <h2 style={{ margin: '0 0 20px 0' }}>📥 Retrieve Files</h2>
            <FileRetrieval />
          </div>
        </div>
      ) : (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          border: '2px dashed #ddd', 
          borderRadius: '8px',
          color: '#888'
        }}>
          <h3>Please connect your wallet to continue</h3>
          <p>You need to connect a Sui wallet to upload and retrieve files from Walrus.</p>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <AppContent />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export default App;