// Make sure this is defined, pointing to your server's address
// If your FE and BE are on the same domain, you can omit it and use relative paths.
const API_BASE_URL = "http://localhost:3001";

const DownloadReviewsButton = () => {
  const downloadUrl = `${API_BASE_URL}/api/archived-reviews/download`;

  return (
    <div className="max-w-4xl mx-auto">
      {/* This container makes the button stick to the top right of its parent */}
      <div className="sticky top-4 z-50 flex justify-end">
        <button
          className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg transition-colors"
          title="Download All Raw Reviews"
          // This opens the download URL in a new tab, triggering the download
          onClick={() => window.open(downloadUrl, "_blank")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default DownloadReviewsButton;
