import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-4xl font-semibold text-gray-900">404</div>
        <p className="mt-2 text-sm text-gray-600">
          The page you are looking for doesn’t exist or has been moved.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Go to Home
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
