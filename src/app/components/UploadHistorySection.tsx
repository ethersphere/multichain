import React from 'react';
import styles from './css/UploadHistorySection.module.css';
import { BEE_GATEWAY_URL } from './constants';

interface UploadHistoryProps {
  address: string | undefined;
  setShowUploadHistory: (show: boolean) => void;
}

interface UploadRecord {
  reference: string;
  timestamp: number;
  filename?: string;
  stampId: string;
  expiryDate: number;
}

interface UploadHistory {
  [address: string]: UploadRecord[];
}

type FileType = 'all' | 'images' | 'videos' | 'audio' | 'archives' | 'websites';

const UploadHistorySection: React.FC<UploadHistoryProps> = ({ address, setShowUploadHistory }) => {
  const [history, setHistory] = React.useState<UploadRecord[]>([]);
  const [selectedFilter, setSelectedFilter] = React.useState<FileType>('all');

  const formatStampId = (stampId: string) => {
    if (!stampId || typeof stampId !== 'string' || stampId.length < 10) {
      return stampId || 'Invalid Stamp ID';
    }
    return `${stampId.slice(0, 6)}...${stampId.slice(-4)}`;
  };

  const formatReference = (reference: string) => {
    if (!reference || typeof reference !== 'string' || reference.length < 10) {
      return reference || 'Invalid Reference';
    }
    return `${reference.slice(0, 6)}...${reference.slice(-4)}`;
  };

  React.useEffect(() => {
    if (address) {
      const savedHistory = localStorage.getItem('uploadHistory');
      if (savedHistory) {
        const parsedHistory: UploadHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory[address] || []);
      }
    }
  }, [address]);

  const formatDate = (timestamp: number) => {
    if (timestamp === undefined) return 'Unknown';
    return new Date(timestamp).toLocaleDateString();
  };

  const formatExpiryDays = (ttl: number) => {
    return `${Math.floor(ttl / 86400)} days`;
  };

  const isArchiveFile = (filename?: string) => {
    if (!filename) return false;
    const archiveExtensions = ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2'];
    return archiveExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  // File type detection functions
  const getFileType = (filename?: string): FileType => {
    if (!filename) return 'all';

    const extension = filename.toLowerCase();

    // Image files
    const imageExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.svg',
      '.webp',
      '.bmp',
      '.ico',
      '.tiff',
      '.tif',
    ];
    if (imageExtensions.some(ext => extension.endsWith(ext))) {
      return 'images';
    }

    // Video files
    const videoExtensions = [
      '.mp4',
      '.avi',
      '.mov',
      '.wmv',
      '.flv',
      '.webm',
      '.mkv',
      '.m4v',
      '.3gp',
      '.ogv',
    ];
    if (videoExtensions.some(ext => extension.endsWith(ext))) {
      return 'videos';
    }

    // Audio files
    const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.opus'];
    if (audioExtensions.some(ext => extension.endsWith(ext))) {
      return 'audio';
    }

    // Archive files
    const archiveExtensions = ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2'];
    if (archiveExtensions.some(ext => extension.endsWith(ext))) {
      return 'archives';
    }

    // Website files (common web file extensions)
    const webExtensions = ['.html', '.htm', '.css', '.js', '.json'];
    if (webExtensions.some(ext => extension.endsWith(ext))) {
      return 'websites';
    }

    return 'all';
  };

  const getFileTypeLabel = (filename?: string): string => {
    const type = getFileType(filename);
    switch (type) {
      case 'images':
        return 'Image';
      case 'videos':
        return 'Video';
      case 'audio':
        return 'Audio';
      case 'archives':
        return 'Archive';
      case 'websites':
        return 'Website';
      default:
        return 'File';
    }
  };

  // Filter history based on selected filter
  const filteredHistory = React.useMemo(() => {
    if (selectedFilter === 'all') {
      return history;
    }

    return history.filter(record => {
      const fileType = getFileType(record.filename);
      return fileType === selectedFilter;
    });
  }, [history, selectedFilter]);

  // Get filter counts
  const getFilterCounts = React.useMemo(() => {
    const counts = {
      all: history.length,
      images: 0,
      videos: 0,
      audio: 0,
      archives: 0,
      websites: 0,
    };

    history.forEach(record => {
      const type = getFileType(record.filename);
      if (type !== 'all') {
        counts[type]++;
      }
    });

    return counts;
  }, [history]);

  const getReferenceUrl = (record: UploadRecord) => {
    // For non-archive files with a filename, include the filename in the URL
    if (record.filename && !isArchiveFile(record.filename)) {
      return `${BEE_GATEWAY_URL}${record.reference}/${record.filename}`;
    }
    // Otherwise use the default URL for the reference
    return `${BEE_GATEWAY_URL}${record.reference}/`;
  };

  const downloadCSV = () => {
    // Use filtered history for CSV export
    const dataToExport = filteredHistory;
    if (dataToExport.length === 0) return;

    // CSV headers - added File Type column
    const headers = [
      'Reference',
      'Stamp ID',
      'Date Created',
      'Expiry (Days)',
      'Filename',
      'File Type',
      'Full Link',
    ];

    // Convert history data to CSV rows
    const csvRows = dataToExport.map(record => [
      record.reference,
      record.stampId,
      formatDate(record.timestamp),
      formatExpiryDays(record.expiryDate),
      record.filename || 'Unnamed upload',
      getFileTypeLabel(record.filename),
      getReferenceUrl(record),
    ]);

    // Combine headers and data
    const csvContent = [headers, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);

    // Include filter in filename if not 'all'
    const filterSuffix = selectedFilter !== 'all' ? `-${selectedFilter}` : '';
    link.setAttribute(
      'download',
      `upload-history-${address?.slice(0, 8)}${filterSuffix}-${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uploadCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !address) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const csvContent = e.target?.result as string;
        const lines = csvContent.split('\n');

        // Skip header row and filter out empty lines
        const dataLines = lines.slice(1).filter(line => line.trim());

        const newRecords: UploadRecord[] = [];
        const existingReferences = new Set(history.map(record => record.reference));

        dataLines.forEach(line => {
          // Parse CSV line (handle quoted fields)
          const fields = line.split(',').map(field => field.replace(/^"|"$/g, '').trim());

          if (fields.length >= 6) {
            const [
              reference,
              stampId,
              dateCreated,
              expiryDays,
              filename,
              fileTypeOrFullLink,
              fullLink,
            ] = fields;

            // Skip if reference already exists (prevent duplicates)
            if (existingReferences.has(reference)) {
              console.log(`Skipping duplicate reference: ${reference}`);
              return;
            }

            // Parse date and expiry
            const timestamp = new Date(dateCreated).getTime();
            const expiryInSeconds = parseInt(expiryDays.replace(' days', '')) * 86400;

            if (!isNaN(timestamp) && !isNaN(expiryInSeconds)) {
              newRecords.push({
                reference,
                stampId,
                timestamp,
                filename: filename === 'Unnamed upload' ? undefined : filename,
                expiryDate: expiryInSeconds,
              });

              // Add to existing references set to prevent duplicates within the same upload
              existingReferences.add(reference);
            }
          }
        });

        if (newRecords.length > 0) {
          // Merge with existing history
          const updatedHistory = [...newRecords, ...history];
          setHistory(updatedHistory);

          // Save to localStorage
          const savedHistory = localStorage.getItem('uploadHistory');
          const allHistory: UploadHistory = savedHistory ? JSON.parse(savedHistory) : {};
          allHistory[address] = updatedHistory;
          localStorage.setItem('uploadHistory', JSON.stringify(allHistory));

          alert(
            `Successfully imported ${newRecords.length} new records. Skipped duplicates if any.`
          );
        } else {
          alert('No new records found or all records were duplicates.');
        }
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please check the format.');
      }
    };

    reader.readAsText(file);
    // Reset the input value so the same file can be selected again
    event.target.value = '';
  };

  const clearHistory = () => {
    if (!address) return;

    const confirmed = window.confirm(
      'Are you sure you want to clear all upload history? This action cannot be undone.'
    );
    if (confirmed) {
      setHistory([]);

      // Remove from localStorage
      const savedHistory = localStorage.getItem('uploadHistory');
      if (savedHistory) {
        const allHistory: UploadHistory = JSON.parse(savedHistory);
        delete allHistory[address];
        localStorage.setItem('uploadHistory', JSON.stringify(allHistory));
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <h2 className={styles.title}>Upload History</h2>
        <div className={styles.buttonGroup}>
          {filteredHistory.length > 0 && (
            <button className={styles.downloadButton} onClick={downloadCSV} title="Download CSV">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
          {address && (
            <label className={styles.uploadButton} title="Upload CSV">
              <input
                type="file"
                accept=".csv"
                onChange={uploadCSV}
                className={styles.hiddenInput}
              />
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </label>
          )}
          {history.length > 0 && (
            <button className={styles.clearButton} onClick={clearHistory} title="Clear History">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3,6 5,6 21,6" />
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filter buttons */}
      {history.length > 0 && (
        <div className={styles.filterContainer}>
          <div className={styles.filterButtons}>
            <button
              className={`${styles.filterButton} ${selectedFilter === 'all' ? styles.activeFilter : ''}`}
              onClick={() => setSelectedFilter('all')}
            >
              All ({getFilterCounts.all})
            </button>
            <button
              className={`${styles.filterButton} ${selectedFilter === 'images' ? styles.activeFilter : ''}`}
              onClick={() => setSelectedFilter('images')}
              disabled={getFilterCounts.images === 0}
            >
              Images ({getFilterCounts.images})
            </button>
            <button
              className={`${styles.filterButton} ${selectedFilter === 'videos' ? styles.activeFilter : ''}`}
              onClick={() => setSelectedFilter('videos')}
              disabled={getFilterCounts.videos === 0}
            >
              Videos ({getFilterCounts.videos})
            </button>
            <button
              className={`${styles.filterButton} ${selectedFilter === 'audio' ? styles.activeFilter : ''}`}
              onClick={() => setSelectedFilter('audio')}
              disabled={getFilterCounts.audio === 0}
            >
              Audio ({getFilterCounts.audio})
            </button>
            <button
              className={`${styles.filterButton} ${selectedFilter === 'archives' ? styles.activeFilter : ''}`}
              onClick={() => setSelectedFilter('archives')}
              disabled={getFilterCounts.archives === 0}
            >
              Archives ({getFilterCounts.archives})
            </button>
            <button
              className={`${styles.filterButton} ${selectedFilter === 'websites' ? styles.activeFilter : ''}`}
              onClick={() => setSelectedFilter('websites')}
              disabled={getFilterCounts.websites === 0}
            >
              Websites ({getFilterCounts.websites})
            </button>
          </div>
        </div>
      )}

      {!address ? (
        <div className={styles.emptyState}>Connect wallet to check upload history</div>
      ) : history.length === 0 ? (
        <div className={styles.emptyState}>No uploads found for this address</div>
      ) : filteredHistory.length === 0 ? (
        <div className={styles.emptyState}>
          No {selectedFilter === 'all' ? 'files' : selectedFilter} found in your upload history
        </div>
      ) : (
        <div className={styles.historyList}>
          {filteredHistory.map((record, index) => (
            <div key={index} className={styles.historyItem}>
              <div className={styles.itemHeader}>
                <div className={styles.filenameContainer}>
                  <span className={styles.filename}>{record.filename || 'Unnamed upload'}</span>
                  <span className={styles.fileType}>{getFileTypeLabel(record.filename)}</span>
                </div>
                <span className={styles.date}>{formatDate(record.timestamp)}</span>
              </div>
              <div className={styles.itemDetails}>
                <div className={styles.referenceRow}>
                  <span className={styles.label}>Reference:</span>
                  <a
                    href={getReferenceUrl(record)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.link}
                    title={record.reference}
                  >
                    {formatReference(record.reference)}
                    {record.filename && !isArchiveFile(record.filename)
                      ? `/${record.filename}`
                      : ''}
                  </a>
                </div>
                <div className={styles.stampRow}>
                  <span className={styles.label}>Stamps ID:</span>
                  <span
                    className={styles.stampId}
                    title={record.stampId}
                    onClick={() => {
                      navigator.clipboard.writeText(record.stampId);
                      // Show temporary "Copied!" message
                      const element = document.querySelector(`[data-stamp-id="${record.stampId}"]`);
                      if (element) {
                        element.setAttribute('data-copied', 'true');
                        setTimeout(() => {
                          element.setAttribute('data-copied', 'false');
                        }, 2000);
                      }
                    }}
                    data-stamp-id={record.stampId}
                    data-copied="false"
                  >
                    {formatStampId(record.stampId)}
                  </span>
                </div>
                <div className={styles.expiryRow}>
                  <span className={styles.label}>Expires:</span>
                  <span className={styles.expiryDate}>{formatExpiryDays(record.expiryDate)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className={styles.backButton} onClick={() => setShowUploadHistory(false)}>
        Back
      </button>
    </div>
  );
};

export default UploadHistorySection;
